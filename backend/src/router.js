'use strict';
// 极简路由：method + 路径匹配（支持 :param，容忍尾部斜杠）。
// 路由表由 server.js 与各 routes/* 模块注册；未命中 → 404。

class Router {
  constructor() {
    this.routes = [];
  }

  add(method, pattern, handler) {
    const keys = [];
    const rx = new RegExp(
      '^/' +
      pattern.split('/').filter(Boolean).map((p) => {
        if (p.startsWith(':')) {
          keys.push(p.slice(1));
          return '([^/]+)';
        }
        return p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      }).join('/') +
      '/?$'
    );
    this.routes.push({ method, rx, keys, handler });
  }

  match(req) {
    const path = (req.url || '/').split('?')[0];
    for (const r of this.routes) {
      if (r.method !== req.method) continue;
      const m = r.rx.exec(path);
      if (!m) continue;
      const params = {};
      r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
      return { handler: r.handler, params };
    }
    return null;
  }
}

module.exports = Router;
