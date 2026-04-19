/**
 * Real-time chat (Socket.IO) — use {@link syncSocketWithSession} from app shell,
 * {@link getSocket} inside screens/hooks to listen or emit.
 */

export {
  disconnectSocket,
  getSocket,
  syncSocketWithSession,
} from "./socketService";

export {
  SOCKET_IO_ENGINE_URL,
  SOCKET_IO_PATH,
  SOCKET_SERVER_URL,
  createSocketClient,
} from "./socketClient";
