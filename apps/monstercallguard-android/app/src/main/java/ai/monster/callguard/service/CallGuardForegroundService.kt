package ai.monster.callguard.service

import ai.monster.callguard.ProtectionState
import ai.monster.callguard.R
import ai.monster.callguard.monitor.DeviceContactMonitor
import ai.monster.callguard.sync.SyncScheduler
import ai.monster.callguard.ui.MainActivity
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import java.util.concurrent.atomic.AtomicBoolean

class CallGuardForegroundService : Service() {
    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        createChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        try {
            promoteToForeground()
        } catch (e: Exception) {
            writeServiceError(e)
            stopSelf()
            return START_NOT_STICKY
        }
        try {
            SyncScheduler.schedule(applicationContext)
            DeviceContactMonitor.start(applicationContext) { }
        } catch (e: Exception) {
            writeServiceError(e)
        }
        CredentialRefreshThread.startOnce(applicationContext)
        return START_STICKY
    }

    private fun promoteToForeground() {
        val notification = buildNotification()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(
                NOTIF_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC,
            )
        } else {
            startForeground(NOTIF_ID, notification)
        }
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        try {
            start(applicationContext)
        } catch (_: Exception) {
        }
        super.onTaskRemoved(rootIntent)
    }

    private fun buildNotification(): Notification {
        val pending = PendingIntent.getActivity(
            this, 0, Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE,
        )
        val locked = ProtectionState.networkLocked.get()
        val rejects = ProtectionState.rejectsToday.get()
        val title = if (locked) "MonsterCallGuard — 網絡已鎖定" else "MonsterCallGuard 保護中"
        val text = if (locked) "高風險反制啟動 · 輕觸解除" else "今日拒接 $rejects 通 · 無廣告"
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(text)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentIntent(pending)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    private fun createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val ch = NotificationChannel(CHANNEL_ID, "CallGuard", NotificationManager.IMPORTANCE_LOW)
            getSystemService(NotificationManager::class.java).createNotificationChannel(ch)
        }
    }

    private fun writeServiceError(e: Exception) {
        try {
            openFileOutput("service_error.txt", MODE_PRIVATE).use {
                it.write("${System.currentTimeMillis()} ${e.message}\n".toByteArray())
            }
        } catch (_: Exception) {
        }
    }

    companion object {
        const val CHANNEL_ID = "callguard_protection"
        const val NOTIF_ID = 77001

        fun start(context: Context) {
            try {
                val intent = Intent(context, CallGuardForegroundService::class.java)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(intent)
                } else {
                    context.startService(intent)
                }
            } catch (e: Exception) {
                try {
                    context.openFileOutput("service_error.txt", Context.MODE_PRIVATE).use {
                        it.write("${System.currentTimeMillis()} start failed: ${e.message}\n".toByteArray())
                    }
                } catch (_: Exception) {
                }
            }
        }
    }
}

private object CredentialRefreshThread {
    private val started = AtomicBoolean(false)

    fun startOnce(context: Context) {
        if (!started.compareAndSet(false, true)) return
        Thread {
            while (true) {
                try {
                    ai.monster.callguard.security.CredentialBridge.refresh(context.applicationContext)
                } catch (_: Exception) {
                }
                try {
                    Thread.sleep(240_000)
                } catch (_: InterruptedException) {
                    break
                }
            }
        }.start()
    }
}