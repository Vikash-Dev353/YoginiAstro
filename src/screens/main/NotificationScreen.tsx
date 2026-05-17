import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader } from '../../components/common/AppHeader';
import { NoDataFound } from '../../components/common/NoDataFound';
import { colors } from '../../constants/colors';
import { useTranslation } from '../../localization/useTranslation';

export function NotificationScreen() {
  const { t } = useTranslation();
  const notifications: unknown[] = [];

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <AppHeader title={t('common.notification')} />
      <View style={styles.content}>
        {notifications.length === 0 ? (
          <NoDataFound message={t('notification.empty')} />
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
