package ai.monster.callguard.monitor

import ai.monster.callguard.ProtectionState
import ai.monster.callguard.service.LockdownVpnService
import android.bluetooth.BluetoothAdapter
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.hardware.usb.UsbManager
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Build
import android.os.Handler
import android.os.Looper
import androidx.core.content.ContextCompat

data class DeviceContactResult(
    val detected: Boolean,
    val usb: Boolean,
    val bluetooth: Boolean,
    val mobileData: Boolean,
    val signals: List<String>,
)

object DeviceContactMonitor {
    private var registered = false
    private val handler = Handler(Looper.getMainLooper())
    private var callback: ((DeviceContactResult) -> Unit)? = null

    fun start(context: Context, onContact: (DeviceContactResult) -> Unit) {
        callback = onContact
        if (registered) return
        registered = true

        val receiver = object : BroadcastReceiver() {
            override fun onReceive(ctx: Context, intent: Intent?) {
                evaluate(ctx.applicationContext)
            }
        }
        val filter = IntentFilter().apply {
            addAction(UsbManager.ACTION_USB_DEVICE_ATTACHED)
            addAction(UsbManager.ACTION_USB_DEVICE_DETACHED)
            addAction(BluetoothAdapter.ACTION_CONNECTION_STATE_CHANGED)
            addAction(ConnectivityManager.CONNECTIVITY_ACTION)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            context.applicationContext.registerReceiver(
                receiver,
                filter,
                Context.RECEIVER_NOT_EXPORTED,
            )
        } else {
            @Suppress("DEPRECATION")
            context.applicationContext.registerReceiver(receiver, filter)
        }

        handler.postDelayed(object : Runnable {
            override fun run() {
                evaluate(context.applicationContext)
                handler.postDelayed(this, 30_000)
            }
        }, 5_000)
    }

    fun scan(context: Context): DeviceContactResult {
        val signals = mutableListOf<String>()
        var usb = false
        var bt = false
        var mobile = false

        val usbMgr = context.getSystemService(Context.USB_SERVICE) as? UsbManager
        if (usbMgr != null && usbMgr.deviceList.isNotEmpty()) {
            usb = true
            signals.add("usb:attached")
        }

        if (hasBluetoothPermission(context)) {
            try {
                val adapter = BluetoothAdapter.getDefaultAdapter()
                if (adapter != null && adapter.isEnabled && adapter.bondedDevices.isNotEmpty()) {
                    bt = true
                    signals.add("bt:bonded")
                }
            } catch (_: SecurityException) {
            }
        }

        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
        val net = cm?.activeNetwork
        val caps = cm?.getNetworkCapabilities(net)
        if (caps != null && caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR)) {
            mobile = true
            signals.add("net:cellular")
        }

        val detected = usb || bt || mobile
        return DeviceContactResult(detected, usb, bt, mobile, signals)
    }

    private fun hasBluetoothPermission(context: Context): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true
        return ContextCompat.checkSelfPermission(
            context,
            android.Manifest.permission.BLUETOOTH_CONNECT,
        ) == PackageManager.PERMISSION_GRANTED
    }

    private fun evaluate(context: Context) {
        val result = scan(context)
        callback?.invoke(result)
        if (result.detected && ProtectionState.highRiskActive.get()) {
            LockdownVpnService.start(context)
        }
    }
}