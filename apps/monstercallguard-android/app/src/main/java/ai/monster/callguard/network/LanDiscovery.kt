package ai.monster.callguard.network

import android.content.Context
import android.net.ConnectivityManager
import android.net.LinkProperties
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetAddress
import java.util.concurrent.Callable
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference

data class DiscoveryResult(
    val host: String,
    val mode: String,
)

object LanDiscovery {
    private const val DISCOVER_PORT = 47890
    private const val DISCOVER_MAGIC = "MONSTER_CALLGUARD_V1"
    private const val API_PATH = "/api/callguard/status"
    private val TAILSCALE_CANDIDATES = listOf(
        "tm0721.taile4ca68.ts.net",
        "100.89.138.96",
        "tm072",
    )
    private val ALT_SUBNETS = listOf("192.168.0.", "192.168.1.")
    private val QUICK_HOSTS = listOf(4, 16, 1, 2, 10, 20, 50, 100, 254)

    private val fastClient = OkHttpClient.Builder()
        .connectTimeout(400, TimeUnit.MILLISECONDS)
        .readTimeout(600, TimeUnit.MILLISECONDS)
        .build()

    private val slowClient = OkHttpClient.Builder()
        .connectTimeout(2, TimeUnit.SECONDS)
        .readTimeout(3, TimeUnit.SECONDS)
        .build()

    fun discover(context: Context): DiscoveryResult? {
        discoverViaUdp()?.let { return DiscoveryResult(it, "lan") }

        val localIp = getLocalIpv4(context)
        if (localIp != null) {
            scanSubnet(localIp)?.let { return DiscoveryResult(it, "lan") }
            val prefix = localIp.substringBeforeLast('.') + "."
            for (alt in ALT_SUBNETS) {
                if (alt == prefix) continue
                quickScanPrefix(alt)?.let { return DiscoveryResult(it, "lan") }
            }
        } else {
            for (alt in ALT_SUBNETS) {
                quickScanPrefix(alt)?.let { return DiscoveryResult(it, "lan") }
            }
        }

        for (host in TAILSCALE_CANDIDATES) {
            if (isCallGuard(host, slowClient)) {
                return DiscoveryResult(host, "tailscale")
            }
        }
        return null
    }

    private fun discoverViaUdp(): String? {
        val targets = listOf("255.255.255.255", "192.168.1.255", "192.168.0.255")
        for (target in targets) {
            try {
                DatagramSocket().use { socket ->
                    socket.soTimeout = 1200
                    socket.broadcast = true
                    val payload = DISCOVER_MAGIC.toByteArray()
                    socket.send(
                        DatagramPacket(
                            payload,
                            payload.size,
                            InetAddress.getByName(target),
                            DISCOVER_PORT,
                        ),
                    )
                    val buf = ByteArray(512)
                    val resp = DatagramPacket(buf, buf.size)
                    socket.receive(resp)
                    val json = JSONObject(String(resp.data, 0, resp.length))
                    if (json.optString("service") == "monster-callguard") {
                        return json.optString("host").takeIf { it.isNotBlank() }
                    }
                }
            } catch (_: Exception) {
            }
        }
        return null
    }

    private fun quickScanPrefix(prefix: String): String? {
        for (host in QUICK_HOSTS) {
            val ip = "$prefix$host"
            if (isCallGuard(ip, fastClient)) return ip
        }
        return null
    }

    private fun scanSubnet(localIp: String): String? {
        val parts = localIp.split(".")
        if (parts.size != 4) return null
        val prefix = "${parts[0]}.${parts[1]}.${parts[2]}."
        val order = buildScanOrder(parts[3].toIntOrNull() ?: 0)
        val found = AtomicReference<String?>(null)
        val pool = Executors.newFixedThreadPool(16)
        try {
            val tasks = order.map { host ->
                Callable {
                    if (found.get() != null) return@Callable null
                    val ip = "$prefix$host"
                    if (ip == localIp) return@Callable null
                    if (isCallGuard(ip, fastClient)) {
                        found.compareAndSet(null, ip)
                        ip
                    } else {
                        null
                    }
                }
            }
            pool.invokeAll(tasks, 8, TimeUnit.SECONDS)
        } catch (_: Exception) {
        } finally {
            pool.shutdownNow()
        }
        return found.get()
    }

    private fun buildScanOrder(lastOctet: Int): List<Int> {
        val priority = mutableListOf(1, 4, 16, 2, 10, 20, 50, 100, 254, lastOctet)
        for (i in 1..254) priority.add(i)
        return priority.distinct()
    }

    private fun isCallGuard(host: String, http: OkHttpClient = fastClient): Boolean {
        return try {
            val req = Request.Builder().url("http://$host:7860$API_PATH").get().build()
            http.newCall(req).execute().use { resp ->
                if (!resp.isSuccessful) return false
                val body = resp.body?.string() ?: return false
                JSONObject(body).optBoolean("enabled", false)
            }
        } catch (_: Exception) {
            false
        }
    }

    fun getLocalIpv4(context: Context): String? {
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
            ?: return null
        val network = cm.activeNetwork ?: return null
        val props: LinkProperties = cm.getLinkProperties(network) ?: return null
        for (addr in props.linkAddresses) {
            val host = addr.address.hostAddress ?: continue
            if (host.contains(":")) continue
            if (host.startsWith("100.")) continue
            if (host.startsWith("192.168.") || host.startsWith("10.")) return host
        }
        return null
    }

    fun failureHint(localIp: String?): String {
        val phone = localIp ?: "未知"
        return buildString {
            append("自動偵測失敗\n")
            append("手機 IP：$phone\n")
            if (phone.startsWith("192.168.1.") || phone.startsWith("192.168.0.")) {
                append("可能與電腦不同網段（.0.x / .1.x）\n")
            }
            append("請試：\n")
            append("1) 打開 Tailscale → Connected\n")
            append("2) 再按「自動偵測」\n")
            append("3) 或手動填 Tailscale：tm0721.taile4ca68.ts.net")
        }
    }
}