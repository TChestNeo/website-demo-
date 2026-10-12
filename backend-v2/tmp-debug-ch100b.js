const fs = require('fs');
const j = JSON.parse(fs.readFileSync('C:/Users/USER/Documents/stitch_slatiworld_micronation_interface/docs/story/story-texts.json', 'utf8'));
const keys = Object.keys(j);
console.log('前 12 个键:', keys.slice(0, 12).join(', '));
console.log('含 ms/caption/kicker 第一章的键:', keys.filter(k => k.indexOf('ch1-0') === 0).slice(0, 8).join(', ') || '（无）');
// 在改写后的页面找 ch1-00 段与 home-01 段的原始结构
const h = fs.readFileSync('C:/Users/USER/Documents/stitch_slatiworld_micronation_interface/docs/story/wip.html', 'utf8');
const i = h.indexOf('data-scene="ch1-00"');
console.log('页面 ch1-00 片段:', JSON.stringify(h.slice(Math.max(0, i - 60), i + 300)).slice(0, 420));
