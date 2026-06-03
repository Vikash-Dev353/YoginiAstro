package com.yoginiastro

import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.yoginiastro.incoming.IncomingChatDeviceState
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
   * Locked: native full-screen Accept/Reject while RN boots.
   * Unlocked: notification tap → React {@code CustomIncomingNotificationScreen} only.
   */
  private fun maybeLaunchIncomingFullScreen(intent: Intent?) {
    val intentDecision = intent?.getStringExtra("incomingChatDecision")?.trim()?.lowercase()
    if (intentDecision == "accept" || intentDecision == "reject") {
      /* Accept/Decline already chosen — JS opens ConsultationChat, not this UI again. */
      return
    }

    val storePayload = IncomingChatPayloadStore.load(this)
    if (IncomingChatPayloadStore.hasTerminalDecision(storePayload)) {
      return
    }

    val fromIntent = IncomingChatPayloadStore.readFromIntent(intent)
    val payload = fromIntent ?: storePayload ?: return

    IncomingChatPayloadStore.save(this, payload)

    if (IncomingChatDeviceState.isDeviceUnlocked(this)) {
      return
    }

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
