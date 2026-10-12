// tmp-i18n-crop-insert.js — v0.2.58.25：向 common.i18n.js（crop.* ×6 + settings.profile.reCrop* ×2）与
// community-profile.i18n.js（prof.edit.reCrop* ×2）各 11 语言主块插入新键；zh-Hant 由 tmp-i18n-hant.js 重生成。
// 幂等：已含 'crop.titleAvatar' 的行跳过不重复插入。en 值=代码兜底串逐字节一致。
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

const COMMON_KEYS = {
  zh: ['裁切头像', '裁切横幅', '拖拽移动 · 滚轮缩放', '确认', '取消', '图片加载失败，请稍后再试', '重新裁切', '重新裁切'],
  en: ['Crop avatar', 'Crop banner', 'Drag to move · scroll to zoom', 'Apply', 'Cancel', 'Failed to load image, please try again', 'Re-crop avatar', 'Re-crop banner'],
  de: ['Avatar zuschneiden', 'Banner zuschneiden', 'Ziehen zum Verschieben · Scrollen zum Zoomen', 'Anwenden', 'Abbrechen', 'Bild konnte nicht geladen werden, bitte später erneut versuchen', 'Erneut zuschneiden', 'Erneut zuschneiden'],
  ru: ['Обрезать аватар', 'Обрезать баннер', 'Перетащите, чтобы переместить · прокрутите для масштаба', 'Применить', 'Отмена', 'Не удалось загрузить изображение, попробуйте позже', 'Обрезать заново', 'Обрезать заново'],
  ms: ['Potong avatar', 'Potong sepanduk', 'Seret untuk alih · skrol untuk zum', 'Guna', 'Batal', 'Imej gagal dimuat, sila cuba sebentar lagi', 'Potong semula', 'Potong semula'],
  th: ['ครอปรูปโปรไฟล์', 'ครอปแบนเนอร์', 'ลากเพื่อเลื่อน · เลื่อนเพื่อซูม', 'นำไปใช้', 'ยกเลิก', 'โหลดรูปไม่สำเร็จ โปรดลองอีกครั้ง', 'ครอปใหม่', 'ครอปใหม่'],
  vi: ['Cắt ảnh đại diện', 'Cắt biểu ngữ', 'Kéo để di chuyển · cuộn để thu phóng', 'Áp dụng', 'Hủy', 'Tải ảnh thất bại, vui lòng thử lại sau', 'Cắt lại', 'Cắt lại'],
  id: ['Potong avatar', 'Potong spanduk', 'Seret untuk memindahkan · gulir untuk zoom', 'Terapkan', 'Batal', 'Gambar gagal dimuat, silakan coba lagi nanti', 'Potong ulang', 'Potong ulang'],
  fr: ["Recadrer l'avatar", "Recadrer la bannière", 'Glisser pour déplacer · molette pour zoomer', 'Appliquer', 'Annuler', 'Échec du chargement de l’image, veuillez réessayer plus tard', 'Recadrer à nouveau', 'Recadrer à nouveau'],
  es: ['Recortar avatar', 'Recortar banner', 'Arrastra para mover · desplázate para hacer zoom', 'Aplicar', 'Cancelar', 'No se pudo cargar la imagen, inténtalo de nuevo más tarde', 'Volver a recortar', 'Volver a recortar'],
  pt: ['Recortar avatar', 'Recortar banner', 'Arraste para mover · role para ampliar', 'Aplicar', 'Cancelar', 'Falha ao carregar a imagem, tente novamente mais tarde', 'Recortar novamente', 'Recortar novamente'],
};
const COMMON_KEY_NAMES = ['crop.titleAvatar', 'crop.titleBanner', 'crop.hint', 'crop.confirm', 'crop.cancel', 'crop.loadFail', 'settings.profile.reCropAvatar', 'settings.profile.reCropBanner'];

const PROFILE_KEYS = {
  zh: ['重新裁切', '重新裁切'],
  en: ['Re-crop avatar', 'Re-crop banner'],
  de: ['Avatar erneut zuschneiden', 'Banner erneut zuschneiden'],
  ru: ['Обрезать аватар заново', 'Обрезать баннер заново'],
  ms: ['Potong semula avatar', 'Potong semula sepanduk'],
  th: ['ครอปโปรไฟล์ใหม่', 'ครอปแบนเนอร์ใหม่'],
  vi: ['Cắt lại ảnh đại diện', 'Cắt lại biểu ngữ'],
  id: ['Potong ulang avatar', 'Potong ulang spanduk'],
  fr: ["Recadrer l'avatar", "Recadrer la bannière"],
  es: ['Volver a recortar avatar', 'Volver a recortar banner'],
  pt: ['Recortar avatar novamente', 'Recortar banner novamente'],
};
const PROFILE_KEY_NAMES = ['prof.edit.reCropAvatar', 'prof.edit.reCropBanner'];

function q(s) { return "'" + s.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'"; }

function insertKeys(file, anchorKey, keyNames, valueMap) {
  const f = path.join(ROOT, file);
  const src = fs.readFileSync(f, 'utf8');
  if (src.includes("'" + keyNames[0] + "'")) { console.log('⏭ 已插入过，跳过:', file); return; }
  const lines = src.split('\n');
  const out = [];
  let blockIdx = 0;
  let inserted = 0;
  for (const line of lines) {
    out.push(line);
    const addM = line.match(/\.add\('/);
    if (addM) blockIdx++;
    if (blockIdx >= 1 && blockIdx <= 11 && line.includes(anchorKey + "':")) {
      const lang = Object.keys(valueMap)[blockIdx - 1];
      const vals = valueMap[lang];
      const ind = line.match(/^\s*/)[0];
      out.push('    // v0.2.58.25 裁切弹窗（钦定①：显示范围裁切 GIF 保动画）');
      keyNames.forEach(function (k, i) {
        out.push('    ' + q(k) + ': ' + q(vals[i]) + ',');
      });
      inserted++;
    }
  }
  fs.writeFileSync(f, out.join('\n'));
  console.log('✅', file, '插入', inserted, '语言块');
}

// 语言序：文件内 .add(' 顺序即语言序（zh,en,de,ru,ms,th,vi,id,fr,es,pt）
const LANG_ORDER = ['zh', 'en', 'de', 'ru', 'ms', 'th', 'vi', 'id', 'fr', 'es', 'pt'];
function reorder(map) { const m = {}; LANG_ORDER.forEach(l => { m[l] = map[l]; }); return m; }

insertKeys('docs/assets/i18n/common.i18n.js', 'settings.profile.avatarSync', COMMON_KEY_NAMES, reorder(COMMON_KEYS));
insertKeys('docs/assets/i18n/community-profile.i18n.js', 'prof.edit.avatarLib', PROFILE_KEY_NAMES, reorder(PROFILE_KEYS));
