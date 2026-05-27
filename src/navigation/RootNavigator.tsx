import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import messaging from '@react-native-firebase/messaging';
import type { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import notifee, { EventType } from '@notifee/react-native';
import { useCallback, useEffect, useState } from 'react';
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
import { CustomIncomingNotificationScreen } from '../components/push/CustomIncomingNotificationScreen';
import { foregroundIncomingOverlayActiveRef } from '../services/push/foregroundIncomingOverlay';
import {
  flushPendingWaitlistFcmNavigation,
  flattenNotificationData,
  getIncomingChatParamsFromData,
  handleIncomingChatNotificationOpen,
  handleIncomingFcm,
} from '../services/push/incomingChatFromFcm';
import { fcmTrace } from '../services/push/fcmDebug';
import { captureFcmMessage } from '../services/push/fcmInspector';
import {
  cancelIncomingChatNotifications,
  initializeLocalNotifications,
  showLocalNotificationFromRemoteMessage,
} from '../services/push/notificationDisplay';
import {
  acceptIncomingChatFromPush,
  flushPendingIncomingChatAccept,
  rejectIncomingChatFromPush,
} from '../services/push/incomingChatAcceptFlow';
import {
  clearPendingIncomingChat,
  setPendingIncomingChat,
} from '../services/push/pendingIncomingChat';
import { startIncomingChatOverlayProbe } from '../services/push/incomingChatOverlayProbe';
import {
  startIncomingChatNative,
  stopIncomingChatNative,
  subscribeIncomingChatIntent,
} from '../services/push/incomingChatNative';
import { navigationRef } from './navigationRef';
import type { OrderStackParamList } from './types';

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
  const [incomingChatOverlay, setIncomingChatOverlay] = useState<
    OrderStackParamList['IncomingChatRequest'] | null
  >(null);

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
    void initializeLocalNotifications();
  }, []);

  const showIncomingOverlay = useCallback(
    (params: OrderStackParamList['IncomingChatRequest'], source: string) => {
      fcmTrace('RootNavigator: show incoming overlay ←', source, 'room=', params.roomId);
      void cancelIncomingChatNotifications();
      void stopIncomingChatNative();
      foregroundIncomingOverlayActiveRef.current = true;
      setIncomingChatOverlay(params);
    },
    [],
  );

  /**
   * Killed / cold start: intent extras + AsyncStorage are often ready only after
   * several frames. Retry until we can show the custom Accept/Reject screen.
   */
  useEffect(() => {
    const probeEnabled =
      isAppForeground &&
      !isLanguageBootstrapping &&
      (canEnterMainApp || isBootstrapping) &&
      !incomingChatOverlay;

    if (!probeEnabled) {
      return;
    }

    return startIncomingChatOverlayProbe(
      launch => {
        if (!launch.params) {
          return;
        }
        if (launch.decision === 'accept' && canEnterMainApp) {
          fcmTrace('RootNavigator: probe → accept → ConsultationChat');
          void cancelIncomingChatNotifications();
          void stopIncomingChatNative();
          foregroundIncomingOverlayActiveRef.current = false;
          setIncomingChatOverlay(null);
          acceptIncomingChatFromPush(dispatch, launch.params);
          return;
        }
        if (launch.decision === 'reject' && canEnterMainApp) {
          void cancelIncomingChatNotifications();
          void stopIncomingChatNative();
          rejectIncomingChatFromPush(dispatch, launch.params);
          return;
        }
        showIncomingOverlay(launch.params, 'probe');
      },
      { maxAttempts: 30, intervalMs: 400 },
    );
  }, [
    canEnterMainApp,
    dispatch,
    incomingChatOverlay,
    isAppForeground,
    isBootstrapping,
    isLanguageBootstrapping,
    showIncomingOverlay,
  ]);

  /**
   * MainActivity is `singleTask`, so when the service launches it while the
   * app is already running we get `onNewIntent` (proxied via DeviceEventEmitter
   * from `IncomingChatModule`). Pop the overlay live without remount.
   */
  useEffect(() => {
    if (!canEnterMainApp) return;
    const sub = subscribeIncomingChatIntent(params => {
      fcmTrace(
        'RootNavigator: native onNewIntent overlay → room=',
        params.roomId,
      );
      void cancelIncomingChatNotifications();
      void stopIncomingChatNative();
      foregroundIncomingOverlayActiveRef.current = true;
      showIncomingOverlay(params, 'native-intent');
    });
    return () => sub?.remove();
  }, [canEnterMainApp, showIncomingOverlay]);

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

  const onIncomingOverlayAccept = useCallback(
    (p: OrderStackParamList['IncomingChatRequest']) => {
      foregroundIncomingOverlayActiveRef.current = false;
      setIncomingChatOverlay(null);
      void cancelIncomingChatNotifications();
      void clearPendingIncomingChat();
      void stopIncomingChatNative();
      acceptIncomingChatFromPush(dispatch, p);
    },
    [dispatch],
  );

  const onIncomingOverlayReject = useCallback(
    (p: OrderStackParamList['IncomingChatRequest']) => {
      foregroundIncomingOverlayActiveRef.current = false;
      setIncomingChatOverlay(null);
      void cancelIncomingChatNotifications();
      void clearPendingIncomingChat();
      void stopIncomingChatNative();
      rejectIncomingChatFromPush(dispatch, p);
    },
    [dispatch],
  );

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
      source: string,
    ) => {
      if (!remoteMessage) {
        fcmTrace(`FCM handler [${source}] empty remoteMessage`);
        return;
      }
      const captured = captureFcmMessage(
        source === 'onNotificationOpenedApp'
          ? 'opened-from-tray'
          : 'initial-notification',
        remoteMessage,
      );
      fcmTrace(
        `FCM handler [${source}] messageId=`,
        remoteMessage.messageId ?? '(none)',
        'verdict=',
        captured?.verdict ?? '(none)',
      );
      const overlayParams = handleIncomingChatNotificationOpen(
        dispatch,
        remoteMessage,
        canEnterMainApp,
      );
      if (overlayParams) {
        foregroundIncomingOverlayActiveRef.current = true;
        setIncomingChatOverlay(overlayParams);
      }
    };

    const unsubOpened = messaging().onNotificationOpenedApp(remoteMessage => {
      onRemote(remoteMessage, 'onNotificationOpenedApp');
    });

    const unsubForeground = messaging().onMessage(remoteMessage => {
      const captured = captureFcmMessage('foreground', remoteMessage);
      fcmTrace(
        'FCM foreground onMessage → custom overlay / native fallback',
        'verdict=',
        captured?.verdict ?? '(none)',
      );
      void (async () => {
        const inForegroundUi = canEnterMainApp && isAppForeground;
        const overlayParams = inForegroundUi
          ? handleIncomingChatNotificationOpen(
              dispatch,
              remoteMessage,
              canEnterMainApp,
            )
          : null;

        if (overlayParams) {
          /**
           * Foreground astrologer: skip the system notification entirely and
           * pop the in-app overlay (it owns the ringtone + vibration loop).
           */
          foregroundIncomingOverlayActiveRef.current = true;
          setIncomingChatOverlay(overlayParams);
          return;
        }

        /**
         * Background-while-RN-still-running OR cannot-enter-main-app yet:
         * delegate to the native foreground service so the activity launches
         * over the lock screen / current foreground app. Falls back to a
         * Notifee heads-up notification on iOS / when the bridge is missing.
         */
        handleIncomingFcm(dispatch, remoteMessage, canEnterMainApp);
        const params = handleIncomingChatNotificationOpen(
          dispatch,
          remoteMessage,
          canEnterMainApp,
        );
        let handledNatively = false;
        if (params) {
          await setPendingIncomingChat(params);
          handledNatively = await startIncomingChatNative(params);
        }
        if (!handledNatively) {
          void showLocalNotificationFromRemoteMessage(remoteMessage);
        }
      })();
    });

    void messaging()
      .getInitialNotification()
      .then(remoteMessage => {
        onRemote(remoteMessage ?? undefined, 'getInitialNotification');
      });

    return () => {
      unsubOpened();
      unsubForeground();
    };
  }, [
    dispatch,
    isBootstrapping,
    isLanguageBootstrapping,
    canEnterMainApp,
    isAppForeground,
  ]);

  /**
   * Local Notifee notifications (shown from `setBackgroundMessageHandler`) do not trigger
   * Firebase `onNotificationOpenedApp`. Handle cold start + tap via Notifee APIs.
   *
   * Waits until the astrologer session is ready so `getInitialNotification` still delivers
   * after OTP when the user opened the app from a killed state via the notification.
   */
  useEffect(() => {
    if (isBootstrapping || isLanguageBootstrapping || !canEnterMainApp) {
      return;
    }

    const tryOpenFromNotifeeNotification = (
      n: { data?: Record<string, string | number | object> } | undefined | null,
      source: string,
    ) => {
      if (!n?.data || typeof n.data !== 'object') {
        return;
      }
      const flat = flattenNotificationData(
        n.data as Record<string, string | number | boolean | object | undefined>,
      );
      if (Object.keys(flat).length === 0) {
        return;
      }
      fcmTrace('Notifee handler [', source, '] keys=', Object.keys(flat).join(','));
      const params = handleIncomingChatNotificationOpen(
        dispatch,
        {
          data: flat,
          notification:
            typeof n.title === 'string' || typeof n.body === 'string'
              ? {
                  title: typeof n.title === 'string' ? n.title : undefined,
                  body: typeof n.body === 'string' ? n.body : undefined,
                }
              : undefined,
        } as FirebaseMessagingTypes.RemoteMessage,
        canEnterMainApp,
      );
      if (params) {
        foregroundIncomingOverlayActiveRef.current = true;
        setIncomingChatOverlay(params);
      }
    };

    void notifee.getInitialNotification().then(initial => {
      tryOpenFromNotifeeNotification(initial?.notification ?? null, 'notifee.getInitialNotification');
    });

    const unsub = notifee.onForegroundEvent(({ type, detail }) => {
      const n = detail.notification;
      if (type === EventType.ACTION_PRESS && n?.data) {
        const actionId = detail.pressAction?.id;
        if (
          actionId === 'incoming_chat_accept' ||
          actionId === 'incoming_chat_decline'
        ) {
          const flat = flattenNotificationData(
            n.data as Record<string, string | number | boolean | object | undefined>,
          );
          const params = getIncomingChatParamsFromData(flat);
          if (params && canEnterMainApp) {
            foregroundIncomingOverlayActiveRef.current = false;
            setIncomingChatOverlay(null);
            if (actionId === 'incoming_chat_accept') {
              acceptIncomingChatFromPush(dispatch, params);
            } else {
              rejectIncomingChatFromPush(dispatch, params);
            }
          }
          return;
        }
      }
      if (type === EventType.PRESS && n) {
        tryOpenFromNotifeeNotification(n, 'notifee.onForegroundEvent');
      }
    });

    return () => unsub();
  }, [dispatch, isBootstrapping, isLanguageBootstrapping, canEnterMainApp]);

  useEffect(() => {
    flushPendingWaitlistFcmNavigation(canEnterMainApp);
  }, [canEnterMainApp]);

  const handleNavigationReady = useCallback(() => {
    if (!canEnterMainApp) {
      return;
    }
    void flushPendingIncomingChatAccept(dispatch);
  }, [canEnterMainApp, dispatch]);

  useEffect(() => {
    if (!canEnterMainApp || !navigationRef.isReady()) {
      return;
    }
    void flushPendingIncomingChatAccept(dispatch);
  }, [canEnterMainApp, dispatch]);

  useEffect(() => {
    if (!canEnterMainApp && incomingChatOverlay) {
      foregroundIncomingOverlayActiveRef.current = false;
      setIncomingChatOverlay(null);
    }
  }, [canEnterMainApp, incomingChatOverlay]);

  /**
   * Whenever the in-app overlay is up, silence the system ringing
   * notification so we don't ring twice (overlay owns the looping audio).
   */
  useEffect(() => {
    if (incomingChatOverlay) {
      void cancelIncomingChatNotifications();
    }
  }, [incomingChatOverlay]);

  return (
    <>
      {isBootstrapping || isLanguageBootstrapping ? (
        <AppLoader />
      ) : (
        <NavigationContainer
          ref={navigationRef}
          theme={navigationTheme}
          onReady={handleNavigationReady}
        >
          {canEnterMainApp ? <MainTabNavigator /> : <AuthNavigator />}
        </NavigationContainer>
      )}

      <CustomIncomingNotificationScreen
        visible={Boolean(incomingChatOverlay) && canEnterMainApp}
        payload={incomingChatOverlay}
        onAccept={onIncomingOverlayAccept}
        onReject={onIncomingOverlayReject}
      />

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
