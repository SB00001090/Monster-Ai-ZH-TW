package ai.monster.callguard

import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger

object ProtectionState {
    val highRiskActive = AtomicBoolean(false)
    val rejectsToday = AtomicInteger(0)
    val networkLocked = AtomicBoolean(false)
    val lastRejectCategory = AtomicBoolean(false)

    fun recordReject(category: String) {
        rejectsToday.incrementAndGet()
        if (category.contains("debt") || category.contains("收數") || category == "hk_debt_collection") {
            highRiskActive.set(true)
            lastRejectCategory.set(true)
        }
    }

    fun resetHighRisk() {
        highRiskActive.set(false)
        lastRejectCategory.set(false)
    }
}