package com.yoginiastro.incoming

import android.app.Activity
import android.content.Intent
import android.util.Log
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule

class IncomingChatModule(
  private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext), ActivityEventListener, LifecycleEventListener {

  init {
    reactContext.addActivityEventListener(this)
    reactContext.addLifecycleEventListener(this)
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
   * Cold start after notification Accept/Decline — `onNewIntent` can fire before JS
   * listeners exist. Only replay explicit decisions here; ringing incoming-chat is
   * handled by `onNewIntent` + the overlay probe (must not stop the foreground service
   * on every resume or the tray notification disappears before login/bootstrap finishes).
   */
  override fun onHostResume() {
    val activity = reactContext.currentActivity ?: return
    val intent = activity.intent ?: return
    val decision = intent.getStringExtra("incomingChatDecision")?.trim()?.lowercase()
    if (decision != "accept" && decision != "reject") {
      return
    }
    forwardLaunchIntent(intent, "onHostResume")
  }

  override fun onHostPause() {
    /* Not used. */
  }

  override fun onHostDestroy() {
    /* Not used. */
  }

  /**
   * `singleTask` MainActivity gets `onNewIntent` when the service launches it
   * while the app is already running. Forward payload to JS for Accept/Reject.
   */
  override fun onNewIntent(intent: Intent) {
    forwardLaunchIntent(intent, "onNewIntent")
  }

  private fun forwardLaunchIntent(intent: Intent?, source: String) {
    if (intent == null) {
      return
    }
    val decision = intent.getStringExtra("incomingChatDecision")
    val isIncoming =
      intent.action == IncomingChatService.ACTION_INCOMING_CHAT ||
        decision != null
    if (!isIncoming) {
      return
    }

    val payload = mergePayloadMaps(
      IncomingChatPayloadStore.load(reactApplicationContext),
      IncomingChatPayloadStore.readFromIntent(intent),
    ) ?: Arguments.createMap()

    if (decision != null) {
      payload.putString("incomingChatDecision", decision)
    }

    if (!payload.keySetIterator().hasNextKey() && decision == null) {
      return
    }

    Log.d(
      TAG,
      "$source → emitting $EVENT_INCOMING_CHAT decision=" + (decision ?: ""),
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
