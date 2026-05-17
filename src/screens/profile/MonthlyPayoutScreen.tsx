import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppGifLoader } from '../../components/common/AppGifLoader';
import { AppHeader } from '../../components/common/AppHeader';
import { DownloadIcon } from '../../components/common/DownloadIcon';
import { colors } from '../../constants/colors';
import { MOCK_MONTHLY_PAYOUTS } from '../../data/mockMonthlyPayouts';
import { useTranslation } from '../../localization/useTranslation';
import { ProfileStackParamList } from '../../navigation/types';
import type { MonthlyPayoutItem } from '../../types/monthlyPayout';
import { hp, normalizeFont, wp } from '../../utils/responsive';

type Props = NativeStackScreenProps<ProfileStackParamList, 'MonthlyPayout'>;

const formatAmount = (amount: number) =>
  amount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export function MonthlyPayoutScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const [isLoading] = useState(false);
  const [payouts] = useState<MonthlyPayoutItem[]>(MOCK_MONTHLY_PAYOUTS);

  const statusLabel = useMemo(
    () => ({
      paid: t('monthlyPayout.paid'),
      pending: t('monthlyPayout.pending'),
    }),
    [t],
  );

  const onDownload = useCallback(
    async (item: MonthlyPayoutItem) => {
      const url = item.downloadUrl?.trim();
      if (!url) {
        Alert.alert(t('monthlyPayout.downloadUnavailableTitle'), t('monthlyPayout.downloadUnavailable'));
        return;
      }
      try {
        await Linking.openURL(url);
      } catch {
        Alert.alert(t('monthlyPayout.downloadUnavailableTitle'), t('monthlyPayout.downloadFailed'));
      }
    },
    [t],
  );

  const renderItem = useCallback(
    ({ item }: { item: MonthlyPayoutItem }) => {
      const isPaid = item.status === 'paid';
      const statusColor = isPaid ? styles.statusPaid : styles.statusPending;

      return (
        <View style={styles.card}>
          <View style={styles.cardBody}>
            <Text style={styles.monthText}>
              {item.monthLabel}{' '}
              <Text style={statusColor}>
                ( {statusLabel[item.status]} )
              </Text>
            </Text>
            <Text style={styles.amountText}>( ₹ {formatAmount(item.amount)} )</Text>
          </View>

          <Pressable
            onPress={() => onDownload(item)}
            style={({ pressed }) => [styles.downloadButton, pressed && styles.downloadPressed]}
            accessibilityRole="button"
            accessibilityLabel={t('monthlyPayout.download')}
          >
            <DownloadIcon size={30} color="#3B2222" />
          </Pressable>
        </View>
      );
    },
    [onDownload, statusLabel, t],
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
      <AppHeader
        title={t('profile.paySlip')}
        showBack
        onBackPress={navigation.goBack}
      />

      {isLoading ? (
        <View style={styles.loaderWrap}>
          <AppGifLoader message={t('monthlyPayout.loading')} size={100} />
        </View>
      ) : (
        <FlatList
          data={payouts}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>{t('monthlyPayout.empty')}</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loaderWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: wp(4.5),
    paddingTop: hp(2),
    paddingBottom: hp(3),
    gap: 14,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#8A5555',
    paddingVertical: 16,
    paddingLeft: 18,
    paddingRight: 12,
    minHeight: 88,
  },
  cardBody: {
    flex: 1,
    paddingRight: 8,
  },
  monthText: {
    fontSize: normalizeFont(18),
    fontWeight: '700',
    color: '#3B2222',
    lineHeight: normalizeFont(26),
  },
  statusPaid: {
    color: '#1F8A3B',
    fontWeight: '500',
    fontSize: normalizeFont(14),
  },
  statusPending: {
    color: '#C9A227',
    fontWeight: '500',
    fontSize: normalizeFont(14),
  },
  amountText: {
    marginTop: 6,
    fontSize: normalizeFont(16),
    fontWeight: '500',
    color: '#1F8A3B',
  },
  downloadButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  downloadPressed: {
    opacity: 0.65,
  },
  emptyWrap: {
    paddingTop: hp(8),
    alignItems: 'center',
  },
  emptyText: {
    fontSize: normalizeFont(16),
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
