export const API_ROUTES = {
  auth: {
    sendOtp: "/astro/login/send-otp",
    verifyOtp: "/astro/login/verify-otp",
    getOnline: "/astro/get-online",
    setOnline: "/astro/set-online",
    waitlist: (astroId: string) => `/astro/waitlist/${astroId}`,
    getMonthlyEarnings: "/astro/get-monthly-earnings",
    recentConsultations: (astroId: string) =>
      `/astro/recent-consultations/${astroId}`,
    login: "/auth/login",
    signup: "/auth/signup",
    refreshToken: "/auth/refresh-token",
    logout: "/auth/logout",
  },
  call: {
    recentAstroCalls: (astroId: string) =>
      `/call/recent-astro-calls/${astroId}`,
  },
  astrology: {
    generateKundali: '/astrology/generate-kundali',
  },
} as const;
