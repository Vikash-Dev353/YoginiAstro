import {
  CommonActions,
  useFocusEffect,
  useNavigation,
} from '@react-navigation/native';
import { memo, useCallback, useState } from 'react';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton } from '../../components/common/AppButton';
import { colors } from '../../constants/colors';
import { useTranslation } from '../../localization/useTranslation';
import type { AuthStackParamList } from '../../navigation/types';
import {
  astroApi,
  getAstroProfileFromGetProfileResponse,
  isAstrologerApprovedByAdmin,
} from '../../services/api/astroApi';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { applyAuthGate, logout } from '../../store/slices/authSlice';
import { hp, normalizeFont, wp } from '../../utils/responsive';

const HEADER_BG = '#3B1616';
const CREAM = '#FFF9F2';

type PendingNav = NativeStackNavigationProp<
  AuthStackParamList,
  'PendingApproval'
>;

function PendingApprovalScreenComponent() {
  const { t } = useTranslation();
  const navigation = useNavigation<PendingNav>();
  const dispatch = useAppDispatch();
  const astroId = useAppSelector(state => state.auth.astroId)?.trim() || '';
  const [checking, setChecking] = useState(false);

  const checkApproval = useCallback(async () => {
    if (!astroId) {
      return;
    }
    setChecking(true);
    try {
      const res = await astroApi.getProfile({ astroId });
      const profile = getAstroProfileFromGetProfileResponse(res);
      if (isAstrologerApprovedByAdmin(profile)) {
        await dispatch(
          applyAuthGate({
            pendingProfileCompletion: false,
            pendingAdminApproval: false,
          }),
        ).unwrap();
      }
    } finally {
      setChecking(false);
    }
  }, [astroId, dispatch]);

  useFocusEffect(
    useCallback(() => {
      void checkApproval();
    }, [checkApproval]),
  );

  const onLogout = useCallback(async () => {
    try {
      await dispatch(logout()).unwrap();
    } catch {
      /* still show login */
    }
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      }),
    );
  }, [dispatch, navigation]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('auth.pendingApprovalTitle')}</Text>
      </View>
      <View style={styles.body}>
        <View style={styles.card}>
          <Text style={styles.bodyText}>{t('auth.pendingApprovalBody')}</Text>
          <AppButton
            title={t('auth.pendingApprovalRefresh')}
            onPress={() => void checkApproval()}
            loading={checking}
          />
          <Pressable style={styles.logoutLink} onPress={onLogout}>
            <Text style={styles.logoutText}>{t('completeProfile.returnToLogin')}</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

export const PendingApprovalScreen = memo(PendingApprovalScreenComponent);

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: CREAM,
  },
  header: {
    backgroundColor: HEADER_BG,
    paddingHorizontal: wp(5),
    paddingVertical: hp(2.5),
  },
  headerTitle: {
    color: '#FFF9F2',
    fontSize: normalizeFont(18),
    fontWeight: '700',
    textAlign: 'center',
  },
  body: {
    flex: 1,
    paddingHorizontal: wp(5),
    paddingTop: hp(4),
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: wp(5),
    borderWidth: 1,
    borderColor: '#E8DDD4',
  },
  bodyText: {
    color: '#4A3A3A',
    fontSize: normalizeFont(15),
    lineHeight: 24,
    marginBottom: hp(2.5),
    textAlign: 'center',
  },
  logoutLink: {
    marginTop: hp(2),
    alignItems: 'center',
  },
  logoutText: {
    color: colors.maroon,
    fontSize: normalizeFont(14),
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
