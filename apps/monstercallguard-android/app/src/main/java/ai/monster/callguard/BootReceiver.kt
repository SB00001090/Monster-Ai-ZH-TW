package ai.monster.callguard

import ai.monster.callguard.service.CallGuardForegroundService
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        if (intent?.action == Intent.ACTION_BOOT_COMPLETED) {
            val prefs = context.getSharedPreferences("callguard", Context.MODE_PRIVATE)
            if (prefs.getBoolean("protection_enabled", false)) {
                try {
                    CallGuardForegroundService.start(context)
                } catch (_: Exception) {
                }
            }
        }
    }
}