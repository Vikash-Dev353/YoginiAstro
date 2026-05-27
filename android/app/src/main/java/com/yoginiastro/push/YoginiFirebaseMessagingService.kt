package com.yoginiastro.push

import android.util.Log
import com.google.firebase.messaging.RemoteMessage
import com.yoginiastro.incoming.IncomingChatPayloadStore
import com.yoginiastro.incoming.IncomingChatService
import io.invertase.firebase.messaging.ReactNativeFirebaseMessagingService

/**
 * Native FCM entry (before JS). Required for killed-app + data payload so ring + full-screen
 * UI can start without the user tapping the tray notification.
 */
class YoginiFirebaseMessagingService : ReactNativeFirebaseMessagingService() {

  override fun onMessageReceived(remoteMessage: RemoteMessage) {
    try {
      val data = HashMap<String, String>()
      remoteMessage.data.forEach { (k, v) -> data[k] = v }
      remoteMessage.notification?.title?.let { t ->
        if (t.isNotBlank()) data["title"] = t
      }
      remoteMessage.notification?.body?.let { b ->
        if (b.isNotBlank()) data["body"] = b
      }

      if (IncomingChatPayloadStore.looksLikeIncomingChat(data)) {
        Log.d(TAG, "incoming chat FCM room=" + data["roomId"])
        IncomingChatPayloadStore.save(applicationContext, data)
        IncomingChatService.start(applicationContext, data)
      }
    } catch (e: Throwable) {
      Log.e(TAG, "pre-handle failed", e)
    }
    super.onMessageReceived(remoteMessage)
  }

  companion object {
    private const val TAG = "YoginiFcmService"
  }
}
