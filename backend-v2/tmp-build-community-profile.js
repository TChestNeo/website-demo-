// 一次性构建脚本：community-profile.html = hub 头部（拆地雷后的纯 ethereal 标记块 + 字体块）+ 个人主页尾部
// 复用 hub 头部保证：主题防闪内联、ethereal 内联标记块（inliner 安全）、本地段、@font-face 全部同源。
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const hub = fs.readFileSync(path.join(root, 'docs/pages/community-hub.html'), 'utf8');
const headEnd = hub.indexOf('</head>');
if (headEnd === -1) throw new Error('hub 无 </head>');
let head = hub.slice(0, headEnd);
if (!head.includes('<title>Community Hub | M.NationWorld</title>')) throw new Error('hub 标题锚点丢失');
head = head.replace('<title>Community Hub | M.NationWorld</title>', '<title>Profile | M.NationWorld</title>');
const tail = fs.readFileSync(path.join(__dirname, 'tmp-community-profile-tail.html'), 'utf8');
fs.writeFileSync(path.join(root, 'docs/pages/community-profile.html'), head + tail);
console.log('community-profile.html built:', (head + tail).length, 'chars, head chars:', head.length);
