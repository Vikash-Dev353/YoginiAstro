import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../constants/colors';
import { normalizeFont } from '../../utils/responsive';
import { images } from '../../assets/images';

type AppHeaderProps = {
  title: string;
  showBack?: boolean;
  onBackPress?: () => void;
};

export function AppHeader({
  title,
  showBack = false,
  onBackPress,
}: AppHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.bar}>
        <View style={styles.leftSlot}>
          {showBack ? (
            <Pressable
              onPress={onBackPress}
              hitSlop={12}
              style={styles.backButton}
            >
              <Image source={images.leftArrow} resizeMode="contain" />
            </Pressable>
          ) : null}
        </View>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.rightSlot} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: '#F7F5F4',
    borderBottomWidth: 1,
    borderBottomColor: '#D2D2D2',
  },
  bar: {
    minHeight: 56,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftSlot: {
    width: 34,
    alignItems: 'flex-start',
  },
  rightSlot: {
    width: 34,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#8A5555',
    backgroundColor: '#FFFFFF',
  },
  backText: {
    fontSize: normalizeFont(18),
    color: colors.maroon,
    fontWeight: '700',
    marginTop: -2,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: normalizeFont(26 / 1.6),
    fontWeight: '700',
    color: '#3B2222',
  },
});
