import { useNavigation } from '@react-navigation/native';
import { memo, useCallback, useEffect, useRef } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { AppButton } from '../common/AppButton';
import { colors } from '../../constants/colors';
import { useTranslation } from '../../localization/useTranslation';
import type { RootTabParamList } from '../../navigation/types';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  logout,
  setRegisterSuccessModalVisible,
} from '../../store/slices/authSlice';
import { normalizeFont, wp } from '../../utils/responsive';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

function RegisterSuccessModalComponent() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const navigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>();
  const visible = useAppSelector(s => s.auth.registerSuccessModalVisible);
  const hasRedirectedRef = useRef(false);

  const onCompleteProfile = useCallback(() => {
    if (hasRedirectedRef.current) {
      return;
    }
    hasRedirectedRef.current = true;
    dispatch(setRegisterSuccessModalVisible(false));
    navigation.navigate('Profile', { screen: 'ProfileHome' });
  }, [dispatch, navigation]);

  useEffect(() => {
    if (!visible) {
      hasRedirectedRef.current = false;
      return;
    }

    const timeoutId = setTimeout(() => {
      onCompleteProfile();
    }, 900);

    return () => clearTimeout(timeoutId);
  }, [onCompleteProfile, visible]);

  const onReturnToLogin = useCallback(() => {
    dispatch(setRegisterSuccessModalVisible(false));
    dispatch(logout());
  }, [dispatch]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => dispatch(setRegisterSuccessModalVisible(false))}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.message}>{t('auth.registerSuccessBody')}</Text>
          <AppButton
            title={t('auth.completeProfileButton')}
            onPress={onCompleteProfile}
            containerStyle={styles.primaryBtn}
          />
          <Pressable onPress={onReturnToLogin} style={styles.linkWrap}>
            <Text style={styles.link}>{t('auth.returnToLoginLink')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export const RegisterSuccessModal = memo(RegisterSuccessModalComponent);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: wp(6),
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 24,
    borderWidth: 1,
    borderColor: '#E8E0E0',
  },
  message: {
    textAlign: 'center',
    color: colors.textPrimary,
    fontSize: normalizeFont(16),
    lineHeight: 24,
    marginBottom: 20,
  },
  primaryBtn: {
    marginBottom: 16,
  },
  linkWrap: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  link: {
    color: colors.maroon,
    fontSize: normalizeFont(15),
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
