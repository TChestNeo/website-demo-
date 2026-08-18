// M.NationWorld — region-aware pricing detection
// Shared across all pages with subscription cards
(function(){
  var prices = {
    'ms-MY':  'RM23.50',
    'zh-TW':  'NT$182.99',
    'zh-HK':  'HK$44.99',
    'zh-MO':  'MOP$45.99',
    'id-ID':  'Rp 103,000',
    'vi-VN':  '₫299,000',
    'th-TH':  '฿399',
    'my-MM':  'K 25,000',
    'hi-IN':  '₹899',
    'ur-PK':  '₨3,300',
    'bn-BD':  '৳1,350',
    'si-LK':  'රු3,600',
    'ne-NP':  'रू1,600',
    'dz-BT':  'Nu. 1,000',
    'dv-MV':  'ރ185',
    'fa-AF':  '؋870',
    'kk-KZ':  '₸5,500',
    'uz-UZ':  'so\'m 145,000',
    'tk-TM':  'm 209',
    'ky-KG':  'с 1,050',
    'tg-TJ':  'с 130',
    'en-AU':  'A$17.99',
    'en-NZ':  'NZ$19.99',
    'en-FJ':  'FJ$27.00',
    'en-PG':  'K 47.00',
    'en-WS':  'T 33',
    'en-TO':  'T$28',
    'en-ZA':  'R 219',
    'en-NG':  '₦18,500',
    'en-KE':  'KSh 1,550',
    'en-GH':  'GH₵185',
    'am-ET':  'Br 1,500',
    'sw-TZ':  'TSh 31,000',
    'en-UG':  'USh 44,000',
    'ar-MA':  'MAD 120',
    'ar-TN':  'DT 37',
    'ar-DZ':  'DA 1,580',
    'fr-SN':  '7,800 F',
    'fr-CI':  '7,800 F',
    'fr-CM':  '7,800 F',
    'pt-AO':  'Kz 10,000',
    'pt-MZ':  'MT 770',
    'en-MU':  '₨ 545',
    'en-BW':  'P 165',
    'en-NA':  'N$219',
    'en-ZM':  'ZK 320',
    'ar-SD':  'SDG 7,500',
    'rw-RW':  'FRw 15,500',
    'en-GB':  '£9.99',
    'nb-NO':  'kr 129',
    'de-CH':  'CHF 11.00',
    'de-LI':  'CHF 11.00',
    'is-IS':  'kr 1,699',
    'sq-AL':  'L 1,100',
    'bs-BA':  'KM 22.00',
    'sr-RS':  'RSD 1,300',
    'sr-ME':  '€11.99',
    'mk-MK':  'ден 690',
    'ro-MD':  'MDL 215',
    'uk-UA':  '₴450',
    'be-BY':  'Br 39.00',
    'ru-RU':  '₽1,090',
    'fr-MC':  '€11.99',
    'it-SM':  '€11.99',
    'ca-AD':  '€11.99',
    'de-DE':  '€11.99',
    'fr-FR':  '€11.99',
    'ja-JP':  '¥1,800',
    'ko-KR':  '₩15,000',
    'zh-CN':  '$11.99',
    'en-CA':  'C$15.99',
    'es-MX':  'MXN$230',
    'ar-SA':  'SAR 44.99',
    'ar-AE':  'AED 44.00',
    'ar-QA':  'QAR 43.50',
    'ar-KW':  'KWD 3.600',
    'ar-BH':  'BHD 4.500',
    'ar-OM':  'OMR 4.600',
    'ar-JO':  'JOD 8.500',
    'he-IL':  '₪45.00',
    'ar-LB':  'LBP 1,070,000',
    'ar-IQ':  'IQD 15,700',
    'fa-IR':  'IRR 500,000',
    'ar-EG':  'EGP 599',
    'tr-TR':  'TRY 429',
    'pt-BR':  'R$59.90',
    'es-AR':  'ARS$12,000',
    'es-CL':  'CLP$10,990',
    'es-CO':  'COP$46,900',
    'es-PE':  'S/45.90',
    'es-UY':  '$U479',
    'es-PY':  '₲87,000',
    'es-BO':  'Bs 83',
    'es-EC':  '$11.99',
    'es-VE':  '$11.99',
    'en-GY':  'G$2,500',
    'nl-SR':  'SRD$439',
    'fr-GF':  '€11.99',
    'en-US':  '$11.99',
    'default': '$11.99'
  };

  var loc = (navigator.language || 'en-US').toLowerCase();
  var tz = '';
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch(e) {}

  var key = 'default';

  // ── Timezone + language prefix detection (most accurate first) ──

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

  // Expose for use on pricing page
  window.SlatiPrice = {
    key: key,
    price: prices[key] || prices['default'],
    all: prices,
    loc: loc,
    tz: tz
  };

  // Auto-apply to any element with [data-slati-price] attribute
  document.querySelectorAll('[data-slati-price]').forEach(function(el) {
    el.textContent = prices[key] || prices['default'];
  });
})();
