import AsyncStorage from '@react-native-async-storage/async-storage';
import type { OrderStackParamList } from '../../navigation/types';
import { fcmTrace, fcmTraceError } from './fcmDebug';

const PENDING_ACCEPT_KEY = 'pending_incoming_chat_accept_v1';

export async function setPendingIncomingChatAccept(
  params: OrderStackParamList['IncomingChatRequest'],
): Promise<void> {
  try {
    await AsyncStorage.setItem(PENDING_ACCEPT_KEY, JSON.stringify(params));
    fcmTrace('pendingIncomingChatAccept: stored room=', params.roomId);
  } catch (error) {
    fcmTraceError('setPendingIncomingChatAccept failed', error);
  }
}

export async function takePendingIncomingChatAccept(): Promise<
  OrderStackParamList['IncomingChatRequest'] | null
> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_ACCEPT_KEY);
    if (!raw) {
      return null;
    }
    await AsyncStorage.removeItem(PENDING_ACCEPT_KEY);
    const parsed = JSON.parse(raw) as OrderStackParamList['IncomingChatRequest'];
    if (!parsed?.roomId) {
      return null;
    }
    fcmTrace('pendingIncomingChatAccept: consumed room=', parsed.roomId);
    return parsed;
  } catch (error) {
    fcmTraceError('takePendingIncomingChatAccept failed', error);
    return null;
  }
}

export async function clearPendingIncomingChatAccept(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PENDING_ACCEPT_KEY);
  } catch (error) {
    fcmTraceError('clearPendingIncomingChatAccept failed', error);
  }
}
