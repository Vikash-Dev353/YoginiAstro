import type { Socket } from "socket.io-client";

import { createSocketClient } from "./socketClient";

type ConnectErrorExtras = Error & {
  description?: string;
  context?: unknown;
  type?: string;
};

const DEBUG = __DEV__;

function debugLog(...args: unknown[]) {
  if (DEBUG) {
    console.log("[Socket]1", ...args);
  }
}

/** Last token used for the active (or connecting) client — avoids duplicate handshakes. */
let activeToken: string | null = null;

/** Single app-wide Socket.IO instance; null when logged out or not yet created. */
let socket: Socket | null = null;

function wireLifecycleLogging(client: Socket) {
  client.on("connect", () => {
    debugLog("connected", client.id);
  });
  client.on("disconnect", (reason) => {
    debugLog("disconnected", reason);
  });
  client.on("connect_error", (err: ConnectErrorExtras) => {
    debugLog("connect_error", err.message, {
      description: err.description,
      type: err.type,
      context: err.context,
    });
  });
}

function destroyClient() {
  if (!socket) {
    activeToken = null;
    return;
  }
  socket.disconnect();
  socket = null;
  activeToken = null;
}

/**
 * Keeps the Socket.IO client aligned with the user session.
 *
 * - Call with a JWT when the user is logged into the main app **and** the app is
 *   in the foreground (`AppState` `active`); `RootNavigator` wires this.
 * - Call with `null` on logout, background, or any time the socket should drop.
 *
 * Safe to call repeatedly with the same token (no duplicate connections).
 */
export function syncSocketWithSession(params: {
  authToken: string | null;
}): void {
  const { authToken } = params;

  if (!authToken) {
    destroyClient();
    return;
  }

  if (socket && activeToken === authToken) {
    return;
  }

  destroyClient();
  activeToken = authToken;

  socket = createSocketClient({
    auth: {
      /** Handshake payload — align field names with the chat backend. */
      token: authToken,
    },
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  wireLifecycleLogging(socket);
}

/** Returns the live socket, or `null` if not logged in / not connected yet. */
export function getSocket(): Socket | null {
  return socket;
}

/** Force-close the socket (e.g. explicit logout handler). Same as `syncSocketWithSession({ authToken: null })`. */
export function disconnectSocket(): void {
  destroyClient();
}
