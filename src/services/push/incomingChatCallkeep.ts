import AsyncStorage from '@react-native-async-storage/async-storage';
import type { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import { Platform } from 'react-native';
import RNCallKeep from 'react-native-callkeep';
import type { OrderStackParamList } from '../../navigation/types';
import { store } from '../../store';
import { fcmTrace, fcmTraceError } from './fcmDebug';
import { getIncomingChatParamsFromRemoteMessage } from './incomingChatFromFcm';
import {
  acceptIncomingChatFromPush,
  rejectIncomingChatFromPush,
} from './incomingChatAcceptFlow';

const STORAGE_KEY_PREFIX = 'callkeep_incoming_v1:';

/** UUIDs we ended from JS right after answer so the native UI closes without counting as reject. */
const programmaticEndUuids = new Set<string>();

/** roomId → ringing call UUID (dedupe same-room retries). */
const activeRingByRoom = new Map<string, string>();

let setupPromise: Promise<void> | null = null;
let listenersRegistered = false;

function selectCanEnterMainApp(): boolean {
  const {
    isAuthenticated,
    pendingProfileCompletion,
    pendingAdminApproval,
  } = store.getState().auth;
  return (
    isAuthenticated && !pendingProfileCompletion && !pendingAdminApproval
  );
}

function newCallUuid(): string {
  const gc = globalThis as typeof globalThis & {
    crypto?: { randomUUID?: () => string };
  };
  if (gc.crypto?.randomUUID) {
    return gc.crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, ch => {
    const r = (Math.random() * 16) | 0;
    const v = ch === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function persistPayload(
  callUUID: string,
  params: OrderStackParamList['IncomingChatRequest'],
): Promise<void> {
  await AsyncStorage.setItem(
    STORAGE_KEY_PREFIX + callUUID,
    JSON.stringify(params),
  );
}

async function loadPayload(
  callUUID: string,
): Promise<OrderStackParamList['IncomingChatRequest'] | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY_PREFIX + callUUID);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as OrderStackParamList['IncomingChatRequest'];
  } catch {
    return null;
  }
}

async function clearPayload(callUUID: string): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY_PREFIX + callUUID);
  for (const [room, uuid] of activeRingByRoom.entries()) {
    if (uuid === callUUID) {
      activeRingByRoom.delete(room);
      break;
    }
  }
}

function registerCallKeepListeners(): void {
  if (listenersRegistered) {
    return;
  }
  listenersRegistered = true;

  RNCallKeep.addEventListener('answerCall', ({ callUUID }) => {
    void (async () => {
      const params = await loadPayload(callUUID);
      if (!params) {
        fcmTrace('CallKeep answerCall: no payload for', callUUID);
        RNCallKeep.endCall(callUUID);
        return;
      }
      if (selectCanEnterMainApp()) {
        acceptIncomingChatFromPush(store.dispatch, params);
      } else {
        fcmTrace('CallKeep answerCall: session not ready — ending native UI');
      }
      programmaticEndUuids.add(callUUID);
      try {
        RNCallKeep.endCall(callUUID);
      } finally {
        setTimeout(() => programmaticEndUuids.delete(callUUID), 800);
      }
      await clearPayload(callUUID);
    })();
  });

  RNCallKeep.addEventListener('endCall', ({ callUUID }) => {
    void (async () => {
      if (programmaticEndUuids.has(callUUID)) {
        return;
      }
      const params = await loadPayload(callUUID);
      await clearPayload(callUUID);
      if (params && selectCanEnterMainApp()) {
        rejectIncomingChatFromPush(store.dispatch, params);
      }
    })();
  });
}

/**
 * Registers CallKeep + listeners once. Safe to call from index.js (background) and UI.
 */
export function ensureIncomingChatCallKeepReady(): Promise<void> {
  if (setupPromise) {
    return setupPromise;
  }
  setupPromise = (async () => {
    try {
      await RNCallKeep.setup({
        ios: {
          appName: 'YoginiAstro',
          supportsVideo: false,
          includesCallsInRecents: true,
        },
        android: {
          alertTitle: 'Allow calling integration',
          alertDescription:
            'Used to show incoming chat requests with full-screen caller UI.',
          cancelButton: 'Cancel',
          okButton: 'OK',
          additionalPermissions: [],
        },
      });
      if (Platform.OS === 'android') {
        await RNCallKeep.setAvailable(true);
      }
      registerCallKeepListeners();
    } catch (error) {
      fcmTraceError('CallKeep setup failed', error);
    }
  })();
  return setupPromise;
}

/**
 * Android ConnectionService uses `tel:` URIs; non‑numeric handles often break ringing / UI.
 * Keep a stable numeric-looking handle while caller name still shows in CallKeep.
 */
function telHandleForAndroidConnectionService(
  params: OrderStackParamList['IncomingChatRequest'],
): string {
  const combined = `${params.from ?? ''}${params.roomId ?? ''}`;
  const digits = combined.replace(/\D/g, '');
  if (digits.length >= 3) {
    return digits.slice(-15);
  }
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    hash = (hash * 31 + combined.charCodeAt(i)) >>> 0;
  }
  return String(9000000000 + (hash % 999_999_999));
}

/**
 * Shows native incoming UI for `incoming_chat` data messages.
 * Call {@link handleIncomingFcm} separately so Redux / lists stay in sync.
 * Returns true when CallKeep displayed the incoming UI; false to fall back (e.g. Notifee).
 */
export async function tryPresentIncomingChatCallKeep(
  remoteMessage: FirebaseMessagingTypes.RemoteMessage,
): Promise<boolean> {
  const params = getIncomingChatParamsFromRemoteMessage(remoteMessage);
  if (!params) {
    return false;
  }

  await ensureIncomingChatCallKeepReady();

  const roomId = params.roomId;
  const previous = activeRingByRoom.get(roomId);
  if (previous && previous.length > 0) {
    programmaticEndUuids.add(previous);
    try {
      RNCallKeep.endCall(previous);
    } catch {
      /* ignore */
    }
    await clearPayload(previous);
  }

  const callUUID = newCallUuid();
  activeRingByRoom.set(roomId, callUUID);
  await persistPayload(callUUID, params);

  const handle =
    Platform.OS === 'android'
      ? telHandleForAndroidConnectionService(params)
      : String(params.from ?? params.roomId ?? 'unknown').replace(/\s+/g, '') ||
        'unknown';
  const name = params.customerName || 'Chat request';

  try {
    await RNCallKeep.displayIncomingCall(
      callUUID,
      handle,
      name,
      'generic',
      false,
    );
    if (Platform.OS === 'android') {
      try {
        RNCallKeep.backToForeground();
      } catch {
        /* ignore */
      }
    }
    fcmTrace('CallKeep displayIncomingCall OK uuid=', callUUID, 'room=', roomId);
    return true;
  } catch (error) {
    fcmTraceError('CallKeep displayIncomingCall failed', error);
    await clearPayload(callUUID);
    return false;
  }
}
