import type { IncomingChatLaunchConsume } from './incomingChatFromFcm';
import { fcmTrace } from './fcmDebug';
import {
  isIncomingChatAcceptInFlight,
  wasNotificationAcceptHandled,
} from './incomingChatAcceptFlow';
import { isIncomingRoomHandled } from './foregroundIncomingOverlay';
import { isConsultationChatNavigationDone } from './incomingChatNavigation';
import {
  consumeIncomingChatLaunchAction,
  peekIncomingChatLaunchAction,
} from './incomingChatNative';
import {
  peekPendingIncomingChat,
  takePendingIncomingChat,
} from './pendingIncomingChat';

/** Non-destructive read — notification tap can show overlay after app opens. */
export async function peekIncomingChatLaunch(): Promise<IncomingChatLaunchConsume> {
  const fromIntent = await peekIncomingChatLaunchAction();
  if (fromIntent.params) {
    return fromIntent;
  }

  const pending = await peekPendingIncomingChat();
  if (pending) {
    return { params: pending };
  }

  return { params: null };
}

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
      const launch = await peekIncomingChatLaunch();
      if (launch.params) {
        const roomId = launch.params.roomId.trim();
        if (
          isIncomingRoomHandled(roomId) ||
          isIncomingChatAcceptInFlight(roomId) ||
          isConsultationChatNavigationDone(roomId) ||
          (wasNotificationAcceptHandled(roomId) && launch.decision !== 'accept')
        ) {
          fcmTrace('incomingChatOverlayProbe: skip replay room=', roomId);
          return;
        }
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
