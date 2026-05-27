import notifee, {
  AndroidCategory,
  AndroidImportance,
  AndroidVisibility,
  AuthorizationStatus,
} from '@notifee/react-native';
import type { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import { Platform } from 'react-native';
import { fcmTrace, fcmTraceError } from './fcmDebug';
import {
  getIncomingChatParamsFromData,
  getIncomingChatParamsFromRemoteMessage,
} from './incomingChatFromFcm';
import { persistIncomingChatPayloadNative } from './incomingChatNative';
import { setPendingIncomingChat } from './pendingIncomingChat';

/** Matches native `NotificationChannels.SOUND_CHANNEL_ID` + FCM `channel_id: sound_channel`. */
const DEFAULT_CHANNEL_ID = 'sound_channel';

/** Must match `android/app/src/main/res/raw/custom_sound.mp3` (no extension when referenced). */
const CUSTOM_SOUND_RES = 'custom_sound';

/**
 * Bumped from `chat_incoming_ring` → `_v3` because Android caches channel sound at
 * creation time. Existing installs keep the old (silent default) channel until we
 * recreate it under a new id.
 */
const INCOMING_RING_CHANNEL_ID = 'chat_incoming_ring_v3';

/** Must match `android/app/src/main/res/raw/incoming_chat_ring.wav` (no extension when referenced). */
const INCOMING_RING_RES = 'incoming_chat_ring';

/** Vibration: ring → pause → ring (mimics phone call cadence). */
const RING_VIBRATION_PATTERN = [0, 1000, 800, 1000, 800, 1000, 800];

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
    name: 'Push notifications',
    description: 'Default push notification sound',
    importance: AndroidImportance.HIGH,
    sound: CUSTOM_SOUND_RES,
    vibration: true,
  });
}

/**
 * Incoming-chat (call-style) channel — uses our bundled `incoming_chat_ring` sound,
 * loops, vibrates, lights up the screen, and is treated as a CALL category so it
 * bypasses Do Not Disturb where allowed.
 */
async function ensureIncomingRingChannel(): Promise<string> {
  return notifee.createChannel({
    id: INCOMING_RING_CHANNEL_ID,
    name: 'Incoming chat (ring)',
    description: 'Ringtone for incoming chat requests',
    importance: AndroidImportance.HIGH,
    sound: INCOMING_RING_RES,
    vibration: true,
    vibrationPattern: RING_VIBRATION_PATTERN,
    bypassDnd: true,
    visibility: AndroidVisibility.PUBLIC,
    lights: true,
    lightColor: '#B77A72',
  });
}

export async function initializeLocalNotifications(): Promise<void> {
  try {
    const settings = await notifee.requestPermission();
    fcmTrace('notifee.requestPermission →', JSON.stringify(settings));
    if (
      Platform.OS === 'android' &&
      settings.authorizationStatus !== AuthorizationStatus.AUTHORIZED
    ) {
      fcmTrace('notifee permission NOT granted — chat ring may stay silent.');
    }
    await ensureDefaultChannel();
    await ensureIncomingRingChannel();
    if (Platform.OS === 'android') {
      try {
        const canFullScreen = await notifee.canUseFullScreenIntent();
        fcmTrace('Android canUseFullScreenIntent=', canFullScreen);
        if (!canFullScreen) {
          fcmTrace(
            'Enable full-screen notifications for Yogini Astro in system settings (required on Android 14 / OnePlus).',
          );
        }
      } catch (fsError) {
        fcmTraceError('canUseFullScreenIntent check failed', fsError);
      }
    }
    fcmTrace('notification channels ready');
  } catch (error) {
    fcmTraceError('initializeLocalNotifications failed', error);
  }
}

function getTitle(remoteMessage: FirebaseMessagingTypes.RemoteMessage): string {
  return (
    remoteMessage.notification?.title ||
    toText(remoteMessage.data?.title) ||
    'Incoming Chat Request'
  );
}

function getBody(remoteMessage: FirebaseMessagingTypes.RemoteMessage): string {
  return (
    remoteMessage.notification?.body ||
    toText(remoteMessage.data?.body) ||
    'A user is requesting a chat consultation'
  );
}

/** Notifee requires serializable data on the notification for tap / initial-notification handling. */
function buildNotifeeDataPayload(
  remoteMessage: FirebaseMessagingTypes.RemoteMessage,
): Record<string, string> {
  const data = remoteMessage.data ?? {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) continue;
    out[key] = typeof value === 'string' ? value : JSON.stringify(value);
  }
  const title = getTitle(remoteMessage);
  const body = getBody(remoteMessage);
  if (title && !out.title) {
    out.title = title;
  }
  if (body && !out.body) {
    out.body = body;
  }
  return out;
}

export type ShowLocalNotificationOptions = {
  /** Native foreground service already plays the ring — only wake the activity. */
  skipSound?: boolean;
};

/** Shows a local notification for data-only FCM payloads (background / killed). */
export async function showLocalNotificationFromRemoteMessage(
  remoteMessage: FirebaseMessagingTypes.RemoteMessage,
  options?: ShowLocalNotificationOptions,
): Promise<void> {
  const title = getTitle(remoteMessage);
  const body = getBody(remoteMessage);
  const incomingParams = getIncomingChatParamsFromRemoteMessage(remoteMessage);
  const isIncomingChat = incomingParams !== null;

  fcmTrace(
    'showLocalNotification ← messageId=' +
      (remoteMessage.messageId ?? '(none)') +
      ' collapseKey=' +
      String(remoteMessage.collapseKey ?? ''),
    'title=' + JSON.stringify(title),
    'incomingChat=' + String(isIncomingChat),
  );

  /**
   * For incoming chat, persist the parsed params NOW (before showing the
   * notification). When Notifee's `fullScreenAction` later wakes the device
   * and launches MainActivity, RootNavigator can read this and pop the
   * IncomingChatPushOverlay automatically — even if the user never tapped
   * the notification body.
   */
  if (isIncomingChat && incomingParams) {
    await persistIncomingChatPayloadNative(incomingParams);
    await setPendingIncomingChat(incomingParams);
  }

  try {
    const channelId = isIncomingChat
      ? await ensureIncomingRingChannel()
      : await ensureDefaultChannel();

    const dataPayload = buildNotifeeDataPayload(remoteMessage);

    await notifee.displayNotification({
      id: remoteMessage.messageId || undefined,
      title,
      body,
      data: dataPayload,
      android: {
        channelId,
        smallIcon: 'ic_launcher',
        pressAction: {
          id: 'default',
          launchActivity: 'default',
        },
        ...(isIncomingChat
          ? {
              category: AndroidCategory.CALL,
              visibility: AndroidVisibility.PUBLIC,
              importance: AndroidImportance.HIGH,
              sound: options?.skipSound ? undefined : INCOMING_RING_RES,
              loopSound: !options?.skipSound,
              ongoing: true,
              autoCancel: false,
              showTimestamp: true,
              lights: ['#B77A72', 400, 600],
              lightUpScreen: true,
              vibrationPattern: RING_VIBRATION_PATTERN,
              /**
               * Locked-screen wake: Notifee opens MainActivity full-screen
               * (manifest already sets `showWhenLocked` + `turnScreenOn`).
               * Once JS boots, RootNavigator consumes the pending payload
               * stored above and renders the custom Accept/Reject overlay.
               */
              fullScreenAction: {
                id: 'default',
                launchActivity: 'default',
              },
              actions: [
                {
                  title: 'Accept',
                  pressAction: {
                    id: 'incoming_chat_accept',
                    launchActivity: 'default',
                  },
                },
                {
                  title: 'Reject',
                  pressAction: { id: 'incoming_chat_decline' },
                },
              ],
            }
          : {}),
      },
      ios: isIncomingChat
        ? {
            sound: 'default',
            interruptionLevel: 'timeSensitive' as const,
          }
        : undefined,
    });
    fcmTrace('notifee.displayNotification OK channelId=', channelId);
  } catch (error) {
    fcmTraceError('showLocalNotificationFromRemoteMessage FAILED', error);
  }
}

/** Cancel any active incoming-chat ringing notification (call this on accept/reject). */
export async function cancelIncomingChatNotifications(): Promise<void> {
  try {
    const displayed = await notifee.getDisplayedNotifications();
    await Promise.all(
      displayed
        .filter(d => d.notification.android?.channelId === INCOMING_RING_CHANNEL_ID)
        .map(d => (d.id ? notifee.cancelNotification(d.id) : Promise.resolve())),
    );
  } catch (error) {
    fcmTraceError('cancelIncomingChatNotifications failed', error);
  }
}
