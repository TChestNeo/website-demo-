import Foundation

// MARK: - 用户（镜像后端 publicUser——顶层 camelCase，JSONDecoder convertFromSnakeCase 只对含下划线的键生效）

struct User: Codable, Identifiable, Hashable {
    let id: String
    var displayName: String
    let email: String
    let citizenId: String?
    let avatarUrl: String?
    let tier: String?
    let tierExpiresAt: String?
    let role: String?
    let status: String?
    let hasPassword: Bool?
    let gender: String?
    let xpGained: Int?
    let avatarFrame: String?
    let title: String?
    let createdAt: String?
}

// MARK: - 帖子（镜像后端 postRow——camelCase）

struct Post: Codable, Identifiable, Hashable {
    let id: String
    let authorId: String
    let authorName: String?
    let avatarUrl: String?
    let content: String
    let createdAt: String?
    let likeCount: Int?
    let commentCount: Int?
    let likedByMe: Bool?
    let repostCount: Int?
    let repostedByMe: Bool?
    let viewCount: Int?
    let favoritedByMe: Bool?
    let topicId: String?
    let status: String?
}

// MARK: - 微国家（nations 表 data JSON；字段来自注册向导：name/moniker/classification/capital/lore…）

struct Nation: Codable, Identifiable, Hashable {
    let id: String?
    let name: String?
    let moniker: String?
    let classification: String?
    let capital: String?
    let lore: String?
    let status: String?
    let createdAt: String?

    var displayName: String { name ?? id ?? "未命名国家" }
}

// MARK: - 消息会话（GET /api/conversations）

struct Conversation: Codable, Identifiable, Hashable {
    let id: String
    let kind: String?
    let name: String?
    let createdAt: String?
    let members: [Member]?
    let lastMessage: LastMessage?
    let unreadCount: Int?

    /// 私聊显示对方名 / 群聊显示群名。
    var title: String { name ?? "会话" }
}

struct Member: Codable, Hashable {
    let id: String?
    let displayName: String?
    let avatarUrl: String?
}

/// lastMessage 来自数据库列（snake_case），convertFromSnakeCase 自动转 camelCase。
struct LastMessage: Codable, Hashable {
    let id: String?
    let senderId: String?
    let content: String?
    let createdAt: String?
}

// MARK: - 平台范围错误

enum APIError: LocalizedError {
    case invalidResponse
    case server(code: String, message: String)
    case notLoggedIn
    case network(underlying: Error)

    var errorDescription: String? {
        switch self {
        case .invalidResponse: "服务器响应异常"
        case let .server(code, message): "\(message)（\(code)）"
        case .notLoggedIn: "未登录"
        case let .network(underlying): "网络错误：\(underlying.localizedDescription)"
        }
    }
}
