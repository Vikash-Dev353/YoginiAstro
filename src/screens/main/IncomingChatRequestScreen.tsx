import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Image, ImageBackground, Pressable, StyleSheet, Text, View, Vibration } from "react-native";
import { useEffect, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
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

type Props = NativeStackScreenProps<OrderStackParamList, "IncomingChatRequest">;

export function IncomingChatRequestScreen({ navigation, route }: Props) {
  const dispatch = useAppDispatch();
  const [isAlerting, setIsAlerting] = useState(true);
  const {
    roomId,
    from,
    customerName,
    customerImage,
    notificationTitle,
    notificationBody,
    message,
    subtitle,
    kundliUrl,
    kundaliPayload,
    userBalance,
    astroPrice,
  } = route.params;

  const displayTitle =
    notificationTitle?.trim() || customerName?.trim() || 'Incoming chat request';
  const displayBody =
    notificationBody?.trim() ||
    message?.trim() ||
    subtitle?.trim() ||
    'Wants to chat with you.';

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
        })
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

  return (
    <ImageBackground source={images.appBackground} style={styles.root} resizeMode="cover">
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
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerWrap}>
          <Image source={avatarSource} style={styles.avatar} resizeMode="cover" />
          <Text style={styles.name}>{displayTitle}</Text>
          {customerName.trim() !== displayTitle ? (
            <Text style={styles.subtitle}>{customerName}</Text>
          ) : (
            <Text style={styles.subtitle}>
              {subtitle?.trim() || 'Yoginiastro User'}
            </Text>
          )}
          <Text style={styles.message} numberOfLines={3}>
            {displayBody}
          </Text>
        </View>

        <View style={styles.actionsRow}>
          <Pressable style={[styles.actionBtn, styles.acceptBtn]} onPress={onAccept}>
            <Text style={styles.actionText}>Accept</Text>
          </Pressable>
          <Pressable style={[styles.actionBtn, styles.rejectBtn]} onPress={onReject}>
            <Text style={styles.actionText}>Reject</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#8D4F4B",
  },
  hiddenRingtone: {
    width: 0,
    height: 0,
  },
  safeArea: {
    flex: 1,
    justifyContent: "space-between",
    paddingVertical: 18,
  },
  centerWrap: {
    marginTop: "25%",
    alignItems: "center",
    paddingHorizontal: wp(8),
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.65)",
    backgroundColor: "#F3E7E7",
  },
  name: {
    marginTop: 14,
    color: "#FFFFFF",
    fontSize: normalizeFont(31 / 1.8),
    fontWeight: "700",
    textAlign: "center",
  },
  subtitle: {
    marginTop: 4,
    color: "rgba(255,255,255,0.78)",
    fontSize: normalizeFont(12),
    fontWeight: "500",
  },
  message: {
    marginTop: 16,
    color: "#FBECEC",
    fontSize: normalizeFont(13),
    textAlign: "center",
  },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: wp(10),
    paddingBottom: 22,
  },
  actionBtn: {
    width: wp(36),
    height: 48,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  acceptBtn: {
    backgroundColor: "#0E8A1E",
  },
  rejectBtn: {
    backgroundColor: "#CB2518",
  },
  actionText: {
    color: "#FFFFFF",
    fontSize: normalizeFont(18),
    fontWeight: "700",
  },
});
