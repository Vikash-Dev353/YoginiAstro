import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { images } from '../../assets/images';
import { colors } from '../../constants/colors';
import { normalizeFont } from '../../utils/responsive';

type ProfileTabItemProps = {
  label: string;
  iconLabel: string;
  onPress: () => void;
};

export function ProfileTabItem({ label, iconLabel, onPress }: ProfileTabItemProps) {
  return (
    <Pressable onPress={onPress} style={styles.item}>
      <View style={styles.leftBlock}>
        <View style={styles.iconCircle}>
          <Text style={styles.iconLabel}>{iconLabel}</Text>
        </View>
        <Text style={styles.label}>{label}</Text>
      </View>
      <Image source={images.chevronRight} style={styles.arrowImage} resizeMode="contain" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  item: {
    marginTop: 16,
    borderRadius: 30,
    minHeight: 58,
    borderWidth: 2,
    borderColor: '#7E3F3F',
    backgroundColor: '#F8F8F8',
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#7E3F3F',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  iconLabel: {
    fontSize: normalizeFont(11),
    color: '#7E3F3F',
    fontWeight: '700',
  },
  label: {
    fontSize: normalizeFont(19 / 1.2),
    color: '#3A2121',
    fontWeight: '500',
  },
  arrowImage: {
    width: 16,
    height: 16,
    tintColor: colors.maroon,
  },
});
