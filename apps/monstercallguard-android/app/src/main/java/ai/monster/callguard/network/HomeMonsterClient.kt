package ai.monster.callguard.network

import android.content.Context
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.TimeUnit

class HomeMonsterClient(private val context: Context) {
    private val prefs = context.getSharedPreferences("callguard", Context.MODE_PRIVATE)
    private val client = OkHttpClient.Builder()
        .connectTimeout(3, TimeUnit.SECONDS)
        .readTimeout(5, TimeUnit.SECONDS)
        .build()

    fun getBaseUrl(): String? {
        val manual = prefs.getString("home_url", null)
        if (!manual.isNullOrBlank()) return manual.trimEnd('/')
        val tailscale = prefs.getString("tailscale_host", null)
        if (!tailscale.isNullOrBlank()) return "http://$tailscale:7860"
        val lan = prefs.getString("lan_host", null)
        if (!lan.isNullOrBlank()) return "http://$lan:7860"
        return null
    }

    fun testConnection(): String {
        val base = getBaseUrl() ?: return "未設定家中 Monster AI 位址"
        return try {
            client.newCall(Request.Builder().url("$base/api/callguard/status").get().build())
                .execute().use { r ->
                    if (r.isSuccessful) "連線成功 · ${r.body?.string()?.take(80)}" else "HTTP ${r.code}"
                }
        } catch (e: Exception) {
            "連線失敗: ${e.message}"
        }
    }

    fun analyzeRemote(number: String, displayName: String, token: String?): JSONObject? {
        val base = getBaseUrl() ?: return null
        val body = JSONObject()
            .put("number", number)
            .put("display_name", displayName)
            .put("deep", true)
            .toString()
            .toRequestBody("application/json".toMediaType())
        val req = Request.Builder()
            .url("$base/api/callguard/analyze")
            .post(body)
            .apply { if (token != null) header("Authorization", "Bearer $token") }
            .build()
        return try {
            client.newCall(req).execute().use { resp ->
                if (!resp.isSuccessful) null else JSONObject(resp.body?.string() ?: return null)
            }
        } catch (_: Exception) {
            null
        }
    }

    fun submitReport(payload: JSONObject, token: String?): Boolean {
        val base = getBaseUrl() ?: return false
        val req = Request.Builder()
            .url("$base/api/callguard/report")
            .post(payload.toString().toRequestBody("application/json".toMediaType()))
            .apply { if (token != null) header("Authorization", "Bearer $token") }
            .build()
        return try {
            client.newCall(req).execute().use { it.isSuccessful }
        } catch (_: Exception) {
            false
        }
    }

    fun fetchToken(): String? {
        val base = getBaseUrl() ?: return null
        return try {
            client.newCall(
                Request.Builder().url("$base/api/callguard/token").post("{}".toRequestBody()).build(),
            ).execute().use { resp ->
                if (!resp.isSuccessful) null
                else JSONObject(resp.body?.string() ?: return null).optString("token")
            }
        } catch (_: Exception) {
            null
        }
    }
}