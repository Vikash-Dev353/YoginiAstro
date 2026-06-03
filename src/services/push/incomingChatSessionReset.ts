import { fcmTrace } from './fcmDebug';
import { clearIncomingChatAcceptDedupeState } from './incomingChatAcceptFlow';
import {
  clearIncomingRoomHandled,
  lastShownIncomingOverlayRoomRef,
} from './foregroundIncomingOverlay';
import { clearIncomingChatNavigationDedupeState } from './incomingChatNavigation';

/**
 * After chat ends or astrologer leaves ConsultationChat — allow the next
 * incoming request for the same roomId (repeat tests / same customer).
 */
export function resetIncomingChatSession(roomId: string): void {
  const id = roomId.trim();
  if (!id) {
    return;
  }
  clearIncomingRoomHandled(id);
  clearIncomingChatAcceptDedupeState(id);
  clearIncomingChatNavigationDedupeState(id);
  if (lastShownIncomingOverlayRoomRef.current === id) {
    lastShownIncomingOverlayRoomRef.current = null;
  }
  fcmTrace('resetIncomingChatSession: cleared dedupe for room=', id);
}
