import SwiftUI

/// M.NationWorld — 架空世界创作平台（iOS / iPadOS 一套代码）
///
/// 架构约定（见 README.md）：
/// - 网络层直连现有后端 `https://mnationworld.com` 的 REST API，后端零重写。
/// - 所有模型是 `struct`；会话状态走 `@Observable` 的 `Session`，注入环境。
/// - 视图按模块分文件夹：Home / Encyclopedia / Community / Messages / Me。

@main
struct MNationWorldApp: App {
    /// 会话状态：登录用户、登录令牌（UserDefaults 持久化）。
    @State private var session = Session()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(session)
                .tint(Color(red: 0.275, green: 0.282, blue: 0.831)) // 品牌蓝 #4648d4
        }
    }
}
