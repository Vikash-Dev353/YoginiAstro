package com.yoginiastro.incoming

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
/**
 * Notification action handler. When the astrologer taps Accept / Reject from
 * the system tray we:
 *   1. Stop the ringing foreground service immediately.
 *   2. Hand the payload to JS via a Headless task — it dispatches to Redux
 *      and (for Accept) navigates to ConsultationChat.
 *   3. For Accept, also launch MainActivity so the user lands in the app.
 */
class IncomingChatActionReceiver : BroadcastReceiver() {

  override fun onReceive(context: Context, intent: Intent) {
    val action = intent.action ?: return
    when (action) {
      ACTION_ACCEPT -> IncomingChatActionHelper.accept(context, intent)
      ACTION_REJECT -> IncomingChatActionHelper.reject(context, intent)
    }
  }

  companion object {
    const val ACTION_ACCEPT = "com.yoginiastro.incoming.ACCEPT"
    const val ACTION_REJECT = "com.yoginiastro.incoming.REJECT"
  }
}
