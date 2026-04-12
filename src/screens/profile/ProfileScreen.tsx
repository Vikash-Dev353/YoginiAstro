import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader } from '../../components/common/AppHeader';
import { ProfileTabItem } from '../../components/profile/ProfileTabItem';
import { colors } from '../../constants/colors';
import { useTranslation } from '../../localization/useTranslation';
import { ProfileStackParamList, RootTabParamList } from '../../navigation/types';
import {
  astroApi,
  getAstrologerFromOnlineResponse,
} from '../../services/api/astroApi';
import { useAppSelector } from '../../store/hooks';
import { normalizeFont, wp } from '../../utils/responsive';

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  if (parts.length === 1 && parts[0].length >= 2) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return parts[0]?.[0]?.toUpperCase() ?? '—';
}

type Props = NativeStackScreenProps<ProfileStackParamList, 'ProfileHome'>;

type ProfileMenuRoute = Exclude<
  keyof Omit<ProfileStackParamList, 'ProfileHome'>,
  'TermsAndConditions' | 'PrivacyPolicy'
>;

type MenuItem =
  | { kind: 'stack'; route: ProfileMenuRoute; label: string; iconLabel: string }
  | { kind: 'walletTab'; label: string; iconLabel: string };

export function ProfileScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const token = useAppSelector(state => state.auth.token);
  const astroId =
    useAppSelector(state => state.auth.astroId)?.trim()?.toUpperCase() ||
    'AS1031';

  const [displayName, setDisplayName] = useState('');
  const [mobile, setMobile] = useState('');
  const [profileImageUri, setProfileImageUri] = useState<string | undefined>();
  const [imageFailed, setImageFailed] = useState(false);

  const loadProfile = useCallback(async () => {
    try {
      const response = await astroApi.getOnline({ astroId });
      const astrologer = getAstrologerFromOnlineResponse(response);
      if (astrologer?.name) {
        setDisplayName(astrologer.name);
      }
      if (astrologer?.mobile) {
        setMobile(astrologer.mobile);
      }
      const uri = astrologer?.profileImage?.trim();
      setProfileImageUri(uri && uri.length > 0 ? uri : undefined);
      setImageFailed(false);
    } catch {
      // keep previous values / empty
    }
  }, [astroId]);

  useEffect(() => {
    if (!token) {
      return;
    }
    loadProfile();
  }, [loadProfile, token]);

  const avatarLabel = useMemo(
    () => initialsFromName(displayName || astroId),
    [displayName, astroId],
  );

  const menuItems: MenuItem[] = [
    { kind: 'walletTab', label: t('common.wallet'), iconLabel: 'W' },
    { kind: 'stack', route: 'CustomerSupport', label: t('common.customerSupport'), iconLabel: 'S' },
    { kind: 'stack', route: 'GoLiveNow', label: t('common.goLiveNow'), iconLabel: 'L' },
    { kind: 'stack', route: 'Review', label: t('common.review'), iconLabel: 'R' },
    { kind: 'stack', route: 'Setting', label: t('common.setting'), iconLabel: 'T' },
  ];

  const onMenuPress = (item: MenuItem) => {
    if (item.kind === 'walletTab') {
      navigation
        .getParent<BottomTabNavigationProp<RootTabParamList>>()
        ?.navigate('Wallet');
      return;
    }
    navigation.navigate(item.route);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
      <AppHeader title={t('profile.astrologerProfile')} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.userCard}>
          <View style={styles.userLeft}>
            <View style={styles.avatar}>
              {profileImageUri && !imageFailed ? (
                <Image
                  source={{ uri: profileImageUri }}
                  style={styles.avatarImage}
                  resizeMode="cover"
                  onError={() => setImageFailed(true)}
                />
              ) : (
                <Text style={styles.avatarText}>{avatarLabel}</Text>
              )}
            </View>
            <View>
              <Text style={styles.name} numberOfLines={2}>
                {displayName || '—'}
              </Text>
              <Text style={styles.detail}>
                {mobile ? `+91 ${mobile}` : '—'}
              </Text>
            </View>
          </View>

          <View style={styles.progressWrap}>
            <View style={styles.progressCircle}>
              <Text style={styles.progressText}>40%</Text>
            </View>
          </View>
        </View>

        {menuItems.map(item => (
          <ProfileTabItem
            key={item.kind === 'walletTab' ? 'walletTab' : item.route}
            label={item.label}
            iconLabel={item.iconLabel}
            onPress={() => onMenuPress(item)}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: wp(4),
    paddingVertical: 14,
    paddingBottom: 120,
  },
  userCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2DEDE',
    backgroundColor: '#FFFFFF',
    minHeight: 102,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000000',
    shadowOpacity: 0.07,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  userLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: '#7B4949',
    backgroundColor: '#F2D783',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    fontSize: normalizeFont(14),
    color: '#5A2525',
    fontWeight: '700',
  },
  name: {
    fontSize: normalizeFont(30 / 1.8),
    color: '#3B2222',
    fontWeight: '700',
  },
  detail: {
    marginTop: 1,
    fontSize: normalizeFont(14),
    color: '#6D4C4C',
    fontWeight: '600',
  },
  progressWrap: {
    width: 56,
    alignItems: 'center',
  },
  progressCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 6,
    borderColor: '#A67A7A',
    borderTopColor: '#D8D8D8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressText: {
    fontSize: normalizeFont(12),
    color: '#3A2121',
    fontWeight: '700',
  },
});
