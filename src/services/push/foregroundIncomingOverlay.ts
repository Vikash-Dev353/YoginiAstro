/**
 * When the custom full-screen incoming-chat overlay is shown (foreground FCM),
 * {@link MainTabNavigator} must not auto-push `IncomingChatRequest` for the same event.
 */
export const foregroundIncomingOverlayActiveRef = { current: false };
