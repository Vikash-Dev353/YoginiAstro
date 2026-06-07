import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { AppDispatch, RootState } from "../index";
import { decodeAstroIdFromToken } from "./authSlice";
import { getSocket, syncSocketWithSession } from "../../services/socket";
import { coerceBillingNumber } from "../../utils/chatBilling";

const SOCKET_DEBUG = __DEV__;

function socketDebugLog(message: string, payload?: Record<string, unknown>) {
  if (!SOCKET_DEBUG) return;
  console.log("[socket][debug]", message, payload ?? {});
}

function maskToken(token: string | null): string {
  if (!token) return "(empty)";
  if (token.length <= 16) return `*** (len=${token.length})`;
  return `${token.slice(0, 8)}...${token.slice(-6)} (len=${token.length})`;
}

export type SocketMessage = {
  sender?: "astrologer" | "user" | string;
  message?: string;
  roomId?: string;
  timestamp?: string;
  isFile?: boolean;
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
  [key: string]: unknown;
};

export type ChatRequestItem = {
  senderId?: string;
  from?: string;
  roomId?: string;
  senderName?: string;
  senderImage?: string | null;
  message?: string;
  requestedAt?: string | number;
  timestamp?: string | number;
  kundliUrl?: string;
  userData?: {
    fullName?: string;
    firstName?: string;
    lastName?: string;
    profileImage?: string;
  };
  balance?: { balance?: number };
  astroData?: { price?: number };
  /** Shown under customer name on incoming chat screen */
  subtitle?: string;
  [key: string]: unknown;
};

type SocketState = {
  connected: boolean;
  socketId: string;
  messages: SocketMessage[];
  roomReady: boolean;
  roomData: Record<string, unknown> | null;
  chatStarted: boolean;
  astroChatData: Record<string, unknown> | null;
  chatDisconnect: boolean;
  /** Increments on every peer-left so UI can react to repeat disconnects. */
  peerLeftSeq: number;
  chatRequests: ChatRequestItem[];
  timerStart: boolean;
  waitlistCount: number;
  typingUser: Record<string, unknown> | null;
  isTyping: boolean;
  hasSocketError: boolean;
  userFree: { status: boolean; userId?: string } | null;
};

const initialState: SocketState = {
  connected: false,
  socketId: "",
  messages: [],
  roomReady: false,
  roomData: null,
  chatStarted: false,
  astroChatData: null,
  chatDisconnect: false,
  peerLeftSeq: 0,
  chatRequests: [],
  timerStart: false,
  waitlistCount: 0,
  typingUser: null,
  isTyping: false,
  hasSocketError: false,
  userFree: null,
};

const socketSlice = createSlice({
  name: "socket",
  initialState,
  reducers: {
    socketConnected: (state, action: PayloadAction<string | undefined>) => {
      state.connected = true;
      state.hasSocketError = false;
      state.socketId = action.payload ?? "";
    },
    socketDisconnected: (state) => {
      state.connected = false;
      state.socketId = "";
    },
    messageReceived: (state, action: PayloadAction<SocketMessage>) => {
      state.messages.push(action.payload);
    },
    messageSent: (state, action: PayloadAction<SocketMessage>) => {
      state.messages.push(action.payload);
    },
    setChatHistory: (state, action: PayloadAction<SocketMessage[]>) => {
      state.messages = action.payload || [];
    },
    roomReadyEvent: (state, action: PayloadAction<Record<string, unknown>>) => {
      state.roomReady = true;
      state.roomData = action.payload;
    },
    resetRoom: (state) => {
      state.roomReady = false;
      state.roomData = null;
      state.messages = [];
      state.chatStarted = false;
      state.userFree = null;
      state.timerStart = false;
      state.chatDisconnect = false;
    },
    setChatStarted: (state, action: PayloadAction<boolean>) => {
      state.chatStarted = action.payload;
    },
    setAstroChatData: (state, action: PayloadAction<Record<string, unknown> | null>) => {
      state.astroChatData = action.payload;
    },
    setChatRequests: (state, action: PayloadAction<ChatRequestItem[] | unknown>) => {
      state.chatRequests = Array.isArray(action.payload)
        ? (action.payload as ChatRequestItem[])
        : [];
    },
    setChatDisconnect: (state, action: PayloadAction<boolean>) => {
      state.chatDisconnect = action.payload;
    },
    peerLeftEvent: (state) => {
      state.peerLeftSeq += 1;
      state.chatDisconnect = true;
    },
    setTimerStart: (state, action: PayloadAction<boolean>) => {
      state.timerStart = action.payload;
    },
    removeChatRequest: (state, action: PayloadAction<string>) => {
      const chatRequests = Array.isArray(state.chatRequests)
        ? state.chatRequests
        : [];
      state.chatRequests = chatRequests.filter(
        (r) => r.roomId !== action.payload
      );
    },
    prependChatRequest: (state, action: PayloadAction<ChatRequestItem>) => {
      const incoming = action.payload;
      if (!incoming?.roomId) {
        return;
      }
      const list = Array.isArray(state.chatRequests)
        ? [...state.chatRequests]
        : [];
      const filtered = list.filter((r) => r.roomId !== incoming.roomId);
      state.chatRequests = [incoming, ...filtered];
    },
    setWaitlistCount: (state, action: PayloadAction<number>) => {
      state.waitlistCount = action.payload;
    },
    setTyping: (state, action: PayloadAction<Record<string, unknown>>) => {
      state.typingUser = action.payload;
      state.isTyping = true;
    },
    clearTyping: (state) => {
      state.typingUser = null;
      state.isTyping = false;
    },
    setSocketError: (state, action: PayloadAction<boolean>) => {
      state.hasSocketError = action.payload;
    },
    setUserFree: (
      state,
      action: PayloadAction<{ status: boolean; userId?: string } | null>
    ) => {
      state.userFree = action.payload;
    },
  },
});

const {
  socketConnected,
  socketDisconnected,
  messageReceived,
  setChatHistory,
  roomReadyEvent,
  setSocketError,
  setChatRequests,
  removeChatRequest,
  setChatDisconnect,
  peerLeftEvent,
  setTimerStart,
  setWaitlistCount,
  setTyping,
  clearTyping,
  setUserFree,
} = socketSlice.actions;

let wiredSocket: ReturnType<typeof getSocket> = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
    socketDebugLog("heartbeat stopped");
  }
}

function startHeartbeat() {
  stopHeartbeat();
  heartbeatTimer = setInterval(() => {
    const socket = getSocket();
    if (!socket?.connected) {
      return;
    }
    socket.emit("heartbeat");
    socketDebugLog("heartbeat emitted", {
      socketId: socket.id ?? null,
    });
  }, 5000);
  socketDebugLog("heartbeat started", { intervalMs: 5000 });
}

function normalizeHistoryPayload(payload: unknown): SocketMessage[] {
  if (Array.isArray(payload)) {
    return payload as SocketMessage[];
  }
  if (
    payload &&
    typeof payload === "object" &&
    Array.isArray((payload as { messages?: unknown[] }).messages)
  ) {
    return ((payload as { messages?: unknown[] }).messages || []) as SocketMessage[];
  }
  return [];
}

function normalizeChatRequestsPayload(payload: unknown): ChatRequestItem[] {
  if (Array.isArray(payload)) {
    return payload as ChatRequestItem[];
  }
  if (payload && typeof payload === "object") {
    const direct = payload as { waitingList?: unknown; requests?: unknown };
    if (Array.isArray(direct.waitingList)) {
      return direct.waitingList as ChatRequestItem[];
    }
    if (Array.isArray(direct.requests)) {
      return direct.requests as ChatRequestItem[];
    }

    const nested = payload as {
      data?: { waitingList?: unknown; requests?: unknown };
    };
    if (Array.isArray(nested.data?.waitingList)) {
      return nested.data.waitingList as ChatRequestItem[];
    }
    if (Array.isArray(nested.data?.requests)) {
      return nested.data.requests as ChatRequestItem[];
    }
  }
  return [];
}

function mergeBillingFromSocketPayload(
  dispatch: AppDispatch,
  getState: () => RootState,
  payload: Record<string, unknown> | undefined,
): void {
  if (!payload || typeof payload !== "object") {
    return;
  }
  const nested =
    payload.data && typeof payload.data === "object"
      ? (payload.data as Record<string, unknown>)
      : null;
  const userBalance =
    coerceBillingNumber(payload.userBalance) ??
    coerceBillingNumber(payload.balance) ??
    coerceBillingNumber(nested?.userBalance) ??
    coerceBillingNumber(nested?.balance);
  const astroPrice =
    coerceBillingNumber(payload.astroPrice) ??
    coerceBillingNumber(payload.price) ??
    coerceBillingNumber(payload.astroData) ??
    coerceBillingNumber(nested?.astroPrice) ??
    coerceBillingNumber(nested?.price) ??
    coerceBillingNumber(nested?.astroData);
  const hasBalance = userBalance != null;
  const hasPrice = astroPrice != null;
  if (!hasBalance && !hasPrice) {
    return;
  }
  const prev = getState().socket.astroChatData as Record<string, unknown> | null;
  if (!prev) {
    return;
  }
  dispatch(
    socketSlice.actions.setAstroChatData({
      ...prev,
      ...(hasBalance ? { userBalance } : {}),
      ...(hasPrice ? { astroPrice } : {}),
    }),
  );
}

function payloadSignalsUserAccepted(
  payload: Record<string, unknown> | undefined,
): boolean {
  if (!payload || typeof payload !== "object") {
    return false;
  }
  const nested =
    payload.data && typeof payload.data === "object"
      ? (payload.data as Record<string, unknown>)
      : {};
  const merged = { ...nested, ...payload };
  if (
    merged.userAccepted === true ||
    merged.userJoined === true ||
    merged.bothJoined === true ||
    merged.sessionStarted === true
  ) {
    return true;
  }
  const status = String(merged.status ?? merged.roomStatus ?? "").toLowerCase();
  return status === "active" || status === "started" || status === "live";
}

export const syncSocketSession =
  (params: {
    authToken: string | null;
    astroId?: string | null;
    reason?: string;
  }) =>
  (dispatch: AppDispatch, getState: () => RootState) => {
    const { authToken, astroId, reason } = params;
    socketDebugLog("syncSocketSession called", {
      hasToken: Boolean(authToken),
      tokenPreview: maskToken(authToken),
      astroId: astroId ?? null,
      reason: reason ?? "unspecified",
    });

    syncSocketWithSession({ authToken });
    const socket = getSocket();

    if (!authToken || !socket) {
      socketDebugLog("socket unavailable or token missing; disconnecting", {
        reason: reason ?? "unspecified",
      });
      stopHeartbeat();
      wiredSocket = null;
      dispatch(socketDisconnected());
      return;
    }

    if (wiredSocket === socket) {
      socketDebugLog("socket already wired; skipping listener re-bind", {
        socketId: socket.id ?? null,
      });
      return;
    }

    wiredSocket = socket;
    socketDebugLog("wiring socket listeners", { socketId: socket.id ?? null });

    socket.on("connect", () => {
      dispatch(socketConnected(socket.id));
      startHeartbeat();
      const astro =
        astroId?.trim() ||
        decodeAstroIdFromToken(authToken) ||
        "";
      socketDebugLog("socket connected", {
        socketId: socket.id ?? null,
        astroId: astro || null,
      });
      if (astro) {
        socket.emit("register", { userId: astro });
        socketDebugLog("register event emitted", { userId: astro });
      } else {
        socketDebugLog("register skipped: missing astroId");
      }
    });

    socket.on("disconnect", (reason: string) => {
      dispatch(socketDisconnected());
      stopHeartbeat();
      socketDebugLog("socket disconnected", { reason });
    });

    socket.on("connect_error", (error: { message?: string }) => {
      dispatch(setSocketError(true));
      socketDebugLog("socket connect_error", {
        message: error?.message ?? "unknown error",
      });
    });

    const handleUserAcceptedChat = (
      _eventName: string,
      payload?: Record<string, unknown>,
    ) => {
      if (getState().socket.timerStart) {
        mergeBillingFromSocketPayload(dispatch, getState, payload);
        return;
      }
      mergeBillingFromSocketPayload(dispatch, getState, payload);
      dispatch(setTimerStart(true));
    };

    socket.on("private-message", (msg: SocketMessage) => {
      dispatch(messageReceived(msg));
      if (msg.sender && msg.sender !== "astrologer") {
        handleUserAcceptedChat("private-message", msg as Record<string, unknown>);
      }
    });

    socket.on("room-ready", (data: Record<string, unknown>) => {
      dispatch(roomReadyEvent(data));
      mergeBillingFromSocketPayload(dispatch, getState, data);
      if (payloadSignalsUserAccepted(data)) {
        handleUserAcceptedChat("room-ready", data);
      }
    });

    socket.on("chat-history", (history: unknown) => {
      dispatch(setChatHistory(normalizeHistoryPayload(history)));
    });

    socket.on("chat-requests", (requests: unknown) => {
      const normalizedRequests = normalizeChatRequestsPayload(requests);
      dispatch(setChatRequests(normalizedRequests));

      if (requests && typeof requests === "object") {
        const raw = requests as {
          waitingCount?: number;
          data?: { waitingCount?: number };
        };
        const waitingCount = raw.waitingCount ?? raw.data?.waitingCount;
        if (typeof waitingCount === "number") {
          dispatch(setWaitlistCount(waitingCount));
        }
      }
    });

    socket.on("chat-rejected", ({ roomId }: { roomId?: string }) => {
      if (roomId) {
        dispatch(removeChatRequest(roomId));
      }
    });

    socket.on("peer-left", () => {
      dispatch(peerLeftEvent());
    });

    socket.on("start-timer", (payload?: Record<string, unknown>) => {
      handleUserAcceptedChat("start-timer", payload);
    });
    socket.on("startTimer", (payload?: Record<string, unknown>) => {
      handleUserAcceptedChat("startTimer", payload);
    });
    socket.on("timer-started", (payload?: Record<string, unknown>) => {
      handleUserAcceptedChat("timer-started", payload);
    });
    socket.on("user-accepted", (payload?: Record<string, unknown>) => {
      handleUserAcceptedChat("user-accepted", payload);
    });
    socket.on("user-accepted-chat", (payload?: Record<string, unknown>) => {
      handleUserAcceptedChat("user-accepted-chat", payload);
    });
    socket.on("user-joined", (payload?: Record<string, unknown>) => {
      handleUserAcceptedChat("user-joined", payload);
    });
    socket.on("chat-accepted-by-user", (payload?: Record<string, unknown>) => {
      handleUserAcceptedChat("chat-accepted-by-user", payload);
    });

    socket.on(
      "waitlist-updated",
      (payload: { waitingCount?: number; data?: { waitingCount?: number } }) => {
        const waitingCount = payload?.waitingCount ?? payload?.data?.waitingCount;
        dispatch(setWaitlistCount(Number(waitingCount || 0)));
      }
    );

    socket.on("typing", (data: Record<string, unknown>) => {
      dispatch(setTyping(data));
      const sender = String(data.sender ?? data.userId ?? "");
      if (sender && sender !== "astrologer") {
        handleUserAcceptedChat("typing", data);
      }
    });

    socket.on("stop-typing", () => {
      dispatch(clearTyping());
    });

    socket.on("user-free", (data: { userId?: string }) => {
      dispatch(setUserFree({ status: true, userId: data?.userId }));
    });
  };

export const sendMessage =
  (msg: SocketMessage) => (dispatch: AppDispatch) => {
    const socket = getSocket();
    if (!socket) return;
    socket.emit("private-message", msg);
    dispatch(socketSlice.actions.messageSent(msg));
  };

export const joinRoom = (params: {
  senderName?: string;
  receiverMobile: string;
}) => {
  const socket = getSocket();
  if (!socket) return;
  socket.emit("join-room", {
    senderName: params.senderName ?? "",
    receiverMobile: params.receiverMobile,
  });
};

export const requestChatHistory = (roomId: string) => {
  const socket = getSocket();
  if (!socket || !roomId) return;
  socket.emit("chat-history", { roomId });
};

export const acceptChat =
  (params: { from: string; roomId: string }) => (dispatch: AppDispatch) => {
    const socket = getSocket();
    if (!socket) {
      return;
    }
    const userId = params.from.trim();
    const roomId = params.roomId.trim();
    const payload = { from: userId, userId, roomId };
    socket.emit("accept-chat", payload);
    socketDebugLog("accept-chat emitted", payload);
    requestChatHistory(roomId);
    dispatch(removeChatRequest(roomId));
  };

export const rejectChat = (params: { from: string; roomId: string }) => (dispatch: AppDispatch) => {
  const socket = getSocket();
  if (!socket) return;
  socket.emit("reject-chat", { userId: params.from, roomId: params.roomId });
  dispatch(removeChatRequest(params.roomId));
};

export const leaveRoom = (roomId: string) => {
  const socket = getSocket();
  if (!socket || !roomId) {
    return;
  }
  const id = roomId.trim();
  socket.emit("leave-room", { roomId: id });
  socketDebugLog("leave-room emitted", { roomId: id });
};

export const emitTyping = (roomId: string) => {
  const socket = getSocket();
  if (!socket || !roomId) return;
  socket.emit("typing", { roomId });
};

export const emitStopTyping = (roomId: string) => {
  const socket = getSocket();
  if (!socket || !roomId) return;
  socket.emit("stop-typing", { roomId });
};

export const selectSocketState = (state: RootState) => state.socket;
export const selectMessages = (state: RootState) => state.socket.messages;
export const selectChatRequests = (state: RootState) => state.socket.chatRequests;

export const {
  resetRoom,
  setChatStarted,
  setAstroChatData,
  setChatRequests: setSocketChatRequests,
  setChatDisconnect: setSocketChatDisconnect,
  setTimerStart: setSocketTimerStart,
  setUserFree: setSocketUserFree,
  prependChatRequest,
} = socketSlice.actions;

export const socketReducer = socketSlice.reducer;
