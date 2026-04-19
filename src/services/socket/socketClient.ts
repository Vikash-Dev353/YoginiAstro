import { io, type Socket } from "socket.io-client";

// ---------------------------------------------------------------------------
// Endpoint (chat — separate from REST `apiClient` base URL)
// ---------------------------------------------------------------------------

/**
 * Server URL whose **pathname** becomes the Socket.IO **namespace** (e.g. `/api/dev/chat`).
 * HTTP polling then hits the host at {@link SOCKET_IO_PATH}, not under this pathname.
 *
 * @see https://socket.io/docs/v4/client-api/#with-custom-path
 */
export const SOCKET_SERVER_URL = "https://meanmaestro.space/api/dev/chat";

/**
 * Engine.IO path on the **origin** host (default is `/socket.io`).
 * Must match where the server mounts Socket.IO — not the same as namespace.
 */
export const SOCKET_IO_PATH = "/socket.io";

/** @deprecated Use {@link SOCKET_SERVER_URL} — old name mixed up namespace vs engine path. */
export const SOCKET_IO_ENGINE_URL = SOCKET_SERVER_URL;

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Low-level factory: connects to {@link SOCKET_SERVER_URL} with {@link SOCKET_IO_PATH}.
 * Prefer {@link syncSocketWithSession} in `socketService.ts` for app usage.
 */
export function createSocketClient(
  options?: Parameters<typeof io>[1]
): Socket {
  return io(SOCKET_SERVER_URL, {
    path: SOCKET_IO_PATH,
    /**
     * Polling first, then upgrade — avoids generic "websocket error" on many RN
     * devices/networks where raw WebSocket fails but HTTP long-polling works.
     * Override via `options.transports` if the server is websocket-only.
     */
    transports: ["polling", "websocket"],
    upgrade: true,
    timeout: 20_000,
    ...options,
  });
}
