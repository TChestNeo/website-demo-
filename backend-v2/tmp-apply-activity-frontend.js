// tmp-apply-activity-frontend.js — v0.2.58.16 活动页前端一次性应用（5 处编辑）：
// ①搜索框加 id ②分类图标题改键+兜底 ③api.js 脚本插入 ④</head> 前页面专属 style 块 ⑤IIFE 整体换新（tmp-activity-page-iife.js）。
// CRLF 归一化处理：读入去 \r、写回全 \r\n（仓库全 CRLF 家规）。零残留锚由电池复核。
'use strict';
const fs = require('fs');
const path = require('path');

const PAGE = path.join(__dirname, '..', 'docs', 'pages', 'activity.html');
const IIFE = fs.readFileSync(path.join(__dirname, 'tmp-activity-page-iife.js'), 'utf8');

let s = fs.readFileSync(PAGE, 'utf8').replace(/\r\n/g, '\n');
const orig = s;

// ① 搜索框加 id
const A1 = '<input type="text" placeholder="Search metrics..." data-i18n-placeholder="activity.search.placeholder">';
const B1 = '<input type="text" id="activitySearch" placeholder="Search metrics..." data-i18n-placeholder="activity.search.placeholder">';
if (s.split(A1).length - 1 !== 1) throw new Error('anchor A1 count != 1');
s = s.replace(A1, B1);

// ② 分类图标题改键 + en 兜底同步（en 兜底必须与 i18n en 值逐字节一致）
const A2 = 'data-i18n="activity.chart.category">Content by Category';
const B2 = 'data-i18n="activity.chart.contentTypes">Content by Type';
if (s.split(A2).length - 1 !== 1) throw new Error('anchor A2 count != 1');
s = s.replace(A2, B2);

// ③ site-config 后插 api.js（MN_API 供 IIFE 使用）
const A3 = '<script src="../assets/js/site-config.js"></script>\n<script src="../assets/js/storage.js"></script>';
const B3 = '<script src="../assets/js/site-config.js"></script>\n<script src="../assets/js/api.js"></script>\n<script src="../assets/js/storage.js"></script>';
if (s.split(A3).length - 1 !== 1) throw new Error('anchor A3 count != 1');
s = s.replace(A3, B3);

// ④ </head> 前页面专属 style 块（inliner 管区之外，随页部署）
const A4 = '</style>\n</head>';
const B4 = '</style>\n<style>\n' +
'/* v0.2.58.16 活动页真实数据接入：空态/离线态/平趋势（inliner 管区外页面专属） */\n' +
'.act-empty { padding: var(--space-md); text-align: center; font-size: 13px; color: var(--color-outline); border: 1px dashed rgba(118,117,134,0.25); border-radius: 10px; }\n' +
'.kpi-trend.flat { color: var(--color-outline); }\n' +
'.act-offline { padding: var(--space-md); border: 1px dashed rgba(118,117,134,0.3); border-radius: 10px; text-align: center; }\n' +
'.act-offline b { display: block; margin-bottom: 4px; }\n' +
'</style>\n</head>';
if (s.split(A4).length - 1 !== 1) throw new Error('anchor A4 count != 1');
s = s.replace(A4, B4);

// ⑤ IIFE 整体替换（subnav.js 与 transitions.js 之间）
const SUBNAV = '<script src="../assets/js/subnav.js"></script>';
const TRANS = '<script src="../assets/js/transitions.js"></script>';
const i = s.indexOf(SUBNAV);
const j = s.indexOf(TRANS, i);
if (i < 0 || j < 0) throw new Error('IIFE splice anchors not found');
s = s.slice(0, i) + SUBNAV + '\n<script>\n' + IIFE.replace(/\r\n/g, '\n') + '\n</script>\n' + s.slice(j);

fs.writeFileSync(PAGE, s.replace(/\n/g, '\r\n'));
console.log('activity.html 前端应用完成；新旧长度差', s.length - orig.length, 'chars');
console.log('api.js ×', s.split('assets/js/api.js').length - 1,
  '| activitySearch ×', s.split('id="activitySearch"').length - 1,
  '| contentTypes ×', s.split('activity.chart.contentTypes').length - 1,
  '| act-empty ×', s.split('act-empty').length - 1,
  '| MN_API.get ×', s.split("MN_API.get('/public/activity").length - 1);
