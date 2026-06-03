/**
 * Incoming chat — 3 cases (single source of truth).
 *
 * | Case | When | Ring + UI | Accept |
 * |------|------|-----------|--------|
 * | 1 | Unlocked + killed/background | Notifee (tap only) | Tap → React overlay → chat |
 * | 2 | Locked | Native full-screen + ring | Accept → waitlist (or chat per product) |
 * | 3 | App foreground | React overlay, no tray | Accept → ConsultationChat |
 */
import type { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import { Platform } from 'react-native';
import type { AppDispatch } from '../../store';
import type { IncomingChatLaunchConsume } from './incomingChatFromFcm';
import { fcmTrace, fcmTraceError } from './fcmDebug';
import {
  getIncomingChatParamsFromRemoteMessage,
  handleIncomingFcm,
} from './incomingChatFromFcm';
import { showLocalNotificationFromRemoteMessage } from './notificationDisplay';
import {
  isDeviceUnlockedNative,
  persistIncomingChatPayloadNative,
  startIncomingChatNative,
} from './incomingChatNative';
import { setPendingIncomingChat } from './pendingIncomingChat';

export type IncomingChatPresentationMode =
  | 'app_open'
  | 'unlocked_background'
  | 'locked_background';

export async function resolveIncomingChatPresentationMode(options?: {
  appInForeground?: boolean;
}): Promise<IncomingChatPresentationMode> {
  if (options?.appInForeground) {
    return 'app_open';
  }
  if (Platform.OS !== 'android') {
    return 'unlocked_background';
  }
  const unlocked = await isDeviceUnlockedNative();
  return unlocked ? 'unlocked_background' : 'locked_background';
}

export function shouldPresentReactIncomingOverlay(
  mode: IncomingChatPresentationMode,
  launch?: IncomingChatLaunchConsume | null,
): boolean {
  if (launch?.decision === 'accept' || launch?.decision === 'reject') {
    return false;
  }
  if (mode === 'locked_background') {
    return false;
  }
  return mode === 'app_open' || mode === 'unlocked_background';
}

export function shouldNotificationShowAnswerDeclineActions(
  mode: IncomingChatPresentationMode,
): boolean {
  return mode === 'locked_background';
}

export function logIncomingChatMode(
  mode: IncomingChatPresentationMode,
  source: string,
): void {
  fcmTrace('incomingChat mode=', mode, '←', source);
}

/** Cases 1 & 2 when app is background/killed. Case 3 = RootNavigator foreground only. */
export async function deliverIncomingChatRinging(
  dispatch: AppDispatch,
  remoteMessage: FirebaseMessagingTypes.RemoteMessage,
  canEnterMainApp: boolean,
  source: string,
): Promise<void> {
  const params = getIncomingChatParamsFromRemoteMessage(remoteMessage);
  if (!params) {
    return;
  }

  if (Platform.OS !== 'android') {
    await showLocalNotificationFromRemoteMessage(remoteMessage);
    return;
  }

  const mode = await resolveIncomingChatPresentationMode({ appInForeground: false });
  logIncomingChatMode(mode, source);

  handleIncomingFcm(dispatch, remoteMessage, canEnterMainApp);
  await persistIncomingChatPayloadNative(params);
  await setPendingIncomingChat(params);

  if (mode === 'unlocked_background') {
    await showLocalNotificationFromRemoteMessage(remoteMessage, {
      presentationMode: mode,
    });
    return;
  }

  const nativeOk = await startIncomingChatNative(params);
  if (!nativeOk) {
    fcmTraceError('deliverIncomingChatRinging: native failed — Notifee fallback');
    await showLocalNotificationFromRemoteMessage(remoteMessage, {
      presentationMode: mode,
    });
  }
}
