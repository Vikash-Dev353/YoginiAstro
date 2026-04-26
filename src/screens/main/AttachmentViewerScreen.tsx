import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import ReactNativeBlobUtil from "react-native-blob-util";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Video from "react-native-video";
import { WebView } from "react-native-webview";
import { OrderStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<OrderStackParamList, "AttachmentViewer">;

export function AttachmentViewerScreen({ navigation, route }: Props) {
  const { uri, name, type } = route.params;
  const insets = useSafeAreaInsets();
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [localMediaUri, setLocalMediaUri] = useState<string | null>(null);

  const title = useMemo(() => {
    if (name) return name;
    if (type === "image") return "Image Preview";
    if (type === "video") return "Video Preview";
    if (type === "audio") return "Audio Preview";
    return "PDF Preview";
  }, [name, type]);

  const pdfViewerUri =
    type === "pdf"
      ? `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(uri)}`
      : uri;

  useEffect(() => {
    if (type !== "video" && type !== "audio") {
      return;
    }

    let isActive = true;
    const extensionFromUri =
      uri.split("?")[0]?.split(".").pop()?.trim().toLowerCase() ||
      (type === "video" ? "mp4" : "mp3");
    const safeName = (name || `media-${Date.now()}`)
      .replace(/[^a-zA-Z0-9._-]/g, "-")
      .slice(0, 60);
    const targetPath = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/${Date.now()}-${safeName}.${extensionFromUri}`;

    setDownloadProgress(0);
    setDownloadError(null);
    setIsDownloading(true);
    setLocalMediaUri(null);

    ReactNativeBlobUtil.config({ path: targetPath, fileCache: true })
      .fetch("GET", uri)
      .progress({ interval: 150 }, (received, total) => {
        if (!isActive) return;
        if (total > 0) {
          setDownloadProgress(Math.min(1, received / total));
        }
      })
      .then((res) => {
        if (!isActive) return;
        const resolvedPath = res.path();
        setLocalMediaUri(`file://${resolvedPath}`);
      })
      .catch(() => {
        if (!isActive) return;
        setDownloadError("Unable to download media. Please try again.");
      })
      .finally(() => {
        if (isActive) {
          setIsDownloading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [name, type, uri]);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#151515" />
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={10}
        >
          <Text style={styles.backIcon}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {type === "image" ? (
        <View style={styles.imageWrap}>
          <Image source={{ uri }} style={styles.image} resizeMode="contain" />
        </View>
      ) : type === "video" || type === "audio" ? (
        <View style={styles.mediaWrap}>
          {isDownloading ? (
            <View style={styles.downloadCard}>
              <Text style={styles.downloadTitle}>
                Downloading {type === "video" ? "video" : "audio"}...
              </Text>
              <View style={styles.progressTrack}>
                <View
                  style={[styles.progressFill, { width: `${downloadProgress * 100}%` }]}
                />
              </View>
              <Text style={styles.progressText}>
                {Math.round(downloadProgress * 100)}%
              </Text>
            </View>
          ) : downloadError ? (
            <View style={styles.downloadCard}>
              <Text style={styles.downloadError}>{downloadError}</Text>
            </View>
          ) : localMediaUri ? (
            <View style={styles.playerCard}>
              {type === "audio" ? (
                <Text style={styles.audioTitle} numberOfLines={1}>
                  {name || "Audio file"}
                </Text>
              ) : null}
              <Video
                source={{ uri: localMediaUri }}
                style={type === "video" ? styles.videoPlayer : styles.audioPlayer}
                controls
                resizeMode={type === "video" ? "contain" : "none"}
                paused={false}
                audioOnly={type === "audio"}
                playInBackground={false}
                ignoreSilentSwitch="ignore"
              />
            </View>
          ) : (
            <View style={styles.loaderWrap}>
              <ActivityIndicator size="large" color="#632B27" />
            </View>
          )}
        </View>
      ) : (
        <View style={styles.pdfWrap}>
          <WebView
            source={{ uri: pdfViewerUri }}
            startInLoadingState
            renderLoading={() => (
              <View style={styles.loaderWrap}>
                <ActivityIndicator size="large" color="#632B27" />
              </View>
            )}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#151515",
  },
  header: {
    paddingHorizontal: 12,
    paddingBottom: 10,
    backgroundColor: "#1E1E1E",
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#383838",
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#2D2D2D",
    alignItems: "center",
    justifyContent: "center",
  },
  backIcon: {
    color: "#FFFFFF",
    fontSize: 22,
    lineHeight: 24,
    fontWeight: "600",
    marginTop: -1,
  },
  headerTitle: {
    flex: 1,
    marginHorizontal: 10,
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
  headerSpacer: {
    width: 36,
    height: 36,
  },
  imageWrap: {
    flex: 1,
    padding: 10,
  },
  image: {
    flex: 1,
    width: "100%",
    height: "100%",
    borderRadius: 10,
    backgroundColor: "#0F0F0F",
  },
  pdfWrap: {
    flex: 1,
    margin: 10,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
  },
  mediaWrap: {
    flex: 1,
    padding: 12,
  },
  downloadCard: {
    borderRadius: 12,
    backgroundColor: "#242424",
    borderWidth: 1,
    borderColor: "#3A3A3A",
    padding: 14,
    marginTop: 10,
  },
  downloadTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 10,
  },
  progressTrack: {
    width: "100%",
    height: 8,
    borderRadius: 999,
    backgroundColor: "#3A3A3A",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#D64B5E",
  },
  progressText: {
    marginTop: 8,
    color: "#D8D8D8",
    fontSize: 12,
    fontWeight: "600",
  },
  downloadError: {
    color: "#FFD0D0",
    fontSize: 13,
    fontWeight: "500",
  },
  playerCard: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: "#090909",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#2D2D2D",
  },
  videoPlayer: {
    flex: 1,
    width: "100%",
  },
  audioPlayer: {
    height: 72,
    width: "100%",
    backgroundColor: "#1F1F1F",
  },
  audioTitle: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 6,
    backgroundColor: "#121212",
  },
  loaderWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
});
