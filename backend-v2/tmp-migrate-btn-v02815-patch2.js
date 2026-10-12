// tmp-migrate-btn-v02815-patch2.js — 高度对齐修正：邻居 .btn-outline 含 1px 边框=38px，
// migrate 无边框 36px → span 上下垫 6px→7px（38px 等值对齐）
'use strict';
const fs = require('fs');
const f = 'C:/Users/USER/Downloads/stitch_slatiworld_micronation_interface/docs/pages/fluidcanvas-editor.html';
let s = fs.readFileSync(f, 'utf8');
const nl = s.indexOf('\r\n') !== -1 ? '\r\n' : '\n';

const oldC = '   高度 36px 与邻居一致）；②改药丸形（border-radius: var(--radius-full)，与邻居 .btn 同）；';
const newC = '   高度 38px 与邻居一致——邻钮 .btn-outline 含 1px 边框 38px，migrate 无边框用 7px 上下垫等值对齐）；' + nl +
  '   ②改药丸形（border-radius: var(--radius-full)，与邻居 .btn 同）；';
const oldP = "  padding: 6px 16px;              /* 对齐 .btn-sm */";
const newP = "  padding: 7px 16px;              /* 对齐 .btn-sm（邻钮 1px 边框=38px，7px 垫等值对齐） */";

if (s.split(oldC).length !== 2) { console.log('❌ oldC count wrong'); process.exit(1); }
if (s.split(oldP).length !== 2) { console.log('❌ oldP count wrong'); process.exit(1); }
s = s.replace(oldC, newC).replace(oldP, newP);
fs.writeFileSync(f, s);
console.log('✅ 高度对齐修正（span 7px 垫 → 38px）');
