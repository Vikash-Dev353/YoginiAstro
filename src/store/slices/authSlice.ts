import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { authApi } from '../../services/api/authApi';
import { setAccessToken } from '../../services/api/client';
import { storage } from '../../utils/storage';

type User = {
  id: string;
  name: string;
  email: string;
};

type AuthState = {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isBootstrapping: boolean;
  loading: boolean;
  error: string | null;
  authEntryRoute: 'Login' | 'Signup';
};

const initialState: AuthState = {
  user: null,
  token: null,
  isAuthenticated: false,
  isBootstrapping: true,
  loading: false,
  error: null,
  authEntryRoute: 'Login',
};

export const bootstrapAuth = createAsyncThunk('auth/bootstrap', async () => {
  const token = await storage.getAuthToken();
  return token;
});

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
      action: { payload: { token: string; user?: User } },
    ) => {
      state.token = action.payload.token;
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
        state.token = action.payload;
        state.isAuthenticated = Boolean(action.payload);
        state.isBootstrapping = false;
        setAccessToken(action.payload);
      })
      .addCase(bootstrapAuth.rejected, state => {
        state.isBootstrapping = false;
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
        state.isAuthenticated = false;
        setAccessToken(null);
      });
  },
});

export const { clearAuthError, setAuthEntryRoute, setAuthenticatedSession } =
  authSlice.actions;
export const authReducer = authSlice.reducer;
