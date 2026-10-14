package me.opencodex.quota

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import org.json.JSONObject
import java.net.URI
import java.net.URL
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

 data class Connection(val url: String, val key: String)
object Store {
    private const val alias = "opencodex-widget"
    fun validate(url: String, key: String): Connection {
        val uri = URI(url.trim().trimEnd('/'))
        require(uri.scheme == "https" && !uri.host.isNullOrEmpty() && uri.userInfo == null && uri.query == null && uri.fragment == null && uri.path.isNullOrEmpty()) { "HTTPS 서버 주소를 확인하세요." }
        require(key.matches(Regex("[A-Za-z0-9_-]{32,128}"))) { "위젯 키를 확인하세요." }
        return Connection(uri.toASCIIString(), key)
    }
    private fun secret(): SecretKey {
        val ks = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (ks.getKey(alias, null) as? SecretKey)?.let { return it }
        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").apply {
            init(KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build())
        }.generateKey()
    }
    fun save(context: Context, value: Connection) {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.ENCRYPT_MODE, secret()) }
        val bytes = cipher.doFinal(JSONObject().put("url", value.url).put("key", value.key).toString().toByteArray())
        context.getSharedPreferences("connection", 0).edit().putString("iv", Base64.encodeToString(cipher.iv, Base64.NO_WRAP)).putString("data", Base64.encodeToString(bytes, Base64.NO_WRAP)).commit()
        context.getSharedPreferences("cache", 0).edit().clear().commit()
    }
    fun load(context: Context): Connection? = runCatching {
        val prefs = context.getSharedPreferences("connection", 0)
        val cipher = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.DECRYPT_MODE, secret(), GCMParameterSpec(128, Base64.decode(prefs.getString("iv", null), Base64.NO_WRAP))) }
        val json = JSONObject(String(cipher.doFinal(Base64.decode(prefs.getString("data", null), Base64.NO_WRAP))))
        validate(json.getString("url"), json.getString("key"))
    }.getOrNull()
}
object Api {
    fun read(connection: Connection, refresh: Boolean = false): String {
        val endpoint = if (refresh) "/api/widget/refresh" else "/api/widget"
        val request = URL(connection.url + endpoint).openConnection() as javax.net.ssl.HttpsURLConnection
        request.instanceFollowRedirects = false
        request.connectTimeout = 15000; request.readTimeout = 35000
        request.setRequestProperty("Authorization", "Bearer ${connection.key}")
        request.setRequestProperty("ngrok-skip-browser-warning", "1")
        if (refresh) { request.requestMethod = "POST"; request.doOutput = true; request.outputStream.use { } }
        try {
            val status = request.responseCode
            if (status != 200) throw IllegalStateException(if (status == 429) "잠시 후 새로고침하세요." else if (status == 401) "웹앱에서 위젯을 다시 연결하세요." else "서버 연결 실패 ($status)")
            val body = request.inputStream.bufferedReader().use { it.readText() }
            require(JSONObject(body).optJSONArray("accounts") != null) { "사용량 응답을 확인하세요." }
            return body
        } finally { request.disconnect() }
    }
}
