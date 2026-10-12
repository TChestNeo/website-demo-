@file:OptIn(ExperimentalMaterial3Api::class)

package com.mnationworld.app

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import kotlinx.coroutines.launch

// ═══════════════ 帖子详情（正文 + 媒体 + 点赞/收藏/转发 + 评论楼中楼） ═══════════════

@Composable
fun PostDetailScreen(postId: String, onBack: () -> Unit, onOpenUser: (String) -> Unit) {
    BackHandler(onBack = onBack)
    var post by remember { mutableStateOf<Post?>(null) }
    var comments by remember { mutableStateOf<List<Comment>?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var commentText by remember { mutableStateOf("") }
    var replyTo by remember { mutableStateOf<Comment?>(null) }
    var sending by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    suspend fun reload() {
        post = runCatching { ApiClient.postDetail(postId) }.getOrNull()
        comments = runCatching { ApiClient.comments(postId) }.getOrNull() ?: emptyList()
        error = null
    }

    LaunchedEffect(postId) { reload() }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("帖子") },
                navigationIcon = {
                    IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, null) }
                },
            )
        },
        bottomBar = {
            Surface(shadowElevation = 8.dp) {
                Row(Modifier.fillMaxWidth().padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                    if (replyTo != null) {
                        Text(
                            "回复 @${replyTo?.authorName}",
                            fontSize = 12.sp,
                            color = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.clickable { replyTo = null },
                        )
                        Spacer(Modifier.width(8.dp))
                    }
                    OutlinedTextField(
                        value = commentText,
                        onValueChange = { commentText = it },
                        placeholder = { Text("写评论…", fontSize = 14.sp) },
                        modifier = Modifier.weight(1f),
                        maxLines = 4,
                    )
                    Spacer(Modifier.width(8.dp))
                    IconButton(
                        onClick = {
                            if (commentText.isBlank() || sending) return@IconButton
                            sending = true
                            scope.launch {
                                runCatching { ApiClient.postComment(postId, commentText.trim(), replyTo?.id) }
                                    .onSuccess {
                                        commentText = ""
                                        replyTo = null
                                        reload()
                                    }
                                    .onFailure { error = it.message }
                                sending = false
                            }
                        },
                        enabled = commentText.isNotBlank() && !sending,
                    ) {
                        if (sending) CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
                        else Icon(Icons.AutoMirrored.Filled.Send, null, tint = MaterialTheme.colorScheme.primary)
                    }
                }
            }
        },
    ) { padding ->
        LazyColumn(Modifier.fillMaxSize().padding(padding), contentPadding = PaddingValues(16.dp)) {
            post?.let { p ->
                item {
                    PostDetailCard(p, onOpenUser)
                    HorizontalDivider(Modifier.padding(vertical = 14.dp))
                }
            }
            item {
                Text(
                    "评论 ${comments?.size ?: 0}",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                )
            }
            error?.let {
                item { Text(it, color = MaterialTheme.colorScheme.error, fontSize = 13.sp) }
            }
            if (comments == null && post != null) {
                item { Box(Modifier.fillMaxWidth().padding(24.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator() } }
            } else {
                comments?.forEach { c ->
                    item {
                        CommentRow(c, replyTo?.id == c.id) {
                            replyTo = if (replyTo?.id == c.id) null else c
                            commentText = ""
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun PostDetailCard(p: Post, onOpenUser: (String) -> Unit) {
    val scope = rememberCoroutineScope()
    Column {
        Row(verticalAlignment = Alignment.CenterVertically) {
            AsyncImage(
                model = p.avatarUrl,
                contentDescription = null,
                modifier = Modifier.size(40.dp).background(MaterialTheme.colorScheme.surfaceVariant, CircleShape),
            )
            Spacer(Modifier.width(10.dp))
            Column(Modifier.weight(1f)) {
                Text(
                    p.authorName ?: "匿名",
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.clickable { onOpenUser(p.authorId) },
                )
                Text(relativeTime(p.createdAt), fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            IconButton(onClick = {
                scope.launch {
                    runCatching { ApiClient.favorite(p.id, p.favoritedByMe != true) }
                }
            }) {
                Text(if (p.favoritedByMe == true) "⭐" else "☆", fontSize = 18.sp)
            }
        }
        Spacer(Modifier.height(10.dp))
        Text(p.content, style = MaterialTheme.typography.bodyLarge)
        Spacer(Modifier.height(12.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(28.dp)) {
            ActionChip("❤ ${p.likeCount ?: 0}") {
                scope.launch {
                    runCatching { ApiClient.like(p.id, p.likedByMe != true) }
                }
            }
            Text("💬 ${p.commentCount ?: 0}", color = MaterialTheme.colorScheme.onSurfaceVariant)
            ActionChip("🔁 ${p.repostCount ?: 0}") {
                scope.launch {
                    runCatching { ApiClient.repost(p.id, p.repostedByMe != true) }
                }
            }
            Text("👁 ${p.viewCount ?: 0}", color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
private fun ActionChip(label: String, onClick: () -> Unit) {
    Text(label, modifier = Modifier.clickable(onClick = onClick), color = MaterialTheme.colorScheme.onSurfaceVariant)
}

@Composable
private fun CommentRow(c: Comment, isReplying: Boolean, onReply: () -> Unit) {
    Row(Modifier.fillMaxWidth().padding(vertical = 8.dp)) {
        if (c.parentId != null) Spacer(Modifier.width(36.dp)) // 一层回复缩进
        Column(Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                AsyncImage(
                    model = c.avatarUrl,
                    contentDescription = null,
                    modifier = Modifier.size(26.dp).background(MaterialTheme.colorScheme.surfaceVariant, CircleShape),
                )
                Spacer(Modifier.width(8.dp))
                Text(c.authorName ?: "匿名", fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                Spacer(Modifier.width(8.dp))
                Text(relativeTime(c.createdAt), fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Spacer(Modifier.height(4.dp))
            Text(c.content, fontSize = 14.sp)
            Spacer(Modifier.height(4.dp))
            Text(
                if (isReplying) "取消回复" else "回复",
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier.clickable(onClick = onReply),
            )
        }
    }
}

// ═══════════════ 用户主页（横幅/头像/统计/关注/内容 tab） ═══════════════

@Composable
fun ProfileScreen(userId: String, onBack: () -> Unit, onOpenPost: (String) -> Unit) {
    BackHandler(onBack = onBack)
    var profile by remember { mutableStateOf<UserProfile?>(null) }
    var posts by remember { mutableStateOf<List<Post>?>(null) }
    var tab by remember { mutableStateOf("posts") }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    suspend fun reloadPosts(t: String) {
        posts = runCatching { ApiClient.userPosts(userId, t) }.getOrNull() ?: emptyList()
    }

    LaunchedEffect(userId) {
        profile = runCatching { ApiClient.userProfile(userId) }.getOrNull()
        if (profile == null) error = "用户不存在或已注销"
        reloadPosts("posts")
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(profile?.displayName ?: "主页") },
                navigationIcon = {
                    IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, null) }
                },
            )
        },
    ) { padding ->
        LazyColumn(Modifier.fillMaxSize().padding(padding)) {
            profile?.let { p ->
                item {
                    // 横幅
                    Box(
                        Modifier
                            .fillMaxWidth()
                            .height(150.dp)
                            .background(
                                Brush.linearGradient(
                                    listOf(Color(0xFF4648D4), Color(0xFF6063EE), Color(0xFF8127CF))
                                )
                            )
                    ) {
                        if (!p.bannerUrl.isNullOrEmpty()) {
                            AsyncImage(model = p.bannerUrl, contentDescription = null, modifier = Modifier.fillMaxSize())
                        }
                    }
                    Column(Modifier.padding(horizontal = 16.dp)) {
                        AsyncImage(
                            model = p.avatarUrl,
                            contentDescription = null,
                            modifier = Modifier
                                .size(76.dp)
                                .offset(y = (-30).dp)
                                .background(MaterialTheme.colorScheme.surface, CircleShape)
                                .padding(3.dp),
                        )
                        Text(p.displayName, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                        Row {
                            p.title?.let { Text(it, fontSize = 12.sp, color = MaterialTheme.colorScheme.primary) }
                            Spacer(Modifier.width(8.dp))
                            p.citizenId?.let { Text(it, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                        }
                        p.bio?.let {
                            Spacer(Modifier.height(6.dp))
                            Text(it, fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        Spacer(Modifier.height(10.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(20.dp)) {
                            StatCell("${p.followerCount}", "粉丝")
                            StatCell("${p.followingCount}", "关注")
                            StatCell("${p.stats?.likeReceivedCount ?: 0}", "获赞")
                        }
                        Spacer(Modifier.height(10.dp))
                        if (!p.isSelf) {
                            Button(
                                onClick = {
                                    scope.launch {
                                        runCatching { ApiClient.followUser(p.id, !p.followedByMe) }
                                            .onSuccess {
                                                profile = p.copy(followedByMe = !p.followedByMe)
                                            }
                                    }
                                },
                                modifier = Modifier.fillMaxWidth(),
                                colors = if (p.followedByMe) {
                                    ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.surfaceVariant, contentColor = MaterialTheme.colorScheme.onSurface)
                                } else {
                                    ButtonDefaults.buttonColors()
                                },
                            ) {
                                Text(if (p.followedByMe) "已关注" else "关注")
                            }
                        }
                        Spacer(Modifier.height(12.dp))
                    }
                    // 内容 tab
                    Row(Modifier.fillMaxWidth()) {
                        val tabs = mutableListOf("posts" to "帖子", "reposts" to "转发")
                        if (p.isSelf) {
                            tabs.add("likes" to "点赞")
                            tabs.add("favorites" to "收藏")
                        }
                        tabs.forEach { (key, label) ->
                            Tab(
                                selected = tab == key,
                                onClick = {
                                    tab = key
                                    scope.launch { reloadPosts(key) }
                                },
                                text = { Text(label) },
                            )
                        }
                    }
                }
            }
            error?.let { item { Text(it, Modifier.padding(16.dp), color = MaterialTheme.colorScheme.error) } }
            if (posts == null) {
                item { Box(Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator() } }
            } else {
                items(posts.orEmpty()) { p ->
                    Card(
                        Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp)
                            .clickable { onOpenPost(p.id) }
                    ) {
                        Column(Modifier.padding(12.dp)) {
                            Text(p.content, fontSize = 14.sp, maxLines = 4, overflow = TextOverflow.Ellipsis)
                            Spacer(Modifier.height(6.dp))
                            Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                                Text("❤ ${p.likeCount ?: 0}", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                Text("💬 ${p.commentCount ?: 0}", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                Text(relativeTime(p.createdAt), fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun StatCell(value: String, label: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(value, fontWeight = FontWeight.Bold)
        Text(label, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

// ═══════════════ 聊天界面（气泡 + 发送） ═══════════════

@Composable
fun ChatScreen(convId: String, title: String, onBack: () -> Unit) {
    BackHandler(onBack = onBack)
    var messages by remember { mutableStateOf<List<ChatMessage>?>(null) }
    var draft by remember { mutableStateOf("") }
    var sending by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val listState = rememberLazyListState()
    val myId = Session.user?.id

    suspend fun reload() {
        val list = runCatching { ApiClient.chatMessages(convId) }.getOrNull() ?: emptyList()
        messages = list
    }

    LaunchedEffect(convId) { reload() }
    LaunchedEffect(messages?.size) {
        val n = messages?.size ?: 0
        if (n > 0) listState.animateScrollToItem(n - 1)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(title, maxLines = 1, overflow = TextOverflow.Ellipsis) },
                navigationIcon = {
                    IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, null) }
                },
                actions = {
                    IconButton(onClick = { scope.launch { reload() } }) {
                        Icon(Icons.Filled.Refresh, null)
                    }
                },
            )
        },
        bottomBar = {
            Surface(shadowElevation = 8.dp) {
                Row(Modifier.fillMaxWidth().padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                    OutlinedTextField(
                        value = draft,
                        onValueChange = { draft = it },
                        placeholder = { Text("发消息…", fontSize = 14.sp) },
                        modifier = Modifier.weight(1f),
                        maxLines = 4,
                    )
                    Spacer(Modifier.width(8.dp))
                    IconButton(
                        onClick = {
                            if (draft.isBlank() || sending) return@IconButton
                            sending = true
                            scope.launch {
                                runCatching { ApiClient.sendMessage(convId, draft.trim()) }
                                    .onSuccess { draft = ""; reload() }
                                sending = false
                            }
                        },
                        enabled = draft.isNotBlank() && !sending,
                    ) {
                        if (sending) CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
                        else Icon(Icons.AutoMirrored.Filled.Send, null, tint = MaterialTheme.colorScheme.primary)
                    }
                }
            }
        },
    ) { padding ->
        val list = messages
        when {
            list == null -> Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
            list.isEmpty() -> Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                Text("还没有消息，打个招呼吧", color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            else -> LazyColumn(
                Modifier.fillMaxSize().padding(padding),
                state = listState,
                contentPadding = PaddingValues(16.dp),
            ) {
                items(list) { m ->
                    val mine = m.senderId == myId
                    Row(
                        Modifier.fillMaxWidth().padding(vertical = 4.dp),
                        horizontalArrangement = if (mine) Arrangement.End else Arrangement.Start,
                    ) {
                        Column(horizontalAlignment = if (mine) Alignment.End else Alignment.Start) {
                            Text(
                                m.senderName ?: "",
                                fontSize = 11.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                            )
                            Text(
                                m.content,
                                modifier = Modifier
                                    .background(
                                        if (mine) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceVariant,
                                        RoundedCornerShape(16.dp, 16.dp, if (mine) 4.dp else 16.dp, if (mine) 16.dp else 4.dp),
                                    )
                                    .padding(horizontal = 14.dp, vertical = 9.dp),
                                color = if (mine) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurface,
                                fontSize = 15.sp,
                            )
                        }
                    }
                }
            }
        }
    }
}

// ═══════════════ 工具 ═══════════════

/// ISO 时间 → 「刚刚 / n 分钟前 / n 小时前 / 日期」（minSdk 24 兼容，不用 java.time）
fun relativeTime(iso: String?): String {
    if (iso == null) return ""
    return runCatching {
        val clean = iso.take(19).replace('T', ' ')
        val fmt = java.text.SimpleDateFormat("yyyy-MM-dd HH:mm:ss", java.util.Locale.US)
        fmt.timeZone = java.util.TimeZone.getTimeZone("UTC")
        val date = fmt.parse(clean) ?: return@runCatching iso.take(10)
        val seconds = (System.currentTimeMillis() - date.time) / 1000
        when {
            seconds < 60 -> "刚刚"
            seconds < 3600 -> "${seconds / 60} 分钟前"
            seconds < 86400 -> "${seconds / 3600} 小时前"
            else -> iso.take(10)
        }
    }.getOrDefault(iso.take(10))
}
