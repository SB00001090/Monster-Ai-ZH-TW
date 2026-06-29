package ai.monster.callguard.network

import ai.monster.callguard.BuildConfig
import android.content.Context
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.io.File
import java.util.concurrent.TimeUnit

class ThreatFeedClient(private val context: Context) {
    private val client = OkHttpClient.Builder()
        .connectTimeout(8, TimeUnit.SECONDS)
        .readTimeout(12, TimeUnit.SECONDS)
        .build()

    fun fetchAndSaveIfNewer(homeJson: String?): String? {
        val body = homeJson ?: fetchCdn() ?: return null
        val incoming = JSONObject(body)
        val version = incoming.optString("version", "")
        val existing = readLocalVersion()
        if (version.isNotEmpty() && version == existing) return version
        File(context.filesDir, "threat_db.json").writeText(body)
        return version.ifEmpty { "updated" }
    }

    private fun fetchCdn(): String? {
        val url = BuildConfig.THREAT_FEED_URL
        if (url.isBlank()) {
            val asset = readAssetConfig()
            if (asset.isNullOrBlank()) return null
            return fetchUrl(asset)
        }
        return fetchUrl(url)
    }

    private fun readAssetConfig(): String? {
        return try {
            val raw = context.assets.open("update_config.json").bufferedReader().readText()
            JSONObject(raw).optString("threat_feed_url", "")
        } catch (_: Exception) {
            null
        }
    }

    private fun fetchUrl(url: String): String? {
        return try {
            client.newCall(Request.Builder().url(url).get().build()).execute().use { r ->
                if (r.isSuccessful) r.body?.string() else null
            }
        } catch (_: Exception) {
            null
        }
    }

    private fun readLocalVersion(): String {
        return try {
            val f = File(context.filesDir, "threat_db.json")
            if (!f.exists()) return ""
            JSONObject(f.readText()).optString("version", "")
        } catch (_: Exception) {
            ""
        }
    }
}