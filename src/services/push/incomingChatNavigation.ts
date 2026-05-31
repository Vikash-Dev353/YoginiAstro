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

  fcmTrace('openConsultationChatScreen: OK room=', p.roomId);
  return true;
}

/** Ask RootNavigator (main JS tree) to open chat — safe from headless / background. */
export function requestConsultationChatNavigation(
  p: ConsultationChatNavParams,
): void {
  DeviceEventEmitter.emit(INCOMING_CHAT_OPEN_CONSULTATION_EVENT, p);
  if (openConsultationChatScreen(p)) {
    return;
  }
  fcmTrace('requestConsultationChatNavigation: deferred room=', p.roomId);
}
