package com.mnationworld.app

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.core.content.FileProvider
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import java.io.File
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request

// ── 入口 ──

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme(colorScheme = lightColorScheme(
                primary = androidx.compose.ui.graphics.Color(0xFF4648D4),
            )) {
                AppRoot()
            }
        }
    }
}

@Composable
fun AppRoot() {
    // 系统更新（P9）：启动时检查 /api/app/latest；落后则弹窗 → 自动下载 APK → 拉起系统安装器
    var updateInfo by remember { mutableStateOf<AndroidLatest?>(null) }
    var updating by remember { mutableStateOf(false) }
    var updateMsg by remember { mutableStateOf<String?>(null) }
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    LaunchedEffect(Unit) {
        val latest = runCatching { ApiClient.latestApp() }.getOrNull()
        val android = latest?.android
        if (android != null && android.versionCode > BuildConfig.VERSION_CODE) {
            updateInfo = android
        }
    }

    updateInfo?.let { info ->
        AlertDialog(
            onDismissRequest = { if (!updating) updateInfo = null },
            title = { Text("发现新版本 ${info.versionName}") },
            text = {
                Column {
                    Text(updateMsg ?: info.note.ifBlank { "新版已发布，包含修复与新功能，建议更新。" })
                    if (updating) {
                        Spacer(Modifier.height(10.dp))
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp)
                            Spacer(Modifier.width(8.dp))
                            Text("正在下载…", fontSize = 13.sp)
                        }
                    }
                }
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        if (!updating) {
                            updating = true
                            scope.launch {
                                val result = downloadAndInstallApk(context, info)
                                when (result) {
                                    is DownloadResult.Installing -> {
                                        updateInfo = null
                                        updating = false
                                        updateMsg = null
                                    }
                                    is DownloadResult.Failed -> {
                                        updateMsg = result.message
                                        updating = false
                                    }
                                    is DownloadResult.NeedInstallPermission -> {
                                        updateMsg = "请先开启「安装未知应用」权限，然后重新更新"
                                        updating = false
                                    }
                                }
                            }
                        }
                    },
                    enabled = !updating,
                ) {
                    Text(if (updating) "下载中…" else "立即更新")
                }
            },
            dismissButton = {
                TextButton(onClick = { updateInfo = null; updating = false; updateMsg = null }) {
                    Text("以后再说")
                }
            },
        )
    }

    if (Session.isLoggedIn) {
        MainScreen()
    } else {
        LoginScreen()
    }
}

// ── 自动更新：下载 APK → 系统安装器 ──

sealed interface DownloadResult {
    data object Installing : DownloadResult
    data object NeedInstallPermission : DownloadResult
    data class Failed(val message: String) : DownloadResult
}

suspend fun downloadAndInstallApk(context: Context, info: AndroidLatest): DownloadResult =
    withContext(Dispatchers.IO) {
        try {
            // Android 8+：未授权「安装未知应用」先引导去设置
            if (Build.VERSION.SDK_INT >= 26 && !context.packageManager.canRequestPackageInstalls()) {
                withContext(Dispatchers.Main) {
                    val intent = Intent(
                        Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                        Uri.parse("package:com.mnationworld.app")
                    )
                    context.startActivity(intent)
                }
                return@withContext DownloadResult.NeedInstallPermission
            }
            val file = File(context.cacheDir, "update.apk")
            val request = Request.Builder().url(BASE_URL + info.url).build()
            OkHttpClient().newCall(request).execute().use { resp ->
                if (!resp.isSuccessful) return@withContext DownloadResult.Failed("下载失败（HTTP ${resp.code}）")
                val body = resp.body ?: return@withContext DownloadResult.Failed("下载失败：空响应")
                file.outputStream().use { out ->
                    body.byteStream().use { input ->
                        input.copyTo(out)
                    }
                }
            }
            withContext(Dispatchers.Main) {
                val uri = FileProvider.getUriForFile(context, "com.mnationworld.app.fileprovider", file)
                val intent = Intent(Intent.ACTION_VIEW).apply {
                    setDataAndType(uri, "application/vnd.android.package-archive")
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                context.startActivity(intent)
            }
            DownloadResult.Installing
        } catch (e: Exception) {
            DownloadResult.Failed("下载失败：${e.message}")
        }
    }

// ── 登录（密码+验证码双因素，对齐网页端 /api/auth 契约；UI 参考 SlatiWorld 渐变品牌卡设计） ──

class LoginViewModel : ViewModel() {
    var email by mutableStateOf("")
    var password by mutableStateOf("")
    var code by mutableStateOf("")
    var step by mutableStateOf(0) // 0=填写邮箱密码, 1=验证码
    var tab by mutableStateOf("login") // login | signup
    var isNewAccount by mutableStateOf(false)
    var termsAgreed by mutableStateOf(false)
    var passwordVisible by mutableStateOf(false)
    var busy by mutableStateOf(false)
    var error by mutableStateOf<String?>(null)

    fun sendCode() {
        if (busy) return
        if (password.length !in 8..72) {
            error = "密码需 8-72 个字符"
            return
        }
        busy = true
        error = null
        viewModelScope.launch {
            try {
                ApiClient.sendEmailCode(email.trim())
                step = 1
            } catch (e: Exception) {
                error = e.message
            }
            busy = false
        }
    }

    fun verify() {
        if (busy) return
        busy = true
        error = null
        viewModelScope.launch {
            try {
                val resp = ApiClient.verify(email.trim(), code.trim(), password)
                if (resp.passwordSetupRequired == true) {
                    // 旧账号（此前无密码）→ 引导设密后继续
                    isNewAccount = true
                    error = "你的账号还没设置密码，请设置后重新登录（至少 8 位）"
                } else {
                    Session.applyLogin(resp.user)
                }
            } catch (e: Exception) {
                error = e.message
            }
            busy = false
        }
    }
}

@Composable
fun LoginScreen(vm: LoginViewModel = viewModel()) {
    Box(
        Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        Column(
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(14.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            BrandHeroCard(
                tab = vm.tab,
                step = vm.step,
                onTab = { vm.tab = it; vm.error = null; vm.step = 0 },
            )
            Spacer(Modifier.height(14.dp))
            FormCard(vm)
            Spacer(Modifier.height(16.dp))
        }
    }
}

// ── 顶部渐变品牌卡（参考设计：光斑 + Welcome to 徽章 + 药丸切换 + 三步进度 + 信任指标） ──

@Composable
private fun BrandHeroCard(tab: String, step: Int, onTab: (String) -> Unit) {
    val pulse by rememberInfiniteTransition(label = "pulse")
        .animateFloat(
            initialValue = 1f,
            targetValue = 0.35f,
            animationSpec = infiniteRepeatable(tween(800), RepeatMode.Reverse),
            label = "dot",
        )
    Box(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(28.dp))
            .background(
                Brush.linearGradient(
                    listOf(Color(0xFF4648D4), Color(0xFF6063EE), Color(0xFF8127CF))
                )
            )
    ) {
        // 液态玻璃光斑
        Box(
            Modifier
                .size(170.dp)
                .align(Alignment.TopEnd)
                .offset(x = 42.dp, y = (-42).dp)
                .blur(35.dp)
                .background(Color.White.copy(alpha = 0.14f), CircleShape)
        )
        Box(
            Modifier
                .size(140.dp)
                .align(Alignment.BottomStart)
                .offset(x = (-36).dp, y = 28.dp)
                .blur(35.dp)
                .background(Color(0xFF9C48EA).copy(alpha = 0.40f), CircleShape)
        )

        Column(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 22.dp, vertical = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Row(
                Modifier
                    .clip(RoundedCornerShape(50))
                    .background(Color.White.copy(alpha = 0.15f))
                    .padding(horizontal = 12.dp, vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(Modifier.size(6.dp).background(Color.White.copy(alpha = pulse), CircleShape))
                Spacer(Modifier.width(6.dp))
                Text(
                    "WELCOME TO",
                    color = Color.White.copy(alpha = 0.92f),
                    fontSize = 10.sp,
                    fontWeight = FontWeight.SemiBold,
                    letterSpacing = 1.4.sp,
                )
            }
            Spacer(Modifier.height(10.dp))
            Text("M.NationWorld", color = Color.White, fontSize = 27.sp, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(6.dp))
            Text(
                "创建属于你的架空世界——从一面国旗、一部宪法开始，建立你梦想中的国度。",
                color = Color.White.copy(alpha = 0.85f),
                fontSize = 13.sp,
                textAlign = TextAlign.Center,
                lineHeight = 20.sp,
            )
            Spacer(Modifier.height(18.dp))

            // 药丸切换
            Row(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(50))
                    .background(Color.Black.copy(alpha = 0.22f))
                    .padding(4.dp)
            ) {
                PillTab("Log in", tab == "login", Modifier.weight(1f)) { onTab("login") }
                PillTab("Sign up", tab == "signup", Modifier.weight(1f)) { onTab("signup") }
            }
            Spacer(Modifier.height(16.dp))

            // 三步进度
            Column(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(Color.White.copy(alpha = 0.10f))
                    .padding(horizontal = 16.dp, vertical = 13.dp)
            ) {
                StepRow(1, "Create account", active = step == 0)
                StepConnector()
                StepRow(2, "Identity Setup", active = step == 1)
                StepConnector()
                StepRow(3, "Complete", active = false)
            }
            Spacer(Modifier.height(15.dp))

            // 信任指标
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceAround) {
                TrustItem(Icons.Filled.CheckCircle, "虚构创作自由")
                TrustItem(Icons.Filled.Lock, "数字主权平台")
            }
        }
    }
}

@Composable
private fun PillTab(label: String, active: Boolean, modifier: Modifier = Modifier, onClick: () -> Unit) {
    Text(
        label,
        modifier = modifier
            .clip(RoundedCornerShape(50))
            .background(if (active) Color.White else Color.Transparent)
            .clickable(onClick = onClick)
            .padding(vertical = 7.dp),
        textAlign = TextAlign.Center,
        color = if (active) Color(0xFF4648D4) else Color.White.copy(alpha = 0.82f),
        fontSize = 14.sp,
        fontWeight = if (active) FontWeight.SemiBold else FontWeight.Medium,
    )
}

@Composable
private fun StepRow(n: Int, label: String, active: Boolean) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(
            Modifier
                .size(22.dp)
                .background(if (active) Color.White else Color.White.copy(alpha = 0.22f), CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                "$n",
                color = if (active) Color(0xFF4648D4) else Color.White.copy(alpha = 0.9f),
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
            )
        }
        Spacer(Modifier.width(10.dp))
        Text(
            label,
            color = if (active) Color.White else Color.White.copy(alpha = 0.55f),
            fontSize = 13.sp,
            fontWeight = FontWeight.Medium,
        )
    }
}

@Composable
private fun StepConnector() {
    Box(
        Modifier
            .padding(start = 10.dp)
            .width(2.dp)
            .height(8.dp)
            .background(Color.White.copy(alpha = 0.3f), RoundedCornerShape(2.dp))
    )
}

@Composable
private fun TrustItem(icon: ImageVector, label: String) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Icon(icon, null, tint = Color.White.copy(alpha = 0.9f), modifier = Modifier.size(15.dp))
        Spacer(Modifier.width(5.dp))
        Text(label, color = Color.White.copy(alpha = 0.88f), fontSize = 11.sp, fontWeight = FontWeight.Medium)
    }
}

// ── 表单卡（参考设计：图标输入框 + 渐变提交按钮；密码+验证码双因素） ──

@Composable
private fun FormCard(vm: LoginViewModel) {
    Surface(
        Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(28.dp),
        color = MaterialTheme.colorScheme.surface,
        shadowElevation = 6.dp,
    ) {
        Column(Modifier.padding(20.dp)) {
            Text(
                if (vm.tab == "signup") "Create your account" else "Welcome back, Sovereign",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
            )
            Spacer(Modifier.height(4.dp))
            Text(
                if (vm.tab == "signup") "创建属于你的架空国度 >w<" else "你的世界在等你",
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                fontSize = 13.sp,
            )
            Spacer(Modifier.height(16.dp))

            IconInput(
                value = vm.email,
                onValueChange = { vm.email = it },
                icon = Icons.Filled.Email,
                placeholder = "you@example.com",
                keyboardType = KeyboardType.Email,
            )
            Spacer(Modifier.height(12.dp))
            IconInput(
                value = vm.password,
                onValueChange = { vm.password = it },
                icon = Icons.Filled.Lock,
                placeholder = "密码（8-72 字符）",
                isPassword = true,
                visible = vm.passwordVisible,
                onToggleVisible = { vm.passwordVisible = !vm.passwordVisible },
            )
            if (vm.step >= 1) {
                Spacer(Modifier.height(12.dp))
                IconInput(
                    value = vm.code,
                    onValueChange = { vm.code = it.filter(Char::isDigit).take(6) },
                    icon = Icons.Filled.CheckCircle,
                    placeholder = "6 位验证码",
                    keyboardType = KeyboardType.Number,
                )
            }
            if (vm.tab == "signup" || vm.isNewAccount) {
                Spacer(Modifier.height(10.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(checked = vm.termsAgreed, onCheckedChange = { vm.termsAgreed = it })
                    Text(
                        "我同意服务条款与隐私政策",
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            vm.error?.let {
                Spacer(Modifier.height(8.dp))
                Text(it, color = MaterialTheme.colorScheme.error, fontSize = 12.sp)
            }
            Spacer(Modifier.height(14.dp))
            GradientButton(vm)
            if (vm.step >= 1) {
                TextButton(
                    onClick = { vm.step = 0; vm.error = null },
                    modifier = Modifier.align(Alignment.CenterHorizontally),
                ) {
                    Text("换邮箱", fontSize = 12.sp)
                }
            }
        }
    }
}

@Composable
private fun IconInput(
    value: String,
    onValueChange: (String) -> Unit,
    icon: ImageVector,
    placeholder: String,
    keyboardType: KeyboardType = KeyboardType.Text,
    isPassword: Boolean = false,
    visible: Boolean = false,
    onToggleVisible: (() -> Unit)? = null,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        leadingIcon = { Icon(icon, null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(20.dp)) },
        placeholder = { Text(placeholder, fontSize = 14.sp) },
        singleLine = true,
        shape = RoundedCornerShape(16.dp),
        modifier = Modifier.fillMaxWidth(),
        keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
        visualTransformation = if (isPassword && !visible) PasswordVisualTransformation() else VisualTransformation.None,
        trailingIcon = if (isPassword) {
            {
                Text(
                    if (visible) "隐藏" else "显示",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier
                        .clickable { onToggleVisible?.invoke() }
                        .padding(horizontal = 6.dp, vertical = 10.dp),
                )
            }
        } else null,
        colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor = Color.Transparent,
            unfocusedBorderColor = Color.Transparent,
            focusedContainerColor = MaterialTheme.colorScheme.surface,
            unfocusedContainerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.45f),
        ),
    )
}

@Composable
private fun GradientButton(vm: LoginViewModel) {
    val needTerms = vm.tab == "signup" && !vm.isNewAccount
    val enabled = when {
        vm.busy -> false
        vm.step == 0 -> vm.email.contains("@") && vm.password.length in 8..72 && (!needTerms || vm.termsAgreed)
        else -> vm.code.length == 6 && vm.password.length in 8..72 && (!needTerms || vm.termsAgreed)
    }
    Button(
        onClick = { if (vm.step == 0) vm.sendCode() else vm.verify() },
        enabled = enabled,
        modifier = Modifier.fillMaxWidth().height(52.dp),
        shape = RoundedCornerShape(50),
        colors = ButtonDefaults.buttonColors(
            containerColor = Color.Transparent,
            contentColor = Color.White,
            disabledContainerColor = Color.Transparent,
            disabledContentColor = Color.White,
        ),
        elevation = ButtonDefaults.buttonElevation(defaultElevation = 6.dp, pressedElevation = 2.dp),
        contentPadding = PaddingValues(0.dp),
    ) {
        Box(
            Modifier
                .fillMaxSize()
                .clip(RoundedCornerShape(50))
                .background(
                    if (enabled) {
                        Brush.horizontalGradient(listOf(Color(0xFF4648D4), Color(0xFF6063EE)))
                    } else {
                        SolidColor(Color(0xFFC0C1D6))
                    }
                ),
            contentAlignment = Alignment.Center,
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    when {
                        vm.busy -> "请稍候…"
                        vm.step == 0 -> "Next Step"
                        vm.tab == "signup" || vm.isNewAccount -> "注册并登录"
                        else -> "登录"
                    },
                    fontWeight = FontWeight.SemiBold,
                )
                Spacer(Modifier.width(8.dp))
                Icon(Icons.AutoMirrored.Filled.ArrowForward, null)
            }
        }
    }
}
