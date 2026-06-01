package com.yoginiastro.incoming

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.net.Uri
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.Person
import com.yoginiastro.MainActivity
import com.yoginiastro.R

/**
 * Foreground service that runs while an incoming-chat request is ringing.
 *
 * Why a service?
 *   On Android 10+ you cannot launch an activity directly from a background context
 *   (e.g. JS `setBackgroundMessageHandler`) when the device is unlocked. A foreground
 *   service of `phoneCall` type IS allowed to launch activities — the same trick
 *   WhatsApp/Zoom use to pop their full-screen incoming-call UI even when the user
 *   has another app open.
 *
 * Lifecycle:
 *   START_INCOMING — show ongoing notification + (try to) launch MainActivity over lock.
 *   STOP_INCOMING  — astrologer accepted/rejected (or the request expired).
 */
class IncomingChatService : Service() {

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    Log.d(TAG, "[1] onStartCommand action=" + (intent?.action ?: "null"))
    when (intent?.action) {
      ACTION_START -> handleStart(intent)
      ACTION_STOP -> handleStop()
      else -> stopSelfSafely()
    }
    return START_NOT_STICKY
  }

  private fun handleStart(intent: Intent) {
    val payload = HashMap<String, String>()
    intent.extras?.keySet()?.forEach { key ->
      intent.getStringExtra(key)?.let { payload[key] = it }
    }
    Log.d(TAG, "[2] handleStart roomId=" + payload["roomId"] +
      " from=" + payload["senderId"] + " name=" + payload["customerName"])

    IncomingChatPayloadStore.save(this, payload)

    val callerName = IncomingChatDisplay.resolveTitle(payload)
    val callerSubtitle = IncomingChatDisplay.resolveBody(payload)

    /**
     * Backend currently includes a `notification` field in its FCM payload,
     * which makes Android auto-display its own banner before our handler runs.
     * Cancel anything currently displayed so the user only sees the custom
     * call-style ongoing notification + ringing overlay.
     */
    try {
      NotificationManagerCompat.from(this).cancelAll()
      Log.d(TAG, "[2a] cancelled all prior displayed notifications")
    } catch (e: Throwable) {
      Log.w(TAG, "[2a] cancelAll failed", e)
    }

    ensureChannel()
    val notification = buildOngoingNotification(callerName, callerSubtitle, payload)

    /**
     * Promote ourselves to a foreground service of `phoneCall` type so:
     *  - The notification is non-removable while ringing.
     *  - We're allowed to call `startActivity` from here even when the device is
     *    unlocked and another app is in the foreground.
     */
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        startForeground(
          ONGOING_NOTIFICATION_ID,
          notification,
          ServiceInfo.FOREGROUND_SERVICE_TYPE_PHONE_CALL,
        )
      } else {
        startForeground(ONGOING_NOTIFICATION_ID, notification)
      }
      Log.d(TAG, "[3] startForeground OK (phoneCall type)")
    } catch (e: Throwable) {
      Log.e(TAG, "[3] startForeground FAILED — likely missing FOREGROUND_SERVICE_PHONE_CALL", e)
    }

    if (!IncomingChatDeviceState.isDeviceUnlocked(this)) {
      launchIncomingActivity(payload)
    } else {
      Log.d(TAG, "[4] device unlocked — ring in tray; tap opens app overlay")
    }
  }

  private fun handleStop() {
    stopSelfSafely()
  }

  private fun stopSelfSafely() {
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
        stopForeground(Service.STOP_FOREGROUND_REMOVE)
      } else {
        @Suppress("DEPRECATION")
        stopForeground(true)
      }
    } catch (_: Throwable) {
      /* swallow — best effort cleanup */
    }
    stopSelf()
  }

  private fun ensureChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (nm.getNotificationChannel(CHANNEL_ID) != null) return

    val channel = NotificationChannel(
      CHANNEL_ID,
      "Incoming chat call",
      NotificationManager.IMPORTANCE_HIGH,
    ).apply {
      description = "Plays while a user is requesting a chat with the astrologer"
      enableLights(true)
      enableVibration(true)
      lockscreenVisibility = Notification.VISIBILITY_PUBLIC
      setBypassDnd(true)
      setShowBadge(true)

      val ringUri = Uri.parse(
        "android.resource://" + packageName + "/" + R.raw.incoming_chat_ring,
      )
      val attrs = AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
        .build()
      setSound(ringUri, attrs)
    }
    nm.createNotificationChannel(channel)
  }

  private fun buildOngoingNotification(
    title: String,
    body: String,
    payload: HashMap<String, String>,
  ): Notification {
    val deviceUnlocked = IncomingChatDeviceState.isDeviceUnlocked(this)
    val tapIntent =
      if (deviceUnlocked) {
        mainActivityIntent(payload)
      } else {
        fullScreenActivityIntent(payload)
      }

    val contentPI = PendingIntent.getActivity(
      this,
      REQ_CONTENT,
      tapIntent,
      pendingIntentFlags(),
    )

    val builder = NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(R.mipmap.ic_launcher)
      .setContentTitle(title)
      .setContentText(body)
      .setCategory(NotificationCompat.CATEGORY_CALL)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setPriority(NotificationCompat.PRIORITY_MAX)
      .setOngoing(true)
      .setAutoCancel(false)
      .setShowWhen(true)
      .setOnlyAlertOnce(false)
      .setContentIntent(contentPI)

    if (deviceUnlocked) {
      /** Unlocked: tap only → MainActivity → React custom Accept/Reject overlay. */
      return builder.build()
    }

    builder.setFullScreenIntent(contentPI, true)

    val acceptIntent = actionReceiverIntent(
      IncomingChatActionReceiver.ACTION_ACCEPT,
      payload,
    )
    val rejectIntent = actionReceiverIntent(
      IncomingChatActionReceiver.ACTION_REJECT,
      payload,
    )
    val acceptPI = PendingIntent.getBroadcast(
      this, REQ_ACCEPT, acceptIntent, pendingIntentFlags(),
    )
    val rejectPI = PendingIntent.getBroadcast(
      this, REQ_REJECT, rejectIntent, pendingIntentFlags(),
    )

    /**
     * Locked: CallStyle Decline / Answer (Android 12+) or icon actions.
     */
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      val caller = Person.Builder().setName(title).build()
      builder
        .setContentText(body)
        .setStyle(
          NotificationCompat.CallStyle.forIncomingCall(caller, rejectPI, acceptPI),
        )
    } else {
      builder
        .addAction(R.drawable.ic_notif_action_reject, "Reject", rejectPI)
        .addAction(R.drawable.ic_notif_action_accept, "Accept", acceptPI)
    }

    return builder.build()
  }

  private fun actionReceiverIntent(
    action: String,
    payload: HashMap<String, String>,
  ): Intent =
    Intent(this, IncomingChatActionReceiver::class.java).apply {
      this.action = action
      payload.forEach { (k, v) -> putExtra(k, v) }
    }

  private fun mainActivityIntent(payload: HashMap<String, String>): Intent {
    return Intent(this, MainActivity::class.java).apply {
      action = ACTION_INCOMING_CHAT
      flags =
        Intent.FLAG_ACTIVITY_NEW_TASK or
          Intent.FLAG_ACTIVITY_CLEAR_TOP or
          Intent.FLAG_ACTIVITY_SINGLE_TOP or
          Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
      payload.forEach { (k, v) -> putExtra(k, v) }
    }
  }

  private fun fullScreenActivityIntent(payload: HashMap<String, String>): Intent {
    return Intent(this, IncomingChatFullScreenActivity::class.java).apply {
      flags =
        Intent.FLAG_ACTIVITY_NEW_TASK or
          Intent.FLAG_ACTIVITY_CLEAR_TOP or
          Intent.FLAG_ACTIVITY_SINGLE_TOP or
          Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
      payload.forEach { (k, v) -> putExtra(k, v) }
    }
  }

  private fun launchIncomingActivity(payload: HashMap<String, String>) {
    /**
     * Android 14+ / OnePlus: launching React MainActivity from background is often
     * blocked. The native full-screen activity shows instantly; Accept opens MainActivity.
     */
    try {
      val intent = fullScreenActivityIntent(payload)
      startActivity(intent)
      Log.d(TAG, "[4] IncomingChatFullScreenActivity startActivity OK")
    } catch (e: Throwable) {
      Log.e(TAG, "[4] full-screen launch FAILED, trying MainActivity", e)
      try {
        startActivity(mainActivityIntent(payload))
        Log.d(TAG, "[4] MainActivity fallback startActivity OK")
      } catch (e2: Throwable) {
        Log.e(TAG, "[4] MainActivity fallback FAILED", e2)
      }
    }
  }

  private fun pendingIntentFlags(): Int =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    } else {
      PendingIntent.FLAG_UPDATE_CURRENT
    }

  companion object {
    private const val TAG = "IncomingChatService"
    const val CHANNEL_ID = "incoming_chat_call_v1"
    const val ONGOING_NOTIFICATION_ID = 7011
    const val ACTION_START = "com.yoginiastro.incoming.START"
    const val ACTION_STOP = "com.yoginiastro.incoming.STOP"
    const val ACTION_INCOMING_CHAT = "com.yoginiastro.incoming.INCOMING_CHAT"

    private const val REQ_CONTENT = 1101
    private const val REQ_ACCEPT = 1102
    private const val REQ_REJECT = 1103

    fun start(context: Context, payload: Map<String, String>) {
      Log.d(TAG, "[0] start() called from JS bridge — payload keys=" + payload.keys.joinToString(","))
      val intent = Intent(context, IncomingChatService::class.java).apply {
        action = ACTION_START
        payload.forEach { (k, v) -> putExtra(k, v) }
      }
      try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          context.startForegroundService(intent)
        } else {
          context.startService(intent)
        }
        Log.d(TAG, "[0] startForegroundService dispatched")
      } catch (e: Throwable) {
        Log.e(TAG, "[0] startForegroundService FAILED", e)
      }
    }

    fun stop(context: Context) {
      val intent = Intent(context, IncomingChatService::class.java).apply {
        action = ACTION_STOP
      }
      context.startService(intent)
    }
  }
}
