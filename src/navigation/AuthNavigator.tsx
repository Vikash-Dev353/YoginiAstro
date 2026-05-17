import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useEffect, useMemo } from 'react';
import { registerDeviceWithNotificationPermission } from '../services/device/registerDevice';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { SignupScreen } from '../screens/auth/SignupScreen';
import { OtpVerificationScreen } from '../screens/auth/OtpVerificationScreen';
import { PendingApprovalScreen } from '../screens/auth/PendingApprovalScreen';
import { PrivacyPolicyScreen } from '../screens/auth/PrivacyPolicyScreen';
import { TermsAndConditionsScreen } from '../screens/auth/TermsAndConditionsScreen';
import { CompleteProfileScreen } from '../screens/profile/CompleteProfileScreen';
import { useAppSelector } from '../store/hooks';
import { AuthStackParamList } from './types';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthNavigator() {
  const authEntryRoute = useAppSelector(state => state.auth.authEntryRoute);
  const pendingProfileCompletion = useAppSelector(
    state => state.auth.pendingProfileCompletion,
  );
  const pendingAdminApproval = useAppSelector(
    state => state.auth.pendingAdminApproval,
  );

  const initialRouteName = useMemo(() => {
    if (pendingProfileCompletion) {
      return 'CompleteProfile';
    }
    if (pendingAdminApproval) {
      return 'PendingApproval';
    }
    return authEntryRoute;
  }, [authEntryRoute, pendingAdminApproval, pendingProfileCompletion]);

  useEffect(() => {
    registerDeviceWithNotificationPermission('astrologer').catch(() => {});
  }, []);

  return (
    <Stack.Navigator
      initialRouteName={initialRouteName}
      screenOptions={{ headerShown: false, animation: 'none' }}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="OtpVerification" component={OtpVerificationScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} />
      <Stack.Screen name="CompleteProfile" component={CompleteProfileScreen} />
      <Stack.Screen name="PendingApproval" component={PendingApprovalScreen} />
      <Stack.Screen name="TermsAndConditions" component={TermsAndConditionsScreen} />
      <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
    </Stack.Navigator>
  );
}
