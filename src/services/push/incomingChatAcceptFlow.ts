import { Platform } from 'react-native';
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
import { markIncomingRoomHandled } from './foregroundIncomingOverlay';
import { fcmTrace, fcmTraceError } from './fcmDebug';
import {
  isConsultationChatNavigationDone,
  openConsultationChatScreen,
} from './incomingChatNavigation';
import { cancelIncomingChatNotifications } from './notificationDisplay';
import {
  clearIncomingChatPayloadNative,
  openMainActivityForAcceptedChat,
  stopIncomingChatNative,
} from './incomingChatNative';
import { clearPendingIncomingChat } from './pendingIncomingChat';
import {
  clearPendingIncomingChatAccept,
  peekPendingIncomingChatAccept,
  setPendingIncomingChatAccept,
} from './pendingIncomingChatAccept';

/** RootNavigator keeps the socket alive while Accept → ConsultationChat is pending. */
export const incomingChatAcceptNavigationPendingRef = { current: false };

const NAV_RETRY_MS = 200;
const MAX_NAV_RETRIES = 40;

/** Headless task + MainActivity probe can both fire Accept — emit socket events once. */
const acceptEventsEmittedForRoom = new Set<string>();
const acceptFlowInFlightForRoom = new Set<string>();
/** Lock-screen notification Answer — dedupe probe / onNewIntent / onHostResume / headless. */
const notificationAcceptHandledRooms = new Set<string>();

export function wasNotificationAcceptHandled(roomId: string): boolean {
  return notificationAcceptHandledRooms.has(roomId.trim());
}

function markNotificationAcceptHandled(roomId: string): void {
  const id = roomId.trim();
  if (!id) {
    return;
  }
  notificationAcceptHandledRooms.add(id);
  setTimeout(() => notificationAcceptHandledRooms.delete(id), 120_000);
}

export type AcceptIncomingChatOptions = {
  /** Native notification / MainActivity already opened the app — do not startActivity again. */
  skipMainActivityLaunch?: boolean;
};
const mainActivityLaunchedForAcceptRoom = new Set<string>();
const navRetryCancelByRoom = new Map<string, () => void>();

export function isIncomingChatAcceptInFlight(roomId: string): boolean {
  return acceptFlowInFlightForRoom.has(roomId.trim());
}

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

function markAcceptNavigationPending(active: boolean): void {
  incomingChatAcceptNavigationPendingRef.current = active;
}

function finishAcceptNavigation(roomId: string): void {
  markAcceptNavigationPending(false);
  navRetryCancelByRoom.get(roomId)?.();
  navRetryCancelByRoom.delete(roomId);
  void clearPendingIncomingChatAccept();
  void clearIncomingChatPayloadNative();
}

function tryNavigateAfterAccept(
  p: OrderStackParamList['IncomingChatRequest'],
): void {
  const roomId = p.roomId.trim();
  if (isConsultationChatNavigationDone(roomId)) {
    finishAcceptNavigation(roomId);
    fcmTrace('tryNavigateAfterAccept: skip — already on chat room=', roomId);
    return;
  }
  markAcceptNavigationPending(true);
  if (openConsultationChatScreen(p)) {
    finishAcceptNavigation(roomId);
    fcmTrace('tryNavigateAfterAccept: immediate room=', roomId);
    return;
  }
  navigateToConsultationChat(p);
}

export function navigateToConsultationChat(
  p: OrderStackParamList['IncomingChatRequest'],
): void {
  const roomId = p.roomId.trim();
  if (isConsultationChatNavigationDone(roomId)) {
    finishAcceptNavigation(roomId);
    return;
  }

  navRetryCancelByRoom.get(roomId)?.();
  let cancelled = false;
  navRetryCancelByRoom.set(roomId, () => {
    cancelled = true;
  });

  let attempts = 0;
  const tryNav = () => {
    if (cancelled) {
      return;
    }
    if (isConsultationChatNavigationDone(roomId)) {
      finishAcceptNavigation(roomId);
      return;
    }

    attempts += 1;
    if (openConsultationChatScreen(p)) {
      fcmTrace('navigateToConsultationChat OK room=', roomId, 'attempt=', attempts);
      finishAcceptNavigation(roomId);
      return;
    }
    if (attempts < MAX_NAV_RETRIES) {
      setTimeout(tryNav, NAV_RETRY_MS);
      return;
    }
    fcmTrace(
      'navigateToConsultationChat deferred (main tab not ready) room=',
      roomId,
    );
    void setPendingIncomingChatAccept(p);
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
/**
 * Lock-screen notification Answer / Decline — one handler, no duplicate overlay.
 */
export async function acceptIncomingChatFromNotification(
  dispatch: AppDispatch,
  p: OrderStackParamList['IncomingChatRequest'],
  options?: AcceptIncomingChatOptions,
): Promise<void> {
  const roomId = p.roomId?.trim();
  if (!roomId) {
    return;
  }

  if (wasNotificationAcceptHandled(roomId)) {
    if (!isConsultationChatNavigationDone(roomId)) {
      fcmTrace('acceptIncomingChatFromNotification: retry nav room=', roomId);
      tryNavigateAfterAccept(p);
    } else {
      finishAcceptNavigation(roomId);
    }
    return;
  }
  markNotificationAcceptHandled(roomId);

  void cancelIncomingChatNotifications();
  void stopIncomingChatNative();
  void clearIncomingChatPayloadNative();
  void clearPendingIncomingChat();

  await acceptIncomingChatFromPush(dispatch, p, {
    skipMainActivityLaunch: options?.skipMainActivityLaunch ?? true,
  });
}

export async function acceptIncomingChatFromPush(
  dispatch: AppDispatch,
  p: OrderStackParamList['IncomingChatRequest'],
  options?: AcceptIncomingChatOptions,
): Promise<void> {
  const from = p.from?.trim();
  const roomId = p.roomId?.trim();
  if (!from || !roomId) {
    fcmTraceError('acceptIncomingChatFromPush: missing from or roomId');
    return;
  }

  if (isConsultationChatNavigationDone(roomId)) {
    finishAcceptNavigation(roomId);
    fcmTrace('acceptIncomingChatFromPush: skip — chat already open room=', roomId);
    return;
  }

  markIncomingRoomHandled(roomId);

  if (acceptFlowInFlightForRoom.has(roomId)) {
    fcmTrace(
      'acceptIncomingChatFromPush: in flight — nav retry room=',
      roomId,
    );
    tryNavigateAfterAccept(p);
    return;
  }

  await setPendingIncomingChatAccept(p);
  markAcceptNavigationPending(true);

  if (
    !options?.skipMainActivityLaunch &&
    Platform.OS === 'android' &&
    !mainActivityLaunchedForAcceptRoom.has(roomId)
  ) {
    mainActivityLaunchedForAcceptRoom.add(roomId);
    setTimeout(() => mainActivityLaunchedForAcceptRoom.delete(roomId), 60_000);
    await openMainActivityForAcceptedChat(p);
  }
  acceptFlowInFlightForRoom.add(roomId);

  try {
    const applied = await applyIncomingChatAccept(dispatch, p);
    if (!applied) {
      fcmTrace(
        'acceptIncomingChatFromPush: accept deferred (session) room=',
        roomId,
      );
    }

    tryNavigateAfterAccept(p);
  } finally {
    acceptFlowInFlightForRoom.delete(roomId);
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

  const roomId = pending.roomId.trim();
  if (isConsultationChatNavigationDone(roomId)) {
    finishAcceptNavigation(roomId);
    fcmTrace('flushPendingIncomingChatAccept: skip — already on chat room=', roomId);
    return true;
  }

  fcmTrace('flushPendingIncomingChatAccept room=', roomId);

  const eventsAlreadySent = acceptEventsEmittedForRoom.has(roomId);
  if (!eventsAlreadySent) {
    const applied = await applyIncomingChatAccept(dispatch, pending);
    if (!applied) {
      return false;
    }
  }

  if (!openConsultationChatScreen(pending)) {
    fcmTrace('flushPendingIncomingChatAccept: nav deferred room=', roomId);
    return false;
  }

  finishAcceptNavigation(roomId);
  fcmTrace('flushPendingIncomingChatAccept: navigated room=', roomId);
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

  markIncomingRoomHandled(p.roomId);
  const sessionReady = await ensureSessionForIncomingChatDecision();
  if (!sessionReady) {
    fcmTraceError('rejectIncomingChatFromPush: socket not ready room=', p.roomId);
    return;
  }

  dispatch(rejectChat({ from, roomId: p.roomId }));
  void clearIncomingChatPayloadNative();
}
