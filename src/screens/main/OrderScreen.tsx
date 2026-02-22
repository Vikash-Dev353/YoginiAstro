import { memo, useEffect, useMemo, useState } from 'react';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import {
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { AppHeader } from '../../components/common/AppHeader';
import { colors } from '../../constants/colors';
import { useTranslation } from '../../localization/useTranslation';
import { RootTabParamList } from '../../navigation/types';
import { normalizeFont, wp } from '../../utils/responsive';

type OrderTab = 'Waitlist' | 'Voice Call' | 'Chat' | 'Pooja Booking';

type WaitlistItem = {
  id: string;
  name: string;
  message: string;
  timeLabel: string;
};

type VoiceCallItem = {
  id: string;
  orderId: string;
  name: string;
  timeLabel: string;
  rate: string;
  duration: string;
  amount: string;
};

type ChatItem = {
  id: string;
  orderId: string;
  name: string;
  dob: string;
  pob: string;
  gender: string;
  rate: string;
  duration: string;
  amount: string;
};

type PoojaBookingItem = {
  id: string;
  orderId: string;
  serviceName: string;
  customerName: string;
  customerPhone: string;
  paymentMode: string;
  timeLabel: string;
  total: string;
  status: string;
};

type OrderListItem = WaitlistItem | VoiceCallItem | ChatItem | PoojaBookingItem;

const WAITLIST_DATA: WaitlistItem[] = [
  {
    id: 'w1',
    name: 'Raman Kumar',
    message: 'Wants to chat with you.',
    timeLabel: 'Now',
  },
  {
    id: 'w2',
    name: 'Saurabh Sharma',
    message: 'Wants to chat with you.',
    timeLabel: '2 min ago',
  },
];

const VOICE_CALL_DATA: VoiceCallItem[] = [
  {
    id: 'v1',
    orderId: 'CHTI302',
    name: 'Raman Kumar',
    timeLabel: '11 Jan 2026 | 01:41 PM',
    rate: '₹ 6/min',
    duration: '1.5 min',
    amount: '₹ 9',
  },
  {
    id: 'v2',
    orderId: 'CHTI318',
    name: 'Vikram Singh',
    timeLabel: '13 Jan 2026 | 09:20 AM',
    rate: '₹ 8/min',
    duration: '3 min',
    amount: '₹ 24',
  },
];

const CHAT_DATA: ChatItem[] = [
  {
    id: 'c1',
    orderId: 'CHTI302',
    name: 'Raman Kumar',
    dob: '14-January-1992,05:45 AM',
    pob: 'Kishanganj, Bihar, India',
    gender: 'Male',
    rate: '₹ 6/min',
    duration: '1.5 min',
    amount: '₹ 9',
  },
  {
    id: 'c2',
    orderId: 'CHTI411',
    name: 'Pooja Gupta',
    dob: '28-February-1994,11:10 PM',
    pob: 'Jaipur, Rajasthan, India',
    gender: 'Female',
    rate: '₹ 7/min',
    duration: '4 min',
    amount: '₹ 28',
  },
];

const POOJA_DATA: PoojaBookingItem[] = [
  {
    id: 'p1',
    orderId: 'CHTI302',
    serviceName: 'Online Grah Pravesh Pooja',
    customerName: 'Raman Kumar',
    customerPhone: '9354246782',
    paymentMode: 'UPI/Cash',
    timeLabel: '11 Jan 2026 | 01:41 PM',
    total: '₹ 2,100',
    status: 'Paid',
  },
  {
    id: 'p2',
    orderId: 'CHTI509',
    serviceName: 'Mangal Dosh Pooja',
    customerName: 'Riya Verma',
    customerPhone: '9811122233',
    paymentMode: 'UPI',
    timeLabel: '17 Jan 2026 | 07:20 PM',
    total: '₹ 3,500',
    status: 'Paid',
  },
];

type Props = BottomTabScreenProps<RootTabParamList, 'Order'>;

export function OrderScreen({ route }: Props) {
  const { t, appLanguage } = useTranslation();
  const tabs: OrderTab[] = ['Waitlist', 'Voice Call', 'Chat', 'Pooja Booking'];

  const tabLabel: Record<OrderTab, string> = {
    Waitlist: t('order.waitlist'),
    'Voice Call': t('order.voiceCall'),
    Chat: t('order.chat'),
    'Pooja Booking': t('order.poojaBooking'),
  };

  const [activeTab, setActiveTab] = useState<OrderTab>(
    route.params?.initialTab || 'Waitlist',
  );

  useEffect(() => {
    if (route.params?.initialTab) {
      setActiveTab(route.params.initialTab);
    }
  }, [route.params?.initialTab]);

  const data = useMemo<OrderListItem[]>(() => {
    switch (activeTab) {
      case 'Voice Call':
        return VOICE_CALL_DATA;
      case 'Chat':
        return CHAT_DATA;
      case 'Pooja Booking':
        return POOJA_DATA;
      case 'Waitlist':
      default:
        return WAITLIST_DATA;
    }
  }, [activeTab]);

  const renderMetricRow = (rate: string, duration: string, amount: string) => (
    <View style={styles.metricRow}>
      <View style={[styles.metricChip, styles.rateChip]}>
        <Text style={styles.metricText}>{`${t('order.rate')} : ${rate}`}</Text>
      </View>
      <View style={[styles.metricChip, styles.durationChip]}>
        <Text style={styles.metricText}>{`${t(
          'order.duration',
        )} : ${duration}`}</Text>
      </View>
      <View style={[styles.metricChip, styles.amountChip]}>
        <Text style={styles.metricText}>{`${t(
          'order.amount',
        )} : ${amount}`}</Text>
      </View>
    </View>
  );

  const renderItem = ({ item }: { item: OrderListItem }) => {
    if (activeTab === 'Waitlist') {
      const waitlistItem = item as WaitlistItem;
      return (
        <View style={styles.card}>
          <View style={styles.waitlistTopRow}>
            <Text style={styles.kundliText}>{t('order.viewKundali')}</Text>
            <Text style={styles.timeText}>
              ◷{' '}
              {waitlistItem.timeLabel === 'Now'
                ? t('order.now')
                : waitlistItem.timeLabel}
            </Text>
          </View>
          <Text style={styles.primaryName}>{waitlistItem.name}</Text>
          <Text style={styles.secondaryText}>{t('order.wantsToChat')}</Text>
          <View style={styles.waitlistActions}>
            <Pressable style={[styles.actionButton, styles.acceptButton]}>
              <Text style={styles.actionButtonText}>{t('common.accept')}</Text>
            </Pressable>
            <Pressable style={[styles.actionButton, styles.rejectButton]}>
              <Text style={styles.actionButtonText}>{t('common.reject')}</Text>
            </Pressable>
          </View>
        </View>
      );
    }

    if (activeTab === 'Voice Call') {
      const voiceItem = item as VoiceCallItem;
      return (
        <View style={styles.card}>
          <Text style={styles.orderIdText}>{`${t('order.orderId')}: ${
            voiceItem.orderId
          }`}</Text>
          <Text style={styles.primaryName}>{voiceItem.name}</Text>
          <Text style={styles.timeText}>◷ {voiceItem.timeLabel}</Text>
          {renderMetricRow(
            voiceItem.rate,
            voiceItem.duration,
            voiceItem.amount,
          )}
        </View>
      );
    }

    if (activeTab === 'Chat') {
      const chatItem = item as ChatItem;
      return (
        <View style={styles.card}>
          <View style={styles.chatTopRow}>
            <Text style={styles.primaryName}>{chatItem.name}</Text>
            <Text style={styles.chatOrderId}>{`${t('order.orderId')}: ${
              chatItem.orderId
            }`}</Text>
          </View>
          <View style={styles.chatInfoRow}>
            <Text style={styles.chatInfoLabel}>{`${t('order.dob')} :`}</Text>
            <Text style={styles.chatInfoValue}>{chatItem.dob}</Text>
          </View>
          <View style={styles.chatInfoRow}>
            <Text style={styles.chatInfoLabel}>{`${t('order.pob')} :`}</Text>
            <Text style={styles.chatInfoValue}>{chatItem.pob}</Text>
          </View>
          <View style={styles.chatInfoRow}>
            <Text style={styles.chatInfoLabel}>{`${t('order.gender')} :`}</Text>
            <Text style={styles.chatInfoValue}>
              {appLanguage === 'hi'
                ? chatItem.gender === 'Female'
                  ? 'महिला'
                  : t('order.male')
                : chatItem.gender}
            </Text>
          </View>
          {renderMetricRow(chatItem.rate, chatItem.duration, chatItem.amount)}
        </View>
      );
    }

    const poojaItem = item as PoojaBookingItem;
    return (
      <View style={styles.card}>
        <View style={styles.poojaTopRow}>
          <Text style={styles.orderIdText}>{`${t('order.orderId')}: ${
            poojaItem.orderId
          }`}</Text>
          <Text style={styles.timeText}>◷ {poojaItem.timeLabel}</Text>
        </View>
        <Text style={styles.poojaTitle}>{poojaItem.serviceName}</Text>
        <Text style={styles.poojaInfo}>◌ {poojaItem.customerName}</Text>
        <Text style={styles.poojaInfo}>◌ {poojaItem.customerPhone}</Text>
        <Text style={styles.poojaInfo}>{`${t('order.paymentMode')} : ${
          poojaItem.paymentMode
        }`}</Text>
        <View style={styles.separator} />
        <View style={styles.poojaBottomRow}>
          <Text style={styles.totalText}>{`${t('order.total')} : ${
            poojaItem.total
          }`}</Text>
          <View style={styles.statusChip}>
            <Text style={styles.statusText}>{t('common.paid')}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader title={t('common.order')} />
      <View style={styles.tabsRow}>
        {tabs.map(tab => {
          const isActive = activeTab === tab;
          return (
            <Pressable
              key={tab}
              style={styles.tabButton}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                {tabLabel[tab]}
              </Text>
              {isActive ? <View style={styles.tabUnderline} /> : null}
            </Pressable>
          );
        })}
      </View>

      <FlatList
        data={data}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

export const MemoizedOrderScreen = memo(OrderScreen);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  tabsRow: {
    paddingHorizontal: wp(4.5),
    paddingTop: 12,
    paddingBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#E9E2E2',
  },
  tabButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: {
    fontSize: normalizeFont(17 / 1.1),
    color: '#3A2424',
    fontWeight: '500',
  },
  tabTextActive: {
    fontWeight: '700',
  },
  tabUnderline: {
    marginTop: 4,
    height: 2,
    width: '100%',
    backgroundColor: '#4E2A2A',
  },
  listContent: {
    paddingHorizontal: wp(4.5),
    paddingTop: 12,
    paddingBottom: 120,
    gap: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#9D5C5C',
    padding: 14,
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  waitlistTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  kundliText: {
    color: '#D48477',
    fontSize: normalizeFont(14 / 1.2),
    fontWeight: '500',
  },
  orderIdText: {
    color: '#D48477',
    fontSize: normalizeFont(14 / 1.2),
    fontWeight: '500',
  },
  primaryName: {
    color: '#2F1C1C',
    fontSize: normalizeFont(20 / 1.1),
    fontWeight: '700',
    marginBottom: 4,
  },
  secondaryText: {
    color: '#3D2A2A',
    fontSize: normalizeFont(14 / 1.1),
    marginBottom: 12,
  },
  timeText: {
    color: '#6C6C6C',
    fontSize: normalizeFont(14 / 1.15),
  },
  waitlistActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptButton: {
    backgroundColor: '#5B1B1B',
  },
  rejectButton: {
    backgroundColor: '#B90303',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: normalizeFont(16 / 1.05),
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 14,
  },
  metricChip: {
    flex: 1,
    minHeight: 40,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  rateChip: {
    backgroundColor: '#F9F1DF',
    borderColor: '#DFC188',
  },
  durationChip: {
    backgroundColor: '#F5E9E7',
    borderColor: '#C99E98',
  },
  amountChip: {
    backgroundColor: '#ECE8E8',
    borderColor: '#C4BDBD',
  },
  metricText: {
    color: '#2F1D1D',
    fontSize: normalizeFont(16 / 1.2),
    fontWeight: '500',
  },
  chatTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  chatOrderId: {
    color: '#3D2A2A',
    fontSize: normalizeFont(13),
  },
  chatInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  chatInfoLabel: {
    color: '#7C7C7C',
    fontSize: normalizeFont(16 / 1.2),
    minWidth: 62,
  },
  chatInfoValue: {
    color: '#3A2424',
    fontSize: normalizeFont(16 / 1.2),
    fontWeight: '500',
    flex: 1,
  },
  poojaTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  poojaTitle: {
    color: '#2F1C1C',
    fontSize: normalizeFont(20 / 1.1),
    fontWeight: '700',
    marginBottom: 8,
  },
  poojaInfo: {
    color: '#3C2A2A',
    fontSize: normalizeFont(15 / 1.15),
    marginBottom: 4,
  },
  separator: {
    marginTop: 8,
    marginBottom: 10,
    height: 1,
    backgroundColor: '#BFB4B4',
  },
  poojaBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalText: {
    color: '#2E1A1A',
    fontSize: normalizeFont(20 / 1.1),
    fontWeight: '700',
  },
  statusChip: {
    minWidth: 106,
    minHeight: 40,
    borderRadius: 8,
    backgroundColor: '#0F7F1B',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: normalizeFont(16 / 1.1),
    fontWeight: '700',
  },
});
