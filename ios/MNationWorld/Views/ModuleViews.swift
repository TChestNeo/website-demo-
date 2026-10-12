import SwiftUI

// MARK: - 首页 / 工作台

struct HomeView: View {
    @Environment(Session.self) private var session
    @State private var vm = HomeViewModel()

    var body: some View {
        List {
            if let errorText = vm.errorText {
                Section {
                    Text(errorText).foregroundStyle(.red)
                }
            }

            Section("我的国家") {
                if vm.myNations.isEmpty {
                    Text("还没有国家，去注册一个吧")
                        .foregroundStyle(.secondary)
                } else {
                    ForEach(vm.myNations) { nation in
                        Label(nation.displayName, systemImage: "flag.fill")
                    }
                }
            }

            Section("快捷入口") {
                Label("新建国家", systemImage: "plus.circle.fill")
                Label("FluidCanvas 编辑器", systemImage: "scribble.variable")
                Label("提交工单", systemImage: "ticket.fill")
            }

            Section("最新动态") {
                if vm.recentPosts.isEmpty {
                    Text("暂无动态").foregroundStyle(.secondary)
                } else {
                    ForEach(vm.recentPosts) { post in
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
        }
        .navigationTitle("M.NationWorld")
        .refreshable { await vm.load() }
        .task { await vm.load() }
    }
}

// MARK: - 百科

struct EncyclopediaView: View {
    @State private var vm = EncyclopediaViewModel()

    var body: some View {
        Group {
            if vm.loading && vm.nations.isEmpty {
                ProgressView()
            } else if vm.nations.isEmpty {
                ContentUnavailableView(
                    "暂无国家",
                    systemImage: "book",
                    description: Text(vm.errorText ?? "下拉刷新重试")
                )
            } else {
                List(vm.nations) { nation in
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Text(nation.displayName)
                                .font(.headline)
                            if let classification = nation.classification, !classification.isEmpty {
                                Text(classification)
                                    .font(.caption)
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 2)
                                    .background(Color.accentColor.opacity(0.12), in: Capsule())
                                    .foregroundStyle(Color.accentColor)
                            }
                        }
                        if let lore = nation.lore, !lore.isEmpty {
                            Text(lore)
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                                .lineLimit(2)
                        }
                    }
                    .padding(.vertical, 2)
                }
            }
        }
        .navigationTitle("百科")
        .refreshable { await vm.load() }
        .task { await vm.load() }
    }
}

// MARK: - 社区

struct CommunityView: View {
    @State private var vm = CommunityViewModel()

    var body: some View {
        List {
            // 发帖输入框
            Section {
                VStack(alignment: .leading, spacing: 8) {
                    TextField("分享你的架空世界…", text: $vm.newPostText, axis: .vertical)
                        .lineLimit(1 ... 4)
                    HStack {
                        Spacer()
                        Button(vm.posting ? "发布中…" : "发布") {
                            Task { await vm.publish() }
                        }
                        .buttonStyle(.borderedProminent)
                        .disabled(vm.posting || vm.newPostText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    }
                }
                .padding(.vertical, 4)
            }

            if let errorText = vm.errorText {
                Section {
                    Text(errorText).foregroundStyle(.red)
                }
            }

            Section("动态") {
                if vm.posts.isEmpty && !vm.loading {
                    Text("暂无动态").foregroundStyle(.secondary)
                } else {
                    ForEach(vm.posts) { post in
                        PostRow(post: post) {
                            Task { await vm.toggleLike(post) }
                        }
                    }
                }
            }
        }
        .navigationTitle("社区")
        .refreshable { await vm.load() }
        .task { await vm.load() }
    }
}

/// 帖子卡片行
struct PostRow: View {
    let post: Post
    var onLike: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                AsyncImage(url: post.avatarUrl.flatMap(URL.init)) { image in
                    image.resizable()
                } placeholder: {
                    Circle().fill(Color(.systemGray4))
                }
                .frame(width: 32, height: 32)
                .clipShape(Circle())

                VStack(alignment: .leading, spacing: 1) {
                    Text(post.authorName ?? "匿名")
                        .font(.subheadline.weight(.semibold))
                    if let createdAt = post.createdAt {
                        Text(Self.relative(createdAt))
                            .font(.caption2)
                            .foregroundStyle(.tertiary)
                    }
                }
            }

            Text(post.content)
                .font(.subheadline)

            HStack(spacing: 20) {
                Button(action: onLike) {
                    Label("\(post.likeCount ?? 0)", systemImage: post.likedByMe == true ? "heart.fill" : "heart")
                }
                .foregroundStyle(post.likedByMe == true ? .red : .secondary)
                .buttonStyle(.plain)

                Label("\(post.commentCount ?? 0)", systemImage: "bubble.right")
                    .foregroundStyle(.secondary)
            }
            .font(.footnote)
        }
        .padding(.vertical, 4)
    }

    /// ISO 时间 → 「刚刚 / n 分钟前 / n 小时前 / 日期」。
    static func relative(_ iso: String) -> String {
        let fmt = ISO8601DateFormatter()
        guard let date = fmt.date(from: iso) else { return iso }
        let seconds = Date().timeIntervalSince(date)
        if seconds < 60 { return "刚刚" }
        if seconds < 3600 { return "\(Int(seconds / 60)) 分钟前" }
        if seconds < 86400 { return "\(Int(seconds / 3600)) 小时前" }
        return iso.prefix(10).description
    }
}

// MARK: - 消息

struct MessagesView: View {
    @State private var vm = MessagesViewModel()

    var body: some View {
        Group {
            if vm.loading && vm.conversations.isEmpty {
                ProgressView()
            } else if vm.conversations.isEmpty {
                ContentUnavailableView(
                    "暂无会话",
                    systemImage: "bubble.left.and.bubble.right",
                    description: Text(vm.errorText ?? "下拉刷新重试")
                )
            } else {
                List(vm.conversations) { conv in
                    HStack(spacing: 12) {
                        Image(systemName: conv.kind == "group" ? "person.3.fill" : "person.crop.circle.fill")
                            .font(.title3)
                            .foregroundStyle(Color.accentColor)

                        VStack(alignment: .leading, spacing: 2) {
                            Text(conv.title)
                                .font(.headline)
                            if let last = conv.lastMessage?.content {
                                Text(last)
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                                    .lineLimit(1)
                            }
                        }

                        Spacer()

                        if let unread = conv.unreadCount, unread > 0 {
                            Text("\(unread)")
                                .font(.caption.bold())
                                .foregroundStyle(.white)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 3)
                                .background(Color.accentColor, in: Capsule())
                        }
                    }
                    .padding(.vertical, 2)
                }
            }
        }
        .navigationTitle("消息")
        .refreshable { await vm.load() }
        .task { await vm.load() }
    }
}

// MARK: - 我的（用户卡片 + 设置与隐私 5 分类；详情页 P2 填充）

struct MeView: View {
    @Environment(Session.self) private var session

    var body: some View {
        List {
            Section {
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

            Section("设置与隐私") {
                Label("活动", systemImage: "chart.line.uptrend.xyaxis")
                Label("账户", systemImage: "person.crop.circle")
                Label("可见性", systemImage: "eye")
                Label("互动", systemImage: "hand.tap")
                Label("偏好设置", systemImage: "slider.horizontal.3")
            }

            Section {
                Label("帮助与支持", systemImage: "questionmark.circle")
                Button("登出", role: .destructive) {
                    Task { await session.logout() }
                }
                Button("删除账户", role: .destructive) {}
            }
        }
        .navigationTitle("我的")
    }
}
