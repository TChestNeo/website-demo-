'use strict';
// P11 预算 80% 告警：warn→exhausted 各发一次（kv 档位去重）、total 档位独立、
// limit=0（功能关闭）跳过、无 ADMIN_EMAIL 不崩、cron 窗口 + 防重入。

const { test } = require('node:test');
const assert = require('node:assert');
const { testApp } = require('./helpers');
const { createBudget } = require('../src/moderation/budget');
const { runDailyBudgetAlert } = require('../src/budget-alert');
const { maybeRunDailyAlert } = require('../src/cron');

const ISO = '2026-08-18T10:00:00.000Z';

function insertUsage(db, feature, costMicro) {
  db.prepare('INSERT INTO usage_log (feature, tokens_in, tokens_out, tokens_cached, price_snapshot, cost_micro, batch_id, latency_ms, created_at) '
    + "VALUES (?, 0, 0, 0, '{}', ?, NULL, NULL, ?)").run(feature, costMicro, ISO);
}

function alertCtx(t) {
  const alerts = [];
  const mailer = { sendAlert: async (subject, text) => { alerts.push({ subject, text }); } };
  const ctx = {
    db: t.db,
    config: { adminEmail: 'admin@mn.test' },
    mailer,
    budget: createBudget(t.db, { budgets: {} })
  };
  return { ctx, alerts };
}

test('档位去重：warn 一次 → exhausted 一次，同档不重发', async () => {
  const t = await testApp();
  try {
    const { ctx, alerts } = alertCtx(t);
    ctx.budget.setLimit('chat', 10);
    insertUsage(t.db, 'chat', 8.5e6); // 85% → warn
    let r = runDailyBudgetAlert(ctx, ISO);
    assert.equal(r.sent.length, 1);
    assert.deepEqual(r.sent[0], { feature: 'chat', tier: 'warn' });
    assert.match(alerts[0].subject, /80%/);
    assert.match(alerts[0].text, /8\.50 元/);
    assert.match(alerts[0].text, /10\.00 元/);

    r = runDailyBudgetAlert(ctx, ISO); // 同档不重发
    assert.equal(r.sent.length, 0);
    assert.equal(alerts.length, 1);

    insertUsage(t.db, 'chat', 2e6); // 共 10.5 元 = 105% → exhausted
    r = runDailyBudgetAlert(ctx, ISO);
    assert.equal(r.sent.length, 1);
    assert.deepEqual(r.sent[0], { feature: 'chat', tier: 'exhausted' });
    assert.match(alerts[1].subject, /耗尽/);

    r = runDailyBudgetAlert(ctx, ISO);
    assert.equal(r.sent.length, 0);
    assert.equal(alerts.length, 2);
  } finally {
    await t.close();
  }
});

test('total 档位独立；分项因 total 超额折算时不重复告警', async () => {
  const t = await testApp();
  try {
    const { ctx, alerts } = alertCtx(t);
    ctx.budget.setLimit('chat', 10);
    ctx.budget.setLimit('total', 60);
    insertUsage(t.db, 'chat', 10.5e6); // chat 105% → exhausted（total 17.5% 不折算）
    let r = runDailyBudgetAlert(ctx, ISO);
    assert.equal(r.sent.length, 1);
    assert.equal(r.sent[0].feature, 'chat');

    ctx.budget.setLimit('total', 10); // total 105% → exhausted；chat 已是 exhausted 档位不重发
    r = runDailyBudgetAlert(ctx, ISO);
    assert.equal(r.sent.length, 1);
    assert.deepEqual(r.sent[0], { feature: 'total', tier: 'exhausted' });
    assert.equal(alerts.length, 2);
  } finally {
    await t.close();
  }
});

test('limit=0（功能关闭）跳过；无 ADMIN_EMAIL 不崩', async () => {
  const t = await testApp();
  try {
    const { ctx } = alertCtx(t);
    ctx.budget.setLimit('moderation_image', 0);
    insertUsage(t.db, 'moderation_image', 5e6);
    let r = runDailyBudgetAlert(ctx, ISO);
    assert.equal(r.sent.length, 0);

    ctx.config.adminEmail = '';
    ctx.budget.setLimit('moderation_image', 5);
    r = runDailyBudgetAlert(ctx, ISO); // 100% → exhausted 档，但无邮箱：不发信不抛错
    assert.equal(r.sent.length, 0);
    assert.doesNotThrow(() => runDailyBudgetAlert(ctx, ISO));
  } finally {
    await t.close();
  }
});

test('cron 窗口 + kv 防重入：窗口外 false、当日一次、次日重发', async () => {
  const t = await testApp();
  try {
    assert.equal(maybeRunDailyAlert(t.db, { date: '2026-08-18', hour: 9, minute: 59 }), false);
    assert.equal(maybeRunDailyAlert(t.db, { date: '2026-08-18', hour: 10, minute: 29 }), false);
    assert.equal(maybeRunDailyAlert(t.db, { date: '2026-08-18', hour: 10, minute: 30 }), true);
    assert.equal(maybeRunDailyAlert(t.db, { date: '2026-08-18', hour: 10, minute: 59 }), false);
    assert.equal(maybeRunDailyAlert(t.db, { date: '2026-08-18', hour: 11, minute: 5 }), false);
    assert.equal(maybeRunDailyAlert(t.db, { date: '2026-08-19', hour: 10, minute: 31 }), true);
    assert.equal(t.db.prepare("SELECT value FROM kv WHERE key = 'cron.budget_alert'").get().value, '2026-08-19');
  } finally {
    await t.close();
  }
});
