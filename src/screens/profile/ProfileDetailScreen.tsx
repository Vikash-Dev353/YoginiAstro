import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { AppHeader } from '../../components/common/AppHeader';
import { colors } from '../../constants/colors';
import { ProfileStackParamList } from '../../navigation/types';
import { normalizeFont } from '../../utils/responsive';

type ScreenName = Exclude<keyof ProfileStackParamList, 'ProfileHome'>;

type Props = NativeStackScreenProps<ProfileStackParamList, ScreenName> & {
  title: string;
};

export function ProfileDetailScreen({ navigation, title }: Props) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <AppHeader title={title} showBack onBackPress={navigation.goBack} />
      <View style={styles.content}>
        <Text style={styles.text}>{title}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: normalizeFont(20),
    color: colors.textPrimary,
    fontWeight: '600',
  },
});
