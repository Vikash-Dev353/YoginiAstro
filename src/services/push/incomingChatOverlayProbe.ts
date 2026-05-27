import type { IncomingChatLaunchConsume } from './incomingChatFromFcm';
import { fcmTrace } from './fcmDebug';
import { consumeIncomingChatLaunchAction } from './incomingChatNative';
import {
  peekPendingIncomingChat,
  takePendingIncomingChat,
} from './pendingIncomingChat';

export async function resolveIncomingChatLaunch(): Promise<IncomingChatLaunchConsume> {
  const fromIntent = await consumeIncomingChatLaunchAction();
  if (fromIntent.params) {
    return fromIntent;
  }

  const pending = await peekPendingIncomingChat();
  if (!pending) {
    return { params: null };
  }

  await takePendingIncomingChat();
  return { params: pending };
}

type ProbeOptions = {
  maxAttempts?: number;
  intervalMs?: number;
};

/**
 * Cold-start / killed-app: intent extras and AsyncStorage may not be ready on the
 * first frame. Retry until we find a pending incoming-chat payload or accept intent.
 */
export function startIncomingChatOverlayProbe(
  onFound: (launch: IncomingChatLaunchConsume) => void,
  options?: ProbeOptions,
): () => void {
  const maxAttempts = options?.maxAttempts ?? 30;
  const intervalMs = options?.intervalMs ?? 400;
  let cancelled = false;
  let attempts = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const tick = async () => {
    if (cancelled || attempts >= maxAttempts) {
      if (attempts >= maxAttempts) {
        fcmTrace('incomingChatOverlayProbe: gave up after', maxAttempts, 'tries');
      }
      return;
    }
    attempts += 1;

    try {
      const launch = await resolveIncomingChatLaunch();
      if (launch.params) {
        fcmTrace(
          'incomingChatOverlayProbe: found room=',
          launch.params.roomId,
          'decision=',
          launch.decision ?? '(none)',
          'attempt=',
          attempts,
        );
        onFound(launch);
        return;
      }
    } catch (error) {
      fcmTrace('incomingChatOverlayProbe: attempt failed', error);
    }

    timer = setTimeout(() => void tick(), intervalMs);
  };

  void tick();

  return () => {
    cancelled = true;
    if (timer) {
      clearTimeout(timer);
    }
  };
}
