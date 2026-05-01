import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { memo, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppHeader } from '../../components/common/AppHeader';
import { colors } from '../../constants/colors';
import { useTranslation } from '../../localization/useTranslation';
import { AuthStackParamList, ProfileStackParamList } from '../../navigation/types';
import { hp, normalizeFont, wp } from '../../utils/responsive';

type Props = NativeStackScreenProps<
  AuthStackParamList & ProfileStackParamList,
  'PrivacyPolicy'
>;

function PrivacyPolicyScreenComponent({ navigation }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  /** Tab bar sits above home indicator; padding must work in Auth stack (no tabs) too—avoid useBottomTabBarHeight here. */
  const scrollBottomPadding = useMemo(
    () => insets.bottom + 88 + hp(3),
    [insets.bottom],
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
      <AppHeader
        title={t('auth.privacyPolicy')}
        showBack
        onBackPress={() => navigation.goBack()}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: scrollBottomPadding },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.leadParagraph}>
          Welcome to Yogini Astro. This Privacy Policy explains how we collect,
          use, disclose, and safeguard your information when you use our
          websites, mobile apps, and astrology-related services (collectively,
          the &quot;Services&quot;). By using our Services, you agree to the
          practices described in this Policy.
        </Text>
        <Text style={styles.paragraph}>
          <Text style={styles.bold}>1. Introduction</Text>
          {'\n\n'}
          Yogini Astro values your privacy. This policy explains how we collect,
          use, and safeguard your information.
        </Text>
        <Text style={styles.paragraph}>
          <Text style={styles.bold}>2. Data We Collect</Text>
          {'\n\n'}
          {'\u2022'} Name, contact information, date of birth, and birth details.
          {'\n'}
          {'\u2022'} Wallet transactions and payment history.
          {'\n'}
          {'\u2022'} Device metadata and Platform usage information.
        </Text>
        <Text style={styles.paragraph}>
          <Text style={styles.bold}>3. How We Use Data</Text>
          {'\n\n'}
          {'\u2022'} To provide astrology consultations and generate reports.
          {'\n'}
          {'\u2022'} To process secure payments and maintain wallet services.
          {'\n'}
          {'\u2022'} To improve Platform features and user experience.
        </Text>
        <Text style={styles.paragraph}>
          <Text style={styles.bold}>4. Data Sharing</Text>
          {'\n\n'}
          We may share limited data with third-party providers (for example,
          payment gateways and analytics). We do not sell, trade, or lease your
          personal data.
        </Text>
        <Text style={styles.paragraph}>
          <Text style={styles.bold}>5. Data Security</Text>
          {'\n\n'}
          All personal data is stored securely using encryption. Access is
          restricted to authorized personnel only.
        </Text>
        <Text style={styles.paragraph}>
          <Text style={styles.bold}>6. Your Rights</Text>
          {'\n\n'}
          {'\u2022'} Request access to your personal data.
          {'\n'}
          {'\u2022'} Request corrections or updates.
          {'\n'}
          {'\u2022'} Request deletion of your data.
          {'\n'}
          {'\u2022'} Withdraw consent for data use (may affect service
          availability).
        </Text>
        <Text style={styles.paragraph}>
          <Text style={styles.bold}>7. Children's Privacy</Text>
          {'\n\n'}
          The Platform is not available to users under 18. We do not knowingly
          collect data from minors.
        </Text>
        <Text style={styles.paragraph}>
          <Text style={styles.bold}>8. Cookies & Tracking</Text>
          {'\n\n'}
          We may use cookies and similar tools to improve services. You can
          manage or disable cookies through your browser.
        </Text>
        <Text style={styles.paragraph}>
          <Text style={styles.bold}>9. Legal Compliance</Text>
          {'\n\n'}
          We may disclose data if required by law, regulation, or government
          request.
        </Text>
        <Text style={styles.paragraph}>
          <Text style={styles.bold}>10. Updates</Text>
          {'\n\n'}
          We may revise this Privacy Policy at any time. Updates will be posted
          on the Platform, and continued use means acceptance of changes.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

export const PrivacyPolicyScreen = memo(PrivacyPolicyScreenComponent);

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: wp(4.5),
    paddingTop: hp(2),
  },
  leadParagraph: {
    fontSize: normalizeFont(15),
    color: colors.textPrimary,
    lineHeight: 22,
    marginBottom: hp(2),
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
});
