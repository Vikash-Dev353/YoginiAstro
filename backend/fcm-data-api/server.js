/**
 * Sends **data-only** FCM messages (no `notification` field) so the client handles
 * presentation via @react-native-firebase/messaging + Notifee.
 *
 * NOTE: Always send data-only — never include a `notification` field. If
 * `notification` is set, FCM displays a system notification on its own (no sound,
 * no full-screen action, no Accept/Reject) **and** Android may suppress the data
 * handler in killed state. The astrologer would see a silent system notification
 * and our incoming-chat overlay would never appear.
 *
 * Configure credentials (pick one):
 *   export GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/serviceAccount.json
 * or place `serviceAccount.json` next to this file (see below).
 */

import express from 'express';
import admin from 'firebase-admin';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

function initFirebaseAdmin() {
  if (admin.apps.length > 0) {
    return;
  }
  const localPath = join(__dirname, 'serviceAccount.json');
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && existsSync(localPath)) {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = localPath;
  }
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

/**
 * All data values must be strings (FCM requirement).
 */
function stringifyData(payload) {
  const out = {};
  for (const [k, v] of Object.entries(payload)) {
    if (v === undefined || v === null) continue;
    out[k] = typeof v === 'string' ? v : String(v);
  }
  return out;
}

const app = express();
app.use(express.json({ limit: '256kb' }));

const PORT = Number(process.env.PORT || 8787);

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

/**
 * POST /v1/send-incoming-chat
 * Body JSON:
 * {
 *   "token": "<FCM registration token>",
 *   "roomId": "...",
 *   "senderId": "...",
 *   "customerName": "...",
 *   "message": "optional",
 *   "collapseKey": "optional"
 * }
 *
 * Only `data` is sent — no notification payload.
 */
app.post('/v1/send-incoming-chat', async (req, res) => {
  try {
    initFirebaseAdmin();
    const body = req.body ?? {};
    const token = body.token;
    if (!token || typeof token !== 'string') {
      res.status(400).json({ error: 'token is required' });
      return;
    }

    const roomId = body.roomId;
    const senderId = body.senderId ?? body.from;
    if (!roomId || !senderId) {
      res.status(400).json({ error: 'roomId and senderId (or from) are required' });
      return;
    }

    const data = stringifyData({
      type: 'incoming_chat',
      roomId: String(roomId),
      senderId: String(senderId),
      customerName: body.customerName != null ? String(body.customerName) : 'Chat request',
      ...(body.message != null ? { message: String(body.message) } : {}),
      ...(body.customerImage != null ? { customerImage: String(body.customerImage) } : {}),
      ...(body.kundliUrl != null ? { kundliUrl: String(body.kundliUrl) } : {}),
      ...(body.userBalance != null ? { userBalance: String(body.userBalance) } : {}),
      ...(body.astroPrice != null ? { astroPrice: String(body.astroPrice) } : {}),
    });

    const message = {
      token,
      data,
      android: {
        priority: 'high',
        collapseKey: body.collapseKey != null ? String(body.collapseKey) : undefined,
      },
      apns: {
        headers: {
          'apns-priority': '10',
        },
        payload: {
          aps: {
            contentAvailable: true,
          },
        },
      },
    };

    const id = await admin.messaging().send(message);
    res.json({ success: true, messageId: id });
  } catch (e) {
    console.error(e);
    res.status(500).json({
      error: e?.message ?? 'send failed',
    });
  }
});

app.listen(PORT, () => {
  console.log(`FCM data-only API listening on http://localhost:${PORT}`);
  console.log('POST /v1/send-incoming-chat — data-only incoming_chat payload');
});
