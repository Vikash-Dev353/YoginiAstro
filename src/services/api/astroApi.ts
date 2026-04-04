import { apiService } from './client';
import { API_ROUTES } from './routes';

const WAITLIST_TTL_MS = 10 * 60 * 1000;

export type GetOnlinePayload = {
  astroId: string;
};

export type SetOnlinePayload = {
  astroId: string;
  chatOnline: boolean;
  callOnline: boolean;
};

export type OnlineStatusResponse = {
  status?: string;
  message?: string;
  astrologer?: {
    astroId?: string;
    name?: string;
    mobile?: string;
    chatStatus?: 'online' | 'offline' | string;
    callStatus?: 'online' | 'offline' | string;
    profileImage?: string;
    experience?: number;
    skills?: string[];
  };
  chatOnline?: boolean;
  callOnline?: boolean;
  data?: {
    chatOnline?: boolean;
    callOnline?: boolean;
  };
};

/** Payload for astrology/generate-kundali API (request body) */
export type GenerateKundaliPayload = {
  full_name: string;
  day: number;
  month: number;
  year: number;
  hour: number;
  min: number;
  gender: string;
  birthPlace: string;
  selectedPlace: {
    display_name: string;
    lat: number;
    lon: number;
  };
  chart_type: string;
  tzone: string;
  lang: string;
};

/** Basic astro details from generate-kundali API (data.basic_astro_details.data) */
export type BasicAstroDetailsData = {
  full_name?: string;
  year?: number;
  month?: number;
  day?: number;
  hour?: number;
  minute?: number;
  gender?: string;
  place?: string;
  latitude?: number;
  longitude?: number;
  timezone?: number;
  sunrise?: string;
  sunset?: string;
  tithi?: string;
  paksha?: string;
  paya?: { type?: string; result?: string };
  sunsign?: string;
  moonsign?: string;
  rashi_akshar?: string;
  chandramasa?: string;
  tatva?: string;
  prahar?: number;
  nakshatra?: string;
  vaar?: string;
  varna?: string;
  vashya?: string;
  yoni?: string;
  gana?: string;
  nadi?: string;
  yoga?: string;
  karana?: string;
  ayanamsha?: string;
  yunja?: string;
};

/** Horoscope chart item (D1, D2, D3, etc.) */
export type HoroscopeChartItem = {
  success?: number;
  data?: {
    svg?: string;
    base64_image?: string;
    data?: Record<string, unknown>;
  };
};

/** Planet position from planetary_positions */
export type PlanetPosition = {
  name?: string;
  name_lan?: string;
  sign?: string;
  sign_no?: number;
  longitude?: string;
  full_degree?: string;
  nakshatra?: string;
  house?: number;
  is_retro?: string;
  type?: string;
  [key: string]: unknown;
};

/** Vimshottari dasha - maha dasha entry */
export type MahaDashaEntry = {
  start_date?: string;
  end_date?: string;
  antar_dasha?: Record<string, { start_time?: string; end_time?: string }>;
};

export type GenerateKundaliResponse = {
  status?: string;
  message?: string;
  
    basic_astro_details?: { success?: number; data?: BasicAstroDetailsData };
    horoscope_chart_D1?: HoroscopeChartItem;
    horoscope_chart_D2?: HoroscopeChartItem;
    horoscope_chart_D3?: HoroscopeChartItem;
    horoscope_chart_D9?: HoroscopeChartItem;
    horoscope_chart_D10?: HoroscopeChartItem;
    horoscope_chart_D12?: HoroscopeChartItem;
    horoscope_chart_chalit?: HoroscopeChartItem;
    planetary_positions?: {
      success?: number;
      data?: { planets?: PlanetPosition[]; date?: string; time?: string };
    };
    vimshottari_dasha?: {
      success?: number;
      data?: { maha_dasha?: Record<string, MahaDashaEntry> };
    };
    manglik_dosha?: {
      success?: number;
      data?: {
        manglik_dosha?: string;
        strength?: string;
        percentage?: number;
        remedies?: string[];
        comment?: string[];
      };
    };
    sadhe_sati?: {
      success?: number;
      data?: {
        sadhesati?: { result?: string; saturn_sign?: string; consideration_date?: string };
        remedies?: string[];
        content?: { title?: string; description?: string[] };
      };
    };
  
  [key: string]: unknown;
};

export type WaitlistApiItem = {
  from: string;
  senderName: string;
  senderImage: string | null;
  message: string;
  roomId: string;
  requestedAt: string;
  kundliUrl?: string;
  kundaliData?: Record<string, unknown>;
  /** Payload to call generate-kundali when user opens View Kundli */
  generateKundaliPayload?: GenerateKundaliPayload;
};

export type WaitlistResponse = {
  status: 'Success' | 'Failed' | string;
  waitingCount: number;
  waitingList: WaitlistApiItem[];
  message?: string;
};

export type WalletChartPoint = { label: string; value: number };

export type WalletMonthlyEarning = {
  id: string;
  month: string;
  label: string;
  amount: string;
  amountValue: number;
};

export type GetMonthlyEarningsPayload = { astroId: string };

export type GetMonthlyEarningsResponse = {
  status: string;
  astroId: string;
  balance: { totalAvailable: number; currency: string };
  weeklyEarnings: { total: string; chartData: WalletChartPoint[] };
  monthlyEarnings: WalletMonthlyEarning[];
  payableAmount: { amount: string; amountValue: number };
};

/** Chat history / recent consultations – add more keys here as backend sends them */
export type ConsultationItem = {
  orderId: string;
  userName: string;
  amount: number;
  // Optional – bind when backend sends these
  dob?: string;
  pob?: string;
  gender?: string;
  rate?: string | number;
  duration?: string | number;
  createdAt?: string;
  [key: string]: unknown;
};

export type RecentConsultationsResponse = {
  status: string;
  consultations: ConsultationItem[];
};

export type CallHistoryItem = {
  orderId: string;
  startedAt: string;
  endedAt: string;
  serviceType: string;
  clientMobile: string;
  userName: string;
  title: string;
  durationMinutes: number;
  amount: number;
  callPrice: number;
};

export type RecentAstroCallsResponse = {
  status: string;
  consultations: CallHistoryItem[];
};

export type LatestReviewApiItem = {
  astroId?: string;
  userId?: string;
  userName?: string;
  rating?: number;
  review?: string;
  date?: string;
};

export type GetLatestReviewsPayload = {
  astroId: string;
  limit?: number;
};

export type GetLatestReviewsResponse = {
  status?: string;
  message?: string;
  totalReviews?: number;
  averageRating?: string;
  data?: LatestReviewApiItem[];
};

type WaitlistCacheEntry = {
  fetchedAt: number;
  data: WaitlistResponse;
};

const waitlistCache = new Map<string, WaitlistCacheEntry>();
const waitlistInFlight = new Map<string, Promise<WaitlistResponse>>();

export const astroApi = {
  getOnline: async (payload: GetOnlinePayload) =>
    apiService.post<OnlineStatusResponse>(API_ROUTES.auth.getOnline, payload),
  setOnline: async (payload: SetOnlinePayload) =>
    apiService.post<OnlineStatusResponse>(API_ROUTES.auth.setOnline, payload),
  getWaitlist: async (astroId: string) => {
    const cacheKey = astroId.trim().toUpperCase();
    const cached = waitlistCache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < WAITLIST_TTL_MS) {
      return cached.data;
    }

    const inFlight = waitlistInFlight.get(cacheKey);
    if (inFlight) {
      return inFlight;
    }

    const request = apiService
      .post<WaitlistResponse>(API_ROUTES.auth.waitlist(cacheKey))
      .then(data => {
        waitlistCache.set(cacheKey, { fetchedAt: Date.now(), data });
        return data;
      })
      .finally(() => {
        waitlistInFlight.delete(cacheKey);
      });

    waitlistInFlight.set(cacheKey, request);
    return request;
  },
  getMonthlyEarnings: (payload: GetMonthlyEarningsPayload) =>
    apiService.post<GetMonthlyEarningsResponse>(
      API_ROUTES.auth.getMonthlyEarnings,
      payload,
    ),
  getRecentConsultations: async (
    astroId: string,
    limit: number = 20,
  ): Promise<RecentConsultationsResponse> => {
    const url = API_ROUTES.auth.recentConsultations(
      astroId.trim().toUpperCase(),
    );
    return apiService.post<RecentConsultationsResponse>(url, {}, {
      params: { limit },
    });
  },
  getRecentAstroCalls: async (
    astroId: string,
    limit: number = 20,
  ): Promise<RecentAstroCallsResponse> => {
    const url = API_ROUTES.call.recentAstroCalls(
      astroId.trim().toUpperCase(),
    );
    return apiService.post<RecentAstroCallsResponse>(url, {}, {
      params: { limit },
    });
  },
  generateKundali: (payload: GenerateKundaliPayload) =>
    apiService.post<GenerateKundaliResponse>(
      API_ROUTES.astrology.generateKundali,
      payload,
    ),
  getLatestReviews: (payload: GetLatestReviewsPayload) =>
    apiService.post<GetLatestReviewsResponse>(
      API_ROUTES.auth.getLatestReviews,
      {
        astroId: payload.astroId.trim().toUpperCase(),
        limit: payload.limit ?? 20,
      },
    ),
};
