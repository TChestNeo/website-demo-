// tmp-hub-i18n-630.js — v0.2.58.24 社区页演示样本全移除 i18n 字典改造：
//   ① 头注释 v0.2.54.2 行改 v0.2.58.24 口径
//   ② 主链删 4 键 ×11 语（引导登录 toast ×3 + 分享社区标题）+ 引导登录 toast 段注释
//   ③ feedData 演示卡专链（communityHub.feed.* 28 键 ×11 语）整体删除
//   ④ 10 新键 ×11 语插各语 hub.emptyFeed 行后（zh 值=页面兜底串逐字节一致）
//   ⑤ zh-Hant 由 tmp-i18n-hant.js OpenCC 重生成（本脚本只改单引号链）
'use strict';
const fs = require('fs');
const path = require('path');
const FILE = path.resolve(__dirname, '..', 'docs', 'assets', 'i18n', 'community-hub.i18n.js');
let src = fs.readFileSync(FILE, 'utf8');
let steps = 0;
const step = (n, cond) => { steps++; console.log((cond ? '  ✅ ' : '  ❌ ') + n); if (!cond) process.exitCode = 1; };

// ═══ ① 头注释更新 ═══
{
  const oldHead = " * v0.2.54.2：feedData 演示卡文案 T() 化——communityHub.feed.*（badge/title/desc/time，key/En 对；\n" +
    " * zh 值=中文翻译，en 值=页面兜底原文逐字节一致；zh-Hant 由 OpenCC 脚本自动生成）。\n";
  step('头注释 v0.2.54.2 行在位', src.indexOf(oldHead) !== -1);
  src = src.replace(oldHead,
    " * v0.2.58.24：演示样本全移除——communityHub.feed.*（badge/title/desc/time）与引导登录 toast/分享社区标题键\n" +
    " * 全删；新增登录引导卡/离线卡/三 tab 空态/发现中心空态 10 键（zh 值=页面兜底串逐字节一致；\n" +
    " * zh-Hant 由 OpenCC 脚本自动生成）。\n");
}

// ═══ ② 主链删 4 键 ×11 语（单引号规则行；zh-Hant 双引号由 OpenCC 重生成）═══
for (const k of ['hub.toast.likeLogin', 'hub.toast.repostLogin', 'hub.toast.favLogin', 'hub.share.communityTitle']) {
  const re = new RegExp("^    '" + k + "':[^\\n]*\\n", 'gm');
  src = src.replace(re, '');
}
src = src.replace(/^    \/\/ ── 引导登录 toast ──\n/gm, '');
step('主链 4 删键零残留（单引号）', src.indexOf("'hub.toast.likeLogin'") === -1 && src.indexOf("'hub.toast.repostLogin'") === -1 && src.indexOf("'hub.toast.favLogin'") === -1 && src.indexOf("'hub.share.communityTitle'") === -1);
step('引导登录 toast 段注释清空', src.indexOf('引导登录 toast') === -1);

// ═══ ③ feedData 演示卡专链整体删除 ═══
{
  const feedStart = src.indexOf('  // ═══ v0.2.54.2 feedData 演示卡');
  const feedEnd = src.indexOf('/* __ZH_HANT_AUTO__');
  step('feed 专链起点在位', feedStart !== -1);
  step('zh-Hant 哨兵在位且居后', feedEnd !== -1 && feedEnd > feedStart);
  src = src.slice(0, feedStart) + src.slice(feedEnd);
  step('feed 专链整体删除（communityHub.feed. 零残留）', src.indexOf('communityHub.feed.') === -1);
}

// ═══ ④ 10 新键 ×11 语（插各语 hub.emptyFeed 行后；倒序插入保索引）═══
const LANGS = ['zh', 'en', 'de', 'ru', 'ms', 'th', 'vi', 'id', 'fr', 'es', 'pt'];
const NEW_KEYS = {
  zh: {
    'hub.loginCta.title': '登录后查看社区动态',
    'hub.loginCta.desc': '登录后可以浏览真实的社区动态、参与讨论与互动',
    'hub.loginCta.btn': '去登录',
    'hub.offline': '无法连接服务器，请检查网络后重试',
    'hub.feedEmptyFollowing': '关注一些用户后，他们的帖子会出现在这里',
    'hub.feedEmptyTopic': '还没有话题',
    'hub.feedEmptyTopicCta': '来创建第一个话题 ✨',
    'hub.discovery.guest': '登录后探索话题与频道',
    'hub.discovery.emptyTopics': '还没有话题',
    'hub.discovery.channelsEmpty': '频道功能即将上线',
    'hub.topic.members': ' 成员'
  },
  en: {
    'hub.loginCta.title': 'Log in to see community updates',
    'hub.loginCta.desc': 'Log in to browse real community activity, join discussions and interact',
    'hub.loginCta.btn': 'Go to Login',
    'hub.offline': 'Cannot reach the server, please check your network and retry',
    'hub.feedEmptyFollowing': 'Follow some users and their posts will appear here',
    'hub.feedEmptyTopic': 'No topics yet',
    'hub.feedEmptyTopicCta': 'Create the first topic ✨',
    'hub.discovery.guest': 'Log in to explore topics and channels',
    'hub.discovery.emptyTopics': 'No topics yet',
    'hub.discovery.channelsEmpty': 'Channels are coming soon',
    'hub.topic.members': ' members'
  },
  de: {
    'hub.loginCta.title': 'Melde dich an, um Community-Updates zu sehen',
    'hub.loginCta.desc': 'Melde dich an, um echte Community-Aktivitäten zu sehen, an Diskussionen teilzunehmen und zu interagieren',
    'hub.loginCta.btn': 'Zum Login',
    'hub.offline': 'Server nicht erreichbar. Bitte prüfe deine Verbindung und versuche es erneut',
    'hub.feedEmptyFollowing': 'Folge einigen Nutzern und ihre Beiträge erscheinen hier',
    'hub.feedEmptyTopic': 'Noch keine Themen',
    'hub.feedEmptyTopicCta': 'Erstelle das erste Thema ✨',
    'hub.discovery.guest': 'Melde dich an, um Themen und Kanäle zu entdecken',
    'hub.discovery.emptyTopics': 'Noch keine Themen',
    'hub.discovery.channelsEmpty': 'Kanäle kommen bald',
    'hub.topic.members': ' Mitglieder'
  },
  ru: {
    'hub.loginCta.title': 'Войдите, чтобы видеть обновления сообщества',
    'hub.loginCta.desc': 'Войдите, чтобы просматривать настоящую активность сообщества, участвовать в обсуждениях и взаимодействовать',
    'hub.loginCta.btn': 'Войти',
    'hub.offline': 'Не удаётся связаться с сервером. Проверьте подключение и повторите попытку',
    'hub.feedEmptyFollowing': 'Подпишитесь на пользователей, и их посты появятся здесь',
    'hub.feedEmptyTopic': 'Пока нет тем',
    'hub.feedEmptyTopicCta': 'Создайте первую тему ✨',
    'hub.discovery.guest': 'Войдите, чтобы изучать темы и каналы',
    'hub.discovery.emptyTopics': 'Пока нет тем',
    'hub.discovery.channelsEmpty': 'Каналы скоро появятся',
    'hub.topic.members': ' участников'
  },
  ms: {
    'hub.loginCta.title': 'Log masuk untuk melihat kemas kini komuniti',
    'hub.loginCta.desc': 'Log masuk untuk melihat aktiviti komuniti sebenar, sertai perbincangan dan berinteraksi',
    'hub.loginCta.btn': 'Pergi ke Log Masuk',
    'hub.offline': 'Tidak dapat menyambung ke pelayan. Sila semak rangkaian anda dan cuba lagi',
    'hub.feedEmptyFollowing': 'Ikuti beberapa pengguna dan siaran mereka akan muncul di sini',
    'hub.feedEmptyTopic': 'Belum ada topik',
    'hub.feedEmptyTopicCta': 'Cipta topik pertama ✨',
    'hub.discovery.guest': 'Log masuk untuk meneroka topik dan saluran',
    'hub.discovery.emptyTopics': 'Belum ada topik',
    'hub.discovery.channelsEmpty': 'Saluran akan datang tidak lama lagi',
    'hub.topic.members': ' ahli'
  },
  th: {
    'hub.loginCta.title': 'เข้าสู่ระบบเพื่อดูความเคลื่อนไหวของชุมชน',
    'hub.loginCta.desc': 'เข้าสู่ระบบเพื่อดูความเคลื่อนไหวจริงของชุมชน ร่วมพูดคุยและโต้ตอบ',
    'hub.loginCta.btn': 'ไปที่หน้าเข้าสู่ระบบ',
    'hub.offline': 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ โปรดตรวจสอบเครือข่ายแล้วลองอีกครั้ง',
    'hub.feedEmptyFollowing': 'ติดตามผู้ใช้บางคน แล้วโพสต์ของพวกเขาจะปรากฏที่นี่',
    'hub.feedEmptyTopic': 'ยังไม่มีหัวข้อ',
    'hub.feedEmptyTopicCta': 'มาสร้างหัวข้อแรกกัน ✨',
    'hub.discovery.guest': 'เข้าสู่ระบบเพื่อสำรวจหัวข้อและช่อง',
    'hub.discovery.emptyTopics': 'ยังไม่มีหัวข้อ',
    'hub.discovery.channelsEmpty': 'ช่องจะเปิดให้บริการเร็ว ๆ นี้',
    'hub.topic.members': ' สมาชิก'
  },
  vi: {
    'hub.loginCta.title': 'Đăng nhập để xem cập nhật cộng đồng',
    'hub.loginCta.desc': 'Đăng nhập để xem hoạt động cộng đồng thực tế, tham gia thảo luận và tương tác',
    'hub.loginCta.btn': 'Đến trang đăng nhập',
    'hub.offline': 'Không thể kết nối máy chủ. Vui lòng kiểm tra mạng và thử lại',
    'hub.feedEmptyFollowing': 'Theo dõi một số người dùng và bài viết của họ sẽ xuất hiện ở đây',
    'hub.feedEmptyTopic': 'Chưa có chủ đề nào',
    'hub.feedEmptyTopicCta': 'Tạo chủ đề đầu tiên ✨',
    'hub.discovery.guest': 'Đăng nhập để khám phá chủ đề và kênh',
    'hub.discovery.emptyTopics': 'Chưa có chủ đề nào',
    'hub.discovery.channelsEmpty': 'Kênh sắp ra mắt',
    'hub.topic.members': ' thành viên'
  },
  id: {
    'hub.loginCta.title': 'Masuk untuk melihat pembaruan komunitas',
    'hub.loginCta.desc': 'Masuk untuk melihat aktivitas komunitas yang nyata, ikut berdiskusi dan berinteraksi',
    'hub.loginCta.btn': 'Ke Halaman Masuk',
    'hub.offline': 'Tidak dapat terhubung ke server. Periksa jaringan Anda dan coba lagi',
    'hub.feedEmptyFollowing': 'Ikuti beberapa pengguna dan postingan mereka akan muncul di sini',
    'hub.feedEmptyTopic': 'Belum ada topik',
    'hub.feedEmptyTopicCta': 'Buat topik pertama ✨',
    'hub.discovery.guest': 'Masuk untuk menjelajahi topik dan saluran',
    'hub.discovery.emptyTopics': 'Belum ada topik',
    'hub.discovery.channelsEmpty': 'Saluran segera hadir',
    'hub.topic.members': ' anggota'
  },
  fr: {
    'hub.loginCta.title': 'Connectez-vous pour voir les actualités de la communauté',
    'hub.loginCta.desc': 'Connectez-vous pour parcourir les vraies activités de la communauté, participer aux discussions et interagir',
    'hub.loginCta.btn': 'Aller à la connexion',
    'hub.offline': 'Impossible de joindre le serveur. Vérifiez votre connexion et réessayez',
    'hub.feedEmptyFollowing': 'Suivez des utilisateurs et leurs publications apparaîtront ici',
    'hub.feedEmptyTopic': 'Aucun sujet pour le moment',
    'hub.feedEmptyTopicCta': 'Créez le premier sujet ✨',
    'hub.discovery.guest': 'Connectez-vous pour explorer les sujets et les chaînes',
    'hub.discovery.emptyTopics': 'Aucun sujet pour le moment',
    'hub.discovery.channelsEmpty': 'Les chaînes arrivent bientôt',
    'hub.topic.members': ' membres'
  },
  es: {
    'hub.loginCta.title': 'Inicia sesión para ver las novedades de la comunidad',
    'hub.loginCta.desc': 'Inicia sesión para explorar la actividad real de la comunidad, unirte a los debates e interactuar',
    'hub.loginCta.btn': 'Ir al inicio de sesión',
    'hub.offline': 'No se puede conectar con el servidor. Comprueba tu red e inténtalo de nuevo',
    'hub.feedEmptyFollowing': 'Sigue a algunos usuarios y sus publicaciones aparecerán aquí',
    'hub.feedEmptyTopic': 'Aún no hay temas',
    'hub.feedEmptyTopicCta': 'Crea el primer tema ✨',
    'hub.discovery.guest': 'Inicia sesión para explorar temas y canales',
    'hub.discovery.emptyTopics': 'Aún no hay temas',
    'hub.discovery.channelsEmpty': 'Los canales llegarán pronto',
    'hub.topic.members': ' miembros'
  },
  pt: {
    'hub.loginCta.title': 'Entre para ver as atualizações da comunidade',
    'hub.loginCta.desc': 'Entre para explorar a atividade real da comunidade, participar das discussões e interagir',
    'hub.loginCta.btn': 'Ir para o login',
    'hub.offline': 'Não foi possível conectar ao servidor. Verifique sua rede e tente novamente',
    'hub.feedEmptyFollowing': 'Siga alguns usuários e as publicações deles aparecerão aqui',
    'hub.feedEmptyTopic': 'Ainda não há tópicos',
    'hub.feedEmptyTopicCta': 'Crie o primeiro tópico ✨',
    'hub.discovery.guest': 'Entre para explorar tópicos e canais',
    'hub.discovery.emptyTopics': 'Ainda não há tópicos',
    'hub.discovery.channelsEmpty': 'Os canais chegam em breve',
    'hub.topic.members': ' membros'
  }
};
{
  const matches = [];
  const re = /^[ \t]*'hub\.emptyFeed':[^\n]*\n/gm;
  let m;
  while ((m = re.exec(src))) matches.push(m);
  step('emptyFeed 锚恰 11 语', matches.length === 11);
  for (let i = matches.length - 1; i >= 0; i--) {
    const lang = LANGS[i];
    const lines = Object.keys(NEW_KEYS[lang]).map((k) => "    '" + k + "': " + JSON.stringify(NEW_KEYS[lang][k]) + ',');
    const insert = '    // ── 登录引导/离线/话题空态（v0.2.58.24）──\n' + lines.join('\n') + '\n';
    const mm = matches[i];
    src = src.slice(0, mm.index + mm[0].length) + insert + src.slice(mm.index + mm[0].length);
  }
}
for (const k of ['hub.loginCta.title', 'hub.loginCta.desc', 'hub.loginCta.btn', 'hub.offline', 'hub.feedEmptyFollowing', 'hub.feedEmptyTopic', 'hub.feedEmptyTopicCta', 'hub.discovery.guest', 'hub.discovery.emptyTopics', 'hub.discovery.channelsEmpty', 'hub.topic.members']) {
  const cnt = (src.match(new RegExp("'" + k.replace(/\./g, '\\.') + "'", 'g')) || []).length;
  step("新键 '" + k + "' ×11", cnt === 11);
}

fs.writeFileSync(FILE, src);
console.log('\n字典改造完成：' + steps + ' 步（下一步跑 OpenCC 重生成 zh-Hant）');
