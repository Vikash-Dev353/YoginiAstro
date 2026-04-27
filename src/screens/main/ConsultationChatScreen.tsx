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
  PermissionsAndroid,
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
import AudioRecorderPlayer from "react-native-audio-recorder-player";
import Video from "react-native-video";
import {
  errorCodes as documentPickerErrorCodes,
  isErrorWithCode as isDocumentPickerError,
  pick as pickDocumentFile,
  types as documentTypes,
} from "@react-native-documents/picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { images } from "../../assets/images";
import { sounds } from "../../assets/sounds";
import { colors } from "../../constants/colors";
import { useTranslation } from "../../localization/useTranslation";
import { OrderStackParamList } from "../../navigation/types";
import {
  astroApi,
  getAstrologerFromOnlineResponse,
} from "../../services/api/astroApi";
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
  fileName?: string;
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

function getAttachmentKind(params: {
  fileType?: string;
  fileUrl?: string;
  fileName?: string;
}): "image" | "pdf" | "video" | "audio" | "other" {
  const fileType = params.fileType?.toLowerCase() || "";
  const fileUrl = params.fileUrl?.toLowerCase() || "";
  const fileName = params.fileName?.toLowerCase() || "";
  if (fileType.startsWith("image/")) return "image";
  if (fileType.startsWith("video/")) return "video";
  if (fileType.startsWith("audio/")) return "audio";
  if (fileType.includes("pdf")) return "pdf";
  if (
    fileUrl.endsWith(".mp4") ||
    fileUrl.endsWith(".mov") ||
    fileUrl.endsWith(".mkv") ||
    fileName.endsWith(".mp4") ||
    fileName.endsWith(".mov") ||
    fileName.endsWith(".mkv")
  ) {
    return "video";
  }
  if (
    fileUrl.endsWith(".mp3") ||
    fileUrl.endsWith(".wav") ||
    fileUrl.endsWith(".m4a") ||
    fileName.endsWith(".mp3") ||
    fileName.endsWith(".wav") ||
    fileName.endsWith(".m4a")
  ) {
    return "audio";
  }
  if (fileUrl.endsWith(".pdf") || fileName.endsWith(".pdf")) return "pdf";
  if (
    fileUrl.endsWith(".jpg") ||
    fileUrl.endsWith(".jpeg") ||
    fileUrl.endsWith(".png") ||
    fileUrl.endsWith(".webp") ||
    fileName.endsWith(".jpg") ||
    fileName.endsWith(".jpeg") ||
    fileName.endsWith(".png") ||
    fileName.endsWith(".webp")
  ) {
    return "image";
  }
  return "other";
}

function ConsultationChatScreenComponent({ navigation, route }: Props) {
  const { customerName, roomId, senderId, kundaliPayload, customerImage } =
    route.params;
  const dispatch = useAppDispatch();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const socketState = useAppSelector(selectSocketState);
  const socketMessages = useAppSelector(selectMessages);
  const token = useAppSelector((state) => state.auth.token);
  const astroId = useAppSelector((state) => state.auth.astroId);

  const [remainingSec, setRemainingSec] = useState(0);
  const [draft, setDraft] = useState("");
  const [isSendingAttachment, setIsSendingAttachment] = useState(false);
  const [isAttachmentSheetVisible, setIsAttachmentSheetVisible] = useState(false);
  const [astrologerImageUri, setAstrologerImageUri] = useState<string | null>(null);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [recordingSec, setRecordingSec] = useState(0);
  const [playSendSound, setPlaySendSound] = useState(false);
  const [playReceiveSound, setPlayReceiveSound] = useState(false);
  const hasShownDisconnectAlertRef = useRef(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const audioRecorderRef = useRef(new AudioRecorderPlayer());
  const previousMessageCountRef = useRef(0);

  const initialRemainingSec = useMemo(() => {
    const chatData = socketState.astroChatData as
      | { userBalance?: number; astroPrice?: number }
      | null;
    const balance = Number(chatData?.userBalance ?? 0);
    const pricePerMinute = Number(chatData?.astroPrice ?? 0);
    if (!Number.isFinite(balance) || !Number.isFinite(pricePerMinute) || pricePerMinute <= 0) {
      return 0;
    }
    return Math.max(0, Math.floor((balance / pricePerMinute) * 60));
  }, [socketState.astroChatData]);

  useEffect(() => {
    setRemainingSec(initialRemainingSec);
  }, [initialRemainingSec, roomId]);

  useEffect(() => {
    const shouldRunCountdown = socketState.timerStart;
    if (!shouldRunCountdown || remainingSec <= 0) {
      return;
    }
    const id = setInterval(() => {
      setRemainingSec((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [remainingSec, socketState.timerStart]);

  useEffect(() => {
    if (!senderId) {
      return;
    }
    hasShownDisconnectAlertRef.current = false;
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
    setPlaySendSound(false);
    setTimeout(() => setPlaySendSound(true), 0);
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
        const formData = new FormData();
        formData.append("file", {
          uri: attachment.uri,
          name: attachment.name,
          type: attachment.type,
        } as unknown as Blob);

        const uploadResponse = await astroApi.uploadChatFile(formData);
        const uploadedFileUrl =
          uploadResponse.fullUrl ||
          uploadResponse.fileUrl ||
          uploadResponse.url ||
          uploadResponse.data?.fullUrl ||
          uploadResponse.data?.fileUrl ||
          uploadResponse.data?.url;

        const normalizedStatus = (uploadResponse.status || "").toLowerCase();
        const isUploadAccepted =
          normalizedStatus.length === 0 ||
          normalizedStatus === "success" ||
          normalizedStatus === "ok";

        if (!uploadedFileUrl || !isUploadAccepted) {
          throw new Error(uploadResponse.message || "Unable to upload attachment.");
        }

        const majorFileType = `${attachment.type.split("/")[0] || "application"}/`;
        setPlaySendSound(false);
        setTimeout(() => setPlaySendSound(true), 0);
        dispatch(
          sendMessage({
            sender: "astrologer",
            roomId,
            message: attachment.name,
            timestamp: new Date().toISOString(),
            isFile: true,
            fileUrl: uploadedFileUrl,
            fileName: attachment.name,
            fileType: majorFileType,
            file: uploadedFileUrl,
          })
        );
      } catch {
        Alert.alert(ATTACHMENT_ERROR_TITLE, "Unable to upload this attachment.");
      } finally {
        setIsSendingAttachment(false);
      }
    },
    [dispatch, roomId]
  );

  const pickFromCamera = useCallback(
    async (mode: "photo" | "video") => {
      try {
        if (Platform.OS === "android") {
          const requiredPermissions =
            mode === "video"
              ? [
                  PermissionsAndroid.PERMISSIONS.CAMERA,
                  PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
                ]
              : [PermissionsAndroid.PERMISSIONS.CAMERA];

          const permissionResult = await PermissionsAndroid.requestMultiple(
            requiredPermissions
          );
          const allGranted = requiredPermissions.every(
            (permission) =>
              permissionResult[permission] === PermissionsAndroid.RESULTS.GRANTED
          );

          if (!allGranted) {
            Alert.alert(
              "Permission Required",
              mode === "video"
                ? "Camera and microphone permissions are required to record video."
                : "Camera permission is required to capture photo."
            );
            return;
          }
        }

        const result = await launchCamera({
          mediaType: mode,
          cameraType: "back",
          quality: 0.8,
          videoQuality: "medium",
          ...(mode === "video" ? { durationLimit: 180 } : {}),
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

  const startAudioRecording = useCallback(async () => {
    try {
      if (Platform.OS === "android") {
        const permission = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
        );
        if (permission !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert(
            "Permission Required",
            "Microphone permission is required to record audio."
          );
          return;
        }
      }

      const outputPath = await audioRecorderRef.current.startRecorder();
      if (!outputPath) {
        Alert.alert(ATTACHMENT_PICKER_ERROR_TITLE, "Unable to start recorder.");
        return;
      }

      audioRecorderRef.current.addRecordBackListener((event: { currentPosition: number }) => {
        const nextSec = Math.floor((event.currentPosition || 0) / 1000);
        setRecordingSec(nextSec);
      });

      setRecordingSec(0);
      setIsRecordingAudio(true);
    } catch {
      Alert.alert(ATTACHMENT_PICKER_ERROR_TITLE, "Unable to start recorder.");
    }
  }, []);

  const stopAudioRecording = useCallback(async () => {
    try {
      const recordedUri = await audioRecorderRef.current.stopRecorder();
      audioRecorderRef.current.removeRecordBackListener();
      setIsRecordingAudio(false);
      setRecordingSec(0);

      if (!recordedUri) {
        Alert.alert(ATTACHMENT_PICKER_ERROR_TITLE, "Unable to save recording.");
        return;
      }

      await sendAttachment({
        uri: recordedUri,
        name: `recording-${Date.now()}.m4a`,
        type: "audio/m4a",
      });
    } catch {
      setIsRecordingAudio(false);
      setRecordingSec(0);
      Alert.alert(ATTACHMENT_PICKER_ERROR_TITLE, "Unable to stop recorder.");
    }
  }, [sendAttachment]);

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
    if (isRecordingAudio) {
      return;
    }
    setIsAttachmentSheetVisible(false);
  }, [isRecordingAudio]);

  const toggleAudioRecording = useCallback(async () => {
    if (isRecordingAudio) {
      await stopAudioRecording();
      closeAttachmentMenu();
      return;
    }
    await startAudioRecording();
  }, [closeAttachmentMenu, isRecordingAudio, startAudioRecording, stopAudioRecording]);

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

  const openAttachmentPreview = useCallback(
    (item: ChatMessage) => {
      if (!item.fileUrl) return;
      const kind = getAttachmentKind({
        fileType: item.fileType,
        fileUrl: item.fileUrl,
        fileName: item.fileName || item.text,
      });
      if (
        kind === "image" ||
        kind === "pdf" ||
        kind === "video" ||
        kind === "audio"
      ) {
        navigation.navigate("AttachmentViewer", {
          uri: item.fileUrl,
          name: item.fileName || item.text,
          type: kind,
        });
        return;
      }
      openAttachmentFile(item.fileUrl);
    },
    [navigation, openAttachmentFile]
  );

  const messages = useMemo<ChatMessage[]>(() => {
    return socketMessages.map((msg, index) => {
      const ts = msg.timestamp ? new Date(msg.timestamp).getTime() : Date.now();
      return {
        id: `${msg.roomId || roomId}-${index}-${msg.timestamp || ""}`,
        text: typeof msg.message === "string" ? msg.message : msg.fileName || "",
        isMine: msg.sender === "astrologer",
        createdAt: Number.isNaN(ts) ? Date.now() : ts,
        isFile: Boolean(msg.isFile),
        fileName: msg.fileName,
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
    previousMessageCountRef.current = socketMessages.length;
  }, [roomId, socketMessages.length]);

  useEffect(() => {
    const previousCount = previousMessageCountRef.current;
    const currentCount = socketMessages.length;
    if (currentCount <= previousCount) {
      previousMessageCountRef.current = currentCount;
      return;
    }
    const latest = socketMessages[currentCount - 1];
    if (latest?.sender !== "astrologer") {
      setPlayReceiveSound(false);
      setTimeout(() => setPlayReceiveSound(true), 0);
    }
    previousMessageCountRef.current = currentCount;
  }, [socketMessages]);

  useEffect(() => {
    return () => {
      if (isRecordingAudio) {
        audioRecorderRef.current.stopRecorder().catch(() => undefined);
      }
      audioRecorderRef.current.removeRecordBackListener();
    };
  }, [isRecordingAudio]);

  useEffect(() => {
    if (hasShownDisconnectAlertRef.current) {
      return;
    }

    if (socketState.chatDisconnect) {
      hasShownDisconnectAlertRef.current = true;
      Alert.alert(
        "Chat Disconnected",
        "The user has left the chat.",
        [{ text: "OK", onPress: onEnd }],
        { cancelable: false }
      );
      return;
    }

  }, [onEnd, socketState.chatDisconnect]);

  useEffect(() => {
    const resolvedAstroId = astroId?.trim();
    if (!token || !resolvedAstroId) {
      return;
    }
    let active = true;
    const loadAstrologerImage = async () => {
      try {
        const response = await astroApi.getOnline({ astroId: resolvedAstroId });
        const astrologer = getAstrologerFromOnlineResponse(response);
        const profileUri = astrologer?.profileImage?.trim();
        if (!active) return;
        setAstrologerImageUri(profileUri && profileUri.length > 0 ? profileUri : null);
      } catch {
        if (active) {
          setAstrologerImageUri(null);
        }
      }
    };
    loadAstrologerImage();
    return () => {
      active = false;
    };
  }, [astroId, token]);

  const avatarSource = useMemo(() => {
    if (customerImage && customerImage.trim().length > 0) {
      return { uri: customerImage.trim() };
    }
    return images.iconamoonProfileCircleFill;
  }, [customerImage]);

  const astrologerAvatarSource = useMemo(() => {
    if (astrologerImageUri) {
      return { uri: astrologerImageUri };
    }
    return images.iconamoonProfileCircleFill;
  }, [astrologerImageUri]);

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
          {!mine ? (
            <Image source={avatarSource} style={styles.bubbleAvatar} resizeMode="cover" />
          ) : null}
          <View
            style={[
              styles.bubble,
              mine ? styles.bubbleMine : styles.bubbleTheirs,
            ]}
          >
            {item.isFile && item.fileUrl ? (
              <Pressable onPress={() => openAttachmentPreview(item)}>
                {(() => {
                  const attachmentKind = getAttachmentKind({
                    fileType: item.fileType,
                    fileUrl: item.fileUrl,
                    fileName: item.fileName || item.text,
                  });
                  if (attachmentKind === "image") {
                    return (
                      <View>
                        <Image
                          source={{ uri: item.fileUrl }}
                          style={styles.attachmentPreviewImage}
                          resizeMode="cover"
                        />
                        <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>
                          {item.fileName || item.text || "Image"}
                        </Text>
                      </View>
                    );
                  }
                  if (attachmentKind === "video") {
                    return (
                      <View style={[styles.mediaPreviewBox, mine && styles.mediaPreviewBoxMine]}>
                        <Text style={[styles.mediaPreviewIcon, mine && styles.mediaPreviewIconMine]}>
                          🎬
                        </Text>
                        <Text style={[styles.mediaPreviewLabel, mine && styles.mediaPreviewLabelMine]}>
                          Video
                        </Text>
                        <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>
                          {item.fileName || item.text || "Video file"}
                        </Text>
                      </View>
                    );
                  }
                  if (attachmentKind === "audio") {
                    return (
                      <View style={[styles.mediaPreviewBox, mine && styles.mediaPreviewBoxMine]}>
                        <Text style={[styles.mediaPreviewIcon, mine && styles.mediaPreviewIconMine]}>
                          🎵
                        </Text>
                        <Text style={[styles.mediaPreviewLabel, mine && styles.mediaPreviewLabelMine]}>
                          Audio
                        </Text>
                        <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>
                          {item.fileName || item.text || "Audio file"}
                        </Text>
                      </View>
                    );
                  }
                  return (
                    <View style={[styles.pdfPreviewBox, mine && styles.pdfPreviewBoxMine]}>
                      <Text style={[styles.pdfPreviewIcon, mine && styles.pdfPreviewIconMine]}>
                        📄
                      </Text>
                      <Text style={[styles.pdfPreviewLabel, mine && styles.pdfPreviewLabelMine]}>
                        PDF
                      </Text>
                      <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>
                        {item.fileName || item.text || "Document"}
                      </Text>
                    </View>
                  );
                })()}
                <Text style={[styles.fileHintText, mine && styles.fileHintTextMine]}>
                  Tap to preview
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
          {mine ? (
            <Image
              source={astrologerAvatarSource}
              style={styles.bubbleAvatar}
              resizeMode="cover"
            />
          ) : null}
        </View>
      );
    },
    [astrologerAvatarSource, avatarSource, openAttachmentPreview]
  );

  return (
    <View style={styles.root}>
      <Video
        source={sounds.messageSend}
        style={styles.hiddenAudioPlayer}
        paused={!playSendSound}
        onEnd={() => setPlaySendSound(false)}
        onError={() => setPlaySendSound(false)}
        playWhenInactive
        ignoreSilentSwitch="ignore"
        volume={1.0}
      />
      <Video
        source={sounds.messageReceive}
        style={styles.hiddenAudioPlayer}
        paused={!playReceiveSound}
        onEnd={() => setPlayReceiveSound(false)}
        onError={() => setPlayReceiveSound(false)}
        playWhenInactive
        ignoreSilentSwitch="ignore"
        volume={1.0}
      />
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
              {formatSessionClock(remainingSec)}
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
        {isRecordingAudio ? (
          <View style={styles.recordingContainer}>
            <Text style={styles.recordingText}>
              Recording audio... {formatSessionClock(recordingSec)}
            </Text>
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
                  toggleAudioRecording();
                }}
              >
                <View
                  style={[
                    styles.attachmentCircle,
                    styles.recorderCircle,
                    isRecordingAudio && styles.recorderCircleActive,
                  ]}
                >
                  <Text style={styles.attachmentIcon}>🎙️</Text>
                </View>
                <Text style={styles.attachmentLabel}>
                  {isRecordingAudio ? "Stop & Send" : "Recorder"}
                </Text>
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
  hiddenAudioPlayer: {
    width: 0,
    height: 0,
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
  recordingContainer: {
    paddingHorizontal: wp(6),
    paddingBottom: 6,
  },
  recordingText: {
    fontSize: normalizeFont(12),
    color: "#B42323",
    fontWeight: "600",
  },
  bubbleRow: {
    marginBottom: 12,
    width: "100%",
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  bubbleRowMine: {
    justifyContent: "flex-end",
  },
  bubbleRowTheirs: {
    justifyContent: "flex-start",
  },
  bubbleAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#E8D5C4",
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
  attachmentPreviewImage: {
    width: Math.min(wp(52), 220),
    height: 130,
    borderRadius: 10,
    marginBottom: 8,
    backgroundColor: "#E7E1DA",
  },
  pdfPreviewBox: {
    borderWidth: 1,
    borderColor: "#D6CBC1",
    backgroundColor: "#FFF4EE",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
  },
  pdfPreviewBoxMine: {
    backgroundColor: "rgba(255,255,255,0.14)",
    borderColor: "rgba(255,255,255,0.4)",
  },
  pdfPreviewIcon: {
    fontSize: normalizeFont(18),
    marginBottom: 4,
  },
  pdfPreviewLabel: {
    fontSize: normalizeFont(11),
    fontWeight: "700",
    color: "#A5332B",
    marginBottom: 4,
  },
  pdfPreviewIconMine: {
    color: "#FFFFFF",
  },
  pdfPreviewLabelMine: {
    color: "#FFFFFF",
  },
  mediaPreviewBox: {
    borderWidth: 1,
    borderColor: "#D6CBC1",
    backgroundColor: "#F6F0EA",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
  },
  mediaPreviewBoxMine: {
    backgroundColor: "rgba(255,255,255,0.14)",
    borderColor: "rgba(255,255,255,0.4)",
  },
  mediaPreviewIcon: {
    fontSize: normalizeFont(18),
    marginBottom: 4,
  },
  mediaPreviewIconMine: {
    color: "#FFFFFF",
  },
  mediaPreviewLabel: {
    fontSize: normalizeFont(11),
    fontWeight: "700",
    color: "#5C3D2E",
    marginBottom: 4,
  },
  mediaPreviewLabelMine: {
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
  recorderCircleActive: {
    backgroundColor: "#B42323",
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
