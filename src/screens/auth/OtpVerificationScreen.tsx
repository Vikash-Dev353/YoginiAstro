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
import { SafeAreaView } from "react-native-safe-area-context";
import { AppButton } from "../../components/common/AppButton";
import { AppHeader } from "../../components/common/AppHeader";
import { colors } from "../../constants/colors";
import { useTranslation } from "../../localization/useTranslation";
import { AuthStackParamList } from "../../navigation/types";
import type { VerifyOtpResponse } from "../../services/api/authApi";
import { attachDeviceToUser } from "../../services/device/registerDevice";
import { useAppDispatch } from "../../store/hooks";
import {
  applyAuthGate,
  decodeAstroIdFromToken,
  decodeUserIdFromToken,
  sendOtp,
  sendRegisterOtp,
  setAuthenticatedSession,
  verifyOtp,
  verifyRegisterOtp,
} from "../../store/slices/authSlice";
import { hp, normalizeFont, wp } from "../../utils/responsive";
import { storage } from "../../utils/storage";

type Props = NativeStackScreenProps<AuthStackParamList, "OtpVerification">;

const OTP_LENGTH = 6;
const RESEND_SECONDS = 59;

/** Flattens `{ data: { status, authorization, ... } }` from register OTP verify. */
function normalizeVerifyOtpResponse(raw: unknown): VerifyOtpResponse {
  const r = raw as Record<string, unknown>;
  const data = r.data as Record<string, unknown> | undefined;
  const merged =
    data && typeof data === "object" && !Array.isArray(data)
      ? { ...r, ...data }
      : r;
  return {
    message: merged.message as string | undefined,
    status: (merged.status as string) ?? "",
    token: merged.token as string | undefined,
    authorization: merged.authorization as string | undefined,
    astroId: merged.astroId as string | undefined,
    user: merged.user as VerifyOtpResponse["user"],
  };
}

function OtpVerificationScreenComponent({ route, navigation }: Props) {
  const { mobile, flow = "login" } = route.params;
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
    const sendResend =
      flow === "register"
        ? dispatch(sendRegisterOtp({ mobile }))
        : dispatch(sendOtp({ mobile }));

    sendResend
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
  }, [dispatch, flow, mobile, secondsLeft]);

  const onVerify = useCallback(async () => {
    if (otpValue.length !== OTP_LENGTH) {
      setError(t("auth.otpError"));
      return;
    }

    setLoading(true);
    setError("");

    try {
      const verifyAction =
        flow === "register"
          ? verifyRegisterOtp({ mobile, otp: otpValue })
          : verifyOtp({ mobile, otp: otpValue });
      const response = await dispatch(verifyAction).unwrap();
      const normalized = normalizeVerifyOtpResponse(response);
      const isSuccess = normalized.status?.toLowerCase() === "success";

      if (!isSuccess) {
        setError(normalized.message || "Invalid OTP. Please try again.");
        setLoading(false);
        return;
      }

      const token =
        normalized.authorization?.trim() ||
        normalized.token?.trim() ||
        `otp-session-${mobile}`;
      const userId = normalized.user?.id?.trim();
      const astroIdFromResponse = normalized.astroId?.trim();
      const resolvedAstroId =
        astroIdFromResponse ||
        (userId && userId.toUpperCase().startsWith("AS") ? userId : null) ||
        decodeAstroIdFromToken(token);
      await storage.setAuthToken(token);

      if (flow === "register") {
        dispatch(
          setAuthenticatedSession({
            token,
            astroId: resolvedAstroId || null,
            user: {
              id: userId || resolvedAstroId || "72",
              name: normalized.user?.name || "Shrimaan",
              email: normalized.user?.email || `${mobile}@yoginiastro.com`,
            },
            pendingProfileCompletion: true,
            pendingAdminApproval: true,
          })
        );
        await dispatch(
          applyAuthGate({
            pendingProfileCompletion: true,
            pendingAdminApproval: true,
          })
        ).unwrap();
        navigation.replace("CompleteProfile");
      } else {
        dispatch(
          setAuthenticatedSession({
            token,
            astroId: resolvedAstroId || null,
            user: {
              id: userId || resolvedAstroId || "72",
              name: normalized.user?.name || "Shrimaan",
              email: normalized.user?.email || `${mobile}@yoginiastro.com`,
            },
          })
        );
        await dispatch(
          applyAuthGate({
            pendingProfileCompletion: false,
            pendingAdminApproval: false,
          })
        ).unwrap();
      }

      /** Register flow does not open main app yet — attach here. Login flow uses RootNavigator. */
      if (flow === "register") {
        const attachUserId =
          userId || decodeUserIdFromToken(token) || "";
        if (attachUserId) {
          void attachDeviceToUser({ authToken: token, userId: attachUserId });
        }
      }

      setLoading(false);
    } catch (apiError) {
      setError(
        (apiError as { message?: string })?.message ||
        "Unable to verify OTP. Please try again."
      );
      setLoading(false);
    }
  }, [dispatch, flow, mobile, navigation, otpValue, t]);

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom", "left", "right"]}>
      <AppHeader
        title={t("auth.verifyPhone")}
        showBack
        onBackPress={() => navigation.goBack()}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
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
            {secondsLeft === 0 ?
              <Pressable onPress={onResend} disabled={secondsLeft > 0}>
                <Text
                  style={[
                    styles.resendLabel,
                  ]}
                >
                  {t("auth.resendOtp")}
                </Text>
              </Pressable> :
              <Text style={styles.timer}>{`${mm}:${ss}`}</Text>}
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
    </SafeAreaView>
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
