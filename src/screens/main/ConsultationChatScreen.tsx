import { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { images } from "../../assets/images";
import { colors } from "../../constants/colors";
import { useTranslation } from "../../localization/useTranslation";
import { OrderStackParamList } from "../../navigation/types";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import {
  emitStopTyping,
  emitTyping,
  joinRoom,
  leaveRoom,
  requestChatHistory,
  resetRoom,
  selectMessages,
  selectSocketState,
  sendMessage,
  setChatStarted,
  setSocketChatDisconnect,
  setSocketTimerStart,
} from "../../store/slices/socketSlice";
import { hp, normalizeFont, wp } from "../../utils/responsive";

type Props = NativeStackScreenProps<OrderStackParamList, "ConsultationChat">;

type ChatMessage = {
  id: string;
  text: string;
  isMine: boolean;
  createdAt: number;
  isFile?: boolean;
  fileUrl?: string;
};

const HEADER = "#632B27";
const CHAT_BG = "#FCF9F5";
const SENT_BUBBLE = "#632B27";
const RECEIVED_BG = "#FFF9F5";
const RECEIVED_BORDER = "#E5DDD5";

function formatBubbleTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatSessionClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function ConsultationChatScreenComponent({ navigation, route }: Props) {
  const { customerName, roomId, senderId, kundaliPayload, customerImage } =
    route.params;
  const dispatch = useAppDispatch();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const socketState = useAppSelector(selectSocketState);
  const socketMessages = useAppSelector(selectMessages);

  const [elapsedSec, setElapsedSec] = useState(0);
  const [draft, setDraft] = useState("");
  const listRef = useRef<FlatList<ChatMessage>>(null);

  useEffect(() => {
    const id = setInterval(() => setElapsedSec((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!senderId) {
      return;
    }
    joinRoom({
      senderName: "",
      receiverMobile: senderId,
    });
    requestChatHistory(roomId);
    dispatch(setChatStarted(true));

    return () => {
      leaveRoom(roomId);
      dispatch(resetRoom());
      dispatch(setSocketTimerStart(false));
      dispatch(setSocketChatDisconnect(false));
    };
  }, [dispatch, roomId, senderId]);

  const onEnd = useCallback(() => {
    leaveRoom(roomId);
    dispatch(setSocketTimerStart(false));
    dispatch(setSocketChatDisconnect(false));
    dispatch(resetRoom());
    navigation.goBack();
  }, [dispatch, navigation, roomId]);

  const onOpenKundli = useCallback(() => {
    navigation.navigate("ViewKundli", {
      name: customerName,
      id: roomId,
      kundaliPayload,
    });
  }, [navigation, customerName, roomId, kundaliPayload]);

  const onSend = useCallback(() => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    dispatch(
      sendMessage({
        sender: "astrologer",
        roomId,
        message: text,
        timestamp: new Date().toISOString(),
        isFile: false,
      })
    );
    emitStopTyping(roomId);
    requestAnimationFrame(() =>
      listRef.current?.scrollToEnd({ animated: true })
    );
  }, [dispatch, draft, roomId]);

  const messages = useMemo<ChatMessage[]>(() => {
    return socketMessages.map((msg, index) => {
      const ts = msg.timestamp ? new Date(msg.timestamp).getTime() : Date.now();
      return {
        id: `${msg.roomId || roomId}-${index}-${msg.timestamp || ""}`,
        text: typeof msg.message === "string" ? msg.message : msg.fileName || "",
        isMine: msg.sender === "astrologer",
        createdAt: Number.isNaN(ts) ? Date.now() : ts,
        isFile: Boolean(msg.isFile),
        fileUrl: msg.fileUrl,
      };
    });
  }, [socketMessages, roomId]);

  useEffect(() => {
    requestAnimationFrame(() =>
      listRef.current?.scrollToEnd({ animated: true })
    );
  }, [messages.length, socketState.isTyping]);

  useEffect(() => {
    if (socketState.chatDisconnect) {
      navigation.goBack();
    }
  }, [socketState.chatDisconnect, navigation]);

  const renderMessage = useCallback(
    ({ item }: { item: ChatMessage }) => {
      const mine = item.isMine;
      return (
        <View
          style={[
            styles.bubbleRow,
            mine ? styles.bubbleRowMine : styles.bubbleRowTheirs,
          ]}
        >
          <View
            style={[
              styles.bubble,
              mine ? styles.bubbleMine : styles.bubbleTheirs,
            ]}
          >
            {item.isFile && item.fileUrl ? (
              <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>
                {item.text || item.fileUrl}
              </Text>
            ) : (
              <Text
                style={[styles.bubbleText, mine && styles.bubbleTextMine]}
              >
                {item.text}
              </Text>
            )}
            <View style={styles.bubbleMeta}>
              <Text
                style={[styles.bubbleTime, mine && styles.bubbleTimeMine]}
              >
                {formatBubbleTime(item.createdAt)}
              </Text>
              {mine ? (
                <Text style={styles.checkMine}>✓</Text>
              ) : (
                <Text style={styles.checkTheirs}>✓</Text>
              )}
            </View>
          </View>
        </View>
      );
    },
    []
  );

  const avatarSource = useMemo(() => {
    if (customerImage && customerImage.trim().length > 0) {
      return { uri: customerImage.trim() };
    }
    return images.iconamoonProfileCircleFill;
  }, [customerImage]);

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.headerLeft}>
          <Image
            source={avatarSource}
            style={styles.avatar}
            resizeMode="cover"
          />
          <View>
            <Text style={styles.headerName} numberOfLines={1}>
              {customerName}
            </Text>
            <Text style={styles.headerTimer}>
              {formatSessionClock(elapsedSec)}
            </Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <Pressable
            onPress={onEnd}
            style={styles.endButton}
            hitSlop={8}
          >
            <Text style={styles.endButtonText}>{t("chat.end")}</Text>
          </Pressable>
          <Pressable
            onPress={onOpenKundli}
            style={styles.kundliIconWrap}
            hitSlop={8}
          >
            <Image
              source={images.star}
              style={styles.kundliIcon}
              resizeMode="contain"
            />
          </Pressable>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.listContent}
          style={styles.list}
          showsVerticalScrollIndicator={false}
        />

        <View
          style={[
            styles.inputBar,
            {
              paddingBottom: Math.max(insets.bottom, 12),
              paddingTop: 12,
            },
          ]}
        >
          <View style={styles.inputShell}>
            <TextInput
              style={styles.input}
              placeholder={t("chat.typeMessage")}
              placeholderTextColor="#B0ACAC"
              value={draft}
              onChangeText={(value) => {
                setDraft(value);
                if (value.trim().length > 0) {
                  emitTyping(roomId);
                } else {
                  emitStopTyping(roomId);
                }
              }}
              multiline={false}
            />
            <Pressable
              style={styles.attachInner}
              hitSlop={8}
              onPress={() => {}}
              accessibilityRole="button"
              accessibilityLabel="Attach"
            >
              <Text style={styles.attachIcon}>📎</Text>
            </Pressable>
          </View>
          <Pressable
            style={[styles.sendBtn, !draft.trim() && styles.sendBtnDisabled]}
            onPress={onSend}
            disabled={!draft.trim()}
            accessibilityRole="button"
            accessibilityLabel="Send"
          >
            <View style={styles.sendPlaneWrap}>
              <Text style={styles.sendIcon}>➤</Text>
            </View>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

export const ConsultationChatScreen = memo(ConsultationChatScreenComponent);

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: CHAT_BG,
  },
  flex: {
    flex: 1,
  },
  header: {
    backgroundColor: HEADER,
    paddingHorizontal: 12,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginRight: 8,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#E8D5C4",
  },
  headerName: {
    color: "#FFFFFF",
    fontSize: normalizeFont(17),
    fontWeight: "700",
    maxWidth: wp(48),
  },
  headerTimer: {
    color: "#F0E8E8",
    fontSize: normalizeFont(13),
    marginTop: 2,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  endButton: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  endButtonText: {
    color: colors.error,
    fontWeight: "700",
    fontSize: normalizeFont(14),
  },
  kundliIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: "#E8D5A8",
    alignItems: "center",
    justifyContent: "center",
  },
  kundliIcon: {
    width: 22,
    height: 22,
    tintColor: "#5C3D2E",
  },
  list: {
    flex: 1,
    backgroundColor: CHAT_BG,
  },
  listContent: {
    paddingHorizontal: wp(4),
    paddingTop: 8,
    paddingBottom: 12,
  },
  bubbleRow: {
    marginBottom: 12,
    width: "100%",
  },
  bubbleRowMine: {
    alignItems: "flex-end",
  },
  bubbleRowTheirs: {
    alignItems: "flex-start",
  },
  bubble: {
    maxWidth: "82%",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 8,
  },
  bubbleMine: {
    backgroundColor: SENT_BUBBLE,
    borderBottomRightRadius: 4,
  },
  bubbleTheirs: {
    backgroundColor: RECEIVED_BG,
    borderWidth: 1,
    borderColor: RECEIVED_BORDER,
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    color: "#2A1F1F",
    fontSize: normalizeFont(15),
    lineHeight: 22,
  },
  bubbleTextMine: {
    color: "#FFFFFF",
  },
  bubbleMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
    marginTop: 6,
  },
  bubbleTime: {
    fontSize: normalizeFont(11),
    color: "#6B5E5E",
  },
  bubbleTimeMine: {
    color: "rgba(255,255,255,0.85)",
  },
  checkMine: {
    fontSize: normalizeFont(12),
    color: "rgba(255,255,255,0.95)",
  },
  checkTheirs: {
    fontSize: normalizeFont(12),
    color: "#5C4F4F",
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: wp(4),
    gap: 10,
    backgroundColor: CHAT_BG,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#D8D0C8",
  },
  inputShell: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    paddingLeft: 18,
    paddingRight: 4,
    minHeight: 50,
    borderWidth: 1,
    borderColor: "#D5CFC7",
  },
  input: {
    flex: 1,
    fontSize: normalizeFont(15),
    color: "#2A1F1F",
    paddingVertical: Platform.OS === "ios" ? 10 : 8,
    maxHeight: hp(12),
  },
  attachInner: {
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  attachIcon: {
    fontSize: normalizeFont(20),
    color: "#5C3D2E",
  },
  sendBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: HEADER,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: {
    opacity: 0.45,
  },
  sendPlaneWrap: {
    transform: [{ rotate: "-32deg" }],
    marginTop: -2,
    marginRight: -1,
  },
  sendIcon: {
    color: "#FFFFFF",
    fontSize: normalizeFont(17),
  },
});
