import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader } from '../../components/common/AppHeader';
import { ProfileTabItem } from '../../components/profile/ProfileTabItem';
import { colors } from '../../constants/colors';
import { useTranslation } from '../../localization/useTranslation';
import { ProfileStackParamList } from '../../navigation/types';
import { normalizeFont, wp } from '../../utils/responsive';

type Props = NativeStackScreenProps<ProfileStackParamList, 'ProfileHome'>;

export function ProfileScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const menuItems: Array<{
    key: keyof Omit<ProfileStackParamList, 'ProfileHome'>;
    label: string;
    iconLabel: string;
  }> = [
    { key: 'CompleteProfile', label: t('common.completeProfile'), iconLabel: 'P' },
    { key: 'ProfileWallet', label: t('common.wallet'), iconLabel: 'W' },
    { key: 'CustomerSupport', label: t('common.customerSupport'), iconLabel: 'S' },
    { key: 'GoLiveNow', label: t('common.goLiveNow'), iconLabel: 'L' },
    { key: 'Review', label: t('common.review'), iconLabel: 'R' },
    { key: 'Setting', label: t('common.setting'), iconLabel: 'T' },
  ];

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
      <AppHeader title={t('profile.astrologerProfile')} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.userCard}>
          <View style={styles.userLeft}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>AS</Text>
            </View>
            <View>
              <Text style={styles.name}>Awadesh Shastri</Text>
              <Text style={styles.detail}>+919354248679</Text>
              <Text style={styles.detail}>xyx@gmail.com</Text>
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
            key={item.key}
            label={item.label}
            iconLabel={item.iconLabel}
            onPress={() => navigation.navigate(item.key)}
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
