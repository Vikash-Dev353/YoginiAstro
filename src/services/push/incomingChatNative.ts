import {
  DeviceEventEmitter,
  NativeModules,
  Platform,
  type EmitterSubscription,
} from 'react-native';
import type { OrderStackParamList } from '../../navigation/types';
import { fcmTrace, fcmTraceError } from './fcmDebug';
import {
  resolveIncomingChatBody,
  resolveIncomingChatTitle,
} from './incomingChatDisplay';
import {
  flattenNotificationData,
  getIncomingChatParamsFromData,
  parseIncomingChatLaunchRaw,
  type IncomingChatLaunchConsume,
} from './incomingChatFromFcm';

type IncomingChatBridge = {
  startIncomingChat(payload: Record<string, string>): Promise<boolean>;
  stopIncomingChat(): Promise<boolean>;
  consumeLaunchPayload(): Promise<Record<string, string> | null>;
  persistIncomingChatPayload(payload: Record<string, string>): Promise<boolean>;
  openMainActivityForAcceptedChat(payload: Record<string, string>): Promise<boolean>;
  isDeviceUnlocked(): Promise<boolean>;
  clearIncomingChatPayload(): Promise<boolean>;
  peekLaunchPayload(): Promise<Record<string, string> | null>;
};

const bridge = (NativeModules as { IncomingChat?: IncomingChatBridge })
  .IncomingChat;

function ensureAndroid(): IncomingChatBridge | null {
  if (Platform.OS !== 'android') {
    return null;
  }
  if (!bridge) {
    fcmTraceError('IncomingChat native module missing — rebuild Android app');
    return null;
  }
  return bridge;
}

/**
 * Convert a value to a string the native bridge can carry. Skips nulls so the
 * Java side doesn't see {"key":"null"} which our parser would treat as a
 * legitimate value.
 */
function stringifyForNative(
  data: Record<string, unknown> | null | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!data) return out;
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined || v === null) continue;
    out[k] = typeof v === 'string' ? v : String(v);
  }
  return out;
}

/**
 * Kick off the foreground service which:
 *   - Plays the looping incoming-chat ringtone.
 *   - Shows an ongoing system notification with Accept / Reject actions.
 *   - Launches MainActivity over the lock-screen / current foreground app.
 *
 * Returns false on iOS / when the bridge isn't installed.
 */
function buildNativePayload(
  params: OrderStackParamList['IncomingChatRequest'],
): Record<string, string> {
  const title = resolveIncomingChatTitle(params);
  const body = resolveIncomingChatBody(params);
  return stringifyForNative({
    type: 'incoming_chat',
    roomId: params.roomId,
    from: params.from,
    senderId: params.from,
    customerName: params.customerName,
    title,
    body,
    customerImage: params.customerImage,
    message: params.message ?? body,
    subtitle: params.subtitle,
    kundliUrl: params.kundliUrl,
    userBalance: params.userBalance,
    astroPrice: params.astroPrice,
    kundaliPayload: params.kundaliPayload
      ? JSON.stringify(params.kundaliPayload)
      : undefined,
  });
}

/** Writes payload to native SharedPreferences (survives killed app + notification tap). */
export async function persistIncomingChatPayloadNative(
  params: OrderStackParamList['IncomingChatRequest'],
): Promise<void> {
  const mod = ensureAndroid();
  if (!mod) return;
  try {
    const payload = buildNativePayload(params);
    await mod.persistIncomingChatPayload(payload);
    fcmTrace('IncomingChat native: persistIncomingChatPayload OK room=', params.roomId);
  } catch (error) {
    fcmTraceError('IncomingChat native: persistIncomingChatPayload failed', error);
  }
}

export async function startIncomingChatNative(
  params: OrderStackParamList['IncomingChatRequest'],
): Promise<boolean> {
  const mod = ensureAndroid();
  if (!mod) return false;
  try {
    const payload = buildNativePayload(params);
    await mod.startIncomingChat(payload);
    fcmTrace('IncomingChat native: startIncomingChat OK room=', params.roomId);
    return true;
  } catch (error) {
    fcmTraceError('IncomingChat native: startIncomingChat failed', error);
    return false;
  }
}

/** `true` when the phone is not on the lock screen (Android Keyguard). */
export async function isDeviceUnlockedNative(): Promise<boolean> {
  const mod = ensureAndroid();
  if (!mod?.isDeviceUnlocked) {
    return true;
  }
  try {
    return await mod.isDeviceUnlocked();
  } catch (error) {
    fcmTraceError('IncomingChat native: isDeviceUnlocked failed', error);
    return true;
  }
}

/** Lock screen / Notifee Accept — open app so RootNavigator can navigate to chat. */
export async function openMainActivityForAcceptedChat(
  params: OrderStackParamList['IncomingChatRequest'],
): Promise<void> {
  const mod = ensureAndroid();
  if (!mod?.openMainActivityForAcceptedChat) {
    return;
  }
  try {
    const payload = buildNativePayload(params);
    await mod.openMainActivityForAcceptedChat(payload);
    fcmTrace(
      'IncomingChat native: openMainActivityForAcceptedChat OK room=',
      params.roomId,
    );
  } catch (error) {
    fcmTraceError('IncomingChat native: openMainActivityForAcceptedChat failed', error);
  }
}

/** Clears native prefs + MainActivity intent extras so overlay probe cannot replay. */
export async function clearIncomingChatPayloadNative(): Promise<void> {
  const mod = ensureAndroid();
  if (!mod?.clearIncomingChatPayload) {
    return;
  }
  try {
    await mod.clearIncomingChatPayload();
    fcmTrace('IncomingChat native: clearIncomingChatPayload OK');
  } catch (error) {
    fcmTraceError('IncomingChat native: clearIncomingChatPayload failed', error);
  }
}

export async function stopIncomingChatNative(): Promise<void> {
  const mod = ensureAndroid();
  if (!mod) return;
  try {
    await mod.stopIncomingChat();
    fcmTrace('IncomingChat native: stopIncomingChat OK');
  } catch (error) {
    fcmTraceError('IncomingChat native: stopIncomingChat failed', error);
  }
}

/**
 * Consumes the intent extras MainActivity was launched with (foreground service
 * launches MainActivity with `ACTION_INCOMING_CHAT`). Returns parsed overlay
 * params or null.
 */
export async function consumeIncomingChatLaunchParams(): Promise<
  OrderStackParamList['IncomingChatRequest'] | null
> {
  const consumed = await consumeIncomingChatLaunchAction();
  return consumed.params;
}

/** Reads launch intent / store without clearing — safe for overlay probe + tap replay. */
export async function peekIncomingChatLaunchAction(): Promise<IncomingChatLaunchConsume> {
  const mod = ensureAndroid();
  if (!mod?.peekLaunchPayload) {
    return { params: null };
  }
  try {
    const raw = await mod.peekLaunchPayload();
    if (!raw) {
      return { params: null };
    }
    const flat = flattenNotificationData(raw);
    return parseIncomingChatLaunchRaw(flat);
  } catch (error) {
    fcmTraceError('IncomingChat native: peekLaunchPayload failed', error);
    return { params: null };
  }
}

export async function consumeIncomingChatLaunchAction(): Promise<IncomingChatLaunchConsume> {
  const mod = ensureAndroid();
  if (!mod) return { params: null };
  try {
    const raw = await mod.consumeLaunchPayload();
    if (!raw) return { params: null };
    const flat = flattenNotificationData(raw);
    return parseIncomingChatLaunchRaw(flat);
  } catch (error) {
    fcmTraceError('IncomingChat native: consumeLaunchPayload failed', error);
    return { params: null };
  }
}

/**
 * Subscribe to "MainActivity already running, new intent arrived" events from
 * the native side. Useful when the astrologer is using another screen and a
 * service launch fires `onNewIntent` on the singleTask MainActivity.
 */
export function subscribeIncomingChatIntent(
  handler: (launch: IncomingChatLaunchConsume) => void,
): EmitterSubscription | null {
  if (Platform.OS !== 'android') return null;
  return DeviceEventEmitter.addListener(
    'IncomingChat:onIntent',
    (raw: Record<string, string>) => {
      const flat = flattenNotificationData(raw);
      const launch = parseIncomingChatLaunchRaw(flat);
      if (launch.params) {
        handler(launch);
      }
    },
  );
}
