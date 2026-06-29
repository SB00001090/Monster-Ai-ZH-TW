package ai.monster.callguard.service

import ai.monster.callguard.CallGuardApp
import ai.monster.callguard.ProtectionState
import ai.monster.callguard.report.AnonymousReportBuilder
import android.os.Build
import android.telecom.Call
import android.telecom.CallScreeningService
import androidx.annotation.RequiresApi

@RequiresApi(Build.VERSION_CODES.Q)
class CallScreeningServiceImpl : CallScreeningService() {
    override fun onScreenCall(details: Call.Details) {
        try {
            val app = application as? CallGuardApp
            if (app == null) {
                allowCall(details)
                return
            }
            val number = details.handle?.schemeSpecificPart ?: ""
            val display = details.callerDisplayName?.toString() ?: ""
            // 必須在系統時限內回覆；不可在此執行緒做網路請求。
            val result = app.localEngine.score(number, display)
            if (result.reject) {
                ProtectionState.recordReject(result.category)
                Thread {
                    try {
                        AnonymousReportBuilder.saveAndUpload(this@CallScreeningServiceImpl, number, result)
                    } catch (_: Exception) {
                    }
                }.start()
                respondToCall(
                    details,
                    CallResponse.Builder()
                        .setDisallowCall(true)
                        .setRejectCall(true)
                        .setSkipCallLog(false)
                        .setSkipNotification(false)
                        .build(),
                )
            } else {
                allowCall(details)
            }
        } catch (_: Exception) {
            allowCall(details)
        }
    }

    private fun allowCall(details: Call.Details) {
        respondToCall(
            details,
            CallResponse.Builder()
                .setDisallowCall(false)
                .setRejectCall(false)
                .build(),
        )
    }
}