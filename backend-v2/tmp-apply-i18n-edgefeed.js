// tmp-apply-i18n-edgefeed.js — v10.28.51.1 AI 弹窗正向反馈 5 新键同位插入
//   fc.edge.genFail（生成失败）/ genIdle（AI 空闲）/ genOk（生成成功）/
//   genThinking（AI 思考中）/ genThinkingHint（正在生成，通常需要几秒钟）
// 11 手写块（zh/en/de/ru/ms/th/vi/id/fr/es/pt）同位插入；zh-Hant 自动段
// 由 tmp-i18n-hant.js OpenCC cn→tw 重生成（本脚本先剥离，勿手写 zh-Hant）。
'use strict';
const fs = require('fs');
const path = require('path');
const FILE = path.resolve(__dirname, '..', 'docs', 'assets', 'i18n', 'fluidcanvas.i18n.js');
const SENTINEL = '/* __ZH_HANT_AUTO__';

const VALS = {
  zh: ['生成失败', 'AI 空闲', '生成成功', 'AI 思考中', '正在生成，通常需要几秒钟'],
  en: ['Generation failed', 'AI idle', 'Generated', 'AI thinking', 'Generating, usually takes a few seconds'],
  de: ['Generierung fehlgeschlagen', 'KI bereit', 'Generiert', 'KI denkt nach', 'Wird generiert, dauert meist einige Sekunden'],
  ru: ['Не удалось сгенерировать', 'ИИ готов', 'Сгенерировано', 'ИИ думает', 'Генерация, обычно занимает несколько секунд'],
  ms: ['Penjanaan gagal', 'AI sedia', 'Berjaya dijana', 'AI berfikir', 'Sedang menjana, biasanya mengambil masa beberapa saat'],
  th: ['สร้างไม่สำเร็จ', 'AI พร้อม', 'สร้างสำเร็จ', 'AI กำลังคิด', 'กำลังสร้าง ใช้เวลาปกติไม่กี่วินาที'],
  vi: ['Tạo thất bại', 'AI sẵn sàng', 'Tạo thành công', 'AI đang suy nghĩ', 'Đang tạo, thường mất vài giây'],
  id: ['Gagal dibuat', 'AI siap', 'Berhasil dibuat', 'AI sedang berpikir', 'Sedang membuat, biasanya butuh beberapa detik'],
  fr: ['Échec de la génération', 'IA prête', 'Généré', "L'IA réfléchit", 'Génération en cours, quelques secondes en général'],
  es: ['Fallo al generar', 'IA lista', 'Generado', 'IA pensando', 'Generando, normalmente tarda unos segundos'],
  pt: ['Falha ao gerar', 'IA pronta', 'Gerado', 'IA a pensar', 'A gerar, normalmente demora alguns segundos']
};
const addRe = /MN_I18N\.add\('([^']+)'/;
const keyOf = (line) => {
  const m = /"((?:fc|common|nav|page|settings|article|premium|msg)[^"]+)":/.exec(line);
  return m ? m[1] : null;
};
const indentOf = (line) => (line.match(/^\s*/) || [''])[0];
const mkLine = (indent, key, val) => `${indent}"${key}": ${JSON.stringify(val)},\n`;

let src = fs.readFileSync(FILE, 'utf8');
const i = src.indexOf(SENTINEL);
if (i !== -1) src = src.slice(0, i).replace(/\s+$/, '') + '\n'; // 剥离旧自动段（幂等；hant 脚本会重生成）

const lines = src.split('\n');
const out = [];
let cur = null;
let zh = 0, inserted = 0;
for (let li = 0; li < lines.length; li++) {
  const line = lines[li];
  const am = addRe.exec(line);
  if (am) { cur = am[1]; out.push(line); continue; }
  if (line.trim() === '});') cur = null; // 块尾
  const k = keyOf(line);
  const vals = (cur && VALS[cur]) ? VALS[cur] : null;
  if (vals) {
    if (k === 'fc.edge.genFailed') {
      out.push(mkLine(indentOf(line), 'fc.edge.genFail', vals[0])); // 前插
      out.push(line);
      out.push(mkLine(indentOf(line), 'fc.edge.genIdle', vals[1])); // 后插
      inserted += 2; if (cur === 'zh') zh += 2;
      continue;
    }
    if (k === 'fc.edge.genNeedInput') {
      out.push(line);
      out.push(mkLine(indentOf(line), 'fc.edge.genOk', vals[2]));
      inserted++; if (cur === 'zh') zh++;
      continue;
    }
    if (k === 'fc.edge.genSave') {
      out.push(line);
      out.push(mkLine(indentOf(line), 'fc.edge.genThinking', vals[3]));
      out.push(mkLine(indentOf(line), 'fc.edge.genThinkingHint', vals[4]));
      inserted += 2; if (cur === 'zh') zh += 2;
      continue;
    }
  }
  out.push(line);
}
if (inserted !== 11 * 5) { console.error('❌ 插入数异常: ' + inserted + ' 应 ' + (11 * 5)); process.exit(1); }
fs.writeFileSync(FILE, out.join('\n'));
console.log('✅ 11 块 ×5 键 = ' + inserted + ' 键（zh 块 ' + zh + '）');
