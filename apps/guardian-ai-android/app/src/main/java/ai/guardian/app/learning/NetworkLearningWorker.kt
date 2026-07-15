package ai.guardian.app.learning

import ai.guardian.app.network.ConnectionManager
import ai.guardian.app.network.HomeMonsterClient
import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
/**
 * Eternal background learning tick — triggers PC Guardian daemon via Tunnel/USB.
 * Developed by Suckbob | Guardian Ai
 */
class NetworkLearningWorker(
    context: Context,
    params: WorkerParameters,
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        val connection = ConnectionManager.get(applicationContext)
        if (connection.getBaseUrl() == null) return@withContext Result.retry()

        val client = HomeMonsterClient(applicationContext)
        if (!client.ping()) return@withContext Result.retry()

        val consent = client.getJson("/api/guardian/network-learning/status")
        if (consent?.optBoolean("user_consented") != true) {
            return@withContext Result.success()
        }

        val ticked = client.postJson("/api/guardian/learning/eternal-tick", "{}")
        if (ticked) Result.success() else Result.retry()
    }
}