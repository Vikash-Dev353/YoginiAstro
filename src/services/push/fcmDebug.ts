/**
 * Lightweight tracing for the incoming-chat / FCM pipeline.
 *
 * - In dev (__DEV__) we always log to console + keep a ring buffer of the last
 *   N entries so an on-device debug panel can read them when Metro isn't
 *   reachable (locked screen, killed-state launches, etc.).
 * - In production the calls become near-no-ops.
 *
 * Flip `FCM_TRACE_ENABLED` to false once you no longer want any console noise.
 */

export const FCM_TRACE_ENABLED = true;

export type FcmTraceLevel = 'log' | 'warn';

export type FcmTraceEntry = {
  id: number;
  ts: number;
  level: FcmTraceLevel;
  message: string;
};

const RING_SIZE = 200;
const buffer: FcmTraceEntry[] = [];
let nextId = 1;

type Listener = (entries: ReadonlyArray<FcmTraceEntry>) => void;
const listeners = new Set<Listener>();

function safeStringify(value: unknown): string {
  if (value == null) return String(value);
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (value instanceof Error) {
    return `${value.name}: ${value.message}`;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return Object.prototype.toString.call(value);
  }
}

function pushEntry(level: FcmTraceLevel, parts: unknown[]): void {
  const message = parts.map(safeStringify).join(' ');
  const entry: FcmTraceEntry = {
    id: nextId++,
    ts: Date.now(),
    level,
    message,
  };
  buffer.push(entry);
  if (buffer.length > RING_SIZE) {
    buffer.splice(0, buffer.length - RING_SIZE);
  }
  if (listeners.size > 0) {
    /** Snapshot so listeners can hold the array safely. */
    const snapshot = buffer.slice();
    listeners.forEach(l => {
      try {
        l(snapshot);
      } catch {
        /* noop */
      }
    });
  }
}

export function fcmTrace(...args: unknown[]): void {
  if (!FCM_TRACE_ENABLED) {
    return;
  }
  console.log('[YoginiFCM]', ...args);
  pushEntry('log', args);
}

export function fcmTraceError(...args: unknown[]): void {
  if (!FCM_TRACE_ENABLED) {
    return;
  }
  console.warn('[YoginiFCM]', ...args);
  pushEntry('warn', args);
}

export function getFcmTraceEntries(): ReadonlyArray<FcmTraceEntry> {
  return buffer.slice();
}

export function subscribeFcmTrace(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function clearFcmTrace(): void {
  buffer.length = 0;
  if (listeners.size > 0) {
    listeners.forEach(l => {
      try {
        l([]);
      } catch {
        /* noop */
      }
    });
  }
}
