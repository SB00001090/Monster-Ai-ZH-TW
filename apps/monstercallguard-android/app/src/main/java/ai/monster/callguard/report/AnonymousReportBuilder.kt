package ai.monster.callguard.report

import ai.monster.callguard.engine.CallScore
import ai.monster.callguard.monitor.DeviceContactMonitor
import ai.monster.callguard.network.HomeMonsterClient
import ai.monster.callguard.security.CredentialBridge
import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.security.MessageDigest
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

object AnonymousReportBuilder {
    fun saveAndUpload(context: Context, number: String, score: CallScore) {
        val report = build(context, number, score)
        context.openFileOutput("report_${System.currentTimeMillis()}.json", Context.MODE_PRIVATE)
            .use { it.write(report.toString().toByteArray()) }
        val client = HomeMonsterClient(context)
        val token = CredentialBridge.getToken(context)
        client.submitReport(report, token)
    }

    fun build(context: Context, number: String, score: CallScore): JSONObject {
        val contact = DeviceContactMonitor.scan(context)
        val salt = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
        val hash = sha256("$number|$salt|monster-callguard")
        return JSONObject()
            .put("version", "hk-report-2026")
            .put("category", score.category.ifEmpty { "scam_suspicious" })
            .put("number_hash", hash)
            .put("score", score.score)
            .put("signals", JSONArray(score.signals))
            .put("device_contact", JSONObject()
                .put("detected", contact.detected)
                .put("usb", contact.usb)
                .put("bluetooth", contact.bluetooth)
                .put("mobile_data", contact.mobileData))
            .put("channels", JSONObject()
                .put("adcc", "18222")
                .put("e_reporting", "https://www.ereporting.rmp.gov.hk"))
    }

    private fun sha256(input: String): String {
        val digest = MessageDigest.getInstance("SHA-256")
        return digest.digest(input.toByteArray()).joinToString("") { "%02x".format(it) }
    }
}