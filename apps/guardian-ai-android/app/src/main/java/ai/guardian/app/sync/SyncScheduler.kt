package ai.guardian.app.sync

import ai.guardian.app.learning.LearningScheduler
import android.content.Context
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit

object SyncScheduler {
    private const val HEALTH_PROBE = "guardian_tunnel_health"
    private const val GUARDIAN_SYNC = "guardian_e2e_sync"

    fun schedule(context: Context) {
        val network = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()

        val health = PeriodicWorkRequestBuilder<ConnectionHealthWorker>(30, TimeUnit.MINUTES)
            .setConstraints(network)
            .build()
        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            HEALTH_PROBE,
            ExistingPeriodicWorkPolicy.KEEP,
            health,
        )

        val guardian = PeriodicWorkRequestBuilder<GuardianSyncWorker>(12, TimeUnit.HOURS)
            .setConstraints(network)
            .build()
        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            GUARDIAN_SYNC,
            ExistingPeriodicWorkPolicy.KEEP,
            guardian,
        )

        LearningScheduler.schedule(context)
    }
}