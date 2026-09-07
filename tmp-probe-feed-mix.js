// 确认：假登录（云模式）下 hub 是否真帖+演示卡混排
'use strict';
const fs = require('fs'); const path = require('path'); const os = require('os');
const { spawn } = require('child_process');
const CDP_PORT = 4900 + Math.floor(Math.random() * 500);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-' + Date.now());
const sleep = ms => new Promise(r => setTimeout(r, ms));
class CDP {
  constructor(wsUrl) { this.wsUrl = wsUrl; this.id = 0; this.pending = new Map(); this.listeners = new Map(); }
  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = () => rej(new Error('ws error')); });
    this.ws.onmessage = (ev) => { const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) { const { res, rej } = this.pending.get(m.id); this.pending.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); }
      else if (m.method) { const ls = this.listeners.get(m.method); if (ls) ls.forEach(fn => fn(m.params)); } };
  }
  send(method, params) { return new Promise((res, rej) => { const id = ++this.id; this.pending.set(id, { res, rej }); this.ws.send(JSON.stringify({ id, method, params: params || {} })); }); }
  on(method, fn) { if (!this.listeners.has(method)) this.listeners.set(method, []); this.listeners.get(method).push(fn); }
  async evalJs(expr) { const r = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error('evalJs'); return r.result.value; }
  close() { try { this.ws.close(); } catch (e) {} }
}
async function main() {
  let chromePath = null;
  for (const p of ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', path.join(process.env.LOCALAPPDATA || '', 'Google/Chrome/Application/chrome.exe')]) if (fs.existsSync(p)) { chromePath = p; break; }
  const chrome = spawn(chromePath, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--window-size=1280,900', '--remote-debugging-port=' + CDP_PORT, '--user-data-dir=' + USER_DATA, 'about:blank'], { stdio: 'ignore' });
  for (let i = 0; i < 80; i++) { try { const r = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/version'); if (r.ok) break; } catch (e) {} await sleep(250); }
  const r = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/new?about:blank', { method: 'PUT' });
  const t = new CDP((await r.json()).webSocketDebuggerUrl);
  await t.connect(); await t.send('Page.enable'); await t.send('Runtime.enable');
  await t.send('Page.navigate', { url: 'https://mnationworld.com/pages/community-hub.html' });
  await sleep(1200);
  await t.evalJs("localStorage.setItem('slati_session', JSON.stringify({ loggedIn: true, at: new Date().toISOString() }));" + "localStorage.setItem('slati_user', JSON.stringify({ id: 'USR-000101', name: '探针', avatarUrl: null }));");
  await t.send('Page.reload'); await sleep(2500);
  for (let i = 0; i < 60; i++) { const n = await t.evalJs("document.querySelectorAll('[data-cloud-id]').length"); if (n >= 1) break; await sleep(500); }
  const mix = await t.evalJs("(() => { var feed = document.getElementById('feedContent');" +
    " var all = feed.querySelectorAll('.card').length;" +
    " var cloud = feed.querySelectorAll('[data-cloud-id]').length;" +
    " var staticHearts = feed.querySelectorAll('.post-action-btn-static').length;" +
    " var authors = [].slice.call(feed.querySelectorAll('h4')).map(function(h){return h.textContent;}).slice(0,8);" +
    " return { all: all, cloud: cloud, staticHearts: staticHearts, titles: authors }; })()");
  console.log(JSON.stringify(mix, null, 2));
  t.close(); chrome.kill(); process.exit(0);
}
main().catch(e => { console.error('探针异常:', e.message); process.exit(2); });
