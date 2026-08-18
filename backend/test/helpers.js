'use strict';
// testApp 工厂：临时 SQLite（独立目录、隔离迁移）+ 邮件桩（收集验证码）+ listen(0) 真实端口。
// 测试结束必须 await t.close()。
// 常用辅助：t.request(method, path, body, {cookie})、t.loginAs(email, overrides)、t.seedUser(overrides)。

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { openDb } = require('../src/db');
const { createServer } = require('../src/server');
const { createSession } = require('../src/middleware/auth');
const { createUser } = require('../src/routes/auth');

function testApp(overrides = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mn-test-'));
  const db = openDb(path.join(dir, 'test.sqlite'));

  // 邮件桩：拦截验证码，测试直接读取
  const mails = [];
  const mailer = {
    sendCode: async (email, code, opts) => { mails.push({ email, code, opts }); return { dev: true }; },
    sendAlert: async (subject, text) => { mails.push({ type: 'alert', subject, text }); return { dev: true }; }
  };

  const baseConfig = { ...require('../src/config'), databasePath: ':memory:' };
  // fetchImpl 默认抛错桩：AI 调用在测试里必须显式注入（防误连真实 DeepSeek/IMS 产生账单）
  const noNetworkFetch = async () => { throw new Error('test fetch stub not configured'); };
  const app = createServer({
    db,
    config: { ...baseConfig, ...(overrides.config || {}) },
    mailer: overrides.mailer || mailer,
    limiter: overrides.limiter || undefined,
    fetchImpl: overrides.fetchImpl || noNetworkFetch
  });

  return new Promise((resolve) => {
    app.listen(0, '127.0.0.1', () => {
      const base = `http://127.0.0.1:${app.address().port}`;
      resolve({
        app,
        db,
        base,
        dir,
        mails,
        request: (method, p, body, opts = {}) =>
          fetch(`${base}${p}`, {
            method,
            headers: {
              'Content-Type': 'application/json',
              ...(opts.cookie ? { Cookie: opts.cookie } : {}),
              ...(opts.headers || {})
            },
            body: body === undefined ? undefined : JSON.stringify(body)
          }),
        // 直接建号 + 会话（跳过邮件流程的快捷路径）
        seedUser: (over = {}) => createUser(db, { email: over.email || 'seed@example.com', ...over }),
        loginAs: (email, over = {}) => {
          const user = createUser(db, { email, ...over });
          const token = createSession(db, user.id, 30 * 24 * 3600 * 1000);
          return { user, cookie: 'mn_session=' + token };
        },
        close: () => new Promise((r) => app.close(r))
      });
    });
  });
}

module.exports = { testApp };
