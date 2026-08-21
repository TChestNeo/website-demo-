'use strict';
// extract-faq.js（P8）：从 docs/pages/help.html（条目顺序 + 分类归属）与 docs/assets/i18n/help.zh.js（文案权威）
// 生成 backend/src/ai/faq.json——进 git 可 diff，**确定性输出（无时间戳）**。
// 关键词表（zh/en/ms）只维护在本文件：改关键词 → 改这里 → 重跑 `npm run extract-faq`。
// needsHuman/ticketHint 对齐 plan 的 needsHuman 先行规则与 PROBLEM_TYPES 子码语义（ticketHint 为卡片展示文案）。
// 用法：node scripts/extract-faq.js（exit 0 = 已生成；exit 1 = 结构缺失，不写文件）

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..', '..');
const HELP_HTML = path.join(root, 'docs', 'pages', 'help.html');
const HELP_ZH = path.join(root, 'docs', 'assets', 'i18n', 'help.zh.js');
const OUT = path.join(root, 'backend', 'src', 'ai', 'faq.json');

// ── 1. help.zh.js → 字典（vm 沙箱捕获 MN_I18N.add 的参数，避免正则解析 JS 字符串）──
let dict = null;
vm.runInNewContext(fs.readFileSync(HELP_ZH, 'utf8'), {
  window: {
    MN_I18N: { add: (_lang, d) => { dict = d; } }
  }
}, { filename: 'help.zh.js' });
if (!dict) { console.error('extract-faq: help.zh.js 未捕获到 MN_I18N 字典'); process.exit(1); }

// ── 2. help.html → 条目顺序 + 分类归属（faq.cat.X → faq.q.N → faq.a.N 按文档序）──
const html = fs.readFileSync(HELP_HTML, 'utf8');
const re = /data-i18n="(faq\.(cat|q|a)\.([\w-]+))"/g;
let m; let currentCat = null; const entries = [];
while ((m = re.exec(html)) !== null) {
  const kind = m[2]; const id = m[3];
  if (kind === 'cat') {
    currentCat = { key: id, label: dict['faq.cat.' + id] || id };
  } else if (kind === 'q') {
    entries.push({
      id: 'q' + id,
      category: currentCat ? { ...currentCat } : { key: 'other', label: '其他' },
      question: dict['faq.q.' + id] || '',
      answer: dict['faq.a.' + id] || '',
      keywords: { zh: [], en: [], ms: [] },
      needsHuman: false,
      ticketHint: null
    });
  } else if (kind === 'a') {
    const entry = entries[entries.length - 1];
    if (entry && entry.id === 'q' + id && !entry.answer) entry.answer = dict['faq.a.' + id] || '';
  }
}

// ── 3. 关键词表（人工维护；zh 子串 / en·ms 词边界匹配）──────────────────────
// 每项 2 个及以上关键词命中即可检索（score = min(1, hits/3)，阈值 0.6 见 ai/faq.js）。
const KEYWORDS = {
  q1:  { zh: ['micronation', '微国家', '微国', '架空世界', '世界观', '创作', 'lore', 'worldbuilding', '入门', '新手', '第一次', '怎么开始', '怎么玩', '是什么', '什么是'], en: ['micronation', 'worldbuilding', 'lore', 'world', 'create', 'start', 'begin', 'first time', 'new', 'what is'], ms: ['micronation', 'worldbuilding', 'lore', 'dunia', 'cipta', 'mula', 'pertama', 'negara kecil', 'cara main'] },
  q2:  { zh: ['语言', '哪些语言', '中文', '英文', '马来语', '翻译', '多语言'], en: ['language', 'chinese', 'english', 'malay', 'translate', 'multilingual'], ms: ['bahasa', 'cina', 'inggeris', 'melayu', 'terjemah'] },
  q3:  { zh: ['数据', '保留', '多久', '三年', '3年', '登出', '清除', '保存时间'], en: ['data', 'keep', 'retain', 'how long', 'logout', 'delete', '3 years'], ms: ['data', 'simpan', 'berapa lama', 'log keluar', '3 tahun', 'padam'] },
  q4:  { zh: ['删除', '账号', '删号', '注销', '恢复', '后悔', '找回账号'], en: ['delete', 'account', 'recover', 'restore', 'undo', '30 days'], ms: ['padam', 'akaun', 'hapus', 'pulih', '30 hari'] },
  q5:  { zh: ['出售', '数据', '隐私', '卖数据', '个人信息', '泄露给第三方'], en: ['sell', 'data', 'privacy', 'personal info', 'third party'], ms: ['jual', 'data', 'privasi', 'maklumat peribadi'] },
  q6:  { zh: ['密码', '忘记', '重置', '找回', '被盗', '盗号', '登录不上'], en: ['password', 'forgot', 'reset', 'stolen', 'hijacked', 'recover', 'locked'], ms: ['kata laluan', 'lupa', 'tetapkan', 'dicuri', 'akaun', 'kunci'] },
  q7:  { zh: ['导出', '数据', '隐私请求', '下载数据', '导出我的'], en: ['export', 'data', 'download', 'privacy request'], ms: ['eksport', 'data', 'muat turun', 'permintaan privasi'], needsHuman: true, ticketHint: '数据导出/删除请求由人工受理。请提交工单（账号问题 → 隐私请求），首个人工回复目标为 3 天内。' },
  q8:  { zh: ['未成年', '13岁', '儿童', '年龄', '孩子', '注册限制'], en: ['minor', '13', 'underage', 'children', 'age'], ms: ['bawah umur', '13 tahun', 'kanak-kanak', 'umur'] },
  q9:  { zh: ['数据安全', '泄露', '安全事件', '通知', '隐私泄露'], en: ['data breach', 'security', 'incident', 'leak', 'notify'], ms: ['kebocoran data', 'keselamatan', 'insiden', 'maklum'] },
  q10: { zh: ['订阅', '套餐', '价格', '多少钱', '会员', '收费', '付费', 'premium', 'ultra'], en: ['subscription', 'plan', 'price', 'cost', 'premium', 'ultra', 'how much'], ms: ['langganan', 'pakej', 'harga', 'berapa', 'premium', 'ultra'] },
  q11: { zh: ['支付', '付款', '方式', 'stripe', 'fpx', '信用卡', '网银'], en: ['payment', 'pay', 'stripe', 'fpx', 'credit card', 'method'], ms: ['bayaran', 'bayar', 'stripe', 'fpx', 'kad kredit', 'cara'] },
  q12: { zh: ['续费', '自动', '扣费', '取消订阅', '自动扣款'], en: ['renew', 'auto', 'automatic', 'cancel', 'subscription', 'charge'], ms: ['perbaharui', 'auto', 'batal', 'langganan', 'caj'] },
  q13: { zh: ['退款', '退钱', '退费', '补偿'], en: ['refund', 'money back', 'reimbursement', 'compensation'], ms: ['bayar balik', 'pulangan', 'pampasan', 'refund'], needsHuman: true, ticketHint: '退款与账单问题需要人工核查。请提交工单（支付与订阅 → 退款问题），首个人工回复目标为 3 天内。' },
  q14: { zh: ['货币', '汇率', 'myr', 'usd', '币种', '令吉', '马币'], en: ['currency', 'exchange rate', 'myr', 'usd', 'ringgit', 'dollar'], ms: ['mata wang', 'kadar', 'myr', 'usd', 'ringgit'] },
  q15: { zh: ['换行', '卡片', '文字', '排版', '环绕'], en: ['text', 'wrap', 'card', 'layout', 'flow'], ms: ['teks', 'kad', 'susun atur', 'balut'] },
  q16: { zh: ['版权', '所有权', '知识产权', '归属', '归谁', '著作权'], en: ['copyright', 'ownership', 'intellectual property', 'belong', 'ip'], ms: ['hak cipta', 'milik', 'harta intelek', 'kepunyaan'] },
  q17: { zh: ['训练', '模型', 'ai', '内容', '机器学习'], en: ['train', 'training', 'model', 'ai', 'content'], ms: ['latih', 'model', 'ai', 'kandungan'] },
  q18: { zh: ['ai', '订阅', '功能', '哪些', '套餐', '包含'], en: ['ai', 'subscription', 'feature', 'plan', 'include', 'which'], ms: ['ai', 'langganan', 'ciri', 'pelan', 'termasuk'] },
  q19: { zh: ['ai', '版权', '生成', '内容', '归属'], en: ['ai', 'copyright', 'generated', 'content', 'belong'], ms: ['ai', 'hak cipta', 'kandungan', 'jana'] },
  q20: { zh: ['收入', '结算', '提现', '分成', '到账', '创作者', '收益'], en: ['income', 'payout', 'settlement', 'withdrawal', 'revenue', 'creator', 'earnings'], ms: ['pendapatan', 'penyelesaian', 'pengeluaran', 'bahagian', 'pencipta'], needsHuman: true, ticketHint: '结算问题由人工核查。请提交工单（创作者结算 → 结算查询），首个人工回复目标为 3 天内。' },
  q21: { zh: ['工单', '回复', '多久', '时间', '处理', '响应'], en: ['ticket', 'reply', 'how long', 'response', 'sla', 'time'], ms: ['tiket', 'balas', 'berapa lama', 'respons', 'masa'] },
  q22: { zh: ['举报', '违规', '抄袭', '侵权', '投诉'], en: ['report', 'violation', 'plagiarism', 'infringement', 'abuse'], ms: ['lapor', 'langgar', 'plagiat', 'aduan'] },
  q23: { zh: ['官方', '验证', '冒充', '私信', '身份', '验证码', '工作人员'], en: ['official', 'verify', 'impersonation', 'dm', 'identity', 'code', 'staff'], ms: ['rasmi', 'sahkan', 'menyamar', 'dm', 'kod', 'kakitangan'] }
};

// ── 4. 合并 + 结构断言（缺任一 id / 空答案即失败，不写文件）──
for (const entry of entries) {
  const kw = KEYWORDS[entry.id];
  if (!kw) { console.error(`extract-faq: 缺少关键词表 ${entry.id}`); process.exit(1); }
  entry.keywords = { zh: kw.zh || [], en: kw.en || [], ms: kw.ms || [] };
  entry.needsHuman = !!kw.needsHuman;
  entry.ticketHint = kw.ticketHint || null;
  if (!entry.question || !entry.answer) {
    console.error(`extract-faq: ${entry.id} 问题或答案为空（HTML 与 help.zh.js 不同步？）`);
    process.exit(1);
  }
}
if (entries.length !== 23) {
  console.error(`extract-faq: 期望 23 条 FAQ，实际 ${entries.length} 条`);
  process.exit(1);
}

const faq = {
  _meta: {
    source: 'docs/pages/help.html（顺序/分类） + docs/assets/i18n/help.zh.js（文案）',
    generatedBy: 'backend/scripts/extract-faq.js',
    count: entries.length
  },
  entries
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(faq, null, 2) + '\n');
console.log(`extract-faq: ${entries.length} 条 → ${path.relative(root, OUT)}`);
