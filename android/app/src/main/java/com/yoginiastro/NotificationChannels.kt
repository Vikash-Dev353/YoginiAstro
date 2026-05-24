package com.yoginiastro

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.media.AudioAttributes
import android.net.Uri
import android.os.Build

/**
 * Pre-creates notification channels before FCM displays a `notification` payload.
 *
 * On Android 8+, the channel's sound is fixed at creation time. FCM's
 * `android.notification.sound` + `channel_id` only work if this channel already
 * exists with [R.raw.custom_sound] attached.
 */
object NotificationChannels {
  const val SOUND_CHANNEL_ID = "sound_channel"

  fun ensureSoundChannel(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

    val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (nm.getNotificationChannel(SOUND_CHANNEL_ID) != null) return

    val soundUri =
      Uri.parse("android.resource://${context.packageName}/${R.raw.custom_sound}")
    val audioAttributes =
      AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_NOTIFICATION)
        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
        .build()

    val channel =
      NotificationChannel(
        SOUND_CHANNEL_ID,
        "Push notifications",
        NotificationManager.IMPORTANCE_HIGH,
      ).apply {
        description = "Sound for push notifications (custom_sound)"
        setSound(soundUri, audioAttributes)
        enableVibration(true)
        enableLights(true)
      }
    nm.createNotificationChannel(channel)
  }
}
