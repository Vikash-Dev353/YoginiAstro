import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { AppHeader } from '../../components/common/AppHeader';
import { images } from '../../assets/images';
import { colors } from '../../constants/colors';
import { translate } from '../../localization/translations';
import { useTranslation } from '../../localization/useTranslation';
import { ProfileStackParamList } from '../../navigation/types';
import {
  astroApi,
  type LatestReviewApiItem,
} from '../../services/api/astroApi';
import { useAppSelector } from '../../store/hooks';
import { hp, normalizeFont, wp } from '../../utils/responsive';

type Props = NativeStackScreenProps<ProfileStackParamList, 'Review'>;

type ReviewItem = {
  id: string;
  name: string;
  createdAt: string;
  rating: number;
  comment: string;
};

const REVIEW_LIMIT = 50;
const COMMENT_PREVIEW_CHARS = 120;

function formatReviewDate(iso?: string): string {
  if (!iso) {
    return '—';
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return iso;
  }
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const day = d.getDate();
  const month = months[d.getMonth()] ?? '';
  const yy = String(d.getFullYear()).slice(-2);
  const hours24 = d.getHours();
  const ampm = hours24 >= 12 ? 'PM' : 'AM';
  let hours12 = hours24 % 12;
  if (hours12 === 0) {
    hours12 = 12;
  }
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${day} ${month} ${yy}, ${String(hours12).padStart(2, '0')}:${mins} ${ampm}`;
}

function mapApiItemToReview(
  raw: LatestReviewApiItem,
  index: number,
  guestLabel: string,
): ReviewItem {
  const userId = raw.userId?.trim() ?? '';
  const userName = raw.userName?.trim() ?? '';
  const name =
    userName ||
    (userId ? userId : guestLabel);
  const id =
    userId && raw.date ? `${userId}-${raw.date}` : `review-${index}`;
  const rating =
    typeof raw.rating === 'number'
      ? Math.max(0, Math.min(5, Math.round(raw.rating)))
      : 0;
  return {
    id,
    name,
    createdAt: formatReviewDate(raw.date),
    rating,
    comment: raw.review?.trim() || '—',
  };
}

function Stars({ rating }: { rating: number }) {
  const stars = useMemo(() => {
    const clamped = Math.max(0, Math.min(5, rating));
    return Array.from({ length: 5 }, (_, idx) => idx < clamped);
  }, [rating]);

  return (
    <View style={styles.starsRow}>
      {stars.map((filled, idx) => (
        <Image
          // eslint-disable-next-line react/no-array-index-key
          key={`${idx}`}
          source={images.star}
          style={[styles.starIcon, !filled && { opacity: 0.28 }]}
          resizeMode="contain"
        />
      ))}
    </View>
  );
}

function ReviewCard({
  item,
  isExpanded,
  onToggle,
  showMoreLabel,
  showLessLabel,
}: {
  item: ReviewItem;
  isExpanded: boolean;
  onToggle: () => void;
  showMoreLabel: string;
  showLessLabel: string;
}) {
  const needsExpand = item.comment.length > COMMENT_PREVIEW_CHARS;

  return (
    <View style={styles.card}>
      <View style={styles.cardTopRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {item.name
              .split(' ')
              .filter(Boolean)
              .slice(0, 2)
              .map(p => p[0]?.toUpperCase())
              .join('') || '?'}
          </Text>
        </View>

        <View style={styles.metaWrap}>
          <Text style={styles.nameText}>{item.name}</Text>
          <Text style={styles.dateText}>{item.createdAt}</Text>
        </View>

        <Stars rating={item.rating} />
      </View>

      <Text
        style={styles.commentText}
        numberOfLines={isExpanded || !needsExpand ? undefined : 3}
      >
        {item.comment}
      </Text>

      {needsExpand ? (
        <Pressable style={styles.showMore} onPress={onToggle}>
          <Text style={styles.showMoreText}>
            {isExpanded ? showLessLabel : showMoreLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function ReviewScreen({ navigation }: Props) {
  const { t, appLanguage } = useTranslation();
  const tabBarHeight = useBottomTabBarHeight();
  const astroIdFromStore = useAppSelector(state => state.auth.astroId);
  const astroId =
    astroIdFromStore?.trim()?.toUpperCase() || 'AS1031';

  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [averageRating, setAverageRating] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const skipFullScreenLoader = useRef(false);
  /** Supersedes in-flight requests so stale responses never update state (e.g. rapid refocus). */
  const fetchGeneration = useRef(0);

  const loadReviews = useCallback(
    async (options?: { silent?: boolean }) => {
      const silent = options?.silent ?? false;
      const generation = ++fetchGeneration.current;
      setError(null);
      if (!silent) {
        setLoading(true);
      }
      try {
        const res = await astroApi.getLatestReviews({
          astroId,
          limit: REVIEW_LIMIT,
        });
        if (generation !== fetchGeneration.current) {
          return;
        }
        const list = res.data ?? [];
        const guestLabel = translate(appLanguage, 'reviewScreen.guestUser');
        setReviews(
          list.map((item, index) =>
            mapApiItemToReview(item, index, guestLabel),
          ),
        );
        setAverageRating(res.averageRating ?? null);
      } catch (e: unknown) {
        if (generation !== fetchGeneration.current) {
          return;
        }
        const msg =
          typeof e === 'object' &&
          e !== null &&
          'message' in e &&
          typeof (e as { message: unknown }).message === 'string'
            ? (e as { message: string }).message
            : translate(appLanguage, 'reviewScreen.error');
        setError(msg);
        setReviews([]);
      } finally {
        if (generation === fetchGeneration.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [astroId, appLanguage],
  );

  useFocusEffect(
    useCallback(() => {
      loadReviews({ silent: skipFullScreenLoader.current });
      skipFullScreenLoader.current = true;
    }, [loadReviews]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadReviews({ silent: true });
  }, [loadReviews]);

  const listHeader = useMemo(() => {
    if (!averageRating || averageRating === '') {
      return null;
    }
    return (
      <View style={styles.summaryBanner}>
        <Text style={styles.summaryLabel}>{t('reviewScreen.avgRating')}</Text>
        <Text style={styles.summaryValue}>{averageRating}</Text>
      </View>
    );
  }, [averageRating, t]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
      <AppHeader
        title={t('common.review')}
        showBack
        onBackPress={navigation.goBack}
      />

      {loading && !refreshing ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#7E3F3F" />
          <Text style={styles.hint}>{t('reviewScreen.loading')}</Text>
        </View>
      ) : null}

      {error && !loading ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={() => loadReviews({ silent: false })}>
            <Text style={styles.retryText}>{t('reviewScreen.retry')}</Text>
          </Pressable>
        </View>
      ) : null}

      {!loading && !error && reviews.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.hint}>{t('reviewScreen.empty')}</Text>
        </View>
      ) : null}

      {!loading && !error && reviews.length > 0 ? (
        <FlatList
          data={reviews}
          keyExtractor={item => item.id}
          ListHeaderComponent={listHeader}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: tabBarHeight + 18 },
          ]}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item }) => (
            <ReviewCard
              item={item}
              isExpanded={Boolean(expanded[item.id])}
              onToggle={() =>
                setExpanded(prev => ({
                  ...prev,
                  [item.id]: !prev[item.id],
                }))
              }
              showMoreLabel={t('reviewScreen.showMore')}
              showLessLabel={t('reviewScreen.showLess')}
            />
          )}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: wp(8),
  },
  hint: {
    marginTop: 10,
    color: '#6D4C4C',
    fontSize: normalizeFont(14),
    textAlign: 'center',
  },
  errorText: {
    color: '#B91C1C',
    fontSize: normalizeFont(14),
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: 14,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#7E3F3F',
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: normalizeFont(14),
  },
  summaryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8DEDE',
  },
  summaryLabel: {
    color: '#3B2222',
    fontWeight: '600',
    fontSize: normalizeFont(14),
  },
  summaryValue: {
    color: '#7E3F3F',
    fontWeight: '700',
    fontSize: normalizeFont(18),
  },
  listContent: {
    paddingHorizontal: wp(4),
    paddingTop: hp(2),
  },
  separator: {
    height: 14,
  },
  card: {
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#7E3F3F',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: '#E0D0D0',
    backgroundColor: '#6E988D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: normalizeFont(15),
  },
  metaWrap: {
    flex: 1,
  },
  nameText: {
    color: '#2E1C1C',
    fontWeight: '700',
    fontSize: normalizeFont(18),
  },
  dateText: {
    marginTop: 2,
    color: '#6D4C4C',
    fontWeight: '500',
    fontSize: normalizeFont(12),
  },
  starsRow: {
    flexDirection: 'row',
    gap: 2,
  },
  starIcon: {
    width: 18,
    height: 18,
  },
  commentText: {
    marginTop: 10,
    color: '#6D4C4C',
    fontWeight: '500',
    fontSize: normalizeFont(14),
    lineHeight: normalizeFont(20),
  },
  showMore: {
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  showMoreText: {
    color: '#7E3F3F',
    fontWeight: '700',
    fontSize: normalizeFont(14),
  },
});
