package ai.guardian.app.network

import android.content.Context
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject

/** OkHttp client for Guardian Ai — Cloudflare Tunnel HTTPS only. Developed by Suckbob | Guardian Ai */
class HomeMonsterClient(context: Context) {
    private val connection = ConnectionManager.get(context)
    private val client get() = connection.httpClient

    fun getBaseUrl(): String? = connection.getBaseUrl()

    fun connectionState(): ConnectionState = connection.state.value

    fun connectionMode(): ConnectionMode = connection.mode.value

    fun testConnection(): String = connection.testConnectionMessage()

    fun getGuardianStatus(): JSONObject? = getJson("/api/guardian/status")

    fun getConnectionInfo(): JSONObject? = getJson("/api/guardian/connection")

    fun getDisclaimer(locale: String = "zh-TW"): JSONObject? =
        getJson("/api/guardian/disclaimer?locale=$locale")

    fun postJson(path: String, jsonBody: String, token: String? = null): Boolean {
        val base = getBaseUrl() ?: return false
        val req = Request.Builder()
            .url("$base$path")
            .post(jsonBody.toRequestBody("application/json".toMediaType()))
            .apply { if (token != null) header("Authorization", "Bearer $token") }
            .build()
        return try {
            client.newCall(req).execute().use { it.isSuccessful }
        } catch (_: Exception) {
            false
        }
    }

    fun ping(): Boolean = connection.probeHealth()

    fun getJson(path: String): JSONObject? {
        val base = getBaseUrl() ?: return null
        val req = Request.Builder().url("$base$path").get().build()
        return try {
            client.newCall(req).execute().use { resp ->
                if (!resp.isSuccessful) null
                else JSONObject(resp.body?.string() ?: return null)
            }
        } catch (_: Exception) {
            null
        }
    }
}