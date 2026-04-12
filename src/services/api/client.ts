import axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from "axios";

let accessToken: string | null = null;

export const setAccessToken = (token: string | null) => {
  accessToken = token;
};

const BASE_URL = "https://yoginiastro.com/api/mob";
// const BASE_URL = "https://yoginiastro.com/api-v2/astrologer";
// const BASE_URL = "http://192.168.1.9:3500/mob/astro";
const ENABLE_API_LOGS = true;

const getFullUrl = (config?: AxiosRequestConfig) => {
  if (!config) {
    return "";
  }

  return `${config.baseURL || ""}${config.url || ""}`;
};

const logApiRequest = (config: AxiosRequestConfig) => {
  if (!ENABLE_API_LOGS) {
    return;
  }

  console.log("API REQUEST", {
    method: config.method?.toUpperCase(),
    url: getFullUrl(config),
    params: config.params,
    body: config.data,
  });
};

const logApiResponse = (response: AxiosResponse) => {
  if (!ENABLE_API_LOGS) {
    return;
  }

  console.log("API RESPONSE", {
    method: response.config.method?.toUpperCase(),
    url: getFullUrl(response.config),
    status: response.status,
    data: response.data,
  });

  console.log("api response string==>>>",JSON.stringify({
    data: response.data,
  }) );


};

const logApiError = (error: AxiosError<{ message?: string }>) => {
  if (!ENABLE_API_LOGS) {
    return;
  }

  console.log("API ERROR", {
    method: error.config?.method?.toUpperCase(),
    url: getFullUrl(error.config),
    status: error.response?.status,
    message: error.response?.data?.message || error.message,
    data: error.response?.data,
  });
};

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

apiClient.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }

  logApiRequest(config);
  return config;
});

apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    logApiResponse(response);
    return response;
  },
  (error: AxiosError<{ message?: string }>) => {
    logApiError(error);

    const message =
      error.response?.data?.message ||
      error.message ||
      "Something went wrong. Please try again.";

    return Promise.reject({
      status: error.response?.status,
      message,
      raw: error,
    });
  }
);

export const apiService = {
  get: async <T>(url: string, config?: AxiosRequestConfig) => {
    const response = await apiClient.get<T>(url, config);
    return response.data;
  },
  post: async <T>(url: string, body?: unknown, config?: AxiosRequestConfig) => {
    const response = await apiClient.post<T>(url, body, config);
    return response.data;
  },
  put: async <T>(url: string, body?: unknown, config?: AxiosRequestConfig) => {
    const response = await apiClient.put<T>(url, body, config);
    return response.data;
  },
  patch: async <T>(
    url: string,
    body?: unknown,
    config?: AxiosRequestConfig
  ) => {
    const response = await apiClient.patch<T>(url, body, config);
    return response.data;
  },
  delete: async <T>(url: string, config?: AxiosRequestConfig) => {
    const response = await apiClient.delete<T>(url, config);
    return response.data;
  },
};
