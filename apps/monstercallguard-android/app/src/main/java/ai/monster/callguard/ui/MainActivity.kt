package ai.monster.callguard.ui

import ai.monster.callguard.ProtectionState
import ai.monster.callguard.R
import ai.monster.callguard.network.HomeMonsterClient
import ai.monster.callguard.network.LanDiscovery
import ai.monster.callguard.service.CallGuardForegroundService
import ai.monster.callguard.service.LockdownVpnService
import android.Manifest
import android.app.role.RoleManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.provider.Settings
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import java.io.File
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat

class MainActivity : AppCompatActivity() {
    private val handler = Handler(Looper.getMainLooper())

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        requestRuntimePermissions()

        val prefs = getSharedPreferences("callguard", Context.MODE_PRIVATE)
        val statusView = findViewById<TextView>(R.id.status)
        val crash = readCrashLog()
        if (crash.isNotBlank()) {
            statusView.text = "上次崩潰紀錄：\n$crash"
        }

        val lanField = findViewById<EditText>(R.id.lanHost)
        val tailscaleField = findViewById<EditText>(R.id.tailscaleHost)
        lanField.setText(prefs.getString("lan_host", ""))
        tailscaleField.setText(prefs.getString("tailscale_host", ""))
        findViewById<EditText>(R.id.homeUrl).setText(prefs.getString("home_url", ""))

        findViewById<Button>(R.id.autoDiscover).setOnClickListener {
            runAutoDiscover(prefs, lanField, tailscaleField, statusView, saveAfterFind = true)
        }

        if (prefs.getString("lan_host", "").isNullOrBlank() &&
            prefs.getString("tailscale_host", "").isNullOrBlank() &&
            prefs.getString("home_url", "").isNullOrBlank()
        ) {
            runAutoDiscover(prefs, lanField, tailscaleField, statusView, saveAfterFind = true)
        }

        findViewById<Button>(R.id.saveHosts).setOnClickListener {
            prefs.edit()
                .putString("lan_host", findViewById<EditText>(R.id.lanHost).text.toString())
                .putString("tailscale_host", findViewById<EditText>(R.id.tailscaleHost).text.toString())
                .putString("home_url", findViewById<EditText>(R.id.homeUrl).text.toString())
                .apply()
            Toast.makeText(this, "已儲存", Toast.LENGTH_SHORT).show()
        }

        findViewById<Button>(R.id.testConnection).setOnClickListener {
            Thread {
                val msg = HomeMonsterClient(this).testConnection()
                runOnUiThread {
                    findViewById<TextView>(R.id.status).text = msg
                }
            }.start()
        }

        findViewById<Button>(R.id.enableScreening).setOnClickListener { requestCallScreeningRole() }
        findViewById<Button>(R.id.startProtection).setOnClickListener {
            prefs.edit().putBoolean("protection_enabled", true).apply()
            CallGuardForegroundService.start(this)
            Toast.makeText(this, "背景保護已啟動", Toast.LENGTH_SHORT).show()
        }
        findViewById<Button>(R.id.batteryOpt).setOnClickListener { requestBatteryExemption() }
        findViewById<Button>(R.id.unlockNetwork).setOnClickListener {
            LockdownVpnService.stop(this)
            ProtectionState.resetHighRisk()
            Toast.makeText(this, "已請求解除網絡鎖定", Toast.LENGTH_SHORT).show()
        }
        findViewById<Button>(R.id.callHotline).setOnClickListener {
            startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:18222")))
        }

        handler.post(object : Runnable {
            override fun run() {
                val locked = ProtectionState.networkLocked.get()
                val rejects = ProtectionState.rejectsToday.get()
                findViewById<TextView>(R.id.stats).text =
                    "今日拒接: $rejects · 網絡鎖定: ${if (locked) "是" else "否"}"
                handler.postDelayed(this, 2000)
            }
        })
    }

    private fun requestRuntimePermissions() {
        val perms = mutableListOf(Manifest.permission.READ_PHONE_STATE, Manifest.permission.READ_CALL_LOG)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            perms.add(Manifest.permission.POST_NOTIFICATIONS)
        }
        val needed = perms.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }
        if (needed.isNotEmpty()) {
            ActivityCompat.requestPermissions(this, needed.toTypedArray(), 100)
        }
    }

    private fun runAutoDiscover(
        prefs: android.content.SharedPreferences,
        lanField: EditText,
        tailscaleField: EditText,
        statusView: TextView,
        saveAfterFind: Boolean,
    ) {
        statusView.text = "正在自動偵測（區網 + Tailscale）…"
        Thread {
            val result = LanDiscovery.discover(applicationContext)
            val local = LanDiscovery.getLocalIpv4(applicationContext)
            runOnUiThread {
                if (result != null) {
                    if (result.mode == "tailscale") {
                        tailscaleField.setText(result.host)
                        lanField.setText("")
                        if (saveAfterFind) {
                            prefs.edit()
                                .putString("tailscale_host", result.host)
                                .putString("lan_host", "")
                                .apply()
                        }
                        statusView.text = "已透過 Tailscale 找到：${result.host}（手機 IP：${local ?: "未知"}）"
                    } else {
                        lanField.setText(result.host)
                        if (saveAfterFind) {
                            prefs.edit().putString("lan_host", result.host).apply()
                        }
                        statusView.text = "已透過區網找到：${result.host}（手機 IP：${local ?: "未知"}）"
                    }
                    Toast.makeText(this, "已連線至 ${result.host}", Toast.LENGTH_SHORT).show()
                } else {
                    statusView.text = LanDiscovery.failureHint(local)
                }
            }
        }.start()
    }

    private fun readCrashLog(): String {
        return try {
            val f = File(filesDir, "last_crash.txt")
            if (!f.exists()) return ""
            f.readText().take(500)
        } catch (_: Exception) {
            ""
        }
    }

    private fun requestBatteryExemption() {
        val pm = getSystemService(PowerManager::class.java) ?: return
        if (pm.isIgnoringBatteryOptimizations(packageName)) {
            Toast.makeText(this, "已關閉電池最佳化限制", Toast.LENGTH_SHORT).show()
            return
        }
        try {
            startActivity(
                Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                    data = Uri.parse("package:$packageName")
                },
            )
        } catch (_: Exception) {
            startActivity(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))
        }
        Toast.makeText(
            this,
            "DOOGEE：請同時到 設定→應用程式→MonsterCallGuard→自動啟動→開啟",
            Toast.LENGTH_LONG,
        ).show()
    }

    private fun requestCallScreeningRole() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val role = getSystemService(RoleManager::class.java)
            if (role != null && role.isRoleAvailable(RoleManager.ROLE_CALL_SCREENING)) {
                startActivity(role.createRequestRoleIntent(RoleManager.ROLE_CALL_SCREENING))
            }
        }
    }
}