import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { AppHeader } from '../../components/common/AppHeader';
import { images } from '../../assets/images';
import { colors } from '../../constants/colors';
import { useTranslation } from '../../localization/useTranslation';
import { ProfileStackParamList } from '../../navigation/types';
import { hp, normalizeFont, wp } from '../../utils/responsive';

type Props = NativeStackScreenProps<ProfileStackParamList, 'Review'>;

type ReviewItem = {
  id: string;
  name: string;
  createdAt: string;
  rating: number; // 0..5
  comment: string;
};

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
}: {
  item: ReviewItem;
  isExpanded: boolean;
  onToggle: () => void;
}) {
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
              .join('')}
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
        numberOfLines={isExpanded ? undefined : 2}
      >
        {item.comment}
      </Text>

      <Pressable style={styles.showMore} onPress={onToggle}>
        <Text style={styles.showMoreText}>Show More</Text>
      </Pressable>
    </View>
  );
}

export function ReviewScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const tabBarHeight = useBottomTabBarHeight();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const reviews: ReviewItem[] = useMemo(
    () => [
      {
        id: '1',
        name: 'Shanky',
        createdAt: '14 Jan 26, 05:45 AM',
        rating: 5,
        comment:
          'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor consectetur adipiscing incididunt ut.',
      },
      {
        id: '2',
        name: 'Shanky',
        createdAt: '14 Jan 26, 05:45 AM',
        rating: 5,
        comment:
          'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor consectetur adipiscing incididunt ut.',
      },
      {
        id: '3',
        name: 'Shanky',
        createdAt: '14 Jan 26, 05:45 AM',
        rating: 4,
        comment:
          'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor consectetur adipiscing incididunt ut.',
      },
      {
        id: '4',
        name: 'Shanky',
        createdAt: '14 Jan 26, 05:45 AM',
        rating: 5,
        comment:
          'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor consectetur adipiscing incididunt ut.',
      },
      {
        id: '4',
        name: 'Shanky',
        createdAt: '14 Jan 26, 05:45 AM',
        rating: 5,
        comment:
          'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor consectetur adipiscing incididunt ut.',
      },
      {
        id: '4',
        name: 'Shanky',
        createdAt: '14 Jan 26, 05:45 AM',
        rating: 5,
        comment:
          'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor consectetur adipiscing incididunt ut.',
      },
    ],
    [],
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <AppHeader
        title={t('common.review')}
        showBack
        onBackPress={navigation.goBack}
      />

      <FlatList
        data={reviews}
        keyExtractor={item => item.id}
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
              setExpanded(prev => ({ ...prev, [item.id]: !prev[item.id] }))
            }
          />
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
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

