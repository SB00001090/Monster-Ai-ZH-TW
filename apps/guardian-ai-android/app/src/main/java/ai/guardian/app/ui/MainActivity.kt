package ai.guardian.app.ui

import ai.guardian.app.billing.BillingManager
import ai.guardian.app.billing.TrialManager
import ai.guardian.app.network.ConnectionManager
import ai.guardian.app.network.ConnectionState
import ai.guardian.app.network.HomeMonsterClient
import ai.guardian.app.network.TunnelConnection
import ai.guardian.app.sync.SyncScheduler
import ai.guardian.app.ui.screens.GuardianSyncScreen
import ai.guardian.app.ui.screens.HomeScreen
import ai.guardian.app.ui.screens.PaywallScreen
import ai.guardian.app.ui.screens.PrivacyScreen
import ai.guardian.app.ui.theme.GuardianAiTheme
import android.Manifest
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import kotlinx.coroutines.launch
import java.io.File
import java.util.concurrent.TimeUnit

/** Developed by Suckbob | Guardian Ai */
class MainActivity : ComponentActivity() {
    private lateinit var trialManager: TrialManager
    private lateinit var billingManager: BillingManager
    private val connectionManager by lazy { ConnectionManager.get(this) }

    private var statusText by mutableStateOf("")
    private var trialLabel by mutableStateOf("")
    private var tunnelUrl by mutableStateOf("")

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        trialManager = TrialManager(this)
        trialManager.ensureTrialStarted()
        billingManager = BillingManager(this, trialManager) { refreshTrialLabel() }
        billingManager.start()

        tunnelUrl = TunnelConnection.loadSaved(this).orEmpty()
        statusText = readCrashLog().ifBlank { TunnelConnection.setupHint() }
        refreshTrialLabel()
        requestRuntimePermissions()
        SyncScheduler.schedule(this)

        lifecycleScope.launch { connectionManager.probeHealth() }

        setContent {
            GuardianAiTheme {
                val nav = rememberNavController()
                val connState by connectionManager.state.collectAsState()
                val connMode by connectionManager.mode.collectAsState()
                Scaffold { pad ->
                    NavHost(nav, "home", Modifier.padding(pad)) {
                        composable("home") {
                            HomeScreen(
                                statusText = statusText,
                                tunnelUrl = tunnelUrl,
                                connectionState = connState,
                                connectionMode = connMode,
                                trialLabel = trialLabel,
                                onTunnelChange = { tunnelUrl = it },
                                onSave = { saveTunnel() },
                                onTest = { testConnection() },
                                onNavPaywall = { nav.navigate("paywall") },
                                onNavPrivacy = { nav.navigate("privacy") },
                                onNavGuardianSync = { nav.navigate("guardian") },
                            )
                        }
                        composable("guardian") {
                            GuardianSyncScreen(onBack = { nav.popBackStack() })
                        }
                        composable("paywall") {
                            PaywallScreen(
                                trialManager = trialManager,
                                billingManager = billingManager,
                                onPurchase = { billingManager.launchPurchase(this@MainActivity) },
                                onRestore = { billingManager.restorePurchases() },
                            )
                        }
                        composable("privacy") { PrivacyScreen() }
                    }
                }
            }
        }
    }

    override fun onDestroy() {
        billingManager.destroy()
        super.onDestroy()
    }

    private fun refreshTrialLabel() {
        trialLabel = when {
            trialManager.isPurchased() -> "已永久解鎖 ✓"
            trialManager.isTrialActive() -> {
                val ms = trialManager.trialRemainingMs()
                val d = TimeUnit.MILLISECONDS.toDays(ms)
                val h = TimeUnit.MILLISECONDS.toHours(ms) % 24
                "試用中 · 剩餘 ${d}天${h}時"
            }
            else -> "試用已結束 · 請永久解鎖"
        }
    }

    private fun saveTunnel() {
        val err = TunnelConnection.validateOrError(tunnelUrl)
        if (err != null) {
            statusText = err
            Toast.makeText(this, err, Toast.LENGTH_LONG).show()
            return
        }
        val saved = connectionManager.saveTunnelUrl(tunnelUrl)
        if (saved == null) {
            statusText = "無法儲存 — 請貼完整 https://xxx.trycloudflare.com"
            Toast.makeText(this, "無效 URL", Toast.LENGTH_LONG).show()
            return
        }
        tunnelUrl = saved
        Toast.makeText(this, "已儲存，正在測試連線…", Toast.LENGTH_SHORT).show()
        lifecycleScope.launch {
            val ok = connectionManager.probeHealth()
            statusText = HomeMonsterClient(this@MainActivity).testConnection()
            if (ok) {
                Toast.makeText(this@MainActivity, "連線成功", Toast.LENGTH_SHORT).show()
            } else {
                Toast.makeText(
                    this@MainActivity,
                    "已儲存但連線失敗 — 請確認電腦已執行 auto-guardian.bat 且 URL 為最新",
                    Toast.LENGTH_LONG,
                ).show()
            }
        }
    }

    private fun testConnection() {
        lifecycleScope.launch {
            statusText = "測試連線中…"
            statusText = HomeMonsterClient(this@MainActivity).testConnection()
        }
    }

    private fun requestRuntimePermissions() {
        val perms = mutableListOf<String>()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            perms.add(Manifest.permission.POST_NOTIFICATIONS)
        }
        if (perms.isNotEmpty()) {
            ActivityCompat.requestPermissions(
                this,
                perms.filter {
                    ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
                }.toTypedArray(),
                1,
            )
        }
        val pm = getSystemService(POWER_SERVICE) as PowerManager
        if (!pm.isIgnoringBatteryOptimizations(packageName)) {
            try {
                startActivity(
                    android.content.Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)
                        .setData(Uri.parse("package:$packageName")),
                )
            } catch (_: Exception) {
            }
        }
    }

    private fun readCrashLog(): String {
        val f = File(filesDir, "last_crash.txt")
        return if (f.exists()) f.readText().take(500) else ""
    }
}