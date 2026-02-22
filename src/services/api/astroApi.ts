import { apiService } from './client';
import { API_ROUTES } from './routes';

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

export const astroApi = {
  getOnline: async (payload: GetOnlinePayload) =>
    apiService.post<OnlineStatusResponse>(API_ROUTES.auth.getOnline, payload),
  setOnline: async (payload: SetOnlinePayload) =>
    apiService.post<OnlineStatusResponse>(API_ROUTES.auth.setOnline, payload),
};
