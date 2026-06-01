package com.yoginiastro.push

import android.app.ActivityManager
import android.content.Context
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
        /**
         * When the app is in the foreground, React Native shows the custom
         * Accept/Reject overlay. Starting the native phoneCall service here races
         * with JS (which stops the service) and leaves unlocked users with no UI.
         */
        if (!isAppInForeground()) {
          IncomingChatService.start(applicationContext, data)
        } else {
          Log.d(TAG, "app foreground — defer ring/notification to React Native")
        }
      }
    } catch (e: Throwable) {
      Log.e(TAG, "pre-handle failed", e)
    }
    super.onMessageReceived(remoteMessage)
  }

  private fun isAppInForeground(): Boolean {
    val am = getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
    val processes = am.runningAppProcesses ?: return false
    for (proc in processes) {
      if (
        proc.processName == packageName &&
        proc.importance == ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND
      ) {
        return true
      }
    }
    return false
  }

  companion object {
    private const val TAG = "YoginiFcmService"
  }
}
