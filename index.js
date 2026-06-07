/**
 * @format
 */

import 'react-native-gesture-handler';
import '@react-native-firebase/app';
import messaging from '@react-native-firebase/messaging';
import notifee, { EventType } from '@notifee/react-native';
import { AppRegistry, Platform } from 'react-native';
import { name as appName } from './app.json';
/** Redux store must load before `./App` so App → RootNavigator → push modules see a fully initialized store. */
import { store } from './src/store';
import { bootstrapAuth } from './src/store/slices/authSlice';
import App from './App';
import { fcmTrace, fcmTraceError } from './src/services/push/fcmDebug';
import { captureFcmMessage } from './src/services/push/fcmInspector';
import {
  flattenNotificationData,
  getIncomingChatParamsFromData,
  getIncomingChatParamsFromRemoteMessage,
  handleIncomingFcm,
} from './src/services/push/incomingChatFromFcm';
import {
  acceptIncomingChatFromNotification,
  rejectIncomingChatFromPush,
} from './src/services/push/incomingChatAcceptFlow';
import {
  canEnterMainAppFromAuthState,
  ensureSessionForIncomingChatDecision,
} from './src/services/push/ensureSessionForIncomingChatDecision';
import { resolveIncomingChatParams } from './src/services/push/resolveIncomingChatParams';
import {
  cancelIncomingChatNotifications,
  showLocalNotificationFromRemoteMessage,
} from './src/services/push/notificationDisplay';
import {
  clearPendingIncomingChat,
  setPendingIncomingChat,
} from './src/services/push/pendingIncomingChat';
import {
  persistIncomingChatPayloadNative,
  startIncomingChatNative,
  stopIncomingChatNative,
} from './src/services/push/incomingChatNative';

/** Notifee: Accept / Reject from notification tray (legacy fallback for non-Android targets). */
notifee.onBackgroundEvent(async ({ type, detail }) => {
  fcmTrace('notifee.onBackgroundEvent type=', type, 'pressActionId=',
    detail?.pressAction?.id ?? '');

  if (type === EventType.PRESS && detail.notification?.data) {
    const flat = flattenNotificationData(detail.notification.data);
    const params = getIncomingChatParamsFromData(flat);
    if (params) {
      await persistIncomingChatPayloadNative(params);
      await setPendingIncomingChat(params);
      fcmTrace('notifee BG PRESS stored pending room=', params.roomId);
    }
    return;
  }

  if (type !== EventType.ACTION_PRESS || !detail.notification?.data) {
    return;
  }
  const actionId = detail.pressAction?.id;
  if (
    actionId !== 'incoming_chat_accept' &&
    actionId !== 'incoming_chat_decline'
  ) {
    return;
  }

  await Promise.all([
    cancelIncomingChatNotifications(),
    stopIncomingChatNative(),
  ]);

  const flat = flattenNotificationData(detail.notification.data);
  const params = await resolveIncomingChatParams(flat, { consumePending: true });
  if (!params) {
    fcmTraceError('notifee.onBackgroundEvent: no incoming chat params');
    return;
  }
  await clearPendingIncomingChat();
  if (actionId === 'incoming_chat_accept') {
    await acceptIncomingChatFromNotification(store.dispatch, params, {
      navigateTarget: 'chat',
    });
    return;
  }
  const sessionReady = await ensureSessionForIncomingChatDecision();
  if (!sessionReady || !canEnterMainAppFromAuthState()) {
    return;
  }
  await rejectIncomingChatFromPush(store.dispatch, params);
});

async function canEnterMainAppFromStore() {
  if (!store.getState().auth.token) {
    try {
      await store.dispatch(bootstrapAuth()).unwrap();
    } catch {
      return false;
    }
  }
  return canEnterMainAppFromAuthState();
}

/**
 * Required headless handler for **data-only** FCM payloads on Android.
 *
 * Flow on Android:
 *   1. Update Redux waitlist / state (so foreground UI picks up the request immediately on resume).
 *   2. Hand off to the native `IncomingChatService` foreground service which:
 *        - Plays the looping ringtone (custom sound).
 *        - Shows an ongoing call-style notification.
 *        - Force-launches MainActivity *over the lock screen / on top of any
 *          other foreground app* — this is the part stock JS notifee can't do.
 *      MainActivity then surfaces the in-app `IncomingChatPushOverlay`.
 *   3. iOS / fallback: keep showing the regular Notifee notification.
 */
messaging().setBackgroundMessageHandler(async remoteMessage => {
  const captured = captureFcmMessage('background', remoteMessage);

  console.log('captured==>>>>', captured);

  console.log('remoteMessage', remoteMessage);
  fcmTrace(
    'BG handler ▶ messageId=',
    remoteMessage?.messageId ?? '(none)',
    'hasNotif=',
    !!remoteMessage?.notification,
    'dataKeys=',
    Object.keys(remoteMessage?.data || {}).join(','),
    'verdict=',
    captured?.verdict ?? '(none)',
  );
  if (remoteMessage?.notification) {
    fcmTraceError(
      'BG handler ⚠️ payload contains "notification" field — Android may have already shown a system banner; we will dismiss it and take over with the custom overlay',
    );
  }
  handleIncomingFcm(
    store.dispatch,
    remoteMessage,
    await canEnterMainAppFromStore(),
  );
  const params = getIncomingChatParamsFromRemoteMessage(remoteMessage);
  fcmTrace(
    'BG handler parsed params? ',
    params ? `room=${params.roomId}` : 'NO',
    ' platform=',
    Platform.OS,
  );
  let handledNatively = false;
  if (Platform.OS === 'android' && params) {
    await persistIncomingChatPayloadNative(params);
    await setPendingIncomingChat(params);
    /**
     * Backend currently sends a `notification` field which makes Android
     * auto-display its own banner before our handler runs. Cancel anything
     * currently displayed before our foreground service takes over with the
     * custom call-style notification + ringing + overlay.
     */
    try {
      await notifee.cancelAllNotifications();
      fcmTrace('BG handler dismissed auto-displayed banner(s)');
    } catch (e) {
      fcmTraceError('BG handler dismiss banner failed', e);
    }
    handledNatively = await startIncomingChatNative(params);
    fcmTrace('BG handler native handled? ', handledNatively);

    /**
     * Notifee fallback when native service fails. If native is up, cancel the
     * duplicate so one tray notification remains (tap-only when unlocked).
     */
    await showLocalNotificationFromRemoteMessage(remoteMessage, {
      skipSound: handledNatively,
      skipDisplay: false,
    });
    if (handledNatively) {
      try {
        await notifee.cancelAllNotifications();
      } catch (e) {
        fcmTraceError('BG handler dismiss duplicate Notifee notification failed', e);
      }
    }
  } else if (!remoteMessage?.notification) {
    fcmTrace('BG handler → Notifee (non-incoming / data-only)');
    await showLocalNotificationFromRemoteMessage(remoteMessage);
  }
});

/** Headless task fired by the native Accept / Reject broadcast receiver. */
AppRegistry.registerHeadlessTask(
  'IncomingChatActionTask',
  () => async data => {
    fcmTrace('HeadlessTask ▶ decision=', data?.decision ?? '');
    const decision = data?.decision;
    if (decision !== 'accept' && decision !== 'reject') {
      return;
    }
    const flat = flattenNotificationData(data ?? {});
    const params = await resolveIncomingChatParams(flat, { consumePending: true });
    await Promise.all([
      cancelIncomingChatNotifications(),
      stopIncomingChatNative(),
    ]);
    if (!params) {
      fcmTraceError('HeadlessTask: no incoming chat params');
      return;
    }
    if (decision === 'accept') {
      await acceptIncomingChatFromNotification(store.dispatch, params, {
        navigateTarget: 'chat',
      });
      return;
    }
    const sessionReady = await ensureSessionForIncomingChatDecision();
    if (!sessionReady || !canEnterMainAppFromAuthState()) {
      return;
    }
    await clearPendingIncomingChat();
    await rejectIncomingChatFromPush(store.dispatch, params);
  },
);

AppRegistry.registerComponent(appName, () => App);
