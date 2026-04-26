import { io, type Socket } from "socket.io-client";

const LOG_CONNECTION_DETAILS = __DEV__;

function maskSecret(value: string): string {
  const n = value.length;
  if (n <= 12) {
    return `*** (len=${n})`;
  }
  return `${value.slice(0, 6)}…${value.slice(-4)} (len=${n})`;
}

function sanitizeAuthForLog(auth: unknown): unknown {
  if (!auth || typeof auth !== "object") {
    return auth;
  }
  const out: Record<string, unknown> = { ...(auth as Record<string, unknown>) };
  for (const key of Object.keys(out)) {
    const lower = key.toLowerCase();
    const v = out[key];
    if (typeof v === "string" && (lower.includes("token") || lower === "authorization")) {
      out[key] = maskSecret(v);
    }
  }
  return out;
}

/** Logs everything we send into `io()` (secrets masked). */
export function logSocketConnectionRequest(params: {
  namespaceUrl: string;
  enginePath: string;
  mergedOptions: Record<string, unknown>;
}): void {
  if (!LOG_CONNECTION_DETAILS) {
    return;
  }

  let origin: string;
  let namespacePath: string;
  try {
    const u = new URL(params.namespaceUrl);
    origin = `${u.protocol}//${u.host}`;
    namespacePath = u.pathname || "/";
  } catch {
    origin = "(invalid namespaceUrl)";
    namespacePath = "?";
  }

  const engineBase = `${origin}${params.enginePath}`;
  const samplePollingGet = `${engineBase}/?EIO=4&transport=polling&t=<ts>`;

  const opts = { ...params.mergedOptions };
  if (opts.auth !== undefined) {
    opts.auth = sanitizeAuthForLog(opts.auth);
  }

  console.log("[Socket] connection request1", {
    at: new Date().toISOString(),
    namespaceUrl: params.namespaceUrl,
    namespacePath,
    enginePath: params.enginePath,
    origin,
    /** First HTTP(s) requests use this path prefix (Engine.IO). */
    engineHttpBase: engineBase,
    samplePollingUrl: samplePollingGet,
    mergedClientOptions: opts,
  });
}

// ---------------------------------------------------------------------------
// Endpoint (chat — separate from REST `apiClient` base URL)
// ---------------------------------------------------------------------------

/**
 * Socket origin URL. Keep this at host root so client uses default namespace `/`.
 * Custom Engine.IO route is configured via {@link SOCKET_IO_PATH}.
 *
 * @see https://socket.io/docs/v4/client-options/#path
 */
export const SOCKET_SERVER_URL = "https://yoginiastro.com/";

/**
 * Engine.IO path on the **origin** host (default is `/socket.io`).
 * Must match where the server mounts Socket.IO — not the same as namespace.
 */
export const SOCKET_IO_PATH = "/dev/chat/socket.io";
export const SOCKET_IO_FALLBACK_PATH = "/dev/chat/socket.io";

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
  const requestedPath = (
    options as (Record<string, unknown> & { path?: string }) | undefined
  )?.path;
  const mergedOptions: Record<string, unknown> = {
    path: requestedPath || SOCKET_IO_PATH,
    /**
     * Polling first, then upgrade — avoids generic "websocket error" on many RN
     * devices/networks where raw WebSocket fails but HTTP long-polling works.
     * Override via `options.transports` if the server is websocket-only.
     */
    transports: ["websocket", "polling"],
    upgrade: true,
    timeout: 20_000,
    ...(options as Record<string, unknown> | undefined),
  };

  logSocketConnectionRequest({
    namespaceUrl: SOCKET_SERVER_URL,
    enginePath: String(mergedOptions.path),
    mergedOptions: mergedOptions,
  });

  return io(SOCKET_SERVER_URL, mergedOptions as Parameters<typeof io>[1]);
}
