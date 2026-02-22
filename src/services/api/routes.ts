export const API_ROUTES = {
  auth: {
    sendOtp: '/astro/login/send-otp',
    verifyOtp: '/astro/login/verify-otp',
    getOnline: '/astro/get-online',
    setOnline: '/astro/set-online',
    login: '/auth/login',
    signup: '/auth/signup',
    refreshToken: '/auth/refresh-token',
    logout: '/auth/logout',
  },
} as const;
