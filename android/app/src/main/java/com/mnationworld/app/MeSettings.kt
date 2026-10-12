package com.mnationworld.app

import android.content.Context
import android.content.SharedPreferences
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import kotlinx.coroutines.launch

private const val PREFS = "mn_prefs"

@Composable
private fun prefs() = LocalContext.current.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

@Composable
fun rememberPrefBool(key: String, default: Boolean): MutableState<Boolean> {
    val p = prefs()
    val state = remember { mutableStateOf(p.getBoolean(key, default)) }
    return remember(key) { PrefBackedBool(state, p, key) }
}

/// 开关状态：内存态 + 即时写回 SharedPreferences（与网页 localStorage 语义一致）
private class PrefBackedBool(
    private val state: MutableState<Boolean>,
    private val prefs: SharedPreferences,
    private val key: String,
) : MutableState<Boolean> by state {
    override var value: Boolean
        get() = state.value
        set(v) {
            state.value = v
            prefs.edit().putBoolean(key, v).apply()
        }
}

// ── 我的（完整设置中心：与网页/iOS 一致 5 分类） ──

@Composable
fun MeTab() {
    var screen by remember { mutableStateOf("root") }
    BackHandler(enabled = screen != "root") { screen = "root" }
    when (screen) {
        "root" -> MeRootScreen(onOpen = { screen = it })
        "activity" -> ScreenShell("活动") { ActivitySettingsScreen() }
        "account" -> ScreenShell("账户") { AccountSettingsScreen(onOpen = { screen = it }) }
        "profile" -> ScreenShell("个人账户") { ProfileEditScreen() }
        "password" -> ScreenShell("隐私与安全") { ChangePasswordScreen() }
        "visibility" -> ScreenShell("可见性") { VisibilitySettingsScreen() }
        "interaction" -> ScreenShell("互动") { InteractionSettingsScreen(onOpen = { screen = it }) }
        "liked" -> ScreenShell("赞过的视频") { LikedPostsScreen() }
        "preference" -> ScreenShell("偏好设置") { PreferenceSettingsScreen() }
        "delete" -> ScreenShell("删除账户") { DeleteAccountScreen() }
    }
}

@Composable
private fun ScreenShell(title: String, content: @Composable () -> Unit) {
    Column(Modifier.fillMaxSize().padding(16.dp)) {
        Text(title, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(8.dp))
        content()
    }
}

@Composable
private fun MeRootScreen(onOpen: (String) -> Unit) {
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp)) {
        item {
            Text("我的", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(12.dp))
        }
        // 用户卡
        item {
            Card(Modifier.fillMaxWidth()) {
                Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                    if (!Session.user?.avatarUrl.isNullOrEmpty()) {
                        AsyncImage(model = Session.user?.avatarUrl, contentDescription = null,
                            modifier = Modifier.size(52.dp).background(MaterialTheme.colorScheme.surfaceVariant, CircleShape))
                    } else {
                        Box(Modifier.size(52.dp).background(MaterialTheme.colorScheme.primary, CircleShape), contentAlignment = Alignment.Center) {
                            Text(Session.user?.displayName?.take(1) ?: "M", color = MaterialTheme.colorScheme.onPrimary, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                    Spacer(Modifier.width(12.dp))
                    Column {
                        Text(Session.user?.displayName ?: "未登录", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                        Text(Session.user?.citizenId ?: "", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Session.user?.tier?.let {
                            Text(it, fontSize = 11.sp, color = MaterialTheme.colorScheme.primary)
                        }
                    }
                }
            }
            Spacer(Modifier.height(12.dp))
        }
        item {
            Card(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(vertical = 4.dp)) {
                    MenuRow("关注", "heart") {}
                    HorizontalDivider()
                    MenuRow("插件", "puzzle") {}
                }
            }
            Spacer(Modifier.height(12.dp))
        }
        item {
            Card(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(vertical = 4.dp)) {
                    SectionCaption("设置与隐私")
                    MenuRow("活动", "chart") { onOpen("activity") }
                    MenuRow("账户", "person") { onOpen("account") }
                    MenuRow("可见性", "eye") { onOpen("visibility") }
                    MenuRow("互动", "tap") { onOpen("interaction") }
                    MenuRow("偏好设置", "slider") { onOpen("preference") }
                }
            }
            Spacer(Modifier.height(12.dp))
        }
        item {
            Card(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(vertical = 4.dp)) {
                    MenuRow("帮助与支持", "help") {}
                    MenuRow("切换账户", "swap", danger = true) { Session.logout() }
                    MenuRow("登出", "logout", danger = true) { Session.logout() }
                    MenuRow("删除账户", "delete", danger = true) { onOpen("delete") }
                }
            }
        }
    }
}

@Composable
private fun SectionCaption(text: String) {
    Text(text, Modifier.padding(horizontal = 16.dp, vertical = 6.dp), fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.onSurfaceVariant)
}

@Composable
private fun MenuRow(label: String, emoji: String, danger: Boolean = false, onClick: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().clickable(onClick = onClick).padding(horizontal = 16.dp, vertical = 13.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(emoji, fontSize = 18.sp)
        Spacer(Modifier.width(12.dp))
        Text(label, Modifier.weight(1f), color = if (danger) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.Medium)
    }
}

// ── 活动 ──

@Composable
private fun ActivitySettingsScreen() {
    val notify = rememberPrefBool("pref.notify", true)
    val topics = listOf("政治", "经济", "文化", "科技", "军事", "体育", "娱乐", "生活")
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
        Card {
            Column(Modifier.padding(16.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("通知", Modifier.weight(1f))
                    Switch(checked = notify.value, onCheckedChange = { notify.value = it })
                }
            }
        }
        Spacer(Modifier.height(12.dp))
        Text("内容偏好", fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(Modifier.height(6.dp))
        Card {
            Column(Modifier.padding(horizontal = 16.dp)) {
                topics.forEach { topic ->
                    val state = rememberPrefBool("pref.topic.$topic", false)
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(topic, Modifier.weight(1f).padding(vertical = 13.dp))
                        Switch(checked = state.value, onCheckedChange = { state.value = it })
                    }
                    HorizontalDivider()
                }
            }
        }
    }
}

// ── 账户 ──

@Composable
private fun AccountSettingsScreen(onOpen: (String) -> Unit) {
    Card {
        Column(Modifier.padding(vertical = 4.dp)) {
            MenuRow("个人账户", "👤") { onOpen("profile") }
            HorizontalDivider()
            MenuRow("隐私与安全", "🛡️") { onOpen("password") }
        }
    }
}

@Composable
private fun ProfileEditScreen() {
    var displayName by remember { mutableStateOf(Session.user?.displayName ?: "") }
    var bio by remember { mutableStateOf("") }
    var gender by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var tip by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    Column(Modifier.fillMaxSize()) {
        OutlinedTextField(displayName, { displayName = it }, label = { Text("昵称") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
        Spacer(Modifier.height(12.dp))
        OutlinedTextField(bio, { bio = it }, label = { Text("简介") }, modifier = Modifier.fillMaxWidth(), minLines = 2)
        Spacer(Modifier.height(12.dp))
        OutlinedTextField(gender, { gender = it }, label = { Text("性别") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
        Spacer(Modifier.height(16.dp))
        Button(
            onClick = {
                busy = true
                scope.launch {
                    runCatching { ApiClient.updateProfile(displayName.ifBlank { null }, bio.ifBlank { null }, gender.ifBlank { null }) }
                        .onSuccess { Session.applyLogin(it); tip = "已保存" }
                        .onFailure { tip = it.message }
                    busy = false
                }
            },
            enabled = !busy,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text(if (busy) "保存中…" else "保存")
        }
        tip?.let { Spacer(Modifier.height(8.dp)); Text(it, color = MaterialTheme.colorScheme.primary, fontSize = 13.sp) }
    }
}

@Composable
private fun ChangePasswordScreen() {
    var password by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var tip by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    Column(Modifier.fillMaxSize()) {
        OutlinedTextField(password, { password = it }, label = { Text("新密码（至少 8 位）") },
            modifier = Modifier.fillMaxWidth(), singleLine = true,
            visualTransformation = PasswordVisualTransformation())
        Spacer(Modifier.height(16.dp))
        Button(
            onClick = {
                busy = true
                scope.launch {
                    runCatching { ApiClient.changePassword(password) }
                        .onSuccess { tip = "密码已更新"; password = "" }
                        .onFailure { tip = it.message }
                    busy = false
                }
            },
            enabled = !busy && password.length >= 8,
            modifier = Modifier.fillMaxWidth(),
        ) { Text(if (busy) "提交中…" else "修改密码") }
        tip?.let { Spacer(Modifier.height(8.dp)); Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 13.sp) }
    }
}

// ── 可见性 ──

@Composable
private fun VisibilitySettingsScreen() {
    val privateAccount = rememberPrefBool("pref.privateAccount", false)
    var blocked by remember { mutableStateOf<List<BlockedUser>?>(null) }
    val scope = rememberCoroutineScope()

    suspend fun reload() {
        blocked = runCatching { ApiClient.blockedUsers() }.getOrNull() ?: emptyList()
    }

    LaunchedEffect(Unit) { reload() }

    Column(Modifier.fillMaxSize()) {
        Card {
            Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                Text("私密账号", Modifier.weight(1f))
                Switch(checked = privateAccount.value, onCheckedChange = { privateAccount.value = it })
            }
        }
        Spacer(Modifier.height(12.dp))
        Text("屏蔽账号", fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(Modifier.height(6.dp))
        Card {
            Column(Modifier.padding(16.dp)) {
                val list = blocked
                when {
                    list == null -> Text("加载中…", fontSize = 13.sp)
                    list.isEmpty() -> Text("暂无屏蔽账号", fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    else -> list.forEach { user ->
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(user.displayName ?: user.id, Modifier.weight(1f), fontSize = 14.sp)
                            TextButton(onClick = {
                                scope.launch {
                                    runCatching { ApiClient.unblock(user.id) }
                                    reload()
                                }
                            }) { Text("解除屏蔽", color = MaterialTheme.colorScheme.error, fontSize = 12.sp) }
                        }
                    }
                }
            }
        }
    }
}

// ── 互动 ──

@Composable
private fun InteractionSettingsScreen(onOpen: (String) -> Unit) {
    val allowComments = rememberPrefBool("pref.allowComments", true)
    val allowMentions = rememberPrefBool("pref.allowMentions", true)
    val allowDM = rememberPrefBool("pref.allowDM", true)
    val allowDerivative = rememberPrefBool("pref.allowDerivative", true)
    Column(Modifier.fillMaxSize()) {
        Card {
            Column(Modifier.padding(horizontal = 16.dp)) {
                ToggleRow("评论", allowComments)
                HorizontalDivider()
                ToggleRow("提及", allowMentions)
                HorizontalDivider()
                ToggleRow("私信", allowDM)
                HorizontalDivider()
                ToggleRow("二次创作内容", allowDerivative)
            }
        }
        Spacer(Modifier.height(12.dp))
        Card {
            Column(Modifier.padding(vertical = 4.dp)) {
                MenuRow("关注列表", "❤️") {}
                HorizontalDivider()
                MenuRow("赞过的视频", "👍") { onOpen("liked") }
            }
        }
    }
}

@Composable
private fun ToggleRow(label: String, state: MutableState<Boolean>) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text(label, Modifier.weight(1f).padding(vertical = 13.dp))
        Switch(checked = state.value, onCheckedChange = { state.value = it })
    }
}

@Composable
private fun LikedPostsScreen() {
    var posts by remember { mutableStateOf<List<Post>?>(null) }
    LaunchedEffect(Unit) {
        val uid = Session.user?.id
        posts = if (uid != null) runCatching { ApiClient.likedPosts(uid) }.getOrNull() ?: emptyList() else emptyList()
    }
    val list = posts
    when {
        list == null -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
        list.isEmpty() -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text("暂无赞过的内容", color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        else -> LazyColumn(Modifier.fillMaxSize()) {
            items(list) { p -> PostRow(p) }
        }
    }
}

// ── 偏好设置 ──

@Composable
private fun PreferenceSettingsScreen() {
    val p = prefs()
    val context = LocalContext.current
    var language by remember { mutableStateOf(p.getString("pref.language", "zh") ?: "zh") }
    var theme by remember { mutableStateOf(p.getString("pref.theme", "system") ?: "system") }
    var audience by remember { mutableStateOf(p.getString("pref.audience", "public") ?: "public") }
    val reduceMotion = rememberPrefBool("pref.reduceMotion", false)

    @Composable
    fun pickerRow(title: String, options: List<Pair<String, String>>, current: String, onPick: (String) -> Unit) {
        Card {
            Column(Modifier.padding(horizontal = 16.dp)) {
                Text(title, Modifier.padding(top = 13.dp), fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.onSurfaceVariant)
                options.forEach { (value, label) ->
                    Row(
                        Modifier.fillMaxWidth().clickable { onPick(value) }.padding(vertical = 12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(label, Modifier.weight(1f))
                        RadioButton(selected = current == value, onClick = { onPick(value) })
                    }
                }
            }
        }
    }

    Column(Modifier.fillMaxSize()) {
        pickerRow("语言", listOf("zh" to "中文", "en" to "English"), language) {
            language = it; p.edit().putString("pref.language", it).apply()
        }
        Spacer(Modifier.height(12.dp))
        pickerRow("主题", listOf("system" to "跟随系统", "light" to "浅色", "dark" to "深色"), theme) {
            theme = it
            p.edit().putString("pref.theme", it).apply()
            // 主题即时生效：重建 Activity 重读 pref
            (context as? android.app.Activity)?.recreate()
        }
        Spacer(Modifier.height(12.dp))
        pickerRow(
            "观众控制",
            listOf("public" to "公开（所有人可见）", "followers" to "仅关注者可见", "private" to "仅自己可见"),
            audience,
        ) { audience = it; p.edit().putString("pref.audience", it).apply() }
        Spacer(Modifier.height(12.dp))
        Card {
            Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                Text("减少动画", Modifier.weight(1f))
                Switch(checked = reduceMotion.value, onCheckedChange = { reduceMotion.value = it })
            }
        }
    }
}

// ── 删除账户（30 天后悔期） ──

@Composable
private fun DeleteAccountScreen() {
    var code by remember { mutableStateOf("") }
    var codeSent by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    Column(Modifier.fillMaxSize()) {
        Card {
            Column(Modifier.padding(16.dp)) {
                Text("删除账户后 30 天内重新登录可恢复；30 天后所有数据将被彻底删除且不可恢复。", fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
        Spacer(Modifier.height(12.dp))
        if (!codeSent) {
            Button(
                onClick = {
                    busy = true
                    scope.launch {
                        runCatching { ApiClient.sendEmailCode(Session.user?.email ?: "", "delete_confirm") }
                            .onSuccess { codeSent = true }
                            .onFailure { error = it.message }
                        busy = false
                    }
                },
                enabled = !busy,
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error),
            ) { Text("发送确认验证码到邮箱") }
        } else {
            OutlinedTextField(
                code, { code = it.filter(Char::isDigit).take(6) },
                label = { Text("6 位验证码") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            )
            Spacer(Modifier.height(12.dp))
            Button(
                onClick = {
                    busy = true
                    scope.launch {
                        runCatching { ApiClient.deleteAccount(code) }
                            .onSuccess { Session.logout() }
                            .onFailure { error = it.message }
                        busy = false
                    }
                },
                enabled = !busy && code.length == 6,
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error),
            ) { Text("确认删除账户") }
        }
        error?.let { Spacer(Modifier.height(8.dp)); Text(it, color = MaterialTheme.colorScheme.error, fontSize = 13.sp) }
    }
}
