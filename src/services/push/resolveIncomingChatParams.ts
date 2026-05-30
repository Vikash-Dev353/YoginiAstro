import type { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import type { OrderStackParamList } from '../../navigation/types';
import { fcmTrace } from './fcmDebug';
import { getIncomingChatParamsFromData } from './incomingChatFromFcm';
import {
  peekPendingIncomingChat,
  takePendingIncomingChat,
} from './pendingIncomingChat';

/**
 * Parses Accept/Reject payload from headless task / Notifee extras.
 * Falls back to the pending chat stored when FCM arrived (CallStyle may omit fields).
 */
export async function resolveIncomingChatParams(
  flat: Record<string, string>,
  options?: { consumePending?: boolean },
): Promise<OrderStackParamList['IncomingChatRequest'] | null> {
  const parsed = getIncomingChatParamsFromData(
    flat as FirebaseMessagingTypes.RemoteMessage['data'],
  );
  if (parsed?.roomId && parsed.from?.trim()) {
    fcmTrace('resolveIncomingChatParams from action extras room=', parsed.roomId);
    return parsed;
  }

  const pending = options?.consumePending
    ? await takePendingIncomingChat()
    : await peekPendingIncomingChat();
  if (pending?.roomId && pending.from?.trim()) {
    fcmTrace(
      'resolveIncomingChatParams from pending storage room=',
      pending.roomId,
    );
    return pending;
  }

  return null;
}
