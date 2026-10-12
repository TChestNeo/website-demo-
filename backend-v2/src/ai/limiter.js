'use strict';
// v0.2.59.35 AI 请求排队层：全平台共享并发槽位（DeepSeek/Gemini 交互调用）。
// 高峰超槽的请求排队等位（客户端只是等待稍慢），排队超时 → AiBusyError（调用方降级或 429）。
// 目标：避免瞬时并发尖峰把供应商账号限速打爆 → 波及所有用户的 429。
// env：AI_MAX_CONCURRENT（槽数，v0.2.59.36 默认 32——用户钦定）、AI_WAIT_MS（最长排队毫秒，默认 30000）。

const DEFAULT_MAX = 32;
const DEFAULT_WAIT_MS = 30000;

class AiBusyError extends Error {
  constructor(waitMs) {
    super('AI 请求过多，请稍后重试');
    this.name = 'AiBusyError';
    this.code = 'AI_BUSY';
    this.waitedMs = waitMs || 0;
  }
}

function createAiLimiter(opts = {}) {
  const max = Math.max(1, parseInt(opts.max, 10) || DEFAULT_MAX);
  const waitMs = Math.max(1000, parseInt(opts.waitMs, 10) || DEFAULT_WAIT_MS);
  let active = 0;
  const waiters = []; // { resolve, timer, enqueuedAt }

  function handoff() {
    if (!waiters.length) return;
    const w = waiters.shift();
    clearTimeout(w.timer);
    w.resolve(); // 槽位转交：active 不变（-1 后 +1 相抵）
  }

  function releaseSlot() {
    active = Math.max(0, active - 1);
    handoff();
  }

  function acquire() {
    if (active < max) {
      active++;
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      const waiter = { resolve, enqueuedAt: Date.now() };
      waiter.timer = setTimeout(() => {
        const i = waiters.indexOf(waiter);
        if (i !== -1) waiters.splice(i, 1);
        reject(new AiBusyError(waitMs));
      }, waitMs);
      waiters.push(waiter);
    });
  }

  async function withSlot(fn) {
    await acquire();
    try {
      return await fn();
    } finally {
      releaseSlot();
    }
  }

  function stats() {
    return { active, waiting: waiters.length, max, waitMs };
  }

  return { acquire, releaseSlot, withSlot, stats };
}

module.exports = { createAiLimiter, AiBusyError, DEFAULT_MAX, DEFAULT_WAIT_MS };
