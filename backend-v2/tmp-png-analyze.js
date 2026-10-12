// tmp-png-analyze.js — 像素级分析截图（本机截图已恢复但 Read 工具不吃图 → 自解 PNG）
// 用法：node tmp-png-analyze.js <file> <x> <y> <w> <h> [thr]
//   输出：区域 ASCII 亮度图（. = 暗, # = 亮, 分级）+ 亮块包围盒清单（近白像素连通块）
'use strict';
const fs = require('fs');
const zlib = require('zlib');

function paeth(a, b, c) {
  const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
}

function decodePNG(file) {
  const buf = fs.readFileSync(file);
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('非 PNG');
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
  const bitDepth = buf[24], colorType = buf[25];
  if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6)) throw new Error('仅支持 8bit RGB/RGBA，实际 type=' + colorType);
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

const file = process.argv[2];
const x0 = parseInt(process.argv[3] || '0', 10);
const y0 = parseInt(process.argv[4] || '0', 10);
const w0 = parseInt(process.argv[5] || '0', 10);
const h0 = parseInt(process.argv[6] || '0', 10);
const THR = parseInt(process.argv[7] || '150', 10);

const { w, h, px } = decodePNG(file);
const X = Math.max(0, x0), Y = Math.max(0, y0);
const W = Math.min(w - X, w0 > 0 ? w0 : w - X);
const H = Math.min(h - Y, h0 > 0 ? h0 : h - Y);
console.log('# ' + file + ' 全图 ' + w + 'x' + h + '  区域 x=' + X + ' y=' + Y + ' w=' + W + ' h=' + H + '  阈值 ' + THR);

const at = (x, y) => {
  const i = ((Y + y) * w + (X + x)) * 3;
  return [px[i], px[i + 1], px[i + 2]];
};

// 1) ASCII 亮度图（每 2x2 像素一格）
const chars = [' ', '.', ':', '-', '=', '+', '*', '#', '%', '@'];
console.log('── ASCII 亮度图（' + W + 'x' + H + '，2px/格）──');
for (let y = 0; y < H; y += 2) {
  let line = '';
  for (let x = 0; x < W; x += 2) {
    const [r, g, b] = at(Math.min(x, W - 1), Math.min(y, H - 1));
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    line += chars[Math.min(9, Math.floor(l / 25.6))];
  }
  console.log(line);
}

// 2) 近白连通块（BFS，全阈值内像素）
const white = (r, g, b) => r > THR && g > THR && b > THR;
const visited = new Uint8Array(W * H);
const blocks = [];
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const idx = y * W + x;
    if (visited[idx]) continue;
    const [r, g, b] = at(x, y);
    if (!white(r, g, b)) continue;
    // BFS
    let minX = x, maxX = x, minY = y, maxY = y, n = 0, rSum = 0, gSum = 0, bSum = 0;
    const q = [[x, y]];
    visited[idx] = 1;
    while (q.length) {
      const [cx, cy] = q.pop();
      n++; rSum += at(cx, cy)[0]; gSum += at(cx, cy)[1]; bSum += at(cx, cy)[2];
      if (cx < minX) minX = cx; if (cx > maxX) maxX = cx;
      if (cy < minY) minY = cy; if (cy > maxY) maxY = cy;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const ni = ny * W + nx;
        if (visited[ni]) continue;
        const [nr, ng, nb] = at(nx, ny);
        if (white(nr, ng, nb)) { visited[ni] = 1; q.push([nx, ny]); }
      }
    }
    if (n >= 3) blocks.push({ abs: [X + minX, Y + minY, X + maxX, Y + maxY], n, avg: [Math.round(rSum / n), Math.round(gSum / n), Math.round(bSum / n)] });
  }
}
blocks.sort((a, b) => b.n - a.n);
console.log('── 近白连通块（r,g,b > ' + THR + '，≥3px）共 ' + blocks.length + ' 个 ──');
blocks.forEach(b => console.log('   块 x=' + b.abs[0] + '..' + b.abs[2] + ' y=' + b.abs[1] + '..' + b.abs[3] + '  (' + (b.abs[2] - b.abs[0] + 1) + 'x' + (b.abs[3] - b.abs[1] + 1) + 'px, ' + b.n + 'px)  均色 rgb(' + b.avg.join(',') + ')'));
