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

function parsePendingAcceptRaw(
  raw: string | null,
): OrderStackParamList['IncomingChatRequest'] | null {
  if (!raw) {
    return null;
  }
  const parsed = JSON.parse(raw) as OrderStackParamList['IncomingChatRequest'];
  if (!parsed?.roomId) {
    return null;
  }
  return parsed;
}

export async function peekPendingIncomingChatAccept(): Promise<
  OrderStackParamList['IncomingChatRequest'] | null
> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_ACCEPT_KEY);
    return parsePendingAcceptRaw(raw);
  } catch (error) {
    fcmTraceError('peekPendingIncomingChatAccept failed', error);
    return null;
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
    const parsed = parsePendingAcceptRaw(raw);
    if (!parsed) {
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
