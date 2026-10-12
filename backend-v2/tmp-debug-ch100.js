const fs = require('fs');
const h = fs.readFileSync('C:/Users/USER/Documents/stitch_slatiworld_micronation_interface/docs/story/wip.html', 'utf8');
const re = /<section[^>]*data-scene="([^"]+)"[^>]*>([\s\S]*?)(?=<section|\n\s*<\/main>)/g;
let m;
while ((m = re.exec(h))) {
  if (m[1].indexOf('ch1') !== 0) continue;
  const n = /<div class="narration[^"]*"[^>]*>([\s\S]*?)<\/div>/.exec(m[2]);
  const n2 = /<div class="narration"/.exec(m[2]);
  console.log(m[1], '| narration match:', n ? 'YES' : 'NO', '| div found:', n2 ? 'YES' : 'NO',
    n ? '| lines=' + [...n[1].matchAll(/<p class="line">/g)].length : '');
  if (!n && n2) {
    const i = m[2].indexOf('<div class="narration');
    console.log('  → 原始片段:', JSON.stringify(m[2].slice(i, i + 90)));
  }
}
