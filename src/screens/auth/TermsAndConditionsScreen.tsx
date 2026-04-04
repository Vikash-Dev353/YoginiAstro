import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { memo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader } from '../../components/common/AppHeader';
import { colors } from '../../constants/colors';
import { useTranslation } from '../../localization/useTranslation';
import { AuthStackParamList } from '../../navigation/types';
import { hp, normalizeFont, wp } from '../../utils/responsive';

type Props = NativeStackScreenProps<AuthStackParamList, 'TermsAndConditions'>;

function TermsAndConditionsScreenComponent({ navigation }: Props) {
  const { t } = useTranslation();

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
      <AppHeader
        title={t('profile.termConditions')}
        showBack
        onBackPress={() => navigation.goBack()}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.paragraph}>
          <Text style={styles.bold}>Lorem ipsum dolor sit amet</Text>, consectetur
          adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore
          magna aliqua.
        </Text>
        <Text style={styles.paragraph}>
          <Text style={styles.bold}>Duis aute irure dolor</Text> in reprehenderit
          in voluptate velit esse cillum dolore eu fugiat nulla pariatur.
        </Text>
        <Text style={styles.paragraph}>
          <Text style={styles.bold}>Ut enim ad minim veniam</Text>, quis nostrud
          exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
        </Text>
        <Text style={styles.paragraph}>
          Excepteur sint occaecat cupidatat non proident, sunt in culpa qui
          officia deserunt mollit anim id est laborum. Sed ut perspiciatis unde
          omnis iste natus error sit voluptatem.
        </Text>
        <Text style={styles.paragraph}>
          <Text style={styles.bold}>nostrud exercitation</Text> ullamco laboris
          nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in
          reprehenderit in voluptate velit esse cillum dolore.
        </Text>
        <View style={styles.spacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

export const TermsAndConditionsScreen = memo(TermsAndConditionsScreenComponent);

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: wp(4.5),
    paddingTop: hp(2),
    paddingBottom: hp(4),
  },
  paragraph: {
    fontSize: normalizeFont(15),
    color: colors.textPrimary,
    lineHeight: 22,
    marginBottom: hp(1.5),
  },
  bold: {
    fontWeight: '700',
    color: '#3B2222',
  },
  spacer: {
    height: hp(4),
  },
});
