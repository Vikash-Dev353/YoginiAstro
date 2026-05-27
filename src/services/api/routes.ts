export const API_ROUTES = {
  auth: {
    sendOtp: "/astro/send-otp",
    sendRegisterOtp: "/astro/send-otp",
    verifyRegisterOtp: "/astro/verify-otp",
    verifyOtp: "/astro/verify-otp",
    getOnline: "/astro/get-online",
    setOnline: "/astro/set-online",
    waitlist: (astroId: string) => `/astro/waitlist/${astroId}`,
    getMonthlyEarnings: "/astro/get-monthly-earnings",
    monthlyReports: (astroId: string) => `/astro/monthly-reports/${astroId}`,
    getLatestReviews: "/astro/get-latest-reviews",
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
  file: {
    uploadFile: '/chat/upload-media',
  },
} as const;
