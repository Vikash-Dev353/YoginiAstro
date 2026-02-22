import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AuthStackParamList } from '../../navigation/types';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { clearAuthError, signup } from '../../store/slices/authSlice';
import { colors } from '../../constants/colors';
import { useTranslation } from '../../localization/useTranslation';
import { normalizeFont } from '../../utils/responsive';
import { AuthScaffold } from '../../components/common/AuthScaffold';

type Props = NativeStackScreenProps<AuthStackParamList, 'Signup'>;

export function SignupScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { loading, error } = useAppSelector(state => state.auth);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const onSignupPress = () => {
    dispatch(clearAuthError());
    dispatch(signup({ name, email, password }));
  };

  return (
    <AuthScaffold
      title={t('auth.createAccount')}
      subtitle={t('auth.signupSubtitle')}
    >
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder={t('auth.fullName')}
        style={styles.input}
      />

      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder={t('auth.email')}
        keyboardType="email-address"
        autoCapitalize="none"
        style={styles.input}
      />

      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder={t('auth.password')}
        secureTextEntry
        style={styles.input}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable style={styles.primaryButton} onPress={onSignupPress}>
        {loading ? (
          <ActivityIndicator color={colors.surface} />
        ) : (
          <Text style={styles.primaryButtonText}>{t('common.signup')}</Text>
        )}
      </Pressable>

      <View style={styles.row}>
        <Text style={styles.helperText}>{t('auth.haveAccount')}</Text>
        <Pressable onPress={() => navigation.navigate('Login')}>
          <Text style={styles.link}>{` ${t('common.login')}`}</Text>
        </Pressable>
      </View>
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 48,
    marginBottom: 12,
  },
  error: {
    color: colors.error,
    marginBottom: 12,
    fontSize: normalizeFont(12),
  },
  primaryButton: {
    marginTop: 8,
    height: 48,
    borderRadius: 10,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: {
    color: colors.surface,
    fontWeight: '700',
    fontSize: normalizeFont(15),
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
  },
  helperText: {
    color: colors.textSecondary,
  },
  link: {
    color: colors.primary,
    fontWeight: '600',
  },
});
