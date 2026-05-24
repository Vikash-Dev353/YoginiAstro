package com.yoginiastro

import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.yoginiastro.incoming.IncomingChatService

class MainActivity : ReactActivity() {

  override fun getMainComponentName(): String = "YoginiAstro"

  override fun createReactActivityDelegate(): ReactActivityDelegate =
    DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    if (isIncomingChatIntent(intent)) {
      applyIncomingChatWindowFlags()
    }
  }

  /**
   * `singleTask` + foreground service re-launch: forward the new intent to RN
   * (`IncomingChatModule.onNewIntent`) and keep extras for `consumeLaunchPayload`.
   */
  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    if (isIncomingChatIntent(intent)) {
      applyIncomingChatWindowFlags()
    }
  }

  private fun isIncomingChatIntent(intent: Intent?): Boolean =
    intent?.action == IncomingChatService.ACTION_INCOMING_CHAT

  /** Show the incoming-chat overlay above the lock screen when the service wakes the app. */
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
