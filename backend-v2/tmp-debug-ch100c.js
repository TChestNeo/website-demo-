const fs = require('fs');
const h = fs.readFileSync(process.env.TEMP + '/wip-orig.html', 'utf8');
const sceneRe = /<section[^>]*data-scene="([^"]+)"[^>]*>([\s\S]*?)(?=<section|\n\s*<\/main>)/g;
let m;
while ((m = sceneRe.exec(h))) {
  if (m[1] !== 'ch1-00') continue;
  const block = m[2];
  const kicker = /<p class="scene-kicker"[^>]*>([\s\S]*?)<\/p>/.exec(block);
  const title = /<h[12] class="scene-title"[^>]*>([\s\S]*?)<\/h[12]>/.exec(block);
  const narr = /<div class="narration"[^>]*>([\s\S]*?)<\/div>/.exec(block);
  console.log('kicker:', kicker ? JSON.stringify(kicker[1].trim()) : 'NO');
  console.log('title:', title ? JSON.stringify(title[1].trim()) : 'NO');
  console.log('narr:', narr ? 'YES' : 'NO');
  if (narr) {
    const lineRe = /<p class="line">([\s\S]*?)<\/p>/g;
    let lm, i = 0;
    while ((lm = lineRe.exec(narr[1]))) { i++; console.log('line' + i + ':', JSON.stringify(lm[1].trim()).slice(0, 60)); }
    console.log('lines:', i);
  }
  break;
}
