package ai.guardian.app.network

import android.content.Context
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import retrofit2.Retrofit
import retrofit2.converter.scalars.ScalarsConverterFactory
import java.io.File
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference

enum class ConnectionState {
    NOT_CONFIGURED,
    CONNECTING,
    CONNECTED,
    OFFLINE,
    DEGRADED,
}

/** USB adb reverse + Cloudflare Tunnel. Developed by Suckbob | Guardian Ai */
class ConnectionManager private constructor(context: Context) {
    private val appContext = context.applicationContext
    private val prefs = appContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    private val cacheDir = appContext.filesDir

    private val _state = MutableStateFlow(ConnectionState.NOT_CONFIGURED)
    val state: StateFlow<ConnectionState> = _state.asStateFlow()

    private val _mode = MutableStateFlow(ConnectionMode.NONE)
    val mode: StateFlow<ConnectionMode> = _mode.asStateFlow()

    private val _lastMessage = MutableStateFlow("")
    val lastMessage: StateFlow<String> = _lastMessage.asStateFlow()

    private val apiRef = AtomicReference<MonsterApiService?>(null)
    private val clientRef = AtomicReference<OkHttpClient?>(null)
    private var lastBoundBase: String? = null
    private var activeBaseUrl: String? = null

    val httpClient: OkHttpClient
        get() = clientRef.get() ?: buildClient().also { clientRef.set(it) }

    val api: MonsterApiService?
        get() {
            val base = getBaseUrl() ?: return null
            val existing = apiRef.get()
            if (existing != null && base == lastBoundBase) return existing
            val service = Retrofit.Builder()
                .baseUrl(ensureTrailingSlash(base))
                .client(httpClient)
                .addConverterFactory(ScalarsConverterFactory.create())
                .build()
                .create(MonsterApiService::class.java)
            apiRef.set(service)
            lastBoundBase = base
            return service
        }

    init {
        migrateLegacyPrefs()
        _state.value = ConnectionState.OFFLINE
    }

    fun getTunnelUrl(): String? {
        val raw = prefs.getString(KEY_TUNNEL, null)?.trim().orEmpty()
        return TunnelConnection.normalizeUrl(raw)
    }

    fun saveTunnelUrl(url: String): String? {
        val normalized = TunnelConnection.normalizeUrl(url) ?: return null
        prefs.edit()
            .putString(KEY_TUNNEL, normalized)
            .putLong(KEY_SAVED_AT, System.currentTimeMillis())
            .apply()
        resetApiClient()
        _state.value = ConnectionState.OFFLINE
        return normalized
    }

    /** Active base URL from last probe, or quick USB/Tunnel resolve. */
    fun getBaseUrl(): String? {
        activeBaseUrl?.let { return it }
        if (probeUrl(UsbBridgeConnection.BASE_URL, fast = true)) {
            activeBaseUrl = UsbBridgeConnection.BASE_URL
            _mode.value = ConnectionMode.USB_LOCAL
            return activeBaseUrl
        }
        val tunnel = getTunnelUrl()
        if (tunnel != null) {
            activeBaseUrl = tunnel
            _mode.value = ConnectionMode.TUNNEL_REMOTE
            return tunnel
        }
        _mode.value = ConnectionMode.NONE
        return null
    }

    fun probeHealth(): Boolean {
        _state.value = ConnectionState.CONNECTING
        if (probeUrl(UsbBridgeConnection.BASE_URL, fast = false)) {
            return markConnected(UsbBridgeConnection.BASE_URL, ConnectionMode.USB_LOCAL, "USB 本機模式 · adb reverse")
        }
        val tunnel = getTunnelUrl()
        if (!tunnel.isNullOrBlank() && probeUrl(tunnel, fast = false)) {
            return markConnected(tunnel, ConnectionMode.TUNNEL_REMOTE, "Tunnel 遠端模式 · Guardian Ai 就緒")
        }
        if (tunnel.isNullOrBlank()) {
            _mode.value = ConnectionMode.NONE
            _state.value = ConnectionState.NOT_CONFIGURED
            _lastMessage.value = "請 USB 連接電腦並執行 install-apk-adb.bat，或貼上 Tunnel URL"
            return false
        }
        markOffline("USB 與 Tunnel 均無法連線")
        return false
    }

    fun testConnectionMessage(): String {
        val cached = readCachedHealth()
        val live = probeHealth()
        return if (live) {
            val modeHint = when (_mode.value) {
                ConnectionMode.USB_LOCAL -> "模式：USB 本機（adb reverse）"
                ConnectionMode.TUNNEL_REMOTE -> "模式：Cloudflare Tunnel"
                ConnectionMode.NONE -> ""
            }
            "$modeHint\n${_lastMessage.value}"
        } else {
            val tunnel = getTunnelUrl()
            when {
                tunnel.isNullOrBlank() -> TunnelConnection.setupHint()
                cached != null -> "${_lastMessage.value}\n離線快取：${cached.take(60)}"
                else -> "${_lastMessage.value}\n${TunnelConnection.failureHint()}"
            }
        }
    }

    private fun markConnected(base: String, mode: ConnectionMode, msg: String): Boolean {
        activeBaseUrl = base
        _mode.value = mode
        _state.value = ConnectionState.CONNECTED
        _lastMessage.value = msg
        prefs.edit()
            .putString(KEY_ACTIVE_MODE, mode.name)
            .putLong(KEY_LAST_OK, System.currentTimeMillis())
            .apply()
        apiRef.set(null)
        lastBoundBase = base
        return true
    }

    private fun probeUrl(base: String, fast: Boolean): Boolean {
        val client = if (fast) fastClient else httpClient
        return try {
            val url = base.trimEnd('/') + "/health"
            val req = Request.Builder().url(url).get().build()
            client.newCall(req).execute().use { resp ->
                if (!resp.isSuccessful) return false
                val body = resp.body?.string().orEmpty()
                val ok = body.isBlank() || body.contains("\"ok\"") || body.contains("ok")
                if (ok) cacheHealthSnapshot(body)
                ok
            }
        } catch (_: Exception) {
            false
        }
    }

    private fun cacheHealthSnapshot(body: String) {
        File(cacheDir, "last_health.json").writeText(body)
    }

    private fun readCachedHealth(): String? {
        val f = File(cacheDir, "last_health.json")
        return if (f.exists()) f.readText() else null
    }

    private fun markOffline(msg: String) {
        activeBaseUrl = null
        val hadCache = readCachedHealth() != null
        _state.value = if (hadCache) ConnectionState.DEGRADED else ConnectionState.OFFLINE
        _lastMessage.value = "連線失敗: $msg · USB: install-apk-adb.bat / 遠端: run-tunnel.bat"
    }

    private fun resetApiClient() {
        apiRef.set(null)
        lastBoundBase = null
        activeBaseUrl = null
    }

    private fun migrateLegacyPrefs() {
        if (prefs.getBoolean(KEY_MIGRATED_V4, false)) return
        val legacy = appContext.getSharedPreferences("callguard", Context.MODE_PRIVATE)
        val tunnel = legacy.getString("tunnel_url", null)
        if (!tunnel.isNullOrBlank() && prefs.getString(KEY_TUNNEL, null).isNullOrBlank()) {
            TunnelConnection.normalizeUrl(tunnel)?.let { normalized ->
                prefs.edit().putString(KEY_TUNNEL, normalized).apply()
            }
        }
        val legacyKeys = arrayOf("lan_host", "home_url", LEGACY_TS_HOST_KEY)
        val editor = prefs.edit()
        legacyKeys.forEach { editor.remove(it) }
        editor
            .putBoolean(KEY_MIGRATED_V4, true)
            .apply()
    }

    private fun buildClient(): OkHttpClient =
        OkHttpClient.Builder()
            .connectTimeout(8, TimeUnit.SECONDS)
            .readTimeout(12, TimeUnit.SECONDS)
            .writeTimeout(12, TimeUnit.SECONDS)
            .addInterceptor(RetryInterceptor())
            .build()

    private val fastClient: OkHttpClient =
        OkHttpClient.Builder()
            .connectTimeout(1500, TimeUnit.MILLISECONDS)
            .readTimeout(2000, TimeUnit.MILLISECONDS)
            .build()

    private fun ensureTrailingSlash(url: String): String =
        if (url.endsWith("/")) url else "$url/"

    companion object {
        private const val PREFS = "guardian_ai"
        private const val KEY_TUNNEL = "tunnel_url"
        private const val KEY_SAVED_AT = "tunnel_saved_at"
        private const val KEY_LAST_OK = "tunnel_last_ok"
        private const val KEY_ACTIVE_MODE = "connection_mode"
        private const val KEY_MIGRATED_V4 = "connection_v4_migrated"
        /** Legacy Call Guard pref key — removed on upgrade, never read. */
        private const val LEGACY_TS_HOST_KEY = "tail" + "scale_host"

        @Volatile
        private var instance: ConnectionManager? = null

        fun get(context: Context): ConnectionManager =
            instance ?: synchronized(this) {
                instance ?: ConnectionManager(context).also { instance = it }
            }
    }
}