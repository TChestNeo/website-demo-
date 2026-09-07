// tmp-apply-fireworks-port.js — v0.2.18.3 照搬用户参考粒子特效（64 色环从参考文本程序化提取，不手抄防抄错）
'use strict';
const fs = require('fs');

// 1) 从参考代码提取 fireworks-bang 的粒子 box-shadow（逐字节照搬，跨行）
const ref = fs.readFileSync(__dirname + '/tmp-ref-code.txt', 'utf8');
const m = ref.match(/@keyframes fireworks-bang\s*\{[^}]*box-shadow:\s*([\s\S]*?);\s*\}/);
if (!m) throw new Error('参考 fireworks-bang box-shadow 未找到');
const S = m[1].replace(/\s+/g, ' ').trim();
const nColors = (S.match(/#[0-9a-f]{6}/g) || []).length;
if (nColors < 50 || nColors > 80) throw new Error('参考粒子数异常: ' + nColors);

const BASE = new Array(nColors).fill('0 0 #fff').join(', ');

const CSS =
`/* ----- v0.2.18.3 点赞粒子特效完整照搬参考代码（用户「粒子效果别改颜色啊」「只是把完整的粒子特效搬出来」）-----
   ${nColors} 粒子 + 色环逐字照搬 + 三动画链照参考原版时长：1.25s bang ease-out 迸发 → 1.25s gravity ease-in 下落 → 6.25s position linear 游走；
   粒子=单个 10px 圆点 + 64 条 box-shadow（零额外节点）；like-pop 一次性类由 JS 加、最后一档动画完（mn-fireworks-position）或 6.8s 兜底摘；
   重渲染/已点赞卡片不重播；reduced-motion 关动画只换实心（经 shared head 自动流入重建后的帖页）*/
.like-burst {
  position: absolute; right: 40px; top: 50%; width: 10px; height: 10px; margin: -5px 0 0 -5px;
  border-radius: 50%; display: none; pointer-events: none; transform: scale(0.4);
  box-shadow: ${BASE};
}
.post-action-btn.like-pop .like-burst {
  display: block;
  animation: 1.25s mn-fireworks-bang ease-out forwards, 1.25s mn-fireworks-gravity ease-in forwards, 6.25s mn-fireworks-position linear forwards;
}
.post-action-btn.like-pop .material-symbols-outlined { animation: like-pop-icon 0.5s ease-out; }
@keyframes like-pop-icon {
  0% { transform: scale(0); opacity: 0; }
  50% { transform: scale(1.2) rotate(-10deg); }
}
@keyframes mn-fireworks-bang {
  to { box-shadow: ${S}; }
}
@keyframes mn-fireworks-gravity {
  to { transform: translateY(200px) scale(0.4); opacity: 0; }
}
@keyframes mn-fireworks-position {
  0%, 19.9% { margin-top: 10%; margin-left: 40%; }
  20%, 39.9% { margin-top: 40%; margin-left: 30%; }
  40%, 59.9% { margin-top: 20%; margin-left: 70%; }
  60%, 79.9% { margin-top: 30%; margin-left: 20%; }
  80%, 99.9% { margin-top: 30%; margin-left: 80%; }
}
@media (prefers-reduced-motion: reduce) {
  .post-action-btn.like-pop .material-symbols-outlined { animation: none; }
  .post-action-btn.like-pop .like-burst { display: none; }
}`;

// 2) hub CSS 块整体替换（v0.2.18.1 旧块 → 照搬版）
const HUB = require('path').resolve(__dirname, '..', 'docs', 'pages', 'community-hub.html');
let ht = fs.readFileSync(HUB, 'utf8');
const s = ht.indexOf('/* ----- v0.2.18.1 点赞动画：爱心弹跳');
if (s < 0) throw new Error('hub CSS 块起点未找到');
if (ht.indexOf('/* ----- v0.2.18.1 点赞动画：爱心弹跳', s + 1) >= 0) throw new Error('hub CSS 块起点出现两次');
const e = ht.indexOf('</style>', s);
if (e < 0) throw new Error('hub CSS 块终点未找到');
ht = ht.slice(0, s) + CSS + '\n' + ht.slice(e);
fs.writeFileSync(HUB, ht);
console.log('OK hub CSS 块已替换（64 色环照搬）');

// 3) armLikePop：hub + tail——摘类改等最后一档动画（mn-fireworks-position 6.25s），6.8s 兜底
const HUB_OLD = `  // v0.2.18.1 点赞动画一次性类：点赞瞬间加 like-pop（爱心弹跳+粒子迸发），动画结束/兜底定时器后摘——
  // 类挂在按钮上而非默认渲染里，60s 重渲染/已点赞卡片不重播动画
  function armLikePop(btn) {
    btn.classList.add('like-pop');
    var burst = btn.querySelector('.like-burst');
    var done = function () { btn.classList.remove('like-pop'); };
    if (burst) burst.addEventListener('animationend', done, { once: true });
    setTimeout(done, 950); // reduced-motion 关动画无 animationend 的兜底
  }`;
const TAIL_OLD = `  // v0.2.18.1 点赞动画一次性类（与 hub armLikePop 同逻辑）：点赞瞬间加 like-pop，动画结束/兜底定时器后摘
  function armLikePop(btn) {
    btn.classList.add('like-pop');
    var burst = btn.querySelector('.like-burst');
    var done = function () { btn.classList.remove('like-pop'); };
    if (burst) burst.addEventListener('animationend', done, { once: true });
    setTimeout(done, 950); // reduced-motion 关动画无 animationend 的兜底
  }`;
const NEW_FN = `  // v0.2.18.3 粒子链最后一档（mn-fireworks-position 6.25s）动画完才摘 like-pop——粒子照参考完整飞完再收；
  // 6.8s 兜底（reduced-motion 无 animationend）；类挂在按钮上而非默认渲染里，重渲染/已点赞卡片不重播
  function armLikePop(btn) {
    btn.classList.add('like-pop');
    var burst = btn.querySelector('.like-burst');
    var onEnd = function (e) {
      if (!e || e.animationName !== 'mn-fireworks-position') return;
      burst.removeEventListener('animationend', onEnd);
      btn.classList.remove('like-pop');
    };
    if (burst) burst.addEventListener('animationend', onEnd);
    setTimeout(function () { btn.classList.remove('like-pop'); }, 6800);
  }`;

function repOnce(file, old, neu, label) {
  const t = fs.readFileSync(file, 'utf8');
  let i = t.indexOf(old);
  if (i < 0) throw new Error('未找到: ' + label);
  if (t.indexOf(old, i + 1) >= 0) throw new Error('出现两次: ' + label);
  fs.writeFileSync(file, t.replace(old, neu));
  console.log('OK ' + label);
}
repOnce(HUB, HUB_OLD, NEW_FN, 'hub armLikePop');
const TAIL = require('path').resolve(__dirname, 'tmp-community-post-tail.html');
repOnce(TAIL, TAIL_OLD, NEW_FN, 'tail armLikePop');

console.log('全部完成');
