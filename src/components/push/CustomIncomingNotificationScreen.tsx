import { memo, useEffect } from 'react';
import {
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  Vibration,
  View,
} from 'react-native';
import Video from 'react-native-video';
import { SafeAreaView } from 'react-native-safe-area-context';
import { images } from '../../assets/images';
import { sounds } from '../../assets/sounds';
import type { OrderStackParamList } from '../../navigation/types';
import { hp, normalizeFont, wp } from '../../utils/responsive';

export type CustomIncomingNotificationPayload =
  OrderStackParamList['IncomingChatRequest'];

type Props = {
  visible: boolean;
  payload: CustomIncomingNotificationPayload | null;
  onAccept: (payload: CustomIncomingNotificationPayload) => void;
  onReject: (payload: CustomIncomingNotificationPayload) => void;
};

const SERIF = Platform.select({
  ios: 'Georgia',
  android: 'serif',
  default: 'serif',
});

function resolveTitle(payload: CustomIncomingNotificationPayload): string {
  return (
    payload.notificationTitle?.trim() ||
    payload.customerName?.trim() ||
    'Incoming chat request'
  );
}

function resolveBody(payload: CustomIncomingNotificationPayload): string {
  return (
    payload.notificationBody?.trim() ||
    payload.message?.trim() ||
    payload.subtitle?.trim() ||
    'A user wants to chat with you.'
  );
}

function CustomIncomingNotificationScreenComponent({
  visible,
  payload,
  onAccept,
  onReject,
}: Props) {
  useEffect(() => {
    if (!visible || !payload) {
      return;
    }
    Vibration.vibrate([0, 500, 650], true);
    return () => {
      Vibration.cancel();
    };
  }, [visible, payload]);

  if (!payload) {
    return null;
  }

  const title = resolveTitle(payload);
  const body = resolveBody(payload);
  const showCustomerName =
    payload.customerName.trim().length > 0 &&
    payload.customerName.trim() !== title;

  const avatarSource =
    payload.customerImage && payload.customerImage.trim().length > 0
      ? { uri: payload.customerImage.trim() }
      : images.iconamoonProfileCircleFill;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={() => onReject(payload)}
    >
      <View style={styles.root}>
        <Video
          source={sounds.waitlist}
          style={styles.hiddenRingtone}
          paused={!visible}
          repeat
          muted={false}
          volume={1}
          playWhenInactive
          playInBackground={false}
          ignoreSilentSwitch="ignore"
          onError={() => undefined}
        />

        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          <View style={styles.header}>
            <Text style={styles.brand}>Yogini Astro</Text>
            <Text style={styles.incomingLabel}>Incoming request</Text>
          </View>

          <View style={styles.content}>
            <Image
              source={avatarSource}
              style={styles.avatar}
              resizeMode="cover"
            />
            <Text style={styles.title}>{title}</Text>
            {showCustomerName ? (
              <Text style={styles.customerName}>{payload.customerName}</Text>
            ) : null}
            <Text style={styles.body}>{body}</Text>
          </View>

          <View style={styles.actionsRow}>
            <Pressable
              style={[styles.actionBtn, styles.rejectBtn]}
              onPress={() => onReject(payload)}
              accessibilityRole="button"
              accessibilityLabel="Reject"
            >
              <Text style={styles.actionText}>Reject</Text>
            </Pressable>
            <Pressable
              style={[styles.actionBtn, styles.acceptBtn]}
              onPress={() => onAccept(payload)}
              accessibilityRole="button"
              accessibilityLabel="Accept"
            >
              <Text style={styles.actionText}>Accept</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

export const CustomIncomingNotificationScreen = memo(
  CustomIncomingNotificationScreenComponent,
);

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#3D1815',
  },
  hiddenRingtone: {
    width: 0,
    height: 0,
  },
  safe: {
    flex: 1,
    justifyContent: 'space-between',
  },
  header: {
    alignItems: 'center',
    paddingTop: hp(2),
    paddingHorizontal: wp(6),
  },
  brand: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: normalizeFont(13),
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  incomingLabel: {
    marginTop: 6,
    color: '#F5D0CC',
    fontSize: normalizeFont(15),
    fontFamily: SERIF,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: wp(8),
  },
  avatar: {
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.9)',
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginBottom: 22,
  },
  title: {
    color: '#FFFFFF',
    fontSize: normalizeFont(26),
    fontFamily: SERIF,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: normalizeFont(34),
  },
  customerName: {
    marginTop: 8,
    color: 'rgba(255,255,255,0.82)',
    fontSize: normalizeFont(16),
    fontWeight: '500',
    textAlign: 'center',
  },
  body: {
    marginTop: 16,
    color: 'rgba(255,255,255,0.9)',
    fontSize: normalizeFont(17),
    lineHeight: normalizeFont(26),
    textAlign: 'center',
    paddingHorizontal: wp(2),
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 14,
    paddingHorizontal: wp(6),
    paddingBottom: hp(3),
  },
  actionBtn: {
    flex: 1,
    height: 54,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptBtn: {
    backgroundColor: '#1B6B28',
  },
  rejectBtn: {
    backgroundColor: '#A02420',
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: normalizeFont(18),
    fontFamily: SERIF,
    fontWeight: '700',
  },
});
