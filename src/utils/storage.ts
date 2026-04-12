import AsyncStorage from '@react-native-async-storage/async-storage';

const AUTH_TOKEN_KEY = 'auth_token';
const AUTH_GATE_KEY = 'auth_gate';
const APP_LANGUAGE_KEY = 'app_language';

export type AuthGateSnapshot = {
  pendingProfileCompletion: boolean;
  pendingAdminApproval: boolean;
};

export const storage = {
  setAuthToken: async (token: string) => {
    await AsyncStorage.setItem(AUTH_TOKEN_KEY, token);
  },
  getAuthToken: async () => AsyncStorage.getItem(AUTH_TOKEN_KEY),
  clearAuthToken: async () => {
    await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
    await AsyncStorage.removeItem(AUTH_GATE_KEY);
  },
  setAuthGate: async (gate: AuthGateSnapshot) => {
    await AsyncStorage.setItem(AUTH_GATE_KEY, JSON.stringify(gate));
  },
  getAuthGate: async (): Promise<AuthGateSnapshot | null> => {
    const raw = await AsyncStorage.getItem(AUTH_GATE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AuthGateSnapshot;
    } catch {
      return null;
    }
  },
  setAppLanguage: async (language: 'en' | 'hi') => {
    await AsyncStorage.setItem(APP_LANGUAGE_KEY, language);
  },
  getAppLanguage: async () =>
    (await AsyncStorage.getItem(APP_LANGUAGE_KEY)) as 'en' | 'hi' | null,
};
