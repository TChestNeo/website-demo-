import SwiftUI

/// 登录页：邮箱验证码两步（与网页端 /api/auth 契约一致）。
/// 已有账号：邮箱 → 6 位码 → 登录。
/// 新账号：后端 verify 返回 status="new"，需补密码（≥8 位）——见密码步骤。
struct LoginView: View {
    enum Step {
        case email      // 输入邮箱，发送验证码
        case code       // 输入 6 位码（+ 新账号设密码）
    }

    @Environment(Session.self) private var session

    @State private var step: Step = .email
    @State private var email = ""
    @State private var code = ""
    @State private var password = ""
    @State private var isNewAccount = false
    @State private var busy = false
    @State private var errorText: String?
    @State private var resendCooldown = 0

    private var emailValid: Bool {
        email.contains("@") && email.contains(".")
    }

    var body: some View {
        VStack(spacing: 0) {
            header
            form
            Spacer()
            footnote
        }
        .padding(.horizontal, 24)
        .padding(.vertical, 32)
        .background(Color(.systemGroupedBackground))
        .task { await session.refreshUser() } // 冷启动时若 cookie 仍有效则直接恢复登录
    }

    private var header: some View {
        VStack(spacing: 10) {
            Image(systemName: "globe.americas.fill")
                .font(.system(size: 56))
                .foregroundStyle(Color(red: 0.275, green: 0.282, blue: 0.831))
            Text("M.NationWorld")
                .font(.largeTitle.bold())
            Text("创建属于你的架空世界")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .padding(.top, 40)
        .padding(.bottom, 32)
    }

    @ViewBuilder
    private var form: some View {
        switch step {
        case .email:
            emailForm
        case .code:
            codeForm
        }
    }

    private var emailForm: some View {
        VStack(spacing: 16) {
            TextField("邮箱", text: $email)
                .textContentType(.emailAddress)
                .keyboardType(.emailAddress)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .padding(14)
                .background(Color(.secondarySystemGroupedBackground))
                .clipShape(RoundedRectangle(cornerRadius: 12))

            Button {
                Task { await sendCode() }
            } label: {
                if busy {
                    ProgressView()
                } else {
                    Text("发送验证码")
                }
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
            .disabled(!emailValid || busy)

            if let errorText {
                Text(errorText)
                    .font(.footnote)
                    .foregroundStyle(.red)
            }
        }
    }

    private var codeForm: some View {
        VStack(spacing: 16) {
            Text("验证码已发送到 \(email)")
                .font(.subheadline)
                .foregroundStyle(.secondary)

            TextField("6 位验证码", text: $code)
                .keyboardType(.numberPad)
                .textContentType(.oneTimeCode)
                .padding(14)
                .background(Color(.secondarySystemGroupedBackground))
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .onChange(of: code) { _, new in
                    code = String(new.filter(\.isNumber).prefix(6))
                }

            if isNewAccount {
                SecureField("设置密码（至少 8 位）", text: $password)
                    .padding(14)
                    .background(Color(.secondarySystemGroupedBackground))
                    .clipShape(RoundedRectangle(cornerRadius: 12))
            }

            Button {
                Task { await verifyLogin() }
            } label: {
                if busy {
                    ProgressView()
                } else {
                    Text(isNewAccount ? "注册并登录" : "登录")
                }
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
            .disabled(code.count != 6 || busy || (isNewAccount && password.count < 8))

            HStack(spacing: 16) {
                Button("换邮箱") { step = .email }
                    .font(.footnote)

                Button(resendCooldown > 0 ? "重新发送（\(resendCooldown)s）" : "重新发送") {
                    Task { await sendCode() }
                }
                .font(.footnote)
                .disabled(resendCooldown > 0 || busy)
            }

            if let errorText {
                Text(errorText)
                    .font(.footnote)
                    .foregroundStyle(.red)
            }
        }
    }

    private var footnote: some View {
        Text("登录即代表同意服务条款与社区规则")
            .font(.caption2)
            .foregroundStyle(.tertiary)
    }

    // MARK: - 动作

    private func sendCode() async {
        busy = true
        errorText = nil
        do {
            try await APIClient.shared.sendEmailCode(email)
            step = .code
            resendCooldown = 60
            Task {
                while resendCooldown > 0 {
                    try? await Task.sleep(for: .seconds(1))
                    resendCooldown -= 1
                }
            }
        } catch {
            errorText = error.localizedDescription
        }
        busy = false
    }

    private func verifyLogin() async {
        busy = true
        errorText = nil
        do {
            let resp = try await APIClient.shared.verify(.init(
                email: email,
                code: code,
                password: password.isEmpty ? nil : password,
                displayName: nil
            ))
            if resp.status == "new" && resp.user.hasPassword != true {
                // 新账号必须带密码（后端强制），此处重新进入密码输入
                isNewAccount = true
                errorText = "新账号请先设置密码（至少 8 位）"
            } else {
                session.applyLogin(resp.user)
            }
        } catch {
            errorText = error.localizedDescription
        }
        busy = false
    }
}

#Preview {
    LoginView()
        .environment(Session())
}
