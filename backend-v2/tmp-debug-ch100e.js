const fs = require('fs');
const cur = fs.readFileSync('C:/Users/USER/Documents/stitch_slatiworld_micronation_interface/docs/story/wip.html', 'utf8');
const i = cur.indexOf('data-scene="ch1-00"');
const j = cur.indexOf('<section', i + 5);
const block = cur.slice(i, j > i ? j : i + 1500);
console.log('当前文件 ch1-00 段(前 500):', JSON.stringify(block.slice(0, 500)));
console.log('kicker 正则:', /<p class="scene-kicker"[^>]*>([\s\S]*?)<\/p>/.test(block));
console.log('title 正则:', /<h[12] class="scene-title"[^>]*>([\s\S]*?)<\/h[12]>/.test(block));
console.log('narr 正则:', /<div class="narration"[^>]*>([\s\S]*?)<\/div>/.test(block));
