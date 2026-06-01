import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import messaging from '@react-native-firebase/messaging';
import type { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import notifee, { EventType } from '@notifee/react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  DeviceEventEmitter,
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
import {
  selectChatRequests,
  syncSocketSession,
} from '../store/slices/socketSlice';
import { AppLoader } from '../components/common/AppLoader';
import {
  checkForAppUpdate,
  type UpdateDecision,
} from '../services/update/appUpdateService';
import { CustomIncomingNotificationScreen } from '../components/push/CustomIncomingNotificationScreen';
import {
  foregroundIncomingOverlayActiveRef,
  isIncomingRoomHandled,
  markIncomingRoomHandled,
} from '../services/push/foregroundIncomingOverlay';
import { isIncomingChatAcceptInFlight } from '../services/push/incomingChatAcceptFlow';
import {
  flushPendingWaitlistFcmNavigation,
  flattenNotificationData,
  getIncomingChatParamsFromChatRequestItem,
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
  acceptIncomingChatFromNotification,
  acceptIncomingChatFromPush,
  flushPendingIncomingChatAccept,
  incomingChatAcceptNavigationPendingRef,
  rejectIncomingChatFromPush,
  wasNotificationAcceptHandled,
} from '../services/push/incomingChatAcceptFlow';
import { peekPendingIncomingChatAccept } from '../services/push/pendingIncomingChatAccept';
import {
  INCOMING_CHAT_OPEN_CONSULTATION_EVENT,
  isConsultationChatNavigationDone,
  openConsultationChatScreen,
} from '../services/push/incomingChatNavigation';
import { clearPendingIncomingChatAccept } from '../services/push/pendingIncomingChatAccept';
import { resolveIncomingChatParams } from '../services/push/resolveIncomingChatParams';
import {
  clearPendingIncomingChat,
  setPendingIncomingChat,
} from '../services/push/pendingIncomingChat';
import {
  peekIncomingChatLaunch,
  startIncomingChatOverlayProbe,
} from '../services/push/incomingChatOverlayProbe';
import {
  clearIncomingChatPayloadNative,
  consumeIncomingChatLaunchAction,
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
  const chatRequests = useAppSelector(selectChatRequests);
  const lastSocketOverlayRoomRef = useRef<string | null>(null);
  /** Cold-start probe runs once — not again when overlay dismisses after Accept. */
  const incomingOverlayProbeStartedRef = useRef(false);

  /** Keep MainTabNavigator in sync — ref must not stay true when overlay is hidden. */
  useEffect(() => {
    foregroundIncomingOverlayActiveRef.current = Boolean(
      incomingChatOverlay && canEnterMainApp,
    );
  }, [incomingChatOverlay, canEnterMainApp]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', nextState => {
      setAppState(nextState);
      if (nextState === 'background' || nextState === 'inactive') {
        incomingOverlayProbeStartedRef.current = false;
      }
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

  const shouldSkipIncomingOverlay = useCallback((roomId: string) => {
    const id = roomId.trim();
    return (
      isIncomingRoomHandled(id) ||
      isIncomingChatAcceptInFlight(id) ||
      isConsultationChatNavigationDone(id) ||
      wasNotificationAcceptHandled(id)
    );
  }, []);

  const showIncomingOverlay = useCallback(
    (params: OrderStackParamList['IncomingChatRequest'], source: string) => {
      if (shouldSkipIncomingOverlay(params.roomId)) {
        fcmTrace(
          'RootNavigator: skip overlay (handled/in-flight) room=',
          params.roomId,
        );
        void stopIncomingChatNative();
        void cancelIncomingChatNotifications();
        return;
      }
      fcmTrace('RootNavigator: show incoming overlay ←', source, 'room=', params.roomId);
      lastSocketOverlayRoomRef.current = params.roomId;
      foregroundIncomingOverlayActiveRef.current = true;
      void cancelIncomingChatNotifications();
      void stopIncomingChatNative();
      setIncomingChatOverlay(params);
    },
    [shouldSkipIncomingOverlay],
  );

  /**
   * App open + socket `chat-requests` (same path as working release build).
   * Shows custom Accept/Reject overlay + ring when FCM is delayed or missing.
   */
  useEffect(() => {
    if (
      isBootstrapping ||
      isLanguageBootstrapping ||
      !canEnterMainApp ||
      !isAppForeground
    ) {
      return;
    }

    const [first] = chatRequests;
    if (!first?.roomId) {
      lastSocketOverlayRoomRef.current = null;
      return;
    }
    if (
      isIncomingRoomHandled(first.roomId) ||
      isIncomingChatAcceptInFlight(first.roomId)
    ) {
      return;
    }
    if (first.roomId === lastSocketOverlayRoomRef.current) {
      return;
    }
    if (incomingChatOverlay?.roomId === first.roomId) {
      return;
    }

    const params = getIncomingChatParamsFromChatRequestItem(first);
    if (!params) {
      return;
    }

    showIncomingOverlay(params, 'socket-chat-requests');
  }, [
    canEnterMainApp,
    chatRequests,
    incomingChatOverlay?.roomId,
    isAppForeground,
    isBootstrapping,
    isLanguageBootstrapping,
    showIncomingOverlay,
  ]);

  /**
   * Unlocked notification tap: app opens → show custom Accept/Reject (peek only;
   * does not consume intent until user acts).
   */
  useEffect(() => {
    if (
      !canEnterMainApp ||
      !isAppForeground ||
      isBootstrapping ||
      isLanguageBootstrapping
    ) {
      return;
    }
    void (async () => {
      const launch = await peekIncomingChatLaunch();
      if (!launch.params || launch.decision) {
        return;
      }
      if (shouldSkipIncomingOverlay(launch.params.roomId)) {
        return;
      }
      if (incomingChatOverlay?.roomId === launch.params.roomId) {
        return;
      }
      showIncomingOverlay(launch.params, 'notification-tap');
    })();
  }, [
    canEnterMainApp,
    incomingChatOverlay?.roomId,
    isAppForeground,
    isBootstrapping,
    isLanguageBootstrapping,
    shouldSkipIncomingOverlay,
    showIncomingOverlay,
  ]);

  /**
   * Lock-screen Accept: MainActivity may start before bootstrap finishes.
   * Re-read intent once the astrologer session is ready (probe may have stopped early).
   */
  useEffect(() => {
    if (!canEnterMainApp || !isAppForeground || isBootstrapping || isLanguageBootstrapping) {
      return;
    }
    void (async () => {
      const launch = await consumeIncomingChatLaunchAction();
      if (!launch.params || launch.decision !== 'accept') {
        return;
      }
      fcmTrace('RootNavigator: deferred accept intent room=', launch.params.roomId);
      setIncomingChatOverlay(null);
      void acceptIncomingChatFromNotification(dispatch, launch.params);
    })();
  }, [
    canEnterMainApp,
    dispatch,
    isAppForeground,
    isBootstrapping,
    isLanguageBootstrapping,
  ]);

  /**
   * Killed / cold start: intent extras + AsyncStorage are often ready only after
   * several frames. Retry until we can show the custom Accept/Reject screen.
   */
  useEffect(() => {
    if (
      !isAppForeground ||
      isLanguageBootstrapping ||
      (!canEnterMainApp && !isBootstrapping) ||
      incomingOverlayProbeStartedRef.current
    ) {
      return;
    }
    incomingOverlayProbeStartedRef.current = true;

    return startIncomingChatOverlayProbe(
      launch => {
        if (!launch.params) {
          return;
        }
        if (shouldSkipIncomingOverlay(launch.params.roomId)) {
          return;
        }
        if (launch.decision === 'accept') {
          fcmTrace('RootNavigator: probe → accept → ConsultationChat');
          foregroundIncomingOverlayActiveRef.current = false;
          setIncomingChatOverlay(null);
          void acceptIncomingChatFromNotification(dispatch, launch.params);
          return;
        }
        if (launch.decision === 'reject') {
          void cancelIncomingChatNotifications();
          void stopIncomingChatNative();
          if (canEnterMainApp) {
            void rejectIncomingChatFromPush(dispatch, launch.params);
          }
          return;
        }
        if (canEnterMainApp) {
          showIncomingOverlay(launch.params, 'probe');
        }
      },
      { maxAttempts: 30, intervalMs: 400 },
    );
  }, [
    canEnterMainApp,
    dispatch,
    isAppForeground,
    isBootstrapping,
    isLanguageBootstrapping,
    shouldSkipIncomingOverlay,
    showIncomingOverlay,
  ]);

  /**
   * MainActivity is `singleTask`, so when the service launches it while the
   * app is already running we get `onNewIntent` (proxied via DeviceEventEmitter
   * from `IncomingChatModule`). Pop the overlay live without remount.
   */
  useEffect(() => {
    const sub = subscribeIncomingChatIntent(launch => {
      if (!launch.params) {
        return;
      }
      fcmTrace(
        'RootNavigator: native onNewIntent room=',
        launch.params.roomId,
        'decision=',
        launch.decision ?? '(none)',
      );
      if (launch.decision === 'accept') {
        foregroundIncomingOverlayActiveRef.current = false;
        setIncomingChatOverlay(null);
        void acceptIncomingChatFromNotification(dispatch, launch.params);
        return;
      }
      if (launch.decision === 'reject') {
        void cancelIncomingChatNotifications();
        void stopIncomingChatNative();
        if (canEnterMainApp) {
          void rejectIncomingChatFromPush(dispatch, launch.params);
        }
        return;
      }
      if (canEnterMainApp && !shouldSkipIncomingOverlay(launch.params.roomId)) {
        showIncomingOverlay(launch.params, 'native-intent');
      }
    });
    return () => sub?.remove();
  }, [canEnterMainApp, dispatch, shouldSkipIncomingOverlay, showIncomingOverlay]);

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
    let cancelled = false;

    const syncSocketForSession = async () => {
      const resolvedAstroId = astroId?.trim() || decodeAstroIdFromToken(token) || '';
      const pendingAccept = await peekPendingIncomingChatAccept();
      if (cancelled) {
        return;
      }

      const keepSocketAlive =
        Boolean(token && resolvedAstroId) &&
        (isAppForeground ||
          incomingChatAcceptNavigationPendingRef.current ||
          Boolean(pendingAccept));

      if (keepSocketAlive) {
        dispatch(
          syncSocketSession({
            authToken: token,
            astroId: resolvedAstroId,
            reason: isAppForeground
              ? 'connect-ready'
              : 'incoming-chat-accept-pending',
          }),
        );
        return;
      }

      const reason = !token
        ? 'no-auth-token'
        : !resolvedAstroId
          ? 'no-astro-id'
          : !isAppForeground
            ? 'app-background'
            : 'disconnect-fallback';
      dispatch(syncSocketSession({ authToken: null, reason }));
    };

    void syncSocketForSession();
    return () => {
      cancelled = true;
    };
  }, [token, isAppForeground, astroId, dispatch, appState]);

  const onOpenStore = () => {
    const url = updateDecision?.storeUrl;
    if (!url) return;
    void Linking.openURL(url);
  };

  const onIncomingOverlayAccept = useCallback(
    (p: OrderStackParamList['IncomingChatRequest']) => {
      markIncomingRoomHandled(p.roomId);
      lastSocketOverlayRoomRef.current = p.roomId;
      foregroundIncomingOverlayActiveRef.current = false;
      setIncomingChatOverlay(null);
      void cancelIncomingChatNotifications();
      void clearPendingIncomingChat();
      void clearIncomingChatPayloadNative();
      void stopIncomingChatNative();
      void acceptIncomingChatFromPush(dispatch, p, {
        skipMainActivityLaunch: true,
      });
    },
    [dispatch],
  );

  const onIncomingOverlayReject = useCallback(
    (p: OrderStackParamList['IncomingChatRequest']) => {
      markIncomingRoomHandled(p.roomId);
      lastSocketOverlayRoomRef.current = p.roomId;
      foregroundIncomingOverlayActiveRef.current = false;
      setIncomingChatOverlay(null);
      void cancelIncomingChatNotifications();
      void clearPendingIncomingChat();
      void clearIncomingChatPayloadNative();
      void stopIncomingChatNative();
      void rejectIncomingChatFromPush(dispatch, p);
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
        showIncomingOverlay(overlayParams, source);
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
          showIncomingOverlay(overlayParams, 'fcm-foreground');
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
        if (params) {
          void (async () => {
            await showLocalNotificationFromRemoteMessage(remoteMessage, {
              skipSound: handledNatively,
              skipDisplay: false,
            });
            if (handledNatively) {
              try {
                await notifee.cancelAllNotifications();
              } catch {
                /* best-effort — native tray notification stays */
              }
            }
          })();
        } else {
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
    showIncomingOverlay,
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
      if (params && !shouldSkipIncomingOverlay(params.roomId)) {
        void stopIncomingChatNative();
        showIncomingOverlay(params, source);
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
          void (async () => {
            const flat = flattenNotificationData(
              n.data as Record<string, string | number | boolean | object | undefined>,
            );
            await Promise.all([
              cancelIncomingChatNotifications(),
              stopIncomingChatNative(),
            ]);
            lastSocketOverlayRoomRef.current = null;
            setIncomingChatOverlay(null);
            const params = await resolveIncomingChatParams(flat, {
              consumePending: true,
            });
            if (!params) {
              fcmTrace('Notifee FG action: no params action=', actionId ?? '');
              return;
            }
            await clearPendingIncomingChat();
            if (actionId === 'incoming_chat_accept') {
              void acceptIncomingChatFromNotification(dispatch, params);
              return;
            }
            if (canEnterMainApp) {
              void rejectIncomingChatFromPush(dispatch, params);
            }
          })();
          return;
        }
      }
      if (type === EventType.PRESS && n) {
        tryOpenFromNotifeeNotification(n, 'notifee.onForegroundEvent');
      }
    });

    return () => unsub();
  }, [
    dispatch,
    isBootstrapping,
    isLanguageBootstrapping,
    canEnterMainApp,
    showIncomingOverlay,
  ]);

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
    if (
      isBootstrapping ||
      isLanguageBootstrapping ||
      !canEnterMainApp ||
      !navigationRef.isReady()
    ) {
      return;
    }
    const timer = setTimeout(() => {
      void flushPendingIncomingChatAccept(dispatch);
    }, 50);
    return () => clearTimeout(timer);
  }, [
    isBootstrapping,
    isLanguageBootstrapping,
    canEnterMainApp,
    dispatch,
  ]);

  /** Resume pending Accept → ConsultationChat when app returns to foreground. */
  useEffect(() => {
    if (!canEnterMainApp || appState !== 'active') {
      return;
    }
    const timer = setTimeout(() => {
      void flushPendingIncomingChatAccept(dispatch);
    }, 100);
    return () => clearTimeout(timer);
  }, [appState, canEnterMainApp, dispatch]);

  /**
   * Headless / background Accept emits this event — navigate in the main React tree
   * (navigationRef does not work reliably from Headless JS).
   */
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(
      INCOMING_CHAT_OPEN_CONSULTATION_EVENT,
      (p: OrderStackParamList['IncomingChatRequest']) => {
        fcmTrace(
          'RootNavigator: openConsultationChat event room=',
          p?.roomId ?? '(none)',
        );
        if (!p?.roomId || !p.from?.trim()) {
          return;
        }
        if (isConsultationChatNavigationDone(p.roomId)) {
          incomingChatAcceptNavigationPendingRef.current = false;
          void clearPendingIncomingChatAccept();
          return;
        }
        if (openConsultationChatScreen(p)) {
          incomingChatAcceptNavigationPendingRef.current = false;
          void clearPendingIncomingChatAccept();
          return;
        }
        void flushPendingIncomingChatAccept(dispatch);
      },
    );
    return () => sub.remove();
  }, [canEnterMainApp, dispatch]);

  /** Retry pending Accept → chat for a few seconds after unlock / resume. */
  useEffect(() => {
    if (
      !canEnterMainApp ||
      isBootstrapping ||
      isLanguageBootstrapping ||
      appState !== 'active'
    ) {
      return;
    }

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 50;

    const tick = async () => {
      if (cancelled || attempts >= maxAttempts) {
        return;
      }
      attempts += 1;
      const pending = await peekPendingIncomingChatAccept();
      if (!pending?.roomId) {
        return;
      }
      if (isConsultationChatNavigationDone(pending.roomId)) {
        incomingChatAcceptNavigationPendingRef.current = false;
        await clearPendingIncomingChatAccept();
        return;
      }
      const done = await flushPendingIncomingChatAccept(dispatch);
      if (!done && !cancelled) {
        setTimeout(() => void tick(), 200);
      }
    };

    void tick();
    return () => {
      cancelled = true;
    };
  }, [
    appState,
    canEnterMainApp,
    dispatch,
    isBootstrapping,
    isLanguageBootstrapping,
  ]);

  useEffect(() => {
    if (!canEnterMainApp && incomingChatOverlay) {
      lastSocketOverlayRoomRef.current = null;
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
