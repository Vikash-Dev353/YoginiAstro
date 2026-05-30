package com.yoginiastro

import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.yoginiastro.incoming.IncomingChatFullScreenActivity
import com.yoginiastro.incoming.IncomingChatPayloadStore
import com.yoginiastro.incoming.IncomingChatService

class MainActivity : ReactActivity() {

  override fun getMainComponentName(): String = "YoginiAstro"

  override fun createReactActivityDelegate(): ReactActivityDelegate =
    DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

  override fun onStart() {
    super.onStart()
    maybeLaunchIncomingFullScreen(intent)
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    maybeLaunchIncomingFullScreen(intent)
    super.onCreate(savedInstanceState)
    if (isIncomingChatIntent(intent)) {
      applyIncomingChatWindowFlags()
    }
  }

  override fun onNewIntent(intent: Intent) {
    maybeLaunchIncomingFullScreen(intent)
    super.onNewIntent(intent)
    setIntent(intent)
    if (isIncomingChatIntent(intent)) {
      applyIncomingChatWindowFlags()
    }
  }

  /**
   * User tapped the FCM / Notifee notification — open native Accept/Reject UI
   * immediately (do not wait for React Native to boot).
   */
  private fun maybeLaunchIncomingFullScreen(intent: Intent?) {
    val decision = intent?.getStringExtra("incomingChatDecision")?.trim()?.lowercase()
    if (decision == "accept" || decision == "reject") {
      /* Notification Answer/Decline — JS opens ConsultationChat via intent probe. */
      return
    }

    val fromIntent = IncomingChatPayloadStore.readFromIntent(intent)
    val payload = fromIntent ?: IncomingChatPayloadStore.load(this) ?: return

    IncomingChatPayloadStore.save(this, payload)
    applyIncomingChatWindowFlags()

    val fullScreenIntent =
      Intent(this, IncomingChatFullScreenActivity::class.java).apply {
        flags =
          Intent.FLAG_ACTIVITY_NEW_TASK or
            Intent.FLAG_ACTIVITY_CLEAR_TOP or
            Intent.FLAG_ACTIVITY_SINGLE_TOP or
            Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
        payload.forEach { (k, v) -> putExtra(k, v) }
      }
    try {
      startActivity(fullScreenIntent)
    } catch (_: Throwable) {
      /* OEM blocked — JS overlay probe + pending AsyncStorage may still recover */
    }
  }

  private fun isIncomingChatIntent(intent: Intent?): Boolean =
    intent?.action == IncomingChatService.ACTION_INCOMING_CHAT

  private fun applyIncomingChatWindowFlags() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      setShowWhenLocked(true)
      setTurnScreenOn(true)
    }
    window?.addFlags(
      WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
        WindowManager.LayoutParams.FLAG_ALLOW_LOCK_WHILE_SCREEN_ON,
    )
  }
}
