package com.yoginiastro.incoming

import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import android.widget.Button
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import com.yoginiastro.R

/**
 * Native full-screen incoming UI — shows immediately from the phoneCall foreground
 * service without waiting for React Native to boot (Android 14 / OnePlus / killed app).
 */
class IncomingChatFullScreenActivity : AppCompatActivity() {

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      setShowWhenLocked(true)
      setTurnScreenOn(true)
    }
    window.addFlags(
      WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
        WindowManager.LayoutParams.FLAG_ALLOW_LOCK_WHILE_SCREEN_ON,
    )

    setContentView(R.layout.activity_incoming_chat_fullscreen)

    val title =
      IncomingChatDisplay.resolveTitle(
        intent.extras?.let { extras ->
          HashMap<String, String>().apply {
            extras.keySet().forEach { key ->
              extras.getString(key)?.let { put(key, it) }
            }
          }
        } ?: emptyMap(),
      )

    val body = IncomingChatDisplay.resolveBody(
      intent.extras?.let { extras ->
        HashMap<String, String>().apply {
          extras.keySet().forEach { key ->
            extras.getString(key)?.let { put(key, it) }
          }
        }
      } ?: emptyMap(),
    )

    val customerName = intent.getStringExtra("customerName")?.trim().orEmpty()

    findViewById<TextView>(R.id.incoming_title).text = title

    val subtitleView = findViewById<TextView>(R.id.incoming_subtitle)
    if (customerName.isNotEmpty() && customerName != title) {
      subtitleView.text = customerName
      subtitleView.visibility = android.view.View.VISIBLE
    } else {
      subtitleView.visibility = android.view.View.GONE
    }

    findViewById<TextView>(R.id.incoming_body).text = body

    findViewById<Button>(R.id.btn_accept).setOnClickListener {
      IncomingChatActionHelper.accept(this, intent)
      finish()
    }

    findViewById<Button>(R.id.btn_reject).setOnClickListener {
      IncomingChatActionHelper.reject(this, intent)
      finish()
    }
  }

  @Deprecated("Deprecated in Java")
  override fun onBackPressed() {
    IncomingChatActionHelper.reject(this, intent)
    finish()
  }
}
