// tmp-fc-accent-v02816-patch.js — v0.2.28.16 FluidCanvas 主题色适配补丁（2026-09-11）
// ①两页接入 settings-modal.js（root cause：FC 两页从未加载 → data-accent 不落、mono 规则从未注入）
// ②fluidcanvas.html JS 模板两处硬编码 #4648d4 → var(--color-primary)（TYPE_META.article + Articles 指标）
// ③channelOverview 头像加 .channel-avatar 类（暗 mono 白渐变圆白字不可见 → 纯黑族覆写的抓手）
// CRLF 感知：两页均含 \r\n，插入新行统一用文件主换行符
'use strict';
const fs = require('fs');
const root = 'C:/Users/USER/Downloads/stitch_slatiworld_micronation_interface';

function patch(file, edits, nlAuto) {
  const p = root + file;
  let s = fs.readFileSync(p, 'utf8');
  const nl = nlAuto ? (s.indexOf('\r\n') !== -1 ? '\r\n' : '\n') : (s.indexOf('\r\n') !== -1 ? '\r\n' : '\n');
  for (const e of edits) {
    const cnt = s.split(e.old).length - 1;
    if (cnt !== e.n) { console.log('❌ 锚点计数错（期望 ' + e.n + ' 实得 ' + cnt + '）: ' + e.old.slice(0, 60)); process.exit(1); }
    s = s.replace(e.old, e.new.replace(/\\n/g, nl));
  }
  fs.writeFileSync(p, s);
  console.log('✅ ' + file + ' 完成（nl=' + (nl === '\r\n' ? 'CRLF' : 'LF') + '）');
}

// ── 1. fluidcanvas.html ──
patch('/docs/pages/fluidcanvas.html', [
  {
    old: '<script src="../assets/js/site-config.js"></script>',
    new: '<script src="../assets/js/site-config.js"></script>\n<script src="../assets/js/settings-modal.js"></script>',
    n: 1,
  },
  {
    old: "<div style=\"width:72px;height:72px;border-radius:50%;background:linear-gradient(135deg,var(--color-primary),var(--color-secondary));color:white;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:28px;flex-shrink:0\">",
    new: "<div class=\"channel-avatar\" style=\"width:72px;height:72px;border-radius:50%;background:linear-gradient(135deg,var(--color-primary),var(--color-secondary));color:white;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:28px;flex-shrink:0\">",
    n: 1,
  },
  {
    old: "article:   { icon:'article',   color:'#4648d4', bg:'rgba(70,72,212,0.08)',   label:'Article' },",
    new: "article:   { icon:'article',   color:'var(--color-primary)', bg:'color-mix(in srgb, var(--color-primary) 8%, transparent)',   label:'Article' },",
    n: 1,
  },
  {
    old: "color:#4648d4\">' + articles +",
    new: "color:var(--color-primary)\">' + articles +",
    n: 1,
  },
], true);

// ── 2. fluidcanvas-editor.html ──
patch('/docs/pages/fluidcanvas-editor.html', [
  {
    old: '<script src="../assets/js/site-config.js"></script>',
    new: '<script src="../assets/js/site-config.js"></script>\n<script src="../assets/js/settings-modal.js"></script>',
    n: 1,
  },
], true);

console.log('✅ v0.2.28.16 FC 补丁全部完成');
