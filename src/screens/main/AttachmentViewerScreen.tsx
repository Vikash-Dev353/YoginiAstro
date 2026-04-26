import { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { OrderStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<OrderStackParamList, "AttachmentViewer">;

export function AttachmentViewerScreen({ navigation, route }: Props) {
  const { uri, name, type } = route.params;
  const insets = useSafeAreaInsets();
  const title = name || (type === "image" ? "Image Preview" : "PDF Preview");

  const pdfViewerUri =
    type === "pdf"
      ? `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(uri)}`
      : uri;

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
  loaderWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
});
