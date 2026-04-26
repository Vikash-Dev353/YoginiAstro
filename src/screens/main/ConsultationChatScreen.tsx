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
  Alert,
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  launchCamera,
  launchImageLibrary,
  type Asset,
} from "react-native-image-picker";
import {
  errorCodes as documentPickerErrorCodes,
  isErrorWithCode as isDocumentPickerError,
  pick as pickDocumentFile,
  types as documentTypes,
} from "@react-native-documents/picker";
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
  fileType?: string;
};

const HEADER = "#632B27";
const CHAT_BG = "#FCF9F5";
const SENT_BUBBLE = "#632B27";
const RECEIVED_BG = "#FFF9F5";
const RECEIVED_BORDER = "#E5DDD5";
const MAX_ATTACHMENT_SIZE_BYTES = 20 * 1024 * 1024;
const ATTACHMENT_ERROR_TITLE = "Attachment Error";
const ATTACHMENT_PICKER_ERROR_TITLE = "Picker Error";

type AttachmentCandidate = {
  uri: string;
  name: string;
  type: string;
  size?: number;
};

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

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function inferNameFromUri(uri: string): string {
  const chunks = uri.split("/");
  const last = chunks[chunks.length - 1] || "attachment";
  return decodeURIComponent(last);
}

function inferMimeFromName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".mp4") || lower.endsWith(".mov") || lower.endsWith(".mkv")) {
    return "video/mp4";
  }
  if (lower.endsWith(".mp3") || lower.endsWith(".m4a") || lower.endsWith(".wav")) {
    return "audio/mpeg";
  }
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  return "application/octet-stream";
}

function mapAssetToAttachment(asset?: Asset): AttachmentCandidate | null {
  if (!asset?.uri) return null;
  const name = asset.fileName || inferNameFromUri(asset.uri);
  return {
    uri: asset.uri,
    name,
    type: asset.type || inferMimeFromName(name),
    size: asset.fileSize,
  };
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
  const [isSendingAttachment, setIsSendingAttachment] = useState(false);
  const [isAttachmentSheetVisible, setIsAttachmentSheetVisible] = useState(false);
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

  const sendAttachment = useCallback(
    async (attachment: AttachmentCandidate | null) => {
      if (!attachment?.uri) {
        return;
      }

      if (
        typeof attachment.size === "number" &&
        attachment.size > MAX_ATTACHMENT_SIZE_BYTES
      ) {
        Alert.alert(
          ATTACHMENT_ERROR_TITLE,
          `Maximum file size is 20 MB. Selected file is ${formatSize(
            attachment.size
          )}.`
        );
        return;
      }

      setIsSendingAttachment(true);
      try {
        dispatch(
          sendMessage({
            sender: "astrologer",
            roomId,
            message: attachment.name,
            timestamp: new Date().toISOString(),
            isFile: true,
            fileUrl: attachment.uri,
            fileName: attachment.name,
            fileType: attachment.type,
          })
        );
      } finally {
        setIsSendingAttachment(false);
      }
    },
    [dispatch, roomId]
  );

  const pickFromCamera = useCallback(
    async (mode: "photo" | "video") => {
      try {
        const result = await launchCamera({
          mediaType: mode,
          cameraType: "back",
          quality: 0.8,
          videoQuality: "medium",
          durationLimit: mode === "video" ? 180 : undefined,
          includeBase64: false,
        });
        if (result.didCancel) return;
        if (result.errorMessage) {
          Alert.alert(ATTACHMENT_PICKER_ERROR_TITLE, result.errorMessage);
          return;
        }
        await sendAttachment(mapAssetToAttachment(result.assets?.[0]));
      } catch {
        Alert.alert(ATTACHMENT_PICKER_ERROR_TITLE, "Unable to open camera.");
      }
    },
    [sendAttachment]
  );

  const pickAudioForRecorder = useCallback(
    async () => {
      try {
        const [picked] = await pickDocumentFile({
          type: [documentTypes.audio],
          presentationStyle: "fullScreen",
        });
        if (!picked) {
          return;
        }
        await sendAttachment({
          uri: picked.uri,
          name: picked.name || inferNameFromUri(picked.uri || ""),
          type: picked.type || inferMimeFromName(picked.name || ""),
          size: picked.size ?? undefined,
        });
      } catch (error) {
        if (
          !(
            isDocumentPickerError(error) &&
            error.code === documentPickerErrorCodes.OPERATION_CANCELED
          )
        ) {
          Alert.alert(
            ATTACHMENT_PICKER_ERROR_TITLE,
            "Unable to pick this attachment."
          );
        }
      }
    },
    [sendAttachment]
  );

  const pickFromGallery = useCallback(async () => {
    try {
      const result = await launchImageLibrary({
        mediaType: "mixed" as "photo",
        quality: 0.8,
        selectionLimit: 1,
        includeBase64: false,
      });
      if (result.didCancel) return;
      if (result.errorMessage) {
        Alert.alert(ATTACHMENT_PICKER_ERROR_TITLE, result.errorMessage);
        return;
      }
      await sendAttachment(mapAssetToAttachment(result.assets?.[0]));
    } catch {
      Alert.alert(ATTACHMENT_PICKER_ERROR_TITLE, "Unable to open gallery.");
    }
  }, [sendAttachment]);

  const onOpenAttachmentMenu = useCallback(() => {
    setIsAttachmentSheetVisible(true);
  }, []);

  const closeAttachmentMenu = useCallback(() => {
    setIsAttachmentSheetVisible(false);
  }, []);

  const openAttachmentFile = useCallback(async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert("Open File", "Unable to open this attachment.");
        return;
      }
      await Linking.openURL(url);
    } catch {
      Alert.alert("Open File", "Unable to open this attachment.");
    }
  }, []);

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
        fileType: msg.fileType,
      };
    });
  }, [socketMessages, roomId]);

  const isUserTyping = useMemo(() => {
    if (!socketState.isTyping) return false;
    const typingPayload = socketState.typingUser as
      | { roomId?: string; sender?: string }
      | null;
    if (!typingPayload) return false;
    const sameRoom = !typingPayload.roomId || typingPayload.roomId === roomId;
    const fromUser = !typingPayload.sender || typingPayload.sender !== "astrologer";
    return sameRoom && fromUser;
  }, [roomId, socketState.isTyping, socketState.typingUser]);

  useEffect(() => {
    requestAnimationFrame(() =>
      listRef.current?.scrollToEnd({ animated: true })
    );
  }, [isUserTyping, messages.length]);

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
              <Pressable onPress={() => openAttachmentFile(item.fileUrl || "")}>
                <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>
                  {item.text || "Attachment"}
                </Text>
                <Text style={[styles.fileHintText, mine && styles.fileHintTextMine]}>
                  Tap to open
                </Text>
              </Pressable>
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
    [openAttachmentFile]
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
        {isUserTyping ? (
          <View style={styles.typingContainer}>
            <Text style={styles.typingText}>{customerName} is typing...</Text>
          </View>
        ) : null}

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
              onPress={onOpenAttachmentMenu}
              disabled={isSendingAttachment}
              accessibilityRole="button"
              accessibilityLabel="Attach"
            >
              {isSendingAttachment ? (
                <ActivityIndicator size="small" color="#5C3D2E" />
              ) : (
                <Text style={styles.attachIcon}>📎</Text>
              )}
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

      <Modal
        visible={isAttachmentSheetVisible}
        transparent
        animationType="slide"
        onRequestClose={closeAttachmentMenu}
      >
        <Pressable style={styles.sheetBackdrop} onPress={closeAttachmentMenu}>
          <Pressable
            style={styles.sheetContainer}
            onPress={(event) => event.stopPropagation()}
          >
            <View style={styles.sheetHandle} />
            <View style={styles.attachmentRow}>
              <Pressable
                style={styles.attachmentOption}
                onPress={() => {
                  closeAttachmentMenu();
                  pickFromCamera("photo");
                }}
              >
                <View style={styles.attachmentCircle}>
                  <Text style={styles.attachmentIcon}>📷</Text>
                </View>
                <Text style={styles.attachmentLabel}>Camera</Text>
              </Pressable>

              <Pressable
                style={styles.attachmentOption}
                onPress={() => {
                  closeAttachmentMenu();
                  pickFromCamera("video");
                }}
              >
                <View style={styles.attachmentCircle}>
                  <Text style={styles.attachmentIcon}>🎥</Text>
                </View>
                <Text style={styles.attachmentLabel}>Camera{"\n"}Camcorder</Text>
              </Pressable>

              <Pressable
                style={styles.attachmentOption}
                onPress={() => {
                  closeAttachmentMenu();
                  pickAudioForRecorder();
                }}
              >
                <View style={[styles.attachmentCircle, styles.recorderCircle]}>
                  <Text style={styles.attachmentIcon}>🎙️</Text>
                </View>
                <Text style={styles.attachmentLabel}>Recorder</Text>
              </Pressable>

              <Pressable
                style={styles.attachmentOption}
                onPress={() => {
                  closeAttachmentMenu();
                  pickFromGallery();
                }}
              >
                <View style={[styles.attachmentCircle, styles.galleryCircle]}>
                  <Text style={styles.attachmentIcon}>🖼️</Text>
                </View>
                <Text style={styles.attachmentLabel}>Photos &{"\n"}videos</Text>
              </Pressable>
            </View>
            <Pressable style={styles.sheetCancel} onPress={closeAttachmentMenu}>
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
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
  typingContainer: {
    paddingHorizontal: wp(6),
    paddingTop: 2,
    paddingBottom: 8,
  },
  typingText: {
    fontSize: normalizeFont(12),
    color: "#6B5E5E",
    fontStyle: "italic",
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
  fileHintText: {
    marginTop: 4,
    fontSize: normalizeFont(11),
    color: "#7D7070",
    textDecorationLine: "underline",
  },
  fileHintTextMine: {
    color: "rgba(255,255,255,0.85)",
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
  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  sheetContainer: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 16,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 64,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#D8D6D6",
    marginBottom: 14,
  },
  attachmentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
    paddingHorizontal: 4,
  },
  attachmentOption: {
    flex: 1,
    alignItems: "center",
  },
  attachmentCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: "#F1F1F4",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  recorderCircle: {
    backgroundColor: "#2D2D35",
  },
  galleryCircle: {
    backgroundColor: "#CEE0F6",
  },
  attachmentIcon: {
    fontSize: normalizeFont(24),
  },
  attachmentLabel: {
    fontSize: normalizeFont(13),
    lineHeight: normalizeFont(17),
    textAlign: "center",
    color: "#2F2A2A",
    fontWeight: "500",
  },
  sheetCancel: {
    marginTop: 14,
    borderRadius: 10,
    backgroundColor: "#F3ECE4",
    paddingVertical: 12,
    alignItems: "center",
  },
  sheetCancelText: {
    fontSize: normalizeFont(15),
    fontWeight: "700",
    color: "#5C3D2E",
  },
});
