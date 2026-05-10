/**
 * Captures the *full* FCM messages we receive so the dev debug panel can show
 * the backend team exactly what's being sent.
 *
 * We keep the last few messages (foreground / background / opened-from-tray)
 * along with a verdict: did the payload include a `notification` field? If yes,
 * the custom incoming-chat overlay flow is broken at the source — backend must
 * switch to data-only.
 */

import type { FirebaseMessagingTypes } from '@react-native-firebase/messaging';

export type FcmCaptureSource =
  | 'background'
  | 'foreground'
  | 'opened-from-tray'
  | 'initial-notification';

export type FcmCaptureVerdict = 'data-only' | 'mixed' | 'notification-only';

export type FcmCaptureEntry = {
  id: number;
  ts: number;
  source: FcmCaptureSource;
  messageId: string | undefined;
  hasNotification: boolean;
  hasData: boolean;
  notification: FirebaseMessagingTypes.Notification | undefined;
  data: Record<string, string | object> | undefined;
  verdict: FcmCaptureVerdict;
  rawPretty: string;
};

const RING_SIZE = 10;
const buffer: FcmCaptureEntry[] = [];
let nextId = 1;

type Listener = (entries: ReadonlyArray<FcmCaptureEntry>) => void;
const listeners = new Set<Listener>();

function pretty(message: FirebaseMessagingTypes.RemoteMessage): string {
  try {
    return JSON.stringify(
      {
        messageId: message.messageId,
        from: message.from,
        collapseKey: message.collapseKey,
        sentTime: message.sentTime,
        ttl: message.ttl,
        notification: message.notification ?? null,
        data: message.data ?? null,
      },
      null,
      2,
    );
  } catch {
    return '<unserializable RemoteMessage>';
  }
}

function decideVerdict(
  hasNotification: boolean,
  hasData: boolean,
): FcmCaptureVerdict {
  if (hasNotification && hasData) return 'mixed';
  if (hasNotification) return 'notification-only';
  return 'data-only';
}

export function captureFcmMessage(
  source: FcmCaptureSource,
  message: FirebaseMessagingTypes.RemoteMessage | null | undefined,
): FcmCaptureEntry | null {
  if (!message) return null;
  const data = message.data;
  const hasData = !!data && Object.keys(data).length > 0;
  const hasNotification = !!message.notification;
  const entry: FcmCaptureEntry = {
    id: nextId++,
    ts: Date.now(),
    source,
    messageId: message.messageId,
    hasNotification,
    hasData,
    notification: message.notification,
    data: data as Record<string, string | object> | undefined,
    verdict: decideVerdict(hasNotification, hasData),
    rawPretty: pretty(message),
  };
  buffer.push(entry);
  if (buffer.length > RING_SIZE) {
    buffer.splice(0, buffer.length - RING_SIZE);
  }
  if (listeners.size > 0) {
    const snapshot = buffer.slice();
    listeners.forEach(l => {
      try {
        l(snapshot);
      } catch {
        /* noop */
      }
    });
  }
  return entry;
}

export function getFcmCaptureEntries(): ReadonlyArray<FcmCaptureEntry> {
  return buffer.slice();
}

export function subscribeFcmCapture(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function clearFcmCapture(): void {
  buffer.length = 0;
  listeners.forEach(l => {
    try {
      l([]);
    } catch {
      /* noop */
    }
  });
}

/**
 * Build a single shareable text blob the user can paste to the backend team.
 * Includes the most recent capture + a verdict + the explicit fix instructions.
 */
export function buildBackendBugReport(
  entries: ReadonlyArray<FcmCaptureEntry> = getFcmCaptureEntries(),
): string {
  if (entries.length === 0) {
    return '[YoginiFCM] No FCM messages captured yet.';
  }
  const last = entries[entries.length - 1];
  const verdictLine =
    last.verdict === 'data-only'
      ? '✅ verdict: DATA-ONLY (correct)'
      : last.verdict === 'mixed'
        ? '❌ verdict: MIXED — payload contains BOTH `notification` and `data`. ' +
          'Android shows its own banner and bypasses the custom overlay. ' +
          'Backend MUST remove the `notification` field.'
        : '❌ verdict: NOTIFICATION-ONLY — payload has only `notification`, no `data`. ' +
          'The app cannot drive the custom overlay. ' +
          'Backend MUST switch to data-only.';

  const correctExample = `Correct payload (admin SDK):
{
  "token": "<astrologer FCM token>",
  "data": {
    "type": "incoming_chat",
    "roomId": "<room id>",
    "senderId": "<user phone or id>",
    "customerName": "<user name>",
    "customerImage": "",
    "message": "Wants to chat with you.",
    "subtitle": "Yoginiastro User"
  },
  "android": { "priority": "high" },
  "apns": {
    "headers": { "apns-priority": "10" },
    "payload": { "aps": { "content-available": 1 } }
  }
}

Rules:
  • NO \`notification\` field anywhere (top-level / android.notification / aps.alert)
  • All values inside \`data\` MUST be strings
  • android.priority MUST be "high" (else delayed in Doze)
`;

  const captured =
    `Last received message [${last.source}] @ ${new Date(last.ts).toISOString()}\n` +
    `messageId=${last.messageId ?? '(none)'}\n` +
    `hasNotification=${last.hasNotification}  hasData=${last.hasData}\n` +
    `${verdictLine}\n\n` +
    `Raw payload:\n${last.rawPretty}\n`;

  return `[YoginiFCM] Backend bug report\n${captured}\n${correctExample}`;
}
