// tmp-rgb-scan.js — 截图定点/扫描线 RGB 采样（色散/彩色边缘实证用；tmp-png-analyze 只看亮度）
// 用法：node tmp-rgb-scan.js <file> <x1>,<y1>[,<x2>,<y2>...]  点采样：每个坐标打印 RGB
//       node tmp-rgb-scan.js <file> row <y> <x1> <x2>         行扫描：x1..x2 每像素 RGB（变化处折叠）
'use strict';
const fs = require('fs');
const zlib = require('zlib');

function paeth(a, b, c) {
  const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
}
function decodePNG(file) {
  const buf = fs.readFileSync(file);
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
  const colorType = buf[25];
  const bpp = colorType === 6 ? 4 : 3;
  let off = 8, idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    if (type === 'IDAT') idat.push(buf.slice(off + 8, off + 8 + len));
    off += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * bpp;
  const px = Buffer.alloc(w * h * 3);
  let prev = Buffer.alloc(stride), pos = 0;
  for (let y = 0; y < h; y++) {
    const f = raw[pos++];
    const row = raw.slice(pos, pos + stride); pos += stride;
    const cur = Buffer.alloc(stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0;
      const b = prev[i];
      const c = i >= bpp ? prev[i - bpp] : 0;
      let v = row[i];
      if (f === 1) v = (v + a) & 255;
      else if (f === 2) v = (v + b) & 255;
      else if (f === 3) v = (v + ((a + b) >> 1)) & 255;
      else if (f === 4) v = (v + paeth(a, b, c)) & 255;
      cur[i] = v;
    }
    for (let x = 0; x < w; x++) {
      px[(y * w + x) * 3] = cur[x * bpp];
      px[(y * w + x) * 3 + 1] = cur[x * bpp + 1];
      px[(y * w + x) * 3 + 2] = cur[x * bpp + 2];
    }
    prev = cur;
  }
  return { w, h, px };
}
const { w, h, px } = decodePNG(process.argv[2]);
const rgb = (x, y) => { const i = (y * w + x) * 3; return [px[i], px[i + 1], px[i + 2]]; };
const near = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) < 12;

if (process.argv[3] === 'row') {
  const y = parseInt(process.argv[4], 10), x1 = parseInt(process.argv[5], 10), x2 = parseInt(process.argv[6], 10);
  console.log('# ' + process.argv[2] + '  行 y=' + y + ' x=' + x1 + '..' + x2);
  let runs = [], cur = null;
  for (let x = x1; x <= x2; x++) {
    const c = rgb(x, y);
    if (cur && near(cur.c, c)) { cur.end = x; }
    else { cur = { c: c, start: x, end: x }; runs.push(cur); }
  }
  runs.forEach(r => console.log('  x=' + r.start + '..' + r.end + '  rgb(' + r.c.join(',') + ')'));
} else {
  console.log('# ' + process.argv[2] + '  定点采样');
  for (const spec of process.argv.slice(3)) {
    const [x, y] = spec.split(',').map(Number);
    const c = rgb(x, y);
    console.log('  (' + x + ',' + y + ')  rgb(' + c.join(',') + ')  亮度=' + Math.round(0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]));
  }
}
