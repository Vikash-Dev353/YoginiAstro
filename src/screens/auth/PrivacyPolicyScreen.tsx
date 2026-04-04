import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { memo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader } from '../../components/common/AppHeader';
import { colors } from '../../constants/colors';
import { useTranslation } from '../../localization/useTranslation';
import { AuthStackParamList } from '../../navigation/types';
import { hp, normalizeFont, wp } from '../../utils/responsive';

type Props = NativeStackScreenProps<AuthStackParamList, 'PrivacyPolicy'>;

function PrivacyPolicyScreenComponent({ navigation }: Props) {
  const { t } = useTranslation();

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
      <AppHeader
        title={t('auth.privacyPolicy')}
        showBack
        onBackPress={() => navigation.goBack()}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.paragraph}>
          <Text style={styles.bold}>Information We Collect</Text>
          {'\n\n'}
          We collect information you provide directly, such as when you create an
          account, use our services, or contact us. This may include name, email,
          phone number, and usage data.
        </Text>
        <Text style={styles.paragraph}>
          <Text style={styles.bold}>How We Use Your Information</Text>
          {'\n\n'}
          We use the information we collect to provide, maintain, and improve our
          services, to process transactions, and to communicate with you about
          updates and support.
        </Text>
        <Text style={styles.paragraph}>
          <Text style={styles.bold}>Data Security</Text>
          {'\n\n'}
          We take reasonable measures to help protect your personal information
          from loss, theft, misuse, and unauthorized access.
        </Text>
        <Text style={styles.paragraph}>
          <Text style={styles.bold}>Your Rights</Text>
          {'\n\n'}
          You may access, correct, or delete your personal information. Contact
          us for any privacy-related requests.
        </Text>
        <View style={styles.spacer} />
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
