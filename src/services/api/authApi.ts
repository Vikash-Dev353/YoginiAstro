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
  message: string;
  status: 'Success' | 'Failed' | string;
};

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
};

export const authApi = {
  sendOtp: async (payload: SendOtpPayload) =>
    apiService.post<SendOtpResponse>(API_ROUTES.auth.sendOtp, payload),
  verifyOtp: async (payload: VerifyOtpPayload) =>
    apiService.post<VerifyOtpResponse>(API_ROUTES.auth.verifyOtp, payload),

  login: async (payload: LoginPayload) =>
    apiService.post<AuthResponse>(API_ROUTES.auth.login, payload),

  signup: async (payload: SignupPayload) =>
    apiService.post<AuthResponse>(API_ROUTES.auth.signup, payload),
};
