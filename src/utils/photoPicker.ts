import {
  Alert,
  InteractionManager,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import {
  launchCamera,
  launchImageLibrary,
  type Asset,
  type CameraOptions,
  type ImageLibraryOptions,
} from 'react-native-image-picker';

export type PickedImage = {
  uri: string;
  fileName: string;
  type: string;
};

const CAMERA_OPTIONS: CameraOptions = {
  mediaType: 'photo',
  cameraType: 'back',
  quality: 0.9,
  saveToPhotos: false,
  includeBase64: false,
  presentationStyle: 'fullScreen',
};

const GALLERY_OPTIONS: ImageLibraryOptions = {
  mediaType: 'photo',
  quality: 0.9,
  selectionLimit: 1,
  includeBase64: false,
};

export async function requestCameraPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }
  const granted = await PermissionsAndroid.check(
    PermissionsAndroid.PERMISSIONS.CAMERA,
  );
  if (granted) {
    return true;
  }
  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.CAMERA,
  );
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

export async function requestGalleryPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }
  const permission =
    Number(Platform.Version) >= 33
      ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES
      : PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;

  const granted = await PermissionsAndroid.check(permission);
  if (granted) {
    return true;
  }
  const result = await PermissionsAndroid.request(permission);
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

function assetToPickedImage(asset: Asset | undefined): PickedImage | null {
  const rawUri = asset?.uri?.trim();
  if (!rawUri) {
    return null;
  }

  const uri =
    Platform.OS === 'android' && !rawUri.startsWith('file://') && !rawUri.startsWith('content://')
      ? `file://${rawUri}`
      : rawUri;

  const fileName =
    asset?.fileName?.trim() ||
    `capture-${Date.now()}.${asset?.type?.includes('png') ? 'png' : 'jpg'}`;
  const type = asset?.type?.trim() || 'image/jpeg';

  return { uri, fileName, type };
}

function showPickerError(message?: string) {
  Alert.alert('Error', message?.trim() || 'Unable to pick image.');
}

export async function pickPhotoFromCamera(): Promise<PickedImage | null> {
  const permitted = await requestCameraPermission();
  if (!permitted) {
    Alert.alert(
      'Permission Required',
      'Camera permission is required to capture photo.',
    );
    return null;
  }

  try {
    const result = await launchCamera(CAMERA_OPTIONS);
    if (result.didCancel) {
      return null;
    }
    if (result.errorCode || result.errorMessage) {
      showPickerError(result.errorMessage);
      return null;
    }
    return assetToPickedImage(result.assets?.[0]);
  } catch (error) {
    showPickerError((error as Error)?.message);
    return null;
  }
}

export async function pickPhotoFromGallery(): Promise<PickedImage | null> {
  const permitted = await requestGalleryPermission();
  if (!permitted) {
    Alert.alert(
      'Permission Required',
      'Gallery permission is required to choose photo.',
    );
    return null;
  }

  try {
    const result = await launchImageLibrary(GALLERY_OPTIONS);
    if (result.didCancel) {
      return null;
    }
    if (result.errorCode || result.errorMessage) {
      showPickerError(result.errorMessage);
      return null;
    }
    return assetToPickedImage(result.assets?.[0]);
  } catch (error) {
    showPickerError((error as Error)?.message);
    return null;
  }
}

/** Wait for bottom-sheet modal to finish closing before opening camera/gallery. */
export function runAfterModalDismiss(action: () => void): void {
  InteractionManager.runAfterInteractions(() => {
    const delayMs = Platform.OS === 'android' ? 350 : 120;
    setTimeout(action, delayMs);
  });
}

export function pickedImageToFormDataFile(picked: PickedImage) {
  return {
    uri: picked.uri,
    name: picked.fileName,
    type: picked.type,
  } as const;
}
