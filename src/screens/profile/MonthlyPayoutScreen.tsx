import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
import { useTranslation } from '../../localization/useTranslation';
import { ProfileStackParamList } from '../../navigation/types';
import { astroApi } from '../../services/api/astroApi';
import { useAppSelector } from '../../store/hooks';
import type { MonthlyPayoutItem } from '../../types/monthlyPayout';
import { downloadAstrologerMonthlyReport } from '../../utils/downloadAstrologerReport';
import { mapMonthlyReportsResponse } from '../../utils/monthlyPayoutMapper';
import { hp, normalizeFont, wp } from '../../utils/responsive';

type Props = NativeStackScreenProps<ProfileStackParamList, 'MonthlyPayout'>;

const formatAmount = (amount: number) =>
  amount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export function MonthlyPayoutScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const token = useAppSelector(state => state.auth.token);
  const astroIdFromStore = useAppSelector(state => state.auth.astroId);
  const astroId = astroIdFromStore?.trim().toUpperCase() ?? '';

  const [isLoading, setIsLoading] = useState(true);
  const [payouts, setPayouts] = useState<MonthlyPayoutItem[]>([]);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const loadInFlightRef = useRef(false);
  const hasLoadedRef = useRef(false);

  const statusLabel = useMemo(
    () => ({
      paid: t('monthlyPayout.paid'),
      pending: t('monthlyPayout.pending'),
    }),
    [t],
  );

  const loadPayouts = useCallback(async () => {
    if (!token || !astroId) {
      setPayouts([]);
      setIsLoading(false);
      hasLoadedRef.current = false;
      return;
    }

    if (loadInFlightRef.current || hasLoadedRef.current) {
      return;
    }

    loadInFlightRef.current = true;
    setIsLoading(true);
    try {
      const response = await astroApi.getMonthlyReports(astroId);
      setPayouts(mapMonthlyReportsResponse(response));
      hasLoadedRef.current = true;
    } catch (error) {
      setPayouts([]);
      const message =
        (error as { message?: string })?.message ??
        'Failed to load monthly payouts';
      Alert.alert(t('monthlyPayout.downloadUnavailableTitle'), message);
    } finally {
      setIsLoading(false);
      loadInFlightRef.current = false;
    }
  }, [astroId, token]);

  useFocusEffect(
    useCallback(() => {
      void loadPayouts();
      return () => {
        hasLoadedRef.current = false;
      };
    }, [loadPayouts]),
  );

  const onDownload = useCallback(
    async (item: MonthlyPayoutItem) => {
      if (!token || !astroId) {
        Alert.alert(
          t('monthlyPayout.downloadUnavailableTitle'),
          t('monthlyPayout.downloadUnavailable'),
        );
        return;
      }

      if (item.month == null || item.year == null) {
        Alert.alert(
          t('monthlyPayout.downloadUnavailableTitle'),
          t('monthlyPayout.downloadUnavailable'),
        );
        return;
      }

      if (downloadingId) {
        return;
      }

      setDownloadingId(item.id);
      try {
        // Let React paint the row spinner before the download work starts.
        await new Promise<void>(resolve => {
          requestAnimationFrame(() => resolve());
        });
        await downloadAstrologerMonthlyReport({
          astroId,
          month: item.month,
          year: item.year,
          token,
        });
      } catch (error) {
        Alert.alert(
          t('monthlyPayout.downloadUnavailableTitle'),
          (error as { message?: string })?.message ??
            t('monthlyPayout.downloadFailed'),
        );
      } finally {
        setDownloadingId(null);
      }
    },
    [astroId, downloadingId, t, token],
  );

  const renderItem = useCallback(
    ({ item }: { item: MonthlyPayoutItem }) => {
      const isPaid = item.status === 'paid';
      const statusColor = isPaid ? styles.statusPaid : styles.statusPending;
      const isDownloading = downloadingId === item.id;

      return (
        <View style={styles.card}>
          <View style={styles.cardBody}>
            <Text style={styles.monthText}>
              {item.monthLabel}{' '}
              <Text style={statusColor}>( {statusLabel[item.status]} )</Text>
            </Text>
            <Text style={styles.amountText}>
              ( ₹ {formatAmount(item.amount)} )
            </Text>
          </View>

          <Pressable
            onPress={() => onDownload(item)}
            disabled={isDownloading || downloadingId != null}
            style={({ pressed }) => [
              styles.downloadButton,
              (pressed || isDownloading) && styles.downloadPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={
              isDownloading
                ? t('monthlyPayout.downloading')
                : t('monthlyPayout.download')
            }
          >
            {isDownloading ? (
              <ActivityIndicator size="small" color="#3B2222" />
            ) : (
              <DownloadIcon size={30} color="#3B2222" />
            )}
          </Pressable>
        </View>
      );
    },
    [downloadingId, onDownload, statusLabel, t],
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
          keyExtractor={item => item.id}
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
