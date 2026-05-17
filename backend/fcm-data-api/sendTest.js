/**
 * Quick CLI to fire a SAMPLE incoming-chat FCM at a single device.
 *
 * Usage:
 *   1. Put `serviceAccount.json` (Firebase service-account key) next to this file.
 *      Download from: https://console.firebase.google.com/project/yoginidev-f218f/settings/serviceaccounts/adminsdk
 *   2. Grab the FCM token (search "[FCM_TOKEN_FULL]" in Metro logs after dev login).
 *   3. Run:
 *        node sendTest.js <FCM_TOKEN>                  # data-only (recommended)
 *        node sendTest.js <FCM_TOKEN> --mimic-backend  # mimic CURRENT backend shape (with notification field)
 *
 * Use `--mimic-backend` to reproduce production behaviour and verify that the
 * client-side workaround (cancelling the auto-displayed banner + showing the
 * native overlay) works even when backend keeps sending the `notification`
 * field. Once backend is fixed, drop the flag for the cleaner data-only path.
 */

import admin from 'firebase-admin';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const serviceAccountPath = join(__dirname, 'serviceAccount.json');

if (!existsSync(serviceAccountPath)) {
  console.error('serviceAccount.json missing.');
  console.error(
    'Download from: https://console.firebase.google.com/project/yoginidev-f218f/settings/serviceaccounts/adminsdk',
  );
  console.error('Save it to: ' + serviceAccountPath);
  process.exit(1);
}

const args = process.argv.slice(2);
const mimicBackend = args.includes('--mimic-backend');
const fcmToken = args.find(a => !a.startsWith('--'))?.trim();
if (!fcmToken) {
  console.error('Usage: node sendTest.js <FCM_TOKEN> [--mimic-backend]');
  process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const roomId = 'TEST_ROOM_' + Date.now();
const senderId = '9876543210';

const dataOnly = {
  token: fcmToken,
  data: {
    type: 'incoming_chat',
    event: 'incoming_chat',
    roomId,
    senderId,
    receiverId: 'astro_test_001',
    customerName: 'Test User',
    customerImage: '',
    message: 'Wants to chat with you.',
    subtitle: 'Yoginiastro User',
    waitingCount: '1',
    navigateTo: 'IncomingChat',
    notificationId: 'INCOMING_' + roomId,
  },
  android: {
    priority: 'high',
  },
  apns: {
    headers: { 'apns-priority': '10' },
    payload: { aps: { contentAvailable: true } },
  },
};

/**
 * Mirrors the current production backend payload — has BOTH `notification` and
 * `data`. With the client-side fixes the device should still show our custom
 * overlay (the auto-displayed banner gets cancelled). If `--mimic-backend`
 * leaves a stale system banner, the native cancellation regressed.
 */
const mimicShape = {
  token: fcmToken,
  notification: {
    title: 'Received new chat request',
    body: 'Users waiting: 1',
  },
  data: {
    event: 'incoming_chat',
    type: 'general',
    roomId,
    senderId,
    receiverId: 'astro_test_001',
    waitingCount: '1',
    navigateTo: 'IncomingChat',
    notificationId: 'INCOMING_' + roomId,
    customerName: 'Test User',
    subtitle: 'Yoginiastro User',
  },
  android: {
    priority: 'high',
  },
  apns: {
    headers: { 'apns-priority': '10' },
    payload: { aps: { contentAvailable: true } },
  },
};

const message = mimicBackend ? mimicShape : dataOnly;
console.log(
  '[sendTest] mode =',
  mimicBackend ? 'mimic-backend (notification+data)' : 'data-only (recommended)',
);

try {
  const id = await admin.messaging().send(message);
  console.log('FCM sent OK. messageId =', id);
  console.log('\nExpected behavior on the device:');
  console.log('  • Phone unlocked + app background → ringtone + custom Accept/Reject screen pops');
  console.log('  • Phone locked → screen wakes + custom Accept/Reject screen over the lockscreen');
  console.log('  • App killed → app launches → custom Accept/Reject screen');
  process.exit(0);
} catch (e) {
  console.error('FCM send FAILED:', e?.message ?? e);
  process.exit(1);
}
