package com.yoginiastro.incoming

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.facebook.react.HeadlessJsTaskService
import com.yoginiastro.MainActivity

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
    val payload = HashMap<String, String>()
    intent.extras?.keySet()?.forEach { key ->
      val value = intent.extras?.getString(key) ?: return@forEach
      payload[key] = value
    }

    /** Always silence the ringer first — irrespective of dispatch outcome. */
    IncomingChatService.stop(context)

    when (action) {
      ACTION_ACCEPT -> {
        dispatch(context, "accept", payload)
        launchMainActivity(context, payload)
      }
      ACTION_REJECT -> dispatch(context, "reject", payload)
    }
  }

  private fun dispatch(context: Context, decision: String, payload: HashMap<String, String>) {
    val taskIntent = Intent(context, IncomingChatHeadlessTaskService::class.java).apply {
      putExtra("decision", decision)
      payload.forEach { (k, v) -> putExtra(k, v) }
    }
    try {
      context.startService(taskIntent)
      HeadlessJsTaskService.acquireWakeLockNow(context)
    } catch (_: Throwable) {
      /* Service launch may fail if the app is in the strict background bucket on
         some OEM ROMs — in that case the user can still tap the system
         notification to open the app and react. */
    }
  }

  /**
   * Accept needs the foreground app: the navigation target is `ConsultationChat`,
   * which only exists once a ReactActivity is alive. Launch with `ACTION_VIEW`
   * so it doesn't re-trigger the incoming-chat overlay.
   */
  private fun launchMainActivity(context: Context, payload: HashMap<String, String>) {
    val intent = Intent(context, MainActivity::class.java).apply {
      action = Intent.ACTION_VIEW
      flags =
        Intent.FLAG_ACTIVITY_NEW_TASK or
          Intent.FLAG_ACTIVITY_CLEAR_TOP or
          Intent.FLAG_ACTIVITY_SINGLE_TOP
      payload.forEach { (k, v) -> putExtra(k, v) }
    }
    try {
      context.startActivity(intent)
    } catch (_: Throwable) {
      /* Some OEMs block activity-from-receiver; the headless task will still
         update Redux so the chat shows up next time the app opens. */
    }
  }

  companion object {
    const val ACTION_ACCEPT = "com.yoginiastro.incoming.ACCEPT"
    const val ACTION_REJECT = "com.yoginiastro.incoming.REJECT"
  }
}
