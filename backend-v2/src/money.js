'use strict';
// 金额双平面（D1）统一工具：
//   机器事件 = 整数微元（usage_log 微元 CNY；payments/refunds/payroll/promo 微元 MYR，列名 *_micro）
//   人工记账 = REAL 2 位小数 + 显式 currency（ledger/donations）
// 禁止在路由/UI 里手写除法或硬编码汇率；区域定价按 §9 禁止用汇率换算（每地区独立价格）。

const MICRO = 1_000_000;

// 微元整数 → 实数（保留 6 位小数避免浮点毛刺，展示层再 toFixed(2)）
function microToReal(micro) {
  return micro / MICRO;
}

// 实数（可带任意小数）→ 微元整数（四舍五入到整数微元）
function realToMicro(real) {
  return Math.round(real * MICRO);
}

// 整数微元 CNY → '¥x.xx'（AI 成本展示；v1 fmtYuan 同款口径）
function fmtMicroYuan(micro) {
  return '¥' + microToReal(micro).toFixed(2);
}

// 整数微元 MYR → 'RM x.xx'
function fmtMicroRM(micro) {
  return 'RM ' + microToReal(micro).toFixed(2);
}

// 实数金额 → 'RM x.xx'（ledger/donations REAL 值展示）
function fmtRealRM(amount) {
  return 'RM ' + Number(amount).toFixed(2);
}

// 当前汇率：CNY→MYR（每 1 CNY = 多少 MYR），读 platform_settings finance.fx；未配置回退 0.62。
// 仅用于成本折算展示；区域定价禁止换算（§9）。
function fxOf(db) {
  const row = db.prepare("SELECT value FROM platform_settings WHERE key = 'finance.fx'").get();
  const fx = row ? Number.parseFloat(row.value) : 0.62;
  return Number.isFinite(fx) && fx > 0 ? fx : 0.62;
}

// 整数微元 CNY → 整数微元 MYR（AI 成本进 MYR 报表）
function cnyMicroToRMMicro(db, micro) {
  return Math.round(micro * fxOf(db));
}

module.exports = {
  MICRO,
  microToReal,
  realToMicro,
  fmtMicroYuan,
  fmtMicroRM,
  fmtRealRM,
  fxOf,
  cnyMicroToRMMicro
};
