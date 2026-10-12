// tmp-i18n-639-insert.js — FC v10.28.52.0 等级奖励 i18n：
//   fluidcanvas.i18n.js：fc.rewards.* 5 键 ×11 手写块（fc.landing.followers 行后插）
// common.i18n.js 的 rewards.* 25 键已由 Edit 工具手写完成；zh-Hant 由 tmp-i18n-hant.js OpenCC 再生成（本脚本不碰 __ZH_HANT_AUTO__ 段）。
'use strict';
const fs = require('fs');
const path = require('path');

const I18N = path.resolve(__dirname, '..', 'docs', 'assets', 'i18n');
const SENTINEL = '/* __ZH_HANT_AUTO__';

function splitSentinel(src) {
  const i = src.indexOf(SENTINEL);
  if (i === -1) return { body: src, tail: '', had: false };
  return { body: src.slice(0, i), tail: src.slice(i), had: true };
}

function applyLines(src, fn) {
  const { body, tail } = splitSentinel(src);
  const out = [];
  for (const line of body.split('\n')) fn(line, out);
  return (body.endsWith('\n') ? out.join('\n') : out.join('\n') + '\n') + tail;
}

const R = {
  zh: { teamXp: '团队经验', follow: '关注', unfollow: '已关注', followFail: '关注失败，请稍后再试', teamAchEmpty: '暂无团队成就——团队等级达标后自动解锁' },
  en: { teamXp: 'Team XP', follow: 'Follow', unfollow: 'Following', followFail: 'Follow failed, please try again', teamAchEmpty: 'No team achievements yet — unlocked automatically as the team levels up' },
  de: { teamXp: 'Team-XP', follow: 'Folgen', unfollow: 'Folgt', followFail: 'Folgen fehlgeschlagen, bitte versuch es erneut', teamAchEmpty: 'Noch keine Team-Erfolge — werden automatisch freigeschaltet, wenn das Team aufsteigt' },
  ru: { teamXp: 'Опыт команды', follow: 'Подписаться', unfollow: 'Вы подписаны', followFail: 'Не удалось подписаться, попробуйте позже', teamAchEmpty: 'Пока нет командных достижений — откроются автоматически с ростом уровня команды' },
  ms: { teamXp: 'XP Pasukan', follow: 'Ikut', unfollow: 'Mengikuti', followFail: 'Gagal mengikuti, sila cuba lagi', teamAchEmpty: 'Tiada pencapaian pasukan lagi — dibuka automatik apabila tahap pasukan meningkat' },
  th: { teamXp: 'XP ทีม', follow: 'ติดตาม', unfollow: 'ติดตามแล้ว', followFail: 'ติดตามไม่สำเร็จ โปรดลองอีกครั้ง', teamAchEmpty: 'ยังไม่มีความสำเร็จของทีม — ปลดล็อกอัตโนมัติเมื่อเลเวลทีมถึง' },
  vi: { teamXp: 'XP nhóm', follow: 'Theo dõi', unfollow: 'Đang theo dõi', followFail: 'Theo dõi thất bại, vui lòng thử lại', teamAchEmpty: 'Chưa có thành tựu nhóm — tự động mở khóa khi nhóm lên cấp' },
  id: { teamXp: 'XP Tim', follow: 'Ikuti', unfollow: 'Mengikuti', followFail: 'Gagal mengikuti, coba lagi', teamAchEmpty: 'Belum ada pencapaian tim — terbuka otomatis saat level tim naik' },
  fr: { teamXp: "XP d'équipe", follow: 'Suivre', unfollow: 'Abonné', followFail: 'Échec du suivi, réessayez', teamAchEmpty: "Pas encore de succès d'équipe — débloqués automatiquement quand l'équipe monte de niveau" },
  es: { teamXp: 'XP del equipo', follow: 'Seguir', unfollow: 'Siguiendo', followFail: 'Error al seguir, inténtalo de nuevo', teamAchEmpty: 'Aún no hay logros de equipo — se desbloquean automáticamente al subir de nivel el equipo' },
  pt: { teamXp: 'XP da equipe', follow: 'Seguir', unfollow: 'Seguindo', followFail: 'Falha ao seguir, tente novamente', teamAchEmpty: 'Ainda não há conquistas de equipe — desbloqueadas automaticamente quando a equipe sobe de nível' }
};
const R_ORDER = ['teamXp', 'follow', 'unfollow', 'followFail', 'teamAchEmpty'];

const fcFile = path.join(I18N, 'fluidcanvas.i18n.js');
let fcSrc = fs.readFileSync(fcFile, 'utf8');
const fcCounts = [];
fcSrc = applyLines(fcSrc, (line, out) => {
  out.push(line);
  const m = line.match(/^(\s*)"fc\.landing\.followers":/);
  if (m) {
    const indent = m[1];
    const lang = Object.keys(R)[fcCounts.length];
    fcCounts.push(lang);
    R_ORDER.forEach((k, i) => {
      const last = i === R_ORDER.length - 1;
      out.push(`${indent}"fc.rewards.${k}": ${JSON.stringify(R[lang][k])}${last ? '' : ','}`);
    });
  }
});
fs.writeFileSync(fcFile, fcSrc);
console.log('fluidcanvas.i18n.js：插入语言块', fcCounts.join(','), '各 5 键');
