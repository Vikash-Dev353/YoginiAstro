import type { OrderStackParamList } from '../../navigation/types';
import { navigationRef } from '../../navigation/navigationRef';
import type { AppDispatch } from '../../store';
import {
  acceptChat,
  rejectChat,
  setAstroChatData,
  setSocketChatDisconnect,
} from '../../store/slices/socketSlice';
import { fcmTrace } from './fcmDebug';
import {
  clearPendingIncomingChatAccept,
  setPendingIncomingChatAccept,
} from './pendingIncomingChatAccept';

const NAV_RETRY_MS = 150;
const MAX_NAV_RETRIES = 80;

export function navigateToConsultationChat(
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
      fcmTrace('navigateToConsultationChat OK room=', p.roomId);
      return;
    }
    if (attempts < MAX_NAV_RETRIES) {
      setTimeout(tryNav, NAV_RETRY_MS);
      return;
    }
    fcmTrace('navigateToConsultationChat deferred (nav not ready) room=', p.roomId);
    void setPendingIncomingChatAccept(p);
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
  void clearPendingIncomingChatAccept();
  navigateToConsultationChat(p, from);
}

/** Call when NavigationContainer is ready (cold start after native Accept). */
export async function flushPendingIncomingChatAccept(
  dispatch: AppDispatch,
): Promise<boolean> {
  const { takePendingIncomingChatAccept } = await import(
    './pendingIncomingChatAccept'
  );
  const pending = await takePendingIncomingChatAccept();
  if (!pending?.roomId) {
    return false;
  }
  acceptIncomingChatFromPush(dispatch, pending);
  return true;
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
