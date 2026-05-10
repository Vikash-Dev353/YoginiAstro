import AsyncStorage from '@react-native-async-storage/async-storage';
import type { OrderStackParamList } from '../../navigation/types';
import { fcmTrace, fcmTraceError } from './fcmDebug';

/**
 * When the device is locked / app is killed, Notifee's `fullScreenAction` launches
 * MainActivity automatically — but the JS side has no direct way to read which
 * notification triggered that launch. We persist the parsed incoming-chat params
 * here so RootNavigator can pick them up after JS boots and show the overlay.
 */
const PENDING_KEY = 'pending_incoming_chat_v1';

/** Discard a stale pending payload after this many ms (notification was likely cancelled). */
const STALE_AFTER_MS = 60 * 1000;

type StoredPayload = {
  params: OrderStackParamList['IncomingChatRequest'];
  storedAt: number;
};

export async function setPendingIncomingChat(
  params: OrderStackParamList['IncomingChatRequest'],
): Promise<void> {
  try {
    const payload: StoredPayload = { params, storedAt: Date.now() };
    await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(payload));
    fcmTrace(
      'pendingIncomingChat: stored room=',
      params.roomId,
      'from=',
      params.from ?? '',
    );
  } catch (error) {
    fcmTraceError('pendingIncomingChat: setPendingIncomingChat failed', error);
  }
}

export async function takePendingIncomingChat(): Promise<
  OrderStackParamList['IncomingChatRequest'] | null
> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_KEY);
    if (!raw) {
      return null;
    }
    await AsyncStorage.removeItem(PENDING_KEY);
    const parsed = JSON.parse(raw) as StoredPayload;
    if (!parsed?.params) {
      return null;
    }
    if (Date.now() - (parsed.storedAt ?? 0) > STALE_AFTER_MS) {
      fcmTrace('pendingIncomingChat: discarded stale payload');
      return null;
    }
    fcmTrace(
      'pendingIncomingChat: consumed room=',
      parsed.params.roomId,
      'from=',
      parsed.params.from ?? '',
    );
    return parsed.params;
  } catch (error) {
    fcmTraceError('pendingIncomingChat: takePendingIncomingChat failed', error);
    return null;
  }
}

export async function clearPendingIncomingChat(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PENDING_KEY);
  } catch (error) {
    fcmTraceError('pendingIncomingChat: clear failed', error);
  }
}
