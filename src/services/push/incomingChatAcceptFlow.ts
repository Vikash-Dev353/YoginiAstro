import { Platform } from 'react-native';
import type { OrderStackParamList } from '../../navigation/types';
import type { AppDispatch } from '../../store';
import {
  acceptChat,
  joinRoom,
  leaveRoom,
  rejectChat,
  setAstroChatData,
  setChatStarted,
  setSocketChatDisconnect,
} from '../../store/slices/socketSlice';
import { getSocket } from '../socket/socketService';
import { getIncomingChatParamsFromChatRequestItem } from './incomingChatFromFcm';
import { store } from '../../store';
import { ensureSessionForIncomingChatDecision } from './ensureSessionForIncomingChatDecision';
import { markIncomingRoomHandled } from './foregroundIncomingOverlay';
import { fcmTrace, fcmTraceError } from './fcmDebug';
import {
  isConsultationChatNavigationDone,
  isIncomingAcceptNavigationDone,
  markConsultationChatNavigationDone,
  markIncomingAcceptNavigationDone,
  openConsultationChatScreen,
  openWaitlistScreen,
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

export type AcceptNavigateTarget = 'chat' | 'waitlist';

export type AcceptIncomingChatOptions = {
  /** Native notification / MainActivity already opened the app — do not startActivity again. */
  skipMainActivityLaunch?: boolean;
  /**
   * `chat` — app foreground / socket overlay (case 3).
   * `waitlist` — lock screen or notification tap (cases 1 & 2).
   */
  navigateTarget?: AcceptNavigateTarget;
};

const pendingAcceptNavigateTargetByRoom = new Map<string, AcceptNavigateTarget>();

function resolveAcceptNavigateTarget(
  roomId: string,
  options?: AcceptIncomingChatOptions,
): AcceptNavigateTarget {
  return (
    options?.navigateTarget ??
    pendingAcceptNavigateTargetByRoom.get(roomId.trim()) ??
    'waitlist'
  );
}

function clearAcceptNavigateTarget(roomId: string): void {
  pendingAcceptNavigateTargetByRoom.delete(roomId.trim());
}
const mainActivityLaunchedForAcceptRoom = new Set<string>();
const navRetryCancelByRoom = new Map<string, () => void>();

export function isIncomingChatAcceptInFlight(roomId: string): boolean {
  return acceptFlowInFlightForRoom.has(roomId.trim());
}

function markAcceptEventsEmitted(roomId: string): void {
  acceptEventsEmittedForRoom.add(roomId);
  setTimeout(() => acceptEventsEmittedForRoom.delete(roomId), 120_000);
}

/** After chat ends — next incoming for same roomId can ring and accept again. */
export function clearIncomingChatAcceptDedupeState(roomId: string): void {
  const id = roomId.trim();
  if (!id) {
    return;
  }
  acceptEventsEmittedForRoom.delete(id);
  acceptFlowInFlightForRoom.delete(id);
  notificationAcceptHandledRooms.delete(id);
  pendingAcceptNavigateTargetByRoom.delete(id);
  navRetryCancelByRoom.get(id)?.();
  navRetryCancelByRoom.delete(id);
  mainActivityLaunchedForAcceptRoom.delete(id);
}

export function wereAstrologerAcceptChatEventsEmitted(roomId: string): boolean {
  return acceptEventsEmittedForRoom.has(roomId.trim());
}

export type EnsureAstrologerAcceptChatEventsOptions = {
  /** New ringing session (e.g. after chat end) — always emit accept-chat + join-room. */
  force?: boolean;
};

const FORCE_ACCEPT_LEAVE_MS = 450;
const FORCE_ACCEPT_JOIN_MS = 150;

/** Prefer latest socket/FCM queue item so `from` matches the active user request. */
export function resolveLatestIncomingChatParams(
  p: OrderStackParamList['IncomingChatRequest'],
): OrderStackParamList['IncomingChatRequest'] {
  const roomId = p.roomId?.trim();
  if (!roomId) {
    return p;
  }
  const list = store.getState().socket.chatRequests;
  const item = list.find(request => request.roomId?.trim() === roomId);
  if (!item) {
    return p;
  }
  return getIncomingChatParamsFromChatRequestItem(item) ?? p;
}

/** Same events as in-app Accept — `accept-chat` so user can join; `join-room` for astro. */
async function tryEmitAstrologerJoinedChatEvents(
  dispatch: AppDispatch,
  from: string,
  roomId: string,
  customerName: string,
  options?: EnsureAstrologerAcceptChatEventsOptions,
): Promise<boolean> {
  const id = roomId.trim();
  const userId = from.trim();
  if (!options?.force && acceptEventsEmittedForRoom.has(id)) {
    return true;
  }
  const socket = getSocket();
  if (!socket?.connected) {
    fcmTrace('tryEmitAstrologerJoinedChatEvents: socket not connected room=', id);
    return false;
  }

  if (options?.force) {
    leaveRoom(id);
    fcmTrace('tryEmitAstrologerJoinedChatEvents: leave-room before re-accept room=', id);
    await new Promise<void>(resolve => {
      setTimeout(resolve, FORCE_ACCEPT_LEAVE_MS);
    });
    joinRoom({ senderName: customerName, receiverMobile: userId });
    await new Promise<void>(resolve => {
      setTimeout(resolve, FORCE_ACCEPT_JOIN_MS);
    });
    dispatch(acceptChat({ from: userId, roomId: id }));
  } else {
    dispatch(acceptChat({ from: userId, roomId: id }));
    joinRoom({ senderName: customerName, receiverMobile: userId });
  }

  dispatch(setChatStarted(true));
  markAcceptEventsEmitted(id);
  fcmTrace(
    'tryEmitAstrologerJoinedChatEvents: accept-chat + join-room OK room=',
    id,
    'from=',
    userId,
    'force=',
    Boolean(options?.force),
  );
  return true;
}

function applyAstroChatDataForAccept(
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
}

/**
 * Waits for socket + emits `accept-chat` and `join-room` so the user app gets
 * chat-accepted and can join the room (lock-screen / notification accept path).
 */
export async function ensureAstrologerAcceptChatEvents(
  dispatch: AppDispatch,
  p: OrderStackParamList['IncomingChatRequest'],
  options?: EnsureAstrologerAcceptChatEventsOptions,
): Promise<boolean> {
  const from = p.from?.trim();
  const roomId = p.roomId?.trim();
  if (!from || !roomId) {
    fcmTraceError('ensureAstrologerAcceptChatEvents: missing from or roomId');
    return false;
  }
  if (options?.force) {
    clearIncomingChatAcceptDedupeState(roomId);
    fcmTrace('ensureAstrologerAcceptChatEvents: force re-emit room=', roomId);
  } else if (wereAstrologerAcceptChatEventsEmitted(roomId)) {
    return true;
  }

  const sessionReady = await ensureSessionForIncomingChatDecision();
  if (!sessionReady) {
    fcmTrace('ensureAstrologerAcceptChatEvents: session not ready room=', roomId);
    return false;
  }

  applyAstroChatDataForAccept(dispatch, p);

  const maxAttempts = 50;
  const delayMs = 150;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (
      await tryEmitAstrologerJoinedChatEvents(
        dispatch,
        from,
        roomId,
        p.customerName,
        options,
      )
    ) {
      return true;
    }
    await new Promise<void>(resolve => {
      setTimeout(resolve, delayMs);
    });
  }

  fcmTraceError(
    'ensureAstrologerAcceptChatEvents: accept-chat not emitted after retries room=',
    roomId,
  );
  return false;
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

function isAcceptNavigationDone(
  roomId: string,
  target: AcceptNavigateTarget,
): boolean {
  return target === 'chat'
    ? isConsultationChatNavigationDone(roomId)
    : isIncomingAcceptNavigationDone(roomId);
}

function tryNavigateAfterAccept(
  p: OrderStackParamList['IncomingChatRequest'],
  target: AcceptNavigateTarget = 'waitlist',
): void {
  const roomId = p.roomId.trim();
  if (isAcceptNavigationDone(roomId, target)) {
    finishAcceptNavigation(roomId);
    clearAcceptNavigateTarget(roomId);
    fcmTrace('tryNavigateAfterAccept: skip room=', roomId, 'target=', target);
    return;
  }
  markAcceptNavigationPending(true);
  pendingAcceptNavigateTargetByRoom.set(roomId, target);

  if (target === 'chat') {
    if (openConsultationChatScreen(p)) {
      markConsultationChatNavigationDone(roomId);
      finishAcceptNavigation(roomId);
      clearAcceptNavigateTarget(roomId);
      fcmTrace('tryNavigateAfterAccept: ConsultationChat OK room=', roomId);
      return;
    }
    navigateToChatAfterAccept(p);
    return;
  }

  if (openWaitlistScreen()) {
    markIncomingAcceptNavigationDone(roomId);
    finishAcceptNavigation(roomId);
    clearAcceptNavigateTarget(roomId);
    fcmTrace('tryNavigateAfterAccept: Waitlist OK room=', roomId);
    return;
  }
  navigateToWaitlistAfterAccept(p);
}

export function navigateToChatAfterAccept(
  p: OrderStackParamList['IncomingChatRequest'],
): void {
  const roomId = p.roomId.trim();
  pendingAcceptNavigateTargetByRoom.set(roomId, 'chat');
  if (isConsultationChatNavigationDone(roomId)) {
    finishAcceptNavigation(roomId);
    clearAcceptNavigateTarget(roomId);
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
      clearAcceptNavigateTarget(roomId);
      return;
    }

    attempts += 1;
    if (openConsultationChatScreen(p)) {
      markConsultationChatNavigationDone(roomId);
      fcmTrace('navigateToChatAfterAccept OK room=', roomId, 'attempt=', attempts);
      finishAcceptNavigation(roomId);
      clearAcceptNavigateTarget(roomId);
      return;
    }
    if (attempts < MAX_NAV_RETRIES) {
      setTimeout(tryNav, NAV_RETRY_MS);
      return;
    }
    fcmTrace('navigateToChatAfterAccept deferred room=', roomId);
    void setPendingIncomingChatAccept(p);
  };
  tryNav();
}

export function navigateToWaitlistAfterAccept(
  p: OrderStackParamList['IncomingChatRequest'],
): void {
  const roomId = p.roomId.trim();
  if (isIncomingAcceptNavigationDone(roomId)) {
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
    if (isIncomingAcceptNavigationDone(roomId)) {
      finishAcceptNavigation(roomId);
      return;
    }

    attempts += 1;
    if (openWaitlistScreen()) {
      markIncomingAcceptNavigationDone(roomId);
      fcmTrace('navigateToWaitlistAfterAccept OK room=', roomId, 'attempt=', attempts);
      finishAcceptNavigation(roomId);
      return;
    }
    if (attempts < MAX_NAV_RETRIES) {
      setTimeout(tryNav, NAV_RETRY_MS);
      return;
    }
    fcmTrace(
      'navigateToWaitlistAfterAccept deferred (main tab not ready) room=',
      roomId,
    );
    void setPendingIncomingChatAccept(p);
  };
  tryNav();
}

export const navigateToConsultationChat = navigateToChatAfterAccept;

async function applyIncomingChatAccept(
  dispatch: AppDispatch,
  p: OrderStackParamList['IncomingChatRequest'],
  options?: EnsureAstrologerAcceptChatEventsOptions,
): Promise<boolean> {
  return ensureAstrologerAcceptChatEvents(dispatch, p, options);
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
    if (!wereAstrologerAcceptChatEventsEmitted(roomId)) {
      fcmTrace('acceptIncomingChatFromNotification: retry accept-chat room=', roomId);
      void ensureAstrologerAcceptChatEvents(dispatch, p, { force: true });
    }
    const target = resolveAcceptNavigateTarget(roomId, options);
    if (!isAcceptNavigationDone(roomId, target)) {
      fcmTrace('acceptIncomingChatFromNotification: retry nav room=', roomId, 'target=', target);
      tryNavigateAfterAccept(p, target);
    } else {
      finishAcceptNavigation(roomId);
    }
    return;
  }
  markNotificationAcceptHandled(roomId);
  markIncomingRoomHandled(roomId);
  markAcceptNavigationPending(true);

  void cancelIncomingChatNotifications();
  void stopIncomingChatNative();
  void clearIncomingChatPayloadNative();
  void clearPendingIncomingChat();

  await acceptIncomingChatFromPush(dispatch, p, {
    skipMainActivityLaunch: options?.skipMainActivityLaunch ?? true,
    navigateTarget: options?.navigateTarget ?? 'waitlist',
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

  const navigateTarget = resolveAcceptNavigateTarget(roomId, options);
  pendingAcceptNavigateTargetByRoom.set(roomId, navigateTarget);

  if (isAcceptNavigationDone(roomId, navigateTarget)) {
    finishAcceptNavigation(roomId);
    clearAcceptNavigateTarget(roomId);
    if (!wereAstrologerAcceptChatEventsEmitted(roomId)) {
      void ensureAstrologerAcceptChatEvents(dispatch, p, { force: true });
    }
    fcmTrace('acceptIncomingChatFromPush: skip nav room=', roomId, 'target=', navigateTarget);
    return;
  }

  markIncomingRoomHandled(roomId);

  if (acceptFlowInFlightForRoom.has(roomId)) {
    fcmTrace(
      'acceptIncomingChatFromPush: in flight — retry events/nav room=',
      roomId,
    );
    void ensureAstrologerAcceptChatEvents(dispatch, p, { force: true });
    tryNavigateAfterAccept(p, navigateTarget);
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
    const applied = await applyIncomingChatAccept(dispatch, p, { force: true });
    if (!applied) {
      fcmTrace(
        'acceptIncomingChatFromPush: accept deferred (session) room=',
        roomId,
      );
    }

    tryNavigateAfterAccept(p, navigateTarget);
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
  const target = resolveAcceptNavigateTarget(roomId);

  if (isAcceptNavigationDone(roomId, target)) {
    finishAcceptNavigation(roomId);
    clearAcceptNavigateTarget(roomId);
    fcmTrace('flushPendingIncomingChatAccept: skip room=', roomId, 'target=', target);
    return true;
  }

  fcmTrace('flushPendingIncomingChatAccept room=', roomId, 'target=', target);

  if (!wereAstrologerAcceptChatEventsEmitted(roomId)) {
    const applied = await ensureAstrologerAcceptChatEvents(dispatch, pending, {
      force: true,
    });
    if (!applied) {
      return false;
    }
  }

  if (target === 'chat') {
    if (!openConsultationChatScreen(pending)) {
      fcmTrace('flushPendingIncomingChatAccept: chat nav deferred room=', roomId);
      return false;
    }
    markConsultationChatNavigationDone(roomId);
  } else if (!openWaitlistScreen()) {
    fcmTrace('flushPendingIncomingChatAccept: waitlist nav deferred room=', roomId);
    return false;
  } else {
    markIncomingAcceptNavigationDone(roomId);
  }

  finishAcceptNavigation(roomId);
  clearAcceptNavigateTarget(roomId);
  fcmTrace('flushPendingIncomingChatAccept: navigated target=', target, 'room=', roomId);
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
