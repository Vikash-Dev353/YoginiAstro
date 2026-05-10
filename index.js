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
  acceptIncomingChatFromPush,
  rejectIncomingChatFromPush,
} from './src/services/push/incomingChatAcceptFlow';
import {
  cancelIncomingChatNotifications,
  showLocalNotificationFromRemoteMessage,
} from './src/services/push/notificationDisplay';
import { clearPendingIncomingChat } from './src/services/push/pendingIncomingChat';
import {
  startIncomingChatNative,
  stopIncomingChatNative,
} from './src/services/push/incomingChatNative';

/** Notifee: Accept / Reject from notification tray (legacy fallback for non-Android targets). */
notifee.onBackgroundEvent(async ({ type, detail }) => {
  fcmTrace('notifee.onBackgroundEvent type=', type, 'pressActionId=',
    detail?.pressAction?.id ?? '');
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
    clearPendingIncomingChat(),
    stopIncomingChatNative(),
  ]);

  const flat = flattenNotificationData(detail.notification.data);
  const params = getIncomingChatParamsFromData(flat);
  if (!params || !canEnterMainAppFromStore()) {
    return;
  }
  if (actionId === 'incoming_chat_accept') {
    acceptIncomingChatFromPush(store.dispatch, params);
  } else {
    rejectIncomingChatFromPush(store.dispatch, params);
  }
});

function canEnterMainAppFromStore() {
  const { auth } = store.getState();
  return (
    auth.isAuthenticated &&
    !auth.pendingProfileCompletion &&
    !auth.pendingAdminApproval
  );
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
    canEnterMainAppFromStore(),
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
  }
  if (!handledNatively) {
    fcmTrace('BG handler → falling back to Notifee notification');
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
    const params = getIncomingChatParamsFromData(flat);
    await Promise.all([
      cancelIncomingChatNotifications(),
      clearPendingIncomingChat(),
      stopIncomingChatNative(),
    ]);
    if (!params || !canEnterMainAppFromStore()) {
      return;
    }
    if (decision === 'accept') {
      acceptIncomingChatFromPush(store.dispatch, params);
    } else {
      rejectIncomingChatFromPush(store.dispatch, params);
    }
  },
);

AppRegistry.registerComponent(appName, () => App);
