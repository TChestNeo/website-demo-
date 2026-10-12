const fs = require('fs');
const h = fs.readFileSync('C:/Users/USER/Documents/stitch_slatiworld_micronation_interface/docs/story/wip.html', 'utf8');
const j = JSON.parse(fs.readFileSync('C:/Users/USER/Documents/stitch_slatiworld_micronation_interface/docs/story/story-texts.json', 'utf8'));
const keys = Object.keys(j);
// 页面里全部 data-scene
const scenes = [...h.matchAll(/data-scene="([^"]+)"/g)].map(m => m[1]);
const unique = [...new Set(scenes)];
console.log('页面场景数(唯一):', unique.length, unique.join(', '));
const missing = unique.filter(s => !keys.some(k => k.indexOf(s + '.') === 0));
console.log('无键场景:', missing.join(', ') || '（无）');
// 各场景键数
for (const s of unique) {
  const n = keys.filter(k => k.indexOf(s + '.') === 0).length;
  console.log(s, '→', n, '键');
}
