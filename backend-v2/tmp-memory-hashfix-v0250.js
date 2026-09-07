// v0.2.25.0 收尾修正：memory 三文件里的 H1 hash（97bdb72）→ amend 后最终 hash（8579df1）
const fs = require('fs');
const MEM = 'C:/Users/USER/.claude/projects/c--Users-USER-Downloads-stitch-slatiworld-micronation-interface/memory/';
for (const f of ['backend-build-state.md', 'site-versioning-scheme.md', 'MEMORY.md']) {
  const p = MEM + f;
  const s = fs.readFileSync(p, 'utf8');
  const n = s.split('97bdb72').length - 1;
  if (n !== 1) throw new Error(f + ' hash count=' + n);
  fs.writeFileSync(p, s.replace('97bdb72', '8579df1'), 'utf8');
  console.log('fixed', f);
}
console.log('OK hashfix');
