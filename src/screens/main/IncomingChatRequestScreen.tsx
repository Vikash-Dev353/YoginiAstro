import { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  Dimensions,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  Vibration,
} from "react-native";
import { useEffect, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import Video from "react-native-video";
import { images } from "../../assets/images";
import { sounds } from "../../assets/sounds";
import { OrderStackParamList } from "../../navigation/types";
import { useAppDispatch } from "../../store/hooks";
import {
  acceptChat,
  rejectChat,
  setAstroChatData,
  setSocketChatDisconnect,
} from "../../store/slices/socketSlice";
import { normalizeFont, wp } from "../../utils/responsive";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

const serif =
  Platform.select({
    ios: "Georgia",
    android: "serif",
    default: "serif",
  }) ?? "serif";

type Props = NativeStackScreenProps<OrderStackParamList, "IncomingChatRequest">;

export function IncomingChatRequestScreen({ navigation, route }: Props) {
  const dispatch = useAppDispatch();
  const [isAlerting, setIsAlerting] = useState(true);
  const {
    roomId,
    from,
    customerName,
    customerImage,
    message,
    subtitle,
    kundliUrl,
    kundaliPayload,
    userBalance,
    astroPrice,
  } = route.params;

  useEffect(() => {
    if (!isAlerting) return;
    Vibration.vibrate([0, 500, 650], true);
    return () => {
      Vibration.cancel();
    };
  }, [isAlerting]);

  const avatarSource =
    customerImage && customerImage.trim().length > 0
      ? { uri: customerImage.trim() }
      : images.iconamoonProfileCircleFill;

  const subtitleText = subtitle?.trim() || "Yoginiastro User";
  const messageText = message?.trim();

  const onAccept = () => {
    setIsAlerting(false);
    Vibration.cancel();
    if (from && roomId) {
      dispatch(setSocketChatDisconnect(false));
      dispatch(
        setAstroChatData({
          from,
          senderName: customerName,
          userImage: customerImage,
          roomId,
          kundliUrl,
          userBalance,
          astroPrice,
        }),
      );
      dispatch(acceptChat({ from, roomId }));
    }
    navigation.replace("ConsultationChat", {
      customerName,
      roomId,
      senderId: from,
      kundaliPayload,
      customerImage,
    });
  };

  const onReject = () => {
    setIsAlerting(false);
    Vibration.cancel();
    if (from && roomId) {
      dispatch(rejectChat({ from, roomId }));
    }
    navigation.getParent()?.navigate("Home", { screen: "HomeMain" });
  };

  const watermarkSize = Math.min(SCREEN_W, SCREEN_H) * 0.92;

  return (
    <View style={styles.flex1}>
      <Svg
        width={SCREEN_W}
        height={SCREEN_H}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      >
        <Defs>
          <LinearGradient id="incomingBg" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#B07068" />
            <Stop offset="42%" stopColor="#7A3B36" />
            <Stop offset="100%" stopColor="#3A1715" />
          </LinearGradient>
        </Defs>
        <Rect width={SCREEN_W} height={SCREEN_H} fill="url(#incomingBg)" />
      </Svg>

      <Image
        source={images.incomingChatWatermark}
        style={[
          styles.watermark,
          {
            width: watermarkSize,
            height: watermarkSize,
            marginLeft: -watermarkSize / 2,
            marginTop: -watermarkSize / 2,
            left: SCREEN_W / 2,
            top: SCREEN_H * 0.46,
          },
        ]}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
      />

      <Video
        source={sounds.waitlist}
        style={styles.hiddenRingtone}
        paused={!isAlerting}
        repeat
        muted={false}
        volume={1.0}
        playWhenInactive
        playInBackground={false}
        ignoreSilentSwitch="ignore"
        onError={(error) => {
          console.log("incoming ringtone error", error);
        }}
      />

      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <View style={styles.headerBlock}>
          <Image source={avatarSource} style={styles.avatar} resizeMode="cover" />
          <Text style={styles.name} numberOfLines={2}>
            {customerName}
          </Text>
          <Text style={styles.subtitle} numberOfLines={2}>
            {subtitleText}
          </Text>
          {messageText ? (
            <Text style={styles.messageHint} numberOfLines={2}>
              {messageText}
            </Text>
          ) : (
            <Text style={styles.messageHint} numberOfLines={2}>
              Wants to chat with you.
            </Text>
          )}
        </View>

        <View style={styles.actionsRow}>
          <Pressable
            style={({ pressed }) => [
              styles.actionBtn,
              styles.acceptBtn,
              pressed && styles.actionPressed,
            ]}
            onPress={onAccept}
          >
            <Text style={styles.actionText}>Accept</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.actionBtn,
              styles.rejectBtn,
              pressed && styles.actionPressed,
            ]}
            onPress={onReject}
          >
            <Text style={styles.actionText}>Reject</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex1: {
    flex: 1,
    backgroundColor: "#3A1715",
  },
  watermark: {
    position: "absolute",
    opacity: 0.22,
    zIndex: 0,
  },
  hiddenRingtone: {
    width: 0,
    height: 0,
  },
  safeArea: {
    flex: 1,
    zIndex: 1,
    justifyContent: "space-between",
    paddingBottom: 12,
  },
  headerBlock: {
    alignItems: "center",
    paddingHorizontal: wp(8),
    paddingTop: SCREEN_H * 0.06,
  },
  avatar: {
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.55)",
    backgroundColor: "#F3E7E7",
  },
  name: {
    marginTop: 18,
    color: "#FFFFFF",
    fontFamily: serif,
    fontSize: normalizeFont(28),
    fontWeight: "600",
    textAlign: "center",
    letterSpacing: 0.3,
  },
  subtitle: {
    marginTop: 8,
    color: "rgba(255,255,255,0.88)",
    fontFamily: serif,
    fontSize: normalizeFont(14),
    fontWeight: "400",
    textAlign: "center",
  },
  messageHint: {
    marginTop: 14,
    color: "rgba(255,235,235,0.82)",
    fontSize: normalizeFont(13),
    textAlign: "center",
    paddingHorizontal: wp(6),
  },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: wp(9),
    paddingBottom: 18,
    gap: 14,
  },
  actionBtn: {
    flex: 1,
    maxWidth: wp(44),
    height: 52,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  actionPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
  acceptBtn: {
    backgroundColor: "#0F9A23",
  },
  rejectBtn: {
    backgroundColor: "#D32B1E",
  },
  actionText: {
    color: "#FFFFFF",
    fontFamily: serif,
    fontSize: normalizeFont(19),
    fontWeight: "600",
    letterSpacing: 0.4,
  },
});
