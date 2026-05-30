import type { OrderStackParamList } from '../../navigation/types';

type DisplayFields = Pick<
  OrderStackParamList['IncomingChatRequest'],
  'customerName' | 'notificationTitle' | 'notificationBody' | 'message' | 'subtitle'
> & {
  waitingCount?: string | number;
};

/** Notification / overlay title — always prefers live FCM user name. */
export function resolveIncomingChatTitle(input: DisplayFields): string {
  return (
    input.notificationTitle?.trim() ||
    input.customerName?.trim() ||
    'Incoming chat request'
  );
}

/** Notification / overlay subtitle line from FCM message, waitlist count, etc. */
export function resolveIncomingChatBody(input: DisplayFields): string {
  const explicit =
    input.notificationBody?.trim() ||
    input.message?.trim() ||
    input.subtitle?.trim();
  if (explicit) {
    return explicit;
  }
  const waiting = input.waitingCount;
  if (waiting !== undefined && waiting !== '') {
    const n = Number(waiting);
    if (!Number.isNaN(n) && n > 0) {
      return `Users waiting: ${n}`;
    }
  }
  return 'Wants to chat with you';
}
