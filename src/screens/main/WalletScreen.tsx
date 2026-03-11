import {
  BottomTabScreenProps,
  useBottomTabBarHeight,
} from "@react-navigation/bottom-tabs";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useMemo, useState } from "react";
import {
  Dimensions,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useAppSelector } from "../../store/hooks";
import { AppGifLoader } from "../../components/common/AppGifLoader";
import { AppHeader } from "../../components/common/AppHeader";
import { colors } from "../../constants/colors";
import { useTranslation } from "../../localization/useTranslation";
import { RootTabParamList } from "../../navigation/types";
import { astroApi } from "../../services/api/astroApi";
import type { GetMonthlyEarningsResponse } from "../../services/api/astroApi";
import { normalizeFont, wp } from "../../utils/responsive";

const LineChartModule = require("react-native-gifted-charts/dist/LineChart");
const LineChart = LineChartModule?.LineChart;
function formatCurrency(value: number): string {
  return "₹" + value.toLocaleString("en-IN");
}

type Props = BottomTabScreenProps<RootTabParamList, "Wallet">;

export function WalletScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const tabBarHeight = useBottomTabBarHeight();
  const token = useAppSelector((state) => state.auth.token);
  const astroIdFromStore = useAppSelector((state) => state.auth.astroId);

  const astroId = astroIdFromStore?.trim().toUpperCase();

  const [walletData, setWalletData] =
    useState<GetMonthlyEarningsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWallet = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await astroApi.getMonthlyEarnings({ astroId });
      setWalletData(data);
    } catch (err) {
      setError(
        (err as { message?: string })?.message ?? "Failed to load wallet data"
      );
    } finally {
      setLoading(false);
    }
  }, [astroId, token]);

  useFocusEffect(
    useCallback(() => {
      fetchWallet();
    }, [fetchWallet])
  );

  const chartWidth = Dimensions.get("window").width - wp(9) - 40;
  const chartHeight = 200;

  const chartData = useMemo(() => {
    const raw = walletData?.weeklyEarnings?.chartData ?? [];
    return Array.isArray(raw)
      ? raw.map((d) => ({
          value: Number(d?.value) || 0,
          label: String(d?.label ?? ""),
        }))
      : [];
  }, [walletData?.weeklyEarnings?.chartData]);

  const chartMaxValue = useMemo(() => {
    if (chartData.length === 0) return 100;
    const max = Math.max(...chartData.map((d) => d.value));
    return max > 0 ? Math.ceil(max * 1.2) : 100;
  }, [chartData]);

  const last6Months = useMemo(() => {
    const list = walletData?.monthlyEarnings ?? [];

    console.log("list==>>>>", list);
    if (!Array.isArray(list)) return [];
    return list.length <= 6 ? list : list.slice(-6);
  }, [walletData?.monthlyEarnings]);

  const hasToken = Boolean(token);
  const showEmptyState = !loading && !walletData && !error && !hasToken;

  if (loading && !walletData) {
    return (
      <SafeAreaView style={styles.container}>
        <AppHeader
          title={t("common.wallet")}
          showBack
          onBackPress={() => navigation.navigate("Home")}
        />
        <View style={styles.loadingContainer}>
          <AppGifLoader message="Loading wallet..." size={140} />
        </View>
      </SafeAreaView>
    );
  }

  if (showEmptyState) {
    return (
      <SafeAreaView style={styles.container}>
        <AppHeader
          title={t("common.wallet")}
          showBack
          onBackPress={() => navigation.navigate("Home")}
        />
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>Please log in to view wallet</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && !walletData) {
    return (
      <SafeAreaView style={styles.container}>
        <AppHeader
          title={t("common.wallet")}
          showBack
          onBackPress={() => navigation.navigate("Home")}
        />
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.retryText} onPress={fetchWallet}>
            Tap to retry
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const balanceAmount = formatCurrency(
    walletData?.balance?.totalAvailable ?? 0
  );
  const payableAmount = walletData?.payableAmount?.amount ?? "₹0";

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader
        title={t("common.wallet")}
        showBack
        onBackPress={() => navigation.navigate("Home")}
      />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: tabBarHeight + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.balanceCard}>
          <View style={styles.balanceLeft}>
            <Text style={styles.balanceTitle}>Total Available Balance</Text>
            <Text style={styles.balanceAmount}>{balanceAmount}</Text>
            <Text style={styles.balanceSubtitle}>Available Balance</Text>
          </View>
        </View>

        <View
          style={{
            paddingLeft: 4,
            paddingVertical: 12,
            borderRadius: 16,
            backgroundColor: "#F7F7F7",
            elevation: 4,
            marginVertical: 12,
            overflow: "hidden",
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: "600", marginBottom: 10 }}>
            Weekly Earnings
          </Text>

          {LineChart ? (
            <LineChart
              data={chartData}
              width={chartWidth}
              height={chartHeight}
              curved
              areaChart
              hideDataPoints={false}
              color="#2E7D32"
              startFillColor="#2E7D32"
              endFillColor="#2E7D32"
              startOpacity={0.4}
              endOpacity={0.05}
              thickness={3}
              dataPointsColor="#A5D6A7"
              yAxisColor="transparent"
              xAxisColor="#ccc"
              yAxisTextStyle={{ color: "#888" }}
              xAxisLabelTextStyle={{ color: "#666" }}
              rulesColor="#e0e0e0"
              yAxisThickness={0}
              noOfSections={4}
              maxValue={chartMaxValue}
            />
          ) : (
            <View style={{ height: chartHeight, justifyContent: "center" }}>
              <Text style={{ color: "#666", textAlign: "center" }}>
                Chart unavailable
              </Text>
            </View>
          )}
        </View>

        <Text style={styles.sectionTitle}>Last 6 Months Earning</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.monthRow}>
            {last6Months.map((item) => (
              <View key={item.id} style={styles.monthCard}>
                <Text style={styles.monthIcon}>▦</Text>
                <View>
                  <Text style={styles.monthLabel}>{item.label}</Text>
                  <Text style={styles.monthAmount}>{item.amount}</Text>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>

        <View style={styles.payableCard}>
          <Text style={styles.payableText}>Payable Amount</Text>
          <Text style={styles.payableAmount}>{payableAmount}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: wp(4.5),
    paddingTop: 18,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  errorText: {
    color: colors.error,
    fontSize: normalizeFont(16),
    textAlign: "center",
    paddingHorizontal: 24,
  },
  retryText: {
    color: colors.primary,
    fontSize: normalizeFont(16),
    fontWeight: "600",
    marginTop: 8,
  },
  balanceCard: {
    minHeight: 185,
    borderRadius: 14,
    backgroundColor: "#7E2D2D",
    borderWidth: 1,
    borderColor: "#A25A5A",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 18,
    shadowColor: "#000000",
    shadowOpacity: 0.08,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  balanceLeft: {
    flex: 1,
    justifyContent: "center",
  },
  balanceTitle: {
    color: "#FFFFFF",
    fontSize: normalizeFont(20 / 1.2),
    fontWeight: "700",
  },
  balanceAmount: {
    marginTop: 4,
    color: "#FFFFFF",
    fontSize: normalizeFont(44 / 1.8),
    fontWeight: "800",
  },
  balanceSubtitle: {
    marginTop: 4,
    color: "#F6EAEA",
    fontSize: normalizeFont(14),
    fontWeight: "600",
  },
  sectionTitle: {
    marginTop: 18,
    marginBottom: 10,
    color: "#3A2222",
    fontSize: normalizeFont(20 / 1.1),
    fontWeight: "700",
  },
  chartCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#BFC9D0",
    backgroundColor: "#FDFEFF",
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  chartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  chartTitle: {
    color: "#A8B0BC",
    fontSize: normalizeFont(18 / 1.2),
    fontWeight: "700",
  },
  chartAmount: {
    color: "#B5BCC7",
    fontSize: normalizeFont(34 / 2),
    fontWeight: "700",
  },
  chartArea: {
    height: 150,
    borderBottomWidth: 1,
    borderColor: "#B8C4CC",
    justifyContent: "space-between",
    position: "relative",
    paddingVertical: 12,
    overflow: "hidden",
  },
  horizontalRule: {
    borderTopWidth: 1,
    borderStyle: "dashed",
    borderColor: "#A4B3BD",
    opacity: 0.7,
  },
  trendSegment: {
    position: "absolute",
    height: 4,
    borderRadius: 3,
    backgroundColor: "#8DE08E",
  },
  segment1: {
    left: "2%",
    top: "78%",
    width: "14%",
    transform: [{ rotate: "-18deg" }],
  },
  segment2: {
    left: "15%",
    top: "63%",
    width: "14%",
    transform: [{ rotate: "6deg" }],
  },
  segment3: {
    left: "28%",
    top: "67%",
    width: "14%",
    transform: [{ rotate: "-8deg" }],
  },
  segment4: {
    left: "41%",
    top: "61%",
    width: "16%",
    transform: [{ rotate: "-16deg" }],
  },
  segment5: {
    left: "56%",
    top: "47%",
    width: "15%",
    transform: [{ rotate: "-3deg" }],
  },
  segment6: {
    left: "70%",
    top: "42%",
    width: "18%",
    transform: [{ rotate: "-24deg" }],
  },
  chartDays: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  dayText: {
    color: "#657A8C",
    fontSize: normalizeFont(13),
    fontWeight: "600",
  },
  monthRow: {
    flexDirection: "row",
    gap: 10,
    paddingRight: 4,
  },
  monthCard: {
    width: 214,
    minHeight: 82,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#D8DCE0",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
  },
  monthIcon: {
    fontSize: normalizeFont(23 / 1.2),
    color: "#4E2A2A",
  },
  monthLabel: {
    color: "#3A2424",
    fontSize: normalizeFont(17 / 1.2),
    fontWeight: "700",
  },
  monthAmount: {
    marginTop: 4,
    color: "#048A11",
    fontSize: normalizeFont(30 / 2),
    fontWeight: "800",
  },
  payableCard: {
    marginTop: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#D7D7D7",
    backgroundColor: "#FFFFFF",
    minHeight: 106,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    shadowColor: "#000000",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  payableText: {
    color: "#3A2222",
    fontSize: normalizeFont(46 / 2),
    fontWeight: "700",
  },
  payableAmount: {
    color: "#3A2222",
    fontSize: normalizeFont(46 / 2),
    fontWeight: "800",
  },
});
