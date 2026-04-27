/**
 * @format
 */

import 'react-native-gesture-handler';
import '@react-native-firebase/app';
import messaging from '@react-native-firebase/messaging';
import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

/** Required headless handler for data messages on Android; tap-to-open uses getInitialNotification in JS. */
messaging().setBackgroundMessageHandler(async remoteMessage => {
  if (__DEV__) {
    console.log('[fcm] background message', remoteMessage?.messageId);
  }
});

AppRegistry.registerComponent(appName, () => App);
