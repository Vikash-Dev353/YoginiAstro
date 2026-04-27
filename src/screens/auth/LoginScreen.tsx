import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { memo, useCallback, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton } from '../../components/common/AppButton';
import { AppInput } from '../../components/common/AppInput';
import { colors } from '../../constants/colors';
import { useTranslation } from '../../localization/useTranslation';
import { AuthStackParamList } from '../../navigation/types';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { clearAuthError, sendOtp } from '../../store/slices/authSlice';
import { hp, normalizeFont, wp } from '../../utils/responsive';
import { images } from '../../assets/images';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

function LoginScreenComponent({ navigation }: Props) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { loading, error: apiError } = useAppSelector(state => state.auth);
  const [mobile, setMobile] = useState('');
  const [localError, setLocalError] = useState('');

  const onMobileChange = useCallback(
    (value: string) => {
      const onlyDigits = value.replace(/\D/g, '').slice(0, 10);
      setMobile(onlyDigits);
      if (localError) {
        setLocalError('');
      }
      if (apiError) {
        dispatch(clearAuthError());
      }
    },
    [apiError, dispatch, localError],
  );

  const onGetOtp = useCallback(async () => {
    if (mobile.length !== 10) {
      setLocalError(t('auth.invalidMobile'));
      return;
    }
    setLocalError('');
    dispatch(clearAuthError());

    try {
      const response = await dispatch(sendOtp({ mobile })).unwrap();
      if (response.status?.toLowerCase() === 'success') {
        navigation.navigate('OtpVerification', { mobile });
        return;
      }
      setLocalError(
        response.message || 'Unable to send OTP. Please try again.',
      );
    } catch {
      console.log('errpr');
    }
  }, [dispatch, mobile, navigation, t]);

  const onSignupPress = useCallback(() => {
    navigation.navigate('Signup');
  }, [navigation]);

  const onTermsPress = useCallback(() => {
    navigation.navigate('TermsAndConditions');
  }, [navigation]);

  const onPrivacyPress = useCallback(() => {
    navigation.navigate('PrivacyPolicy');
  }, [navigation]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          bounces={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
        >
          <View>
            <View style={styles.logoSection}>
              <Image
                source={images.logo}
                style={styles.headerIconImage}
                resizeMode="contain"
              />
            </View>

            <AppInput
              label={t('auth.mobileNumber')}
              required
              value={mobile}
              onChangeText={onMobileChange}
              keyboardType="number-pad"
              placeholder={t('auth.enterMobile')}
              maxLength={10}
              wrapperStyle={styles.inputBlock}
              leftAdornment={<Text style={styles.prefix}>IN +91</Text>}
            />

            {localError || apiError ? (
              <Text style={styles.error}>{localError || apiError}</Text>
            ) : null}

            <Text style={styles.termsText}>
              {`${t('auth.termsPrefix')} `}
              <Text style={styles.termsLink} onPress={onTermsPress}>
                {t('auth.termsOfUse')}
              </Text>
              {` ${t('common.and')} `}
              <Text style={styles.termsLink} onPress={onPrivacyPress}>
                {t('auth.privacyPolicy')}
              </Text>
            </Text>
          </View>

          <View style={styles.bottomSection}>
            <AppButton
              title={t('auth.getOtp')}
              onPress={onGetOtp}
              loading={loading}
            />

            {/* <View style={styles.signupRow}>
              <Text style={styles.signupHint}>{t('auth.noAccount')}</Text>
              <Pressable onPress={onSignupPress}>
                <Text style={styles.signupLink}>{` ${t(
                  'common.signup',
                )}`}</Text>
              </Pressable>
            </View> */}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export const LoginScreen = memo(LoginScreenComponent);

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  headerIconImage:{
    width:250,
    height:250, 
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingHorizontal: wp(4.5),
    paddingBottom: hp(4),
    paddingTop: hp(4),
  },
  logoSection: {
    alignItems: 'center',
    marginTop: hp(2),
    marginBottom: hp(6),
  },
  logoCircle: {
    width: wp(44),
    height: wp(44),
    borderRadius: wp(22),
    borderWidth: 2,
    borderColor: '#6C3535',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F7EFEE',
  },
  logoOm: {
    fontSize: normalizeFont(42),
    color: colors.maroon,
    fontWeight: '700',
  },
  brand: {
    marginTop: 12,
    color: '#141111',
    fontSize: normalizeFont(45 / 2),
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  tagline: {
    marginTop: 6,
    color: '#524C4C',
    fontSize: normalizeFont(10),
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  inputBlock: {
    marginBottom: 12,
  },
  prefix: {
    fontSize: normalizeFont(16 / 1.1),
    color: '#2F2A2A',
  },
  error: {
    color: colors.error,
    marginBottom: 8,
    fontSize: normalizeFont(12),
  },
  termsText: {
    marginTop: 4,
    color: '#6E6A6A',
    fontSize: normalizeFont(29 / 2.4),
    textAlign: 'center',
    lineHeight: 22,
  },
  termsLink: {
    color: '#413D3D',
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
  bottomSection: {
    paddingBottom: hp(2),
  },
  signupRow: {
    marginTop: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  signupHint: {
    color: '#6E6A6A',
    fontSize: normalizeFont(30 / 2.3),
  },
  signupLink: {
    color: '#2B2424',
    fontSize: normalizeFont(31 / 2.3),
    fontWeight: '700',
  },
});
