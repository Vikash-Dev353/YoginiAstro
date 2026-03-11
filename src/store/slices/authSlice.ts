import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { authApi } from '../../services/api/authApi';
import { setAccessToken } from '../../services/api/client';
import { storage } from '../../utils/storage';

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
    const payload = JSON.parse(json) as { astroId?: string };
    return payload.astroId ?? null;
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
  isBootstrapping: boolean;
  loading: boolean;
  error: string | null;
  authEntryRoute: 'Login' | 'Signup';
};

const initialState: AuthState = {
  user: null,
  token: null,
  astroId: null,
  isAuthenticated: false,
  isBootstrapping: true,
  loading: false,
  error: null,
  authEntryRoute: 'Login',
};

export const bootstrapAuth = createAsyncThunk(
  'auth/bootstrap',
  async (): Promise<{ token: string | null; astroId: string | null }> => {
    const token = await storage.getAuthToken();
    if (!token) return { token: null, astroId: null };
    const astroId = decodeAstroIdFromToken(token);
    return { token, astroId };
  },
);

export const login = createAsyncThunk(
  'auth/login',
  async (payload: { email: string; password: string }, { rejectWithValue }) => {
    try {
      const response = await authApi.login(payload);
      await storage.setAuthToken(response.token);
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
      return response;
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

export const signup = createAsyncThunk(
  'auth/signup',
  async (
    payload: { name: string; email: string; password: string },
    { rejectWithValue },
  ) => {
    try {
      const response = await authApi.signup(payload);
      await storage.setAuthToken(response.token);
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
    setAuthEntryRoute: (state, action: { payload: 'Login' | 'Signup' }) => {
      state.authEntryRoute = action.payload;
    },
    setAuthenticatedSession: (
      state,
      action: {
        payload: { token: string; user?: User; astroId?: string | null };
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
      .addCase(signup.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(signup.fulfilled, (state, action) => {
        state.loading = false;
        state.token = action.payload.token;
        state.user = action.payload.user;
        state.isAuthenticated = true;
        state.authEntryRoute = 'Login';
        setAccessToken(action.payload.token);
      })
      .addCase(signup.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) || 'Something went wrong.';
      })
      .addCase(logout.fulfilled, state => {
        state.user = null;
        state.token = null;
        state.astroId = null;
        state.isAuthenticated = false;
        setAccessToken(null);
      });
  },
});

export const { clearAuthError, setAuthEntryRoute, setAuthenticatedSession } =
  authSlice.actions;
export const authReducer = authSlice.reducer;
