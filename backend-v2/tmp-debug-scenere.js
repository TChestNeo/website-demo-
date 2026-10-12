const fs = require('fs');
const h = fs.readFileSync(process.env.TEMP + '/wip-orig.html', 'utf8');
const re = /<section[^>]*data-scene="([^"]+)"[^>]*>([\s\S]*?)(?=<section|\n\s*<\/main>)/g;
let m;
const seen = [];
while ((m = re.exec(h))) seen.push(m[1]);
console.log('sceneRe 匹配数:', seen.length);
console.log('前 6:', seen.slice(0, 6).join(', '));
console.log('含 ch1-00:', seen.includes('ch1-00'));
// 若缺失：home-01 的内容到底怎么被切的
const i = h.indexOf('data-scene="home-01"');
console.log('home-01 起:', JSON.stringify(h.slice(i - 40, i + 60)));
