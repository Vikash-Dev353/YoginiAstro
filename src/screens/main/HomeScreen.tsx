import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { CompositeScreenProps } from "@react-navigation/native";
import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { images } from "../../assets/images";
import { AppButton } from "../../components/common/AppButton";
import { colors } from "../../constants/colors";
import { useTranslation } from "../../localization/useTranslation";
import { AppLanguage } from "../../localization/translations";
import { HomeStackParamList, RootTabParamList } from "../../navigation/types";
import {
  astroApi,
  getAstrologerFromOnlineResponse,
} from "../../services/api/astroApi";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { changeAppLanguage } from "../../store/slices/languageSlice";
import { hp, normalizeFont, wp } from "../../utils/responsive";

type ActionItem = {
  key: string;
  label: string;
  icon: string;
  image?: number;
};

type Props = CompositeScreenProps<
  NativeStackScreenProps<HomeStackParamList, "HomeMain">,
  BottomTabScreenProps<RootTabParamList>
>;

function HomeScreenComponent({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const { t, appLanguage } = useTranslation();
  const token = useAppSelector((state) => state.auth.token);
  const astroId =
    useAppSelector((state) => state.auth.astroId)?.trim()?.toUpperCase() ||
    "AS1031";

  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [chatEnabled, setChatEnabled] = useState(false);
  const [isStatusSyncing, setIsStatusSyncing] = useState(false);
  const [astroName, setAstroName] = useState("Shrimaan");
  const [astroMobile, setAstroMobile] = useState("7275215936");
  const [isLanguageModalVisible, setLanguageModalVisible] = useState(false);
  const [selectedLanguage, setSelectedLanguage] =
    useState<AppLanguage>(appLanguage);
  const [finalPayableToAstrologer, setFinalPayableToAstrologer] = useState<number | null>(
    null
  );

  const actions = useMemo<ActionItem[]>(
    () => [
      { key: "call", label: t("home.call"), icon: "C", image: images.call },
      {
        key: "chat",
        label: t("common.chat"),
        icon: "M",
        image: images.chatBubble,
      },
      {
        key: "waitlist",
        label: t("home.waitlist"),
        icon: "W",
        image: images.taskList,
      },
      {
        key: "go-live",
        label: t("common.goLiveNow"),
        icon: "L",
        image: images.videoCameraVintage,
      },
      {
        key: "support",
        label: t("home.support"),
        icon: "S",
        image: images.streamlineCustomerSupportSolid,
      },
      {
        key: "reviews",
        label: t("home.myReviews"),
        icon: "R",
        image: images.star,
      },
      {
        key: "wallet",
        label: t("common.wallet"),
        icon: "W",
        image: images.walletSharp,
      },
      {
        key: "setting",
        label: t("common.setting"),
        icon: "S",
        image: images.settings,
      },
      {
        key: "profile",
        label: t("common.profile"),
        icon: "P",
        image: images.iconamoonProfileCircleFill,
      },
    ],
    [t]
  );

  const earningTitleText = useMemo(() => {
    if (finalPayableToAstrologer === null) {
      return t("home.decemberEarning");
    }
    return `Monthly Earning - ₹${finalPayableToAstrologer.toFixed(2)}`;
  }, [finalPayableToAstrologer, t]);

  const openLanguageModal = () => {
    setSelectedLanguage(appLanguage);
    setLanguageModalVisible(true);
  };

  const onApplyLanguage = () => {
    dispatch(changeAppLanguage(selectedLanguage));
    setLanguageModalVisible(false);
  };

  const loadOnlineStatus = useCallback(async () => {
    try {
      setIsStatusSyncing(true);
      const response = await astroApi.getOnline({ astroId });

      const astrologer = getAstrologerFromOnlineResponse(response);

      const callOnline =
        ((astrologer?.callStatus ?? "").toLowerCase() === "online" ||
          response.callOnline) ??
        response.data?.callOnline ??
        false;

      const chatOnline =
        ((astrologer?.chatStatus ?? "").toLowerCase() === "online" ||
          response.chatOnline) ??
        response.data?.chatOnline ??
        false;

      setVoiceEnabled(Boolean(callOnline));
      setChatEnabled(Boolean(chatOnline));
      if (astrologer?.name) {
        setAstroName(astrologer.name);
      }
      if (astrologer?.mobile) {
        setAstroMobile(astrologer.mobile);
      }
    } catch (error) {
      console.log("GET ONLINE STATUS ERROR", error);
    } finally {
      setIsStatusSyncing(false);
    }
  }, [astroId]);

  const loadMonthlyEarnings = useCallback(async () => {
    try {
      const response = await astroApi.getMonthlyEarnings({ astroId });
      const parsedFinalPayable = Number(
        response.calculation?.finalPayableToAstrologer
      );

      if (Number.isFinite(parsedFinalPayable)) {
        setFinalPayableToAstrologer(parsedFinalPayable);
      }
    } catch (error) {
      console.log("GET MONTHLY EARNINGS ERROR", error);
    }
  }, [astroId]);

  useEffect(() => {
    if (!token) {
      return;
    }
    loadOnlineStatus();
    loadMonthlyEarnings();
  }, [loadMonthlyEarnings, loadOnlineStatus, token]);

  const updateOnlineStatus = useCallback(
    async (nextCallOnline: boolean, nextChatOnline: boolean) => {
      try {
        setIsStatusSyncing(true);
        await astroApi.setOnline({
          astroId,
          callOnline: nextCallOnline,
          chatOnline: nextChatOnline,
        });
      } catch (error) {
        Alert.alert("Error", "Unable to update online status.");
        throw error;
      } finally {
        setIsStatusSyncing(false);
      }
    },
    [astroId]
  );

  const onVoiceToggle = (nextValue: boolean) => {
    const previousVoice = voiceEnabled;
    const previousChat = chatEnabled;

    setVoiceEnabled(nextValue);
    updateOnlineStatus(nextValue, chatEnabled).catch(() => {
      setVoiceEnabled(previousVoice);
      setChatEnabled(previousChat);
    });
  };

  const onChatToggle = (nextValue: boolean) => {
    const previousVoice = voiceEnabled;
    const previousChat = chatEnabled;

    setChatEnabled(nextValue);
    updateOnlineStatus(voiceEnabled, nextValue).catch(() => {
      setVoiceEnabled(previousVoice);
      setChatEnabled(previousChat);
    });
  };

  const onActionPress = (key: string) => {
    if (key === "call") {
      navigation.navigate("Order", {
        screen: "OrderList",
        params: { initialTab: "Voice Call" },
      });
      return;
    }

    if (key === "chat") {
      navigation.navigate("Order", {
        screen: "OrderList",
        params: { initialTab: "Chat" },
      });
      return;
    }

    if (key === "waitlist") {
      navigation.navigate("Order", {
        screen: "OrderList",
        params: { initialTab: "Waitlist" },
      });
      return;
    }

    if (key === "reviews") {
      navigation.navigate("Profile", { screen: "Review" });
      return;
    }

    if (key === "profile") {
      navigation.navigate("Profile", { screen: "ProfileHome" });
      return;
    }

    if (key === "setting") {
      navigation.navigate("Profile", { screen: "Setting" });
      return;
    }

    if (key === "wallet") {
      navigation.navigate("Wallet");
      return;
    }

    if (key === "support") {
      navigation.navigate("Support");
      return;
    }
  };

  const openSupport = () => {
    navigation.navigate("Support");
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom", "left", "right"]}>
      <View style={{
        backgroundColor:'#ffffff',
        height:44,
      }}></View>
      <View style={[styles.headerWrap]}>
        <View style={styles.header}>
        <View>
          <Text style={styles.nameText}>{astroName}</Text>
          <Text style={styles.idText}>{`+91 ${astroMobile}`}</Text>
        </View>
        <View style={styles.headerDots}>
          <TouchableOpacity onPress={openSupport}>
            <Image
              source={images.streamlineCustomerSupport}
              style={styles.headerIconImage}
              resizeMode="contain"
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={openLanguageModal}>
            <Image
              source={images.uilLanguage}
              style={styles.headerIconImage}
              resizeMode="contain"
            />
          </TouchableOpacity>
          <TouchableOpacity>
            <Image
              source={images.cuidaNotificationBellOutline}
              style={styles.headerIconImage}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </View>
        </View>
      </View>

      <ScrollView
        bounces={false}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.statusCard}>
          <View>
            <Text style={styles.cardTitle}>{t("home.voiceCall")}</Text>
            <Text style={styles.rateText}>{t("home.ratePerMin")}</Text>
          </View>
          <View style={styles.switchBlock}>
            <Switch
              value={voiceEnabled}
              onValueChange={onVoiceToggle}
              trackColor={{ false: "#D69790", true: "#63B821" }}
              disabled={isStatusSyncing}
            />
            <Text style={styles.modeText}>
              {voiceEnabled ? t("common.online") : t("common.offline")}
            </Text>
          </View>
        </View>

        <View style={styles.statusCard}>
          <View>
            <Text style={styles.cardTitle}>{t("common.chat")}</Text>
            <Text style={styles.rateText}>{t("home.ratePerMin")}</Text>
          </View>
          <View style={styles.switchBlock}>
            <Switch
              value={chatEnabled}
              onValueChange={onChatToggle}
              trackColor={{ false: "#D69790", true: "#63B821" }}
              disabled={isStatusSyncing}
            />
            <Text style={styles.modeText}>
              {chatEnabled ? t("common.online") : t("common.offline")}
            </Text>
          </View>
        </View>

        <View style={styles.earningCard}>
          <View style={styles.earningRow}>
            <View>
              <Text style={styles.earningTitle}>{earningTitleText}</Text>
            </View>
            <Pressable style={styles.arrowButton}>
              
              <Image
                source={images.chevronRight}
                style={styles.arrowImage}
                resizeMode="contain"
              />
            </Pressable>
          </View>
          <View style={styles.earningFooter}>
            <Text style={styles.earningFooterText}>
              {t("home.invoiceHint")}
            </Text>
          </View>
        </View>

        <View style={styles.grid}>
          {actions.map((item) => (
            <Pressable
              key={item.key}
              style={styles.gridItem}
              onPress={() => onActionPress(item.key)}
            >
              <View style={styles.gridIconWrap}>
                <View style={styles.gridIconInner}>
                  {item.image ? (
                    <Image
                      source={item.image}
                      style={styles.gridIconImage}
                      resizeMode="contain"
                    />
                  ) : (
                    <Text style={styles.gridIconText}>{item.icon}</Text>
                  )}
                </View>
              </View>
              <Text style={styles.gridLabel}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <Modal
        visible={isLanguageModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLanguageModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setLanguageModalVisible(false)}
          />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t("languageModal.title")}</Text>

            <View style={styles.languageOptionsRow}>
              <Pressable
                style={[
                  styles.languageOption,
                  selectedLanguage === "en" && styles.languageOptionActive,
                ]}
                onPress={() => setSelectedLanguage("en")}
              >
                <Text style={styles.languageOptionText}>
                  {t("languageModal.english")}
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.languageOption,
                  selectedLanguage === "hi" && styles.languageOptionActive,
                ]}
                onPress={() => setSelectedLanguage("hi")}
              >
                <Text style={styles.languageOptionText}>
                  {t("languageModal.hindi")}
                </Text>
              </Pressable>
            </View>

            <Text style={styles.languageNote}>{t("languageModal.note")}</Text>
            <AppButton
              title={t("common.apply")}
              onPress={onApplyLanguage}
              containerStyle={styles.applyButton}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

export const HomeScreen = memo(HomeScreenComponent);

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerWrap: {
    backgroundColor: "#5A1919",
  },
  header: {
    height: 56,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  nameText: {
    color: "#FFFFFF",
    fontSize: normalizeFont(28 / 2),
    fontWeight: "700",
  },
  idText: {
    color: "#F3D6D6",
    fontSize: normalizeFont(12),
  },
  headerDots: {
    flexDirection: "row",
    gap: 7,
  },
  scrollContent: {
    paddingHorizontal: wp(4),
    paddingTop: hp(2),
    paddingBottom: 120,
  },
  statusCard: {
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#ECE8E8",
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  cardTitle: {
    color: "#2F1E1E",
    fontSize: normalizeFont(16),
    fontWeight: "600",
  },
  rateText: {
    marginTop: 2,
    color: "#2F1E1E",
    fontSize: normalizeFont(12),
  },
  switchBlock: {
    alignItems: "center",
    gap: 6,
  },
  modeText: {
    color: "#2F1E1E",
    fontSize: normalizeFont(15 / 1.1),
  },
  earningCard: {
    marginTop: 6,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#8C4141",
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
    marginBottom: 16,
  },
  earningRow: {
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  earningTitle: {
    color: "#2E1A1A",
    fontSize: normalizeFont(17),
    fontWeight: "700",
  },
  invoiceText: {
    marginTop: 3,
    color: "#D48686",
    fontSize: normalizeFont(13),
  },
  arrowButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#712424",
    alignItems: "center",
    justifyContent: "center",
  },
  arrowText: {
    color: "#FFFFFF",
    fontSize: normalizeFont(20),
    fontWeight: "700",
    marginTop: -1,
  },
  earningFooter: {
    minHeight: 34,
    backgroundColor: "#5E1717",
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  earningFooterText: {
    color: "#FFFFFF",
    fontSize: normalizeFont(13),
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 18,
  },
  gridItem: {
    width: "31%",
    alignItems: "center",
  },
  gridIconWrap: {
    width: 94,
    height: 94,
    borderRadius: 47,
    borderWidth: 1,
    borderColor: "#D9D6D6",
    backgroundColor: "#FDFDFD",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.07,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  gridIconInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 2,
    borderColor: "#6D3F3F",
    alignItems: "center",
    justifyContent: "center",
  },
  gridIconText: {
    color: "#6D3F3F",
    fontSize: normalizeFont(22),
    fontWeight: "700",
  },
  gridIconImage: {
    width: 26,
    height: 26,
    tintColor: "#6D3F3F",
  },
  headerIconImage: {
    width: 26,
    height: 26,
    tintColor: "#ffffff",
  },
  gridLabel: {
    marginTop: 8,
    textAlign: "center",
    color: "#2E1C1C",
    fontSize: normalizeFont(16 / 1.1),
    fontWeight: "500",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.25)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 18,
  },
  modalCard: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 26,
    backgroundColor: "#FFF7F4",
    paddingHorizontal: 22,
    paddingVertical: 26,
  },
  modalTitle: {
    textAlign: "center",
    color: "#CF897E",
    fontSize: normalizeFont(32 / 1.8),
    fontWeight: "700",
    marginBottom: 20,
  },
  languageOptionsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 20,
  },
  languageOption: {
    width: 88,
    minHeight: 88,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#5A1B1B",
    backgroundColor: "#6A2727",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
  },
  languageOptionActive: {
    backgroundColor: "#4C1818",
  },
  languageOptionText: {
    textAlign: "center",
    color: "#FFFFFF",
    fontSize: normalizeFont(16 / 1.15),
    fontWeight: "700",
    lineHeight: 28,
  },
  languageNote: {
    marginTop: 18,
    textAlign: "center",
    color: "#5D4545",
    fontSize: normalizeFont(14 / 1.1),
  },
  applyButton: {
    marginTop: 22,
    borderRadius: 30,
    height: 50,
  },
  arrowImage: {
    width: 16,
    height: 16,
    tintColor: colors.surface,
  },
});
