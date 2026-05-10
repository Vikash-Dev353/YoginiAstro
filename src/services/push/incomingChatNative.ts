import {
  DeviceEventEmitter,
  NativeModules,
  Platform,
  type EmitterSubscription,
} from 'react-native';
import type { OrderStackParamList } from '../../navigation/types';
import { fcmTrace, fcmTraceError } from './fcmDebug';
import {
  flattenNotificationData,
  getIncomingChatParamsFromData,
} from './incomingChatFromFcm';

type IncomingChatBridge = {
  startIncomingChat(payload: Record<string, string>): Promise<boolean>;
  stopIncomingChat(): Promise<boolean>;
  consumeLaunchPayload(): Promise<Record<string, string> | null>;
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
export async function startIncomingChatNative(
  params: OrderStackParamList['IncomingChatRequest'],
): Promise<boolean> {
  const mod = ensureAndroid();
  if (!mod) return false;
  try {
    const payload = stringifyForNative({
      type: 'incoming_chat',
      roomId: params.roomId,
      from: params.from,
      senderId: params.from,
      customerName: params.customerName,
      customerImage: params.customerImage,
      message: params.message,
      subtitle: params.subtitle,
      kundliUrl: params.kundliUrl,
      userBalance: params.userBalance,
      astroPrice: params.astroPrice,
      kundaliPayload: params.kundaliPayload
        ? JSON.stringify(params.kundaliPayload)
        : undefined,
    });
    await mod.startIncomingChat(payload);
    fcmTrace('IncomingChat native: startIncomingChat OK room=', params.roomId);
    return true;
  } catch (error) {
    fcmTraceError('IncomingChat native: startIncomingChat failed', error);
    return false;
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
  const mod = ensureAndroid();
  if (!mod) return null;
  try {
    const raw = await mod.consumeLaunchPayload();
    if (!raw) return null;
    const flat = flattenNotificationData(raw);
    return getIncomingChatParamsFromData(flat);
  } catch (error) {
    fcmTraceError('IncomingChat native: consumeLaunchPayload failed', error);
    return null;
  }
}

/**
 * Subscribe to "MainActivity already running, new intent arrived" events from
 * the native side. Useful when the astrologer is using another screen and a
 * service launch fires `onNewIntent` on the singleTask MainActivity.
 */
export function subscribeIncomingChatIntent(
  handler: (params: OrderStackParamList['IncomingChatRequest']) => void,
): EmitterSubscription | null {
  if (Platform.OS !== 'android') return null;
  return DeviceEventEmitter.addListener(
    'IncomingChat:onIntent',
    (raw: Record<string, string>) => {
      const flat = flattenNotificationData(raw);
      const params = getIncomingChatParamsFromData(flat);
      if (params) {
        handler(params);
      }
    },
  );
}
