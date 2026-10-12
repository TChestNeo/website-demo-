import Foundation
import Observation
import WebKit

/// 全局会话：当前用户 + 登录态。
/// 登录成功后后端通过 Set-Cookie 下发 `mn_session`；URLSession 的共享 cookie 存储自动保存并随后续请求携带，
/// 因此这里只需维护用户信息快照，令牌由系统 cookie 机制托管（与网页端语义一致）。
@Observable
final class Session {
    var user: User?
    var isLoggedIn = false

    private let userKey = "mn.session.user"

    init() {
        if let data = UserDefaults.standard.data(forKey: userKey),
           let saved = try? JSONDecoder.mn.decode(User.self, from: data) {
            user = saved
            isLoggedIn = true
        }
    }

    /// 登录成功：保存用户快照，并同步会话 cookie 到 WKWebView（FC 编辑器网页嵌入登录互通）。
    func applyLogin(_ user: User) {
        self.user = user
        isLoggedIn = true
        if let data = try? JSONEncoder.mn.encode(user) {
            UserDefaults.standard.set(data, forKey: userKey)
        }
        syncWebViewCookies()
    }

    /// URLSession 会话 cookie → WKWebsiteDataStore（供 FCWebView 登录互通）。
    func syncWebViewCookies() {
        guard let cookies = HTTPCookieStorage.shared.cookies else { return }
        let store = WKWebsiteDataStore.default()
        for cookie in cookies where cookie.domain.contains("mnationworld.com") {
            store.httpCookieStore.setCookie(cookie)
        }
    }

    /// 刷新用户信息（/api/auth/me）。
    func refreshUser() async {
        guard isLoggedIn else { return }
        if let fresh: User = try? await APIClient.shared.get("auth/me") {
            applyLogin(fresh)
        }
    }

    /// 登出：清 cookie + 本地快照。
    func logout() async {
        _ = try? await APIClient.shared.postVoid("auth/logout")
        if let cookies = HTTPCookieStorage.shared.cookies {
            for cookie in cookies { HTTPCookieStorage.shared.deleteCookie(cookie) }
        }
        user = nil
        isLoggedIn = false
        UserDefaults.standard.removeObject(forKey: userKey)
    }
}

// MARK: - JSON 编解码约定（全站 snake_case）

extension JSONDecoder {
    static let mn: JSONDecoder = {
        let d = JSONDecoder()
        d.keyDecodingStrategy = .convertFromSnakeCase
        return d
    }()
}

extension JSONEncoder {
    static let mn: JSONEncoder = {
        let e = JSONEncoder()
        e.keyEncodingStrategy = .convertToSnakeCase
        return e
    }()
}
