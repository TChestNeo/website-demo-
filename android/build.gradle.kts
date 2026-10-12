// 顶层构建脚本：插件版本声明（模块各自 apply）
// AGP 8.9.1 支持 compileSdk 36（Android 16，本机 SDK android-36.1）
plugins {
    id("com.android.application") version "8.9.1" apply false
    id("org.jetbrains.kotlin.android") version "2.1.0" apply false
    id("org.jetbrains.kotlin.plugin.compose") version "2.1.0" apply false
    id("org.jetbrains.kotlin.plugin.serialization") version "2.1.0" apply false
}
