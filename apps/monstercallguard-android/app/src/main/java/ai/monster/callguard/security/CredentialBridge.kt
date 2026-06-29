package ai.monster.callguard.security

import ai.monster.callguard.network.HomeMonsterClient
import android.content.Context

object CredentialBridge {
    private const val PREFS = "callguard"
    private const val KEY_TOKEN = "api_token"
    private const val KEY_EXPIRES = "api_token_expires"

    fun getToken(context: Context): String? {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val expires = prefs.getLong(KEY_EXPIRES, 0)
        val token = prefs.getString(KEY_TOKEN, null)
        if (token != null && System.currentTimeMillis() / 1000 < expires - 30) {
            return token
        }
        return refresh(context)
    }

    fun refresh(context: Context): String? {
        val client = HomeMonsterClient(context)
        val token = client.fetchToken() ?: return null
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        prefs.edit()
            .putString(KEY_TOKEN, token)
            .putLong(KEY_EXPIRES, System.currentTimeMillis() / 1000 + 240)
            .apply()
        return token
    }
}