import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import messaging from '@react-native-firebase/messaging';
import type { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import { useEffect, useState } from 'react';
import {
  AppState,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type AppStateStatus,
} from 'react-native';
import { AuthNavigator } from './AuthNavigator';
import { MainTabNavigator } from './MainTabNavigator';
import { attachDeviceToUser } from '../services/device/registerDevice';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { bootstrapAuth, decodeAstroIdFromToken } from '../store/slices/authSlice';
import { bootstrapLanguage } from '../store/slices/languageSlice';
import { syncSocketSession } from '../store/slices/socketSlice';
import { AppLoader } from '../components/common/AppLoader';
import {
  checkForAppUpdate,
  type UpdateDecision,
} from '../services/update/appUpdateService';
import {
  flushPendingWaitlistFcmNavigation,
  handleIncomingFcm,
} from '../services/push/incomingChatFromFcm';
import { navigationRef } from './navigationRef';

const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: 'transparent',
    card: 'transparent',
  },
};

export function RootNavigator() {
  const dispatch = useAppDispatch();
  const {
    isAuthenticated,
    isBootstrapping,
    pendingProfileCompletion,
    pendingAdminApproval,
  } = useAppSelector(state => state.auth);
  const canEnterMainApp =
    isAuthenticated &&
    !pendingProfileCompletion &&
    !pendingAdminApproval;
  const isLanguageBootstrapping = useAppSelector(
    state => state.language.isBootstrapping,
  );
  const token = useAppSelector(state => state.auth.token);
  const astroId = useAppSelector(state => state.auth.astroId);

  const [appState, setAppState] = useState<AppStateStatus>(() =>
    AppState.currentState,
  );
  const [updateDecision, setUpdateDecision] = useState<UpdateDecision | null>(null);
  const [optionalPromptShown, setOptionalPromptShown] = useState(false);

  useEffect(() => {
    const sub = AppState.addEventListener('change', nextState => {
      setAppState(nextState);
    });
    return () => sub.remove();
  }, []);

  const isAppForeground = appState === 'active';

  useEffect(() => {
    dispatch(bootstrapAuth());
    dispatch(bootstrapLanguage());
  }, [dispatch]);

  useEffect(() => {
    let active = true;
    const run = async () => {
      try {
        const decision = await checkForAppUpdate();
        if (!active) return;
        setUpdateDecision(decision);
      } catch {
        // Non-blocking: app should work even if config fetch fails.
      }
    };
    run();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!canEnterMainApp || !token) {
      return;
    }
    const attachAstroId = astroId?.trim() || decodeAstroIdFromToken(token) || '';
    if (!attachAstroId) {
      return;
    }
    void attachDeviceToUser({ authToken: token, astroId: attachAstroId });
  }, [canEnterMainApp, token, astroId]);

  useEffect(() => {
    const resolvedAstroId = astroId?.trim() || decodeAstroIdFromToken(token) || '';
    if (token && resolvedAstroId && isAppForeground) {
      dispatch(
        syncSocketSession({
          authToken: token,
          astroId: resolvedAstroId,
          reason: 'connect-ready',
        }),
      );
    } else {
      const reason = !token
        ? 'no-auth-token'
        : !resolvedAstroId
          ? 'no-astro-id'
          : !isAppForeground
            ? 'app-background'
            : 'disconnect-fallback';
      dispatch(syncSocketSession({ authToken: null, reason }));
    }
  }, [token, isAppForeground, astroId, dispatch]);

  const onOpenStore = () => {
    const url = updateDecision?.storeUrl;
    if (!url) return;
    void Linking.openURL(url);
  };

  useEffect(() => {
    if (!updateDecision || updateDecision.mode !== 'optional' || optionalPromptShown) {
      return;
    }
    setOptionalPromptShown(true);
  }, [optionalPromptShown, updateDecision]);

  /** FCM: incoming chat OR waitlist tab (matches backend waitlist_update payload). */
  useEffect(() => {
    if (isBootstrapping || isLanguageBootstrapping) {
      return;
    }

    const onRemote = (
      remoteMessage: FirebaseMessagingTypes.RemoteMessage | null | undefined,
    ) => {
      if (!remoteMessage) return;
      handleIncomingFcm(dispatch, remoteMessage, canEnterMainApp);
    };

    const unsubOpened = messaging().onNotificationOpenedApp(remoteMessage => {
      onRemote(remoteMessage);
    });

    const unsubForeground = messaging().onMessage(remoteMessage => {
      onRemote(remoteMessage);
    });

    void messaging()
      .getInitialNotification()
      .then(remoteMessage => {
        onRemote(remoteMessage ?? undefined);
      });

    return () => {
      unsubOpened();
      unsubForeground();
    };
  }, [dispatch, isBootstrapping, isLanguageBootstrapping, canEnterMainApp]);

  useEffect(() => {
    flushPendingWaitlistFcmNavigation(canEnterMainApp);
  }, [canEnterMainApp]);

  if (isBootstrapping || isLanguageBootstrapping) {
    return <AppLoader />;
  }

  return (
    <>
      <NavigationContainer ref={navigationRef} theme={navigationTheme}>
        {canEnterMainApp ? <MainTabNavigator /> : <AuthNavigator />}
      </NavigationContainer>

      {updateDecision?.mode === 'optional' && optionalPromptShown ? (
        <Modal transparent animationType="fade" visible>
          <View style={styles.overlay}>
            <View style={styles.card}>
              <Text style={styles.title}>{updateDecision.title}</Text>
              <Text style={styles.message}>{updateDecision.message}</Text>
              <View style={styles.actions}>
                <Pressable
                  onPress={() => setOptionalPromptShown(false)}
                  style={[styles.button, styles.laterButton]}
                >
                  <Text style={styles.laterText}>Later</Text>
                </Pressable>
                <Pressable onPress={onOpenStore} style={[styles.button, styles.updateButton]}>
                  <Text style={styles.updateText}>Update</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}

      {updateDecision?.mode === 'force' ? (
        <Modal transparent animationType="fade" visible>
          <View style={styles.overlay}>
            <View style={styles.card}>
              <Text style={styles.title}>{updateDecision.title}</Text>
              <Text style={styles.message}>{updateDecision.message}</Text>
              <Pressable onPress={onOpenStore} style={[styles.button, styles.updateButton]}>
                <Text style={styles.updateText}>Update Now</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 18,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E1E1E',
  },
  message: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 20,
    color: '#3A3A3A',
  },
  actions: {
    marginTop: 18,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  button: {
    minWidth: 94,
    alignItems: 'center',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  laterButton: {
    backgroundColor: '#EFEFEF',
  },
  updateButton: {
    backgroundColor: '#632B27',
  },
  laterText: {
    fontWeight: '600',
    color: '#444444',
  },
  updateText: {
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
