'use strict';
// tmp-view-png.js — 本机图片管线坏（Read 图全 Unsupported），PNG 自解码转字符画「看」截图（tmp 绝不 commit）
// 用法：node tmp-view-png.js <png路径> [每字符像素宽] [区域 x,y,w,h]
const fs = require('node:fs');
const zlib = require('node:zlib');

const file = process.argv[2];
const CW = parseInt(process.argv[3] || '0', 10); // 0 = 自动（宽 ~100 字符）
let crop = null;
if (process.argv[4]) {
  const [x, y, w, h] = process.argv[4].split(',').map(Number);
  crop = { x, y, w, h };
}
const buf = fs.readFileSync(file);
if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not png');
let pos = 8, width = 0, height = 0, bitDepth = 0, colorType = 0, interlace = 0;
const idat = [];
while (pos < buf.length) {
  const len = buf.readUInt32BE(pos);
  const type = buf.toString('ascii', pos + 4, pos + 8);
  const data = buf.subarray(pos + 8, pos + 8 + len);
  if (type === 'IHDR') {
    width = data.readUInt32BE(0); height = data.readUInt32BE(4);
    bitDepth = data[8]; colorType = data[9]; interlace = data[12];
  } else if (type === 'IDAT') idat.push(data);
  else if (type === 'IEND') break;
  pos += 12 + len;
}
if (interlace) throw new Error('interlaced png unsupported');
const channels = { 0: 1, 2: 3, 6: 4 }[colorType];
if (!channels || bitDepth !== 8) throw new Error(`colorType=${colorType} bitDepth=${bitDepth} unsupported`);
const raw = zlib.inflateSync(Buffer.concat(idat));
const stride = width * channels;
const px = Buffer.alloc(height * stride);
const bpp = channels;
for (let y = 0; y < height; y++) {
  const f = raw[y * (stride + 1)];
  const src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
  const out = px.subarray(y * stride, (y + 1) * stride);
  for (let x = 0; x < stride; x++) {
    const a = x >= bpp ? out[x - bpp] : 0;
    const b = y > 0 ? px[(y - 1) * stride + x] : 0;
    const c = y > 0 && x >= bpp ? px[(y - 1) * stride + x - bpp] : 0;
    let v = src[x];
    if (f === 1) v = (v + a) & 0xff;
    else if (f === 2) v = (v + b) & 0xff;
    else if (f === 3) v = (v + ((a + b) >> 1)) & 0xff;
    else if (f === 4) {
      const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      v = (v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 0xff;
    }
    out[x] = v;
  }
}
console.log(`# ${file} ${width}x${height} colorType=${colorType}`);
if (!crop) crop = { x: 0, y: 0, w: width, h: height };
const SCALE = CW < 0 ? -CW : 1; // CW=-2: 每像素 2×2 字符（放大读字模式）
const cw = CW < 0 ? 1 : (CW || Math.max(4, Math.ceil(crop.w / 100)));
const ch = SCALE > 1 ? 1 : (CW === 1 ? 1 : cw * 2);
function bucket(r, g, b) {
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  if (b > r + 25 && b > g + 10 && lum > 40) return 'B';
  if (r > g + 25 && r > b + 25 && lum > 40) return 'R';
  if (g > r + 25 && g > b + 25 && lum > 40) return 'G';
  if (r > 180 && g > 130 && b < 120) return 'Y';
  if (lum < 10) return ' ';
  if (lum < 22) return '.';
  if (lum < 42) return ':';
  if (lum < 70) return '+';
  if (lum < 105) return 'o';
  if (lum < 145) return '*';
  if (lum < 185) return '=';
  if (lum < 220) return '#';
  return '@';
}
for (let cy = 0; cy * ch < crop.h; cy++) {
  let row = '';
  for (let cx = 0; cx * cw < crop.w; cx++) {
    let r = 0, g = 0, b = 0, n = 0;
    const step = (CW === 1 || SCALE > 1) ? 1 : 2;
    for (let dy = 0; dy < ch && crop.y + cy * ch + dy < height; dy += step) {
      for (let dx = 0; dx < cw && crop.x + cx * cw + dx < width; dx += step) {
        const i = ((crop.y + cy * ch + dy) * stride) + (crop.x + cx * cw + dx) * channels;
        r += px[i]; g += px[i + 1]; b += px[i + 2]; n++;
      }
    }
    row += bucket(r / n, g / n, b / n).repeat(SCALE);
  }
  for (let k = 0; k < SCALE; k++) console.log(row);
}
