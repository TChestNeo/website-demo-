package com.mnationworld.app

import kotlinx.serialization.Serializable

// 数据模型：与后端 API（camelCase JSON）逐字段对齐

@Serializable
data class User(
    val id: String,
    val displayName: String,
    val email: String,
    val citizenId: String? = null,
    val avatarUrl: String? = null,
    val tier: String? = null,
    val tierExpiresAt: String? = null,
    val role: String? = null,
    val status: String? = null,
    val hasPassword: Boolean? = null,
    val gender: String? = null,
    val xpGained: Int? = null,
    val avatarFrame: String? = null,
    val title: String? = null,
    val createdAt: String? = null,
)

@Serializable
data class Post(
    val id: String,
    val authorId: String,
    val authorName: String? = null,
    val avatarUrl: String? = null,
    val content: String,
    val createdAt: String? = null,
    val likeCount: Int? = null,
    val commentCount: Int? = null,
    val likedByMe: Boolean? = null,
    val repostCount: Int? = null,
    val repostedByMe: Boolean? = null,
    val viewCount: Int? = null,
    val favoritedByMe: Boolean? = null,
    val topicId: String? = null,
    val status: String? = null,
)

@Serializable
data class Nation(
    val id: String? = null,
    val name: String? = null,
    val moniker: String? = null,
    val classification: String? = null,
    val capital: String? = null,
    val lore: String? = null,
    val status: String? = null,
    val createdAt: String? = null,
) {
    val displayName: String get() = name ?: id ?: "未命名国家"
}

@Serializable
data class Conversation(
    val id: String,
    val kind: String? = null,
    val name: String? = null,
    val createdAt: String? = null,
    val members: List<Member>? = null,
    val lastMessage: LastMessage? = null,
    val unreadCount: Int? = null,
) {
    val title: String get() = name ?: "会话"
}

@Serializable
data class Member(
    val id: String? = null,
    val displayName: String? = null,
    val avatarUrl: String? = null,
)

@Serializable
data class LastMessage(
    val id: String? = null,
    val senderId: String? = null,
    val content: String? = null,
    val createdAt: String? = null,
)

@Serializable
data class BlockedUser(
    val id: String,
    val displayName: String? = null,
    val avatarUrl: String? = null,
    val citizenId: String? = null,
)

// 通用响应包
@Serializable
data class PostsResponse(val posts: List<Post> = emptyList())

@Serializable
data class NationsResponse(val nations: List<Nation> = emptyList())

@Serializable
data class ConversationsResponse(val conversations: List<Conversation> = emptyList())

@Serializable
data class BlockedResponse(val users: List<BlockedUser> = emptyList())

// 认证
@Serializable
data class EmailCodeBody(val email: String, val purpose: String? = null)

@Serializable
data class VerifyBody(
    val email: String,
    val code: String,
    val password: String? = null,
    val displayName: String? = null,
)

@Serializable
data class VerifyResponse(
    val status: String,
    val user: User,
    val restored: Boolean? = null,
    val passwordSetupRequired: Boolean? = null,
)

// 错误信封
@Serializable
data class ErrorEnvelope(val error: ErrorBody)

@Serializable
data class ErrorBody(val code: String, val message: String)

// 请求体
@Serializable
data class CreatePostBody(val content: String, val topicId: String? = null)

@Serializable
data class PasswordBody(val newPassword: String)

@Serializable
data class DeleteBody(val code: String)

@Serializable
data class ProfilePatchBody(
    val displayName: String? = null,
    val bio: String? = null,
    val gender: String? = null,
)

@Serializable
data class ProfilePatchResponse(val user: User)

// 系统更新（GET /api/app/latest）
@Serializable
data class LatestApp(
    val android: AndroidLatest? = null,
    val ios: IosLatest? = null,
)

@Serializable
data class AndroidLatest(
    val versionCode: Int = 0,
    val versionName: String = "",
    val url: String = "",
    val sizeMb: Double = 0.0,
    val minSdk: String = "",
    val note: String = "",
)

@Serializable
data class IosLatest(
    val status: String = "preparing",
    val note: String = "",
    val url: String = "",
)
