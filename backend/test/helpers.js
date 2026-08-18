'use strict';
// testApp 工厂：临时 SQLite（独立目录、隔离迁移）+ listen(0) 真实端口 + fetch 请求助手。
// P2 起扩展：nodemailer jsonTransport 邮件桩、DeepSeek/IMS fetch 桩。
// 每个测试文件独立实例；测试结束必须 await t.close()。

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { openDb } = require('../src/db');
const { createServer } = require('../src/server');

function testApp(overrides = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mn-test-'));
  const db = openDb(path.join(dir, 'test.sqlite'));
  const app = createServer({ db, config: { ...require('../src/config'), databasePath: ':memory:' }, ...overrides });

  return new Promise((resolve) => {
    app.listen(0, '127.0.0.1', () => {
      const base = `http://127.0.0.1:${app.address().port}`;
      resolve({
        app,
        db,
        base,
        dir,
        request: (method, p, body) =>
          fetch(`${base}${p}`, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: body === undefined ? undefined : JSON.stringify(body)
          }),
        close: () => new Promise((r) => app.close(r))
      });
    });
  });
}

module.exports = { testApp };
