package com.yoginiastro.incoming

import android.content.Context
import android.content.Intent
import android.os.Bundle

/**
 * Persists incoming-chat FCM data in SharedPreferences so MainActivity can open the
 * native full-screen UI when the user taps a notification (Android 14 / OnePlus often
 * never runs the JS background handler for notification+data payloads).
 */
object IncomingChatPayloadStore {

  private const val PREFS = "incoming_chat_native_pending_v1"
  private const val KEY_STORED_AT = "_storedAt"

  private val IGNORED_EXTRA_PREFIXES = listOf("google.", "gcm.", "android.", "collapse_key")

  fun looksLikeIncomingChat(data: Map<String, String>): Boolean {
    val type = data["type"]?.trim()?.lowercase().orEmpty()
    val event = data["event"]?.trim()?.lowercase().orEmpty()
    val navigateTo = data["navigateTo"]?.trim()?.lowercase().orEmpty()
    val isExplicitWaitlistUpdate =
      type.contains("waitlist") || event.contains("waitlist")
    // Incoming chat may also route to waitlist — only skip pure waitlist updates.
    if (isExplicitWaitlistUpdate && navigateTo.contains("waitlist")) {
      return false
    }
    if (
      type == "incoming_chat" ||
      type == "incoming-chat" ||
      type == "chat_request" ||
      event == "incoming_chat" ||
      event == "chat_request"
    ) {
      return hasRoomAndSender(data)
    }
    return hasRoomAndSender(data)
  }

  private fun hasRoomAndSender(data: Map<String, String>): Boolean {
    val roomId = data["roomId"]?.trim().orEmpty()
    val sender =
      data["senderId"]?.trim().orEmpty()
        .ifEmpty { data["from"]?.trim().orEmpty() }
        .ifEmpty { data["userId"]?.trim().orEmpty() }
        .ifEmpty { data["customerId"]?.trim().orEmpty() }
        .ifEmpty { data["mobile"]?.trim().orEmpty() }
    return roomId.isNotEmpty() && sender.isNotEmpty()
  }

  fun save(context: Context, data: Map<String, String>) {
    val prefs = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    val editor = prefs.edit().clear()
    data.forEach { (k, v) ->
      if (v.isNotBlank()) {
        editor.putString(k, v)
      }
    }
    editor.putLong(KEY_STORED_AT, System.currentTimeMillis())
    editor.apply()
  }

  fun load(context: Context): HashMap<String, String>? {
    val prefs = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    val storedAt = prefs.getLong(KEY_STORED_AT, 0L)
    if (storedAt == 0L) {
      return null
    }
    if (System.currentTimeMillis() - storedAt > 120_000L) {
      prefs.edit().clear().apply()
      return null
    }
    val out = HashMap<String, String>()
    for (key in prefs.all.keys) {
      if (key == KEY_STORED_AT) continue
      val value = prefs.getString(key, null) ?: continue
      out[key] = value
    }
    return if (looksLikeIncomingChat(out)) out else null
  }

  fun clear(context: Context) {
    context.applicationContext
      .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      .edit()
      .clear()
      .apply()
  }

  /** Prevents probe / intent replay from re-showing the overlay after Accept. */
  fun clearIncomingChatExtrasFromIntent(intent: Intent?) {
    if (intent == null) {
      return
    }
    readFromIntent(intent)?.keys?.forEach { key ->
      intent.removeExtra(key)
    }
    intent.removeExtra("incomingChatDecision")
    if (intent.action == IncomingChatService.ACTION_INCOMING_CHAT) {
      intent.action = null
    }
  }

  fun readFromIntent(intent: Intent?): HashMap<String, String>? {
    val extras: Bundle = intent?.extras ?: return null
    val out = HashMap<String, String>()
    for (key in extras.keySet()) {
      if (shouldIgnoreExtraKey(key)) {
        continue
      }
      val raw = extras.get(key) ?: continue
      val value = raw.toString().trim()
      if (value.isNotEmpty()) {
        out[key] = value
      }
    }
    return if (looksLikeIncomingChat(out)) out else null
  }

  private fun shouldIgnoreExtraKey(key: String): Boolean {
    if (key == KEY_STORED_AT) return true
    val lower = key.lowercase()
    if (IGNORED_EXTRA_PREFIXES.any { lower.startsWith(it) }) {
      return true
    }
    /** FCM "from" topic path, not sender id */
    if (key == "from" && lower.contains("/")) {
      return true
    }
    return false
  }
}
