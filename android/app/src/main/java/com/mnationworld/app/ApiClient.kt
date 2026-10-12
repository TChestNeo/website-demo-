package com.mnationworld.app

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import okhttp3.Cookie
import okhttp3.CookieJar
import okhttp3.HttpUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

// 后端地址（与网页端同一后端）
const val BASE_URL = "https://mnationworld.com"

// 全局会话（登录用户；Cookie 由 OkHttp CookieJar 自动托管，与网页端语义一致）
object Session {
    var user by mutableStateOf<User?>(null)
    val isLoggedIn get() = user != null

    fun applyLogin(u: User) {
        user = u
    }

    fun logout() {
        user = null
        ApiClient.cookieStore.clear()
    }
}

// API 客户端：OkHttp + CookieJar + kotlinx.serialization
object ApiClient {
    val json = Json { ignoreUnknownKeys = true; isLenient = true }
    private val mediaType = "application/json; charset=utf-8".toMediaType()

    // 内存 Cookie 存储（会话级；app 重启需重新登录，后续可换持久化）
    val cookieStore = mutableMapOf<String, MutableList<Cookie>>()

    private val client = OkHttpClient.Builder()
        .cookieJar(object : CookieJar {
            override fun saveFromResponse(url: HttpUrl, cookies: List<Cookie>) {
                val list = cookieStore.getOrPut(url.host) { mutableListOf() }
                for (c in cookies) {
                    list.removeAll { it.name == c.name }
                    list.add(c)
                }
            }

            override fun loadForRequest(url: HttpUrl): List<Cookie> =
                cookieStore[url.host] ?: emptyList()
        })
        .build()

    class ApiException(val code: String, message: String) : Exception(message)

    private suspend fun raw(method: String, path: String, body: String?): String =
        withContext(Dispatchers.IO) {
            val reqBuilder = Request.Builder().url("$BASE_URL$path")
            when (method) {
                "POST" -> reqBuilder.post((body ?: "{}").toRequestBody(mediaType))
                "PATCH" -> reqBuilder.patch((body ?: "{}").toRequestBody(mediaType))
                "DELETE" -> reqBuilder.delete()
            }
            client.newCall(reqBuilder.build()).execute().use { resp ->
                val text = resp.body?.string() ?: ""
                if (!resp.isSuccessful) {
                    val err = try {
                        json.decodeFromString<ErrorEnvelope>(text).error
                    } catch (_: Exception) {
                        ErrorBody("HTTP ${resp.code}", "请求失败")
                    }
                    throw ApiException(err.code, err.message)
                }
                text
            }
        }

    suspend fun post(path: String, body: String = "{}") = raw("POST", path, body)
    suspend fun patch(path: String, body: String = "{}") = raw("PATCH", path, body)
    suspend fun delete(path: String) = raw("DELETE", path, null)
    suspend fun get(path: String) = raw("GET", path, null)

    // ── 认证 ──
    suspend fun sendEmailCode(email: String) {
        post("/api/auth/email-code", json.encodeToString(EmailCodeBody.serializer(), EmailCodeBody(email)))
    }

    suspend fun verify(email: String, code: String, password: String? = null): VerifyResponse {
        val text = post("/api/auth/verify", json.encodeToString(VerifyBody.serializer(), VerifyBody(email, code, password)))
        return json.decodeFromString(VerifyResponse.serializer(), text)
    }

    suspend fun me(): User {
        val text = get("/api/auth/me")
        return json.decodeFromString(User.serializer(), text)
    }

    suspend fun logout() {
        runCatching { post("/api/auth/logout") }
    }

    // ── 内容 ──
    suspend fun posts(): List<Post> =
        json.decodeFromString(PostsResponse.serializer(), get("/api/social/posts")).posts

    suspend fun nations(): List<Nation> =
        json.decodeFromString(NationsResponse.serializer(), get("/api/social/nations")).nations

    suspend fun myNations(): List<Nation> =
        json.decodeFromString(NationsResponse.serializer(), get("/api/social/nations/mine")).nations

    suspend fun conversations(): List<Conversation> =
        json.decodeFromString(ConversationsResponse.serializer(), get("/api/conversations")).conversations

    suspend fun like(postId: String, like: Boolean) {
        if (like) post("/api/social/posts/$postId/like")
        else delete("/api/social/posts/$postId/like")
    }

    suspend fun createPost(content: String) {
        post("/api/social/posts", json.encodeToString(CreatePostBody.serializer(), CreatePostBody(content)))
    }

    suspend fun blockedUsers(): List<BlockedUser> =
        json.decodeFromString(BlockedResponse.serializer(), get("/api/social/blocked")).users

    suspend fun unblock(userId: String) {
        delete("/api/social/users/$userId/block")
    }

    suspend fun likedPosts(userId: String): List<Post> =
        json.decodeFromString(PostsResponse.serializer(), get("/api/social/users/$userId/posts?tab=likes")).posts

    suspend fun changePassword(newPassword: String) {
        post("/api/auth/password", json.encodeToString(PasswordBody.serializer(), PasswordBody(newPassword)))
    }

    suspend fun deleteAccount(code: String) {
        post("/api/auth/delete", json.encodeToString(DeleteBody.serializer(), DeleteBody(code)))
    }
}
