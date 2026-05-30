import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ProfileStackParamList } from './types';
import { CompleteProfileScreen } from '../screens/profile/CompleteProfileScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { ComingSoonScreen } from '../screens/common/ComingSoonScreen';
import { ReviewScreen } from '../screens/profile/ReviewScreen';
import { MonthlyPayoutScreen } from '../screens/profile/MonthlyPayoutScreen';
import { SettingScreen } from '../screens/profile/SettingScreen';
import { SupportScreen } from '../screens/main/SupportScreen';
import { TermsAndConditionsScreen } from '../screens/auth/TermsAndConditionsScreen';
import { PrivacyPolicyScreen } from '../screens/auth/PrivacyPolicyScreen';

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export function ProfileStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false, animation: 'none' }}
    >
      <Stack.Screen name="ProfileHome" component={ProfileScreen} />
      <Stack.Screen name="EditProfile" component={CompleteProfileScreen} />
      <Stack.Screen name="CustomerSupport" component={SupportScreen} />
      <Stack.Screen name="GoLiveNow" component={ComingSoonScreen} />
      <Stack.Screen name="ComingSoon" component={ComingSoonScreen} />
      <Stack.Screen name="Review" component={ReviewScreen} />
      <Stack.Screen name="Setting" component={SettingScreen} />
      <Stack.Screen name="MonthlyPayout" component={MonthlyPayoutScreen} />
      <Stack.Screen
        name="TermsAndConditions"
        component={TermsAndConditionsScreen}
      />
      <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
    </Stack.Navigator>
  );
}
