import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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

export function SettingScreen({ navigation }: Props) {
  const dispatch = useAppDispatch();
  const { t } = useTranslation();
  const tabBarHeight = useBottomTabBarHeight();
  const settingItems = [
    { key: 'pay-slip', title: t('profile.paySlip'), iconLabel: 'PS' },
    { key: 'download-form', title: t('profile.downloadForm'), iconLabel: 'D' },
    { key: 'tnc', title: t('profile.termConditions'), iconLabel: 'TC' },
    { key: 'privacy', title: t('auth.privacyPolicy'), iconLabel: 'PP' },
  ];

  const onItemPress = (title: string) => {
    Alert.alert(title, 'Screen integration next step me add kar denge.');
  };

  const onLogoutPress = () => {
    dispatch(setAuthEntryRoute('Signup'));
    dispatch(logout());
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
      <AppHeader title={t('common.setting')} showBack onBackPress={navigation.goBack} />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: tabBarHeight + 126 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {settingItems.map(item => (
          <SettingListItem
            key={item.key}
            title={item.title}
            iconLabel={item.iconLabel}
            onPress={() => onItemPress(item.title)}
          />
        ))}
      </ScrollView>

      <View style={[styles.footer, { bottom: tabBarHeight + 18 }]}>
        <AppButton title={t('profile.clearDataLogout')} onPress={onLogoutPress} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: wp(4.5),
    paddingTop: hp(2),
  },
  footer: {
    position: 'absolute',
    left: wp(4.5),
    right: wp(4.5),
    bottom: 30,
  },
});
