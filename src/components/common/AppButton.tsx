import { memo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  PressableProps,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  ViewStyle,
} from 'react-native';
import { colors } from '../../constants/colors';
import { normalizeFont } from '../../utils/responsive';

type AppButtonProps = {
  title: string;
  loading?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
} & Omit<PressableProps, 'style'>;

export const AppButton = memo(
  ({
    title,
    loading = false,
    disabled,
    onPress,
    containerStyle,
    textStyle,
    ...rest
  }: AppButtonProps) => {
    const isDisabled = disabled || loading;

    return (
      <Pressable
        {...rest}
        disabled={isDisabled}
        onPress={onPress}
        style={[styles.button, isDisabled && styles.disabled, containerStyle]}
      >
        {loading ? (
          <ActivityIndicator color={colors.surface} />
        ) : (
          <Text style={[styles.title, textStyle]}>{title}</Text>
        )}
      </Pressable>
    );
  },
);

const styles = StyleSheet.create({
  button: {
    height: 54,
    borderRadius: 8,
    backgroundColor: colors.maroon,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabled: {
    opacity: 0.75,
  },
  title: {
    color: colors.surface,
    fontSize: normalizeFont(18),
    fontWeight: '500',
  },
});
