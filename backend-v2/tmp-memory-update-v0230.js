// v0.2.23.0 收尾：memory 四锚点更新（MEMORY.md ×2 + backend-build-state.md + site-versioning-scheme.md）
const fs = require('fs');
const MEM = 'C:/Users/USER/.claude/projects/c--Users-USER-Downloads-stitch-slatiworld-micronation-interface/memory/';

const REV_OLD = '**当前线上 rev 00109-zb7（';
const REV_NEW = '**当前线上 rev 00110-lvd（2026-09-07 v0.2.23.0 Community 编辑资料弹窗 基础/自定义 导航 + 卡片背景液体玻璃——用户「使用这个react的 在编辑资料弹窗的顶部添加一个导航，然后导航内有基础和自定义，自定义是可以自定义卡片背景 你先把那个react内的加入那个自定义内一下」：①效果引擎=复用站内 liquid-glass.js v2（rdev/liquid-glass-react 纯 JS 移植：blur+saturate+SVG 折射+inset 玻璃环；静态模式——v0.2.9.1「Q弹很丑」钦定永久停弹性，本轮不复活鼠标跟随）；②后端 迁移 018 users.card_bg 加列（ALTER 无新表 → health 58 不变、user_version 17→18）+白名单 CARD_BG_KEYS 六键三处同步（social.js/auth.js/tail）+PATCH /auth/me 接受 cardBg（null=恢复默认品牌横幅、非法键 400 VALIDATION）+profile 端点公开返回（他人主页也渲染拥有者背景）；③前端 tail：编辑资料弹窗顶部 .edit-nav 药丸导航 基础/自定义 两 tab（基础=原有字段不动；自定义=7 款玻璃预设 默认/磨砂/深海/薰衣草/樱花/薄荷/落日+实时预览+保存落库）+renderHeader 挂 liquid-glass glass-bg 预设类+data-card-bg+LG.apply（幂等）+swatches/预览只 CSS 冰霜（小元素 scale-70 折射=暴力坑）+重建 128065 chars；④测试 253→255/255（migrations 018 列测试+social-profile cardBg 链：PATCH 落库/非法 400/null 恢复/本人+匿名公开渲染）+电池 54/54 本地（E6 新组全链：导航 2 药丸+互斥显示+7 预设+点选互斥+预览同步+PATCH 精确单字段+头部挂玻璃 blur(14px)+重开预填+选默认 null 回默认；O1 他人 glass-rose 公开渲染；G2b 默认区分信号=类+属性非层——scan 全卡 lg-static 静态层不是信号）+16/16 线上（L2 玻璃类与层一致；真用户 TChestBox_Neo cardBg=null 默认渲染实测）+冒烟 49/49+curl 八连（health 58+版本 v0.2.23.0+cardBg null+匿名 stats 双 null+tab 双 403+收藏 401+bogus 400）；部署一次 exit 0（revision 00110-lvd）；rev 00110-lvd commit 558dd98（未 push））；前身 rev 00109-zb7（';

const SITE_OLD = '站点号当前 **v0.2.22.6**（';
const SITE_NEW = '站点号当前 **v0.2.23.0**（2026-09-07 Community 编辑资料弹窗 基础/自定义 导航 + 卡片背景液体玻璃轮——用户「使用这个react的…自定义卡片背景」：编辑资料弹窗顶部 .edit-nav 药丸导航 基础/自定义 两 tab（自定义=7 款玻璃预设 默认/磨砂/深海/薰衣草/樱花/薄荷/落日+实时预览+保存落库）；效果引擎复用站内 liquid-glass.js v2 静态模式（不复活 Q 弹——v0.2.9.1 钦定）；迁移 018 users.card_bg+PATCH /auth/me 落库（null=默认/非法 400）+主页公开渲染；测试 253→255/255+电池 54/54 本地+16/16 线上+冒烟 49/49+curl 八连+health 58；rev 00110-lvd commit 558dd98（未 push））；前身 v0.2.22.6（';

const SCHEME_OLD = '2026-09-07 v0.2.22.6 = ';
const SCHEME_NEW = '2026-09-07 v0.2.23.0 = Community 编辑资料弹窗 基础/自定义 导航 + 卡片背景液体玻璃（小改动位 22→23 新功能轮·补丁清零——用户「使用这个react的 在编辑资料弹窗的顶部添加一个导航，然后导航内有基础和自定义，自定义是可以自定义卡片背景 你先把那个react内的加入那个自定义内一下」：弹窗顶部 .edit-nav 药丸导航 基础/自定义 两 tab；自定义=7 款玻璃预设（默认/磨砂/深海/薰衣草/樱花/薄荷/落日）+实时预览+保存落库；效果引擎复用站内 liquid-glass.js v2（rdev/liquid-glass-react 纯 JS 移植，静态模式——v0.2.9.1「Q弹很丑」钦定永久停弹性）；后端迁移 018 users.card_bg（ALTER 无新表 → health 58 不变、user_version 17→18）+白名单三处同步+PATCH /auth/me 落库（null=默认/非法键 400）+主页公开渲染他人背景；测试 253→255/255+电池 54/54 本地（E6 全链+O1 公开渲染）+16/16 线上+冒烟 49/49+curl 八连+health 58，rev 00110-lvd commit 558dd98（未 push））；前身 2026-09-07 v0.2.22.6 = ';

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
patch('MEMORY.md', [[REV_OLD, REV_NEW], [SITE_OLD, SITE_NEW]]);
patch('backend-build-state.md', [[REV_OLD, REV_NEW]]);
patch('site-versioning-scheme.md', [[SCHEME_OLD, SCHEME_NEW]]);
console.log('OK 4 anchors');
