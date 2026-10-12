// tmp-i18n-video-insert.js — v0.2.58.25 视频横幅补报：向 common.i18n.js（settings.profile.video* ×4）与
// community-profile.i18n.js（prof.toast.videoLocked + prof.edit.video* ×3）各 11 语言主块插入新键；
// zh-Hant 由 tmp-i18n-hant.js 重生成。幂等：已含首个键的行跳过不重复插入。
// en 值=settings-modal 代码兜底串逐字节一致；zh 值=资料页代码兜底串逐字节一致。
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

const COMMON_KEYS = {
  zh: ['视频横幅为高级订阅专属功能', '横幅视频压缩中…（最长 1 分钟）', '头像仅支持图片', '视频处理失败，请换一个视频试试'],
  en: ['Video banners are a premium feature', 'Compressing banner video… (up to 1 minute)', 'Avatar supports images only', 'Video processing failed, please try another video'],
  de: ['Video-Banner sind eine Premium-Funktion', 'Banner-Video wird komprimiert… (bis zu 1 Minute)', 'Avatare unterstützen nur Bilder', 'Videoverarbeitung fehlgeschlagen, bitte versuche ein anderes Video'],
  ru: ['Видеобаннеры — премиум-функция', 'Сжатие видео баннера… (до 1 минуты)', 'Аватар поддерживает только изображения', 'Не удалось обработать видео, попробуйте другое'],
  ms: ['Sepanduk video ialah ciri premium', 'Memampatkan video sepanduk… (sehingga 1 minit)', 'Avatar hanya menyokong imej', 'Pemprosesan video gagal, sila cuba video lain'],
  th: ['แบนเนอร์วิดีโอเป็นฟีเจอร์พรีเมียม', 'กำลังบีบอัดวิดีโอแบนเนอร์… (สูงสุด 1 นาที)', 'อวาตาร์รองรับเฉพาะรูปภาพ', 'การประมวลผลวิดีโอล้มเหลว โปรดลองวิดีโออื่น'],
  vi: ['Biểu ngữ video là tính năng cao cấp', 'Đang nén video biểu ngữ… (tối đa 1 phút)', 'Ảnh đại diện chỉ hỗ trợ hình ảnh', 'Xử lý video thất bại, vui lòng thử video khác'],
  id: ['Banner video adalah fitur premium', 'Mengompresi video banner… (hingga 1 menit)', 'Avatar hanya mendukung gambar', 'Pemrosesan video gagal, silakan coba video lain'],
  fr: ['Les bannières vidéo sont une fonctionnalité premium', 'Compression de la vidéo de bannière… (jusqu’à 1 minute)', 'Les avatars ne prennent en charge que les images', 'Échec du traitement vidéo, veuillez réessayer avec une autre vidéo'],
  es: ['Los banners de video son una función premium', 'Comprimiendo el video del banner… (hasta 1 minuto)', 'Los avatares solo admiten imágenes', 'Error al procesar el video, prueba con otro video'],
  pt: ['Banners de vídeo são um recurso premium', 'Comprimindo o vídeo do banner… (até 1 minuto)', 'Avatares suportam apenas imagens', 'Falha ao processar o vídeo, tente outro vídeo'],
};
const COMMON_KEY_NAMES = ['settings.profile.videoLocked', 'settings.profile.videoCompressing', 'settings.profile.avatarNoVideo', 'settings.profile.videoFail'];

const PROFILE_KEYS = {
  zh: ['视频横幅为高级订阅专属功能', '横幅视频压缩中…（最长 1 分钟）', '头像仅支持图片', '视频处理失败，请换一个视频试试'],
  en: ['Video banners are a premium feature', 'Compressing banner video… (up to 1 minute)', 'Avatar supports images only', 'Video processing failed, please try another video'],
  de: ['Video-Banner sind eine Premium-Funktion', 'Banner-Video wird komprimiert… (bis zu 1 Minute)', 'Avatare unterstützen nur Bilder', 'Videoverarbeitung fehlgeschlagen, bitte versuche ein anderes Video'],
  ru: ['Видеобаннеры — премиум-функция', 'Сжатие видео баннера… (до 1 минуты)', 'Аватар поддерживает только изображения', 'Не удалось обработать видео, попробуйте другое'],
  ms: ['Sepanduk video ialah ciri premium', 'Memampatkan video sepanduk… (sehingga 1 minit)', 'Avatar hanya menyokong imej', 'Pemprosesan video gagal, sila cuba video lain'],
  th: ['แบนเนอร์วิดีโอเป็นฟีเจอร์พรีเมียม', 'กำลังบีบอัดวิดีโอแบนเนอร์… (สูงสุด 1 นาที)', 'อวาตาร์รองรับเฉพาะรูปภาพ', 'การประมวลผลวิดีโอล้มเหลว โปรดลองวิดีโออื่น'],
  vi: ['Biểu ngữ video là tính năng cao cấp', 'Đang nén video biểu ngữ… (tối đa 1 phút)', 'Ảnh đại diện chỉ hỗ trợ hình ảnh', 'Xử lý video thất bại, vui lòng thử video khác'],
  id: ['Banner video adalah fitur premium', 'Mengompresi video banner… (hingga 1 menit)', 'Avatar hanya mendukung gambar', 'Pemrosesan video gagal, silakan coba video lain'],
  fr: ['Les bannières vidéo sont une fonctionnalité premium', 'Compression de la vidéo de bannière… (jusqu’à 1 minute)', 'Les avatars ne prennent en charge que les images', 'Échec du traitement vidéo, veuillez réessayer avec une autre vidéo'],
  es: ['Los banners de video son una función premium', 'Comprimiendo el video del banner… (hasta 1 minuto)', 'Los avatares solo admiten imágenes', 'Error al procesar el video, prueba con otro video'],
  pt: ['Banners de vídeo são um recurso premium', 'Comprimindo o vídeo do banner… (até 1 minuto)', 'Avatares suportam apenas imagens', 'Falha ao processar o vídeo, tente outro vídeo'],
};
const PROFILE_KEY_NAMES = ['prof.toast.videoLocked', 'prof.edit.videoCompressing', 'prof.edit.avatarNoVideo', 'prof.edit.videoFail'];

function q(s) { return "'" + s.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'"; }

function insertKeys(file, anchorKey, keyNames, valueMap, comment) {
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
      out.push('    ' + comment);
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

insertKeys('docs/assets/i18n/common.i18n.js', 'settings.profile.reCropBanner', COMMON_KEY_NAMES, reorder(COMMON_KEYS), '// v0.2.58.25 视频横幅（钦定补报：只横幅/浏览器压缩/超 60s 截取）');
insertKeys('docs/assets/i18n/community-profile.i18n.js', 'prof.edit.reCropBanner', PROFILE_KEY_NAMES, reorder(PROFILE_KEYS), '// v0.2.58.25 视频横幅（钦定补报：只横幅/浏览器压缩/超 60s 截取）');
