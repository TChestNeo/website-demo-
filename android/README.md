# M.NationWorld — Android 版（Kotlin + Jetpack Compose）

谷歌官方原生路线：Kotlin + Jetpack Compose + Material 3（底部导航 / 组件全用官方）。

**好消息：安卓不需要 Mac**——Windows 装 Android Studio 就能开发；APK 直接装手机（打开「允许安装未知来源应用」即可），不用签名、不用 7 天重签。

## 在手机上看

1. GitHub 仓库 → `Actions` → 最新绿色 ✓ 的 `Android Build` → 底部 Artifacts 下载 `MNationWorld-debug-apk`。
2. 传到手机（数据线 / 微信文件传输 / 网盘）。
3. 手机点开 APK → 允许未知来源 → 安装 → 打开。

## 自己开发（可选）

1. 装 Android Studio（developer.android.com/studio）。
2. 打开本目录 `android/`，同步后直接跑。

## 结构

```
android/
├── build.gradle.kts / settings.gradle.kts / gradle.properties
└── app/src/main/
    ├── AndroidManifest.xml
    ├── java/com/mnationworld/app/
    │   ├── MainActivity.kt   # 入口 + 登录页
    │   ├── MainScreen.kt     # 5 tab 底部导航 + 各模块
    │   ├── ApiClient.kt      # 网络 + 会话（同一后端 mnationworld.com）
    │   └── Models.kt         # 数据模型
    └── res/values/themes.xml
```

## 后端

直连现有 `https://mnationworld.com` 的 REST API，与网页端 / iOS 版共用，后端零改动。
