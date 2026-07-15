package ai.guardian.app.security

import android.content.Context

/**
 * Legacy token bridge — Call Guard token API removed.
 * Guardian sync uses OAuth + passphrase via GuardianSyncClient.
 */
object CredentialBridge {
    fun getToken(context: Context): String? = null

    fun refresh(context: Context): String? = null
}