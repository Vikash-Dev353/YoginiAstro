import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { useEffect } from 'react';
import { AuthNavigator } from './AuthNavigator';
import { MainTabNavigator } from './MainTabNavigator';
import { attachDeviceToUser } from '../services/device/registerDevice';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { bootstrapAuth, decodeUserIdFromToken } from '../store/slices/authSlice';
import { bootstrapLanguage } from '../store/slices/languageSlice';
import { AppLoader } from '../components/common/AppLoader';

const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: 'transparent',
    card: 'transparent',
  },
};

export function RootNavigator() {
  const dispatch = useAppDispatch();
  const {
    isAuthenticated,
    isBootstrapping,
    pendingProfileCompletion,
    pendingAdminApproval,
  } = useAppSelector(state => state.auth);
  const canEnterMainApp =
    isAuthenticated &&
    !pendingProfileCompletion &&
    !pendingAdminApproval;
  const isLanguageBootstrapping = useAppSelector(
    state => state.language.isBootstrapping,
  );
  const token = useAppSelector(state => state.auth.token);
  const user = useAppSelector(state => state.auth.user);

  useEffect(() => {
    dispatch(bootstrapAuth());
    dispatch(bootstrapLanguage());
  }, [dispatch]);

  useEffect(() => {
    if (!canEnterMainApp || !token) {
      return;
    }
    const userId = user?.id?.trim() || decodeUserIdFromToken(token) || '';
    if (!userId) {
      return;
    }
    void attachDeviceToUser({ authToken: token, userId });
  }, [canEnterMainApp, token, user?.id]);

  if (isBootstrapping || isLanguageBootstrapping) {
    return <AppLoader />;
  }

  return (
    <NavigationContainer theme={navigationTheme}>
      {canEnterMainApp ? <MainTabNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}
