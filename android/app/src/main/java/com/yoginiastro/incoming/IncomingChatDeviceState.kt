package com.yoginiastro.incoming

import android.app.KeyguardManager
import android.content.Context
import android.os.Build

object IncomingChatDeviceState {
  /** `true` when the user can use the device (not on the lock screen). */
  fun isDeviceUnlocked(context: Context): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
      return true
    }
    val km = context.getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
    return !km.isKeyguardLocked
  }
}
