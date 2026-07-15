package ai.guardian.app.billing

import ai.guardian.app.BuildConfig
import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

/**
 * Local 7-day trial timer — Developed by Suckbob | Guardian Ai
 * No server required; trial starts on first app open.
 */
class TrialManager(context: Context) {
    private val prefs: SharedPreferences = openPrefs(context.applicationContext)

    private fun openPrefs(context: Context): SharedPreferences {
        return try {
            val masterKey = MasterKey.Builder(context)
                .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                .build()
            val prefs = EncryptedSharedPreferences.create(
                context,
                PREFS_SECURE,
                masterKey,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
            )
            migrateLegacyTrialPrefs(context, prefs)
            prefs
        } catch (e: Exception) {
            Log.w(TAG, "Encrypted prefs unavailable, using fallback store", e)
            val fallback = context.getSharedPreferences(FALLBACK_PREFS, Context.MODE_PRIVATE)
            migrateLegacyFallbackPrefs(context, fallback)
            fallback
        }
    }

    private fun migrateLegacyTrialPrefs(context: Context, target: SharedPreferences) {
        if (target.contains(KEY_TRIAL_START) || target.contains(KEY_PURCHASED)) return
        try {
            val legacy = context.getSharedPreferences(LEGACY_SECURE, Context.MODE_PRIVATE)
            if (!legacy.contains(KEY_TRIAL_START) && !legacy.contains(KEY_PURCHASED)) return
            target.edit()
                .putLong(KEY_TRIAL_START, legacy.getLong(KEY_TRIAL_START, System.currentTimeMillis()))
                .putBoolean(KEY_PURCHASED, legacy.getBoolean(KEY_PURCHASED, false))
                .apply()
        } catch (_: Exception) {
            /* legacy encrypted store unavailable */
        }
    }

    private fun migrateLegacyFallbackPrefs(context: Context, target: SharedPreferences) {
        if (target.contains(KEY_TRIAL_START) || target.contains(KEY_PURCHASED)) return
        val legacy = context.getSharedPreferences(LEGACY_FALLBACK, Context.MODE_PRIVATE)
        if (!legacy.contains(KEY_TRIAL_START) && !legacy.contains(KEY_PURCHASED)) return
        target.edit()
            .putLong(KEY_TRIAL_START, legacy.getLong(KEY_TRIAL_START, System.currentTimeMillis()))
            .putBoolean(KEY_PURCHASED, legacy.getBoolean(KEY_PURCHASED, false))
            .apply()
    }

    fun ensureTrialStarted() {
        if (!prefs.contains(KEY_TRIAL_START)) {
            prefs.edit().putLong(KEY_TRIAL_START, System.currentTimeMillis()).apply()
        }
    }

    fun trialStartMs(): Long = prefs.getLong(KEY_TRIAL_START, System.currentTimeMillis())

    fun trialDays(): Int = BuildConfig.TRIAL_DAYS

    fun trialEndMs(): Long = trialStartMs() + trialDays() * 24L * 60 * 60 * 1000

    fun isTrialActive(): Boolean = System.currentTimeMillis() < trialEndMs()

    fun trialRemainingMs(): Long = (trialEndMs() - System.currentTimeMillis()).coerceAtLeast(0)

    fun setPurchased(permanent: Boolean) {
        prefs.edit().putBoolean(KEY_PURCHASED, permanent).apply()
    }

    fun isPurchased(): Boolean = prefs.getBoolean(KEY_PURCHASED, false)

    /** Trial OR one-time purchase unlocks premium features. */
    fun hasPremiumAccess(): Boolean = isPurchased() || isTrialActive()

    companion object {
        private const val TAG = "TrialManager"
        private const val PREFS_SECURE = "guardian_ai_trial_secure"
        private const val FALLBACK_PREFS = "guardian_ai_trial_fallback"
        private const val LEGACY_SECURE = "callguard_trial_secure"
        private const val LEGACY_FALLBACK = "callguard_trial_fallback"
        private const val KEY_TRIAL_START = "trial_start_ms"
        private const val KEY_PURCHASED = "purchased_lifetime"
    }
}