import { memo } from 'react';
import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { images } from '../../assets/images';
import { colors } from '../../constants/colors';
import { useTranslation } from '../../localization/useTranslation';
import { hp, normalizeFont, wp } from '../../utils/responsive';

type NoDataFoundProps = {
  title?: string;
  message?: string;
  style?: StyleProp<ViewStyle>;
};

export const NoDataFound = memo(({ title, message, style }: NoDataFoundProps) => {
  const { t } = useTranslation();

  return (
    <View style={[styles.wrap, style]}>
      <Image source={images.logo} style={styles.logo} resizeMode="contain" />
      <Text style={styles.title}>{title ?? t('common.noDataFound')}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: wp(8),
    paddingVertical: hp(4),
  },
  logo: {
    width: wp(40),
    height: wp(40),
    marginBottom: 16,
  },
  title: {
    fontSize: normalizeFont(20),
    fontWeight: '700',
    color: '#3B2222',
    textAlign: 'center',
  },
  message: {
    marginTop: 8,
    fontSize: normalizeFont(15),
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: normalizeFont(22),
  },
});
