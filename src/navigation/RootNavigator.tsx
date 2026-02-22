import { NavigationContainer } from '@react-navigation/native';
import { useEffect } from 'react';
import { AuthNavigator } from './AuthNavigator';
import { MainTabNavigator } from './MainTabNavigator';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { bootstrapAuth } from '../store/slices/authSlice';
import { bootstrapLanguage } from '../store/slices/languageSlice';
import { AppLoader } from '../components/common/AppLoader';

export function RootNavigator() {
  const dispatch = useAppDispatch();
  const { isAuthenticated, isBootstrapping } = useAppSelector(state => state.auth);
  const isLanguageBootstrapping = useAppSelector(
    state => state.language.isBootstrapping,
  );

  useEffect(() => {
    dispatch(bootstrapAuth());
    dispatch(bootstrapLanguage());
  }, [dispatch]);

  if (isBootstrapping || isLanguageBootstrapping) {
    return <AppLoader />;
  }

  return (
    <NavigationContainer>
      {isAuthenticated ? <MainTabNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}
