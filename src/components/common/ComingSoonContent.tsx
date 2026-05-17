import { Image, StyleSheet, Text, View } from 'react-native';
import { images } from '../../assets/images';
import { AppButton } from './AppButton';
import { useTranslation } from '../../localization/useTranslation';
import { hp, normalizeFont, wp } from '../../utils/responsive';

type ComingSoonContentProps = {
  onBackToHome: () => void;
};

export function ComingSoonContent({ onBackToHome }: ComingSoonContentProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.content}>
      <View style={styles.logoWrap}>
        <Image source={images.logo} style={styles.logo} resizeMode="contain" />
      </View>

      <View style={styles.titleBlock}>
        <Text style={styles.titleLine}>{t('comingSoon.titleLine1')}</Text>
        <Text style={styles.titleLine}>{t('comingSoon.titleLine2')}</Text>
      </View>

      <AppButton
        title={t('comingSoon.backToHome')}
        onPress={onBackToHome}
        containerStyle={styles.button}
        textStyle={styles.buttonText}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: wp(6),
    paddingBottom: hp(4),
  },
  logoWrap: {
    width: wp(72),
    height: wp(72),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: hp(2),
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  titleBlock: {
    alignItems: 'center',
    marginBottom: hp(4),
  },
  titleLine: {
    fontSize: normalizeFont(44),
    fontWeight: '900',
    color: '#1F1212',
    lineHeight: normalizeFont(48),
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  button: {
    alignSelf: 'stretch',
    height: 56,
    borderRadius: 28,
    backgroundColor: '#3B201A',
  },
  buttonText: {
    fontSize: normalizeFont(17),
    fontWeight: '600',
  },
});
