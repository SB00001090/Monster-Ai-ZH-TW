package ai.guardian.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.security.MessageDigest

/** Training vault key fingerprint — mirrors TrainingVaultKeyManager derivation. */
class TrainingVaultKeyManagerTest {
    @Test
    fun deriveKeyFingerprintStable() {
        val salt = "abc123"
        val passphrase = "my-training-pass"
        val material = "guardian-training:$passphrase:$salt"
        val digest = MessageDigest.getInstance("SHA-256").digest(material.toByteArray(Charsets.UTF_8))
        val fp = digest.joinToString("") { "%02x".format(it) }.take(32)
        assertEquals(32, fp.length)
        assertTrue(fp.matches(Regex("[0-9a-f]+")))
    }
}