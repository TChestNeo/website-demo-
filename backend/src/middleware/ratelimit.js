'use strict';
// 内存滑动窗口限流（单进程）。key 由调用方构造（如 'ec:email:x@y.z'）。
// 重启清零——一期可接受；多实例二期再上共享存储。

function createRateLimiter() {
  const hits = new Map(); // key -> number[]（时间戳）

  return function limit(key, max, windowMs) {
    const now = Date.now();
    let arr = hits.get(key);
    if (arr) {
      while (arr.length && arr[0] <= now - windowMs) arr.shift();
    } else {
      arr = [];
      hits.set(key, arr);
    }
    if (arr.length >= max) return false;
    arr.push(now);
    if (hits.size > 10000) { // 防内存膨胀：定期清过期键
      for (const [k, v] of hits) {
        while (v.length && v[0] <= now - windowMs) v.shift();
        if (!v.length) hits.delete(k);
      }
    }
    return true;
  };
}

// 客户端 IP：反向代理（Caddy）在环回上，取 X-Forwarded-For 第一个值
function ipOf(req) {
  const xff = req.headers['x-forwarded-for'];
  if (xff) return String(xff).split(',')[0].trim();
  return req.socket.remoteAddress || 'unknown';
}

module.exports = { createRateLimiter, ipOf };
