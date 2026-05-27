import type { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import type { OrderStackParamList } from '../../navigation/types';
import type { AppDispatch } from '../../store';
import type { ChatRequestItem } from '../../store/slices/socketSlice';
import { prependChatRequest } from '../../store/slices/socketSlice';
import { navigationRef } from '../../navigation/navigationRef';
import {
  parseKundliUrlToPayload,
  type GenerateKundaliPayload,
} from '../api/astroApi';
import { fcmTrace, fcmTraceError } from './fcmDebug';

/** If user tapped a waitlist notification before login, open Waitlist after session is ready. */
let pendingWaitlistMessage: FirebaseMessagingTypes.RemoteMessage | null = null;

/**
 * Backend can label a chat-request event with several values:
 *   `type` — 'incoming_chat'
 *   `event` — 'incoming_chat' / 'chat_request' / 'incoming-chat' / 'chat-request'
 * Anything else (e.g. type='general' which the queue API defaults to) is fine
 * as long as `roomId` + `senderId` are present in `data`.
 */
const INCOMING_CHAT_EVENT_VALUES = new Set([
  'incoming_chat',
  'incoming-chat',
  'chat_request',
  'chat-request',
  'chatrequest',
  'incomingchat',
]);

const EXPLICIT_NON_CHAT_TYPES = new Set([
  'waitlist_update',
  'waitlist-update',
  'waitlist_updated',
  'waitlist-updated',
]);

function normalizeEventLabel(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

/**
 * Returns true when the payload looks like an incoming chat request, even if
 * backend uses `type: 'general'` and only sets `event: 'incoming_chat'`.
 *
 * Detection precedence:
 *   1. Explicit non-chat types (waitlist) → always false.
 *   2. Explicit chat type/event values → true.
 *   3. Heuristic: has `roomId` AND a sender identifier AND backend didn't say
 *      it's something else.
 */
export function isIncomingChatPayload(
  data: Record<string, unknown> | undefined | null,
): boolean {
  if (!data) return false;
  const typeRaw = normalizeEventLabel(data.type);
  const eventRaw = normalizeEventLabel(data.event);

  if (EXPLICIT_NON_CHAT_TYPES.has(typeRaw) || EXPLICIT_NON_CHAT_TYPES.has(eventRaw)) {
    return false;
  }
  const navigateTo = normalizeEventLabel(data.navigateTo);
  if (navigateTo.includes('waitlist')) {
    return false;
  }

  if (
    INCOMING_CHAT_EVENT_VALUES.has(typeRaw) ||
    INCOMING_CHAT_EVENT_VALUES.has(eventRaw)
  ) {
    return true;
  }

  const roomId = String(data.roomId ?? '').trim();
  const senderId = String(
    data.senderId ?? data.from ?? data.userId ?? data.customerId ?? data.mobile ?? '',
  ).trim();
  return !!(roomId && senderId);
}

/**
 * Backend should send **data** payload with chat request (same when app is killed / background).
 *
 * Required data keys:
 * - `roomId` — chat room id
 * - `senderId` OR `from` — user/mobile id socket uses for accept/reject
 *
 * Optional:
 * - `customerName` | `userName` | `senderName`
 * - `message`
 * - `customerImage` | `profileImage`
 * - `kundliUrl`
 * - `userBalance`, `astroPrice` (numeric strings)
 * - `type` — if set, must be `incoming_chat` (recommended) or omit for backward compatibility
 */
export function applyIncomingChatFromFcm(
  dispatch: AppDispatch,
  remoteMessage: FirebaseMessagingTypes.RemoteMessage,
): boolean {
  const data = remoteMessage.data ?? {};

  console.log('remoteMessage data===>>>>>', remoteMessage)

  fcmTrace(
    'applyIncomingChatFromFcm messageId=',
    remoteMessage.messageId ?? '(none)',
    'type=',
    String(data.type ?? ''),
    'event=',
    String(data.event ?? ''),
    'roomId=',
    String(data.roomId ?? ''),
    'senderId=',
    String(data.senderId ?? data.from ?? ''),
  );
  if (!isIncomingChatPayload(data as Record<string, unknown>)) {
    fcmTrace('applyIncomingChatFromFcm SKIP (not an incoming-chat payload)');
    return false;
  }

  const roomId = String(data.roomId ?? '').trim();
  const from = String(
    data.senderId ??
      data.from ??
      data.userId ??
      data.customerId ??
      data.mobile ??
      '',
  ).trim();
  if (!roomId || !from) {
    fcmTrace(
      'applyIncomingChatFromFcm SKIP missing roomId or senderId/from',
    );
    return false;
  }

  const customerName =
    String(data.customerName ?? data.userName ?? data.senderName ?? '').trim() ||
    'Unknown User';

  const profileImage = String(
    data.customerImage ?? data.profileImage ?? data.senderImage ?? '',
  ).trim();

  const item: ChatRequestItem = {
    roomId,
    senderId: from,
    from,
    senderName: customerName,
    senderImage: profileImage || null,
    message: data.message ? String(data.message) : undefined,
    kundliUrl: data.kundliUrl ? String(data.kundliUrl) : undefined,
    userData: {
      fullName: customerName,
      profileImage: profileImage || undefined,
    },
  };

  const balanceRaw = data.userBalance ?? data.balance;
  if (balanceRaw !== undefined && balanceRaw !== '') {
    const n = Number(balanceRaw);
    if (!Number.isNaN(n)) {
      item.balance = { balance: n };
    }
  }

  const priceRaw = data.astroPrice ?? data.price;
  if (priceRaw !== undefined && priceRaw !== '') {
    const n = Number(priceRaw);
    if (!Number.isNaN(n)) {
      item.astroData = { price: n };
    }
  }

  const subtitleRaw = data.subtitle ?? data.roleLabel;
  if (subtitleRaw !== undefined && String(subtitleRaw).trim()) {
    item.subtitle = String(subtitleRaw).trim();
  }

  dispatch(prependChatRequest(item));
  fcmTrace('applyIncomingChatFromFcm OK prependChatRequest roomId=', roomId);
  return true;
}

/**
 * Parses FCM data into the same params used for `IncomingChatRequest` / overlay.
 * Returns `null` if this message is not an incoming chat request.
 */
/** Same parsing as {@link getIncomingChatParamsFromRemoteMessage} for plain `data` (e.g. Notifee `notification.data`). */
export type IncomingChatLaunchConsume = {
  params: OrderStackParamList['IncomingChatRequest'] | null;
  decision?: 'accept' | 'reject';
};

export function parseIncomingChatLaunchRaw(
  flat: Record<string, string>,
): IncomingChatLaunchConsume {
  const decisionRaw = flat.incomingChatDecision?.trim().toLowerCase();
  const decision =
    decisionRaw === 'accept' || decisionRaw === 'reject' ? decisionRaw : undefined;
  const data = { ...flat };
  delete data.incomingChatDecision;
  const params = getIncomingChatParamsFromRemoteMessage({
    data,
  } as FirebaseMessagingTypes.RemoteMessage);
  return { params, decision };
}

export function getIncomingChatParamsFromData(
  data: FirebaseMessagingTypes.RemoteMessage['data'],
): OrderStackParamList['IncomingChatRequest'] | null {
  if (!data) {
    return null;
  }
  return getIncomingChatParamsFromRemoteMessage({
    data,
  } as FirebaseMessagingTypes.RemoteMessage);
}

/** Normalizes FCM / Notifee payload values to the string map Firebase uses. */
export function flattenNotificationData(
  raw: Record<string, string | number | boolean | object | undefined> | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw) {
    return out;
  }
  for (const [k, v] of Object.entries(raw)) {
    if (v === undefined || v === null) {
      continue;
    }
    if (typeof v === 'string') {
      out[k] = v;
    } else if (typeof v === 'number' || typeof v === 'boolean') {
      out[k] = String(v);
    } else {
      out[k] = JSON.stringify(v);
    }
  }
  return out;
}

/**
 * Single entry when user opens the app from a notification (FCM or Notifee):
 * runs {@link handleIncomingFcm}, then returns overlay params if this was an incoming chat.
 */
export function handleIncomingChatNotificationOpen(
  dispatch: AppDispatch,
  message: FirebaseMessagingTypes.RemoteMessage,
  canEnterMainApp: boolean,
): OrderStackParamList['IncomingChatRequest'] | null {
  handleIncomingFcm(dispatch, message, canEnterMainApp);
  if (!canEnterMainApp) {
    return null;
  }
  return getIncomingChatParamsFromRemoteMessage(message);
}

export function getIncomingChatParamsFromRemoteMessage(
  remoteMessage: FirebaseMessagingTypes.RemoteMessage,
): OrderStackParamList['IncomingChatRequest'] | null {
  const data = remoteMessage.data ?? {};
  if (!isIncomingChatPayload(data as Record<string, unknown>)) {
    return null;
  }

  const roomId = String(data.roomId ?? '').trim();
  const from = String(
    data.senderId ??
      data.from ??
      data.userId ??
      data.customerId ??
      data.mobile ??
      '',
  ).trim();
  if (!roomId || !from) {
    return null;
  }

  const customerName =
    String(data.customerName ?? data.userName ?? data.senderName ?? '').trim() ||
    'Unknown User';

  const notificationTitle = String(
    remoteMessage.notification?.title ?? data.title ?? data.notificationTitle ?? '',
  ).trim();
  const notificationBody = String(
    remoteMessage.notification?.body ?? data.body ?? data.notificationBody ?? '',
  ).trim();

  const profileImage = String(
    data.customerImage ?? data.profileImage ?? data.senderImage ?? '',
  ).trim();

  const kundliUrl = data.kundliUrl ? String(data.kundliUrl).trim() : undefined;
  const subtitleRaw = data.subtitle ?? data.roleLabel;
  const subtitle =
    subtitleRaw !== undefined && String(subtitleRaw).trim()
      ? String(subtitleRaw).trim()
      : undefined;

  let kundaliPayload: GenerateKundaliPayload | undefined =
    kundliUrl !== undefined ? parseKundliUrlToPayload(kundliUrl) : undefined;

  const rawKundali = data.kundaliPayload;
  if (!kundaliPayload && typeof rawKundali === 'string' && rawKundali.trim()) {
    try {
      kundaliPayload = JSON.parse(rawKundali) as GenerateKundaliPayload;
    } catch {
      /* ignore */
    }
  }

  let userBalance: number | undefined;
  const balanceRaw = data.userBalance ?? data.balance;
  if (balanceRaw !== undefined && balanceRaw !== '') {
    const n = Number(balanceRaw);
    if (!Number.isNaN(n)) {
      userBalance = n;
    }
  }

  let astroPrice: number | undefined;
  const priceRaw = data.astroPrice ?? data.price;
  if (priceRaw !== undefined && priceRaw !== '') {
    const n = Number(priceRaw);
    if (!Number.isNaN(n)) {
      astroPrice = n;
    }
  }

  return {
    roomId,
    from,
    customerName,
    customerImage: profileImage || null,
    notificationTitle: notificationTitle || undefined,
    notificationBody: notificationBody || undefined,
    message: data.message ? String(data.message) : undefined,
    subtitle,
    kundliUrl,
    kundaliPayload,
    userBalance,
    astroPrice,
  };
}

function isWaitlistUpdatePayload(data: Record<string, string>): boolean {
  const typeRaw = String(data.type ?? '').trim().toLowerCase();
  const eventRaw = String(data.event ?? '').trim().toLowerCase();
  const navigateTo = String(data.navigateTo ?? '').toLowerCase();
  return (
    typeRaw === 'waitlist_update' ||
    eventRaw === 'waitlist-updated' ||
    navigateTo.includes('waitlist')
  );
}

const MAX_NAV_RETRIES = 40;

/**
 * Opens Order → Waitlist when backend sends waitlist_update (even if roomId/senderId are empty).
 * Call only when user is allowed in main app (logged-in astrologer).
 */
export function tryOpenWaitlistFromFcmData(
  remoteMessage: FirebaseMessagingTypes.RemoteMessage,
): void {
  const data = remoteMessage.data ?? {};
  if (!isWaitlistUpdatePayload(data as Record<string, string>)) {
    return;
  }

  fcmTrace(
    'tryOpenWaitlistFromFcmData start messageId=',
    remoteMessage.messageId ?? '(none)',
  );
  let attempts = 0;
  const tryNav = () => {
    attempts += 1;
    if (attempts > MAX_NAV_RETRIES) {
      fcmTraceError(
        'tryOpenWaitlistFromFcmData ABORT navigationRef never became ready',
      );
      return;
    }
    if (!navigationRef.isReady()) {
      fcmTrace(
        'tryOpenWaitlistFromFcmData wait navigationRef attempt',
        attempts,
        '/',
        MAX_NAV_RETRIES,
      );
      setTimeout(tryNav, 120);
      return;
    }
    navigationRef.navigate('Order', {
      screen: 'OrderList',
      params: { initialTab: 'Waitlist' },
    });
    fcmTrace('tryOpenWaitlistFromFcmData NAVIGATE Order → Waitlist OK');
  };
  tryNav();
}

/**
 * Single entry for FCM: incoming chat (room + sender) OR waitlist redirect.
 */
export function handleIncomingFcm(
  dispatch: AppDispatch,
  remoteMessage: FirebaseMessagingTypes.RemoteMessage,
  canEnterMainApp: boolean,
): void {
  fcmTrace(
    'handleIncomingFcm canEnterMainApp=',
    canEnterMainApp,
    'messageId=',
    remoteMessage.messageId ?? '(none)',
  );
  if (applyIncomingChatFromFcm(dispatch, remoteMessage)) {
    return;
  }
  const data = remoteMessage.data ?? {};
  if (!isWaitlistUpdatePayload(data as Record<string, string>)) {
    fcmTrace(
      'handleIncomingFcm no waitlist payload — raw data keys:',
      data ? Object.keys(data).join(',') : '(none)',
    );
    return;
  }
  if (!canEnterMainApp) {
    fcmTrace(
      'handleIncomingFcm queue waitlist open until login (pendingWaitlistMessage set)',
    );
    pendingWaitlistMessage = remoteMessage;
    return;
  }
  tryOpenWaitlistFromFcmData(remoteMessage);
}

/** Call when `canEnterMainApp` becomes true (e.g. after OTP) to open Waitlist from a tap that arrived earlier. */
export function flushPendingWaitlistFcmNavigation(canEnterMainApp: boolean): void {
  if (!canEnterMainApp || !pendingWaitlistMessage) {
    return;
  }
  fcmTrace('flushPendingWaitlistFcmNavigation running deferred waitlist open');
  const msg = pendingWaitlistMessage;
  pendingWaitlistMessage = null;
  tryOpenWaitlistFromFcmData(msg);
}
