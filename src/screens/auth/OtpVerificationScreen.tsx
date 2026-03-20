import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppButton } from "../../components/common/AppButton";
import { colors } from "../../constants/colors";
import { useTranslation } from "../../localization/useTranslation";
import { AuthStackParamList } from "../../navigation/types";
import { useAppDispatch } from "../../store/hooks";
import {
  decodeAstroIdFromToken,
  sendOtp,
  setAuthenticatedSession,
  verifyOtp,
} from "../../store/slices/authSlice";
import { hp, normalizeFont, wp } from "../../utils/responsive";
import { storage } from "../../utils/storage";

type Props = NativeStackScreenProps<AuthStackParamList, "OtpVerification">;

const OTP_LENGTH = 6;
const RESEND_SECONDS = 59;

function OtpVerificationScreenComponent({ route, navigation }: Props) {
  const { mobile } = route.params;
  const dispatch = useAppDispatch();
  const { t } = useTranslation();

  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const inputRefs = useRef<Array<TextInput | null>>([]);

  useEffect(() => {
    if (secondsLeft === 0) {
      return;
    }

    const timer = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [secondsLeft]);

  const otpValue = useMemo(() => otp.join(""), [otp]);

  const onChangeOtp = useCallback(
    (value: string, index: number) => {
      const cleanedValue = value.replace(/\D/g, "").slice(-1);

      setOtp((prev) => {
        const next = [...prev];
        next[index] = cleanedValue;
        return next;
      });

      if (error) {
        setError("");
      }

      if (cleanedValue && index < OTP_LENGTH - 1) {
        inputRefs.current[index + 1]?.focus();
      }
    },
    [error]
  );

  const onKeyPress = useCallback(
    (key: string, index: number) => {
      if (key === "Backspace" && !otp[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    },
    [otp]
  );

  const onResend = useCallback(() => {
    if (secondsLeft > 0) {
      return;
    }
    setLoading(true);
    setError("");
    dispatch(sendOtp({ mobile }))
      .unwrap()
      .then(() => {
        setOtp(Array(OTP_LENGTH).fill(""));
        setSecondsLeft(RESEND_SECONDS);
        inputRefs.current[0]?.focus();
      })
      .catch((apiError) => {
        setError(
          (apiError as { message?: string })?.message ||
            "Unable to resend OTP. Please try again."
        );
      })
      .finally(() => setLoading(false));
  }, [dispatch, mobile, secondsLeft]);

  const onVerify = useCallback(async () => {
    if (otpValue.length !== OTP_LENGTH) {
      setError(t("auth.otpError"));
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await dispatch(
        verifyOtp({ mobile, otp: otpValue })
      ).unwrap();
      const isSuccess = response.status?.toLowerCase() === "success";

      if (!isSuccess) {
        setError(response.message || "Invalid OTP. Please try again.");
        setLoading(false);
        return;
      }

      const token =
        response.authorization?.trim() ||
        (response as { token?: string }).token?.trim() ||
        `otp-session-${mobile}`;
      const userId = response.user?.id?.trim();
      const astroIdFromResponse =
        (response as { astroId?: string }).astroId?.trim() ||
        (response as { data?: { astroId?: string } }).data?.astroId?.trim();
      const resolvedAstroId =
        astroIdFromResponse ||
        (userId && userId.toUpperCase().startsWith("AS") ? userId : null) ||
        decodeAstroIdFromToken(token);
      await storage.setAuthToken(token);
      dispatch(
        setAuthenticatedSession({
          token,
          astroId: resolvedAstroId || null,
          user: {
            id: userId || resolvedAstroId || "72",
            name: response.user?.name || "Shrimaan",
            email: response.user?.email || `${mobile}@yoginiastro.com`,
          },
        })
      );
    } catch (apiError) {
      setError(
        (apiError as { message?: string })?.message ||
          "Unable to verify OTP. Please try again."
      );
      setLoading(false);
    }
  }, [dispatch, mobile, otpValue, t]);

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.safeArea,
        {
          paddingTop: insets.top,
          paddingLeft: insets.left,
          paddingRight: insets.right,
          paddingBottom: insets.bottom,
        },
      ]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <View style={styles.header}>
          <Pressable
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backIcon}>{"<"}</Text>
          </Pressable>
          <Text style={styles.headerTitle}>{t("auth.verifyPhone")}</Text>
          <View style={styles.headerRightSpace} />
        </View>

        <View style={styles.content}>
          <Text style={styles.infoText}>
            {`${t("auth.otpSent")}`}
            <Text style={styles.mobileText}> +91 {mobile}</Text>
          </Text>

          <View style={styles.otpRow}>
            {otp.map((digit, index) => (
              <TextInput
                key={`otp-${index}`}
                ref={(ref) => {
                  inputRefs.current[index] = ref;
                }}
                value={digit}
                onChangeText={(value) => onChangeOtp(value, index)}
                onKeyPress={({ nativeEvent }) =>
                  onKeyPress(nativeEvent.key, index)
                }
                style={styles.otpInput}
                keyboardType="number-pad"
                maxLength={1}
                textAlign="center"
                selectionColor={colors.maroon}
              />
            ))}
          </View>

          <View style={styles.resendRow}>
            <Pressable onPress={onResend} disabled={secondsLeft > 0}>
              <Text
                style={[
                  styles.resendLabel,
                  secondsLeft === 0 && styles.resendEnabled,
                ]}
              >
                {t("auth.resendOtp")}
              </Text>
            </Pressable>
            <Text style={styles.timer}>{`${mm}:${ss}`}</Text>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>

        <View style={styles.bottomAction}>
          <AppButton
            title={t("common.verify")}
            onPress={onVerify}
            loading={loading}
            disabled={otpValue.length !== OTP_LENGTH}
          />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

export const OtpVerificationScreen = memo(OtpVerificationScreenComponent);

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  header: {
    height: 56,
    borderBottomWidth: 1,
    borderBottomColor: "#B7B1B1",
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#8D5858",
    alignItems: "center",
    justifyContent: "center",
  },
  backIcon: {
    fontSize: normalizeFont(22),
    color: "#351E1E",
    marginTop: -2,
  },
  headerTitle: {
    fontSize: normalizeFont(32 / 2),
    color: "#3A2323",
    fontWeight: "700",
  },
  headerRightSpace: {
    width: 44,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: wp(5),
    marginTop: -hp(8),
  },
  infoText: {
    textAlign: "center",
    color: "#7A7676",
    fontSize: normalizeFont(17 / 1.35),
    lineHeight: 28,
  },
  mobileText: {
    color: "#2D1D1D",
    fontWeight: "700",
  },
  otpRow: {
    marginTop: 18,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  otpInput: {
    width: wp(13),
    height: 56,
    borderWidth: 1,
    borderColor: "#A1A1A1",
    borderRadius: 14,
    color: "#2D1D1D",
    fontSize: normalizeFont(22 / 1.3),
    fontWeight: "600",
    backgroundColor: "#FCFBFB",
  },
  resendRow: {
    marginTop: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  resendLabel: {
    color: "#3A2323",
    fontSize: normalizeFont(32 / 2.1),
    fontWeight: "600",
  },
  resendEnabled: {
    color: colors.maroon,
    textDecorationLine: "underline",
  },
  timer: {
    color: "#8E8B8B",
    fontSize: normalizeFont(36 / 2.3),
    fontWeight: "500",
  },
  error: {
    marginTop: 12,
    color: colors.error,
    fontSize: normalizeFont(12),
  },
  bottomAction: {
    paddingHorizontal: wp(5),
    paddingBottom: hp(5),
  },
});
