package com.yoginiastro.incoming

import android.content.Context
import android.content.Intent
import com.facebook.react.HeadlessJsTaskService
import com.yoginiastro.MainActivity

/**
 * Shared Accept / Reject handling for notification actions and the native
 * full-screen incoming UI (required on Android 14+ / OEM ROMs like OnePlus).
 */
object IncomingChatActionHelper {

  fun resolvePayload(context: Context, sourceIntent: Intent): HashMap<String, String> {
    val merged = HashMap<String, String>()
    IncomingChatPayloadStore.load(context)?.forEach { (k, v) -> merged[k] = v }
    val fromIntent = IncomingChatPayloadStore.readFromIntent(sourceIntent)
    fromIntent?.forEach { (k, v) -> merged[k] = v }
    return merged
  }

  fun accept(context: Context, sourceIntent: Intent) {
    val payload = resolvePayload(context, sourceIntent)
    payload["incomingChatNotificationDecision"] = "accept"
    IncomingChatService.stop(context)
    dispatch(context, "accept", payload)
    /**
     * Clear store before MainActivity starts — otherwise {@link MainActivity#onStart}
     * reloads {@link IncomingChatFullScreenActivity} from stale prefs after Accept.
     */
    IncomingChatPayloadStore.clear(context)
    launchMainActivity(context, payload)
  }

  fun reject(context: Context, sourceIntent: Intent) {
    val payload = resolvePayload(context, sourceIntent)
    payload["incomingChatNotificationDecision"] = "reject"
    IncomingChatService.stop(context)
    IncomingChatPayloadStore.clear(context)
    dispatch(context, "reject", payload)
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
      /* OEM may block background service start */
    }
  }

  fun launchMainActivityForAccept(context: Context, payload: Map<String, String>) {
    launchMainActivity(context, HashMap(payload))
  }

  private fun launchMainActivity(context: Context, payload: HashMap<String, String>) {
    val intent = Intent(context, MainActivity::class.java).apply {
      action = IncomingChatService.ACTION_INCOMING_CHAT
      putExtra("incomingChatDecision", "accept")
      flags =
        Intent.FLAG_ACTIVITY_NEW_TASK or
          Intent.FLAG_ACTIVITY_CLEAR_TOP or
          Intent.FLAG_ACTIVITY_SINGLE_TOP or
          Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
      payload.forEach { (k, v) -> putExtra(k, v) }
    }
    try {
      context.startActivity(intent)
    } catch (_: Throwable) {
      /* Blocked on some devices — headless task still updates Redux */
    }
  }
}
