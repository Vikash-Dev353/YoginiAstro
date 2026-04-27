import notifee, { AndroidImportance } from '@notifee/react-native';
import type { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import { fcmTrace, fcmTraceError } from './fcmDebug';

const DEFAULT_CHANNEL_ID = 'chat_requests';

function toText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '';
}

async function ensureDefaultChannel(): Promise<string> {
  return notifee.createChannel({
    id: DEFAULT_CHANNEL_ID,
    name: 'Chat Requests',
    importance: AndroidImportance.HIGH,
  });
}

export async function initializeLocalNotifications(): Promise<void> {
  try {
    const settings = await notifee.requestPermission();
    fcmTrace('notifee.requestPermission →', JSON.stringify(settings));
    const channelId = await ensureDefaultChannel();
    fcmTrace('notification channel ready', channelId);
  } catch (error) {
    fcmTraceError('initializeLocalNotifications failed', error);
  }
}

function getTitle(remoteMessage: FirebaseMessagingTypes.RemoteMessage): string {
  return (
    remoteMessage.notification?.title ||
    toText(remoteMessage.data?.title) ||
    'Chat Request'
  );
}

function getBody(remoteMessage: FirebaseMessagingTypes.RemoteMessage): string {
  return (
    remoteMessage.notification?.body ||
    toText(remoteMessage.data?.body) ||
    'Received a new chat request.'
  );
}

/** Shows a local notification for data-only FCM payloads. */
export async function showLocalNotificationFromRemoteMessage(
  remoteMessage: FirebaseMessagingTypes.RemoteMessage,
): Promise<void> {
  const title = getTitle(remoteMessage);
  const body = getBody(remoteMessage);
  fcmTrace(
    'showLocalNotification ← messageId=' +
      (remoteMessage.messageId ?? '(none)') +
      ' collapseKey=' +
      String(remoteMessage.collapseKey ?? ''),
    'title=' +
      JSON.stringify(title) +
      ' body=' +
      JSON.stringify(body.slice(0, 120)),
  );
  fcmTrace(
    'remoteMessage.data (keys)=',
    remoteMessage.data ? Object.keys(remoteMessage.data).join(',') : '(none)',
  );
  try {
    const channelId = await ensureDefaultChannel();
    await notifee.displayNotification({
      id: remoteMessage.messageId || undefined,
      title,
      body,
      android: {
        channelId,
        smallIcon: 'ic_launcher',
        pressAction: {
          id: 'default',
        },
      },
    });
    fcmTrace('notifee.displayNotification OK channelId=', channelId);
  } catch (error) {
    fcmTraceError('showLocalNotificationFromRemoteMessage FAILED', error);
  }
}
