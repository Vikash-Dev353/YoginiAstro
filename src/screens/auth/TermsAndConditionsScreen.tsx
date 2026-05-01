import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { memo, useMemo } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppHeader } from '../../components/common/AppHeader';
import { colors } from '../../constants/colors';
import { useTranslation } from '../../localization/useTranslation';
import { AuthStackParamList, ProfileStackParamList } from '../../navigation/types';
import { hp, normalizeFont, wp } from '../../utils/responsive';

type Props = NativeStackScreenProps<
  AuthStackParamList & ProfileStackParamList,
  'TermsAndConditions'
>;

function TermsAndConditionsScreenComponent({ navigation }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const scrollBottomPadding = useMemo(
    () => insets.bottom + 88 + hp(3),
    [insets.bottom],
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
      <AppHeader
        title={t('profile.termConditions')}
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
          {`These Terms & Conditions (the "Terms") govern your access to and use of the websites, mobile apps, and services provided by Yogini Astro (the "Services"). By accessing or using the Services, you agree to be bound by these Terms.`}
        </Text>
        <Text style={styles.paragraph}>
          <Text style={styles.bold}>1. Preamble & Acceptance</Text>
          {'\n\n'}
          The Platform provides astrology-related services for guidance and
          awareness. Astrology is advisory in nature and not a guaranteed
          predictive science. By using our Platform, you agree to these Terms &
          Conditions.
        </Text>

        <Text style={styles.paragraph}>
          <Text style={styles.bold}>2. Definitions</Text>
          {'\n\n'}
          {'\u2022'} Client/User: Individual seeking astrology consultation.
          {'\n'}
          {'\u2022'} Astrologer/Service Provider: Verified professional providing
          consultations.
          {'\n'}
          {'\u2022'} Platform: Yogini Astro website, mobile app, and digital
          services.
          {'\n'}
          {'\u2022'} Wallet: Prepaid balance for bookings and services.
          {'\n'}
          {'\u2022'} Session: Any consultation (chat, call, video).
        </Text>

        <Text style={styles.paragraph}>
          <Text style={styles.bold}>3. Eligibility & Accounts</Text>
          {'\n\n'}
          {'\u2022'} You must be at least 18 years old to use the Services.
          {'\n'}
          {'\u2022'} Provide accurate and complete information during
          registration.
          {'\n'}
          {'\u2022'} You are responsible for safeguarding your login
          credentials.
          {'\n'}
          {'\u2022'} Multiple accounts, impersonation, or unauthorized access is
          prohibited.
        </Text>

        <Text style={styles.paragraph}>
          <Text style={styles.bold}>4. Client Obligations</Text>
          {'\n\n'}
          {'\u2022'} Provide accurate and verifiable birth details for
          consultations.
          {'\n'}
          {'\u2022'} Communicate respectfully with astrologers and other users.
          {'\n'}
          {'\u2022'} Do not request unethical or illegal services (e.g.,
          gambling, black magic).
          {'\n'}
          {'\u2022'} Accept that astrology is advisory; decisions are at your own
          risk.
        </Text>

        <Text style={styles.paragraph}>
          <Text style={styles.bold}>5. Astrologer Obligations</Text>
          {'\n\n'}
          {'\u2022'} Provide services in a professional and ethical manner.
          {'\n'}
          {'\u2022'} Do not guarantee results or use fear-based practices.
          {'\n'}
          {'\u2022'} Keep all client data strictly confidential.
          {'\n'}
          {'\u2022'} Conduct consultations only via the Platform.
        </Text>

        <Text style={styles.paragraph}>
          <Text style={styles.bold}>6. Services</Text>
          {'\n\n'}
          The Platform offers consultations, personalized Kundli and horoscopes,
          astrology modules, remedies, and educational content. Services are
          advisory and outcomes are not guaranteed.
        </Text>

        <Text style={styles.paragraph}>
          <Text style={styles.bold}>7. Wallet & Payments</Text>
          {'\n\n'}
          {'\u2022'} Wallet balance is prepaid, non-transferable, and
          non-redeemable.
          {'\n'}
          {'\u2022'} Payments are processed via secure third-party gateways.
          {'\n'}
          {'\u2022'} The Platform is not liable for third-party failures.
          {'\n\n'}
          <Text style={styles.bold}>Refunds</Text>
          {'\n\n'}
          {'\u2022'} Refunds are only for failed payments, astrologer
          unavailability, or technical failures.
          {'\n'}
          {'\u2022'} No refunds for incorrect data or dissatisfaction with
          guidance.
          {'\n'}
          {'\u2022'} Refunds are processed within 5–7 business days.
          {'\n\n'}
          <Text style={styles.bold}>Cancellations</Text>
          {'\n\n'}
          {'\u2022'} Allowed only before a session begins.
          {'\n'}
          {'\u2022'} Ongoing sessions cannot be cancelled.
          {'\n'}
          {'\u2022'} If an astrologer cancels, full refund is given.
        </Text>

        <Text style={styles.paragraph}>
          <Text style={styles.bold}>8. Third-Party Services</Text>
          {'\n\n'}
          The Platform integrates APIs for payments, calls, and analytics. We
          are not responsible for errors or delays caused by third-party
          providers.
        </Text>

        <Text style={styles.paragraph}>
          <Text style={styles.bold}>9. User Guidelines</Text>
          {'\n\n'}
          {'\u2022'} Maintain wallet balance and provide accurate details.
          {'\n'}
          {'\u2022'} Communicate respectfully with all users.
          {'\n'}
          {'\u2022'} Astrologers must act professionally and ethically.
          {'\n'}
          {'\u2022'} No misuse, harassment, or unethical behavior is allowed.
        </Text>

        <Text style={styles.paragraph}>
          <Text style={styles.bold}>10. Disclaimers</Text>
          {'\n\n'}
          Astrology services are advisory only. They are not substitutes for
          professional medical, legal, or financial advice. All decisions are at
          the user's sole risk.
        </Text>

        <Text style={styles.paragraph}>
          <Text style={styles.bold}>11. Limitation of Liability</Text>
          {'\n\n'}
          The Platform's maximum liability is limited to wallet refunds in
          case of technical or operational failures.
          {'\n\n'}
          {'\u2022'} Indemnification: Users agree to indemnify Yogini Astro
          against misuse, fraud, or violations.
          {'\n'}
          {'\u2022'} Force Majeure: We are not liable for service interruptions
          due to events beyond our control.
          {'\n'}
          {'\u2022'} Termination: Accounts may be suspended or terminated for
          violations or fraudulent activity.
        </Text>

        <Text style={styles.paragraph}>
          <Text style={styles.bold}>12. Intellectual Property</Text>
          {'\n\n'}
          All content (reports, charts, blogs, software) is owned by Yogini
          Astro. Reproduction or exploitation without permission is prohibited.
        </Text>

        <Text style={styles.paragraph}>
          <Text style={styles.bold}>13. Governing Law</Text>
          {'\n\n'}
          These Terms are governed by Indian law and disputes fall under the
          jurisdiction of [Insert City/State] courts.
        </Text>

        <Text style={styles.paragraph}>
          <Text style={styles.bold}>14. Amendments</Text>
          {'\n\n'}
          We may update these Terms anytime. Continued use of the Platform means
          acceptance of updated Terms.
        </Text>
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
