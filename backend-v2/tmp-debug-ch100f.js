const fs = require('fs');
const cur = fs.readFileSync('C:/Users/USER/Documents/stitch_slatiworld_micronation_interface/docs/story/wip.html', 'utf8');
const i = cur.indexOf('data-scene="ch1-00"');
const j = cur.indexOf('<section', i + 5);
const block = cur.slice(i, j > i ? j : i + 1500);
console.log('1 /scene-kicker/:', /scene-kicker/.test(block));
console.log('2 /<p class="scene-kicker"/:', /<p class="scene-kicker"/.test(block));
console.log('3 /<p class="scene-kicker"[^>]*>/:', /<p class="scene-kicker"[^>]*>/.test(block));
console.log('4 完整 kicker:', /<p class="scene-kicker"[^>]*>([\s\S]*?)<\/p>/.test(block));
// 逐字符 hex 看 kicker 标签附近
const k = block.indexOf('scene-kicker');
console.log('kicker 标签 hex:', Buffer.from(block.slice(k - 2, k + 40), 'utf8').toString('hex'));
console.log('kicker 标签原文:', JSON.stringify(block.slice(k - 2, k + 40)));
// 找一个成功案例对比
const i2 = cur.indexOf('data-scene="ch1-01"');
const j2 = cur.indexOf('<section', i2 + 5);
const block2 = cur.slice(i2, j2 > i2 ? j2 : i2 + 1500);
console.log('ch1-01 kicker 正则:', /<p class="scene-kicker"[^>]*>([\s\S]*?)<\/p>/.test(block2));
