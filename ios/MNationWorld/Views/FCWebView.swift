import SwiftUI
import WebKit

/// FC 编辑器 Web 视图（WKWebView 嵌入现有网页版，功能 100% 完整）。
/// 登录互通：打开时把 URLSession 会话的 cookie 复制进 WKWebView，
/// 因此 app 内登录后打开编辑器即已是登录态（同一后端 mn_session）。
struct FCWebView: UIViewRepresentable {
    let url: URL

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        let webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = true
        syncCookies(to: webView)
        webView.load(URLRequest(url: url))
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator() }

    final class Coordinator: NSObject, WKNavigationDelegate {}

    /// URLSession 会话 cookie → WKWebView（登录状态互通）。
    private func syncCookies(to webView: WKWebView) {
        guard let cookies = HTTPCookieStorage.shared.cookies(for: url) else { return }
        let store = webView.configuration.websiteDataStore.httpCookieStore
        for cookie in cookies {
            store.setCookie(cookie)
        }
    }
}

/// 便捷入口：FC 编辑器完整版（网页嵌入）。
struct FCWebEditorView: View {
    var body: some View {
        FCWebView(url: URL(string: "https://mnationworld.com/pages/fluidcanvas-editor.html")!)
            .ignoresSafeArea(edges: .bottom)
            .navigationTitle("FluidCanvas 编辑器")
            .navigationBarTitleDisplayMode(.inline)
    }
}
