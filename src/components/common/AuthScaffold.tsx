import { PropsWithChildren } from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../constants/colors';
import { normalizeFont, wp } from '../../utils/responsive';

type AuthScaffoldProps = PropsWithChildren<{
  title: string;
  subtitle: string;
}>;

export function AuthScaffold({ children, title, subtitle }: AuthScaffoldProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: wp(6),
    paddingTop: 28,
  },
  title: {
    fontSize: normalizeFont(26),
    fontWeight: '700',
    color: colors.textPrimary,
  },
  subtitle: {
    marginTop: 6,
    fontSize: normalizeFont(14),
    color: colors.textSecondary,
    marginBottom: 24,
  },
});
