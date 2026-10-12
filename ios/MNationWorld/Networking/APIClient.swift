import Foundation

/// 直连现有后端 `https://mnationworld.com` 的 REST 客户端。
///
/// 契约（与网页端逐字一致，见 backend-v2/src/routes/public/）：
/// - 发码：POST /api/auth/email-code {email, purpose?}
/// - 登录/注册：POST /api/auth/verify {email, code, password?, displayName?}
///   响应 {status: "login"|"new", user, restored?, passwordSetupRequired?} + Set-Cookie mn_session
/// - 当前用户：GET /api/auth/me
/// - 登出：POST /api/auth/logout
/// - 社区动态：GET /api/social/feed · GET /api/social/posts
/// - 点赞：POST/DELETE /api/social/posts/:id/like
/// - 百科国家：GET /api/social/nations
/// - 消息：GET /api/messages（端点形状以 messages.js 为准，接入时对齐）
///
/// Cookie：URLSession.shared 自动保存 Set-Cookie 并携带，与网页会话同源。
struct APIClient {
    static let shared = APIClient()

    let baseURL: URL

    init(baseURL: URL = URL(string: "https://mnationworld.com")!) {
        self.baseURL = baseURL
    }

    // MARK: - 通用请求

    private func request<T: Decodable>(
        _ method: String,
        _ path: String,
        body: Encodable? = nil,
        query: [URLQueryItem] = []
    ) async throws -> T {
        var url = baseURL.appending(path: "/api/\(path)")
        if !query.isEmpty {
            url.append(queryItems: query)
        }
        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let body {
            req.httpBody = try JSONEncoder.mn.encode(body)
        }

        let (data, response): (Data, URLResponse)
        do {
            (data, response) = try await URLSession.shared.data(for: req)
        } catch {
            throw APIError.network(underlying: error)
        }
        guard let http = response as? HTTPURLResponse else { throw APIError.invalidResponse }

        // 后端统一错误形状：{"error":{"code","message"}}
        if http.statusCode >= 400 {
            if let err = try? JSONDecoder.mn.decode(ServerErrorEnvelope.self, from: data) {
                throw APIError.server(code: err.error.code, message: err.error.message)
            }
            throw APIError.server(code: "HTTP \(http.statusCode)", message: "请求失败")
        }
        return try JSONDecoder.mn.decode(T.self, from: data)
    }

    private func requestVoid(_ method: String, _ path: String, body: Encodable? = nil) async throws {
        var url = baseURL.appending(path: "/api/\(path)")
        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let body {
            req.httpBody = try JSONEncoder.mn.encode(body)
        }
        let (data, response): (Data, URLResponse)
        do {
            (data, response) = try await URLSession.shared.data(for: req)
        } catch {
            throw APIError.network(underlying: error)
        }
        guard let http = response as? HTTPURLResponse else { throw APIError.invalidResponse }
        if http.statusCode >= 400 {
            if let err = try? JSONDecoder.mn.decode(ServerErrorEnvelope.self, from: data) {
                throw APIError.server(code: err.error.code, message: err.error.message)
            }
            throw APIError.server(code: "HTTP \(http.statusCode)", message: "请求失败")
        }
    }

    // MARK: - 便捷方法

    func get<T: Decodable>(_ path: String, query: [URLQueryItem] = []) async throws -> T {
        try await request("GET", path, query: query)
    }

    func postVoid(_ path: String, body: Encodable? = nil) async throws {
        try await requestVoid("POST", path, body: body)
    }

    func deleteVoid(_ path: String) async throws {
        try await requestVoid("DELETE", path)
    }

    // MARK: - 认证

    struct EmailCodeBody: Encodable {
        let email: String
        let purpose: String?

        init(email: String, purpose: String? = nil) {
            self.email = email
            self.purpose = purpose
        }
    }

    struct VerifyBody: Encodable {
        let email: String
        let code: String
        let password: String?
        let displayName: String?

        init(email: String, code: String, password: String? = nil, displayName: String? = nil) {
            self.email = email
            self.code = code
            self.password = password
            self.displayName = displayName
        }
    }

    struct VerifyResponse: Decodable {
        let status: String
        let user: User
        let restored: Bool?
        let passwordSetupRequired: Bool?

        enum CodingKeys: String, CodingKey {
            case status, user, restored
            case passwordSetupRequired = "passwordSetupRequired"
        }
    }

    /// 发送邮箱验证码。
    func sendEmailCode(_ email: String, purpose: String? = nil) async throws {
        try await postVoid("auth/email-code", body: EmailCodeBody(email: email, purpose: purpose))
    }

    /// 验证码登录 / 注册（新注册需带 password ≥8 位）。
    func verify(_ body: VerifyBody) async throws -> VerifyResponse {
        try await request("POST", "auth/verify", body: body)
    }

    func me() async throws -> User {
        try await get("auth/me")
    }

    // MARK: - 社区

    struct FeedResponse: Decodable {
        let posts: [Post]
    }

    struct PostsResponse: Decodable {
        let posts: [Post]
    }

    struct NationsResponse: Decodable {
        let nations: [Nation]
    }

    func feed() async throws -> [Post] {
        let resp: FeedResponse = try await get("social/feed")
        return resp.posts
    }

    func posts() async throws -> [Post] {
        let resp: PostsResponse = try await get("social/posts")
        return resp.posts
    }

    func nations() async throws -> [Nation] {
        let resp: NationsResponse = try await get("social/nations")
        return resp.nations
    }

    func like(post id: String, like: Bool) async throws {
        if like {
            try await postVoid("social/posts/\(id)/like")
        } else {
            try await deleteVoid("social/posts/\(id)/like")
        }
    }

    // MARK: - 消息（GET /api/conversations）

    struct ConversationsResponse: Decodable {
        let conversations: [Conversation]
    }

    func conversations() async throws -> [Conversation] {
        let resp: ConversationsResponse = try await get("conversations")
        return resp.conversations
    }

    // MARK: - 我的国家（首页工作台）

    func myNations() async throws -> [Nation] {
        let resp: NationsResponse = try await get("social/nations/mine")
        return resp.nations
    }

    // MARK: - 发帖

    struct CreatePostBody: Encodable {
        let content: String
        let topicId: String?

        init(content: String, topicId: String? = nil) {
            self.content = content
            self.topicId = topicId
        }
    }

    struct CreatePostResponse: Decodable {
        let post: Post?
    }

    func createPost(_ body: CreatePostBody) async throws -> Post? {
        let resp: CreatePostResponse = try await request("POST", "social/posts", body: body)
        return resp.post
    }

    // MARK: - 个人资料（PATCH /api/auth/me：displayName/bio/gender/language/country…）

    struct ProfilePatch: Encodable {
        var displayName: String?
        var bio: String?
        var gender: String?
        var language: String?
        var country: String?

        init(displayName: String? = nil, bio: String? = nil, gender: String? = nil,
             language: String? = nil, country: String? = nil) {
            self.displayName = displayName
            self.bio = bio
            self.gender = gender
            self.language = language
            self.country = country
        }
    }

    struct ProfilePatchResponse: Decodable {
        let user: User
    }

    func updateProfile(_ patch: ProfilePatch) async throws -> User {
        let resp: ProfilePatchResponse = try await request("PATCH", "auth/me", body: patch)
        return resp.user
    }

    // MARK: - 密码与账号

    struct PasswordBody: Encodable {
        let newPassword: String

        init(newPassword: String) {
            self.newPassword = newPassword
        }
    }

    func changePassword(_ newPassword: String) async throws {
        try await postVoid("auth/password", body: PasswordBody(newPassword: newPassword))
    }

    struct DeleteBody: Encodable {
        let code: String

        init(code: String) {
            self.code = code
        }
    }

    struct DeleteResponse: Decodable {
        let ok: Bool
        let restoreBy: String?
    }

    /// 删除账户：先发码（purpose=delete_confirm），再带码调用；成功后 30 天后悔期（restoreBy）。
    func deleteAccount(code: String) async throws -> DeleteResponse {
        try await request("POST", "auth/delete", body: DeleteBody(code: code))
    }

    // MARK: - 屏蔽名单

    struct BlockedUser: Codable, Identifiable, Hashable {
        let id: String
        let displayName: String?
        let avatarUrl: String?
        let citizenId: String?
    }

    struct BlockedResponse: Decodable {
        let users: [BlockedUser]
    }

    func blockedUsers() async throws -> [BlockedUser] {
        let resp: BlockedResponse = try await get("social/blocked")
        return resp.users
    }

    func unblock(user id: String) async throws {
        try await deleteVoid("social/users/\(id)/block")
    }

    // MARK: - 赞过的内容（本人可见：GET /api/social/users/:id/posts?tab=likes）

    func likedPosts(userID: String) async throws -> [Post] {
        let resp: PostsResponse = try await get("social/users/\(userID)/posts", query: [URLQueryItem(name: "tab", value: "likes")])
        return resp.posts
    }
}

// MARK: - 错误信封

struct ServerErrorEnvelope: Decodable {
    let error: ServerError

    struct ServerError: Decodable {
        let code: String
        let message: String
    }
}

extension URL {
    mutating func append(queryItems: [URLQueryItem]) {
        guard !queryItems.isEmpty, var comps = URLComponents(url: self, resolvingAgainstBaseURL: false) else { return }
        comps.queryItems = (comps.queryItems ?? []) + queryItems
        if let new = comps.url { self = new }
    }
}
