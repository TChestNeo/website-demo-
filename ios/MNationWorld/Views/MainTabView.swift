import SwiftUI

/// 主界面：5 个根 tab（首页 / 百科 / 社区 / 消息 / 我的）。
///
/// 全部使用 Apple 官方组件：
/// - iPhone：系统 TabView 底部 tab 栏——iOS 26 上自动呈现 Liquid Glass 药丸形态（Apple 官方样式）；
/// - iPad：`.sidebarAdaptable` 自动变为侧边栏（官方一次适配，无需手写分支）。
struct MainTabView: View {
    enum Tab: String, CaseIterable, Identifiable, Hashable {
        case home = "首页"
        case encyclopedia = "百科"
        case community = "社区"
        case messages = "消息"
        case me = "我的"

        var id: String { rawValue }
    }

    @State private var selection: Tab? = .home

    var body: some View {
        TabView(selection: $selection) {
            Tab("首页", systemImage: "house.fill", value: Tab.home) {
                NavigationStack { HomeView() }
            }
            Tab("百科", systemImage: "book.fill", value: Tab.encyclopedia) {
                NavigationStack { EncyclopediaView() }
            }
            Tab("社区", systemImage: "person.3.fill", value: Tab.community) {
                NavigationStack { CommunityView() }
            }
            Tab("消息", systemImage: "bubble.left.and.bubble.right.fill", value: Tab.messages) {
                NavigationStack { MessagesView() }
            }
            Tab("我的", systemImage: "person.crop.circle.fill", value: Tab.me) {
                NavigationStack { MeView() }
            }
        }
        .tabViewStyle(.sidebarAdaptable)
    }
}

#Preview {
    MainTabView()
        .environment(Session())
}
