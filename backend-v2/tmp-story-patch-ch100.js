// tmp-story-patch-ch100.js — 补 ch1-00 五个缺失键（清单/页面/已完成的词典）
'use strict';
const fs = require('fs');
const path = require('path');
const STORY = path.resolve(__dirname, '..', 'docs', 'story');

const ADD = {
  'ch1-00.kicker': '第一章 · 什么是政治',
  'ch1-00.title': '什么是政治',
  'ch1-00.l1': '这一章，你将住进一座大房子，围观一场关于洗澡和扫地的商量。',
  'ch1-00.l2': '你会看见：约定如何变成规则，规则如何长出权力。',
  'ch1-00.l3': '最后，我们用一句话回答：什么是政治。'
};

// 1. story-texts.json：插到 ch1-01.kicker 之前
const jp = path.join(STORY, 'story-texts.json');
const j = JSON.parse(fs.readFileSync(jp, 'utf8'));
const out = {};
for (const k in j) {
  if (k === 'ch1-01.kicker') {
    for (const ak in ADD) out[ak] = ADD[ak];
  }
  out[k] = j[k];
}
fs.writeFileSync(jp, JSON.stringify(out, null, 2));
console.log('清单键数:', Object.keys(out).length);

// 2. wip.html：五个元素挂 data-i18n
const wp = path.join(STORY, 'wip.html');
let h = fs.readFileSync(wp, 'utf8');
h = h.replace('<p class="scene-kicker ms-kicker">第一章 · 什么是政治</p>',
  '<p class="scene-kicker ms-kicker" data-i18n="ch1-00.kicker">第一章 · 什么是政治</p>');
h = h.replace('<h1 class="scene-title ms-caption">什么是政治</h1>',
  '<h1 class="scene-title ms-caption" data-i18n="ch1-00.title">什么是政治</h1>');
h = h.replace('<p class="line">这一章，你将住进一座大房子，围观一场关于洗澡和扫地的商量。</p>',
  '<p class="line" data-i18n-html="ch1-00.l1">这一章，你将住进一座大房子，围观一场关于洗澡和扫地的商量。</p>');
h = h.replace('<p class="line">你会看见：约定如何变成规则，规则如何长出权力。</p>',
  '<p class="line" data-i18n-html="ch1-00.l2">你会看见：约定如何变成规则，规则如何长出权力。</p>');
h = h.replace('<p class="line">最后，我们用一句话回答：什么是政治。</p>',
  '<p class="line" data-i18n-html="ch1-00.l3">最后，我们用一句话回答：什么是政治。</p>');
fs.writeFileSync(wp, h);
console.log('页面残留无键 .line:', (h.match(/<p class="line">/g) || []).length);

// 3. 已完成的词典补键（插到 ch1-01.kicker 前）
const TRANS = {
  en: {
    'ch1-00.kicker': 'Chapter One · What Is Politics',
    'ch1-00.title': 'What Is Politics',
    'ch1-00.l1': 'In this chapter, you will move into a big house and watch a discussion about showers and sweeping.',
    'ch1-00.l2': 'You will see how agreements become rules, and how rules grow into power.',
    'ch1-00.l3': 'In the end, we answer the question in a single sentence: what is politics?'
  },
  de: {
    'ch1-00.kicker': 'Kapitel Eins · Was ist Politik',
    'ch1-00.title': 'Was ist Politik',
    'ch1-00.l1': 'In diesem Kapitel ziehst du in ein großes Haus ein und schaust einer Absprache über Duschen und Fegen zu.',
    'ch1-00.l2': 'Du wirst sehen, wie aus Absprachen Regeln werden und aus Regeln Macht wächst.',
    'ch1-00.l3': 'Am Ende beantworten wir die Frage in einem Satz: Was ist Politik?'
  },
  ru: {
    'ch1-00.kicker': 'Глава первая · Что такое политика',
    'ch1-00.title': 'Что такое политика',
    'ch1-00.l1': 'В этой главе ты поселишься в большом доме и понаблюдаешь за обсуждением того, кому мыться, а кому подметать.',
    'ch1-00.l2': 'Ты увидишь, как договорённости становятся правилами, а правила порождают власть.',
    'ch1-00.l3': 'В конце мы ответим на вопрос одной фразой: что такое политика?'
  },
  ms: {
    'ch1-00.kicker': 'Bab Satu · Apa Itu Politik',
    'ch1-00.title': 'Apa Itu Politik',
    'ch1-00.l1': 'Dalam bab ini, kamu akan tinggal di sebuah rumah besar dan menyaksikan satu perbincangan tentang mandi dan menyapu.',
    'ch1-00.l2': 'Kamu akan melihat bagaimana persetujuan menjadi peraturan, dan peraturan melahirkan kuasa.',
    'ch1-00.l3': 'Akhirnya, kita jawab dalam satu ayat: apa itu politik?'
  },
  th: {
    'ch1-00.kicker': 'บทที่หนึ่ง · การเมืองคืออะไร',
    'ch1-00.title': 'การเมืองคืออะไร',
    'ch1-00.l1': 'ในบทนี้ คุณจะย้ายเข้าไปอยู่ในบ้านหลังใหญ่ และเฝ้าดูการพูดคุยกันเรื่องการอาบน้ำและการกวาดบ้าน',
    'ch1-00.l2': 'คุณจะได้เห็นว่าข้อตกลงกลายเป็นกฎได้อย่างไร และกฎงอกเงยอำนาจขึ้นมาได้อย่างไร',
    'ch1-00.l3': 'สุดท้าย เราตอบคำถามด้วยประโยคเดียว: การเมืองคืออะไร'
  },
  vi: {
    'ch1-00.kicker': 'Chương Một · Chính trị là gì',
    'ch1-00.title': 'Chính trị là gì',
    'ch1-00.l1': 'Trong chương này, bạn sẽ dọn vào một ngôi nhà lớn và chứng kiến cuộc bàn bạc về việc tắm rửa và quét dọn.',
    'ch1-00.l2': 'Bạn sẽ thấy: thỏa thuận biến thành quy tắc thế nào, và quy tắc nảy sinh quyền lực ra sao.',
    'ch1-00.l3': 'Cuối cùng, chúng ta trả lời bằng một câu: chính trị là gì?'
  },
  id: {
    'ch1-00.kicker': 'Bab Satu · Apa Itu Politik',
    'ch1-00.title': 'Apa Itu Politik',
    'ch1-00.l1': 'Dalam bab ini, kamu akan tinggal di sebuah rumah besar dan menyaksikan perbincangan tentang mandi dan menyapu.',
    'ch1-00.l2': 'Kamu akan melihat bagaimana kesepakatan menjadi aturan, dan aturan menumbuhkan kekuasaan.',
    'ch1-00.l3': 'Pada akhirnya, kita menjawab dalam satu kalimat: apa itu politik?'
  },
  fr: {
    'ch1-00.kicker': 'Chapitre un · Qu\u2019est-ce que la politique',
    'ch1-00.title': 'Qu\u2019est-ce que la politique',
    'ch1-00.l1': 'Dans ce chapitre, vous emménagez dans une grande maison et assistez à une discussion sur la douche et le balai.',
    'ch1-00.l2': 'Vous verrez comment les accords deviennent des règles, et comment les règles font naître le pouvoir.',
    'ch1-00.l3': 'À la fin, nous répondons en une phrase : qu\u2019est-ce que la politique ?'
  }
};

for (const l in TRANS) {
  const f = path.join(STORY, 'i18n', 'story-' + l + '.js');
  if (!fs.existsSync(f)) { console.log('[' + l + '] 词典不存在（可能仍在翻译）'); continue; }
  let code = fs.readFileSync(f, 'utf8');
  const anchor = '"ch1-01.kicker"';
  const i = code.indexOf(anchor);
  if (i === -1) { console.log('[' + l + '] 锚点缺失，跳过'); continue; }
  let insert = '';
  for (const ak in ADD) insert += '  "' + ak + '": ' + JSON.stringify(TRANS[l][ak]) + ',\n';
  code = code.slice(0, i) + insert + code.slice(i);
  fs.writeFileSync(f, code);
  console.log('[' + l + '] 已补 5 键');
}
