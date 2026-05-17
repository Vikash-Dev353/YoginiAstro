import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ComingSoonContent } from '../../components/common/ComingSoonContent';
import { AppHeader } from '../../components/common/AppHeader';
import { colors } from '../../constants/colors';
import { useTranslation } from '../../localization/useTranslation';
import { HomeStackParamList, ProfileStackParamList, RootTabParamList } from '../../navigation/types';

type ComingSoonRouteProps =
  | NativeStackScreenProps<HomeStackParamList, 'ComingSoon'>
  | NativeStackScreenProps<ProfileStackParamList, 'ComingSoon'>;

export function ComingSoonScreen({ navigation, route }: ComingSoonRouteProps) {
  const showHeader = route.params?.showHeader ?? true;
  const { t } = useTranslation();
  const headerTitle =
    route.params?.feature === 'form16a'
      ? t('profile.downloadForm')
      : t('common.goLiveNow');

  const onBackToHome = useCallback(() => {
    const tabNav =
      navigation.getParent<BottomTabNavigationProp<RootTabParamList>>();
    if (tabNav) {
      tabNav.navigate('Home', { screen: 'HomeMain' });
      return;
    }
    navigation.goBack();
  }, [navigation]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
      {showHeader ? (
        <AppHeader
          title={headerTitle}
          showBack
          onBackPress={navigation.goBack}
        />
      ) : null}

      <ComingSoonContent onBackToHome={onBackToHome} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
