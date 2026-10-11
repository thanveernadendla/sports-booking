package com.sportzone.app

import android.content.Intent
import android.content.res.Configuration
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.view.View
import android.view.Window
import androidx.core.view.WindowCompat
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        configureWindow()
    }

    /**
     * Returns the name of the main component registered from JavaScript.
     */
    override fun getMainComponentName(): String = "SportZone"

    /**
     * Delegate configuration for React Native Architecture.
     */
    override fun createReactActivityDelegate(): ReactActivityDelegate =
        DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

    /**
     * Handle incoming deep links and external Android intents.
     */
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
    }

    /**
     * Handle native Android configuration changes (orientation, theme, screen size).
     */
    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
    }

    /**
     * Custom window configuration for SportZone dark theme status bar.
     */
    private fun configureWindow() {
        try {
            window.statusBarColor = Color.parseColor("#0f172a")
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                val decorView = window.decorView
                decorView.systemUiVisibility = decorView.systemUiVisibility and View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR.inv()
            }
            WindowCompat.setDecorFitsSystemWindows(window, true)
        } catch (e: Exception) {
            // Safely swallow vendor OS system UI flag exceptions
        }
    }
}
