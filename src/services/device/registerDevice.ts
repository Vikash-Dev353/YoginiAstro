import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApp, getApps } from "@react-native-firebase/app";
import {
  AuthorizationStatus,
  getMessaging,
  getToken,
  registerDeviceForRemoteMessages,
  requestPermission,
  setAutoInitEnabled,
} from "@react-native-firebase/messaging";
import axios from "axios";
import { PermissionsAndroid, Platform } from "react-native";

const DEVICE_ID_KEY = "@yogini_device_install_id";

/**
 * Same URL as curl — meanmaestro device API only (not the main REST `apiClient` base).
 */
export const REGISTER_DEVICE_URL =
  "https://yoginiastro.com/api/device/register-device";

export const ATTACH_DEVICE_URL =
  "https://yoginiastro.com/api/device/attach-device";

function randomUuidV4(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function getOrCreateDeviceId(): Promise<string> {
  const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (existing) {
    return existing;
  }
  const id = randomUuidV4();
  await AsyncStorage.setItem(DEVICE_ID_KEY, id);
  return id;
}

async function requestNotificationPermission(): Promise<void> {
  if (Platform.OS === "android" && Number(Platform.Version) >= 33) {
    try {
      await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
      );
    } catch {
      // ignore
    }
  }
}

function isFirebaseNativeReady(): boolean {
  try {
    return getApps().length > 0;
  } catch {
    return false;
  }
}

function maskSensitiveToken(value: string): string {
  if (!value) return "(empty)";
  if (value.length <= 18) return `*** (len=${value.length})`;
  return `${value.slice(0, 10)}...${value.slice(-8)} (len=${value.length})`;
}

/** Native Firebase init can lag behind JS; wait before first getToken. */
async function waitForFirebaseApp(maxMs = 8000): Promise<boolean> {
  const step = 250;
  for (let elapsed = 0; elapsed < maxMs; elapsed += step) {
    if (isFirebaseNativeReady()) {
      return true;
    }
    await new Promise<void>((resolve) => setTimeout(resolve, step));
  }
  return isFirebaseNativeReady();
}

/**
 * System notification permission first (Android 13+ dialog / iOS messaging prompt),
 * then FCM can return a token. Retries only `getToken`, not the permission dialog.
 */
async function ensureNotificationPermission(): Promise<boolean> {
  if (!isFirebaseNativeReady()) {
    return false;
  }

  const app = getApp();
  const messaging = getMessaging(app);

  try {
    await setAutoInitEnabled(messaging, true);

    if (Platform.OS === "ios") {
      await registerDeviceForRemoteMessages(messaging);
      const status = await requestPermission(messaging);
      return (
        status === AuthorizationStatus.AUTHORIZED ||
        status === AuthorizationStatus.PROVISIONAL ||
        status === AuthorizationStatus.EPHEMERAL
      );
    }

    await requestNotificationPermission();
    return true;
  } catch (e) {
    console.warn("[device] notification permission error", e);
    return false;
  }
}

async function getFcmTokenWithRetry(): Promise<string | null> {
  const ready = await waitForFirebaseApp();
  if (!ready) {
    console.warn(
      "[device] Firebase [DEFAULT] never appeared — download real `google-services.json` from Firebase Console for package `com.yoginiastro`, then clean rebuild."
    );
    return null;
  }

  const permitted = await ensureNotificationPermission();
  if (!permitted) {
    console.warn(
      "[device] notification permission not granted — register-device may use empty token."
    );
    if (Platform.OS === "ios") {
      return null;
    }
  }

  const app = getApp();
  const messaging = getMessaging(app);

  for (let i = 0; i < 6; i += 1) {
    try {
      const token = await getToken(messaging);
      if (token?.trim()) {
        return token.trim();
      }
    } catch (e) {
      console.warn("[device] FCM getToken error", e);
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 600));
  }
  return null;
}

export type DeviceRegisterRole = "user" | "astrologer";

/**
 * Requests notification permission, then POSTs `deviceId` + FCM `token` to meanmaestro register-device.
 * Call once from auth flow (e.g. AuthNavigator mount). Sends `token: ""` if FCM unavailable.
 */
export async function registerDeviceWithNotificationPermission(
  role: DeviceRegisterRole = "astrologer"
): Promise<void> {
  try {
    const deviceId = await getOrCreateDeviceId();
    const fcmToken = await getFcmTokenWithRetry();
    const token = fcmToken ?? "";
    const device = "mobile";

    if (!fcmToken) {
      console.warn(
        "[device] FCM token empty — register-device still sent (token may be rejected by server until Firebase is configured)."
      );
    }

    const body = { deviceId, token, role, device };
    console.log("[device] register-device body", {
      deviceId,
      role,
      device,
      hasFcmToken: Boolean(fcmToken),
      tokenPreview: maskSensitiveToken(token),
    });

    const { status, data } = await axios.post(REGISTER_DEVICE_URL, body, {
      headers: { "Content-Type": "application/json" },
      timeout: 25000,
      validateStatus: () => true,
    });

    if (status >= 200 && status < 300) {
      console.log("[device] register-device ok", status);
      return;
    }

    console.warn("[device] register-device HTTP", status, data);
  } catch (e) {
    console.warn("[device] register-device failed", e);
  }
}

/**
 * Links the install `deviceId` (same as register-device) to a logged-in `astroId`.
 * Requires a valid Bearer token (e.g. after OTP verify or session restore).
 */
export async function attachDeviceToUser(params: {
  authToken: string;
  astroId: string;
}): Promise<void> {
  const authToken = params.authToken?.trim();
  const astroId = params.astroId?.trim();
  if (!authToken || !astroId) {
    console.warn("[device] attach-device skipped: missing authToken or astroId");
    return;
  }

  try {
    const deviceId = await getOrCreateDeviceId();
    const body = { deviceId, astroId };
    console.log("[device] attach-device body", body);

    const { status, data } = await axios.post(ATTACH_DEVICE_URL, body, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      timeout: 25000,
      validateStatus: () => true,
    });

    if (status >= 200 && status < 300) {
      console.log("[device] attach-device ok", status);
      return;
    }

    console.warn("[device] attach-device HTTP", status, data);
  } catch (e) {
    console.warn("[device] attach-device failed", e);
  }
}
