import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ProfileStackParamList } from './types';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { ProfileDetailScreen } from '../screens/profile/ProfileDetailScreen';
import { SettingScreen } from '../screens/profile/SettingScreen';
import { useTranslation } from '../localization/useTranslation';

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export function ProfileStackNavigator() {
  const { t } = useTranslation();

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfileHome" component={ProfileScreen} />
      <Stack.Screen name="CompleteProfile">
        {props => <ProfileDetailScreen {...props} title={t('common.completeProfile')} />}
      </Stack.Screen>
      <Stack.Screen name="ProfileWallet">
        {props => <ProfileDetailScreen {...props} title={t('common.wallet')} />}
      </Stack.Screen>
      <Stack.Screen name="CustomerSupport">
        {props => <ProfileDetailScreen {...props} title={t('common.customerSupport')} />}
      </Stack.Screen>
      <Stack.Screen name="GoLiveNow">
        {props => <ProfileDetailScreen {...props} title={t('common.goLiveNow')} />}
      </Stack.Screen>
      <Stack.Screen name="Review">
        {props => <ProfileDetailScreen {...props} title={t('common.review')} />}
      </Stack.Screen>
      <Stack.Screen name="Setting" component={SettingScreen} />
    </Stack.Navigator>
  );
}
