package ai.monster.callguard.service

import ai.monster.callguard.ProtectionState
import android.content.Context
import android.content.Intent
import android.net.VpnService
import android.os.ParcelFileDescriptor
import java.io.FileInputStream
import java.util.concurrent.atomic.AtomicBoolean

class LockdownVpnService : VpnService() {
    private var iface: ParcelFileDescriptor? = null
    private val running = AtomicBoolean(false)

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopLockdown()
            stopSelf()
            return START_NOT_STICKY
        }
        if (running.compareAndSet(false, true)) {
            establishLockdown()
            ProtectionState.networkLocked.set(true)
        }
        return START_STICKY
    }

    private fun establishLockdown() {
        val builder = Builder()
            .setSession("MonsterCallGuard-Lockdown")
            .setMtu(1500)
            .addAddress("10.255.0.2", 32)
            .addRoute("0.0.0.0", 0)
        iface = builder.establish()
        Thread {
            try {
                val stream = FileInputStream(iface!!.fileDescriptor)
                val buf = ByteArray(32767)
                while (running.get()) {
                    stream.read(buf)
                }
            } catch (_: Exception) {
            }
        }.start()
    }

    private fun stopLockdown() {
        running.set(false)
        iface?.close()
        iface = null
        ProtectionState.networkLocked.set(false)
    }

    override fun onDestroy() {
        stopLockdown()
        super.onDestroy()
    }

    companion object {
        const val ACTION_STOP = "ai.monster.callguard.STOP_VPN"

        fun start(context: Context) {
            val intent = VpnService.prepare(context)
            if (intent != null) {
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                context.startActivity(intent)
                return
            }
            context.startService(Intent(context, LockdownVpnService::class.java))
        }

        fun stop(context: Context) {
            context.startService(
                Intent(context, LockdownVpnService::class.java).setAction(ACTION_STOP),
            )
        }
    }
}