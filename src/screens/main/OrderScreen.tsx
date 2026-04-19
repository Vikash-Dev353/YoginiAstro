import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { images } from "../../assets/images";
import { AppGifLoader } from "../../components/common/AppGifLoader";
import { AppHeader } from "../../components/common/AppHeader";
import { colors } from "../../constants/colors";
import { useTranslation } from "../../localization/useTranslation";
import { OrderStackParamList } from "../../navigation/types";
import {
  astroApi,
  type CallHistoryItem,
  type ConsultationItem,
  type GenerateKundaliPayload,
} from "../../services/api/astroApi";
import { decodeAstroIdFromToken } from "../../store/slices/authSlice";
import { useAppSelector } from "../../store/hooks";
import { normalizeFont, wp } from "../../utils/responsive";

type OrderTab = "Waitlist" | "Voice Call" | "Chat" | "Pooja Booking";

type WaitlistItem = {
  id: string;
  name: string;
  message: string;
  timeLabel: string;
  kundliUrl?: string;
  generateKundaliPayload?: GenerateKundaliPayload;
  profileImage?: string | null;
};

type VoiceCallItem = {
  id: string;
  orderId: string;
  name: string;
  timeLabel: string;
  rate: string;
  duration: string;
  amount: string;
};

type ChatItem = {
  id: string;
  orderId: string;
  name: string;
  timeLabel: string;
  rate: string;
  duration: string;
  amount: string;
};

type PoojaBookingItem = {
  id: string;
  orderId: string;
  serviceName: string;
  customerName: string;
  customerPhone: string;
  paymentMode: string;
  timeLabel: string;
  total: string;
  status: string;
};

type OrderListItem = WaitlistItem | VoiceCallItem | ChatItem | PoojaBookingItem;

/** Static dummy waitlist for testing navigation & Kundli when API has no data */
const DUMMY_WAITLIST: WaitlistItem[] = [
  {
    id: "dummy-1",
    name: "Sachin Singh",
    message: "Wants to chat with you.",
    timeLabel: "Now",
    generateKundaliPayload: {
      full_name: "sachin singh",
      day: 3,
      month: 3,
      year: 2026,
      hour: 1,
      min: 0,
      gender: "male",
      birthPlace: "Abhayapuri",
      selectedPlace: {
        display_name: "Abhayapuri",
        lat: 26.32255,
        lon: 90.68526,
      },
      chart_type: "north",
      tzone: "5.5",
      lang: "en",
    },
  },
  {
    id: "dummy-2",
    name: "Priya Sharma",
    message: "कुंडली देखकर बात करना चाहती हूं।",
    timeLabel: "5 min ago",
  },
  {
    id: "dummy-3",
    name: "Rahul Verma",
    message: "Wants to chat with you.",
    timeLabel: "12 min ago",
  },
];

// const POOJA_DATA: PoojaBookingItem[] = [
//   {
//     id: "p1",
//     orderId: "CHTI302",
//     serviceName: "Online Grah Pravesh Pooja",
//     customerName: "Raman Kumar",
//     customerPhone: "9354246782",
//     paymentMode: "UPI/Cash",
//     timeLabel: "11 Jan 2026 | 01:41 PM",
//     total: "₹ 2,100",
//     status: "Paid",
//   },
//   {
//     id: "p2",
//     orderId: "CHTI509",
//     serviceName: "Mangal Dosh Pooja",
//     customerName: "Riya Verma",
//     customerPhone: "9811122233",
//     paymentMode: "UPI",
//     timeLabel: "17 Jan 2026 | 07:20 PM",
//     total: "₹ 3,500",
//     status: "Paid",
//   },
// ];

const POOJA_DATA: PoojaBookingItem[] = []

type Props = NativeStackScreenProps<OrderStackParamList, "OrderList">;



const formatCallStartedAt = (startedAt: string): string => {
  const date = new Date(startedAt);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

const formatChatDate = (createdAt?: string): string => {
  if (!createdAt) return "—";
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "—";
  return date
    .toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    })
    .replace(",", " |");
};

const getRequestedTimeLabel = (requestedAt?: string) => {
  if (!requestedAt) {
    return "Now";
  }

  const requestedTime = new Date(requestedAt).getTime();
  if (Number.isNaN(requestedTime)) {
    return "Now";
  }

  const minutes = Math.floor((Date.now() - requestedTime) / 60000);
  if (minutes <= 0) {
    return "Now";
  }
  if (minutes < 60) {
    return `${minutes} min ago`;
  }
  return new Date(requestedAt).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export function OrderScreen({ route, navigation }: Props) {
  const { t, appLanguage } = useTranslation();
  const token = useAppSelector((state) => state.auth.token);
  const astroIdFromStore = useAppSelector((state) => state.auth.astroId);
  const tabs: OrderTab[] = ["Waitlist", "Voice Call", "Chat", "Pooja Booking"];

  const astroId: string =
    astroIdFromStore?.trim().toUpperCase() ||
    decodeAstroIdFromToken(token)?.trim().toUpperCase() ||
    '';

  const tabLabel: Record<OrderTab, string> = {
    Waitlist: t("order.waitlist"),
    "Voice Call": t("order.voiceCall"),
    Chat: t("order.chat"),
    "Pooja Booking": t("order.poojaBooking"),
  };

  const [activeTab, setActiveTab] = useState<OrderTab>(
    route.params?.initialTab ?? "Waitlist"
  );
  const [waitlistData, setWaitlistData] = useState<WaitlistItem[]>([]);
  const [isWaitlistLoading, setIsWaitlistLoading] = useState(false);
  const [waitlistError, setWaitlistError] = useState<string | null>(null);

  const [consultations, setConsultations] = useState<ConsultationItem[]>([]);
  const [isConsultationsLoading, setIsConsultationsLoading] = useState(false);
  const [consultationsError, setConsultationsError] = useState<string | null>(
    null
  );

  const [callHistory, setCallHistory] = useState<CallHistoryItem[]>([]);
  const [isCallHistoryLoading, setIsCallHistoryLoading] = useState(false);
  const [callHistoryError, setCallHistoryError] = useState<string | null>(null);
  const [orderFocusKey, setOrderFocusKey] = useState(0);

  useEffect(() => {
    if (route.params?.initialTab) {
      setActiveTab(route.params.initialTab);
    }
  }, [route.params?.initialTab]);

  useFocusEffect(
    useCallback(() => {
      setOrderFocusKey((k) => k + 1);
    }, [])
  );

  useEffect(() => {
    if (activeTab !== "Waitlist" || !token || !astroId) {
      return;
    }

    let isMounted = true;
    const wantsToChatFallback =
      appLanguage === "hi"
        ? "आपसे चैट करना चाहता है।"
        : "Wants to chat with you.";

    const loadWaitlist = async () => {
      try {
        setIsWaitlistLoading(true);
        setWaitlistError(null);
        const response = await astroApi.getWaitlist(astroId);
        if (!isMounted) {
          return;
        }

        const items = (response.waitingList || []).map((entry, index) => ({
          id: entry.roomId || `${entry.from}-${index}`,
          name: entry.senderName || entry.from || "Unknown",
          message: entry.message || wantsToChatFallback,
          timeLabel: getRequestedTimeLabel(entry.requestedAt),
          kundliUrl: entry.kundliUrl,
          generateKundaliPayload: entry.generateKundaliPayload,
          profileImage: entry.senderImage,
        }));

        // setWaitlistData(items.length > 0 ? items : DUMMY_WAITLIST);
        setWaitlistData(items);
      } catch (error) {
        if (!isMounted) {
          return;
        }
        setWaitlistError(
          (error as { message?: string })?.message ||
            (appLanguage === "hi"
              ? "वेटलिस्ट लोड नहीं हो पाई। (डमी डेटा दिख रहा है)"
              : "Unable to load waitlist. (Showing dummy data)")
        );
        setWaitlistData(DUMMY_WAITLIST);
      } finally {
        if (isMounted) {
          setIsWaitlistLoading(false);
        }
      }
    };

    loadWaitlist();

    return () => {
      isMounted = false;
    };
  }, [activeTab, appLanguage, astroId, token, orderFocusKey]);

  useEffect(() => {
    if (activeTab !== "Chat" || !token || !astroId) {
      return;
    }

    let isMounted = true;

    const loadConsultations = async () => {
      try {
        setIsConsultationsLoading(true);
        setConsultationsError(null);
        const response = await astroApi.getRecentConsultations(astroId, 20);
        if (!isMounted) return;
        setConsultations(response.consultations ?? []);
      } catch (err) {
        if (!isMounted) return;
        setConsultationsError(
          (err as { message?: string })?.message ??
            (appLanguage === "hi"
              ? "चैट इतिहास लोड नहीं हो पाया।"
              : "Unable to load chat history.")
        );
        setConsultations([]);
      } finally {
        if (isMounted) setIsConsultationsLoading(false);
      }
    };

    loadConsultations();
    return () => {
      isMounted = false;
    };
  }, [activeTab, appLanguage, astroId, token, orderFocusKey]);

  useEffect(() => {
    if (activeTab !== "Voice Call" || !token || !astroId) {
      return;
    }

    let isMounted = true;

    const loadCallHistory = async () => {
      try {
        setIsCallHistoryLoading(true);
        setCallHistoryError(null);
        const response = await astroApi.getRecentAstroCalls(astroId, 20);
        if (!isMounted) return;
        setCallHistory(response.consultations ?? []);
      } catch (err) {
        if (!isMounted) return;
        setCallHistoryError(
          (err as { message?: string })?.message ??
            (appLanguage === "hi"
              ? "कॉल इतिहास लोड नहीं हो पाया।"
              : "Unable to load call history.")
        );
        setCallHistory([]);
      } finally {
        if (isMounted) setIsCallHistoryLoading(false);
      }
    };

    loadCallHistory();
    return () => {
      isMounted = false;
    };
  }, [activeTab, appLanguage, astroId, token, orderFocusKey]);

  const callDataForList = useMemo<VoiceCallItem[]>(() => {
    if (callHistory.length === 0) return [];
    return callHistory.map(
      (c): VoiceCallItem => ({
        id: c.orderId,
        orderId: c.orderId,
        name: c.userName ?? "—",
        timeLabel: formatCallStartedAt(c.startedAt),
        rate: `₹ ${c.callPrice}/min`,
        duration: `${c.durationMinutes} min`,
        amount: `₹${c.amount.toLocaleString("en-IN")}`,
      })
    );
  }, [callHistory]);

  const chatDataForList = useMemo<ChatItem[]>(() => {
    if (consultations.length === 0) {
      return [];
    }
    return consultations.map(
      (c): ChatItem => ({
        id: c.orderId,
        orderId: c.orderId,
        name: c.userName ?? "—",
        timeLabel: formatChatDate(c.createdAt),
        rate: c.rate != null ? String(c.rate) : "—",
        duration: c.duration != null ? String(c.duration) : "—",
        amount:
          typeof c.amount === "number"
            ? `₹${c.amount.toLocaleString("en-IN")}`
            : String(c.amount ?? "—"),
      })
    );
  }, [consultations]);

  const data = useMemo<OrderListItem[]>(() => {
    switch (activeTab) {
      case "Voice Call":
        return callDataForList;
      case "Chat":
        return chatDataForList;
      case "Pooja Booking":
        return POOJA_DATA;
      case "Waitlist":
      default:
        return waitlistData;
    }
  }, [activeTab, waitlistData, chatDataForList, callDataForList]);

  const renderMetricRow = (rate: string, duration: string, amount: string) => (
    <View style={styles.metricRow}>
      <View style={[styles.metricChip, styles.rateChip]}>
        <Text style={styles.metricText}>{`${t("order.rate")} : ${rate}`}</Text>
      </View>
      <View style={[styles.metricChip, styles.durationChip]}>
        <Text style={styles.metricText}>{`${t(
          "order.duration"
        )} : ${duration}`}</Text>
      </View>
      <View style={[styles.metricChip, styles.amountChip]}>
        <Text style={styles.metricText}>{`${t(
          "order.amount"
        )} : ${amount}`}</Text>
      </View>
    </View>
  );

  const renderItem = ({ item }: { item: OrderListItem }) => {
    if (activeTab === "Waitlist") {
      const waitlistItem = item as WaitlistItem;
      return (
        <View style={styles.card}>
          <View style={styles.waitlistTopRow}>
            <Pressable
              style={styles.kundliButton}
              onPress={() =>
                navigation.navigate("ViewKundli", {
                  name: waitlistItem.name,
                  id: waitlistItem.id,
                  kundaliPayload: waitlistItem.generateKundaliPayload,
                })
              }
            >
              <Text style={styles.kundliIcon}>👁</Text>
              <Text style={styles.kundliText}>{t("order.viewKundali")}</Text>
            </Pressable>
            <View style={styles.timeRow}>
              <Image
                source={images.timerOutline}
                style={styles.timeIcon}
                resizeMode="contain"
              />
              <Text style={styles.timeText}>
                {waitlistItem.timeLabel === "Now"
                  ? t("order.now")
                  : waitlistItem.timeLabel}
              </Text>
            </View>
          </View>
          <Text style={styles.primaryName}>{waitlistItem.name}</Text>
          <Text style={styles.secondaryText}>{waitlistItem.message}</Text>
          <View style={styles.waitlistActions}>
            <Pressable
              style={[styles.actionButton, styles.acceptButton]}
              onPress={() =>
                navigation.navigate("ConsultationChat", {
                  customerName: waitlistItem.name,
                  roomId: waitlistItem.id,
                  kundaliPayload: waitlistItem.generateKundaliPayload,
                  customerImage: waitlistItem.profileImage,
                })
              }
            >
              <Text style={styles.actionButtonText}>{t("common.accept")}</Text>
            </Pressable>
            <Pressable style={[styles.actionButton, styles.rejectButton]} onPress={()=>{
              navigation.goBack();
            }}>
              <Text style={styles.actionButtonText}>{t("common.reject")}</Text>
            </Pressable>
          </View>
        </View>
      );
    }

    if (activeTab === "Voice Call") {
      const voiceItem = item as VoiceCallItem;
      return (
        <View style={styles.card}>
          <Text style={styles.orderIdText}>{`${t("order.orderId")}: ${
            voiceItem.orderId
          }`}</Text>
          <Text style={styles.primaryName}>{voiceItem.name}</Text>
          <View style={styles.timeRow}>
            <Image
              source={images.timerOutline}
              style={styles.timeIcon}
              resizeMode="contain"
            />
            <Text style={styles.timeText}>{voiceItem.timeLabel}</Text>
          </View>
          {renderMetricRow(
            voiceItem.rate,
            voiceItem.duration,
            voiceItem.amount
          )}
        </View>
      );
    }

    if (activeTab === "Chat") {
      const chatItem = item as ChatItem;
      return (
        <View style={styles.card}>
          <View style={styles.chatHeaderRow}>
            <Text style={styles.chatOrderIdLabel}>{`${t("order.orderId")}: ${
              chatItem.orderId
            }`}</Text>
            <Pressable style={styles.refundButton} onPress={() => {}}>
              <Text style={styles.refundButtonText}>{t("order.refund")}</Text>
            </Pressable>
          </View>
          <Text style={styles.chatUserName}>{chatItem.name}</Text>
          <View style={styles.timeRow}>
            <Image
              source={images.timerOutline}
              style={styles.timeIcon}
              resizeMode="contain"
            />
            <Text style={styles.chatTimeText}>{chatItem.timeLabel}</Text>
          </View>
          {renderMetricRow(chatItem.rate, chatItem.duration, chatItem.amount)}
        </View>
      );
    }

    const poojaItem = item as PoojaBookingItem;
    return (
      <View style={styles.card}>
        <View style={styles.poojaTopRow}>
          <Text style={styles.orderIdText}>{`${t("order.orderId")}: ${
            poojaItem.orderId
          }`}</Text>
          <View style={styles.timeRow}>
            <Image
              source={images.timerOutline}
              style={styles.timeIcon}
              resizeMode="contain"
            />
            <Text style={styles.timeText}>{poojaItem.timeLabel}</Text>
          </View>
        </View>
        <Text style={styles.poojaTitle}>{poojaItem.serviceName}</Text>
        <Text style={styles.poojaInfo}>◌ {poojaItem.customerName}</Text>
        <Text style={styles.poojaInfo}>◌ {poojaItem.customerPhone}</Text>
        <Text style={styles.poojaInfo}>{`${t("order.paymentMode")} : ${
          poojaItem.paymentMode
        }`}</Text>
        <View style={styles.separator} />
        <View style={styles.poojaBottomRow}>
          <Text style={styles.totalText}>{`${t("order.total")} : ${
            poojaItem.total
          }`}</Text>
          <View style={styles.statusChip}>
            <Text style={styles.statusText}>{t("common.paid")}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["bottom", "left", "right"]}>
      <AppHeader title={t("common.order")} />
      <View style={styles.tabsRow}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab;
          return (
            <Pressable
              key={tab}
              style={styles.tabButton}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                {tabLabel[tab]}
              </Text>
              {isActive ? <View style={styles.tabUnderline} /> : null}
            </Pressable>
          );
        })}
      </View>

      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListEmptyComponent={
          activeTab === "Waitlist" ? (
            <View style={styles.emptyState}>
              {isWaitlistLoading ? (
                <AppGifLoader
                  message={
                    appLanguage === "hi"
                      ? "वेटलिस्ट लोड हो रही है..."
                      : "Loading waitlist..."
                  }
                  size={100}
                />
              ) : (
                <Text style={styles.emptyStateText}>
                  {waitlistError ||
                    (appLanguage === "hi"
                      ? "अभी कोई वेटलिस्ट रिक्वेस्ट नहीं है।"
                      : "No waitlist requests found.")}
                </Text>
              )}
            </View>
          ) : activeTab === "Chat" ? (
            <View style={styles.emptyState}>
              {isConsultationsLoading ? (
                <AppGifLoader
                  message={
                    appLanguage === "hi"
                      ? "चैट इतिहास लोड हो रहा है..."
                      : "Loading chat history..."
                  }
                  size={100}
                />
              ) : (
                <Text style={styles.emptyStateText}>
                  {consultationsError ||
                    (appLanguage === "hi"
                      ? "अभी कोई रिसेंट कंसल्टेशन नहीं है।"
                      : "No recent consultations.")}
                </Text>
              )}
            </View>
          ) : activeTab === "Voice Call" ? (
            <View style={styles.emptyState}>
              {isCallHistoryLoading ? (
                <AppGifLoader
                  message={
                    appLanguage === "hi"
                      ? "कॉल इतिहास लोड हो रहा है..."
                      : "Loading call history..."
                  }
                  size={100}
                />
              ) : (
                <Text style={styles.emptyStateText}>
                  {callHistoryError ||
                    (appLanguage === "hi"
                      ? "अभी कोई कॉल इतिहास नहीं है।"
                      : "No call history found.")}
                </Text>
              )}
            </View>
          ) : null
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

export const MemoizedOrderScreen = memo(OrderScreen);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  tabsRow: {
    paddingHorizontal: wp(4.5),
    paddingTop: 12,
    paddingBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#E9E2E2",
  },
  tabButton: {
    alignItems: "center",
    justifyContent: "center",
  },
  tabText: {
    fontSize: normalizeFont(17 / 1.1),
    color: "#3A2424",
    fontWeight: "500",
  },
  tabTextActive: {
    fontWeight: "700",
  },
  tabUnderline: {
    marginTop: 4,
    height: 2,
    width: "100%",
    backgroundColor: "#4E2A2A",
  },
  listContent: {
    paddingHorizontal: wp(4.5),
    paddingTop: 12,
    paddingBottom: 120,
    gap: 12,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#9D5C5C",
    padding: 14,
    shadowColor: "#000000",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  waitlistTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  kundliButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  kundliIcon: {
    fontSize: normalizeFont(16),
  },
  kundliText: {
    color: "#D48477",
    fontSize: normalizeFont(14 / 1.2),
    fontWeight: "500",
  },
  orderIdText: {
    color: "#D48477",
    fontSize: normalizeFont(14 / 1.2),
    fontWeight: "500",
  },
  primaryName: {
    color: "#2F1C1C",
    fontSize: normalizeFont(20 / 1.1),
    fontWeight: "700",
    marginBottom: 4,
  },
  secondaryText: {
    color: "#3D2A2A",
    fontSize: normalizeFont(14 / 1.1),
    marginBottom: 12,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  timeIcon: {
    width: 16,
    height: 16,
    marginRight: 6,
  },
  timeText: {
    color: "#6C6C6C",
    fontSize: normalizeFont(14 / 1.15),
  },
  waitlistActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  actionButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  acceptButton: {
    backgroundColor: "#5B1B1B",
  },
  rejectButton: {
    backgroundColor: "#B90303",
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: normalizeFont(16 / 1.05),
  },
  metricRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 14,
  },
  metricChip: {
    flex: 1,
    minHeight: 40,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  rateChip: {
    backgroundColor: "#F9F1DF",
    borderColor: "#DFC188",
  },
  durationChip: {
    backgroundColor: "#F5E9E7",
    borderColor: "#C99E98",
  },
  amountChip: {
    backgroundColor: "#ECE8E8",
    borderColor: "#C4BDBD",
  },
  metricText: {
    color: "#2F1D1D",
    fontSize: normalizeFont(16 / 1.2),
    fontWeight: "500",
  },
  chatHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  chatOrderIdLabel: {
    color: "#8B6B6B",
    fontSize: normalizeFont(13),
    fontWeight: "500",
  },
  refundButton: {
    backgroundColor: "#B90303",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  refundButtonText: {
    color: "#FFFFFF",
    fontSize: normalizeFont(14),
    fontWeight: "600",
  },
  chatUserName: {
    color: "#2F1C1C",
    fontSize: normalizeFont(18),
    fontWeight: "700",
    marginBottom: 4,
  },
  chatTimeText: {
    color: colors.textSecondary,
    fontSize: normalizeFont(14),
    marginBottom: 4,
  },
  poojaTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  poojaTitle: {
    color: "#2F1C1C",
    fontSize: normalizeFont(20 / 1.1),
    fontWeight: "700",
    marginBottom: 8,
  },
  poojaInfo: {
    color: "#3C2A2A",
    fontSize: normalizeFont(15 / 1.15),
    marginBottom: 4,
  },
  separator: {
    marginTop: 8,
    marginBottom: 10,
    height: 1,
    backgroundColor: "#BFB4B4",
  },
  poojaBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalText: {
    color: "#2E1A1A",
    fontSize: normalizeFont(20 / 1.1),
    fontWeight: "700",
  },
  statusChip: {
    minWidth: 106,
    minHeight: 40,
    borderRadius: 8,
    backgroundColor: "#0F7F1B",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  statusText: {
    color: "#FFFFFF",
    fontSize: normalizeFont(16 / 1.1),
    fontWeight: "700",
  },
  emptyState: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#DFCFCF",
    borderRadius: 12,
    paddingVertical: 18,
    paddingHorizontal: 16,
    backgroundColor: "#FFFFFF",
  },
  emptyStateText: {
    color: "#6E5C5C",
    fontSize: normalizeFont(14),
    textAlign: "center",
  },
});
