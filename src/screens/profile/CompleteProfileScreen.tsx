import { CommonActions } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import {
  launchCamera,
  launchImageLibrary,
  type ImagePickerResponse,
} from 'react-native-image-picker';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { images } from '../../assets/images';
import { AppButton } from '../../components/common/AppButton';
import { AppInput } from '../../components/common/AppInput';
import { colors } from '../../constants/colors';
import { useTranslation } from '../../localization/useTranslation';
import { AuthStackParamList } from '../../navigation/types';
import { astroApi, type AstroProfile } from '../../services/api/astroApi';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  applyAuthGate,
  decodeMobileFromToken,
  logout,
} from '../../store/slices/authSlice';
import { hp, normalizeFont, wp } from '../../utils/responsive';

type Props = NativeStackScreenProps<AuthStackParamList, 'CompleteProfile'>;

const HEADER_BG = '#3B1616';
const CREAM = '#FFF9F2';
const LABEL_BROWN = '#6B3D3D';
const INPUT_BORDER = '#5A3A3A';

const GENDER_OPTIONS = ['Male', 'Female', 'Other'];

const SKILL_OPTIONS: { value: string; label: string }[] = [
  { value: 'vedic', label: 'Vedic' },
  { value: 'tarot', label: 'Tarot' },
  { value: 'kp', label: 'KP' },
  { value: 'prashna', label: 'Prashna' },
  { value: 'remedies', label: 'Remedies' },
];

const SPECIALITY_OPTIONS: { value: string; label: string }[] = [
  { value: 'Business', label: 'Business' },
  { value: 'Career', label: 'Career' },
  { value: 'Education', label: 'Education' },
  { value: 'Family Life', label: 'Family Life' },
  { value: 'Health', label: 'Health' },
  { value: 'Love', label: 'Love' },
  { value: 'Marriage', label: 'Marriage' },
  { value: 'Wealth', label: 'Wealth' },
];

const LANGUAGE_OPTIONS: { value: string; label: string }[] = [
  { value: 'Hindi', label: 'Hindi' },
  { value: 'English', label: 'English' },
  { value: 'Tamil', label: 'Tamil' },
  { value: 'Telugu', label: 'Telugu' },
  { value: 'Marathi', label: 'Marathi' },
];
const COUNTRY_API_BASE = 'https://countriesnow.space/api/v0.1/countries';

const formatDateAsDdMmYy = (date: Date) => {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yy = String(date.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
};

const formatDateAsYyyyMmDd = (date: Date) => {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = String(date.getFullYear());
  return `${yyyy}-${mm}-${dd}`;
};

const parseApiDob = (dobValue?: string) => {
  if (!dobValue) {
    return null;
  }
  const normalized = dobValue.trim();
  if (!normalized) {
    return null;
  }

  const parts = normalized.includes('-')
    ? normalized.split('-')
    : normalized.split('/');
  if (parts.length !== 3) {
    return null;
  }

  let year = 0;
  let month = 0;
  let day = 0;

  if (normalized.includes('-')) {
    year = Number(parts[0]);
    month = Number(parts[1]);
    day = Number(parts[2]);
  } else {
    day = Number(parts[0]);
    month = Number(parts[1]);
    year = Number(parts[2]);
    if (year < 100) {
      year += 2000;
    }
  }

  const parsedDate = new Date(year, month - 1, day);
  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }
  return parsedDate;
};

const skillsValuesToJsonPayload = (values: string[]) => {
  const list = values.length
    ? values.map(v => v.toLowerCase().replace(/\s+/g, ' '))
    : ['vedic'];
  return JSON.stringify(list);
};

const specialityValuesToJsonPayload = (values: string[]) => {
  const list = values.length ? values : ['Business'];
  return JSON.stringify(list);
};

function tokenizeProfileListField(
  raw: string[] | string | undefined,
): string[] {
  if (Array.isArray(raw)) {
    return raw.map(x => String(x).trim()).filter(Boolean);
  }
  if (typeof raw !== 'string' || !raw.trim()) {
    return [];
  }
  const s = raw.trim();
  if (s.startsWith('[')) {
    try {
      const parsed = JSON.parse(s) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.map(x => String(x).trim()).filter(Boolean);
      }
    } catch {
      /* fall through */
    }
  }
  return s.split(/[,\n]/).map(x => x.trim()).filter(Boolean);
}

function mapSkillTokensToValues(tokens: string[]): string[] {
  const out = new Set<string>();
  for (const t of tokens) {
    const tl = t.toLowerCase();
    const byVal = SKILL_OPTIONS.find(
      o => o.value === t || o.value.toLowerCase() === tl,
    );
    if (byVal) {
      out.add(byVal.value);
      continue;
    }
    const byLabel = SKILL_OPTIONS.find(
      o => o.label.toLowerCase() === tl || o.label === t,
    );
    if (byLabel) {
      out.add(byLabel.value);
    }
  }
  return Array.from(out);
}

function mapSpecialityTokensToValues(tokens: string[]): string[] {
  const out = new Set<string>();
  for (const t of tokens) {
    const tl = t.trim();
    if (!tl) {
      continue;
    }
    const exact = SPECIALITY_OPTIONS.find(o => o.value === tl);
    if (exact) {
      out.add(exact.value);
      continue;
    }
    const byLabel = SPECIALITY_OPTIONS.find(
      o => o.label.toLowerCase() === tl.toLowerCase(),
    );
    if (byLabel) {
      out.add(byLabel.value);
    }
  }
  return Array.from(out);
}

const languagesValuesToJsonPayload = (values: string[]) => {
  const list = values.length ? values : ['Hindi'];
  return JSON.stringify(list);
};

function mapLanguageTokensToValues(tokens: string[]): string[] {
  const allowed = new Set(LANGUAGE_OPTIONS.map(o => o.value));
  const out = new Set<string>();
  for (const t of tokens) {
    const tl = t.trim();
    if (!tl) {
      continue;
    }
    if (allowed.has(tl)) {
      out.add(tl);
      continue;
    }
    const byLabel = LANGUAGE_OPTIONS.find(
      o => o.label.toLowerCase() === tl.toLowerCase(),
    );
    if (byLabel) {
      out.add(byLabel.value);
    }
  }
  return Array.from(out);
}

type SelectModalProps = {
  visible: boolean;
  title: string;
  options: string[];
  onSelect: (value: string) => void;
  onClose: () => void;
};

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
          onPress={e => e.stopPropagation()}
        >
          <Text style={modalStyles.sheetTitle}>{title}</Text>
          <FlatList
            data={options}
            keyExtractor={item => item}
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

type MultiSelectOption = { value: string; label: string };

type MultiSelectModalProps = {
  visible: boolean;
  title: string;
  options: MultiSelectOption[];
  selectedValues: string[];
  onToggleValue: (value: string) => void;
  onClose: () => void;
};

function MultiSelectModal({
  visible,
  title,
  options,
  selectedValues,
  onToggleValue,
  onClose,
}: MultiSelectModalProps) {
  const selectedSet = useMemo(
    () => new Set(selectedValues),
    [selectedValues],
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={modalStyles.overlay} onPress={onClose}>
        <Pressable
          style={[modalStyles.sheet, multiSelectStyles.sheetMax]}
          onPress={e => e.stopPropagation()}
        >
          <Text style={modalStyles.sheetTitle}>{title}</Text>
          <FlatList
            style={multiSelectStyles.list}
            data={options}
            keyExtractor={item => item.value}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const checked = selectedSet.has(item.value);
              return (
                <Pressable
                  style={multiSelectStyles.optionRow}
                  onPress={() => onToggleValue(item.value)}
                >
                  <Text style={multiSelectStyles.checkmark}>
                    {checked ? '☑' : '☐'}
                  </Text>
                  <Text style={modalStyles.optionText}>{item.label}</Text>
                </Pressable>
              );
            }}
          />
          <View style={multiSelectStyles.doneWrap}>
            <AppButton title="Done" onPress={onClose} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function CompleteProfileScreenComponent({ navigation }: Props) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const astroId = useAppSelector(state => state.auth.astroId)?.trim() || '';
  const token = useAppSelector(state => state.auth.token);
  const userEmail = useAppSelector(state => state.auth.user?.email)?.trim() || '';

  const [fullName, setFullName] = useState('');
  const [profileImageUri, setProfileImageUri] = useState<string | null>(null);
  const [gender, setGender] = useState('');
  const [dob, setDob] = useState('');
  const [dobDate, setDobDate] = useState(new Date(1990, 0, 1));
  const [isDobPickerVisible, setIsDobPickerVisible] = useState(false);
  const [tempDobDate, setTempDobDate] = useState(new Date(1990, 0, 1));
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [experience, setExperience] = useState('');
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [selectedSpecialities, setSelectedSpecialities] = useState<string[]>(
    [],
  );
  const [pincode, setPincode] = useState('');
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [country] = useState('India');
  const [city, setCity] = useState('');
  const [stateName, setStateName] = useState('');
  const [stateOptions, setStateOptions] = useState<string[]>([]);
  const [cityOptions, setCityOptions] = useState<string[]>([]);
  const [isLoadingStates, setIsLoadingStates] = useState(false);
  const [isLoadingCities, setIsLoadingCities] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [modal, setModal] = useState<{
    kind:
      | 'gender'
      | 'skills'
      | 'speciality'
      | 'languages'
      | 'city'
      | 'state'
      | null;
  }>({ kind: null });

  const applyProfileData = useCallback((profile: AstroProfile) => {
    setFullName(profile.name?.trim() || '');
    setGender(profile.gender?.trim() || '');
    setAddress(profile.address?.trim() || '');
    setDescription(
      typeof profile.description === 'string' ? profile.description.trim() : '',
    );
    if (profile.speciality !== undefined && profile.speciality !== null) {
      const specTokens = tokenizeProfileListField(profile.speciality);
      setSelectedSpecialities(mapSpecialityTokensToValues(specTokens));
    }
    setCity(profile.city?.trim() || '');
    setStateName(profile.state?.trim() || '');
    setPincode(profile.pincode?.trim() || '');
    setExperience(
      profile.experience !== undefined && profile.experience !== null
        ? String(profile.experience)
        : '',
    );

    const langTokens = tokenizeProfileListField(profile.languages);
    setSelectedLanguages(mapLanguageTokensToValues(langTokens));

    const skillTokens = tokenizeProfileListField(profile.skills);
    setSelectedSkills(mapSkillTokensToValues(skillTokens));

    if (profile.profileImage?.trim()) {
      setProfileImageUri(profile.profileImage.trim());
    }

    const parsedDob = parseApiDob(profile.dob);
    if (parsedDob) {
      setDobDate(parsedDob);
      setDob(formatDateAsDdMmYy(parsedDob));
    }
  }, []);

  const fetchAstroProfile = useCallback(async () => {
    if (!astroId) {
      return;
    }
    try {
      setIsLoadingProfile(true);
      const response = await astroApi.getProfile({ astroId });
      const profile = response.astrologer || response.data || response.profile;
      if (profile) {
        applyProfileData(profile);
      }
    } catch {
      // Keep form usable with current values when fetch fails.
    } finally {
      setIsLoadingProfile(false);
    }
  }, [applyProfileData, astroId]);

  useEffect(() => {
    let isMounted = true;
    const loadStates = async () => {
      setIsLoadingStates(true);
      try {
        const response = await fetch(`${COUNTRY_API_BASE}/states`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ country }),
        });
        const result = (await response.json()) as {
          data?: { states?: Array<{ name?: string }> };
        };
        const nextStates = (result.data?.states ?? [])
          .map(item => item.name?.trim() ?? '')
          .filter(Boolean);
        if (isMounted) {
          setStateOptions(nextStates);
        }
      } catch {
        if (isMounted) {
          setStateOptions([]);
        }
      } finally {
        if (isMounted) {
          setIsLoadingStates(false);
        }
      }
    };

    loadStates();
    return () => {
      isMounted = false;
    };
  }, [country]);

  useEffect(() => {
    if (!stateName) {
      setCityOptions([]);
      return;
    }

    let isMounted = true;
    const loadCities = async () => {
      setIsLoadingCities(true);
      try {
        const response = await fetch(`${COUNTRY_API_BASE}/state/cities`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ country, state: stateName }),
        });
        const result = (await response.json()) as { data?: string[] };
        if (isMounted) {
          setCityOptions((result.data ?? []).filter(Boolean));
        }
      } catch {
        if (isMounted) {
          setCityOptions([]);
        }
      } finally {
        if (isMounted) {
          setIsLoadingCities(false);
        }
      }
    };

    loadCities();
    return () => {
      isMounted = false;
    };
  }, [country, stateName]);

  useEffect(() => {
    fetchAstroProfile();
  }, [fetchAstroProfile]);

  const modalConfig = useMemo(() => {
    switch (modal.kind) {
      case 'gender':
        return {
          title: t('completeProfile.selectGender'),
          options: GENDER_OPTIONS,
          onSelect: setGender,
        };
      case 'city':
        return {
          title: t('completeProfile.selectCity'),
          options: cityOptions,
          onSelect: setCity,
        };
      case 'state':
        return {
          title: t('completeProfile.selectState'),
          options: stateOptions,
          onSelect: (value: string) => {
            setStateName(value);
            setCity('');
          },
        };
      default:
        return null;
    }
  }, [cityOptions, modal.kind, t]);

  const skillsSummary = useMemo(
    () =>
      selectedSkills
        .map(v => SKILL_OPTIONS.find(o => o.value === v)?.label ?? v)
        .join(', '),
    [selectedSkills],
  );

  const specialitySummary = useMemo(
    () =>
      selectedSpecialities
        .map(v => SPECIALITY_OPTIONS.find(o => o.value === v)?.label ?? v)
        .join(', '),
    [selectedSpecialities],
  );

  const languagesSummary = useMemo(
    () =>
      selectedLanguages
        .map(v => LANGUAGE_OPTIONS.find(o => o.value === v)?.label ?? v)
        .join(', '),
    [selectedLanguages],
  );

  const toggleSkillValue = useCallback((value: string) => {
    setSelectedSkills(prev =>
      prev.includes(value) ? prev.filter(x => x !== value) : [...prev, value],
    );
  }, []);

  const toggleSpecialityValue = useCallback((value: string) => {
    setSelectedSpecialities(prev =>
      prev.includes(value) ? prev.filter(x => x !== value) : [...prev, value],
    );
  }, []);

  const toggleLanguageValue = useCallback((value: string) => {
    setSelectedLanguages(prev =>
      prev.includes(value) ? prev.filter(x => x !== value) : [...prev, value],
    );
  }, []);

  const onSubmit = useCallback(async () => {
    if (!astroId) {
      Alert.alert('Error', 'Astro ID not found. Please login again.');
      return;
    }

    if (selectedSkills.length === 0) {
      Alert.alert('Error', 'Please select at least one skill.');
      return;
    }
    if (selectedSpecialities.length === 0) {
      Alert.alert('Error', 'Please select at least one speciality.');
      return;
    }
    if (selectedLanguages.length === 0) {
      Alert.alert('Error', 'Please select at least one language.');
      return;
    }

    const mobile =
      decodeMobileFromToken(token) ||
      userEmail.match(/^(\d{10})@/)?.[1] ||
      '';
    if (!mobile) {
      Alert.alert('Error', 'Mobile number not found. Please login again.');
      return;
    }

    const payload = new FormData();
    payload.append('name', fullName.trim());
    payload.append('gender', gender || 'Male');
    payload.append('dob', formatDateAsYyyyMmDd(dobDate));
    payload.append('skills', skillsValuesToJsonPayload(selectedSkills));
    payload.append('languages', languagesValuesToJsonPayload(selectedLanguages));
    payload.append('address', address.trim());
    payload.append('pincode', pincode.trim());
    payload.append('mobile', mobile);
    payload.append('description', description.trim() || '—');
    payload.append('email', userEmail.trim() || 'test@gmail.com');
    payload.append('experience', experience.trim() || '0');
    payload.append(
      'speciality',
      specialityValuesToJsonPayload(selectedSpecialities),
    );
    payload.append('country', 'IN');
    payload.append('state', stateName.trim());
    payload.append('city', city.trim());

    if (
      profileImageUri &&
      !profileImageUri.toLowerCase().startsWith('http')
    ) {
      const fileName =
        profileImageUri.split('/').pop() || `profile-${Date.now()}.jpg`;
      payload.append(
        'profileImage',
        {
          uri: profileImageUri,
          name: fileName,
          type: 'image/jpeg',
        } as never,
      );
    }

    try {
      setIsSubmitting(true);
      const response = await astroApi.submitInitialProfile(payload);
      const success = response.status?.toLowerCase() === 'success';
      if (success) {
        await fetchAstroProfile();
        await dispatch(
          applyAuthGate({
            pendingProfileCompletion: false,
            pendingAdminApproval: true,
          }),
        ).unwrap();
        navigation.replace('PendingApproval');
      }
      Alert.alert(
        success ? t('completeProfile.submitTitle') : 'Update failed',
        response.message || t('completeProfile.submitMessage'),
      );
    } catch (error) {
      Alert.alert(
        'Error',
        (error as { message?: string })?.message || 'Unable to update profile.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [
    address,
    astroId,
    city,
    description,
    dobDate,
    experience,
    fullName,
    gender,
    selectedLanguages,
    pincode,
    profileImageUri,
    selectedSkills,
    selectedSpecialities,
    stateName,
    t,
    token,
    userEmail,
    fetchAstroProfile,
    navigation,
    dispatch,
  ]);

  const onReturnToLogin = useCallback(async () => {
    try {
      await dispatch(logout()).unwrap();
    } catch {
      /* still leave auth UI */
    }
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      }),
    );
  }, [dispatch, navigation]);

  const closeModal = useCallback(() => setModal({ kind: null }), []);
  const onImagePicked = useCallback((result: ImagePickerResponse) => {
    if (result.didCancel || result.errorCode) {
      return;
    }
    const selectedUri = result.assets?.[0]?.uri;
    if (selectedUri) {
      setProfileImageUri(selectedUri);
    }
  }, []);
  const openCamera = useCallback(async () => {
    try {
      const result = await launchCamera({
        mediaType: 'photo',
        cameraType: 'back',
        quality: 0.9,
      });
      onImagePicked(result);
    } catch {
      Alert.alert('Error', 'Unable to open camera');
    }
  }, [onImagePicked]);
  const openGallery = useCallback(async () => {
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.9,
        selectionLimit: 1,
      });
      onImagePicked(result);
    } catch {
      Alert.alert('Error', 'Unable to open gallery');
    }
  }, [onImagePicked]);
  const onUploadProfilePhoto = useCallback(() => {
    Alert.alert('Upload Profile Photo', 'Choose photo source', [
      { text: 'Camera', onPress: openCamera },
      { text: 'Gallery', onPress: openGallery },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [openCamera, openGallery]);
  const openDobPicker = useCallback(() => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: dobDate,
        mode: 'date',
        maximumDate: new Date(),
        onChange: (event: DateTimePickerEvent, selectedDate?: Date) => {
          if (event.type === 'set' && selectedDate) {
            setDobDate(selectedDate);
            setDob(formatDateAsDdMmYy(selectedDate));
          }
        },
      });
      return;
    }
    setTempDobDate(dobDate);
    setIsDobPickerVisible(true);
  }, [dobDate]);
  const closeDobPicker = useCallback(() => {
    setIsDobPickerVisible(false);
  }, []);
  const confirmDob = useCallback(() => {
    setDobDate(tempDobDate);
    setDob(formatDateAsDdMmYy(tempDobDate));
    setIsDobPickerVisible(false);
  }, [tempDobDate]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          bounces={false}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.header}>
            <ImageBackground
              source={images.appBackground}
              style={StyleSheet.absoluteFill}
              imageStyle={styles.headerPattern}
            />
            <View style={styles.headerOverlay} />
            <Text style={styles.headline}>{t('completeProfile.headline')}</Text>

            <View style={styles.avatarWrap}>
              <View style={styles.avatarRing}>
                <Image
                  source={
                    profileImageUri ? { uri: profileImageUri } : images.logo
                  }
                  style={styles.avatarImg}
                  resizeMode={profileImageUri ? 'cover' : 'contain'}
                />
              </View>
              <Pressable
                style={styles.cameraBadge}
                onPress={onUploadProfilePhoto}
                accessibilityRole="button"
                accessibilityLabel={t('completeProfile.uploadPhoto')}
              >
                <Text style={styles.cameraIcon}>📷</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.uploadLabel}>
              {t('completeProfile.uploadPhoto')}
              <Text style={styles.req}>*</Text>
            </Text>
            {isLoadingProfile ? (
              <Text style={styles.previewText}>Loading profile...</Text>
            ) : null}
            {profileImageUri ? (
              <Text style={styles.previewText}>Photo selected</Text>
            ) : null}

            <AppInput
              label={t('completeProfile.fullName')}
              required
              value={fullName}
              onChangeText={setFullName}
              placeholder={t('completeProfile.enterFullName')}
              wrapperStyle={styles.field}
              inputContainerStyle={styles.inputBox}
            />

            <View style={styles.row}>
              <View style={[styles.half, styles.halfLeft]}>
                <Text style={styles.label}>
                  {t('completeProfile.gender')}
                  <Text style={styles.req}>*</Text>
                </Text>
                <Pressable
                  style={styles.selectBox}
                  onPress={() => setModal({ kind: 'gender' })}
                >
                  <Text
                    style={[
                      styles.selectText,
                      !gender && styles.selectPlaceholder,
                    ]}
                    numberOfLines={1}
                  >
                    {gender || t('completeProfile.selectGender')}
                  </Text>
                  <Text style={styles.chevron}>▼</Text>
                </Pressable>
              </View>
              <View style={[styles.half, styles.halfRight]}>
                <Text style={styles.label}>
                  {t('completeProfile.dateOfBirth')}
                  <Text style={styles.req}>*</Text>
                </Text>
                <Pressable
                  style={styles.selectBox}
                  onPress={openDobPicker}
                  accessibilityRole="button"
                  accessibilityLabel={t('completeProfile.dateOfBirth')}
                >
                  <Text
                    style={[
                      styles.selectText,
                      !dob && styles.selectPlaceholder,
                    ]}
                    numberOfLines={1}
                  >
                    {dob || t('completeProfile.dobPlaceholder')}
                  </Text>
                  <Text style={styles.calendarIcon}>📅</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.row}>
              <View style={[styles.half, styles.halfLeft]}>
                <Text style={styles.label}>
                  {t('completeProfile.skills')}
                  <Text style={styles.req}>*</Text>
                </Text>
                <Pressable
                  style={styles.selectBox}
                  onPress={() => setModal({ kind: 'skills' })}
                >
                  <Text
                    style={[
                      styles.selectText,
                      selectedSkills.length === 0 && styles.selectPlaceholder,
                    ]}
                    numberOfLines={2}
                  >
                    {selectedSkills.length > 0
                      ? skillsSummary
                      : t('completeProfile.selectSkills')}
                  </Text>
                  <Text style={styles.chevron}>▼</Text>
                </Pressable>
              </View>
              <View style={[styles.half, styles.halfRight]}>
                <AppInput
                  label={t('completeProfile.experience')}
                  required
                  value={experience}
                  onChangeText={setExperience}
                  placeholder={t('completeProfile.enterExperience')}
                  wrapperStyle={styles.field}
                  inputContainerStyle={styles.inputBox}
                />
              </View>
            </View>

            <AppInput
              label={t('completeProfile.address')}
              required
              value={address}
              onChangeText={setAddress}
              placeholder={t('completeProfile.enterAddress')}
              wrapperStyle={styles.field}
              inputContainerStyle={styles.inputBox}
            />

            <AppInput
              label="Description"
              required
              value={description}
              onChangeText={setDescription}
              placeholder="About you"
              multiline
              wrapperStyle={styles.field}
              inputContainerStyle={[styles.inputBox, styles.multilineInput]}
            />

            <Text style={[styles.label,{
              marginTop: hp(4),
            }]}>
              {t('completeProfile.speciality')}
              <Text style={styles.req}>*</Text>
            </Text>
            <Pressable
              style={[styles.selectBox, styles.fieldTight]}
              onPress={() => setModal({ kind: 'speciality' })}
            >
              <Text
                style={[
                  styles.selectText,
                  selectedSpecialities.length === 0 && styles.selectPlaceholder,
                ]}
                numberOfLines={2}
              >
                {selectedSpecialities.length > 0
                  ? specialitySummary
                  : t('completeProfile.selectSpeciality')}
              </Text>
              <Text style={styles.chevron}>▼</Text>
            </Pressable>

            <View style={styles.row}>
              <View style={[styles.half, styles.halfLeft]}>
                <AppInput
                  label={t('completeProfile.pincode')}
                  required
                  value={pincode}
                  onChangeText={setPincode}
                  placeholder={t('completeProfile.enterPincode')}
                  keyboardType="number-pad"
                  maxLength={6}
                  wrapperStyle={styles.field}
                  inputContainerStyle={styles.inputBox}
                />
              </View>
              <View style={[styles.half, styles.halfRight]}>
                <Text style={styles.label}>
                  {t('completeProfile.languages')}
                  <Text style={styles.req}>*</Text>
                </Text>
                <Pressable
                  style={styles.selectBox}
                  onPress={() => setModal({ kind: 'languages' })}
                >
                  <Text
                    style={[
                      styles.selectText,
                      selectedLanguages.length === 0 && styles.selectPlaceholder,
                    ]}
                    numberOfLines={2}
                  >
                    {selectedLanguages.length > 0
                      ? languagesSummary
                      : t('completeProfile.selectLanguage')}
                  </Text>
                  <Text style={styles.chevron}>▼</Text>
                </Pressable>
              </View>
            </View>

            <AppInput
              label={t('completeProfile.country')}
              required
              value={country}
              editable={false}
              placeholder=""
              wrapperStyle={styles.field}
              inputContainerStyle={[styles.inputBox, styles.inputDisabled]}
            />

            <Text style={styles.label}>
              {t('completeProfile.state')}
              <Text style={styles.req}>*</Text>
            </Text>
            <Pressable
              style={[styles.selectBox, styles.fieldTight]}
              onPress={() => {
                if (isLoadingStates || stateOptions.length === 0) {
                  return;
                }
                setModal({ kind: 'state' });
              }}
            >
              <Text
                style={[
                  styles.selectText,
                  !stateName && styles.selectPlaceholder,
                ]}
                numberOfLines={1}
              >
                {stateName ||
                  (isLoadingStates
                    ? 'Loading states...'
                    : t('completeProfile.selectState'))}
              </Text>
              <Text style={styles.chevron}>▼</Text>
            </Pressable>

            <Text style={[styles.label,{
              marginTop: hp(1),
            }]}>
              {t('completeProfile.city')}
              <Text style={styles.req}>*</Text>
            </Text>
            <Pressable
              style={[styles.selectBox, styles.fieldTight]}
              onPress={() => {
                if (!stateName || isLoadingCities || cityOptions.length === 0) {
                  return;
                }
                setModal({ kind: 'city' });
              }}
            >
              <Text
                style={[
                  styles.selectText,
                  !city && styles.selectPlaceholder,
                ]}
                numberOfLines={1}
              >
                {city ||
                  (stateName
                    ? isLoadingCities
                      ? 'Loading cities...'
                      : t('completeProfile.selectCity')
                    : `${t('completeProfile.selectState')} ${t('common.and')} ${t('completeProfile.selectCity')}`)}
              </Text>
              <Text style={styles.chevron}>▼</Text>
            </Pressable>

            <AppButton
              title={t('completeProfile.submitRegistration')}
              onPress={onSubmit}
              loading={isSubmitting}
              disabled={isSubmitting}
              containerStyle={styles.submitBtn}
            />

            <Pressable onPress={onReturnToLogin} style={styles.loginLinkWrap}>
              <Text style={styles.loginLink}>
                {t('completeProfile.returnToLogin')}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <MultiSelectModal
        visible={modal.kind === 'skills'}
        title={t('completeProfile.selectSkills')}
        options={SKILL_OPTIONS}
        selectedValues={selectedSkills}
        onToggleValue={toggleSkillValue}
        onClose={closeModal}
      />
      <MultiSelectModal
        visible={modal.kind === 'speciality'}
        title={t('completeProfile.selectSpeciality')}
        options={SPECIALITY_OPTIONS}
        selectedValues={selectedSpecialities}
        onToggleValue={toggleSpecialityValue}
        onClose={closeModal}
      />
      <MultiSelectModal
        visible={modal.kind === 'languages'}
        title={t('completeProfile.selectLanguage')}
        options={LANGUAGE_OPTIONS}
        selectedValues={selectedLanguages}
        onToggleValue={toggleLanguageValue}
        onClose={closeModal}
      />
      {modalConfig ? (
        <SelectModal
          visible={
            Boolean(modal.kind) &&
            modal.kind !== 'skills' &&
            modal.kind !== 'speciality' &&
            modal.kind !== 'languages'
          }
          title={modalConfig.title}
          options={modalConfig.options}
          onSelect={modalConfig.onSelect}
          onClose={closeModal}
        />
      ) : null}

      {Platform.OS === 'ios' ? (
        <Modal
          visible={isDobPickerVisible}
          transparent
          animationType="fade"
          onRequestClose={closeDobPicker}
        >
          <Pressable style={modalStyles.overlay} onPress={closeDobPicker}>
            <Pressable style={modalStyles.sheet} onPress={e => e.stopPropagation()}>
              <Text style={modalStyles.sheetTitle}>
                {t('completeProfile.dateOfBirth')}
              </Text>
              <DateTimePicker
                value={tempDobDate}
                mode="date"
                display="spinner"
                onChange={(_, selectedDate) => {
                  if (selectedDate) {
                    setTempDobDate(selectedDate);
                  }
                }}
                maximumDate={new Date()}
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
    </SafeAreaView>
  );
}

export const CompleteProfileScreen = memo(CompleteProfileScreenComponent);

const multiSelectStyles = StyleSheet.create({
  sheetMax: {
    maxHeight: hp(62),
  },
  list: {
    maxHeight: hp(44),
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EEE',
  },
  checkmark: {
    width: 28,
    fontSize: normalizeFont(18),
    color: colors.textPrimary,
  },
  doneWrap: {
    paddingHorizontal: wp(5),
    paddingTop: 8,
    paddingBottom: hp(1),
  },
});

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
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
    fontWeight: '700',
    color: colors.textPrimary,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E0E0',
  },
  optionRow: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EEE',
  },
  optionText: {
    fontSize: normalizeFont(16),
    color: colors.textPrimary,
  },
});

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: hp(4),
  },
  header: {
    backgroundColor: HEADER_BG,
    paddingTop: hp(1),
    paddingHorizontal: wp(6),
    paddingBottom: hp(10),
    alignItems: 'center',
    overflow: 'visible',
  },
  headerPattern: {
    opacity: 0.35,
    resizeMode: 'cover',
  },
  headerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(59, 22, 22, 0.9)',
  },
  headline: {
    textAlign: 'center',
    color: '#FFFBF5',
    fontSize: normalizeFont(19),
    lineHeight: 28,
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    fontWeight: '400',
    zIndex: 1,
    paddingHorizontal: wp(4),
  },
  avatarWrap: {
    position: 'absolute',
    bottom: -hp(7),
    alignSelf: 'center',
    zIndex: 2,
  },
  avatarRing: {
    width: wp(28),
    height: wp(28),
    borderRadius: wp(14),
    backgroundColor: CREAM,
    borderWidth: 3,
    borderColor: '#E8D4C4',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: {
    width: '88%',
    height: '88%',
  },
  cameraBadge: {
    position: 'absolute',
    right: 0,
    bottom: 4,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#5C3D2E',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: CREAM,
  },
  cameraIcon: {
    fontSize: 16,
  },
  card: {
    marginTop: hp(8),
    marginHorizontal: wp(3),
    backgroundColor: CREAM,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E8DED4',
    paddingHorizontal: wp(4),
    paddingTop: hp(3),
    paddingBottom: hp(3),
  },
  uploadLabel: {
    textAlign: 'center',
    color: LABEL_BROWN,
    fontSize: normalizeFont(15),
    fontWeight: '600',
    marginBottom: hp(1.5),
  },
  previewText: {
    textAlign: 'center',
    color: '#2E6A36',
    fontSize: normalizeFont(12),
    marginBottom: hp(1.2),
    fontWeight: '600',
  },
  req: {
    color: colors.error,
  },
  field: {
    marginBottom: 14,
  },
  fieldTight: {
    marginBottom: 0,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 1,
    alignItems: 'flex-start',
    marginTop: hp(2),
  },
  half: {
    flex: 1,
  },
  halfLeft: {
    marginRight: 6,
  },
  halfRight: {
    marginLeft: 6,
  },
  label: {
    fontSize: normalizeFont(36 / 3),
    color: colors.textPrimary,
    marginBottom: 10,
  },
  inputBox: {
    borderColor: INPUT_BORDER,
    borderRadius: 12,
    backgroundColor: '#FFFCF7',
  },
  multilineInput: {
    minHeight: 88,
    alignItems: 'flex-start',
    paddingVertical: 10,
  },
  inputDisabled: {
    opacity: 0.85,
  },
  selectBox: {
    height: 56,
    borderWidth: 1,
    borderColor: INPUT_BORDER,
    borderRadius: 12,
    backgroundColor: '#FFFCF7',
    flexDirection: 'row',
    alignItems: 'center',
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
    flexDirection: 'row',
    justifyContent: 'flex-end',
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
    borderColor: '#D8CFCF',
    backgroundColor: '#FAF6F1',
  },
  dobActionText: {
    color: colors.textPrimary,
    fontSize: normalizeFont(14),
    fontWeight: '600',
  },
  submitBtn: {
    marginTop: hp(2),
    borderRadius: 14,
    height: 52,
    backgroundColor: HEADER_BG,
  },
  loginLinkWrap: {
    marginTop: hp(2),
    alignItems: 'center',
    paddingVertical: 8,
  },
  loginLink: {
    color: LABEL_BROWN,
    fontSize: normalizeFont(15),
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
