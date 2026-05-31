import type { GetMonthlyReportsResponse } from '../../utils/monthlyPayoutMapper';
import { apiClient, apiService } from './client';
import { API_ROUTES } from './routes';

export type { GetMonthlyReportsResponse } from '../../utils/monthlyPayoutMapper';

const WAITLIST_TTL_MS = 10 * 60 * 1000;

export type GetOnlinePayload = {
  astroId: string;
};

export type GetWaitlistOptions = {
  forceRefresh?: boolean;
};

export type SetOnlinePayload = {
  astroId: string;
  chatOnline: boolean;
  callOnline: boolean;
};

export type UploadChatFileResponse = {
  status?: string;
  message?: string;
  fullUrl?: string;
  fileUrl?: string;
  url?: string;
  data?: {
    fullUrl?: string;
    fileUrl?: string;
    url?: string;
  };
};

/** Astrologer block from get-online / set-online (root or nested under `data`) */
export type OnlineAstrologerInfo = {
  astroId?: string;
  name?: string;
  mobile?: string;
  isOnline?: string;
  chatStatus?: 'online' | 'offline' | string;
  callStatus?: 'online' | 'offline' | string;
  profileImage?: string;
  experience?: number;
  skills?: string[];
};

export type OnlineStatusResponse = {
  status?: string;
  message?: string;
  astrologer?: OnlineAstrologerInfo;
  chatOnline?: boolean;
  callOnline?: boolean;
  data?: {
    status?: string;
    astrologer?: OnlineAstrologerInfo;
    chatOnline?: boolean;
    callOnline?: boolean;
  };
};

/** Server may return astrologer at root or under `data` */
export function getAstrologerFromOnlineResponse(
  response: OnlineStatusResponse,
): OnlineAstrologerInfo | undefined {
  return response.astrologer ?? response.data?.astrologer;
}

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
  senderId?: string;
  from?: string;
  senderName?: string;
  senderImage?: string | null;
  message?: string;
  roomId?: string;
  requestedAt?: string | number;
  timestamp?: string | number;
  kundliUrl?: string;
  kundaliData?: Record<string, unknown>;
  userData?: {
    fullName?: string;
    firstName?: string;
    lastName?: string;
    profileImage?: string;
  };
  balance?: {
    balance?: number;
  };
  astroData?: {
    price?: number;
  };
  /** Payload to call generate-kundali when user opens View Kundli */
  generateKundaliPayload?: GenerateKundaliPayload;
};

export type WaitlistResponse = {
  status: 'Success' | 'Failed' | string;
  waitingCount: number;
  waitingList: WaitlistApiItem[];
  message?: string;
};

type WaitlistRawResponse =
  | WaitlistResponse
  | {
      data?: WaitlistResponse;
      status?: string;
      message?: string;
      waitingCount?: number;
      waitingList?: WaitlistApiItem[];
    };

export function parseKundliUrlToPayload(
  kundliUrl?: string,
): GenerateKundaliPayload | undefined {
  if (!kundliUrl || kundliUrl.trim().length === 0) {
    return undefined;
  }

  const search = kundliUrl.startsWith("?") ? kundliUrl : `?${kundliUrl}`;
  const params = new URLSearchParams(search);
  const fullName = params.get("full_name");
  const day = Number(params.get("day"));
  const month = Number(params.get("month"));
  const year = Number(params.get("year"));
  const hour = Number(params.get("hour"));
  const minute = Number(params.get("min"));
  const gender = params.get("gender");
  const birthPlace = params.get("birthPlace");
  const lat = Number(params.get("lat"));
  const lon = Number(params.get("lon"));

  if (
    !fullName ||
    !birthPlace ||
    !gender ||
    Number.isNaN(day) ||
    Number.isNaN(month) ||
    Number.isNaN(year) ||
    Number.isNaN(hour) ||
    Number.isNaN(minute) ||
    Number.isNaN(lat) ||
    Number.isNaN(lon)
  ) {
    return undefined;
  }

  return {
    full_name: fullName,
    day,
    month,
    year,
    hour,
    min: minute,
    gender,
    birthPlace,
    selectedPlace: {
      display_name: birthPlace,
      lat,
      lon,
    },
    chart_type: params.get("chart_type") || "north",
    tzone: params.get("tzone") || "5.5",
    lang: params.get("lang") || "en",
  };
}

function normalizeWaitlistResponse(raw: WaitlistRawResponse): WaitlistResponse {
  const dataBlock =
    raw && typeof raw === "object" && "data" in raw && raw.data
      ? raw.data
      : undefined;
  const source = dataBlock ?? raw;
  return {
    status:
      (source as WaitlistResponse)?.status ??
      (raw as WaitlistResponse)?.status ??
      "Failed",
    waitingCount: Number(
      (source as WaitlistResponse)?.waitingCount ??
        (raw as WaitlistResponse)?.waitingCount ??
        0,
    ),
    waitingList: Array.isArray((source as WaitlistResponse)?.waitingList)
      ? ((source as WaitlistResponse).waitingList ?? [])
      : [],
    message:
      (source as WaitlistResponse)?.message ??
      (raw as WaitlistResponse)?.message,
  };
}

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
  chat?: {
    totalSessions?: number;
    totalActualSeconds?: number;
    totalBilledSeconds?: number;
    totalMinutes?: number;
    pricePerMinute?: number;
    grossEarning?: number;
  };
  call?: {
    totalCalls?: number;
    totalActualSeconds?: number;
    totalBilledSeconds?: number;
    totalMinutes?: number;
    grossEarning?: number;
  };
  calculation?: {
    totalGrossEarning?: number;
    astrologerShare_40_percent?: number;
    tds_10_percent_on_astrologer?: number;
    finalPayableToAstrologer?: number;
    platformRevenue_60_percent?: number;
  };
  monthRange?: {
    start?: string;
    end?: string;
  };
  // keep backward compatibility with older payload shape used elsewhere
  balance?: { totalAvailable: number; currency: string };
  weeklyEarnings?: { total: string; chartData: WalletChartPoint[] };
  monthlyEarnings?: WalletMonthlyEarning[];
  payableAmount?: { amount: string; amountValue: number };
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

export type UpdateProfileResponse = {
  status?: string;
  message?: string;
  [key: string]: unknown;
};

export type AstroProfile = {
  astroId?: string;
  name?: string;
  realName?: string;
  mobile?: string;
  gender?: string;
  languages?: string[] | string;
  skills?: string[] | string;
  email?: string;
  description?: string;
  experience?: number | string;
  price?: number | string;
  callPrice?: number | string;
  videoPrice?: number | string;
  dob?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
  profileImage?: string;
  aadhar?: string;
  pan?: string;
  passBookOrCancelledCheque?: string;
  accountHolderName?: string;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  speciality?: string[] | string;
  /** When backend exposes approval state */
  isApproved?: boolean;
  adminApproved?: boolean;
  approvalStatus?: string;
  accountStatus?: string;
  verified?: boolean;
};

/** True when admin has approved the astrologer for the main app (best-effort across possible API shapes). */
export function isAstrologerApprovedByAdmin(
  profile: AstroProfile | undefined,
): boolean {
  if (!profile) {
    return false;
  }
  if (profile.isApproved === true || profile.adminApproved === true) {
    return true;
  }
  if (profile.verified === true) {
    return true;
  }
  const raw = `${profile.approvalStatus ?? profile.accountStatus ?? ''}`
    .trim()
    .toLowerCase();
  if (!raw) {
    return false;
  }
  if (raw.includes('pending') || raw.includes('await')) {
    return false;
  }
  if (raw.includes('approved') || raw === 'active' || raw === 'verified') {
    return true;
  }
  return false;
}

export type GetProfileResponse = {
  status?: string;
  message?: string;
  astrologer?: AstroProfile;
  data?: AstroProfile | Record<string, unknown>;
  profile?: AstroProfile;
  result?: AstroProfile | Record<string, unknown>;
};

const optionalProfileString = (value: unknown): string | undefined => {
  if (value == null) {
    return undefined;
  }
  const text = String(value).trim();
  return text.length > 0 ? text : undefined;
};

/** Backend may return http:// — Android blocks cleartext image loads by default. */
const normalizeProfileMediaUrl = (value: unknown): string | undefined => {
  const text = optionalProfileString(value);
  if (!text) {
    return undefined;
  }
  if (/^http:\/\//i.test(text) && /yoginiastro\.com/i.test(text)) {
    return text.replace(/^http:\/\//i, 'https://');
  }
  return text;
};

const isProfileLikeRecord = (value: Record<string, unknown>): boolean =>
  Boolean(
    value.name ||
      value.astroId ||
      value.astro_id ||
      value.mobile ||
      value.profileImage ||
      value.profile_image,
  );

/** Normalizes mob/get-profile astrologer object (camelCase + snake_case). */
export function normalizeAstroProfileFromApi(
  raw: Record<string, unknown>,
): AstroProfile {
  return {
    astroId: optionalProfileString(raw.astroId ?? raw.astro_id),
    name: optionalProfileString(raw.name ?? raw.fullName),
    realName: optionalProfileString(raw.realName ?? raw.real_name),
    mobile: optionalProfileString(raw.mobile),
    gender: optionalProfileString(raw.gender),
    languages: (raw.languages ?? raw.language) as AstroProfile['languages'],
    skills: raw.skills as AstroProfile['skills'],
    email: optionalProfileString(raw.email),
    description: optionalProfileString(raw.description ?? raw.about),
    experience: (raw.experience ?? raw.experienceYears) as AstroProfile['experience'],
    price: raw.price as AstroProfile['price'],
    callPrice: (raw.callPrice ?? raw.call_price) as AstroProfile['callPrice'],
    videoPrice: (raw.videoPrice ?? raw.video_price) as AstroProfile['videoPrice'],
    dob: optionalProfileString(raw.dob ?? raw.dateOfBirth ?? raw.date_of_birth),
    address: optionalProfileString(raw.address),
    city: optionalProfileString(raw.city),
    state: optionalProfileString(raw.state),
    country: optionalProfileString(raw.country),
    pincode: optionalProfileString(raw.pincode ?? raw.pin_code),
    profileImage: normalizeProfileMediaUrl(
      raw.profileImage ?? raw.profile_image ?? raw.profilePhoto ?? raw.profile_photo,
    ),
    aadhar: normalizeProfileMediaUrl(raw.aadhar ?? raw.aadhaar ?? raw.aadharCard),
    pan: normalizeProfileMediaUrl(raw.pan ?? raw.panCard),
    passBookOrCancelledCheque: normalizeProfileMediaUrl(
      raw.passBookOrCancelledCheque ??
        raw.passbook ??
        raw.pass_book ??
        raw.passBook,
    ),
    accountHolderName: optionalProfileString(
      raw.accountHolderName ?? raw.account_holder_name,
    ),
    bankName: optionalProfileString(raw.bankName ?? raw.bank_name),
    accountNumber: optionalProfileString(
      raw.accountNumber ?? raw.account_number,
    ),
    ifscCode: optionalProfileString(raw.ifscCode ?? raw.ifsc_code),
    speciality: (raw.speciality ??
      raw.specialty ??
      raw.specialities) as AstroProfile['speciality'],
    isApproved: raw.isApproved as boolean | undefined,
    adminApproved: raw.adminApproved as boolean | undefined,
    approvalStatus: optionalProfileString(raw.approvalStatus ?? raw.approval_status),
    accountStatus: optionalProfileString(raw.accountStatus ?? raw.account_status),
    verified: raw.verified as boolean | undefined,
  };
};

function unwrapProfileCandidate(
  candidate: unknown,
  depth = 0,
): Record<string, unknown> | null {
  if (depth > 6 || !candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return null;
  }
  const record = candidate as Record<string, unknown>;
  if (isProfileLikeRecord(record)) {
    return record;
  }
  const nested =
    record.astrologer ?? record.profile ?? record.data ?? record.result;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    return unwrapProfileCandidate(nested, depth + 1);
  }
  return null;
}

/** Extracts astrologer profile from get-profile API (handles nested keys). */
export function getAstroProfileFromGetProfileResponse(
  response: GetProfileResponse | Record<string, unknown>,
): AstroProfile | undefined {
  const root = response as GetProfileResponse & Record<string, unknown>;
  const candidates: unknown[] = [
    root.astrologer,
    root.profile,
    root.data,
    root.result,
    root,
  ];
  for (const candidate of candidates) {
    const record = unwrapProfileCandidate(candidate);
    if (record) {
      return normalizeAstroProfileFromApi(record);
    }
  }
  return undefined;
}

type WaitlistCacheEntry = {
  fetchedAt: number;
  data: WaitlistResponse;
};

const waitlistCache = new Map<string, WaitlistCacheEntry>();
const waitlistInFlight = new Map<string, Promise<WaitlistResponse>>();

type MonthlyReportsCacheEntry = {
  fetchedAt: number;
  data: GetMonthlyReportsResponse;
};

const MONTHLY_REPORTS_TTL_MS = 60_000;
const monthlyReportsCache = new Map<string, MonthlyReportsCacheEntry>();
const monthlyReportsInFlight = new Map<
  string,
  Promise<GetMonthlyReportsResponse>
>();

export const astroApi = {
  getOnline: async (payload: GetOnlinePayload) =>
    apiService.post<OnlineStatusResponse>(API_ROUTES.auth.getOnline, payload),
  setOnline: async (payload: SetOnlinePayload) =>
    apiService.post<OnlineStatusResponse>(API_ROUTES.auth.setOnline, payload),
  getWaitlist: async (astroId: string, options?: GetWaitlistOptions) => {
    const cacheKey = astroId.trim().toUpperCase();
    const shouldUseCache = !options?.forceRefresh;
    const cached = waitlistCache.get(cacheKey);
    if (shouldUseCache && cached && Date.now() - cached.fetchedAt < WAITLIST_TTL_MS) {
      return cached.data;
    }

    const inFlight = waitlistInFlight.get(cacheKey);
    if (shouldUseCache && inFlight) {
      return inFlight;
    }

    const request = apiService
      .post<WaitlistRawResponse>(API_ROUTES.auth.waitlist(cacheKey))
      .then(raw => {
        const data = normalizeWaitlistResponse(raw);
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
  getMonthlyReports: async (
    astroId: string,
    params?: { month?: number; year?: number },
  ) => {
    const cacheKey = astroId.trim().toUpperCase();
    const hasPeriod =
      params?.month != null &&
      params?.year != null &&
      Number.isFinite(params.month) &&
      Number.isFinite(params.year);

    if (!hasPeriod) {
      const cached = monthlyReportsCache.get(cacheKey);
      if (cached && Date.now() - cached.fetchedAt < MONTHLY_REPORTS_TTL_MS) {
        return cached.data;
      }
      const inFlight = monthlyReportsInFlight.get(cacheKey);
      if (inFlight) {
        return inFlight;
      }
    }

    const url = API_ROUTES.auth.monthlyReports(cacheKey);
    const request = apiClient
      .get<GetMonthlyReportsResponse>(url, {
        ...(hasPeriod
          ? { data: { month: params!.month, year: params!.year } }
          : {}),
      })
      .then(response => response.data)
      .then(data => {
        if (!hasPeriod) {
          monthlyReportsCache.set(cacheKey, {
            fetchedAt: Date.now(),
            data,
          });
        }
        return data;
      })
      .finally(() => {
        if (!hasPeriod) {
          monthlyReportsInFlight.delete(cacheKey);
        }
      });

    if (!hasPeriod) {
      monthlyReportsInFlight.set(cacheKey, request);
    }
    return request;
  },
  getAstrologerReport: (
    astroId: string,
    params: { month: number; year: number },
  ) =>
    apiClient
      .get<GetMonthlyReportsResponse>(
        API_ROUTES.auth.getAstrologerReport(astroId.trim().toUpperCase()),
        {
          params: {
            month: params.month,
            year: params.year,
          },
        },
      )
      .then(response => response.data),
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
  updateProfile: (payload: FormData) =>
    apiService.post<UpdateProfileResponse>(
      API_ROUTES.auth.updateProfile,
      payload,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      },
    ),
  submitInitialProfile: (payload: FormData) =>
    apiService.post<UpdateProfileResponse>(
      API_ROUTES.auth.initialProfile,
      payload,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      },
    ),
  uploadChatFile: (payload: FormData) =>
    apiService.post<UploadChatFileResponse>(
      API_ROUTES.file.uploadFile,
      payload,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      },
    ),
  getProfile: (payload: { astroId: string }) =>
    apiService.post<GetProfileResponse>(API_ROUTES.auth.getProfile, {
      astroId: payload.astroId.trim().toUpperCase(),
    }),
};
