import { DeviceEventEmitter } from 'react-native';
import type { OrderStackParamList } from '../../navigation/types';

/** Single entry to show {@link CustomIncomingNotificationScreen} from any route. */
export const SHOW_INCOMING_CHAT_OVERLAY = 'IncomingChat:showOverlay';

export function requestIncomingChatOverlay(
  params: OrderStackParamList['IncomingChatRequest'],
): void {
  DeviceEventEmitter.emit(SHOW_INCOMING_CHAT_OVERLAY, params);
}
