import { memo, useEffect } from "react";
import {
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  Vibration,
  View,
} from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import Video from "react-native-video";
import { SafeAreaView } from "react-native-safe-area-context";
import { images } from "../../assets/images";
import { sounds } from "../../assets/sounds";
import type { OrderStackParamList } from "../../navigation/types";
import { hp, normalizeFont, wp } from "../../utils/responsive";

export type IncomingChatOverlayPayload =
  OrderStackParamList["IncomingChatRequest"];

type Props = {
  visible: boolean;
  payload: IncomingChatOverlayPayload | null;
  onAccept: (payload: IncomingChatOverlayPayload) => void;
  onReject: (payload: IncomingChatOverlayPayload) => void;
};

const SERIF = Platform.select({
  ios: "Georgia",
  android: "serif",
  default: "serif",
});

function IncomingChatPushOverlayComponent({
  visible,
  payload,
  onAccept,
  onReject,
}: Props) {
  const { width, height } = useWindowDimensions();

  useEffect(() => {
    if (!visible || !payload) {
      return;
    }
    Vibration.vibrate([0, 500, 650], true);
    return () => {
      Vibration.cancel();
    };
  }, [visible, payload]);

  if (!payload) {
    return null;
  }

  const avatarSource =
    payload.customerImage && payload.customerImage.trim().length > 0
      ? { uri: payload.customerImage.trim() }
      : images.iconamoonProfileCircleFill;

  const subtitleText =
    payload.subtitle?.trim() || "Yoginiastro Astrologer";

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={() => onReject(payload)}
    >
      <View style={styles.root}>
        <Svg
          width={width}
          height={height}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        >
          <Defs>
            <LinearGradient id="incomingPushGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#B77A72" />
              <Stop offset="1" stopColor="#3D1815" />
            </LinearGradient>
          </Defs>
          <Rect
            x="0"
            y="0"
            width={width}
            height={height}
            fill="url(#incomingPushGrad)"
          />
        </Svg>

        <Video
          source={sounds.waitlist}
          style={styles.hiddenRingtone}
          paused={!visible}
          repeat
          muted={false}
          volume={1.0}
          playWhenInactive
          playInBackground={false}
          ignoreSilentSwitch="ignore"
          onError={() => undefined}
        />

        <Image
          source={images.incomingPushWatermark}
          style={styles.watermark}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />

        <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
          <View style={styles.topSection}>
            <Image source={avatarSource} style={styles.avatar} resizeMode="cover" />
            <Text style={styles.name}>{payload.customerName}</Text>
            <Text style={styles.subtitle}>{subtitleText}</Text>
            {payload.message?.trim() ? (
              <Text style={styles.message} numberOfLines={2}>
                {payload.message.trim()}
              </Text>
            ) : null}
          </View>

          <View style={styles.spacer} />

          <View style={styles.actionsRow}>
            <Pressable
              style={[styles.actionBtn, styles.acceptBtn]}
              onPress={() => onAccept(payload)}
            >
              <Text style={styles.actionText}>Accept</Text>
            </Pressable>
            <Pressable
              style={[styles.actionBtn, styles.rejectBtn]}
              onPress={() => onReject(payload)}
            >
              <Text style={styles.actionText}>Reject</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

export const IncomingChatPushOverlay = memo(IncomingChatPushOverlayComponent);

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#3D1815",
  },
  hiddenRingtone: {
    width: 0,
    height: 0,
  },
  watermark: {
    position: "absolute",
    alignSelf: "center",
    top: "28%",
    width: wp(88),
    height: wp(88),
    opacity: 0.22,
  },
  safe: {
    flex: 1,
    justifyContent: "space-between",
  },
  topSection: {
    alignItems: "center",
    paddingTop: hp(8),
    paddingHorizontal: wp(8),
  },
  spacer: {
    flex: 1,
    minHeight: 24,
  },
  avatar: {
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.9)",
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  name: {
    marginTop: 20,
    color: "#FFFFFF",
    fontSize: normalizeFont(22),
    fontFamily: SERIF,
    fontWeight: "600",
    textAlign: "center",
  },
  subtitle: {
    marginTop: 8,
    color: "rgba(255,255,255,0.88)",
    fontSize: normalizeFont(15),
    fontFamily: SERIF,
    fontWeight: "400",
    textAlign: "center",
  },
  message: {
    marginTop: 14,
    color: "rgba(255,255,255,0.85)",
    fontSize: normalizeFont(13),
    textAlign: "center",
    paddingHorizontal: wp(6),
  },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: wp(6),
    paddingBottom: hp(3),
    gap: 14,
  },
  actionBtn: {
    flex: 1,
    height: 52,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  acceptBtn: {
    backgroundColor: "#1B6B28",
  },
  rejectBtn: {
    backgroundColor: "#A02420",
  },
  actionText: {
    color: "#FFFFFF",
    fontSize: normalizeFont(18),
    fontFamily: SERIF,
    fontWeight: "700",
  },
});
