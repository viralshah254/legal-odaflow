package com.dvtechventures.umbrella

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {

    private val CHANNEL = "com.umbrella.app/notifications"

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL)
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "createNotificationChannel" -> {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                            val id = call.argument<String>("id") ?: "umbrella_notifications"
                            val name = call.argument<String>("name") ?: "Umbrella Notifications"
                            val description = call.argument<String>("description") ?: ""
                            val importance = call.argument<Int>("importance")
                                ?: NotificationManager.IMPORTANCE_HIGH
                            val channel = NotificationChannel(id, name, importance).apply {
                                this.description = description
                                enableLights(true)
                                enableVibration(true)
                            }
                            val manager =
                                getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                            manager.createNotificationChannel(channel)
                        }
                        result.success(null)
                    }
                    else -> result.notImplemented()
                }
            }
    }
}
