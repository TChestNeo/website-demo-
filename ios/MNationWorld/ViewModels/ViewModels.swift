import Foundation
import Observation

// MARK: - 首页工作台

@Observable
final class HomeViewModel {
    var myNations: [Nation] = []
    var recentPosts: [Post] = []
    var loading = false
    var errorText: String?

    func load() async {
        loading = true
        errorText = nil
        do {
            async let nationsTask = APIClient.shared.myNations()
            async let postsTask = APIClient.shared.posts()
            let (nations, posts) = try await (nationsTask, postsTask)
            myNations = nations
            recentPosts = Array(posts.prefix(5))
        } catch {
            errorText = error.localizedDescription
        }
        loading = false
    }
}

// MARK: - 百科

@Observable
final class EncyclopediaViewModel {
    var nations: [Nation] = []
    var loading = false
    var errorText: String?

    func load() async {
        loading = true
        errorText = nil
        do {
            nations = try await APIClient.shared.nations()
        } catch {
            errorText = error.localizedDescription
        }
        loading = false
    }
}

// MARK: - 社区

@Observable
final class CommunityViewModel {
    var posts: [Post] = []
    var loading = false
    var errorText: String?
    var newPostText = ""
    var posting = false

    func load() async {
        loading = true
        errorText = nil
        do {
            posts = try await APIClient.shared.posts()
        } catch {
            errorText = error.localizedDescription
        }
        loading = false
    }

    func publish() async {
        let text = newPostText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        posting = true
        do {
            _ = try await APIClient.shared.createPost(.init(content: text))
            newPostText = ""
            await load()
        } catch {
            errorText = error.localizedDescription
        }
        posting = false
    }

    func toggleLike(_ post: Post) async {
        do {
            try await APIClient.shared.like(post: post.id, like: !(post.likedByMe ?? false))
            await load()
        } catch {
            errorText = error.localizedDescription
        }
    }
}

// MARK: - 消息

@Observable
final class MessagesViewModel {
    var conversations: [Conversation] = []
    var loading = false
    var errorText: String?

    func load() async {
        loading = true
        errorText = nil
        do {
            conversations = try await APIClient.shared.conversations()
        } catch {
            errorText = error.localizedDescription
        }
        loading = false
    }
}
