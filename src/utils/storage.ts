import AsyncStorage from '@react-native-async-storage/async-storage';

const AUTH_TOKEN_KEY = 'auth_token';
const APP_LANGUAGE_KEY = 'app_language';

export const storage = {
  setAuthToken: async (token: string) => {
    await AsyncStorage.setItem(AUTH_TOKEN_KEY, token);
  },
  getAuthToken: async () => AsyncStorage.getItem(AUTH_TOKEN_KEY),
  clearAuthToken: async () => {
    await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
  },
  setAppLanguage: async (language: 'en' | 'hi') => {
    await AsyncStorage.setItem(APP_LANGUAGE_KEY, language);
  },
  getAppLanguage: async () =>
    (await AsyncStorage.getItem(APP_LANGUAGE_KEY)) as 'en' | 'hi' | null,
};
