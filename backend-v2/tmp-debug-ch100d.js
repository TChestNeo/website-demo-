const fs = require('fs');
const h = fs.readFileSync(process.env.TEMP + '/wip-orig.html', 'utf8');
const sceneRe = /<section[^>]*data-scene="([^"]+)"[^>]*>([\s\S]*?)(?=<section|\n\s*<\/main>)/g;
let m;
while ((m = sceneRe.exec(h))) {
  if (m[1] !== 'ch1-00') continue;
  console.log('block 长度:', m[2].length);
  console.log('block 内容:', JSON.stringify(m[2].slice(0, 200)));
  break;
}
