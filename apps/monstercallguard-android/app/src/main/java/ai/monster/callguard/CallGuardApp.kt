package ai.monster.callguard

import ai.monster.callguard.engine.LocalThreatEngine
import ai.monster.callguard.engine.RemoteAnalyzer
import ai.monster.callguard.network.HomeMonsterClient
import android.app.Application
import java.io.PrintWriter
import java.io.StringWriter

class CallGuardApp : Application() {
    lateinit var localEngine: LocalThreatEngine
    lateinit var homeClient: HomeMonsterClient
    lateinit var remoteAnalyzer: RemoteAnalyzer

    override fun onCreate() {
        super.onCreate()
        installCrashLogger()
        localEngine = LocalThreatEngine(this)
        homeClient = HomeMonsterClient(this)
        remoteAnalyzer = RemoteAnalyzer(this, homeClient, localEngine)
    }

    private fun installCrashLogger() {
        val previous = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, error ->
            try {
                val sw = StringWriter()
                error.printStackTrace(PrintWriter(sw))
                openFileOutput("last_crash.txt", MODE_PRIVATE).use {
                    it.write("${System.currentTimeMillis()}\n${sw}".toByteArray())
                }
            } catch (_: Exception) {
            }
            previous?.uncaughtException(thread, error)
        }
    }
}