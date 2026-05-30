import { store } from '../../store';
import {
  bootstrapAuth,
  decodeAstroIdFromToken,
} from '../../store/slices/authSlice';
import { syncSocketSession } from '../../store/slices/socketSlice';
import { getSocket } from '../socket/socketService';
import { fcmTrace, fcmTraceError } from './fcmDebug';

export function canEnterMainAppFromAuthState(): boolean {
  const { auth } = store.getState();
  return (
    auth.isAuthenticated &&
    !auth.pendingProfileCompletion &&
    !auth.pendingAdminApproval
  );
}

/** Restore JWT + socket before Accept/Reject from notification (headless / background). */
export async function ensureSessionForIncomingChatDecision(): Promise<boolean> {
  if (!store.getState().auth.token) {
    try {
      await store.dispatch(bootstrapAuth()).unwrap();
    } catch (error) {
      fcmTraceError('ensureSession: bootstrapAuth failed', error);
      return false;
    }
  }

  if (!canEnterMainAppFromAuthState()) {
    fcmTrace('ensureSession: not allowed in main app');
    return false;
  }

  const { token, astroId: storedAstroId } = store.getState().auth;
  if (!token) {
    return false;
  }

  const astroId = storedAstroId?.trim() || decodeAstroIdFromToken(token) || '';
  store.dispatch(
    syncSocketSession({
      authToken: token,
      astroId,
      reason: 'incoming-chat-decision',
    }),
  );

  let socket = getSocket();
  if (socket?.connected) {
    if (astroId) {
      socket.emit('register', { userId: astroId });
      fcmTrace('ensureSession: re-register on connected socket astroId=', astroId);
    }
    return true;
  }

  try {
    socket?.connect();
  } catch {
    /* mid-teardown */
  }

  const maxAttempts = 50;
  const delayMs = 150;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    socket = getSocket();
    if (socket?.connected) {
      fcmTrace('ensureSession: socket ready attempt=', attempt);
      return true;
    }
    await new Promise<void>(resolve => {
      setTimeout(resolve, delayMs);
    });
  }

  fcmTraceError('ensureSession: socket not connected');
  return false;
}
