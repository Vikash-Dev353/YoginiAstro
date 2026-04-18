import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ProfileStackParamList } from './types';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { ProfileDetailScreen } from '../screens/profile/ProfileDetailScreen';
import { ReviewScreen } from '../screens/profile/ReviewScreen';
import { SettingScreen } from '../screens/profile/SettingScreen';
import { SupportScreen } from '../screens/main/SupportScreen';
import { TermsAndConditionsScreen } from '../screens/auth/TermsAndConditionsScreen';
import { PrivacyPolicyScreen } from '../screens/auth/PrivacyPolicyScreen';
import { useTranslation } from '../localization/useTranslation';

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export function ProfileStackNavigator() {
  const { t } = useTranslation();

  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false, animation: 'none' }}
    >
      <Stack.Screen name="ProfileHome" component={ProfileScreen} />
      <Stack.Screen name="CustomerSupport" component={SupportScreen} />
      <Stack.Screen name="GoLiveNow">
        {props => <ProfileDetailScreen {...props} title={t('common.goLiveNow')} />}
      </Stack.Screen>
      <Stack.Screen name="Review" component={ReviewScreen} />
      <Stack.Screen name="Setting" component={SettingScreen} />
      <Stack.Screen
        name="TermsAndConditions"
        component={TermsAndConditionsScreen}
      />
      <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
    </Stack.Navigator>
  );
}
