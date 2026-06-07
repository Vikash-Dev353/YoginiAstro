import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Alert, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppButton } from '../../components/common/AppButton';
import { AppHeader } from '../../components/common/AppHeader';
import { SettingListItem } from '../../components/profile/SettingListItem';
import { colors } from '../../constants/colors';
import { useTranslation } from '../../localization/useTranslation';
import { ProfileStackParamList } from '../../navigation/types';
import { useAppDispatch } from '../../store/hooks';
import { logout, setAuthEntryRoute } from '../../store/slices/authSlice';
import { hp, wp } from '../../utils/responsive';

type Props = NativeStackScreenProps<ProfileStackParamList, 'Setting'>;

export function SettingScreen({ navigation, route }: Props) {
  const dispatch = useAppDispatch();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const fallbackTabBarHeight = 72;
  const effectiveTabBarHeight =
    tabBarHeight > 0 ? tabBarHeight : fallbackTabBarHeight;
  const scrollBottomPadding = effectiveTabBarHeight + insets.bottom + 24;
  const settingItems = [
    { key: 'pay-slip', title: t('profile.paySlip'), iconLabel: 'MP' },
    { key: 'download-form', title: t('profile.downloadForm'), iconLabel: 'D' },
    { key: 'tnc', title: t('profile.termConditions'), iconLabel: 'TC' },
    { key: 'privacy', title: t('auth.privacyPolicy'), iconLabel: 'PP' },
  ] as const;

  const onItemPress = (key: (typeof settingItems)[number]['key']) => {
    if (key === 'tnc') {
      navigation.navigate('TermsAndConditions');
      return;
    }
    if (key === 'privacy') {
      navigation.navigate('PrivacyPolicy');
      return;
    }
    if (key === 'pay-slip') {
      navigation.navigate('MonthlyPayout');
      return;
    }
    if (key === 'download-form') {
      navigation.navigate('ComingSoon', { feature: 'form16a' });
      return;
    }
    Alert.alert(
      settingItems.find(i => i.key === key)?.title ?? '',
      'Screen integration next step me add kar denge.',
    );
  };

  const performLogout = () => {
    dispatch(setAuthEntryRoute('Signup'));
    dispatch(logout());
  };

  const onLogoutPress = () => {
    Alert.alert(
      t('profile.clearDataLogoutConfirmTitle'),
      t('profile.clearDataLogoutConfirmMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.confirm'),
          style: 'destructive',
          onPress: performLogout,
        },
      ],
    );
  };

  const onBackPress = () => {
    if (route.params?.fromHomeScreen) {
      navigation
        .getParent()
        ?.navigate('Home', { screen: 'HomeMain' });
      return;
    }
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
      <AppHeader title={t('common.setting')} showBack onBackPress={onBackPress} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: scrollBottomPadding },
        ]}
        showsVerticalScrollIndicator
        keyboardShouldPersistTaps="handled"
        bounces
      >
        {settingItems.map(item => (
          <SettingListItem
            key={item.key}
            title={item.title}
            iconLabel={item.iconLabel}
            onPress={() => onItemPress(item.key)}
          />
        ))}
        <AppButton
          title={t('profile.clearDataLogout')}
          onPress={onLogoutPress}
          containerStyle={styles.logoutButton}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: wp(4.5),
    paddingTop: hp(2),
  },
  logoutButton: {
    marginTop: hp(1),
  },
});
