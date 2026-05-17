import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import {
  authApi,
  normalizeSendOtpResponse,
} from '../../services/api/authApi';
import { setAccessToken } from '../../services/api/client';
import { type AuthGateSnapshot, storage } from '../../utils/storage';

export function decodeAstroIdFromToken(token: string | null): string | null {
  if (!token || token.split('.').length < 2) return null;
  const atobFn = (globalThis as { atob?: (s: string) => string }).atob;
  if (typeof atobFn !== 'function') return null;
  try {
    const base64 = token.split('.')[1];
    const normalized = base64.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      '=',
    );
    const json = atobFn(padded);
    const payload = JSON.parse(json) as { astroId?: string; mobile?: string };
    return payload.astroId ?? null;
  } catch {
    return null;
  }
}

export function decodeMobileFromToken(token: string | null): string | null {
  if (!token || token.split('.').length < 2) return null;
  const atobFn = (globalThis as { atob?: (s: string) => string }).atob;
  if (typeof atobFn !== 'function') return null;
  try {
    const base64 = token.split('.')[1];
    const normalized = base64.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      '=',
    );
    const json = atobFn(padded);
    const payload = JSON.parse(json) as { mobile?: string };
    const m = payload.mobile?.trim();
    return m && m.length > 0 ? m : null;
  } catch {
    return null;
  }
}

/** For meanmaestro `attach-device` — prefers `userId`, then `id` / `sub` in JWT payload. */
export function decodeUserIdFromToken(token: string | null): string | null {
  if (!token || token.split('.').length < 2) return null;
  const atobFn = (globalThis as { atob?: (s: string) => string }).atob;
  if (typeof atobFn !== 'function') return null;
  try {
    const base64 = token.split('.')[1];
    const normalized = base64.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      '=',
    );
    const json = atobFn(padded);
    const payload = JSON.parse(json) as {
      userId?: string;
      id?: string;
      sub?: string;
    };
    const u =
      payload.userId?.trim() ||
      payload.id?.trim() ||
      payload.sub?.trim() ||
      '';
    return u.length > 0 ? u : null;
  } catch {
    return null;
  }
}

type User = {
  id: string;
  name: string;
  email: string;
};

type AuthState = {
  user: User | null;
  token: string | null;
  astroId: string | null;
  isAuthenticated: boolean;
  pendingProfileCompletion: boolean;
  /** After initial profile submit — block main app until admin approves */
  pendingAdminApproval: boolean;
  isBootstrapping: boolean;
  loading: boolean;
  error: string | null;
  authEntryRoute: 'Login' | 'Signup';
  /** After register OTP verify — show success modal before home tasks */
  registerSuccessModalVisible: boolean;
};

const initialState: AuthState = {
  user: null,
  token: null,
  astroId: null,
  isAuthenticated: false,
  pendingProfileCompletion: false,
  pendingAdminApproval: false,
  isBootstrapping: true,
  loading: false,
  error: null,
  authEntryRoute: 'Login',
  registerSuccessModalVisible: false,
};

export const bootstrapAuth = createAsyncThunk(
  'auth/bootstrap',
  async (): Promise<{
    token: string | null;
    astroId: string | null;
    gate: AuthGateSnapshot | null;
  }> => {
    const token = await storage.getAuthToken();
    if (!token) return { token: null, astroId: null, gate: null };
    const astroId = decodeAstroIdFromToken(token);
    const gate = await storage.getAuthGate();
    return { token, astroId, gate };
  },
);

/** Persists gate flags and updates Redux (use after register / profile / approval checks). */
export const applyAuthGate = createAsyncThunk(
  'auth/applyAuthGate',
  async (gate: AuthGateSnapshot) => {
    await storage.setAuthGate(gate);
    return gate;
  },
);

export const login = createAsyncThunk(
  'auth/login',
  async (payload: { email: string; password: string }, { rejectWithValue }) => {
    try {
      const response = await authApi.login(payload);
      await storage.setAuthToken(response.token);
      await storage.setAuthGate({
        pendingProfileCompletion: false,
        pendingAdminApproval: false,
      });
      return response;
    } catch {
      return rejectWithValue('Login failed. Please try again.');
    }
  },
);

export const sendOtp = createAsyncThunk(
  'auth/sendOtp',
  async (payload: { mobile: string }, { rejectWithValue }) => {
    try {
      const response = await authApi.sendOtp(payload);
      return normalizeSendOtpResponse(response);
    } catch (error) {
      const errorMessage =
        (error as { message?: string })?.message ||
        'Unable to send OTP. Please try again.';
      return rejectWithValue(errorMessage);
    }
  },
);

export const sendRegisterOtp = createAsyncThunk(
  'auth/sendRegisterOtp',
  async (payload: { mobile: string }, { rejectWithValue }) => {
    try {
      const response = await authApi.sendOtp(payload);
      return normalizeSendOtpResponse(response);
    } catch (error) {
      const errorMessage =
        (error as { message?: string })?.message ||
        'Unable to send OTP. Please try again.';
      return rejectWithValue(errorMessage);
    }
  },
);

export const verifyOtp = createAsyncThunk(
  'auth/verifyOtp',
  async (
    payload: { mobile: string; otp: string },
    { rejectWithValue },
  ) => {
    try {
      const response = await authApi.verifyOtp(payload);
      return response;
    } catch (error) {
      const errorMessage =
        (error as { message?: string })?.message ||
        'Unable to verify OTP. Please try again.';
      return rejectWithValue(errorMessage);
    }
  },
);

export const verifyRegisterOtp = createAsyncThunk(
  'auth/verifyRegisterOtp',
  async (
    payload: { mobile: string; otp: string },
    { rejectWithValue },
  ) => {
    try {
      const response = await authApi.verifyRegisterOtp(payload);
      return response;
    } catch (error) {
      const errorMessage =
        (error as { message?: string })?.message ||
        'Unable to verify OTP. Please try again.';
      return rejectWithValue(errorMessage);
    }
  },
);

export const signup = createAsyncThunk(
  'auth/signup',
  async (
    payload: { name: string; email: string; password: string },
    { rejectWithValue },
  ) => {
    try {
      const response = await authApi.signup(payload);
      await storage.setAuthToken(response.token);
      await storage.setAuthGate({
        pendingProfileCompletion: false,
        pendingAdminApproval: false,
      });
      return response;
    } catch {
      return rejectWithValue('Signup failed. Please try again.');
    }
  },
);

export const logout = createAsyncThunk('auth/logout', async () => {
  await storage.clearAuthToken();
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearAuthError: state => {
      state.error = null;
    },
    setRegisterSuccessModalVisible: (state, action: { payload: boolean }) => {
      state.registerSuccessModalVisible = action.payload;
    },
    setAuthEntryRoute: (state, action: { payload: 'Login' | 'Signup' }) => {
      state.authEntryRoute = action.payload;
    },
    setProfileCompletionPending: (state, action: { payload: boolean }) => {
      state.pendingProfileCompletion = action.payload;
    },
    setAuthenticatedSession: (
      state,
      action: {
        payload: {
          token: string;
          user?: User;
          astroId?: string | null;
          pendingProfileCompletion?: boolean;
          pendingAdminApproval?: boolean;
        };
      },
    ) => {
      const { token: tokenPayload, astroId: payloadAstroId } = action.payload;
      state.token = tokenPayload;
      const fromPayload =
        typeof payloadAstroId === 'string' && payloadAstroId.trim().length > 0
          ? payloadAstroId.trim()
          : null;
      state.astroId =
        fromPayload ?? decodeAstroIdFromToken(tokenPayload) ?? null;
      state.user =
        action.payload.user ||
        ({
          id: 'otp-user',
          name: 'Shrimaan',
          email: 'otp@yoginiastro.com',
        } as User);
      state.isAuthenticated = true;
      state.pendingProfileCompletion =
        action.payload.pendingProfileCompletion ?? false;
      state.pendingAdminApproval = action.payload.pendingAdminApproval ?? false;
      state.error = null;
      state.authEntryRoute = 'Login';
      setAccessToken(action.payload.token);
    },
  },
  extraReducers: builder => {
    builder
      .addCase(bootstrapAuth.fulfilled, (state, action) => {
        const payload = action.payload;
        state.token = payload.token;
        state.astroId = payload.astroId ?? null;
        state.isAuthenticated = Boolean(payload.token);
        if (payload.gate) {
          state.pendingProfileCompletion = payload.gate.pendingProfileCompletion;
          state.pendingAdminApproval = payload.gate.pendingAdminApproval;
        } else {
          state.pendingProfileCompletion = false;
          state.pendingAdminApproval = false;
        }
        state.isBootstrapping = false;
        setAccessToken(payload.token);
      })
      .addCase(bootstrapAuth.rejected, state => {
        state.isBootstrapping = false;
        state.astroId = null;
        setAccessToken(null);
      })
      .addCase(login.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.loading = false;
        state.token = action.payload.token;
        state.user = action.payload.user;
        state.astroId =
          (action.payload as { astroId?: string }).astroId ??
          decodeAstroIdFromToken(action.payload.token);
        state.isAuthenticated = true;
        state.pendingProfileCompletion = false;
        state.pendingAdminApproval = false;
        state.authEntryRoute = 'Login';
        setAccessToken(action.payload.token);
      })
      .addCase(login.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) || 'Something went wrong.';
      })
      .addCase(sendOtp.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(sendOtp.fulfilled, state => {
        state.loading = false;
        state.error = null;
      })
      .addCase(sendOtp.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) || 'Something went wrong.';
      })
      .addCase(sendRegisterOtp.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(sendRegisterOtp.fulfilled, state => {
        state.loading = false;
        state.error = null;
      })
      .addCase(sendRegisterOtp.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) || 'Something went wrong.';
      })
      .addCase(verifyOtp.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(verifyOtp.fulfilled, state => {
        state.loading = false;
        state.error = null;
      })
      .addCase(verifyOtp.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) || 'Something went wrong.';
      })
      .addCase(verifyRegisterOtp.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(verifyRegisterOtp.fulfilled, state => {
        state.loading = false;
        state.error = null;
      })
      .addCase(verifyRegisterOtp.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) || 'Something went wrong.';
      })
      .addCase(signup.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(signup.fulfilled, (state, action) => {
        state.loading = false;
        state.token = action.payload.token;
        state.user = action.payload.user;
        state.isAuthenticated = true;
        state.pendingProfileCompletion = false;
        state.pendingAdminApproval = false;
        state.authEntryRoute = 'Login';
        setAccessToken(action.payload.token);
      })
      .addCase(signup.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) || 'Something went wrong.';
      })
      .addCase(applyAuthGate.fulfilled, (state, action) => {
        state.pendingProfileCompletion =
          action.payload.pendingProfileCompletion;
        state.pendingAdminApproval = action.payload.pendingAdminApproval;
      })
      .addCase(logout.fulfilled, state => {
        state.user = null;
        state.token = null;
        state.astroId = null;
        state.isAuthenticated = false;
        state.pendingProfileCompletion = false;
        state.pendingAdminApproval = false;
        state.registerSuccessModalVisible = false;
        setAccessToken(null);
      });
  },
});

export const {
  clearAuthError,
  setAuthEntryRoute,
  setAuthenticatedSession,
  setProfileCompletionPending,
  setRegisterSuccessModalVisible,
} = authSlice.actions;
export const authReducer = authSlice.reducer;
