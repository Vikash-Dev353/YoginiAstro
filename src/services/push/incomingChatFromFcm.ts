import type { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import type { AppDispatch } from '../../store';
import type { ChatRequestItem } from '../../store/slices/socketSlice';
import { prependChatRequest } from '../../store/slices/socketSlice';
import { navigationRef } from '../../navigation/navigationRef';
import { fcmTrace, fcmTraceError } from './fcmDebug';

/** If user tapped a waitlist notification before login, open Waitlist after session is ready. */
let pendingWaitlistMessage: FirebaseMessagingTypes.RemoteMessage | null = null;

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
  fcmTrace(
    'applyIncomingChatFromFcm messageId=',
    remoteMessage.messageId ?? '(none)',
    'type=',
    String(data.type ?? ''),
    'roomId=',
    String(data.roomId ?? ''),
    'senderId=',
    String(data.senderId ?? data.from ?? ''),
  );
  const typeRaw = String(data.type ?? '').trim().toLowerCase();
  if (typeRaw && typeRaw !== 'incoming_chat') {
    fcmTrace('applyIncomingChatFromFcm SKIP (not incoming_chat type)');
    return false;
  }

  const roomId = String(data.roomId ?? '').trim();
  const from = String(data.senderId ?? data.from ?? '').trim();
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
