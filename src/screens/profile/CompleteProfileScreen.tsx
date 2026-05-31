import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { CommonActions, useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { memo, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
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
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { images } from '../../assets/images';
import { AppButton } from '../../components/common/AppButton';
import { AppHeader } from '../../components/common/AppHeader';
import { AppInput } from '../../components/common/AppInput';
import { AppLoader } from '../../components/common/AppLoader';
import { PhotoSourcePickerModal } from '../../components/common/PhotoSourcePickerModal';
import { colors } from '../../constants/colors';
import { useTranslation } from '../../localization/useTranslation';
import { AuthStackParamList, ProfileStackParamList } from '../../navigation/types';
import {
  astroApi,
  getAstroProfileFromGetProfileResponse,
  type AstroProfile,
} from '../../services/api/astroApi';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  applyAuthGate,
  decodeMobileFromToken,
  logout,
} from '../../store/slices/authSlice';
import {
  pickPhotoFromCamera,
  pickPhotoFromGallery,
  runAfterModalDismiss,
  type PickedImage,
} from '../../utils/photoPicker';
import { hp, normalizeFont, wp } from '../../utils/responsive';

type Props =
  | NativeStackScreenProps<AuthStackParamList, 'CompleteProfile'>
  | NativeStackScreenProps<ProfileStackParamList, 'EditProfile'>;

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
  { value: 'palmistry', label: 'Palmistry' },
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

  if (normalized.includes('T') || /^\d{4}-\d{2}-\d{2}/.test(normalized)) {
    const isoDate = new Date(normalized);
    if (!Number.isNaN(isoDate.getTime())) {
      return isoDate;
    }
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

const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const ACCOUNT_NUMBER_REGEX = /^\d{9,18}$/;
const ACCOUNT_HOLDER_NAME_REGEX = /^[A-Za-z][A-Za-z\s.'-]{1,79}$/;

type LocalImageRef = string | PickedImage | null | undefined;

const resolveLocalImage = (
  ref: LocalImageRef,
): { uri: string; fileName: string; type: string } | null => {
  if (!ref) {
    return null;
  }
  if (typeof ref === 'string') {
    const trimmed = ref.trim();
    if (!trimmed || trimmed.toLowerCase().startsWith('http')) {
      return null;
    }
    const fileName = trimmed.split('/').pop() || `image-${Date.now()}.jpg`;
    return { uri: trimmed, fileName, type: 'image/jpeg' };
  }
  const trimmed = ref.uri?.trim();
  if (!trimmed || trimmed.toLowerCase().startsWith('http')) {
    return null;
  }
  return {
    uri: trimmed,
    fileName: ref.fileName,
    type: ref.type,
  };
};

const appendLocalImageToFormData = (
  formData: FormData,
  fieldName: string,
  ref: LocalImageRef,
) => {
  const file = resolveLocalImage(ref);
  if (!file) {
    return;
  }
  formData.append(fieldName, {
    uri: file.uri,
    name: file.fileName,
    type: file.type,
  } as never);
};

const hasDocumentUri = (ref: LocalImageRef) => {
  if (!ref) {
    return false;
  }
  if (typeof ref === 'string') {
    return Boolean(ref.trim());
  }
  return Boolean(ref.uri?.trim());
};

const displayImageUri = (ref: LocalImageRef): string | null => {
  if (!ref) {
    return null;
  }
  if (typeof ref === 'string') {
    return ref;
  }
  return ref.uri;
};

type DocumentUploadFieldProps = {
  label: string;
  imageUri: LocalImageRef;
  onPressUpload: () => void;
  photoSelectedLabel: string;
};

const DocumentUploadField = memo(function DocumentUploadField({
  label,
  imageUri,
  onPressUpload,
  photoSelectedLabel,
}: DocumentUploadFieldProps) {
  const previewUri = displayImageUri(imageUri);
  return (
    <View style={docUploadStyles.wrap}>
      <Text style={docUploadStyles.label}>
        {label}
        <Text style={docUploadStyles.req}>*</Text>
      </Text>
      <Pressable
        style={docUploadStyles.uploadBox}
        onPress={onPressUpload}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        {previewUri ? (
          <Image source={{ uri: previewUri }} style={docUploadStyles.preview} />
        ) : (
          <Text style={docUploadStyles.uploadHint}>📷 {label}</Text>
        )}
      </Pressable>
      {previewUri ? (
        <Text style={docUploadStyles.selectedText}>{photoSelectedLabel}</Text>
      ) : null}
    </View>
  );
});

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

function skillApiTokenToValue(token: string): string | null {
  const trimmed = token.trim();
  if (!trimmed) {
    return null;
  }
  const tl = trimmed.toLowerCase();
  const byVal = SKILL_OPTIONS.find(
    o => o.value === trimmed || o.value.toLowerCase() === tl,
  );
  if (byVal) {
    return byVal.value;
  }
  const byLabel = SKILL_OPTIONS.find(
    o => o.label.toLowerCase() === tl || o.label === trimmed,
  );
  if (byLabel) {
    return byLabel.value;
  }
  const byPartial = SKILL_OPTIONS.find(
    o =>
      tl.includes(o.value) ||
      tl.includes(o.label.toLowerCase()) ||
      o.label.toLowerCase().includes(tl),
  );
  if (byPartial) {
    return byPartial.value;
  }
  if (tl.includes('tarot') || tl.includes('tarrot')) {
    return 'tarot';
  }
  if (tl.includes('palm')) {
    return 'palmistry';
  }
  if (tl.includes('vedic')) {
    return 'vedic';
  }
  if (tl.includes('prashna')) {
    return 'prashna';
  }
  if (tl.includes('remed')) {
    return 'remedies';
  }
  if (tl.includes('kp')) {
    return 'kp';
  }
  return null;
}

function resolveSkillsFromApi(tokens: string[]): {
  selected: string[];
  extras: { value: string; label: string }[];
} {
  const selected = new Set<string>();
  const extras: { value: string; label: string }[] = [];
  for (const token of tokens) {
    const mapped = skillApiTokenToValue(token);
    if (mapped) {
      selected.add(mapped);
      continue;
    }
    const value = `api:${token.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    selected.add(value);
    extras.push({ value, label: token.trim() });
  }
  return { selected: Array.from(selected), extras };
}

function mapSkillTokensToValues(tokens: string[]): string[] {
  return resolveSkillsFromApi(tokens).selected;
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

function CompleteProfileScreenComponent({ navigation, route }: Props) {
  const { t } = useTranslation();
  const isEditMode = route.name === 'EditProfile';
  /** Auth `CompleteProfile` has no tab bar; Profile `EditProfile` does. */
  const tabBarHeight = useContext(BottomTabBarHeightContext) ?? 0;
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const astroId = useAppSelector(state => state.auth.astroId)?.trim() || '';
  const token = useAppSelector(state => state.auth.token);
  const userEmail = useAppSelector(state => state.auth.user?.email)?.trim() || '';

  const [fullName, setFullName] = useState('');
  const [realName, setRealName] = useState('');
  const [profileMobile, setProfileMobile] = useState('');
  const [price, setPrice] = useState('6');
  const [callPrice, setCallPrice] = useState('6');
  const [videoPrice, setVideoPrice] = useState('6');
  const [profileImageUri, setProfileImageUri] = useState<LocalImageRef>(null);
  const [aadharImageUri, setAadharImageUri] = useState<LocalImageRef>(null);
  const [panImageUri, setPanImageUri] = useState<LocalImageRef>(null);
  const [passBookImageUri, setPassBookImageUri] = useState<LocalImageRef>(null);
  const [accountHolderName, setAccountHolderName] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [gender, setGender] = useState('');
  const [dob, setDob] = useState('');
  const [dobDate, setDobDate] = useState(new Date(1990, 0, 1));
  const [isDobPickerVisible, setIsDobPickerVisible] = useState(false);
  const [tempDobDate, setTempDobDate] = useState(new Date(1990, 0, 1));
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [apiSkillOptions, setApiSkillOptions] = useState<
    { value: string; label: string }[]
  >([]);
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
  const [hasLoadedProfile, setHasLoadedProfile] = useState(!isEditMode);
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
  const [photoPicker, setPhotoPicker] = useState<{
    title: string;
    onSelect: (image: LocalImageRef) => void;
  } | null>(null);

  const normalizeGenderLabel = useCallback((value?: string) => {
    const trimmed = value?.trim();
    if (!trimmed) {
      return '';
    }
    const match = GENDER_OPTIONS.find(
      option => option.toLowerCase() === trimmed.toLowerCase(),
    );
    return match ?? trimmed;
  }, []);

  const applyProfileData = useCallback((profile: AstroProfile) => {
    setFullName(profile.name?.trim() || '');
    setRealName(profile.realName?.trim() || profile.name?.trim() || '');
    setProfileMobile(profile.mobile?.trim() || '');
    if (profile.price !== undefined && profile.price !== null) {
      setPrice(String(profile.price));
    }
    if (profile.callPrice !== undefined && profile.callPrice !== null) {
      setCallPrice(String(profile.callPrice));
    }
    if (profile.videoPrice !== undefined && profile.videoPrice !== null) {
      setVideoPrice(String(profile.videoPrice));
    }
    setGender(normalizeGenderLabel(profile.gender));
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
    const resolvedSkills = resolveSkillsFromApi(skillTokens);
    setSelectedSkills(resolvedSkills.selected);
    setApiSkillOptions(resolvedSkills.extras);

    if (profile.profileImage?.trim()) {
      setProfileImageUri(profile.profileImage.trim());
    }
    if (profile.aadhar?.trim()) {
      setAadharImageUri(profile.aadhar.trim());
    }
    if (profile.pan?.trim()) {
      setPanImageUri(profile.pan.trim());
    }
    if (profile.passBookOrCancelledCheque?.trim()) {
      setPassBookImageUri(profile.passBookOrCancelledCheque.trim());
    }
    setAccountHolderName(profile.accountHolderName?.trim() || '');
    setBankName(profile.bankName?.trim() || '');
    setAccountNumber(profile.accountNumber?.trim() || '');
    setIfscCode(profile.ifscCode?.trim().toUpperCase() || '');

    const parsedDob = parseApiDob(profile.dob);
    if (parsedDob) {
      setDobDate(parsedDob);
      setDob(formatDateAsDdMmYy(parsedDob));
    }
  }, [normalizeGenderLabel]);

  const fetchAstroProfile = useCallback(async () => {
    if (!astroId) {
      if (isEditMode) {
        Alert.alert('Error', 'Astro ID not found. Please login again.');
      }
      setHasLoadedProfile(true);
      return;
    }
    try {
      setIsLoadingProfile(true);
      const response = await astroApi.getProfile({ astroId });
      const profile = getAstroProfileFromGetProfileResponse(response);
      if (profile) {
        applyProfileData(profile);
      } else if (isEditMode) {
        Alert.alert(
          'Error',
          response.message || 'Unable to load profile data.',
        );
      }
    } catch (error) {
      if (isEditMode) {
        Alert.alert(
          'Error',
          (error as { message?: string })?.message ||
            'Unable to load profile. Please try again.',
        );
      }
    } finally {
      setIsLoadingProfile(false);
      setHasLoadedProfile(true);
    }
  }, [applyProfileData, astroId, isEditMode]);

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
    if (!isEditMode) {
      void fetchAstroProfile();
    }
  }, [fetchAstroProfile, isEditMode]);

  useFocusEffect(
    useCallback(() => {
      if (!isEditMode) {
        return;
      }
      setHasLoadedProfile(false);
      void fetchAstroProfile();
    }, [fetchAstroProfile, isEditMode]),
  );

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

  const skillOptions = useMemo(
    () => [...SKILL_OPTIONS, ...apiSkillOptions],
    [apiSkillOptions],
  );

  const skillsSummary = useMemo(
    () =>
      selectedSkills
        .map(
          v =>
            skillOptions.find(o => o.value === v)?.label ??
            v.replace(/^api:/, ''),
        )
        .join(', '),
    [selectedSkills, skillOptions],
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
    if (!fullName.trim()) {
      Alert.alert('Error', 'Please enter your full name.');
      return;
    }
    if (!gender.trim()) {
      Alert.alert('Error', 'Please select gender.');
      return;
    }
    if (!address.trim()) {
      Alert.alert('Error', 'Please enter address.');
      return;
    }
    if (!/^\d{6}$/.test(pincode.trim())) {
      Alert.alert('Error', 'Please enter a valid 6-digit pincode.');
      return;
    }
    if (!stateName.trim() || !city.trim()) {
      Alert.alert('Error', 'Please select state and city.');
      return;
    }
    if (!hasDocumentUri(profileImageUri)) {
      Alert.alert('Error', 'Please upload profile photo.');
      return;
    }
    if (!hasDocumentUri(aadharImageUri)) {
      Alert.alert('Error', 'Please upload Aadhar card photo.');
      return;
    }
    if (!hasDocumentUri(panImageUri)) {
      Alert.alert('Error', 'Please upload PAN card photo.');
      return;
    }
    if (!hasDocumentUri(passBookImageUri)) {
      Alert.alert('Error', 'Please upload passbook or cancelled cheque photo.');
      return;
    }

    const holderName = accountHolderName.trim();
    const bank = bankName.trim();
    const accountNo = accountNumber.trim();
    const ifsc = ifscCode.trim().toUpperCase();

    if (!ACCOUNT_HOLDER_NAME_REGEX.test(holderName)) {
      Alert.alert(
        'Error',
        'Please enter a valid account holder name (letters only, 2–80 characters).',
      );
      return;
    }
    if (bank.length < 2) {
      Alert.alert('Error', 'Please enter bank name.');
      return;
    }
    if (!ACCOUNT_NUMBER_REGEX.test(accountNo)) {
      Alert.alert('Error', 'Please enter a valid account number (9–18 digits).');
      return;
    }
    if (!IFSC_REGEX.test(ifsc)) {
      Alert.alert('Error', 'Please enter a valid IFSC code (e.g. SBIN0001234).');
      return;
    }

    const mobile =
      profileMobile ||
      decodeMobileFromToken(token) ||
      userEmail.match(/^(\d{10})@/)?.[1] ||
      '';
    if (!mobile) {
      Alert.alert('Error', 'Mobile number not found. Please login again.');
      return;
    }

    const payload = new FormData();

    if (isEditMode) {
      const trimmedName = fullName.trim();
      payload.append('name', trimmedName);
      payload.append('realName', realName.trim() || trimmedName);
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
      payload.append('country', country);
      payload.append('state', stateName.trim());
      payload.append('city', city.trim());
      payload.append('price', price.trim() || '6');
      payload.append('callPrice', callPrice.trim() || '6');
      payload.append('videoPrice', videoPrice.trim() || '6');
      payload.append('accountHolderName', holderName);
      payload.append('bankName', bank);
      payload.append('accountNumber', accountNo);
      payload.append('ifscCode', ifsc);
      payload.append('astroId', astroId.trim().toUpperCase());
    } else {
      const trimmedName = fullName.trim();
      payload.append('name', trimmedName);
      payload.append('realName', trimmedName);
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
      payload.append('country', country);
      payload.append('state', stateName.trim());
      payload.append('city', city.trim());
      payload.append('accountHolderName', holderName);
      payload.append('bankName', bank);
      payload.append('accountNumber', accountNo);
      payload.append('ifscCode', ifsc);
    }

    appendLocalImageToFormData(payload, 'profileImage', profileImageUri);
    appendLocalImageToFormData(payload, 'aadhar', aadharImageUri);
    appendLocalImageToFormData(payload, 'pan', panImageUri);
    appendLocalImageToFormData(
      payload,
      'passBookOrCancelledCheque',
      passBookImageUri,
    );

    try {
      setIsSubmitting(true);
      const response = isEditMode
        ? await astroApi.updateProfile(payload)
        : await astroApi.submitInitialProfile(payload);
      const success = response.status?.toLowerCase() === 'success';
      if (success && isEditMode) {
        await fetchAstroProfile();
        Alert.alert(
          t('profile.profileUpdatedTitle'),
          response.message || t('profile.profileUpdatedMessage'),
          [{ text: 'OK', onPress: () => navigation.goBack() }],
        );
        return;
      }
      if (success && !isEditMode) {
        await fetchAstroProfile();
        await dispatch(
          applyAuthGate({
            pendingProfileCompletion: false,
            pendingAdminApproval: true,
          }),
        ).unwrap();
        const authNavigation = navigation as NativeStackScreenProps<
          AuthStackParamList,
          'CompleteProfile'
        >['navigation'];
        authNavigation.replace('PendingApproval');
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
    aadharImageUri,
    accountHolderName,
    accountNumber,
    address,
    astroId,
    bankName,
    city,
    description,
    dobDate,
    experience,
    fullName,
    realName,
    price,
    callPrice,
    videoPrice,
    gender,
    ifscCode,
    selectedLanguages,
    panImageUri,
    passBookImageUri,
    pincode,
    profileMobile,
    profileImageUri,
    selectedSkills,
    skillOptions,
    selectedSpecialities,
    stateName,
    t,
    token,
    userEmail,
    fetchAstroProfile,
    isEditMode,
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

  const closePhotoPicker = useCallback(() => {
    setPhotoPicker(null);
  }, []);

  const openDocumentPicker = useCallback(
    (title: string, onImageSelected: (image: LocalImageRef) => void) => {
      setPhotoPicker({ title, onSelect: onImageSelected });
    },
    [],
  );

  const onPhotoPickerCamera = useCallback(() => {
    const picker = photoPicker;
    closePhotoPicker();
    if (!picker) {
      return;
    }
    runAfterModalDismiss(() => {
      void (async () => {
        const picked = await pickPhotoFromCamera();
        if (picked) {
          picker.onSelect(picked);
        }
      })();
    });
  }, [closePhotoPicker, photoPicker]);

  const onPhotoPickerGallery = useCallback(() => {
    const picker = photoPicker;
    closePhotoPicker();
    if (!picker) {
      return;
    }
    runAfterModalDismiss(() => {
      void (async () => {
        const picked = await pickPhotoFromGallery();
        if (picked) {
          picker.onSelect(picked);
        }
      })();
    });
  }, [closePhotoPicker, photoPicker]);

  const onUploadProfilePhoto = useCallback(() => {
    openDocumentPicker(t('completeProfile.uploadPhoto'), setProfileImageUri);
  }, [openDocumentPicker, t]);

  const onUploadAadhar = useCallback(() => {
    openDocumentPicker(t('completeProfile.uploadAadhar'), setAadharImageUri);
  }, [openDocumentPicker, t]);

  const onUploadPan = useCallback(() => {
    openDocumentPicker(t('completeProfile.uploadPan'), setPanImageUri);
  }, [openDocumentPicker, t]);

  const onUploadPassbook = useCallback(() => {
    openDocumentPicker(
      t('completeProfile.uploadPassbook'),
      setPassBookImageUri,
    );
  }, [openDocumentPicker, t]);
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

  const fallbackTabBarHeight = 72;
  const effectiveTabBarHeight =
    tabBarHeight > 0 ? tabBarHeight : fallbackTabBarHeight;
  const editScrollBottomPadding =
    effectiveTabBarHeight + insets.bottom + 48;

  return (
    <SafeAreaView
      style={styles.safe}
      edges={isEditMode ? ['bottom', 'left', 'right'] : ['top', 'left', 'right']}
    >
      {isEditMode ? (
        <AppHeader
          title={t('profile.editProfile')}
          showBack
          onBackPress={() => navigation.goBack()}
        />
      ) : null}
      {isEditMode && (isLoadingProfile || !hasLoadedProfile) ? (
        <AppLoader />
      ) : (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          bounces={false}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            isEditMode && { paddingBottom: editScrollBottomPadding },
          ]}
        >
          {isEditMode ? (
            <>
              <Text style={styles.editHeadline}>{t('profile.editProfileHeadline')}</Text>
              <View style={styles.editAvatarSection}>
                <View style={styles.avatarRing}>
                  <Image
                    source={
                      displayImageUri(profileImageUri)
                        ? { uri: displayImageUri(profileImageUri)! }
                        : images.logo
                    }
                    style={styles.avatarImg}
                    resizeMode={displayImageUri(profileImageUri) ? 'cover' : 'contain'}
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
            </>
          ) : (
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
                      displayImageUri(profileImageUri)
                        ? { uri: displayImageUri(profileImageUri)! }
                        : images.logo
                    }
                    style={styles.avatarImg}
                    resizeMode={displayImageUri(profileImageUri) ? 'cover' : 'contain'}
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
          )}

          <View style={[styles.card, isEditMode && styles.cardEditMode]}>
            {!isEditMode ? (
              <Text style={styles.uploadLabel}>
                {t('completeProfile.uploadPhoto')}
                <Text style={styles.req}>*</Text>
              </Text>
            ) : null}
            {isLoadingProfile ? (
              <Text style={styles.previewText}>Loading profile...</Text>
            ) : null}
            {!isEditMode && profileImageUri ? (
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

            <Text style={styles.sectionTitle}>
              {t('completeProfile.bankDetails')}
            </Text>

            <AppInput
              label={t('completeProfile.accountHolderName')}
              required
              value={accountHolderName}
              onChangeText={setAccountHolderName}
              placeholder={t('completeProfile.enterAccountHolderName')}
              autoCapitalize="words"
              wrapperStyle={styles.field}
              inputContainerStyle={styles.inputBox}
            />

            <AppInput
              label={t('completeProfile.bankName')}
              required
              value={bankName}
              onChangeText={setBankName}
              placeholder={t('completeProfile.enterBankName')}
              autoCapitalize="words"
              wrapperStyle={styles.field}
              inputContainerStyle={styles.inputBox}
            />

            <View style={styles.row}>
              <View style={[styles.half, styles.halfLeft]}>
                <AppInput
                  label={t('completeProfile.accountNumber')}
                  required
                  value={accountNumber}
                  onChangeText={value =>
                    setAccountNumber(value.replace(/\D/g, ''))
                  }
                  placeholder={t('completeProfile.enterAccountNumber')}
                  keyboardType="number-pad"
                  maxLength={18}
                  wrapperStyle={styles.field}
                  inputContainerStyle={styles.inputBox}
                />
              </View>
              <View style={[styles.half, styles.halfRight]}>
                <AppInput
                  label={t('completeProfile.ifscCode')}
                  required
                  value={ifscCode}
                  onChangeText={value =>
                    setIfscCode(value.replace(/\s/g, '').toUpperCase())
                  }
                  placeholder={t('completeProfile.enterIfscCode')}
                  autoCapitalize="characters"
                  maxLength={11}
                  wrapperStyle={styles.field}
                  inputContainerStyle={styles.inputBox}
                />
              </View>
            </View>

            <Text style={styles.sectionTitle}>
              {t('completeProfile.kycDocuments')}
            </Text>

            <DocumentUploadField
              label={t('completeProfile.uploadAadhar')}
              imageUri={aadharImageUri}
              onPressUpload={onUploadAadhar}
              photoSelectedLabel={t('completeProfile.photoSelected')}
            />
            <DocumentUploadField
              label={t('completeProfile.uploadPan')}
              imageUri={panImageUri}
              onPressUpload={onUploadPan}
              photoSelectedLabel={t('completeProfile.photoSelected')}
            />
            <DocumentUploadField
              label={t('completeProfile.uploadPassbook')}
              imageUri={passBookImageUri}
              onPressUpload={onUploadPassbook}
              photoSelectedLabel={t('completeProfile.photoSelected')}
            />

            <AppButton
              title={
                isEditMode
                  ? t('profile.updateProfile')
                  : t('completeProfile.submitRegistration')
              }
              onPress={onSubmit}
              loading={isSubmitting || isLoadingProfile}
              disabled={isSubmitting || isLoadingProfile}
              containerStyle={styles.submitBtn}
            />

            {!isEditMode ? (
              <Pressable onPress={onReturnToLogin} style={styles.loginLinkWrap}>
                <Text style={styles.loginLink}>
                  {t('completeProfile.returnToLogin')}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      )}

      <PhotoSourcePickerModal
        visible={photoPicker != null}
        title={photoPicker?.title ?? ''}
        onClose={closePhotoPicker}
        onCamera={onPhotoPickerCamera}
        onGallery={onPhotoPickerGallery}
      />

      <MultiSelectModal
        visible={modal.kind === 'skills'}
        title={t('completeProfile.selectSkills')}
        options={skillOptions}
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
  editHeadline: {
    textAlign: 'center',
    color: LABEL_BROWN,
    fontSize: normalizeFont(16),
    lineHeight: 22,
    fontWeight: '600',
    paddingHorizontal: wp(4),
    paddingTop: hp(1.5),
    paddingBottom: hp(0.5),
  },
  editAvatarSection: {
    alignSelf: 'center',
    marginBottom: hp(1),
    marginTop: hp(0.5),
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
  cardEditMode: {
    marginTop: hp(1),
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
  sectionTitle: {
    marginTop: hp(2.5),
    marginBottom: hp(1),
    fontSize: normalizeFont(16),
    fontWeight: '700',
    color: LABEL_BROWN,
  },
});

const docUploadStyles = StyleSheet.create({
  wrap: {
    marginBottom: 14,
  },
  label: {
    fontSize: normalizeFont(14),
    color: colors.textPrimary,
    marginBottom: 8,
    fontWeight: '600',
  },
  req: {
    color: colors.error,
  },
  uploadBox: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: INPUT_BORDER,
    borderRadius: 12,
    backgroundColor: '#FFFCF7',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  uploadHint: {
    fontSize: normalizeFont(14),
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  preview: {
    width: '100%',
    height: 160,
    resizeMode: 'cover',
  },
  selectedText: {
    marginTop: 6,
    color: '#2E6A36',
    fontSize: normalizeFont(12),
    fontWeight: '600',
  },
});
