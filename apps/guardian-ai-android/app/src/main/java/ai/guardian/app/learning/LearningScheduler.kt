package ai.guardian.app.learning

import android.content.Context
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit

/** Schedules eternal background network learning (opt-in, low-power). Developed by Suckbob | Guardian Ai */
object LearningScheduler {
    private const val NETWORK_LEARNING = "guardian_eternal_learning"

    fun schedule(context: Context) {
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()

        val work = PeriodicWorkRequestBuilder<NetworkLearningWorker>(15, TimeUnit.MINUTES)
            .setConstraints(constraints)
            .build()

        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            NETWORK_LEARNING,
            ExistingPeriodicWorkPolicy.UPDATE,
            work,
        )
    }
}