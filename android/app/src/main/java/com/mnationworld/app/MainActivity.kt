package com.mnationworld.app

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.launch

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
    // 系统更新（P9）：启动时检查 /api/app/latest，落后于最新版本则弹窗提示
    var updateInfo by remember { mutableStateOf<AndroidLatest?>(null) }
    val context = LocalContext.current

    LaunchedEffect(Unit) {
        val latest = runCatching { ApiClient.latestApp() }.getOrNull()
        val android = latest?.android
        if (android != null && android.versionCode > BuildConfig.VERSION_CODE) {
            updateInfo = android
        }
    }

    updateInfo?.let { info ->
        AlertDialog(
            onDismissRequest = { updateInfo = null },
            title = { Text("发现新版本 ${info.versionName}") },
            text = { Text(info.note.ifBlank { "新版已发布，包含修复与新功能，建议更新。" }) },
            confirmButton = {
                TextButton(onClick = {
                    updateInfo = null
                    val uri = Uri.parse("https://mnationworld.com/pages/download.html")
                    context.startActivity(Intent(Intent.ACTION_VIEW, uri))
                }) { Text("去更新") }
            },
            dismissButton = {
                TextButton(onClick = { updateInfo = null }) { Text("以后再说") }
            },
        )
    }

    if (Session.isLoggedIn) {
        MainScreen()
    } else {
        LoginScreen()
    }
}

// ── 登录（邮箱验证码两步，对齐网页端 /api/auth 契约） ──

class LoginViewModel : ViewModel() {
    var email by mutableStateOf("")
    var code by mutableStateOf("")
    var password by mutableStateOf("")
    var step by mutableStateOf(0) // 0=邮箱, 1=验证码
    var isNewAccount by mutableStateOf(false)
    var busy by mutableStateOf(false)
    var error by mutableStateOf<String?>(null)

    fun sendCode() {
        if (busy) return
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
                val resp = ApiClient.verify(
                    email.trim(), code.trim(),
                    if (password.isEmpty()) null else password
                )
                if (resp.status == "new" && resp.user.hasPassword != true) {
                    isNewAccount = true
                    error = "新账号请先设置密码（至少 8 位）"
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
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text("M.NationWorld", style = MaterialTheme.typography.headlineLarge)
        Text("创建属于你的架空世界", style = MaterialTheme.typography.bodyMedium)
        Spacer(Modifier.height(32.dp))

        if (vm.step == 0) {
            OutlinedTextField(
                value = vm.email,
                onValueChange = { vm.email = it },
                label = { Text("邮箱") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
            )
            Spacer(Modifier.height(12.dp))
            Button(
                onClick = { vm.sendCode() },
                enabled = vm.email.contains("@") && !vm.busy,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(if (vm.busy) "发送中…" else "发送验证码")
            }
        } else {
            Text("验证码已发送到 ${vm.email}", style = MaterialTheme.typography.bodyMedium)
            Spacer(Modifier.height(12.dp))
            OutlinedTextField(
                value = vm.code,
                onValueChange = { vm.code = it.filter(Char::isDigit).take(6) },
                label = { Text("6 位验证码") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            )
            if (vm.isNewAccount) {
                Spacer(Modifier.height(12.dp))
                OutlinedTextField(
                    value = vm.password,
                    onValueChange = { vm.password = it },
                    label = { Text("设置密码（至少 8 位）") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    visualTransformation = PasswordVisualTransformation(),
                )
            }
            Spacer(Modifier.height(12.dp))
            Button(
                onClick = { vm.verify() },
                enabled = vm.code.length == 6 && !vm.busy &&
                    (!vm.isNewAccount || vm.password.length >= 8),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(if (vm.busy) "登录中…" else if (vm.isNewAccount) "注册并登录" else "登录")
            }
            TextButton(onClick = { vm.step = 0; vm.isNewAccount = false; vm.error = null }) {
                Text("换邮箱")
            }
        }

        vm.error?.let {
            Spacer(Modifier.height(12.dp))
            Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
        }
    }
}
