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
import {
  astroApi,
  normalizeAstroProfileFromApi,
} from '../api/astroApi';
import { coerceBillingNumber } from '../../utils/chatBilling';
import { fcmTrace, fcmTraceError } from './fcmDebug';
import {
  isConsultationChatNavigationDone,
  isIncomingAcceptNavigationDone,
  markConsultationChatNavigationDone,
  markIncomingAcceptNavigationDone,
  openConsultationChatScreen,
  openWaitlistScreen,
  requestConsultationChatNavigation,
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
   * `chat` — open ConsultationChat (foreground overlay + notification accept).
   * `waitlist` — legacy; only pass explicitly when Waitlist is required.
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
    'chat'
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

/** Resolve user balance + chat rate before accept — waitlist still has the row here. */
export async function hydrateIncomingChatBilling(
  p: OrderStackParamList['IncomingChatRequest'],
): Promise<OrderStackParamList['IncomingChatRequest']> {
  const roomId = p.roomId?.trim();
  if (!roomId) {
    return p;
  }

  let balance = coerceBillingNumber(p.userBalance);
  let price = coerceBillingNumber(p.astroPrice);

  const chatData = store.getState().socket.astroChatData as
    | Record<string, unknown>
    | null;
  balance ??= coerceBillingNumber(chatData?.userBalance);
  price ??= coerceBillingNumber(chatData?.astroPrice);

  const request = store.getState().socket.chatRequests.find(
    (item) => item.roomId?.trim() === roomId,
  );
  balance ??= coerceBillingNumber(request?.balance);
  price ??=
    coerceBillingNumber(request?.astroData) ??
    coerceBillingNumber(
      (request as Record<string, unknown> | undefined)?.astroPrice,
    );

  const astroId = store.getState().auth.astroId?.trim();
  if (astroId) {
    if (!price) {
      try {
        const profileRes = await astroApi.getProfile({ astroId });
        const rawProfile =
          profileRes.astrologer ??
          profileRes.profile ??
          profileRes.data ??
          profileRes.result;
        if (rawProfile && typeof rawProfile === 'object') {
          price = coerceBillingNumber(
            normalizeAstroProfileFromApi(
              rawProfile as Record<string, unknown>,
            ).price,
          );
        }
      } catch {
        /* optional */
      }
    }
    if (!balance || !price) {
      try {
        const waitlist = await astroApi.getWaitlist(astroId, {
          forceRefresh: true,
        });
        const entry = (waitlist.waitingList ?? []).find(
          (item) => item.roomId?.trim() === roomId,
        );
        balance ??= coerceBillingNumber(entry?.balance);
        price ??=
          coerceBillingNumber(entry?.astroData) ??
          coerceBillingNumber(
            (entry as Record<string, unknown> | undefined)?.astroPrice,
          );
      } catch {
        /* optional */
      }
    }
  }

  return {
    ...p,
    userBalance: balance,
    astroPrice: price,
  };
}

function applyAstroChatDataForAccept(
  dispatch: AppDispatch,
  p: OrderStackParamList['IncomingChatRequest'],
): void {
  const from = p.from?.trim();
  if (!from || !p.roomId) {
    return;
  }
  const prev = store.getState().socket.astroChatData as Record<
    string,
    unknown
  > | null;
  dispatch(setSocketChatDisconnect(false));
  dispatch(
    setAstroChatData({
      from,
      senderName: p.customerName,
      userImage: p.customerImage ?? undefined,
      roomId: p.roomId,
      kundliUrl: p.kundliUrl,
      userBalance:
        coerceBillingNumber(p.userBalance) ??
        coerceBillingNumber(prev?.userBalance),
      astroPrice:
        coerceBillingNumber(p.astroPrice) ??
        coerceBillingNumber(prev?.astroPrice),
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
  const latest = resolveLatestIncomingChatParams(p);
  const from = latest.from?.trim();
  const roomId = latest.roomId?.trim();
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

  const enriched = await hydrateIncomingChatBilling(latest);
  applyAstroChatDataForAccept(dispatch, enriched);

  const maxAttempts = 50;
  const delayMs = 150;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (
      await tryEmitAstrologerJoinedChatEvents(
        dispatch,
        from,
        roomId,
        enriched.customerName,
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
  target: AcceptNavigateTarget = 'chat',
): void {
  const latest = resolveLatestIncomingChatParams(p);
  const roomId = latest.roomId.trim();
  if (isAcceptNavigationDone(roomId, target)) {
    finishAcceptNavigation(roomId);
    clearAcceptNavigateTarget(roomId);
    fcmTrace('tryNavigateAfterAccept: skip room=', roomId, 'target=', target);
    return;
  }
  markAcceptNavigationPending(true);
  pendingAcceptNavigateTargetByRoom.set(roomId, target);

  if (target === 'chat') {
    requestConsultationChatNavigation(latest);
    if (isConsultationChatNavigationDone(roomId)) {
      finishAcceptNavigation(roomId);
      clearAcceptNavigateTarget(roomId);
      fcmTrace('tryNavigateAfterAccept: ConsultationChat OK room=', roomId);
      return;
    }
    navigateToChatAfterAccept(latest);
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
  const latest = resolveLatestIncomingChatParams(p);
  const roomId = latest.roomId.trim();
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
    requestConsultationChatNavigation(latest);
    if (openConsultationChatScreen(latest)) {
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
    void setPendingIncomingChatAccept(latest);
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
  const latest = resolveLatestIncomingChatParams(p);
  const roomId = latest.roomId?.trim();
  if (!roomId) {
    return;
  }

  const navigateTarget = resolveAcceptNavigateTarget(roomId, {
    ...options,
    navigateTarget: options?.navigateTarget ?? 'chat',
  });
  pendingAcceptNavigateTargetByRoom.set(roomId, navigateTarget);
  await setPendingIncomingChatAccept(latest);
  markAcceptNavigationPending(true);

  if (wasNotificationAcceptHandled(roomId)) {
    if (!wereAstrologerAcceptChatEventsEmitted(roomId)) {
      fcmTrace('acceptIncomingChatFromNotification: retry accept-chat room=', roomId);
      void ensureAstrologerAcceptChatEvents(dispatch, latest, { force: true });
    }
    if (!isAcceptNavigationDone(roomId, navigateTarget)) {
      fcmTrace(
        'acceptIncomingChatFromNotification: retry nav room=',
        roomId,
        'target=',
        navigateTarget,
      );
      tryNavigateAfterAccept(latest, navigateTarget);
    } else {
      finishAcceptNavigation(roomId);
    }
    return;
  }
  markNotificationAcceptHandled(roomId);
  markIncomingRoomHandled(roomId);

  void cancelIncomingChatNotifications();
  void stopIncomingChatNative();
  void clearIncomingChatPayloadNative();
  void clearPendingIncomingChat();

  await acceptIncomingChatFromPush(dispatch, latest, {
    skipMainActivityLaunch: options?.skipMainActivityLaunch ?? true,
    navigateTarget,
  });
}

export async function acceptIncomingChatFromPush(
  dispatch: AppDispatch,
  p: OrderStackParamList['IncomingChatRequest'],
  options?: AcceptIncomingChatOptions,
): Promise<void> {
  const latest = resolveLatestIncomingChatParams(p);
  const from = latest.from?.trim();
  const roomId = latest.roomId?.trim();
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
      void ensureAstrologerAcceptChatEvents(dispatch, latest, { force: true });
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
    void ensureAstrologerAcceptChatEvents(dispatch, latest, { force: true });
    tryNavigateAfterAccept(latest, navigateTarget);
    return;
  }

  await setPendingIncomingChatAccept(latest);
  markAcceptNavigationPending(true);

  if (
    !options?.skipMainActivityLaunch &&
    Platform.OS === 'android' &&
    !mainActivityLaunchedForAcceptRoom.has(roomId)
  ) {
    mainActivityLaunchedForAcceptRoom.add(roomId);
    setTimeout(() => mainActivityLaunchedForAcceptRoom.delete(roomId), 60_000);
    await openMainActivityForAcceptedChat(latest);
  }
  acceptFlowInFlightForRoom.add(roomId);

  try {
    const applied = await applyIncomingChatAccept(dispatch, latest, {
      force: true,
    });
    if (!applied) {
      fcmTrace(
        'acceptIncomingChatFromPush: accept deferred (session) room=',
        roomId,
      );
    }

    tryNavigateAfterAccept(latest, navigateTarget);
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

  const latest = resolveLatestIncomingChatParams(pending);
  const roomId = latest.roomId.trim();
  const target = resolveAcceptNavigateTarget(roomId);

  if (isAcceptNavigationDone(roomId, target)) {
    finishAcceptNavigation(roomId);
    clearAcceptNavigateTarget(roomId);
    fcmTrace('flushPendingIncomingChatAccept: skip room=', roomId, 'target=', target);
    return true;
  }

  fcmTrace('flushPendingIncomingChatAccept room=', roomId, 'target=', target);

  if (!wereAstrologerAcceptChatEventsEmitted(roomId)) {
    const applied = await ensureAstrologerAcceptChatEvents(dispatch, latest, {
      force: true,
    });
    if (!applied) {
      return false;
    }
  }

  if (target === 'chat') {
    requestConsultationChatNavigation(latest);
    if (!openConsultationChatScreen(latest)) {
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
