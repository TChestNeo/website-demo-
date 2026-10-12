package com.mnationworld.app

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.filled.ChatBubbleOutline
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Face
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Person2
import androidx.compose.material.icons.outlined.Flag
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import kotlinx.coroutines.launch

data class TabItem(val label: String, val icon: ImageVector)

// ── 主界面：Material 3 官方底部导航（5 tab，与网页/iOS 一致） ──

@Composable
fun MainScreen() {
    var selected by remember { mutableStateOf(0) }
    val tabs = listOf(
        TabItem("首页", Icons.Filled.Home),
        TabItem("百科", Icons.AutoMirrored.Filled.List),
        TabItem("社区", Icons.Filled.Face),
        TabItem("消息", Icons.Filled.Email),
        TabItem("我的", Icons.Filled.Person),
    )

    Scaffold(
        bottomBar = {
            NavigationBar {
                tabs.forEachIndexed { i, t ->
                    NavigationBarItem(
                        selected = selected == i,
                        onClick = { selected = i },
                        icon = { Icon(t.icon, contentDescription = t.label) },
                        label = { Text(t.label) },
                    )
                }
            }
        }
    ) { padding ->
        Box(Modifier.padding(padding).fillMaxSize()) {
            when (selected) {
                0 -> HomeTab()
                1 -> EncyclopediaTab()
                2 -> CommunityTab()
                3 -> MessagesTab()
                4 -> MeTab()
            }
        }
    }
}

// ── 通用加载脚手架 ──

@Composable
fun <T> LoadedList(
    load: suspend () -> List<T>,
    emptyText: String,
    itemContent: @Composable (T) -> Unit,
) {
    var data by remember { mutableStateOf<List<T>?>(null) }
    var error by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) {
        data = try {
            load()
        } catch (e: Exception) {
            error = e.message
            emptyList()
        }
    }

    when {
        data == null && error == null -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator()
        }
        error != null && data.isNullOrEmpty() -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text(error ?: "加载失败", color = MaterialTheme.colorScheme.error)
        }
        data.isNullOrEmpty() -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text(emptyText, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        else -> LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp)) {
            items(data.orEmpty()) { itemContent(it) }
        }
    }
}

@Composable
fun SectionTitle(text: String) {
    Text(
        text,
        style = MaterialTheme.typography.titleMedium,
        modifier = Modifier.padding(top = 16.dp, bottom = 8.dp),
    )
}

// ── 首页 ──

@Composable
fun HomeTab() {
    var myNations by remember { mutableStateOf<List<Nation>?>(null) }
    var recent by remember { mutableStateOf<List<Post>?>(null) }

    LaunchedEffect(Unit) {
        myNations = runCatching { ApiClient.myNations() }.getOrNull()
        recent = runCatching { ApiClient.posts() }.getOrNull()?.take(5)
    }

    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp)) {
        item { Text("M.NationWorld", style = MaterialTheme.typography.headlineSmall) }
        item { SectionTitle("我的国家") }
        if (myNations.isNullOrEmpty()) {
            item { Text("还没有国家，去注册一个吧", color = MaterialTheme.colorScheme.onSurfaceVariant) }
        } else {
            items(myNations.orEmpty()) { n ->
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(vertical = 4.dp)) {
                    Icon(Icons.Outlined.Flag, null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(20.dp))
                    Spacer(Modifier.width(8.dp))
                    Text(n.displayName, style = MaterialTheme.typography.bodyLarge)
                }
            }
        }
        item { SectionTitle("最新动态") }
        if (recent.isNullOrEmpty()) {
            item { Text("暂无动态", color = MaterialTheme.colorScheme.onSurfaceVariant) }
        } else {
            items(recent.orEmpty()) { p -> PostRow(p) }
        }
    }
}

// ── 百科 ──

@Composable
fun EncyclopediaTab() {
    Column(Modifier.fillMaxSize().padding(16.dp)) {
        Text("百科", style = MaterialTheme.typography.headlineSmall)
        Spacer(Modifier.height(8.dp))
        LoadedList(
            load = { ApiClient.nations() },
            emptyText = "暂无国家",
        ) { nation ->
            Column(Modifier.padding(vertical = 8.dp)) {
                Text(nation.displayName, style = MaterialTheme.typography.titleMedium)
                if (!nation.classification.isNullOrEmpty()) {
                    Text(nation.classification, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.primary)
                }
                if (!nation.lore.isNullOrEmpty()) {
                    Text(nation.lore, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 2)
                }
                HorizontalDivider(Modifier.padding(top = 8.dp))
            }
        }
    }
}

// ── 帖子卡片（社区流 + 点赞） ──

@Composable
fun PostRow(post: Post, onOpen: () -> Unit = {}, onOpenAuthor: (() -> Unit)? = null) {
    Card(Modifier.fillMaxWidth().padding(vertical = 6.dp).clickable(onClick = onOpen)) {
        Column(Modifier.padding(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                if (!post.avatarUrl.isNullOrEmpty()) {
                    AsyncImage(model = post.avatarUrl, contentDescription = null, modifier = Modifier.size(28.dp))
                }
                Spacer(Modifier.width(8.dp))
                Text(
                    post.authorName ?: "匿名",
                    style = MaterialTheme.typography.labelLarge,
                    modifier = if (onOpenAuthor != null) Modifier.clickable(onClick = onOpenAuthor) else Modifier,
                )
            }
            Spacer(Modifier.height(6.dp))
            Text(post.content, style = MaterialTheme.typography.bodyMedium)
            Spacer(Modifier.height(6.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                val scope = rememberCoroutineScope()
                TextButton(onClick = {
                    scope.launch {
                        runCatching { ApiClient.like(post.id, post.likedByMe != true) }
                    }
                }) {
                    Icon(
                        if (post.likedByMe == true) Icons.Filled.Favorite else Icons.Filled.FavoriteBorder,
                        null,
                        tint = if (post.likedByMe == true) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.size(18.dp),
                    )
                    Spacer(Modifier.width(4.dp))
                    Text("${post.likeCount ?: 0}")
                }
                Icon(Icons.Filled.ChatBubbleOutline, null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(4.dp))
                Text("${post.commentCount ?: 0}", color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text(relativeTime(post.createdAt), color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 11.sp, modifier = Modifier.padding(start = 10.dp))
            }
        }
    }
}

// ── 社区 ──

@Composable
fun CommunityTab() {
    var openPost by remember { mutableStateOf<String?>(null) }
    var openUser by remember { mutableStateOf<String?>(null) }
    BackHandler(enabled = openPost != null || openUser != null) {
        openPost = null
        openUser = null
    }

    when {
        openPost != null -> PostDetailScreen(
            postId = openPost!!,
            onBack = { openPost = null },
            onOpenUser = { uid -> openUser = uid; openPost = null },
        )
        openUser != null -> ProfileScreen(
            userId = openUser!!,
            onBack = { openUser = null },
            onOpenPost = { pid -> openPost = pid; openUser = null },
        )
        else -> CommunityFeed(onOpenPost = { openPost = it }, onOpenUser = { openUser = it })
    }
}

@Composable
private fun CommunityFeed(onOpenPost: (String) -> Unit, onOpenUser: (String) -> Unit) {
    var draft by remember { mutableStateOf("") }
    var posts by remember { mutableStateOf<List<Post>?>(null) }
    val scope = rememberCoroutineScope()

    fun reload() {
        scope.launch {
            posts = runCatching { ApiClient.posts() }.getOrNull() ?: emptyList()
        }
    }

    LaunchedEffect(Unit) { reload() }

    Column(Modifier.fillMaxSize().padding(16.dp)) {
        Text("社区", style = MaterialTheme.typography.headlineSmall)
        Spacer(Modifier.height(8.dp))
        OutlinedTextField(
            value = draft,
            onValueChange = { draft = it },
            label = { Text("分享你的架空世界…") },
            modifier = Modifier.fillMaxWidth(),
            minLines = 2,
        )
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
            Button(
                onClick = {
                    scope.launch {
                        runCatching { ApiClient.createPost(draft.trim()) }
                        draft = ""
                        reload()
                    }
                },
                enabled = draft.isNotBlank(),
            ) {
                Text("发布")
            }
        }
        Spacer(Modifier.height(8.dp))
        LazyColumn(Modifier.weight(1f)) {
            posts?.forEach { p ->
                item {
                    PostRow(
                        post = p,
                        onOpen = { onOpenPost(p.id) },
                        onOpenAuthor = { onOpenUser(p.authorId) },
                    )
                }
            }
        }
    }
}

// ── 消息 ──

@Composable
fun MessagesTab() {
    var openChat by remember { mutableStateOf<Conversation?>(null) }
    BackHandler(enabled = openChat != null) { openChat = null }

    openChat?.let { conv ->
        ChatScreen(convId = conv.id, title = conv.title, onBack = { openChat = null })
        return
    }

    Column(Modifier.fillMaxSize().padding(16.dp)) {
        Text("消息", style = MaterialTheme.typography.headlineSmall)
        Spacer(Modifier.height(8.dp))
        LoadedList(
            load = { ApiClient.conversations() },
            emptyText = "暂无会话",
        ) { conv ->
            Row(
                Modifier.fillMaxWidth().padding(vertical = 10.dp).clickable { openChat = conv },
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(
                    if (conv.kind == "group") Icons.Filled.Face else Icons.Filled.Person2,
                    null,
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(28.dp).padding(end = 2.dp),
                )
                Spacer(Modifier.width(10.dp))
                Column(Modifier.weight(1f)) {
                    Text(conv.title, style = MaterialTheme.typography.titleMedium)
                    conv.lastMessage?.content?.let {
                        Text(it, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1)
                    }
                }
                if ((conv.unreadCount ?: 0) > 0) {
                    Badge { Text("${conv.unreadCount}") }
                }
            }
        }
    }
}

// ── 我的（完整版见 MeSettings.kt：设置与隐私 5 分类 + 账户操作） ──
