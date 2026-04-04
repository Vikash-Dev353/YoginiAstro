import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { memo, useCallback } from 'react';
import {
  Alert,
  Image,
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { images } from '../../assets/images';
import { AppHeader } from '../../components/common/AppHeader';
import { colors } from '../../constants/colors';
import { useTranslation } from '../../localization/useTranslation';
import { HomeStackParamList, ProfileStackParamList } from '../../navigation/types';
import { hp, normalizeFont, wp } from '../../utils/responsive';

const SUPPORT_PHONE = '9355575790';
const SUPPORT_EMAIL = 'info@yoginiastro.com';

type SupportRouteProps =
  | NativeStackScreenProps<HomeStackParamList, 'Support'>
  | NativeStackScreenProps<ProfileStackParamList, 'CustomerSupport'>;

function SupportScreenComponent({ navigation }: SupportRouteProps) {
  const { t } = useTranslation();

  const openDialer = useCallback(async () => {
    const url = `tel:${SUPPORT_PHONE}`;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert(t('support.openFailedTitle'), t('support.dialerUnavailable'));
    }
  }, [t]);

  const openMail = useCallback(async () => {
    const url = `mailto:${SUPPORT_EMAIL}`;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert(t('support.openFailedTitle'), t('support.mailUnavailable'));
    }
  }, [t]);

  return (
    <SafeAreaView style={styles.safe}>
      <AppHeader
        title={t('common.customerSupport')}
        showBack
        onBackPress={() => navigation.goBack()}
      />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.heroWrap}>
          <View style={styles.heroShadow}>
            <View style={styles.heroCircle}>
              <Image
                source={images.streamlineCustomerSupportSolid}
                style={styles.heroImage}
                resizeMode="contain"
              />
            </View>
          </View>
        </View>

        <Text style={styles.headline}>{t('support.headline')}</Text>
        <Text style={styles.subheadline}>{t('support.subheadline')}</Text>

        <Pressable
          style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          onPress={openDialer}
        >
          <Image source={images.call} style={styles.cardIcon} resizeMode="contain" />
          <Text style={styles.cardText}>{SUPPORT_PHONE}</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          onPress={openMail}
        >
          <Image
            source={images.tabNotification}
            style={styles.cardIcon}
            resizeMode="contain"
          />
          <Text style={[styles.cardText, styles.emailText]}>{SUPPORT_EMAIL}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

export const SupportScreen = memo(SupportScreenComponent);

const maroonText = '#3E2723';

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scroll: {
    paddingHorizontal: wp(6),
    paddingTop: hp(2),
    paddingBottom: 120,
    alignItems: 'center',
  },
  heroWrap: {
    marginTop: hp(1),
    marginBottom: hp(2.5),
    alignItems: 'center',
  },
  heroShadow: {
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  heroCircle: {
    width: 132,
    height: 132,
    borderRadius: 66,
    backgroundColor: '#FFF5EE',
    borderWidth: 3,
    borderColor: '#E8D5D0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroImage: {
    width: 64,
    height: 64,
    tintColor: '#5A2A2A',
  },
  headline: {
    textAlign: 'center',
    fontSize: normalizeFont(17),
    fontWeight: '700',
    color: '#1A1A1A',
    paddingHorizontal: 12,
  },
  subheadline: {
    marginTop: 8,
    textAlign: 'center',
    fontSize: normalizeFont(15),
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: hp(3),
    paddingHorizontal: 12,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginBottom: 14,
    gap: 14,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
    borderWidth: 1,
    borderColor: '#EEEAEA',
  },
  cardPressed: {
    opacity: 0.92,
  },
  cardIcon: {
    width: 26,
    height: 26,
    tintColor: maroonText,
  },
  cardText: {
    flex: 1,
    fontSize: normalizeFont(16),
    fontWeight: '700',
    color: maroonText,
  },
  emailText: {
    textDecorationLine: 'underline',
  },
});
