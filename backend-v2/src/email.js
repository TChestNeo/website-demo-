'use strict';
// 邮件发送：生产走 SMTP（腾讯云 SES 国际站可用性上线前验证；不可用换 Mailgun 只改 env）。
// 本地未配 SMTP_HOST 时打日志发码（联调），验证码登录流程照常可走。
// 测试注入自定义 transport（见 test/helpers.js）。
// v2 新增：purpose 'staff_login'（管理后台 staff 登录码，文案区分用户登录码）。

const nodemailer = require('nodemailer');

function createMailer(cfg) {
  const smtp = cfg.mail.smtp;
  const transporter = smtp.host
    ? nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
        auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined
      })
    : null;

  // 防枚举：未注册/已注册邮件文案不同，但接口响应一致
  function sendCode(email, code, opts = {}) {
    const registered = opts.registered !== false;
    const purpose = opts.purpose || 'login';
    const staff = purpose === 'staff_login';

    const subject = staff
      ? 'SlatiControl 管理后台登录验证码 / SlatiControl sign-in code'
      : registered
        ? 'M.NationWorld 登录验证码 / Sign-in code'
        : '欢迎加入 M.NationWorld / Welcome to M.NationWorld';
    const text =
      (staff
        ? '您的 SlatiControl 管理后台登录验证码是：' + code + '\n10 分钟内有效。若非本人操作请立即报告。\n\n'
        : registered
          ? '您的登录验证码是：' + code + '\n10 分钟内有效。若非本人操作请忽略。\n\n'
          : '感谢注册 M.NationWorld！您的验证码是：' + code + '\n10 分钟内有效。若非本人操作请忽略。\n\n') +
      (staff
        ? 'Your SlatiControl verification code: ' + code +
          '\nValid for 10 minutes. If this was not you, report it immediately.'
        : 'Your M.NationWorld verification code: ' + code +
          '\nValid for 10 minutes. If this was not you, ignore this email.');

    if (!transporter) {
      console.log(`[dev-mail] to=${email} code=${code} registered=${registered} purpose=${purpose}`);
      return Promise.resolve({ dev: true });
    }
    return transporter.sendMail({ from: cfg.mail.from, to: email, subject, text });
  }

  // 运维告警（预算 80%/耗尽，P11）：发给管理员邮箱；未配 SMTP 打 dev 日志（告警链路不崩）。
  function sendAlert(subject, text) {
    const to = cfg.adminEmail;
    if (!to) return Promise.resolve({ skipped: true });
    if (!transporter) {
      console.log(`[dev-mail-alert] to=${to} subject=${subject}`);
      return Promise.resolve({ dev: true });
    }
    return transporter.sendMail({ from: cfg.mail.from, to, subject, text });
  }

  return { sendCode, sendAlert };
}

module.exports = { createMailer };
