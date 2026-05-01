import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { memo, useCallback, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { images } from "../../assets/images";
import { AppHeader } from "../../components/common/AppHeader";
import { AppInput } from "../../components/common/AppInput";
import { colors } from "../../constants/colors";
import { useTranslation } from "../../localization/useTranslation";
import { OrderStackParamList } from "../../navigation/types";
import type { GenerateKundaliPayload } from "../../services/api/astroApi";
import { hp, normalizeFont, wp } from "../../utils/responsive";

type Props = NativeStackScreenProps<OrderStackParamList, "KundliBirthChart">;

const CREAM_PAGE = "#FDFBF7";
const BROWN = "#3D2019";
/** Same tokens as CompleteProfileScreen form */
const HEADER_CARD_CREAM = "#FFF9F2";
const LABEL_BROWN = "#6B3D3D";
const INPUT_BORDER = "#5A3A3A";

const GENDER_OPTIONS = ["Male", "Female", "Other"];

/** Fallback coordinates when user types city without geocoding (India centroid). */
const DEFAULT_LAT = 28.6139;
const DEFAULT_LON = 77.209;

function formatDateAsDdMmYy(date: Date): string {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yy = String(date.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
}

function formatDisplayTime(d: Date): string {
  let h = d.getHours();
  const m = d.getMinutes();
  const period = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")} ${period}`;
}

function buildPayload(params: {
  fullName: string;
  birthDate: Date;
  birthTime: Date;
  birthPlace: string;
  gender: string;
}): GenerateKundaliPayload {
  const place = params.birthPlace.trim();
  const d = params.birthDate;
  const t = params.birthTime;
  return {
    full_name: params.fullName.trim(),
    day: d.getDate(),
    month: d.getMonth() + 1,
    year: d.getFullYear(),
    hour: t.getHours(),
    min: t.getMinutes(),
    gender: params.gender,
    birthPlace: place,
    selectedPlace: {
      display_name: place,
      lat: DEFAULT_LAT,
      lon: DEFAULT_LON,
    },
    chart_type: "north",
    tzone: "5.5",
    lang: "en",
  };
}

type SelectModalProps = {
  visible: boolean;
  title: string;
  options: string[];
  onSelect: (value: string) => void;
  onClose: () => void;
};

/** Same pattern as `SelectModal` in CompleteProfileScreen */
function SelectModal({
  visible,
  title,
  options,
  onSelect,
  onClose,
}: SelectModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={modalStyles.overlay} onPress={onClose}>
        <Pressable
          style={modalStyles.sheet}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={modalStyles.sheetTitle}>{title}</Text>
          <FlatList
            data={options}
            keyExtractor={(item) => item}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable
                style={modalStyles.optionRow}
                onPress={() => {
                  onSelect(item);
                  onClose();
                }}
              >
                <Text style={modalStyles.optionText}>{item}</Text>
              </Pressable>
            )}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function createDefaultDobDate(): Date {
  const x = new Date();
  x.setFullYear(x.getFullYear() - 25);
  return x;
}

function createDefaultBirthTime(): Date {
  const x = new Date();
  x.setHours(12, 0, 0, 0);
  return x;
}

function KundliBirthChartScreenComponent({ navigation }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();

  const [fullName, setFullName] = useState("");
  const [gender, setGender] = useState("");
  const [dobDate, setDobDate] = useState(createDefaultDobDate);
  const [dob, setDob] = useState(() =>
    formatDateAsDdMmYy(createDefaultDobDate())
  );
  const [birthTime, setBirthTime] = useState(createDefaultBirthTime);
  const [birthPlace, setBirthPlace] = useState("");
  const [genderModalVisible, setGenderModalVisible] = useState(false);

  const [iosDateOpen, setIosDateOpen] = useState(false);
  const [iosTimeOpen, setIosTimeOpen] = useState(false);
  const [tempDobDate, setTempDobDate] = useState(dobDate);
  const [tempTime, setTempTime] = useState(birthTime);

  const scrollBottom = useMemo(() => {
    const tab = tabBarHeight > 0 ? tabBarHeight : 0;
    return tab + insets.bottom + hp(4);
  }, [insets.bottom, tabBarHeight]);

  const openDobPicker = useCallback(() => {
    setTempDobDate(dobDate);
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: dobDate,
        mode: "date",
        maximumDate: new Date(),
        onChange: (event: DateTimePickerEvent, selectedDate?: Date) => {
          if (event.type === "set" && selectedDate) {
            setDobDate(selectedDate);
            setDob(formatDateAsDdMmYy(selectedDate));
          }
        },
      });
      return;
    }
    setIosDateOpen(true);
  }, [dobDate]);

  const closeDobPicker = useCallback(() => {
    setIosDateOpen(false);
  }, []);

  const confirmDob = useCallback(() => {
    setDobDate(tempDobDate);
    setDob(formatDateAsDdMmYy(tempDobDate));
    setIosDateOpen(false);
  }, [tempDobDate]);

  const openTimePicker = useCallback(() => {
    setTempTime(birthTime);
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: birthTime,
        mode: "time",
        is24Hour: false,
        onChange: (event: DateTimePickerEvent, selected?: Date) => {
          if (event.type === "set" && selected) {
            setBirthTime(selected);
          }
        },
      });
      return;
    }
    setIosTimeOpen(true);
  }, [birthTime]);

  const onGenerate = useCallback(() => {
    const name = fullName.trim();
    const place = birthPlace.trim();
    if (!name) {
      Alert.alert("Required", "Please enter full name.");
      return;
    }
    if (!gender.trim()) {
      Alert.alert("Required", "Please select gender.");
      return;
    }
    if (!place) {
      Alert.alert("Required", "Please enter place of birth.");
      return;
    }
    const payload = buildPayload({
      fullName: name,
      birthDate: dobDate,
      birthTime,
      birthPlace: place,
      gender,
    });
    navigation.pop();
    setTimeout(() => {
      navigation.replace("ViewKundli", {
        name,
        kundaliPayload: payload,
      });
    }, 0);
  }, [birthPlace, birthTime, dobDate, fullName, gender, navigation]);

  const headingFont = useMemo(
    () => ({
      fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
    }),
    []
  );

  return (
    <View style={styles.root}>
      <ImageBackground
        source={images.appBackground}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      />
      <AppHeader
        title="Kundli Birth Chart"
        showBack
        onBackPress={() => navigation.goBack()}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          bounces={false}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: scrollBottom },
          ]}
        >
          <View style={styles.hero}>
            <View style={styles.heroCircle}>
              <Image
                source={images.logo}
                style={styles.heroLogo}
                resizeMode="contain"
              />
            </View>
            <Text style={[styles.heroTitle, headingFont]}>
              Generate Your Kundli
            </Text>
          </View>

          <View style={styles.banner}>
            <Text style={styles.bannerText}>
              Discover your cosmic blueprint. Enter your birth details precisely
              to unveil the celestial alignment at the moment of your arrival.
            </Text>
          </View>

          <View style={styles.card}>
            <AppInput
              label={t("completeProfile.fullName")}
              required
              value={fullName}
              onChangeText={setFullName}
              placeholder={t("completeProfile.enterFullName")}
              wrapperStyle={styles.field}
              inputContainerStyle={styles.inputBox}
            />

            <View style={styles.field}>
              <Text style={styles.label}>
                {t("completeProfile.gender")}
                <Text style={styles.req}>*</Text>
              </Text>
              <Pressable
                style={styles.selectBox}
                onPress={() => setGenderModalVisible(true)}
                accessibilityRole="button"
              >
                <Text
                  style={[
                    styles.selectText,
                    !gender && styles.selectPlaceholder,
                  ]}
                  numberOfLines={1}
                >
                  {gender || t("completeProfile.selectGender")}
                </Text>
                <Text style={styles.chevron}>▼</Text>
              </Pressable>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>
                {t("completeProfile.dateOfBirth")}
                <Text style={styles.req}>*</Text>
              </Text>
              <Pressable
                style={styles.selectBox}
                onPress={openDobPicker}
                accessibilityRole="button"
                accessibilityLabel={t("completeProfile.dateOfBirth")}
              >
                <Text
                  style={[styles.selectText, !dob && styles.selectPlaceholder]}
                  numberOfLines={1}
                >
                  {dob || t("completeProfile.dobPlaceholder")}
                </Text>
                <Text style={styles.calendarIcon}>📅</Text>
              </Pressable>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>
                {t("completeProfile.timeOfBirth")}
                <Text style={styles.req}>*</Text>
              </Text>
              <Pressable
                style={styles.selectBox}
                onPress={openTimePicker}
                accessibilityRole="button"
              >
                <Text style={styles.selectText}>{formatDisplayTime(birthTime)}</Text>
                <Text style={styles.calendarIcon}>🕐</Text>
              </Pressable>
            </View>

            <AppInput
              label={t("order.pob")}
              required
              value={birthPlace}
              onChangeText={setBirthPlace}
              placeholder={t("completeProfile.enterBirthPlace")}
              wrapperStyle={styles.field}
              inputContainerStyle={styles.inputBox}
            />

            <Pressable style={styles.cta} onPress={onGenerate}>
              <Text style={styles.ctaText}>Generate Kundli</Text>
              <Text style={styles.ctaBook}>📖</Text>
            </Pressable>

            <Text style={styles.terms}>
              BY PROCEEDING, YOU AGREE TO OUR COSMIC TERMS OF SERVICE
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <SelectModal
        visible={genderModalVisible}
        title={t("completeProfile.selectGender")}
        options={GENDER_OPTIONS}
        onSelect={setGender}
        onClose={() => setGenderModalVisible(false)}
      />

      {Platform.OS === "ios" && iosDateOpen ? (
        <Modal
          transparent
          animationType="fade"
          onRequestClose={closeDobPicker}
        >
          <Pressable style={modalStyles.overlay} onPress={closeDobPicker}>
            <Pressable
              style={modalStyles.sheet}
              onPress={(e) => e.stopPropagation()}
            >
              <Text style={modalStyles.sheetTitle}>
                {t("completeProfile.dateOfBirth")}
              </Text>
              <DateTimePicker
                value={tempDobDate}
                mode="date"
                display="spinner"
                maximumDate={new Date()}
                onChange={(_, d) => d && setTempDobDate(d)}
                themeVariant="light"
              />
              <View style={styles.dobPickerActions}>
                <Pressable style={styles.dobActionBtn} onPress={closeDobPicker}>
                  <Text style={styles.dobActionText}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.dobActionBtn} onPress={confirmDob}>
                  <Text style={styles.dobActionText}>Done</Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}

      {Platform.OS === "ios" && iosTimeOpen ? (
        <Modal
          transparent
          animationType="fade"
          onRequestClose={() => setIosTimeOpen(false)}
        >
          <Pressable
            style={modalStyles.overlay}
            onPress={() => setIosTimeOpen(false)}
          >
            <Pressable
              style={modalStyles.sheet}
              onPress={(e) => e.stopPropagation()}
            >
              <Text style={modalStyles.sheetTitle}>
                {t("completeProfile.timeOfBirth")}
              </Text>
              <DateTimePicker
                value={tempTime}
                mode="time"
                display="spinner"
                is24Hour={false}
                onChange={(_, d) => d && setTempTime(d)}
                themeVariant="light"
              />
              <View style={styles.dobPickerActions}>
                <Pressable
                  style={styles.dobActionBtn}
                  onPress={() => setIosTimeOpen(false)}
                >
                  <Text style={styles.dobActionText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={styles.dobActionBtn}
                  onPress={() => {
                    setBirthTime(tempTime);
                    setIosTimeOpen(false);
                  }}
                >
                  <Text style={styles.dobActionText}>Done</Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </View>
  );
}

export const KundliBirthChartScreen = memo(KundliBirthChartScreenComponent);

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: hp(50),
    paddingBottom: hp(2),
  },
  sheetTitle: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    fontSize: normalizeFont(17),
    fontWeight: "700",
    color: colors.textPrimary,
    borderBottomWidth: 1,
    borderBottomColor: "#E8E0E0",
  },
  optionRow: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#EEE",
  },
  optionText: {
    fontSize: normalizeFont(16),
    color: colors.textPrimary,
  },
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: CREAM_PAGE,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  hero: {
    alignItems: "center",
    paddingTop: hp(1.5),
    paddingHorizontal: wp(5),
  },
  heroCircle: {
    width: 128,
    height: 128,
    borderRadius: 64,
    alignItems: "center",
    justifyContent: "center",
  },
  heroLogo: {
    width: 110,
    height: 110,
  },
  heroTitle: {
    marginTop: hp(2),
    fontSize: normalizeFont(26),
    fontWeight: "700",
    color: BROWN,
    textAlign: "center",
  },
  banner: {
    marginTop: hp(2),
    marginHorizontal: wp(4),
    backgroundColor: BROWN,
    paddingVertical: hp(2),
    paddingHorizontal: wp(4),
    borderRadius: 4,
  },
  bannerText: {
    color: "#FFFFFF",
    fontSize: normalizeFont(14),
    lineHeight: 22,
    textAlign: "center",
    fontWeight: "500",
  },
  /** Align with CompleteProfileScreen `card` */
  card: {
    marginTop: 10,
    marginHorizontal: wp(3),
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: wp(4),
    paddingTop: hp(3),
    paddingBottom: hp(3),
    // shadowColor: '#000',
    // shadowOffset: { width: 0, height: 0 },
    // shadowOpacity: 0.25,
    // shadowRadius: 3.84,
    // elevation: 5,
  },
  field: {
    marginBottom: 14,
  },
  label: {
    fontSize: normalizeFont(36 / 3),
    color: colors.textPrimary,
    marginBottom: 10,
  },
  req: {
    color: colors.error,
  },
  inputBox: {
    borderColor: INPUT_BORDER,
    borderRadius: 12,
    backgroundColor: "#FFFCF7",
  },
  selectBox: {
    height: 56,
    borderWidth: 1,
    borderColor: INPUT_BORDER,
    borderRadius: 12,
    backgroundColor: "#FFFCF7",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
  },
  selectText: {
    flex: 1,
    fontSize: normalizeFont(15),
    color: colors.textPrimary,
  },
  selectPlaceholder: {
    color: colors.textMuted,
  },
  chevron: {
    fontSize: 10,
    color: LABEL_BROWN,
    marginLeft: 4,
  },
  calendarIcon: {
    fontSize: 16,
    color: LABEL_BROWN,
    marginLeft: 6,
  },
  dobPickerActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 6,
  },
  dobActionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#D8CFCF",
    backgroundColor: "#FAF6F1",
  },
  dobActionText: {
    color: colors.textPrimary,
    fontSize: normalizeFont(14),
    fontWeight: "600",
  },
  cta: {
    marginTop: hp(1),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BROWN,
    borderRadius: 999,
    paddingVertical: hp(1.8),
    paddingHorizontal: 24,
    gap: 10,
  },
  ctaText: {
    color: "#FFFFFF",
    fontSize: normalizeFont(17),
    fontWeight: "700",
  },
  ctaBook: {
    fontSize: normalizeFont(20),
  },
  terms: {
    marginTop: hp(2),
    textAlign: "center",
    fontSize: normalizeFont(10),
    letterSpacing: 0.6,
    color: "#8A8A8A",
    textTransform: "uppercase",
    lineHeight: 16,
    paddingHorizontal: wp(2),
  },
});
