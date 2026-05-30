package com.yoginiastro.incoming

import android.app.Activity
import android.content.Intent
import android.util.Log
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule

class IncomingChatModule(
  private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext), ActivityEventListener {

  init {
    reactContext.addActivityEventListener(this)
  }

  override fun getName(): String = NAME

  /**
   * Starts the ringing foreground service and (because of FOREGROUND_SERVICE_TYPE_PHONE_CALL)
   * launches MainActivity over the lock screen / on top of any other foreground app.
   *
   * Called from `setBackgroundMessageHandler` so we work even when JS itself
   * has no permission to open an Activity from the background.
   */
  /** Saves FCM payload to SharedPreferences (tap-to-open + cold start without JS). */
  @ReactMethod
  fun persistIncomingChatPayload(payload: ReadableMap, promise: Promise) {
    try {
      val map = HashMap<String, String>()
      val it = payload.keySetIterator()
      while (it.hasNextKey()) {
        val key = it.nextKey()
        val value = payload.getString(key)
        if (value != null) {
          map[key] = value
        }
      }
      IncomingChatPayloadStore.save(reactApplicationContext, map)
      promise.resolve(true)
    } catch (e: Throwable) {
      promise.reject("INCOMING_CHAT_PERSIST_FAILED", e)
    }
  }

  @ReactMethod
  fun startIncomingChat(payload: ReadableMap, promise: Promise) {
    try {
      val map = HashMap<String, String>()
      val it = payload.keySetIterator()
      while (it.hasNextKey()) {
        val key = it.nextKey()
        val value = payload.getString(key)
        if (value != null) {
          map[key] = value
        }
      }
      Log.d(TAG, "JS → startIncomingChat keys=" + map.keys.joinToString(","))
      IncomingChatService.start(reactApplicationContext, map)
      promise.resolve(true)
    } catch (e: Throwable) {
      Log.e(TAG, "startIncomingChat FAILED", e)
      promise.reject("INCOMING_CHAT_START_FAILED", e)
    }
  }

  /** Stop the looping ringer — called from JS on accept / reject / dismiss. */
  @ReactMethod
  fun stopIncomingChat(promise: Promise) {
    try {
      IncomingChatService.stop(reactApplicationContext)
      promise.resolve(true)
    } catch (e: Throwable) {
      promise.reject("INCOMING_CHAT_STOP_FAILED", e)
    }
  }

  /**
   * MainActivity may have been launched with the incoming-chat intent extras.
   * JS calls this on mount to consume them and pop the IncomingChatPushOverlay.
   * Returns null if the launch had no chat extras.
   */
  @ReactMethod
  fun consumeLaunchPayload(promise: Promise) {
    val activity = reactApplicationContext.currentActivity
    if (activity == null) {
      Log.d(TAG, "consumeLaunchPayload: no currentActivity")
      promise.resolve(null)
      return
    }
    val intent = activity.intent ?: run {
      promise.resolve(null)
      return
    }
    val decision = intent.getStringExtra("incomingChatDecision")
    val fromIntent = IncomingChatPayloadStore.readFromIntent(intent)
    val fromStore = IncomingChatPayloadStore.load(reactApplicationContext)
    val payload = mergePayloadMaps(fromStore, fromIntent)
    val hasIncoming =
      intent.action == IncomingChatService.ACTION_INCOMING_CHAT ||
        decision != null ||
        payload != null
    if (!hasIncoming) {
      Log.d(TAG, "consumeLaunchPayload: no incoming-chat intent (action=" +
        intent.action + ")")
      promise.resolve(null)
      return
    }
    val map = payload ?: Arguments.createMap()
    if (decision != null) {
      map.putString("incomingChatDecision", decision)
    }
    Log.d(TAG, "consumeLaunchPayload: returning payload decision=" + (decision ?: ""))
    intent.removeExtra("incomingChatDecision")
    intent.action = null
    activity.intent = intent
    promise.resolve(map)
  }

  @ReactMethod
  fun addListener(eventName: String?) {
    /* Required by RN; the listener registry is per-module on the JS side. */
  }

  @ReactMethod
  fun removeListeners(count: Int) {
    /* Required by RN. */
  }

  override fun onActivityResult(
    activity: Activity,
    requestCode: Int,
    resultCode: Int,
    data: Intent?,
  ) {
    /* Not used. */
  }

  /**
   * `singleTask` MainActivity gets `onNewIntent` (proxied here as `onNewIntent`)
   * when the service launches it while the app is already running. Forward the
   * payload to JS so the overlay pops without needing a remount.
   */
  override fun onNewIntent(intent: Intent) {
    if (intent.action != IncomingChatService.ACTION_INCOMING_CHAT) {
      return
    }
    val decision = intent.getStringExtra("incomingChatDecision")
    val payload = mergePayloadMaps(
      IncomingChatPayloadStore.load(reactApplicationContext),
      IncomingChatPayloadStore.readFromIntent(intent),
    ) ?: return
    if (decision != null) {
      payload.putString("incomingChatDecision", decision)
    }
    Log.d(
      TAG,
      "onNewIntent → emitting $EVENT_INCOMING_CHAT decision=" + (decision ?: ""),
    )
    reactContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      ?.emit(EVENT_INCOMING_CHAT, payload)
  }

  private fun mergePayloadMaps(
    store: HashMap<String, String>?,
    intent: HashMap<String, String>?,
  ): WritableMap? {
    val merged = HashMap<String, String>()
    store?.forEach { (k, v) -> merged[k] = v }
    intent?.forEach { (k, v) -> merged[k] = v }
    if (merged.isEmpty()) {
      return null
    }
    val map = Arguments.createMap()
    merged.forEach { (k, v) -> map.putString(k, v) }
    return map
  }

  companion object {
    const val NAME = "IncomingChat"
    const val EVENT_INCOMING_CHAT = "IncomingChat:onIntent"
    private const val TAG = "IncomingChatMod"
  }
}
