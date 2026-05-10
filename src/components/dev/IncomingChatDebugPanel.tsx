/**
 * Dev-only floating debug panel for the incoming-chat / FCM pipeline.
 *
 * Mounted from App.tsx behind an `__DEV__` guard. Renders:
 *   - A small chip (bottom-right) showing the last log line and unread count.
 *   - A full overlay (when expanded) with two tabs:
 *       • Logs  — last ~200 [YoginiFCM] traces.
 *       • Payloads — last 10 captured FCM messages with verdict (data-only
 *         vs notification-vs-mixed) and a Share button to send the raw JSON
 *         + correct example to the backend team.
 *   - "Fire test" button so you can trigger the native overlay end-to-end
 *     without involving the backend.
 *
 * NOTE: Intentionally simple — no nav deps, no redux, no theme imports —
 * so it cannot crash the app even if other modules misbehave.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  clearFcmTrace,
  fcmTrace,
  getFcmTraceEntries,
  subscribeFcmTrace,
  type FcmTraceEntry,
} from '../../services/push/fcmDebug';
import {
  buildBackendBugReport,
  clearFcmCapture,
  getFcmCaptureEntries,
  subscribeFcmCapture,
  type FcmCaptureEntry,
} from '../../services/push/fcmInspector';
import { startIncomingChatNative } from '../../services/push/incomingChatNative';

type Tab = 'logs' | 'payloads';

function formatTime(ts: number): string {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return `${hh}:${mm}:${ss}.${ms}`;
}

function verdictColor(v: FcmCaptureEntry['verdict']): string {
  switch (v) {
    case 'data-only':
      return '#1F6F4A';
    case 'mixed':
      return '#B66100';
    case 'notification-only':
      return '#A52323';
  }
}

function verdictLabel(v: FcmCaptureEntry['verdict']): string {
  switch (v) {
    case 'data-only':
      return 'DATA-ONLY ✓';
    case 'mixed':
      return 'MIXED ✗  (has notification field)';
    case 'notification-only':
      return 'NOTIFICATION-ONLY ✗';
  }
}

export function IncomingChatDebugPanel(): React.ReactElement | null {
  if (!__DEV__) {
    return null;
  }

  const [logs, setLogs] = useState<ReadonlyArray<FcmTraceEntry>>(() =>
    getFcmTraceEntries(),
  );
  const [payloads, setPayloads] = useState<ReadonlyArray<FcmCaptureEntry>>(
    () => getFcmCaptureEntries(),
  );
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState<Tab>('logs');
  const [unreadLogs, setUnreadLogs] = useState(0);
  const [unreadPayloads, setUnreadPayloads] = useState(0);

  useEffect(() => {
    return subscribeFcmTrace(next => {
      setLogs(next);
      if (!expanded || tab !== 'logs') {
        setUnreadLogs(u => Math.min(99, u + 1));
      }
    });
  }, [expanded, tab]);

  useEffect(() => {
    return subscribeFcmCapture(next => {
      setPayloads(next);
      if (!expanded || tab !== 'payloads') {
        setUnreadPayloads(u => Math.min(99, u + 1));
      }
    });
  }, [expanded, tab]);

  useEffect(() => {
    if (!expanded) return;
    if (tab === 'logs') setUnreadLogs(0);
    if (tab === 'payloads') setUnreadPayloads(0);
  }, [expanded, tab]);

  const lastLog = useMemo(
    () => (logs.length > 0 ? logs[logs.length - 1] : null),
    [logs],
  );
  const lastPayload = useMemo(
    () => (payloads.length > 0 ? payloads[payloads.length - 1] : null),
    [payloads],
  );

  const fireSyntheticIncomingChat = async () => {
    fcmTrace('DebugPanel: firing synthetic incoming chat');
    await startIncomingChatNative({
      roomId: 'DEBUG_ROOM_' + Date.now(),
      from: '9999999999',
      customerName: 'Debug User',
      customerImage: null,
      message: 'Wants to chat with you.',
      subtitle: 'Yoginiastro User',
      kundliUrl: undefined,
      userBalance: undefined,
      astroPrice: undefined,
      kundaliPayload: undefined,
    });
  };

  const shareBackendReport = async () => {
    try {
      const text = buildBackendBugReport(payloads);
      await Share.share({
        title: 'YoginiFCM backend payload report',
        message: text,
      });
    } catch {
      /* user cancelled */
    }
  };

  if (!expanded) {
    const totalUnread = unreadLogs + unreadPayloads;
    const lastLine = lastPayload
      ? `[${lastPayload.source}] ${lastPayload.verdict}`
      : lastLog?.message ?? 'no logs yet';
    const danger =
      lastPayload?.verdict === 'mixed' ||
      lastPayload?.verdict === 'notification-only';
    return (
      <Pressable
        style={[styles.chip, danger ? styles.chipDanger : null]}
        onPress={() => setExpanded(true)}
        hitSlop={8}
      >
        <Text style={styles.chipBadge}>FCM</Text>
        {totalUnread > 0 ? (
          <View style={styles.unreadDot}>
            <Text style={styles.unreadDotText}>{totalUnread}</Text>
          </View>
        ) : null}
        <Text style={styles.chipMsg} numberOfLines={1}>
          {lastLine}
        </Text>
      </Pressable>
    );
  }

  return (
    <Modal
      transparent
      animationType="fade"
      visible
      onRequestClose={() => setExpanded(false)}
    >
      <View style={styles.modalRoot}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Incoming-chat debug</Text>
          <View style={styles.headerActions}>
            <Pressable
              onPress={fireSyntheticIncomingChat}
              style={[styles.actionBtn, styles.fireBtn]}
            >
              <Text style={styles.actionBtnText}>Fire test</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                if (tab === 'logs') clearFcmTrace();
                else clearFcmCapture();
              }}
              style={styles.actionBtn}
            >
              <Text style={styles.actionBtnText}>Clear</Text>
            </Pressable>
            <Pressable
              onPress={() => setExpanded(false)}
              style={[styles.actionBtn, styles.closeBtn]}
            >
              <Text style={styles.actionBtnText}>Close</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.tabs}>
          <Pressable
            style={[styles.tab, tab === 'logs' ? styles.tabActive : null]}
            onPress={() => setTab('logs')}
          >
            <Text style={styles.tabText}>
              Logs ({logs.length})
              {unreadLogs > 0 ? ` · ${unreadLogs} new` : ''}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tab, tab === 'payloads' ? styles.tabActive : null]}
            onPress={() => setTab('payloads')}
          >
            <Text style={styles.tabText}>
              Payloads ({payloads.length})
              {unreadPayloads > 0 ? ` · ${unreadPayloads} new` : ''}
            </Text>
          </Pressable>
        </View>

        {tab === 'logs' ? (
          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listInner}
          >
            {logs.length === 0 ? (
              <Text style={styles.emptyText}>
                No traces yet. Send a notification or hit "Fire test".
              </Text>
            ) : (
              logs.map(e => (
                <View
                  key={e.id}
                  style={[
                    styles.row,
                    e.level === 'warn' ? styles.rowWarn : null,
                  ]}
                >
                  <Text style={styles.rowTs}>{formatTime(e.ts)}</Text>
                  <Text style={styles.rowMsg}>{e.message}</Text>
                </View>
              ))
            )}
          </ScrollView>
        ) : (
          <PayloadsTab payloads={payloads} onShare={shareBackendReport} />
        )}
      </View>
    </Modal>
  );
}

function PayloadsTab({
  payloads,
  onShare,
}: {
  payloads: ReadonlyArray<FcmCaptureEntry>;
  onShare: () => void;
}): React.ReactElement {
  if (payloads.length === 0) {
    return (
      <View style={styles.list}>
        <Text style={styles.emptyText}>
          {'No FCM messages received yet.\n\n' +
            'Ask backend to send a test notification, or use\n' +
            '`backend/fcm-data-api/sendTest.js` to send a data-only test.'}
        </Text>
      </View>
    );
  }
  return (
    <View style={{ flex: 1 }}>
      <Pressable onPress={onShare} style={styles.shareBtn}>
        <Text style={styles.shareBtnText}>
          Share latest payload + fix instructions →
        </Text>
      </Pressable>
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listInner}
      >
        {payloads
          .slice()
          .reverse()
          .map(p => (
            <View key={p.id} style={styles.payloadCard}>
              <View
                style={[
                  styles.verdictPill,
                  { backgroundColor: verdictColor(p.verdict) },
                ]}
              >
                <Text style={styles.verdictPillText}>{verdictLabel(p.verdict)}</Text>
              </View>
              <Text style={styles.payloadMeta}>
                {formatTime(p.ts)} · {p.source} · msgId={p.messageId ?? '(none)'}
              </Text>
              <Text style={styles.payloadMeta}>
                hasNotification={String(p.hasNotification)}  hasData=
                {String(p.hasData)}
              </Text>
              <Text style={styles.payloadJson}>{p.rawPretty}</Text>
            </View>
          ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    position: 'absolute',
    right: 8,
    bottom: 90,
    maxWidth: 240,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(20,20,20,0.85)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    zIndex: 99999,
    elevation: 24,
  },
  chipDanger: {
    backgroundColor: 'rgba(165,35,35,0.92)',
  },
  chipBadge: {
    color: '#FFD27A',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  chipMsg: {
    color: '#fff',
    fontSize: 11,
    flexShrink: 1,
  },
  unreadDot: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadDotText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  modalRoot: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.94)',
    paddingTop: 40,
    paddingHorizontal: 8,
    paddingBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 8,
    gap: 6,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    flexShrink: 1,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 6,
  },
  actionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#333',
  },
  fireBtn: {
    backgroundColor: '#1F6F4A',
  },
  closeBtn: {
    backgroundColor: '#7A1F1F',
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  tabs: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 6,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#1c1c1c',
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#3a3a3a',
  },
  tabText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  list: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 8,
  },
  listInner: {
    padding: 8,
  },
  emptyText: {
    color: '#aaa',
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 24,
    paddingHorizontal: 12,
  },
  row: {
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  rowWarn: {
    backgroundColor: 'rgba(255,180,0,0.12)',
  },
  rowTs: {
    color: '#7AB7FF',
    fontSize: 10,
  },
  rowMsg: {
    color: '#fff',
    fontSize: 12,
  },
  shareBtn: {
    backgroundColor: '#1F4E8A',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  shareBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  payloadCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
  },
  verdictPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 6,
  },
  verdictPillText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  payloadMeta: {
    color: '#bbb',
    fontSize: 10,
    marginBottom: 2,
  },
  payloadJson: {
    color: '#9CDCFE',
    fontSize: 11,
    marginTop: 6,
    fontFamily: 'monospace',
  },
});
