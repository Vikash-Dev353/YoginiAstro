import { memo } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../constants/colors';
import { useTranslation } from '../../localization/useTranslation';
import { hp, normalizeFont, wp } from '../../utils/responsive';

const THEME = {
  maroon: '#3B2222',
  accent: '#7B4949',
  cream: '#FFF9F2',
  border: '#E2DEDE',
  muted: '#6D4C4C',
};

type PhotoSourcePickerModalProps = {
  visible: boolean;
  title: string;
  onClose: () => void;
  onCamera: () => void;
  onGallery: () => void;
};

function PhotoSourcePickerModalComponent({
  visible,
  title,
  onClose,
  onCamera,
  onGallery,
}: PhotoSourcePickerModalProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { paddingBottom: insets.bottom + hp(2.5) }]}
          onPress={event => event.stopPropagation()}
        >
          <View style={styles.handle} />
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>
            {t('completeProfile.choosePhotoSource')}
          </Text>

          <View style={styles.optionsRow}>
            <Pressable
              style={({ pressed }) => [
                styles.optionCard,
                pressed && styles.optionCardPressed,
              ]}
              onPress={onCamera}
              accessibilityRole="button"
              accessibilityLabel={t('completeProfile.camera')}
            >
              <View style={[styles.iconCircle, styles.iconCircleCamera]}>
                <Text style={styles.iconEmoji}>📷</Text>
              </View>
              <Text style={styles.optionLabel}>{t('completeProfile.camera')}</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.optionCard,
                pressed && styles.optionCardPressed,
              ]}
              onPress={onGallery}
              accessibilityRole="button"
              accessibilityLabel={t('completeProfile.gallery')}
            >
              <View style={[styles.iconCircle, styles.iconCircleGallery]}>
                <Text style={styles.iconEmoji}>🖼️</Text>
              </View>
              <Text style={styles.optionLabel}>{t('completeProfile.gallery')}</Text>
            </Pressable>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.cancelBtn,
              pressed && styles.cancelBtnPressed,
            ]}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t('common.cancel')}
          >
            <Text style={styles.cancelText}>{t('common.cancel')}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export const PhotoSourcePickerModal = memo(PhotoSourcePickerModalComponent);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(27, 14, 14, 0.52)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: THEME.cream,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: wp(5),
    paddingTop: hp(1.2),
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: THEME.border,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#C9B8B8',
    marginBottom: hp(1.5),
  },
  title: {
    fontSize: normalizeFont(18),
    fontWeight: '700',
    color: THEME.maroon,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 6,
    marginBottom: hp(2.2),
    fontSize: normalizeFont(14),
    color: THEME.muted,
    textAlign: 'center',
    fontWeight: '500',
  },
  optionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: hp(2),
  },
  optionCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: hp(2),
    paddingHorizontal: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: THEME.border,
    backgroundColor: colors.surface,
  },
  optionCardPressed: {
    backgroundColor: '#F5EDEA',
    borderColor: THEME.accent,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  iconCircleCamera: {
    backgroundColor: '#F2E4D8',
    borderWidth: 1,
    borderColor: '#D4B8A8',
  },
  iconCircleGallery: {
    backgroundColor: '#EDE8F5',
    borderWidth: 1,
    borderColor: '#C9BED8',
  },
  iconEmoji: {
    fontSize: normalizeFont(26),
  },
  optionLabel: {
    fontSize: normalizeFont(15),
    fontWeight: '700',
    color: THEME.maroon,
  },
  cancelBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.accent,
    backgroundColor: colors.surface,
  },
  cancelBtnPressed: {
    opacity: 0.85,
  },
  cancelText: {
    fontSize: normalizeFont(15),
    fontWeight: '700',
    color: THEME.accent,
  },
});
