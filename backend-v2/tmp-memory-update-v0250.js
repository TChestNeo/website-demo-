// v0.2.25.0 收尾：memory 四锚点更新（backend-build-state.md 全量链 + site-versioning-scheme.md 全量链 + MEMORY.md 两条索引指针）
const fs = require('fs');
const MEM = 'C:/Users/USER/.claude/projects/c--Users-USER-Downloads-stitch-slatiworld-micronation-interface/memory/';

const REV_OLD = '**当前线上 rev 00119-mqh（';
const REV_NEW = '**当前线上 rev 00120-g74（2026-09-08 v0.2.25.0 Community 主页整页背景图片+编辑弹窗放大 1 倍——用户「在自定义那边再加上一个背景图片 这个就是整个页面的背景的图片」（问询钦定：只个人主页/公开/上传+网址双支持）+「能不能把编辑资料的弹窗的大小变大1倍」：①迁移 020 users.page_bg_image 列（/uploads/UPL-* 本站直传或 http(s) 外链；白名单正则 PAGE_BG_IMAGE_RE 防 CSS 注入 javascript: 等；无新表→health 58 不变、user_version 19→20）；PUT /auth/me pageBgImage null-or-string ≤2048 校验（非法 400 VALIDATION 不落库+audit next 加字段）；profile 端点公开返回 pageBgImage（他人主页也渲染本人设置的图）；②前端：编辑弹窗自定义 tab 第三组「页面背景」（默认/自定义图片双选项+上传按钮头像同款直传+网址输入仅 http(s) 生效非法警告不挂图+迷你整页预览）；整页渲染=body 挂 --page-bg-image+page-bg-active+深色蒙层 0.38 护可读性（.app-layout 无背景直接透出；applyPageBg 注入前再挡引号/反斜杠/括号双保险）；弹窗 560px→1120px（页级类 edit-profile-card 不污染灯箱/分享弹窗）；③测试 257→259+电池 65→76（E6 三组标签+弹窗 max-width=1120px+E6g 独立会话页面背景全链：默认→自定义→非法 javascript: 警告→合法网址预览→保存 PATCH 精确 ={"pageBgImage":"https://example.com/bg.jpg"}→body 整页背景→重开预填→默认保存 ={"pageBgImage":null} 恢复；E6d/E6f cardBg 精确断言零污染；O1 他人主页整页背景公开渲染——计算样式相对路径解析为绝对 URL 属正常）本地 76/76+19/19 线上（L1 版本 v0.2.25.0）+冒烟 49/49+curl 五连（health 58+profile 公开 pageBgImage+版本+edit-profile-card×2+匿名 PATCH 401）；部署一次 exit 0（00120-g74，28 env describe 全量+逗号参数引号）；commit 97bdb72（未 push））；前身 rev 00119-mqh（';

const SCHEME_OLD = '2026-09-08 v0.2.24.4 = ';
const SCHEME_NEW = '2026-09-08 v0.2.25.0 = Community 主页整页背景图片+编辑弹窗放大 1 倍（小改动位 24→25·整页背景轮——用户「在自定义那边再加上一个背景图片 这个就是整个页面的背景的图片」（问询：只个人主页/公开/上传+网址）+「弹窗大小变大1倍」：迁移 020 users.page_bg_image（uploads 直传或 http(s) 白名单正则防注入）；编辑弹窗第三组「页面背景」（默认/自定义+上传/网址+迷你整页预览）；body 整页渲染（--page-bg-image+page-bg-active+深色蒙层 0.38，他人主页公开渲染）；弹窗 560→1120px（页级类）；测试 259/259+电池 76/76 本地+19/19 线上+冒烟 49/49+curl，rev 00120-g74 commit 97bdb72（未 push））；前身 2026-09-08 v0.2.24.4 = ';

function patch(file, pairs) {
  const p = MEM + file;
  let s = fs.readFileSync(p, 'utf8');
  for (const [o, n] of pairs) {
    const c = s.split(o).length - 1;
    if (c !== 1) throw new Error(file + ' anchor count=' + c + ' for: ' + o.slice(0, 40));
    s = s.replace(o, n);
  }
  fs.writeFileSync(p, s, 'utf8');
  console.log('patched', file);
}

// MEMORY.md 两条索引指针更新（v0.2.24.1 起已瘦身：全量链在 backend-build-state.md + site-versioning-scheme.md）
function slim() {
  const p = MEM + 'MEMORY.md';
  let lines = fs.readFileSync(p, 'utf8').split('\n');
  let n = 0;
  lines = lines.map(l => {
    if (l.indexOf('- [后端 v2 重写') === 0) {
      n++;
      const i = l.indexOf('**当前线上 rev ');
      if (i < 0) throw new Error('rev anchor missing in backend index line');
      return l.slice(0, i) + '**当前线上 rev 00120-g74（2026-09-08 v0.2.25.0 Community 主页整页背景图片轮；每轮 rev 全量链见 [[backend-build-state]]）**' + l.slice(l.indexOf('；W3-W5 待做'));
    }
    if (l.indexOf('- [侧栏版本号口径') === 0) {
      n++;
      const i = l.indexOf('站点号当前 **v0.2.24.4**（');
      if (i < 0) throw new Error('site anchor missing in versioning index line');
      return l.slice(0, i) + '站点号当前 **v0.2.25.0**（2026-09-08 Community 主页整页背景图片轮，rev 00120-g74 commit 97bdb72 未 push）' + l.slice(l.indexOf('](site-versioning-scheme.md)'));
    }
    return l;
  });
  if (n !== 2) throw new Error('slim matched ' + n + ' lines, want 2');
  fs.writeFileSync(p, lines.join('\n'), 'utf8');
  console.log('updated MEMORY.md 2 index lines');
}

patch('backend-build-state.md', [
  [REV_OLD, REV_NEW],
  // 顺带修正 v0.2.24.4 旧链头：dec4559a 是 H1，amend 后最终 commit=011392da
  ['commit dec4559a（未 push）', 'commit 011392da（未 push）']
]);
patch('site-versioning-scheme.md', [
  [SCHEME_OLD, SCHEME_NEW],
  ['rev 00119-mqh commit dec4559a（未 push）', 'rev 00119-mqh commit 011392da（未 push）']
]);
slim();
console.log('OK 4 anchors');
