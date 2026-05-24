package com.yoginiastro.incoming

import android.content.Intent
import android.os.Bundle
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig

/**
 * Wakes JS for ~30s to dispatch Accept / Reject and let the React side update Redux
 * (and, for Accept, navigate to `ConsultationChat`). Triggered by
 * {@link IncomingChatActionReceiver} when the astrologer taps a notification action
 * while the app is killed/background.
 */
class IncomingChatHeadlessTaskService : HeadlessJsTaskService() {

  override fun getTaskConfig(intent: Intent?): HeadlessJsTaskConfig? {
    val extras: Bundle = intent?.extras ?: return null
    return HeadlessJsTaskConfig(
      "IncomingChatActionTask",
      Arguments.fromBundle(extras),
      30000L,
      true,
    )
  }
}
