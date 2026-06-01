import { CommonActions } from '@react-navigation/native';
import { DeviceEventEmitter } from 'react-native';
import { navigationRef } from '../../navigation/navigationRef';
import type { OrderStackParamList, RootTabParamList } from '../../navigation/types';
import { canEnterMainAppFromAuthState } from './ensureSessionForIncomingChatDecision';
import { fcmTrace, fcmTraceError } from './fcmDebug';

export const INCOMING_CHAT_OPEN_CONSULTATION_EVENT =
  'IncomingChat:openConsultationChat';

export type ConsultationChatNavParams =
  OrderStackParamList['IncomingChatRequest'];

function buildChatScreenParams(
  p: ConsultationChatNavParams,
  from: string,
): OrderStackParamList['ConsultationChat'] {
  return {
    customerName: p.customerName,
    roomId: p.roomId,
    senderId: from,
    kundaliPayload: p.kundaliPayload,
    customerImage: p.customerImage ?? undefined,
  };
}

/** MainTabNavigator mounted and Order tab is in the root state tree. */
export function isMainTabNavigationReady(): boolean {
  if (!navigationRef.isReady()) {
    return false;
  }
  const routes = navigationRef.getRootState()?.routes ?? [];
  return routes.some(route => route.name === 'Order');
}

type NavRoute = {
  name?: string;
  params?: { roomId?: string };
  state?: { routes?: NavRoute[]; index?: number };
};

function getActiveConsultationChatRoomId(): string | null {
  if (!navigationRef.isReady()) {
    return null;
  }
  const rootRoutes = navigationRef.getRootState()?.routes ?? [];
  const orderRoute = rootRoutes.find(route => route.name === 'Order') as
    | NavRoute
    | undefined;
  const stackRoutes = orderRoute?.state?.routes;
  const stackIndex = orderRoute?.state?.index ?? 0;
  const active = stackRoutes?.[stackIndex];
  if (active?.name !== 'ConsultationChat') {
    return null;
  }
  const roomId = active.params?.roomId?.trim();
  return roomId || null;
}

/** Avoid repeated `CommonActions.reset` — remounting chat causes leaveRoom/joinRoom loops. */
export function isAlreadyOnConsultationChat(roomId: string): boolean {
  const activeRoom = getActiveConsultationChatRoomId();
  return Boolean(activeRoom && activeRoom === roomId.trim());
}

const completedConsultationChatRooms = new Set<string>();

export function markConsultationChatNavigationDone(roomId: string): void {
  const id = roomId.trim();
  if (!id) {
    return;
  }
  completedConsultationChatRooms.add(id);
  setTimeout(() => completedConsultationChatRooms.delete(id), 120_000);
}

export function isConsultationChatNavigationDone(roomId: string): boolean {
  const id = roomId.trim();
  return (
    completedConsultationChatRooms.has(id) || isAlreadyOnConsultationChat(id)
  );
}

/**
 * Switch to Order tab and reset its stack to ConsultationChat only
 * (same outcome as IncomingChatRequestScreen `replace`).
 */
export function openConsultationChatScreen(
  p: ConsultationChatNavParams,
): boolean {
  const from = p.from?.trim();
  if (!from || !p.roomId) {
    fcmTraceError('openConsultationChatScreen: missing from or roomId');
    return false;
  }
  if (!canEnterMainAppFromAuthState()) {
    fcmTrace('openConsultationChatScreen: defer — main app not ready room=', p.roomId);
    return false;
  }
  if (!isMainTabNavigationReady()) {
    fcmTrace('openConsultationChatScreen: defer — tabs not mounted room=', p.roomId);
    return false;
  }

  if (isConsultationChatNavigationDone(p.roomId)) {
    fcmTrace(
      'openConsultationChatScreen: skip — already on ConsultationChat room=',
      p.roomId,
    );
    return true;
  }

  const chatParams = buildChatScreenParams(p, from);
  const rootState = navigationRef.getRootState();
  if (!rootState?.routes?.length) {
    return false;
  }

  const orderIndex = rootState.routes.findIndex(route => route.name === 'Order');
  if (orderIndex < 0) {
    return false;
  }

  const routes = rootState.routes.map(route => {
    if (route.name !== 'Order') {
      return { name: route.name as keyof RootTabParamList };
    }
    return {
      name: 'Order' as const,
      state: {
        routes: [{ name: 'ConsultationChat' as const, params: chatParams }],
        index: 0,
      },
    };
  });

  navigationRef.dispatch(
    CommonActions.reset({
      index: orderIndex,
      routes,
    }),
  );

  markConsultationChatNavigationDone(p.roomId);
  fcmTrace('openConsultationChatScreen: OK room=', p.roomId);
  return true;
}

/** Ask RootNavigator (main JS tree) to open chat — safe from headless / background. */
export function requestConsultationChatNavigation(
  p: ConsultationChatNavParams,
): void {
  if (isConsultationChatNavigationDone(p.roomId)) {
    return;
  }
  DeviceEventEmitter.emit(INCOMING_CHAT_OPEN_CONSULTATION_EVENT, p);
  if (openConsultationChatScreen(p)) {
    return;
  }
  fcmTrace('requestConsultationChatNavigation: deferred room=', p.roomId);
}
