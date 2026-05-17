import { apiService } from './client';
import { API_ROUTES } from './routes';

type LoginPayload = {
  email: string;
  password: string;
};

type SignupPayload = {
  name: string;
  email: string;
  password: string;
};

export type AuthResponse = {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
};

export type SendOtpPayload = {
  mobile: string;
};

export type SendOtpResponse = {
  message?: string;
  status?: 'Success' | 'Failed' | string;
  isNewAstrologer?: boolean;
  data?: {
    message?: string;
    status?: string;
    isNewAstrologer?: boolean;
  };
};

export type NormalizedSendOtpResponse = {
  message: string;
  status: string;
  isNewAstrologer: boolean;
};

/** API wraps send-otp payload in `{ data: { status, message, isNewAstrologer } }`. */
export function normalizeSendOtpResponse(
  raw: SendOtpResponse,
): NormalizedSendOtpResponse {
  const nested = raw.data;
  return {
    message: (nested?.message ?? raw.message ?? '').trim(),
    status: (nested?.status ?? raw.status ?? '').trim(),
    isNewAstrologer: Boolean(
      nested?.isNewAstrologer ?? raw.isNewAstrologer,
    ),
  };
}

export type VerifyOtpPayload = {
  mobile: string;
  otp: string;
};

export type VerifyOtpResponse = {
  message?: string;
  status: 'Success' | 'Failed' | string;
  token?: string;
  /** JWT – backend may send token in this field */
  authorization?: string;
  astroId?: string;
  user?: {
    id?: string;
    name?: string;
    email?: string;
  };
  /** Some endpoints wrap payload in `data` (e.g. register OTP “awaiting admin approval”). */
  data?: {
    message?: string;
    status?: string;
    authorization?: string;
    astroId?: string;
  };
};

export const authApi = {
  sendOtp: async (payload: SendOtpPayload) =>
    apiService.post<SendOtpResponse>(API_ROUTES.auth.sendOtp, payload),
  sendRegisterOtp: async (payload: SendOtpPayload) =>
    apiService.post<SendOtpResponse>(
      API_ROUTES.auth.sendRegisterOtp,
      payload,
    ),
  verifyOtp: async (payload: VerifyOtpPayload) =>
    apiService.post<VerifyOtpResponse>(API_ROUTES.auth.verifyOtp, payload),
  verifyRegisterOtp: async (payload: VerifyOtpPayload) =>
    apiService.post<VerifyOtpResponse>(
      API_ROUTES.auth.verifyRegisterOtp,
      payload,
    ),

  login: async (payload: LoginPayload) =>
    apiService.post<AuthResponse>(API_ROUTES.auth.login, payload),

  signup: async (payload: SignupPayload) =>
    apiService.post<AuthResponse>(API_ROUTES.auth.signup, payload),
};
