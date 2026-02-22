import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { normalizeFont } from '../../utils/responsive';

type SettingListItemProps = {
  title: string;
  iconLabel: string;
  onPress?: () => void;
};

export const SettingListItem = memo(
  ({ title, iconLabel, onPress }: SettingListItemProps) => {
    return (
      <Pressable style={styles.wrapper} onPress={onPress}>
        <View style={styles.iconOuter}>
          <View style={styles.iconInner}>
            <Text style={styles.iconText}>{iconLabel}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
        </View>
      </Pressable>
    );
  },
);

const styles = StyleSheet.create({
  wrapper: {
    minHeight: 96,
    justifyContent: 'center',
    marginBottom: 14,
  },
  iconOuter: {
    position: 'absolute',
    left: 0,
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: '#F4F4F4',
    borderWidth: 1,
    borderColor: '#DCDCDC',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    shadowColor: '#000000',
    shadowOpacity: 0.07,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  iconInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: '#7A3B3B',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  iconText: {
    fontSize: normalizeFont(18),
    color: '#7A3B3B',
    fontWeight: '700',
  },
  card: {
    marginLeft: 38,
    minHeight: 72,
    borderRadius: 36,
    backgroundColor: '#F8F8F8',
    borderWidth: 1,
    borderColor: '#DCDCDC',
    justifyContent: 'center',
    paddingLeft: 86,
    paddingRight: 18,
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  title: {
    color: '#3A2222',
    fontSize: normalizeFont(20 / 1.2),
    fontWeight: '500',
  },
});
