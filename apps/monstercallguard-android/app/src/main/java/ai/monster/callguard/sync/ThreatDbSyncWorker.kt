package ai.monster.callguard.sync

import ai.monster.callguard.network.HomeMonsterClient
import ai.monster.callguard.network.ThreatFeedClient
import ai.monster.callguard.security.CredentialBridge
import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import okhttp3.OkHttpClient
import okhttp3.Request
import java.util.concurrent.TimeUnit

class ThreatDbSyncWorker(appContext: Context, params: WorkerParameters) :
    CoroutineWorker(appContext, params) {

    override suspend fun doWork(): Result {
        val homeClient = HomeMonsterClient(applicationContext)
        val feedClient = ThreatFeedClient(applicationContext)
        val base = homeClient.getBaseUrl()
        var homeBody: String? = null

        if (base != null) {
            homeBody = fetchThreatDb(base, CredentialBridge.getToken(applicationContext))
        }
        val version = feedClient.fetchAndSaveIfNewer(homeBody)
        return if (version != null) Result.success() else Result.retry()
    }

    private fun fetchThreatDb(base: String, token: String?): String? {
        return try {
            val client = OkHttpClient.Builder()
                .connectTimeout(5, TimeUnit.SECONDS)
                .readTimeout(8, TimeUnit.SECONDS)
                .build()
            val req = Request.Builder()
                .url("$base/api/callguard/threat-db")
                .get()
                .apply { if (token != null) header("Authorization", "Bearer $token") }
                .build()
            client.newCall(req).execute().use { r ->
                if (r.isSuccessful) r.body?.string() else null
            }
        } catch (_: Exception) {
            null
        }
    }
}