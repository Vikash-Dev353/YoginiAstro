import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { memo, useEffect, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import WebView from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppHeader } from "../../components/common/AppHeader";
import { AppGifLoader } from "../../components/common/AppGifLoader";
import { colors } from "../../constants/colors";
import { useTranslation } from "../../localization/useTranslation";
import { OrderStackParamList } from "../../navigation/types";
import {
  astroApi,
  type BasicAstroDetailsData,
  type GenerateKundaliResponse,
} from "../../services/api/astroApi";
import { hp, normalizeFont, wp } from "../../utils/responsive";

type KundliTab = "basic" | "chart" | "dasha" | "details";

type Props = NativeStackScreenProps<OrderStackParamList, "ViewKundli">;

const BORDER_COLOR = "#A8D4E6";
const ROW_ALT = "#FCE8E4";

function DataRow({
  label,
  value,
  isAlt,
}: {
  label: string;
  value: string;
  isAlt?: boolean;
}) {
  return (
    <View style={[styles.dataRow, isAlt && styles.dataRowAlt]}>
      <Text style={styles.dataLabel}>{label}</Text>
      <Text style={styles.dataValue}>{value}</Text>
    </View>
  );
}

function formatDateFromPayload(
  day: number,
  month: number,
  year: number
): string {
  const d = String(day).padStart(2, "0");
  const m = String(month).padStart(2, "0");
  return `${d}/${m}/${year}`;
}

function formatTimeFromPayload(hour: number, min: number): string {
  const h = hour % 12 || 12;
  const period = hour >= 12 ? "pm" : "am";
  return `${h}:${String(min).padStart(2, "0")} ${period}`;
}

function formatSunriseSunset(dateTimeStr: string | undefined): string {
  if (!dateTimeStr) return "—";
  const parts = dateTimeStr.split(" ");
  if (parts.length < 2) return dateTimeStr;
  const timePart = parts[1];
  if (!timePart) return "—";
  const [h, m, s] = timePart.split(":");
  const hour = parseInt(h ?? "0", 10);
  const hour12 = hour % 12 || 12;
  const period = hour >= 12 ? "pm" : "am";
  return `${hour12}:${m ?? "00"}:${s ?? "00"} ${period}`;
}

function getBasicData(
  kundaliData: GenerateKundaliResponse | null
): BasicAstroDetailsData | null {
  return kundaliData?.basic_astro_details?.data ?? null;
}

function ViewKundliScreenComponent({ route, navigation }: Props) {
  const { name, kundaliPayload } = route.params;
  const { appLanguage } = useTranslation();
  const [activeTab, setActiveTab] = useState<KundliTab>("basic");
  const [kundaliData, setKundaliData] =
    useState<GenerateKundaliResponse | null>(null);
  const [kundaliLoading, setKundaliLoading] = useState(false);
  const [kundaliError, setKundaliError] = useState<string | null>(null);

  useEffect(() => {
    if (!kundaliPayload) return;
    let isMounted = true;
    setKundaliLoading(true);
    setKundaliError(null);
    astroApi
      .generateKundali(kundaliPayload)
      .then((res) => {
        if (isMounted) {
          setKundaliData(res);
          setKundaliError(null);
        }
      })
      .catch((err: { message?: string }) => {
        if (isMounted) {
          setKundaliError(err?.message ?? "Failed to generate kundli");
          setKundaliData(null);
        }
      })
      .finally(() => {
        if (isMounted) setKundaliLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [kundaliPayload]);

  const tabs: { key: KundliTab; labelEn: string; labelHi: string }[] = [
    { key: "basic", labelEn: "Basic", labelHi: "बुनियादी" },
    { key: "chart", labelEn: "Chart", labelHi: "चार्ट" },
    { key: "dasha", labelEn: "Dasha", labelHi: "दशा" },
    { key: "details", labelEn: "Details", labelHi: "विवरण" },
  ];

  const isHindi = appLanguage === "hi";
  const basicData = getBasicData(kundaliData);
  const insets = useSafeAreaInsets();
  const bottomTabHeight = 84 + 10 + 16;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <AppHeader
        title={isHindi ? "कुंडली" : "Kundli"}
        showBack
        onBackPress={() => navigation.goBack()}
      />

      <View style={styles.tabBar}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              style={[styles.tab, isActive && styles.tabActive]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                {isHindi ? tab.labelHi : tab.labelEn}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + bottomTabHeight },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {kundaliLoading && (
          <View style={styles.loaderWrap}>
            <AppGifLoader
              message={
                isHindi ? "कुंडली जनरेट हो रही है..." : "Generating kundli..."
              }
              size={100}
            />
          </View>
        )}

        {!kundaliLoading && kundaliError && (
          <View style={styles.errorWrap}>
            <Text style={styles.errorText}>{kundaliError}</Text>
          </View>
        )}

        {activeTab === "basic" && !kundaliLoading && (
          <>
            <Text style={styles.sectionTitle}>
              {isHindi ? "जन्म विवरण" : "Birth Details"}
            </Text>
            <View style={styles.table}>
              <DataRow
                label={isHindi ? "नाम" : "Name"}
                value={basicData?.full_name ?? name}
              />
              <DataRow
                label={isHindi ? "जन्म तिथि" : "Date of Birth"}
                value={
                  basicData
                    ? formatDateFromPayload(
                        basicData.day ?? 0,
                        basicData.month ?? 0,
                        basicData.year ?? 0
                      )
                    : kundaliPayload
                    ? formatDateFromPayload(
                        kundaliPayload.day,
                        kundaliPayload.month,
                        kundaliPayload.year
                      )
                    : "11/07/2002"
                }
                isAlt
              />
              <DataRow
                label={isHindi ? "जन्म का समय" : "Time of Birth"}
                value={
                  basicData
                    ? formatTimeFromPayload(
                        basicData.hour ?? 0,
                        basicData.minute ?? 0
                      )
                    : kundaliPayload
                    ? formatTimeFromPayload(
                        kundaliPayload.hour,
                        kundaliPayload.min
                      )
                    : "02:36 pm"
                }
              />
              <DataRow
                label={isHindi ? "जगह" : "Place"}
                value={
                  basicData?.place ??
                  kundaliPayload?.birthPlace ??
                  kundaliPayload?.selectedPlace?.display_name ??
                  "—"
                }
                isAlt
              />

              <DataRow
                label={isHindi ? "अक्षांश" : "Latitude"}
                value={basicData?.latitude?.toString() ?? "—"}
              />
              <DataRow
                label={isHindi ? "देशान्तर" : "Longitude"}
                value={basicData?.longitude?.toString() ?? "—"}
                isAlt
              />
              <DataRow
                label={isHindi ? "समय क्षेत्र" : "Time Zone"}
                value={
                  basicData?.timezone != null
                    ? `GMT+${basicData.timezone}`
                    : "—"
                }
              />
              <DataRow
                label={isHindi ? "सूर्योदय" : "Sunrise"}
                value={formatSunriseSunset(basicData?.sunrise)}
                isAlt
              />
              <DataRow
                label={isHindi ? "सूर्यास्त" : "Sunset"}
                value={formatSunriseSunset(basicData?.sunset)}
              />
              <DataRow
                label={isHindi ? "लिंग" : "gender"}
                value={basicData?.gender ?? "—"}
                isAlt
              />
            </View>

            <Text style={styles.sectionTitle}>
              {isHindi ? "पंचांग विवरण" : "Astrological Details"}
            </Text>
            <View style={styles.table}>
              <DataRow
                label={isHindi ? "तिथि" : "Tithi"}
                value={basicData?.tithi ?? "—"}
              />
              <DataRow
                label={isHindi ? "पक्ष" : "Paksha"}
                value={basicData?.paksha ?? "—"}
                isAlt
              />

              <DataRow
                label={isHindi ? "सूर्य राशि" : "Sun Sign"}
                value={basicData?.sunsign ?? "—"}
              />

              <DataRow
                label={isHindi ? "चंद्र राशि" : "Moon Sign"}
                value={basicData?.moonsign ?? "—"}
                isAlt
              />
              <DataRow
                label={isHindi ? "नक्षत्र" : "Nakshatra"}
                value={basicData?.nakshatra ?? "—"}
              />

              <DataRow
                label={isHindi ? "योग" : "Yoga"}
                value={basicData?.yoga ?? "—"}
                isAlt
              />
              <DataRow
                label={isHindi ? "करण" : "Karan"}
                value={basicData?.karana ?? "—"}
              />
            </View>

            <Text style={styles.sectionTitle}>
              {isHindi ? "अवखाड़ा विवरण" : "Avakhada Detail"}
            </Text>
            <View style={styles.table}>
              <DataRow
                label={isHindi ? "वार्ना" : "Varna"}
                value={basicData?.varna ?? "—"}
              />
              <DataRow
                label={isHindi ? "वैश्य" : "Vashya"}
                value={basicData?.vashya ?? "—"}
                isAlt
              />
              <DataRow
                label={isHindi ? "योनि" : "Yoni"}
                value={basicData?.yoni ?? "—"}
              />
              <DataRow
                label={isHindi ? "गण" : "Gana"}
                value={basicData?.gana ?? "—"}
                isAlt
              />
              <DataRow
                label={isHindi ? "नाड़ी" : "Nadi"}
                value={basicData?.nadi ?? "—"}
              />
              <DataRow
                label={isHindi ? "राशि (चंद्र)" : "Rashi (Moon)"}
                value={basicData?.moonsign ?? "—"}
                isAlt
              />
              <DataRow
                label={isHindi ? "सूर्य राशि" : "Sun Sign"}
                value={basicData?.sunsign ?? "—"}
              />
              <DataRow
                label={isHindi ? "नक्षत्र" : "Nakshatra"}
                value={basicData?.nakshatra ?? "—"}
                isAlt
              />
              <DataRow
                label={isHindi ? "योग" : "Yoga"}
                value={basicData?.yoga ?? "—"}
              />
              <DataRow
                label={isHindi ? "करण" : "Karan"}
                value={basicData?.karana ?? "—"}
                isAlt
              />
              <DataRow
                label={isHindi ? "तिथि" : "Tithi"}
                value={basicData?.tithi ?? "—"}
              />
              <DataRow
                label={isHindi ? "पुंजा" : "Yunja"}
                value={basicData?.yunja ?? "—"}
                isAlt
              />
              <DataRow
                label={isHindi ? "तत्व" : "Tattva"}
                value={basicData?.tatva ?? "—"}
              />
              <DataRow
                label={isHindi ? "नाम वर्णमाला" : "Naam Varnamala"}
                value={basicData?.rashi_akshar ?? "—"}
                isAlt
              />
              <DataRow
                label={isHindi ? "पाया" : "Paya"}
                value={basicData?.paya?.type ?? "—"}
              />
            </View>
          </>
        )}

        {activeTab === "chart" && (
          <View style={styles.chartSection}>
            {[
              { key: 'horoscope_chart_D1', label: 'D1' },
              { key: 'horoscope_chart_D2', label: 'D2' },
              { key: 'horoscope_chart_D3', label: 'D3' },
              { key: 'horoscope_chart_D9', label: 'D9' },
              { key: 'horoscope_chart_D10', label: 'D10' },
              { key: 'horoscope_chart_D12', label: 'D12' },
            ].map(({ key, label }) => {
              const chartData = kundaliData?.data?.[key as keyof typeof kundaliData.data] as { data?: { base64_image?: string; svg?: string } } | undefined;
              const base64 = chartData?.data?.base64_image;
              const svg = chartData?.data?.svg;
              const hasChart = base64 || svg;
              const html = base64
                ? `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1.0"/></head><body style="margin:0;padding:0;display:flex;justify-content:center;align-items:center;background:#F5F5F5"><img src="${base64}" style="width:100%;height:auto;max-width:360px;display:block" /></body></html>`
                : svg
                  ? `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1.0"/></head><body style="margin:0;padding:0;display:flex;justify-content:center;align-items:center;background:#F5F5F5"><div style="width:100%;max-width:360px">${svg}</div></body></html>`
                  : '';
              return (
                <View key={key} style={styles.chartCard}>
                  <Text style={styles.chartLabel}>
                    {isHindi ? `कुंडली चार्ट (${label})` : `Kundli Chart (${label})`}
                  </Text>
                  {hasChart && html ? (
                    <WebView
                      source={{ html }}
                      style={styles.chartWebView}
                      scrollEnabled={false}
                      originWhitelist={['*']}
                      androidLayerType={Platform.OS === 'android' ? 'hardware' : undefined}
                    />
                  ) : (
                    <Text style={styles.placeholderText}>
                      {isHindi ? 'चार्ट उपलब्ध नहीं' : 'Chart not available'}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {activeTab === "dasha" && (
          <View style={styles.detailsSection}>
            <Text style={styles.sectionTitle}>
              {isHindi ? "विम्शोत्तरी दशा" : "Vimshottari Dasha"}
            </Text>
            {(() => {
              const mahaDasha =
                kundaliData?.vimshottari_dasha?.data?.maha_dasha;
              if (!mahaDasha || Object.keys(mahaDasha).length === 0) {
                return (
                  <Text style={styles.placeholderText}>
                    {isHindi
                      ? "दशा डेटा उपलब्ध नहीं"
                      : "Dasha data not available"}
                  </Text>
                );
              }
              return (
                <View style={styles.table}>
                  {Object.entries(mahaDasha).map(([planet, entry], idx) => (
                    <View
                      key={planet}
                      style={[
                        styles.dashaRow,
                        idx % 2 === 1 && styles.dataRowAlt,
                      ]}
                    >
                      <Text style={styles.dashaPlanet}>{planet}</Text>
                      <Text style={styles.dashaDates}>
                        {entry.start_date ?? "—"} – {entry.end_date ?? "—"}
                      </Text>
                    </View>
                  ))}
                </View>
              );
            })()}
          </View>
        )}

        {activeTab === "details" && (
          <View style={styles.detailsSection}>
            {(() => {
              const planets = kundaliData?.planetary_positions?.data?.planets;
              const manglik = kundaliData?.manglik_dosha?.data;
              const sadheSati = kundaliData?.sadhe_sati?.data?.sadhesati;

              const hasContent = planets?.length || manglik || sadheSati;
              if (!hasContent) {
                return (
                  <Text style={styles.placeholderText}>
                    {isHindi ? "विवरण उपलब्ध नहीं" : "Details not available"}
                  </Text>
                );
              }

              return (
                <>
                  {planets && planets.length > 0 && (
                    <>
                      <Text style={styles.sectionTitle}>
                        {isHindi ? "ग्रह स्थिति" : "Planetary Positions"}
                      </Text>
                      <View style={styles.table}>
                        {planets.map((p, idx) => (
                          <DataRow
                            key={p.name ?? idx}
                            label={p.name_lan ?? p.name ?? "—"}
                            value={`${p.sign ?? "—"} (भाव ${p.house ?? "—"})`}
                            isAlt={idx % 2 === 1}
                          />
                        ))}
                      </View>
                    </>
                  )}
                  {manglik && (
                    <>
                      <Text style={styles.sectionTitle}>
                        {isHindi ? "मांगलिक दोष" : "Manglik Dosha"}
                      </Text>
                      <View style={styles.table}>
                        <DataRow
                          label={isHindi ? "दोष" : "Dosha"}
                          value={manglik.manglik_dosha ?? "—"}
                        />
                        <DataRow
                          label={isHindi ? "तीव्रता" : "Strength"}
                          value={manglik.strength ?? "—"}
                          isAlt
                        />
                        <DataRow
                          label={isHindi ? "प्रतिशत" : "Percentage"}
                          value={
                            manglik.percentage != null
                              ? `${manglik.percentage}%`
                              : "—"
                          }
                        />
                      </View>
                      {manglik.remedies && manglik.remedies.length > 0 && (
                        <Text style={styles.remediesTitle}>
                          {isHindi ? "उपाय" : "Remedies"}
                        </Text>
                      )}
                      {manglik.remedies?.slice(0, 3).map((r, i) => (
                        <Text key={i} style={styles.remedyText}>
                          • {r}
                        </Text>
                      ))}
                    </>
                  )}
                  {sadheSati && (
                    <>
                      <Text style={styles.sectionTitle}>
                        {isHindi ? "साढ़े साती" : "Sade Sati"}
                      </Text>
                      <View style={styles.table}>
                        <DataRow
                          label={isHindi ? "परिणाम" : "Result"}
                          value={sadheSati.result ?? "—"}
                        />
                        <DataRow
                          label={isHindi ? "शनि राशि" : "Saturn Sign"}
                          value={sadheSati.saturn_sign ?? "—"}
                          isAlt
                        />
                      </View>
                    </>
                  )}
                </>
              );
            })()}
          </View>
        )}

        <View style={{ height: hp(2) }} />
      </ScrollView>
    </View>
  );
}

export const ViewKundliScreen = memo(ViewKundliScreenComponent);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#D4D4D4",
    backgroundColor: "#F1F1F1",
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  tabActive: {
    backgroundColor: colors.maroon,
  },
  tabText: {
    fontSize: normalizeFont(14),
    color: "#2F1C1C",
    fontWeight: "500",
  },
  tabTextActive: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: wp(4),
    paddingTop: hp(2),
  },
  loaderWrap: {
    paddingVertical: hp(4),
    alignItems: "center",
  },
  errorWrap: {
    paddingVertical: hp(2),
    paddingHorizontal: wp(4),
  },
  errorText: {
    fontSize: normalizeFont(14),
    color: colors.error,
    textAlign: "center",
  },
  sectionTitle: {
    fontSize: normalizeFont(18),
    fontWeight: "700",
    color: "#1A1A1A",
    marginBottom: 10,
  },
  table: {
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    borderRadius: 8,
    overflow: "hidden",
    marginBottom: hp(2.5),
  },
  dataRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLOR,
  },
  dataRowAlt: {
    backgroundColor: ROW_ALT,
  },
  dataLabel: {
    fontSize: normalizeFont(14),
    color: "#2F1C1C",
    fontWeight: "500",
    flex: 1,
  },
  dataValue: {
    fontSize: normalizeFont(14),
    color: "#2F1C1C",
    textAlign: "right",
    flex: 1,
  },
  manglikCard: {
    flexDirection: "row",
    backgroundColor: "#F5F5F5",
    borderRadius: 8,
    padding: 14,
    marginBottom: hp(2.5),
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  manglikIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: "#C9A227",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  manglikIconText: {
    fontSize: 24,
    color: "#8B6914",
    fontWeight: "700",
  },
  manglikContent: {
    flex: 1,
  },
  manglikName: {
    fontSize: normalizeFont(17),
    fontWeight: "700",
    color: "#1A1A1A",
    marginBottom: 6,
  },
  manglikDesc: {
    fontSize: normalizeFont(13),
    color: "#3D3D3D",
    lineHeight: 20,
    marginBottom: 4,
  },
  placeholderBlock: {
    paddingVertical: hp(4),
    alignItems: "center",
  },
  placeholderText: {
    fontSize: normalizeFont(15),
    color: colors.textSecondary,
  },
  chartSection: {
    marginBottom: hp(2),
  },
  chartCard: {
    marginBottom: hp(3),
  },
  chartLabel: {
    fontSize: normalizeFont(16),
    fontWeight: "600",
    color: "#1A1A1A",
    marginBottom: 8,
  },
  chartImage: {
    width: "100%",
    aspectRatio: 1,
    maxHeight: 320,
    backgroundColor: "#F5F5F5",
    borderRadius: 8,
  },
  chartWebView: {
    width: "100%",
    height: 320,
    backgroundColor: "#F5F5F5",
    borderRadius: 8,
  },
  detailsSection: {
    marginBottom: hp(2),
  },
  dashaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLOR,
  },
  dashaPlanet: {
    fontSize: normalizeFont(14),
    fontWeight: "600",
    color: "#1A1A1A",
    flex: 1,
  },
  dashaDates: {
    fontSize: normalizeFont(13),
    color: "#3D3D3D",
    textAlign: "right",
  },
  remediesTitle: {
    fontSize: normalizeFont(15),
    fontWeight: "600",
    color: "#1A1A1A",
    marginTop: hp(1),
    marginBottom: 6,
  },
  remedyText: {
    fontSize: normalizeFont(13),
    color: "#3D3D3D",
    lineHeight: 20,
    marginBottom: 4,
  },
});
