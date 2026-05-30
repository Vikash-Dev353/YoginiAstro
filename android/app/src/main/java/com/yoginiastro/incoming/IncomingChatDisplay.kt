package com.yoginiastro.incoming

object IncomingChatDisplay {

  fun resolveTitle(payload: Map<String, String>): String {
    return payload["title"]?.trim()?.takeIf { it.isNotEmpty() }
      ?: payload["customerName"]?.trim()?.takeIf { it.isNotEmpty() }
      ?: payload["senderName"]?.trim()?.takeIf { it.isNotEmpty() }
      ?: "Incoming chat request"
  }

  fun resolveBody(payload: Map<String, String>): String {
    payload["body"]?.trim()?.takeIf { it.isNotEmpty() }?.let { return it }
    payload["message"]?.trim()?.takeIf { it.isNotEmpty() }?.let { return it }
    payload["subtitle"]?.trim()?.takeIf { it.isNotEmpty() }?.let { return it }
    payload["notificationBody"]?.trim()?.takeIf { it.isNotEmpty() }?.let { return it }
    val waiting = payload["waitingCount"]?.trim()?.takeIf { it.isNotEmpty() }
    if (waiting != null) {
      val n = waiting.toIntOrNull()
      if (n != null && n > 0) {
        return "Users waiting: $n"
      }
    }
    return "Wants to chat with you"
  }
}
