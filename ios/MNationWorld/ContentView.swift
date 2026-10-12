import SwiftUI

/// 根视图：未登录 → 登录页；已登录 → 主 Tab。
/// iPad 用侧边栏导航（NavigationSplitView 风格由 MainTabView 内部处理），iPhone 用底部药丸 Tab。
struct RootView: View {
    @Environment(Session.self) private var session

    var body: some View {
        Group {
            if session.isLoggedIn {
                MainTabView()
            } else {
                LoginView()
            }
        }
    }
}

#Preview {
    RootView()
        .environment(Session())
}
