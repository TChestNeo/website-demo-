// M.NationWorld — region-aware pricing detection（v0.2.12.0 多币种）
// 16 币 = premium.html 同一价目（premium 列在此；label+premium 供 data-slati-price 横幅）；
// 展示 locale → 币代码（CC 映射）→ 该币真实扣款价；非 16 币 locale → usd（显示 $ + 扣 USD，自洽）。
// 金额生成见 tmp-price-gen.js（弱币 = MYR 档 / 其余 = USD 档换算，尾 X.99/.00）。
(function(){
  // {币: {label, premium}}——逐字同 premium.html 价目 premium 列
  var PREM = {
    'myr':{label:'MYR (RM)',premium:'RM23.50'},
    'usd':{label:'USD ($)',premium:'$11.99'},
    'eur':{label:'EUR (€)',premium:'€11.00'},
    'gbp':{label:'GBP (£)',premium:'£9.99'},
    'sgd':{label:'SGD (S$)',premium:'S$15.99'},
    'aud':{label:'AUD (A$)',premium:'A$18.99'},
    'cad':{label:'CAD (C$)',premium:'C$16.00'},
    'jpy':{label:'JPY (¥)',premium:'¥1,800'},
    'hkd':{label:'HKD (HK$)',premium:'HK$93.99'},
    'twd':{label:'TWD (NT$)',premium:'NT$387.00'},
    'thb':{label:'THB (฿)',premium:'฿186.99'},
    'idr':{label:'IDR (Rp)',premium:'Rp 87,000'},
    'vnd':{label:'VND (₫)',premium:'₫137,000'},
    'php':{label:'PHP (₱)',premium:'₱311.99'},
    'krw':{label:'KRW (₩)',premium:'₩16,000'},
    'inr':{label:'INR (₹)',premium:'₹459.00'}
  };

  var loc = (navigator.language || 'en-US').toLowerCase();
  var tz = '';
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch(e) {}

  var key = 'default';

  // ── Timezone + language prefix detection (most accurate first) ──
  // v0.2.12.0 新增 en-SG/en-PH（此前漏检 → 误落 default 美元）；须在 ms* 之前（ms-SG 语言前缀会撞马来自检）

  // Singapore
  if (tz.startsWith('Asia/Singapore') || loc === 'en-sg' || loc === 'zh-sg' || loc === 'ms-sg') {
    key = 'en-SG';
  }
  // Philippines
  else if (tz.startsWith('Asia/Manila') || loc === 'en-ph' || loc.startsWith('fil') || loc.startsWith('tl')) {
    key = 'en-PH';
  }
  // Malaysia: MY timezones, Malay language, or en-MY locale
  if (tz.startsWith('Asia/Kuala_Lumpur') || tz.startsWith('Asia/Kuching') || loc.startsWith('ms') || loc === 'en-my') {
    key = 'ms-MY';
  }
  // Taiwan
  else if (tz.startsWith('Asia/Taipei') || (loc.startsWith('zh') && loc.indexOf('tw') !== -1)) {
    key = 'zh-TW';
  }
  // Hong Kong
  else if (tz.startsWith('Asia/Hong_Kong') || (loc.startsWith('zh') && loc.indexOf('hk') !== -1)) {
    key = 'zh-HK';
  }
  // Macau
  else if (tz.startsWith('Asia/Macau') || (loc.startsWith('zh') && loc.indexOf('mo') !== -1)) {
    key = 'zh-MO';
  }
  // Indonesia
  else if (tz.startsWith('Asia/Jakarta') || tz.startsWith('Asia/Makassar') || tz.startsWith('Asia/Jayapura') || tz.startsWith('Asia/Pontianak') || loc.startsWith('id')) {
    key = 'id-ID';
  }
  // Vietnam
  else if (tz.startsWith('Asia/Ho_Chi_Minh') || tz.startsWith('Asia/Saigon') || loc.startsWith('vi')) {
    key = 'vi-VN';
  }
  // Thailand
  else if (tz.startsWith('Asia/Bangkok') || loc.startsWith('th')) {
    key = 'th-TH';
  }
  // Myanmar
  else if (tz.startsWith('Asia/Yangon') || tz.startsWith('Asia/Rangoon') || loc.startsWith('my')) {
    key = 'my-MM';
  }
  // ── South & Central Asia ──
  // India
  else if (tz.startsWith('Asia/Kolkata') || loc === 'hi' || loc === 'en-in') { key = 'hi-IN'; }
  // Pakistan
  else if (tz.startsWith('Asia/Karachi') || loc.startsWith('ur')) { key = 'ur-PK'; }
  // Bangladesh
  else if (tz.startsWith('Asia/Dhaka') || loc.startsWith('bn')) { key = 'bn-BD'; }
  // Sri Lanka
  else if (tz.startsWith('Asia/Colombo') || loc.startsWith('si')) { key = 'si-LK'; }
  // Nepal
  else if (tz.startsWith('Asia/Kathmandu') || loc.startsWith('ne')) { key = 'ne-NP'; }
  // Bhutan
  else if (tz.startsWith('Asia/Thimphu') || loc.startsWith('dz')) { key = 'dz-BT'; }
  // Maldives
  else if (tz.startsWith('Indian/Maldives') || loc.startsWith('dv')) { key = 'dv-MV'; }
  // Afghanistan
  else if (tz.startsWith('Asia/Kabul')) { key = 'fa-AF'; }
  // Kazakhstan
  else if (tz.startsWith('Asia/Almaty') || tz.startsWith('Asia/Aqtobe') || tz.startsWith('Asia/Aqtau') || tz.startsWith('Asia/Atyrau') || tz.startsWith('Asia/Oral') || tz.startsWith('Asia/Qostanay') || tz.startsWith('Asia/Qyzylorda') || loc.startsWith('kk')) { key = 'kk-KZ'; }
  // Uzbekistan
  else if (tz.startsWith('Asia/Tashkent') || tz.startsWith('Asia/Samarkand') || loc.startsWith('uz')) { key = 'uz-UZ'; }
  // Turkmenistan
  else if (tz.startsWith('Asia/Ashgabat') || loc.startsWith('tk')) { key = 'tk-TM'; }
  // Kyrgyzstan
  else if (tz.startsWith('Asia/Bishkek') || loc.startsWith('ky')) { key = 'ky-KG'; }
  // Tajikistan
  else if (tz.startsWith('Asia/Dushanbe') || loc.startsWith('tg')) { key = 'tg-TJ'; }
  // ── Middle East ──
  // Saudi Arabia
  else if (tz.startsWith('Asia/Riyadh')) { key = 'ar-SA'; }
  // UAE
  else if (tz.startsWith('Asia/Dubai')) { key = 'ar-AE'; }
  // Qatar
  else if (tz.startsWith('Asia/Qatar')) { key = 'ar-QA'; }
  // Kuwait
  else if (tz.startsWith('Asia/Kuwait')) { key = 'ar-KW'; }
  // Bahrain
  else if (tz.startsWith('Asia/Bahrain')) { key = 'ar-BH'; }
  // Oman
  else if (tz.startsWith('Asia/Muscat')) { key = 'ar-OM'; }
  // Jordan
  else if (tz.startsWith('Asia/Amman')) { key = 'ar-JO'; }
  // Israel
  else if (tz.startsWith('Asia/Jerusalem') || tz.startsWith('Asia/Tel_Aviv') || loc.startsWith('he')) { key = 'he-IL'; }
  // Lebanon
  else if (tz.startsWith('Asia/Beirut')) { key = 'ar-LB'; }
  // Iraq
  else if (tz.startsWith('Asia/Baghdad')) { key = 'ar-IQ'; }
  // Iran
  else if (tz.startsWith('Asia/Tehran') || loc.startsWith('fa')) { key = 'fa-IR'; }
  // Egypt
  else if (tz.startsWith('Africa/Cairo')) { key = 'ar-EG'; }
  // Turkey
  else if (tz.startsWith('Europe/Istanbul') || loc.startsWith('tr')) { key = 'tr-TR'; }
  // ── South America ──
  // Brazil: Portuguese language, or BR timezones
  else if (loc.startsWith('pt') || tz.startsWith('America/Sao_Paulo') || tz.startsWith('America/Rio_Branco') || tz.startsWith('America/Fortaleza') || tz.startsWith('America/Recife') || tz.startsWith('America/Manaus') || tz.startsWith('America/Belem') || tz.startsWith('America/Bahia') || tz.startsWith('America/Cuiaba') || tz.startsWith('America/Porto_Velho') || tz.startsWith('America/Boa_Vista') || tz.startsWith('America/Eirunepe') || tz.startsWith('America/Santarem') || tz.startsWith('America/Araguaina') || tz.startsWith('America/Maceio') || tz.startsWith('America/Campo_Grande') || tz.startsWith('America/Noronha')) {
    key = 'pt-BR';
  }
  // Argentina
  else if (tz.startsWith('America/Argentina/')) {
    key = 'es-AR';
  }
  // Chile
  else if (tz.startsWith('America/Santiago') || tz.startsWith('America/Punta_Arenas')) {
    key = 'es-CL';
  }
  // Colombia
  else if (tz.startsWith('America/Bogota')) {
    key = 'es-CO';
  }
  // Peru
  else if (tz.startsWith('America/Lima')) {
    key = 'es-PE';
  }
  // Uruguay
  else if (tz.startsWith('America/Montevideo')) {
    key = 'es-UY';
  }
  // Paraguay
  else if (tz.startsWith('America/Asuncion')) {
    key = 'es-PY';
  }
  // Bolivia
  else if (tz.startsWith('America/La_Paz')) {
    key = 'es-BO';
  }
  // Ecuador
  else if (tz.startsWith('America/Guayaquil') || tz.startsWith('America/Galapagos')) {
    key = 'es-EC';
  }
  // Venezuela
  else if (tz.startsWith('America/Caracas')) {
    key = 'es-VE';
  }
  // Guyana
  else if (tz.startsWith('America/Guyana')) {
    key = 'en-GY';
  }
  // Suriname
  else if (tz.startsWith('America/Paramaribo') || loc.startsWith('nl')) {
    key = 'nl-SR';
  }
  // French Guiana
  else if (tz.startsWith('America/Cayenne')) {
    key = 'fr-GF';
  }
  // ── Oceania ──
  // Australia
  else if (tz.startsWith('Australia/') || loc === 'en-au') { key = 'en-AU'; }
  // New Zealand
  else if (tz.startsWith('Pacific/Auckland') || tz.startsWith('Pacific/Chatham') || loc === 'en-nz') { key = 'en-NZ'; }
  // Fiji
  else if (tz.startsWith('Pacific/Fiji') || loc === 'en-fj') { key = 'en-FJ'; }
  // Papua New Guinea
  else if (tz.startsWith('Pacific/Port_Moresby') || loc === 'en-pg') { key = 'en-PG'; }
  // Samoa
  else if (tz.startsWith('Pacific/Apia') || loc.startsWith('sm')) { key = 'en-WS'; }
  // Tonga
  else if (tz.startsWith('Pacific/Tongatapu') || loc.startsWith('to')) { key = 'en-TO'; }
  // ── North America ──
  // Mexico
  else if (tz.startsWith('America/Mexico_City') || tz.startsWith('America/Cancun') || tz.startsWith('America/Merida') || tz.startsWith('America/Monterrey') || tz.startsWith('America/Chihuahua') || tz.startsWith('America/Hermosillo') || tz.startsWith('America/Mazatlan') || tz.startsWith('America/Tijuana') || tz.startsWith('America/Bahia_Banderas') || tz.startsWith('America/Ojinaga') || loc === 'es-mx') {
    key = 'es-MX';
  }
  // ── Non-EU Europe ──
  // UK: timezone + en-GB locale
  else if (tz.startsWith('Europe/London') || loc === 'en-gb') { key = 'en-GB'; }
  // Russia: timezones + ru language
  else if (tz.startsWith('Europe/Moscow') || tz.startsWith('Europe/Kaliningrad') || tz.startsWith('Europe/Samara') || tz.startsWith('Europe/Volgograd') || tz.startsWith('Europe/Kirov') || tz.startsWith('Europe/Astrakhan') || tz.startsWith('Europe/Saratov') || tz.startsWith('Europe/Ulyanovsk') || tz.startsWith('Asia/Yekaterinburg') || tz.startsWith('Asia/Omsk') || tz.startsWith('Asia/Novosibirsk') || tz.startsWith('Asia/Krasnoyarsk') || tz.startsWith('Asia/Irkutsk') || tz.startsWith('Asia/Vladivostok') || tz.startsWith('Asia/Magadan') || tz.startsWith('Asia/Kamchatka') || tz.startsWith('Asia/Yakutsk') || tz.startsWith('Asia/Chita') || tz.startsWith('Asia/Khandyga') || tz.startsWith('Asia/Srednekolymsk') || tz.startsWith('Asia/Ust-Nera') || tz.startsWith('Asia/Anadyr') || loc.startsWith('ru')) { key = 'ru-RU'; }
  // Ukraine
  else if (tz.startsWith('Europe/Kyiv') || tz.startsWith('Europe/Kiev') || tz.startsWith('Europe/Simferopol') || tz.startsWith('Europe/Uzhgorod') || tz.startsWith('Europe/Zaporozhye') || loc.startsWith('uk')) { key = 'uk-UA'; }
  // Belarus
  else if (tz.startsWith('Europe/Minsk') || loc.startsWith('be')) { key = 'be-BY'; }
  // Serbia
  else if (tz.startsWith('Europe/Belgrade') || loc.startsWith('sr')) { key = 'sr-RS'; }
  // Norway
  else if (tz.startsWith('Europe/Oslo') || loc.startsWith('nb') || loc.startsWith('nn') || loc === 'no') { key = 'nb-NO'; }
  // Switzerland (before de/fr language checks)
  else if (tz.startsWith('Europe/Zurich')) { key = 'de-CH'; }
  // Iceland
  else if (tz.startsWith('Atlantic/Reykjavik') || loc.startsWith('is')) { key = 'is-IS'; }
  // Albania
  else if (tz.startsWith('Europe/Tirane') || loc.startsWith('sq')) { key = 'sq-AL'; }
  // Bosnia
  else if (tz.startsWith('Europe/Sarajevo') || loc.startsWith('bs')) { key = 'bs-BA'; }
  // North Macedonia
  else if (tz.startsWith('Europe/Skopje') || loc.startsWith('mk')) { key = 'mk-MK'; }
  // Moldova (timezone only — ro language shared with Romania)
  else if (tz.startsWith('Europe/Chisinau')) { key = 'ro-MD'; }
  // Monaco (before fr check)
  else if (tz.startsWith('Europe/Monaco')) { key = 'fr-MC'; }
  // San Marino
  else if (tz.startsWith('Europe/San_Marino')) { key = 'it-SM'; }
  // Andorra (timezone only — ca language shared with Catalonia)
  else if (tz.startsWith('Europe/Andorra')) { key = 'ca-AD'; }
  // Montenegro
  else if (tz.startsWith('Europe/Podgorica')) { key = 'sr-ME'; }
  // Liechtenstein (before de check)
  else if (tz.startsWith('Europe/Vaduz')) { key = 'de-LI'; }
  // ── Africa ──
  // South Africa
  else if (tz.startsWith('Africa/Johannesburg') || loc === 'af' || loc === 'en-za') { key = 'en-ZA'; }
  // Nigeria
  else if (tz.startsWith('Africa/Lagos') || loc === 'en-ng' || loc === 'ha' || loc === 'yo') { key = 'en-NG'; }
  // Kenya
  else if (tz.startsWith('Africa/Nairobi') || loc === 'en-ke' || loc.startsWith('sw')) { key = 'en-KE'; }
  // Ghana
  else if (tz.startsWith('Africa/Accra') || loc === 'en-gh') { key = 'en-GH'; }
  // Ethiopia
  else if (tz.startsWith('Africa/Addis_Ababa') || loc.startsWith('am')) { key = 'am-ET'; }
  // Tanzania
  else if (tz.startsWith('Africa/Dar_es_Salaam') || loc === 'en-tz') { key = 'sw-TZ'; }
  // Uganda
  else if (tz.startsWith('Africa/Kampala') || loc === 'en-ug') { key = 'en-UG'; }
  // Morocco
  else if (tz.startsWith('Africa/Casablanca') || tz.startsWith('Africa/El_Aaiun') || loc === 'ar-ma') { key = 'ar-MA'; }
  // Tunisia
  else if (tz.startsWith('Africa/Tunis') || loc === 'ar-tn') { key = 'ar-TN'; }
  // Algeria
  else if (tz.startsWith('Africa/Algiers') || loc === 'ar-dz') { key = 'ar-DZ'; }
  // Senegal (XOF zone)
  else if (tz.startsWith('Africa/Dakar') || tz.startsWith('Africa/Bamako') || tz.startsWith('Africa/Ouagadougou') || tz.startsWith('Africa/Niamey') || tz.startsWith('Africa/Abidjan') || tz.startsWith('Africa/Lome') || tz.startsWith('Africa/Cotonou') || tz.startsWith('Africa/Bissau') || loc === 'fr-sn' || loc === 'fr-ml' || loc === 'fr-bf' || loc === 'fr-ne') { key = 'fr-SN'; }
  // Ivory Coast (XOF zone)
  else if (loc === 'fr-ci') { key = 'fr-CI'; }
  // Cameroon (XAF zone)
  else if (tz.startsWith('Africa/Douala') || tz.startsWith('Africa/Yaounde') || tz.startsWith('Africa/Libreville') || tz.startsWith('Africa/Brazzaville') || tz.startsWith('Africa/Bangui') || tz.startsWith('Africa/Ndjamena') || tz.startsWith('Africa/Malabo') || loc === 'fr-cm' || loc === 'fr-ga' || loc === 'fr-cg' || loc === 'fr-cf' || loc === 'fr-td' || loc === 'fr-gq') { key = 'fr-CM'; }
  // Angola
  else if (tz.startsWith('Africa/Luanda') || loc === 'pt-ao') { key = 'pt-AO'; }
  // Mozambique
  else if (tz.startsWith('Africa/Maputo') || loc === 'pt-mz') { key = 'pt-MZ'; }
  // Mauritius
  else if (tz.startsWith('Indian/Mauritius') || loc === 'en-mu') { key = 'en-MU'; }
  // Botswana
  else if (tz.startsWith('Africa/Gaborone') || loc === 'en-bw') { key = 'en-BW'; }
  // Namibia
  else if (tz.startsWith('Africa/Windhoek') || loc === 'en-na') { key = 'en-NA'; }
  // Zambia
  else if (tz.startsWith('Africa/Lusaka') || loc === 'en-zm') { key = 'en-ZM'; }
  // Zimbabwe
  else if (tz.startsWith('Africa/Harare') || loc === 'en-zw') { key = 'en-ZW'; }
  // Sudan
  else if (tz.startsWith('Africa/Khartoum') || loc === 'ar-sd') { key = 'ar-SD'; }
  // Rwanda
  else if (tz.startsWith('Africa/Kigali') || loc.startsWith('rw')) { key = 'rw-RW'; }
  // Eurozone (de, fr) — language prefix (after non-EU timezone checks)
  else if (loc.startsWith('de')) {
    key = 'de-DE';
  }
  else if (loc.startsWith('fr')) {
    key = 'fr-FR';
  }
  // Japan
  else if (tz.startsWith('Asia/Tokyo') || loc.startsWith('ja')) {
    key = 'ja-JP';
  }
  // Korea
  else if (tz.startsWith('Asia/Seoul') || loc.startsWith('ko')) {
    key = 'ko-KR';
  }
  // China
  else if (tz.startsWith('Asia/Shanghai') || tz.startsWith('Asia/Beijing') || tz.startsWith('Asia/Chongqing') || tz.startsWith('Asia/Harbin') || tz.startsWith('Asia/Urumqi') || (loc.startsWith('zh') && loc.indexOf('cn') !== -1)) {
    key = 'zh-CN';
  }
  // Canada: timezones or en-CA locale
  else if (tz.startsWith('America/Toronto') || tz.startsWith('America/Vancouver') || tz.startsWith('America/Edmonton') || tz.startsWith('America/Winnipeg') || tz.startsWith('America/Halifax') || tz.startsWith('America/St_Johns') || tz.startsWith('America/Regina') || tz.startsWith('America/Rankin_Inlet') || tz.startsWith('America/Iqaluit') || tz.startsWith('America/Cambridge_Bay') || tz.startsWith('America/Inuvik') || tz.startsWith('America/Yellowknife') || tz.startsWith('America/Whitehorse') || loc === 'en-ca') {
    key = 'en-CA';
  }

  // ── 展示 locale → 结算币（非 16 币一律 usd；欧元区多国共用 eur 一行）──
  var CC = { 'ms-MY':'myr','zh-TW':'twd','zh-HK':'hkd','id-ID':'idr','vi-VN':'vnd','th-TH':'thb','hi-IN':'inr',
    'en-SG':'sgd','en-PH':'php','en-AU':'aud','en-CA':'cad','en-GB':'gbp','ja-JP':'jpy','ko-KR':'krw',
    'de-DE':'eur','fr-FR':'eur','fr-MC':'eur','it-SM':'eur','ca-AD':'eur','sr-ME':'eur','fr-GF':'eur' };
  // 欧元区主时区兜底：原链只列 de/fr 语言 + 摩纳哥等小国，西/意/荷/葡等大欧元区漏检 → 误落 usd；
  // 命中则借任一 eur 映射行（de-DE）定币。（非欧元区的欧洲国家时区已在上方各自分支捕获 → 走其 CC/默认 usd。）
  var EU_TZ = ['Europe/Lisbon','Europe/Madrid','Europe/Paris','Europe/Berlin','Europe/Rome','Europe/Amsterdam',
    'Europe/Brussels','Europe/Vienna','Europe/Warsaw','Europe/Prague','Europe/Budapest','Europe/Bucharest',
    'Europe/Athens','Europe/Helsinki','Europe/Dublin','Europe/Luxembourg','Europe/Malta','Europe/Nicosia',
    'Europe/Bratislava','Europe/Ljubljana','Europe/Zagreb','Europe/Sofia','Europe/Vilnius','Europe/Riga',
    'Europe/Tallinn','Europe/Stockholm','Europe/Copenhagen'];
  if (key === 'default' && EU_TZ.some(function (t) { return tz.startsWith(t); })) key = 'de-DE';
  var currency = CC[key] || 'usd';
  var row = PREM[currency] || PREM.usd;

  // Expose for use on pricing page（currency = 实扣币；label/price = 该币显示值）
  window.SlatiPrice = {
    key: key,
    currency: currency,
    label: row.label,
    price: row.premium,
    all: PREM,
    loc: loc,
    tz: tz
  };

  // Auto-apply to any element with [data-slati-price] attribute
  document.querySelectorAll('[data-slati-price]').forEach(function(el) {
    el.textContent = row.premium;
  });
})();
