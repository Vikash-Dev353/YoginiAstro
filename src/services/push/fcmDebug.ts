/**
 * Flip to `false` after debugging push delivery on device.
 */
export const FCM_TRACE_ENABLED = true;

export function fcmTrace(...args: unknown[]): void {
  if (!FCM_TRACE_ENABLED) {
    return;
  }
  console.log('[YoginiFCM]', ...args);
}

export function fcmTraceError(...args: unknown[]): void {
  if (!FCM_TRACE_ENABLED) {
    return;
  }
  console.warn('[YoginiFCM]', ...args);
}
