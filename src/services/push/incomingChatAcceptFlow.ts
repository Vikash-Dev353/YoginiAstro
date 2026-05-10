import type { OrderStackParamList } from '../../navigation/types';
import { navigationRef } from '../../navigation/navigationRef';
import type { AppDispatch } from '../../store';
import {
  acceptChat,
  rejectChat,
  setAstroChatData,
  setSocketChatDisconnect,
} from '../../store/slices/socketSlice';

const NAV_RETRY_MS = 120;
const MAX_NAV_RETRIES = 45;

function navigateToConsultationChat(
  p: OrderStackParamList['IncomingChatRequest'],
  from: string,
): void {
  let attempts = 0;
  const tryNav = () => {
    attempts += 1;
    if (navigationRef.isReady()) {
      navigationRef.navigate('Order', {
        screen: 'ConsultationChat',
        params: {
          customerName: p.customerName,
          roomId: p.roomId,
          senderId: from,
          kundaliPayload: p.kundaliPayload,
          customerImage: p.customerImage ?? undefined,
        },
      });
      return;
    }
    if (attempts < MAX_NAV_RETRIES) {
      setTimeout(tryNav, NAV_RETRY_MS);
    }
  };
  tryNav();
}

export function acceptIncomingChatFromPush(
  dispatch: AppDispatch,
  p: OrderStackParamList['IncomingChatRequest'],
): void {
  const from = p.from?.trim();
  if (!from || !p.roomId) {
    return;
  }
  dispatch(setSocketChatDisconnect(false));
  dispatch(
    setAstroChatData({
      from,
      senderName: p.customerName,
      userImage: p.customerImage ?? undefined,
      roomId: p.roomId,
      kundliUrl: p.kundliUrl,
      userBalance: p.userBalance,
      astroPrice: p.astroPrice,
    }),
  );
  dispatch(acceptChat({ from, roomId: p.roomId }));
  navigateToConsultationChat(p, from);
}

export function rejectIncomingChatFromPush(
  dispatch: AppDispatch,
  p: Pick<OrderStackParamList['IncomingChatRequest'], 'from' | 'roomId'>,
): void {
  const from = p.from?.trim();
  if (!from || !p.roomId) {
    return;
  }
  dispatch(rejectChat({ from, roomId: p.roomId }));
}
