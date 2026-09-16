/* story-fontcycle.js — 「冷战」两字字体轮转（用户口径：冷战两字亮起时才自动切换多种字体，不需要滚轮）
   口径 v2（2026-09-10 用户追加）：硬切无淡入淡出（不动 opacity）、每个字体只停 0.2s、
   轮完直接停在最后一个字体（不再回默认）。
   标记：行内 <span class="fc-words" data-fc="冷战">（MagicText 拆字只拆文本节点、元素节点原样保留）；
   触发：只等「冷战」两字自己的 .mw-fill 全亮（≥ .98）——不是整行、更不是场景入场——然后纯定时器轮转，
   滚轮零参与；预载：document.fonts.load 只拉「冷战」两字切片（unicode-range 按需，4 字体共 8 字形）；
   reduced-motion：整体跳过（保持默认字体）。探测口 window.storyFontCycle = { ok, skipped, done, fonts }。 */
(function () {
  'use strict';

  var FONTS = ['ZCOOL XiaoWei', 'ZCOOL KuaiLe', 'Ma Shan Zheng', 'Zhi Mang Xing'];
  var HOLD = 200, LEAD_IN = 320;

  window.storyFontCycle = { ok: false, skipped: false, done: false, fonts: FONTS };

  var reduced = false;
  try { reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  if (reduced) { window.storyFontCycle.skipped = true; return; }

  var word = document.querySelector('[data-fc]');
  if (!word) return;
  window.storyFontCycle.ok = true;

  var line = word.closest('.line');
  if (!line) return;
  var wordFills = word.querySelectorAll('.mw-fill');

  // 预载四种字体的「冷战」两字（任一失败或超时 2.5s 也照常开转——display=swap 回退字体无害）
  var preloaded = false;
  var todo = FONTS.length;
  var tmo = setTimeout(function () { preloaded = true; tryStart(); }, 2500);
  function oneDone() {
    todo--;
    if (todo <= 0) { clearTimeout(tmo); preloaded = true; tryStart(); }
  }
  for (var i = 0; i < FONTS.length; i++) {
    (function (f) {
      try { document.fonts.load('20px "' + f + '"', '冷战').then(oneDone, oneDone); }
      catch (e) { oneDone(); }
    })(FONTS[i]);
  }

  var started = false;
  function coldWarLit() {
    if (!wordFills.length) return false;
    for (var k = 0; k < wordFills.length; k++) {
      if (parseFloat(wordFills[k].style.opacity) < 0.98) return false;
    }
    return true;
  }
  var pollId = null;
  function tryStart() {
    if (started || !preloaded || !coldWarLit()) return;
    started = true;
    clearInterval(pollId);
    window.removeEventListener('scroll', tryStart);
    window.removeEventListener('resize', tryStart);
    run();
  }
  function run() {
    var base = getComputedStyle(word).fontFamily;
    var idx = 0;
    function step() {
      if (idx >= FONTS.length) {   // 轮完：停在最后一个字体，不回默认
        window.storyFontCycle.done = true;
        return;
      }
      word.style.fontFamily = '"' + FONTS[idx] + '", ' + base;
      idx++;
      setTimeout(step, HOLD);
    }
    setTimeout(step, LEAD_IN);     // 冷战亮起后略顿一下再开转
  }

  window.addEventListener('scroll', tryStart, { passive: true });
  window.addEventListener('resize', tryStart);
  // story.js 的 fill 更新在 rAF 合并回调里（晚于同一滚动事件）——轮询兜底捕捉「冷战两字亮起」时刻
  pollId = setInterval(function () { tryStart(); }, 120);
  tryStart();
})();
