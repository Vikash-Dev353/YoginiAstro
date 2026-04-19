import { io, type Socket } from "socket.io-client";

/**
 * Realtime / Socket.IO base only. REST API uses `src/services/api/client.ts` (`BASE_URL`).
 * Web env equivalent: `VITE_API_URL="https://meanmaestro.space/api/"`.
 */
export const SOCKET_BASE_URL = "https://meanmaestro.space/api/";

/**
 * Socket.IO client expects an origin plus a `path` (default `/socket.io`).
 * With base `https://meanmaestro.space/api/`, the engine path is `/api/socket.io`.
 */
function getIoUrlAndPath(): { url: string; path: string } {
  const u = new URL(SOCKET_BASE_URL);
  const prefix = u.pathname.replace(/\/$/, "");
  return {
    url: `${u.protocol}//${u.host}`,
    path: prefix ? `${prefix}/socket.io` : "/socket.io",
  };
}

/** Create a Socket.IO client wired to {@link SOCKET_BASE_URL}. */
export function createSocketClient(
  options?: Parameters<typeof io>[1]
): Socket {
  const { url, path } = getIoUrlAndPath();
  return io(url, {
    path,
    transports: ["websocket"],
    ...options,
  });
}
