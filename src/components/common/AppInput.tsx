import { memo, ReactNode } from 'react';
import {
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { colors } from '../../constants/colors';
import { normalizeFont } from '../../utils/responsive';

type AppInputProps = TextInputProps & {
  label?: string;
  required?: boolean;
  leftAdornment?: ReactNode;
  wrapperStyle?: StyleProp<ViewStyle>;
  inputContainerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
};

export const AppInput = memo(
  ({
    label,
    required,
    leftAdornment,
    wrapperStyle,
    inputContainerStyle,
    inputStyle,
    ...inputProps
  }: AppInputProps) => {
    return (
      <View style={wrapperStyle}>
        {label ? (
          <Text style={styles.label}>
            {label}
            {required ? <Text style={styles.required}>*</Text> : null}
          </Text>
        ) : null}

        <View style={[styles.inputContainer, inputContainerStyle]}>
          {leftAdornment ? <View style={styles.leftAdornment}>{leftAdornment}</View> : null}
          <TextInput
            {...inputProps}
            style={[styles.input, inputStyle]}
            placeholderTextColor={colors.textMuted}
          />
        </View>
      </View>
    );
  },
);

const styles = StyleSheet.create({
  label: {
    fontSize: normalizeFont(36 / 3),
    color: colors.textPrimary,
    marginBottom: 10,
  },
  required: {
    color: colors.error,
  },
  inputContainer: {
    height: 56,
    borderColor: colors.inputBorder,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  leftAdornment: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: normalizeFont(15),
    color: colors.textPrimary,
    paddingVertical: 0,
  },
});
