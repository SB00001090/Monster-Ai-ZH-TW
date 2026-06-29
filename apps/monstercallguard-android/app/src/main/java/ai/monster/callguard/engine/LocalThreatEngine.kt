package ai.monster.callguard.engine

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

data class CallScore(
    val score: Int,
    val reject: Boolean,
    val category: String,
    val signals: List<String>,
)

class LocalThreatEngine(private val context: Context) {
    private val highRiskPrefixes = mutableListOf("+8529", "+8524", "+861", "+886", "+234", "+91")
    private val scamKeywords = mutableListOf(
        "收數", "財務公司", "追債", "還款", "逾期", "投資", "中獎", "警察", "律師行",
    )
    private val knownNumbers = mutableListOf<String>()
    private var rejectThreshold = 85

    init {
        reloadFromDisk()
    }

    fun reloadFromDisk() {
        val db = loadThreatDb()
        db.optJSONArray("prefixes_high_risk")?.let { arr ->
            highRiskPrefixes.clear()
            for (i in 0 until arr.length()) highRiskPrefixes.add(arr.getString(i))
        }
        db.optJSONArray("keywords_display")?.let { arr ->
            scamKeywords.clear()
            for (i in 0 until arr.length()) scamKeywords.add(arr.getString(i))
        }
        knownNumbers.clear()
        db.optJSONArray("known_scam_numbers")?.let { arr ->
            for (i in 0 until arr.length()) knownNumbers.add(arr.getString(i))
        }
        rejectThreshold = db.optInt("reject_threshold", 85)
    }

    private fun loadThreatDb(): JSONObject {
        val synced = File(context.filesDir, "threat_db.json")
        if (synced.exists()) {
            return try {
                JSONObject(synced.readText())
            } catch (_: Exception) {
                JSONObject()
            }
        }
        return try {
            val raw = context.resources.openRawResource(
                context.resources.getIdentifier("hk_threat_numbers", "raw", context.packageName),
            )
            val text = raw.bufferedReader().readText()
            if (text.trimStart().startsWith("{")) JSONObject(text) else wrapLegacyNumbers(text)
        } catch (_: Exception) {
            JSONObject()
        }
    }

    private fun wrapLegacyNumbers(text: String): JSONObject {
        val root = JSONObject(text)
        val numbers = root.optJSONArray("numbers") ?: JSONArray()
        return JSONObject()
            .put("version", root.optString("version", "legacy"))
            .put("known_scam_numbers", numbers)
            .put("reject_threshold", 85)
    }

    fun score(number: String, displayName: String = ""): CallScore {
        val signals = mutableListOf<String>()
        var max = 0
        var category = ""

        for (known in knownNumbers) {
            if (number.endsWith(known) || number == known) {
                signals.add("known:$known")
                max = maxOf(max, 95)
                category = "known_scam"
            }
        }
        for (p in highRiskPrefixes) {
            if (number.startsWith(p)) {
                signals.add("prefix:$p")
                max = maxOf(max, 75)
                if (category.isEmpty()) category = "high_risk_prefix"
            }
        }
        for (kw in scamKeywords) {
            if (displayName.contains(kw)) {
                signals.add("display:$kw")
                max = maxOf(max, 88)
                category = if (kw == "收數" || kw == "追債") "hk_debt_collection" else "scam_keyword"
            }
        }

        val score = minOf(100, max)
        return CallScore(
            score = score,
            reject = score >= rejectThreshold,
            category = category,
            signals = signals,
        )
    }
}