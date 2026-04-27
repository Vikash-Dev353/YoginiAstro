import remoteConfig from '@react-native-firebase/remote-config';
import DeviceInfo from 'react-native-device-info';
import { Platform } from 'react-native';

export type UpdateMode = 'none' | 'optional' | 'force';

export type UpdateDecision = {
  enabled: boolean;
  mode: UpdateMode;
  currentVersion: string;
  minVersion: string;
  latestVersion: string;
  title: string;
  message: string;
  storeUrl: string;
};

function normalizeVersion(version: string): number[] {
  return version
    .split('.')
    .map(part => Number(part.replace(/\D/g, '')))
    .filter(part => Number.isFinite(part));
}

/** Returns: -1 if a<b, 0 if equal, 1 if a>b */
function compareVersions(a: string, b: string): number {
  const va = normalizeVersion(a);
  const vb = normalizeVersion(b);
  const len = Math.max(va.length, vb.length);
  for (let i = 0; i < len; i += 1) {
    const aa = va[i] ?? 0;
    const bb = vb[i] ?? 0;
    if (aa < bb) return -1;
    if (aa > bb) return 1;
  }
  return 0;
}

function normalizeMode(mode: string): UpdateMode {
  const m = mode.trim().toLowerCase();
  if (m === 'force' || m === 'mandatory') return 'force';
  if (m === 'optional' || m === 'soft') return 'optional';
  return 'none';
}

function defaultStoreUrl(): string {
  if (Platform.OS === 'android') {
    const packageName = DeviceInfo.getBundleId();
    return `https://play.google.com/store/apps/details?id=${packageName}`;
  }
  return 'https://apps.apple.com';
}

export async function checkForAppUpdate(): Promise<UpdateDecision> {
  const currentVersion = DeviceInfo.getVersion();

  await remoteConfig().setDefaults({
    app_update_enabled: 'false',
    app_update_mode: 'none',
    app_min_version: currentVersion,
    app_latest_version: currentVersion,
    app_update_title: 'Update available',
    app_update_message:
      'A new version of the app is available. Please update for the best experience.',
    app_store_android_url: '',
    app_store_ios_url: '',
  });

  await remoteConfig().setConfigSettings({
    minimumFetchIntervalMillis: __DEV__ ? 0 : 5 * 60 * 1000,
  });

  await remoteConfig().fetchAndActivate();

  const enabled = remoteConfig().getBoolean('app_update_enabled');
  const configuredMode = normalizeMode(
    remoteConfig().getValue('app_update_mode').asString(),
  );
  const minVersion = remoteConfig().getValue('app_min_version').asString().trim();
  const latestVersion = remoteConfig()
    .getValue('app_latest_version')
    .asString()
    .trim();
  const title =
    remoteConfig().getValue('app_update_title').asString().trim() ||
    'Update available';
  const message =
    remoteConfig().getValue('app_update_message').asString().trim() ||
    'A new version of the app is available.';

  const configuredStoreUrl =
    Platform.OS === 'android'
      ? remoteConfig().getValue('app_store_android_url').asString().trim()
      : remoteConfig().getValue('app_store_ios_url').asString().trim();
  const storeUrl = configuredStoreUrl || defaultStoreUrl();

  let mode: UpdateMode = 'none';
  if (enabled) {
    if (minVersion && compareVersions(currentVersion, minVersion) < 0) {
      mode = 'force';
    } else if (latestVersion && compareVersions(currentVersion, latestVersion) < 0) {
      mode = configuredMode === 'none' ? 'optional' : configuredMode;
    }
  }

  return {
    enabled,
    mode,
    currentVersion,
    minVersion,
    latestVersion,
    title,
    message,
    storeUrl,
  };
}
