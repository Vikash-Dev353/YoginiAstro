/**
 * When the custom full-screen incoming-chat overlay is shown (foreground FCM),
 * {@link MainTabNavigator} must not auto-push `IncomingChatRequest` for the same event.
 */
export const foregroundIncomingOverlayActiveRef = { current: false };

/** Rooms already accepted/rejected — prevents overlay loop after socket re-emits. */
const handledIncomingRoomIds = new Set<string>();

export function markIncomingRoomHandled(roomId: string): void {
  const id = roomId?.trim();
  if (id) {
    handledIncomingRoomIds.add(id);
  }
}

export function isIncomingRoomHandled(roomId: string): boolean {
  const id = roomId?.trim();
  return id ? handledIncomingRoomIds.has(id) : false;
}
