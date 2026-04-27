/**
 * @format
 */

import 'react-native-gesture-handler';
import '@react-native-firebase/app';
import messaging from '@react-native-firebase/messaging';
import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import { fcmTrace } from './src/services/push/fcmDebug';
import { showLocalNotificationFromRemoteMessage } from './src/services/push/notificationDisplay';

/** Required headless handler for data messages on Android; tap-to-open uses getInitialNotification in JS. */
messaging().setBackgroundMessageHandler(async remoteMessage => {
  fcmTrace(
    'setBackgroundMessageHandler messageId=',
    remoteMessage?.messageId ?? '(none)',
    'collapseKey=',
    remoteMessage?.collapseKey ?? '',
  );
  await showLocalNotificationFromRemoteMessage(remoteMessage);
});

AppRegistry.registerComponent(appName, () => App);
