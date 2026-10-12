import SwiftUI

// MARK: - 我的（完整设置中心，与网页端「我的」5 分类一致）

struct MeView: View {
    @Environment(Session.self) private var session
    @State private var showDeleteSheet = false

    var body: some View {
        List {
            // 用户卡片
            Section {
                NavigationLink {
                    ProfileEditView()
                } label: {
                    HStack(spacing: 12) {
                        AsyncImage(url: session.user?.avatarUrl.flatMap(URL.init)) { image in
                            image.resizable()
                        } placeholder: {
                            Circle().fill(Color(.systemGray4))
                        }
                        .frame(width: 48, height: 48)
                        .clipShape(Circle())

                        VStack(alignment: .leading, spacing: 2) {
                            Text(session.user?.displayName ?? "未登录")
                                .font(.headline)
                            Text(session.user?.citizenId ?? "")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .padding(.vertical, 4)
                }
            }

            // 关注 / 插件
            Section {
                Label("关注", systemImage: "heart")
                Label("插件", systemImage: "puzzlepiece.extension")
            }

            // 设置与隐私 5 分类
            Section("设置与隐私") {
                NavigationLink {
                    ActivitySettingsView()
                } label: {
                    Label("活动", systemImage: "chart.line.uptrend.xyaxis")
                }
                NavigationLink {
                    AccountSettingsView()
                } label: {
                    Label("账户", systemImage: "person.crop.circle")
                }
                NavigationLink {
                    VisibilitySettingsView()
                } label: {
                    Label("可见性", systemImage: "eye")
                }
                NavigationLink {
                    InteractionSettingsView()
                } label: {
                    Label("互动", systemImage: "hand.tap")
                }
                NavigationLink {
                    PreferenceSettingsView()
                } label: {
                    Label("偏好设置", systemImage: "slider.horizontal.3")
                }
            }

            // 帮助与支持 + 账户操作
            Section {
                Label("帮助与支持", systemImage: "questionmark.circle")
                Button("切换账户", role: .destructive) {
                    Task { await session.logout() }
                }
                Button("登出", role: .destructive) {
                    Task { await session.logout() }
                }
                Button("删除账户", role: .destructive) {
                    showDeleteSheet = true
                }
            }
        }
        .navigationTitle("我的")
        .sheet(isPresented: $showDeleteSheet) {
            DeleteAccountSheet()
                .environment(session)
        }
    }
}

// MARK: - 个人账户（资料编辑：昵称 / 简介 / 性别）

struct ProfileEditView: View {
    @Environment(Session.self) private var session
    @State private var displayName = ""
    @State private var bio = ""
    @State private var gender = ""
    @State private var saving = false
    @State private var savedTip = false

    var body: some View {
        Form {
            Section("昵称") {
                TextField("昵称", text: $displayName)
            }
            Section("简介") {
                TextField("介绍一下你的架空世界…", text: $bio, axis: .vertical)
                    .lineLimit(1 ... 4)
            }
            Section("性别") {
                TextField("性别", text: $gender)
            }
            Section {
                Button(saving ? "保存中…" : "保存") {
                    Task { await save() }
                }
                .disabled(saving)
                if savedTip {
                    Text("已保存").foregroundStyle(.green)
                }
            }
        }
        .navigationTitle("个人账户")
        .onAppear {
            displayName = session.user?.displayName ?? ""
        }
    }

    private func save() async {
        saving = true
        do {
            let user = try await APIClient.shared.updateProfile(.init(
                displayName: displayName.isEmpty ? nil : displayName,
                bio: bio.isEmpty ? nil : bio,
                gender: gender.isEmpty ? nil : gender
            ))
            session.applyLogin(user)
            savedTip = true
        } catch {
            savedTip = false
        }
        saving = false
    }
}

// MARK: - 活动（内容偏好 + 通知）

struct ActivitySettingsView: View {
    @AppStorage("mn.pref.notify") private var notify = true
    private let topics = ["政治", "经济", "文化", "科技", "军事", "体育", "娱乐", "生活"]

    var body: some View {
        List {
            Section("通知") {
                Toggle("通知", isOn: $notify)
            }
            Section("内容偏好") {
                ForEach(topics, id: \.self) { topic in
                    Toggle(topic, isOn: topicBinding(topic))
                }
            }
        }
        .navigationTitle("活动")
    }

    private func topicBinding(_ topic: String) -> Binding<Bool> {
        Binding(
            get: { UserDefaults.standard.bool(forKey: "mn.pref.topic.\(topic)") },
            set: { UserDefaults.standard.set($0, forKey: "mn.pref.topic.\(topic)") }
        )
    }
}

// MARK: - 账户（个人账户 + 隐私与安全改密码）

struct AccountSettingsView: View {
    var body: some View {
        List {
            Section {
                NavigationLink {
                    ProfileEditView()
                } label: {
                    Label("个人账户", systemImage: "person.crop.circle")
                }
                NavigationLink {
                    ChangePasswordView()
                } label: {
                    Label("隐私与安全", systemImage: "shield")
                }
            }
        }
        .navigationTitle("账户")
    }
}

struct ChangePasswordView: View {
    @State private var password = ""
    @State private var busy = false
    @State private var tip: String?

    var body: some View {
        Form {
            Section("新密码（至少 8 位）") {
                SecureField("新密码", text: $password)
            }
            Section {
                Button(busy ? "提交中…" : "修改密码") {
                    Task { await submit() }
                }
                .disabled(busy || password.count < 8)
                if let tip {
                    Text(tip)
                }
            }
        }
        .navigationTitle("隐私与安全")
    }

    private func submit() async {
        busy = true
        do {
            try await APIClient.shared.changePassword(password)
            tip = "密码已更新"
            password = ""
        } catch {
            tip = error.localizedDescription
        }
        busy = false
    }
}

// MARK: - 可见性（私密账号 + 屏蔽账号名单）

struct VisibilitySettingsView: View {
    @AppStorage("mn.pref.privateAccount") private var privateAccount = false
    @State private var blocked: [BlockedUser] = []
    @State private var loading = true

    var body: some View {
        List {
            Section("隐私") {
                Toggle("私密账号", isOn: $privateAccount)
            }
            Section("屏蔽账号") {
                if loading {
                    ProgressView()
                } else if blocked.isEmpty {
                    Text("暂无屏蔽账号").foregroundStyle(.secondary)
                } else {
                    ForEach(blocked) { user in
                        HStack {
                            Text(user.displayName ?? user.id)
                            Spacer()
                            Button("解除屏蔽") {
                                Task { await unblock(user) }
                            }
                            .font(.footnote)
                            .foregroundStyle(.red)
                        }
                    }
                }
            }
        }
        .navigationTitle("可见性")
        .task { await loadBlocked() }
    }

    private func loadBlocked() async {
        loading = true
        blocked = (try? await APIClient.shared.blockedUsers()) ?? []
        loading = false
    }

    private func unblock(_ user: BlockedUser) async {
        try? await APIClient.shared.unblock(user: user.id)
        await loadBlocked()
    }
}

// MARK: - 互动（许可开关 + 关注列表 + 赞过的视频）

struct InteractionSettingsView: View {
    @AppStorage("mn.pref.allowComments") private var allowComments = true
    @AppStorage("mn.pref.allowMentions") private var allowMentions = true
    @AppStorage("mn.pref.allowDM") private var allowDM = true
    @AppStorage("mn.pref.allowDerivative") private var allowDerivative = true
    @Environment(Session.self) private var session
    @State private var likedPosts: [Post] = []
    @State private var likedLoading = true

    var body: some View {
        List {
            Section("互动许可") {
                Toggle("评论", isOn: $allowComments)
                Toggle("提及", isOn: $allowMentions)
                Toggle("私信", isOn: $allowDM)
                Toggle("二次创作内容", isOn: $allowDerivative)
            }
            Section("列表") {
                Label("关注列表", systemImage: "heart")
                NavigationLink {
                    LikedPostsView()
                } label: {
                    Label("赞过的视频", systemImage: "hand.thumbsup")
                }
            }
        }
        .navigationTitle("互动")
    }
}

struct LikedPostsView: View {
    @Environment(Session.self) private var session
    @State private var posts: [Post] = []
    @State private var loading = true

    var body: some View {
        Group {
            if loading {
                ProgressView()
            } else if posts.isEmpty {
                ContentUnavailableView("暂无赞过的内容", systemImage: "hand.thumbsup")
            } else {
                List(posts) { post in
                    VStack(alignment: .leading, spacing: 4) {
                        Text(post.authorName ?? "匿名")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        Text(post.content)
                            .font(.subheadline)
                            .lineLimit(3)
                    }
                    .padding(.vertical, 2)
                }
            }
        }
        .navigationTitle("赞过的视频")
        .task { await load() }
    }

    private func load() async {
        loading = true
        if let uid = session.user?.id {
            posts = (try? await APIClient.shared.likedPosts(userID: uid)) ?? []
        }
        loading = false
    }
}

// MARK: - 偏好设置（语言 + 显示 + 观众控制 + 辅助功能）

struct PreferenceSettingsView: View {
    @AppStorage("mn.pref.language") private var language = "zh"
    @AppStorage("mn.pref.theme") private var theme = "system"
    @AppStorage("mn.pref.audience") private var audience = "public"
    @AppStorage("mn.pref.reduceMotion") private var reduceMotion = false

    var body: some View {
        Form {
            Section("语言") {
                Picker("语言", selection: $language) {
                    Text("中文").tag("zh")
                    Text("English").tag("en")
                }
            }
            Section("显示") {
                Picker("主题", selection: $theme) {
                    Text("浅色").tag("light")
                    Text("深色").tag("dark")
                    Text("跟随系统").tag("system")
                }
            }
            Section("观众控制") {
                Picker("谁能看到我的内容", selection: $audience) {
                    Text("公开（所有人可见）").tag("public")
                    Text("仅关注者可见").tag("followers")
                    Text("仅自己可见").tag("private")
                }
            }
            Section("辅助功能") {
                Toggle("减少动画", isOn: $reduceMotion)
            }
        }
        .navigationTitle("偏好设置")
    }
}

// MARK: - 删除账户（30 天后悔期，对齐网页端流程）

struct DeleteAccountSheet: View {
    @Environment(Session.self) private var session
    @Environment(\.dismiss) private var dismiss

    @State private var code = ""
    @State private var busy = false
    @State private var codeSent = false
    @State private var errorText: String?
    @State private var restoreBy: String?

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Text("删除账户后 30 天内重新登录可恢复；30 天后所有数据将被彻底删除且不可恢复。")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }

                if !codeSent {
                    Section {
                        Button("发送确认验证码到邮箱", role: .destructive) {
                            Task { await sendCode() }
                        }
                        .disabled(busy)
                    }
                } else {
                    Section("输入 6 位验证码确认删除") {
                        TextField("验证码", text: $code)
                            .keyboardType(.numberPad)
                            .textContentType(.oneTimeCode)
                            .onChange(of: code) { _, new in
                                code = String(new.filter(\.isNumber).prefix(6))
                            }
                    }
                    Section {
                        Button("确认删除账户", role: .destructive) {
                            Task { await confirmDelete() }
                        }
                        .disabled(busy || code.count != 6)
                    }
                }

                if let errorText {
                    Section {
                        Text(errorText).foregroundStyle(.red)
                    }
                }
            }
            .navigationTitle("删除账户")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("取消") { dismiss() }
                }
            }
            .interactiveDismissDisabled(codeSent)
        }
    }

    private func sendCode() async {
        busy = true
        errorText = nil
        do {
            try await APIClient.shared.sendEmailCode(session.user?.email ?? "", purpose: "delete_confirm")
            codeSent = true
        } catch {
            errorText = error.localizedDescription
        }
        busy = false
    }

    private func confirmDelete() async {
        busy = true
        errorText = nil
        do {
            let resp = try await APIClient.shared.deleteAccount(code: code)
            if resp.ok {
                restoreBy = resp.restoreBy
                await session.logout()
                dismiss()
            }
        } catch {
            errorText = error.localizedDescription
        }
        busy = false
    }
}
