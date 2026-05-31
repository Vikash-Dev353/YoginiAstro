import type { OrderStackParamList } from '../../navigation/types';
import type { AppDispatch } from '../../store';
import {
  acceptChat,
  joinRoom,
  rejectChat,
  setAstroChatData,
  setChatStarted,
  setSocketChatDisconnect,
} from '../../store/slices/socketSlice';
import { ensureSessionForIncomingChatDecision } from './ensureSessionForIncomingChatDecision';
import { fcmTrace, fcmTraceError } from './fcmDebug';
import {
  openConsultationChatScreen,
  requestConsultationChatNavigation,
} from './incomingChatNavigation';
import {
  clearPendingIncomingChatAccept,
  peekPendingIncomingChatAccept,
  setPendingIncomingChatAccept,
} from './pendingIncomingChatAccept';

const NAV_RETRY_MS = 200;
const MAX_NAV_RETRIES = 150;

/** Headless task + MainActivity probe can both fire Accept — emit socket events once. */
const acceptEventsEmittedForRoom = new Set<string>();
const acceptFlowInFlightForRoom = new Set<string>();

function markAcceptEventsEmitted(roomId: string): void {
  acceptEventsEmittedForRoom.add(roomId);
  setTimeout(() => acceptEventsEmittedForRoom.delete(roomId), 30_000);
}

/** Same events as in-app Accept + ConsultationChat mount — notifies user to stop ringing. */
function emitAstrologerJoinedChatEvents(
  dispatch: AppDispatch,
  from: string,
  roomId: string,
  customerName: string,
): void {
  if (acceptEventsEmittedForRoom.has(roomId)) {
    fcmTrace('emitAstrologerJoinedChatEvents: skip duplicate room=', roomId);
    return;
  }

  dispatch(acceptChat({ from, roomId }));
  joinRoom({ senderName: customerName, receiverMobile: from });
  dispatch(setChatStarted(true));
  markAcceptEventsEmitted(roomId);
  fcmTrace(
    'emitAstrologerJoinedChatEvents: accept-chat + join-room room=',
    roomId,
  );
}

function tryNavigateAfterAccept(
  p: OrderStackParamList['IncomingChatRequest'],
): void {
  if (openConsultationChatScreen(p)) {
    void clearPendingIncomingChatAccept();
    fcmTrace('tryNavigateAfterAccept: immediate room=', p.roomId);
    return;
  }
  requestConsultationChatNavigation(p);
  navigateToConsultationChat(p);
}

export function navigateToConsultationChat(
  p: OrderStackParamList['IncomingChatRequest'],
): void {
  let attempts = 0;
  const tryNav = () => {
    attempts += 1;
    if (openConsultationChatScreen(p)) {
      fcmTrace('navigateToConsultationChat OK room=', p.roomId, 'attempt=', attempts);
      void clearPendingIncomingChatAccept();
      return;
    }
    if (attempts < MAX_NAV_RETRIES) {
      setTimeout(tryNav, NAV_RETRY_MS);
      return;
    }
    fcmTrace(
      'navigateToConsultationChat deferred (main tab not ready) room=',
      p.roomId,
    );
    void setPendingIncomingChatAccept(p);
    requestConsultationChatNavigation(p);
  };
  tryNav();
}

async function applyIncomingChatAccept(
  dispatch: AppDispatch,
  p: OrderStackParamList['IncomingChatRequest'],
): Promise<boolean> {
  const from = p.from?.trim();
  if (!from || !p.roomId) {
    fcmTraceError('applyIncomingChatAccept: missing from or roomId');
    return false;
  }

  const sessionReady = await ensureSessionForIncomingChatDecision();
  if (!sessionReady) {
    fcmTrace('applyIncomingChatAccept: session not ready room=', p.roomId);
    return false;
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
  emitAstrologerJoinedChatEvents(dispatch, from, p.roomId, p.customerName);
  return true;
}

/**
 * Notification Answer / Accept — emit socket accept, persist pending nav,
 * then open ConsultationChat when MainTabNavigator is mounted.
 */
export async function acceptIncomingChatFromPush(
  dispatch: AppDispatch,
  p: OrderStackParamList['IncomingChatRequest'],
): Promise<void> {
  const from = p.from?.trim();
  if (!from || !p.roomId) {
    fcmTraceError('acceptIncomingChatFromPush: missing from or roomId');
    return;
  }

  await setPendingIncomingChatAccept(p);

  if (acceptFlowInFlightForRoom.has(p.roomId)) {
    fcmTrace(
      'acceptIncomingChatFromPush: in flight — nav retry room=',
      p.roomId,
    );
    tryNavigateAfterAccept(p);
    return;
  }
  acceptFlowInFlightForRoom.add(p.roomId);

  try {
    const applied = await applyIncomingChatAccept(dispatch, p);
    if (!applied) {
      fcmTrace(
        'acceptIncomingChatFromPush: accept deferred (session) room=',
        p.roomId,
      );
      return;
    }

    tryNavigateAfterAccept(p);
  } finally {
    acceptFlowInFlightForRoom.delete(p.roomId);
  }
}

/** Cold start / deferred nav — open chat once MainTabNavigator mounts. */
export async function flushPendingIncomingChatAccept(
  dispatch: AppDispatch,
): Promise<boolean> {
  const pending = await peekPendingIncomingChatAccept();
  if (!pending?.roomId || !pending.from?.trim()) {
    return false;
  }

  fcmTrace('flushPendingIncomingChatAccept room=', pending.roomId);

  const eventsAlreadySent = acceptEventsEmittedForRoom.has(pending.roomId);
  if (!eventsAlreadySent) {
    const applied = await applyIncomingChatAccept(dispatch, pending);
    if (!applied) {
      return false;
    }
  }

  if (!openConsultationChatScreen(pending)) {
    fcmTrace('flushPendingIncomingChatAccept: nav deferred room=', pending.roomId);
    return false;
  }

  await clearPendingIncomingChatAccept();
  fcmTrace('flushPendingIncomingChatAccept: navigated room=', pending.roomId);
  return true;
}

export async function rejectIncomingChatFromPush(
  dispatch: AppDispatch,
  p: Pick<OrderStackParamList['IncomingChatRequest'], 'from' | 'roomId'>,
): Promise<void> {
  const from = p.from?.trim();
  if (!from || !p.roomId) {
    fcmTraceError('rejectIncomingChatFromPush: missing from or roomId');
    return;
  }

  const sessionReady = await ensureSessionForIncomingChatDecision();
  if (!sessionReady) {
    fcmTraceError('rejectIncomingChatFromPush: socket not ready room=', p.roomId);
    return;
  }

  dispatch(rejectChat({ from, roomId: p.roomId }));
}
