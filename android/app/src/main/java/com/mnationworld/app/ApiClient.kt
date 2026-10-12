package com.mnationworld.app

import android.content.Context
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

// 全局会话（登录用户；用户快照 + Cookie 均持久化——更新/重启后自动恢复登录态）
object Session {
    var user by mutableStateOf<User?>(null)
    val isLoggedIn get() = user != null

    private const val PREFS = "mn_session"
    private lateinit var appContext: Context

    fun init(context: Context) {
        appContext = context.applicationContext
        val p = appContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val raw = p.getString("user", null)
        if (raw != null) {
            user = runCatching { ApiClient.json.decodeFromString(User.serializer(), raw) }.getOrNull()
        }
    }

    fun applyLogin(u: User) {
        user = u
        appContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString("user", ApiClient.json.encodeToString(User.serializer(), u))
            .apply()
    }

    fun logout() {
        user = null
        appContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().remove("user").apply()
        ApiClient.cookieStore.clear()
        appContext.getSharedPreferences("mn_cookies", Context.MODE_PRIVATE).edit().clear().apply()
    }
}

// API 客户端：OkHttp + CookieJar（会话 Cookie 持久化到 SharedPreferences）+ kotlinx.serialization
object ApiClient {
    val json = Json { ignoreUnknownKeys = true; isLenient = true }
    private val mediaType = "application/json; charset=utf-8".toMediaType()

    private lateinit var appContext: Context
    private const val COOKIE_PREFS = "mn_cookies"

    fun init(context: Context) {
        appContext = context.applicationContext
    }

    // 内存 Cookie 存储 + SharedPreferences 持久化（更新/重启后自动恢复会话）
    val cookieStore = mutableMapOf<String, MutableList<Cookie>>()

    private fun cookiePrefs() = appContext.getSharedPreferences(COOKIE_PREFS, Context.MODE_PRIVATE)

    private val client = OkHttpClient.Builder()
        .cookieJar(object : CookieJar {
            override fun saveFromResponse(url: HttpUrl, cookies: List<Cookie>) {
                val list = cookieStore.getOrPut(url.host) { mutableListOf() }
                for (c in cookies) {
                    list.removeAll { it.name == c.name }
                    list.add(c)
                    // 会话类 cookie 持久化（mn_session 等）
                    if (c.name.contains("session", ignoreCase = true)) {
                        cookiePrefs().edit()
                            .putString("cookie_${c.name}", c.value)
                            .putLong("cookie_${c.name}_expires", c.expiresAt)
                            .apply()
                    }
                }
            }

            override fun loadForRequest(url: HttpUrl): List<Cookie> {
                cookieStore[url.host]?.takeIf { it.isNotEmpty() }?.let { return it }
                // 冷启动：从 SharedPreferences 恢复
                val p = cookiePrefs()
                val restored = mutableListOf<Cookie>()
                p.all.forEach { (k, v) ->
                    if (k.startsWith("cookie_") && !k.endsWith("_expires") && v is String) {
                        val name = k.removePrefix("cookie_")
                        val expires = p.getLong("cookie_${name}_expires", 0L)
                        if (expires == 0L || expires > System.currentTimeMillis()) {
                            restored.add(
                                Cookie.Builder()
                                    .name(name)
                                    .value(v)
                                    .domain(url.host)
                                    .path("/")
                                    .expiresAt(expires)
                                    .build()
                            )
                        }
                    }
                }
                if (restored.isNotEmpty()) cookieStore[url.host] = restored
                return restored
            }
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
    suspend fun sendEmailCode(email: String, purpose: String? = null) {
        post("/api/auth/email-code", json.encodeToString(EmailCodeBody.serializer(), EmailCodeBody(email, purpose)))
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

    // ── 个人资料（PATCH /api/auth/me → {user}） ──
    suspend fun updateProfile(displayName: String? = null, bio: String? = null, gender: String? = null): User {
        val text = patch(
            "/api/auth/me",
            json.encodeToString(ProfilePatchBody.serializer(), ProfilePatchBody(displayName, bio, gender))
        )
        return json.decodeFromString(ProfilePatchResponse.serializer(), text).user
    }

    // ── 系统更新 ──
    suspend fun latestApp(): LatestApp =
        json.decodeFromString(LatestApp.serializer(), get("/api/app/latest"))

    // ── 帖子详情 / 评论 ──
    suspend fun postDetail(id: String): Post =
        json.decodeFromString(PostDetailResponse.serializer(), get("/api/social/posts/$id")).post

    suspend fun comments(postId: String): List<Comment> =
        json.decodeFromString(CommentsResponse.serializer(), get("/api/social/posts/$postId/comments")).comments

    suspend fun postComment(postId: String, content: String, parentId: String? = null) {
        post(
            "/api/social/posts/$postId/comments",
            json.encodeToString(CommentBody.serializer(), CommentBody(content, parentId))
        )
    }

    suspend fun favorite(postId: String, fav: Boolean) {
        if (fav) post("/api/social/posts/$postId/favorite") else delete("/api/social/posts/$postId/favorite")
    }

    suspend fun repost(postId: String, doRepost: Boolean) {
        if (doRepost) post("/api/social/posts/$postId/repost") else delete("/api/social/posts/$postId/repost")
    }

    // ── 用户主页 ──
    suspend fun userProfile(id: String): UserProfile =
        json.decodeFromString(UserProfileResponse.serializer(), get("/api/social/users/$id")).user

    suspend fun userPosts(id: String, tab: String = "posts"): List<Post> =
        json.decodeFromString(PostsResponse.serializer(), get("/api/social/users/$id/posts?tab=$tab")).posts

    suspend fun followUser(id: String, follow: Boolean) {
        if (follow) post("/api/social/users/$id/follow") else delete("/api/social/users/$id/follow")
    }

    // ── 聊天 ──
    suspend fun chatMessages(convId: String): List<ChatMessage> =
        json.decodeFromString(MessagesResponse.serializer(), get("/api/conversations/$convId/messages")).messages

    suspend fun sendMessage(convId: String, content: String): ChatMessage =
        json.decodeFromString(
            MessageResponse.serializer(),
            post("/api/conversations/$convId/messages", json.encodeToString(MessageBody.serializer(), MessageBody(content)))
        ).message
}
