/**
 * ticket.i18n.js — 人工工单页（docs/pages/ticket.html）词典
 * v0.2.54.0 全站 12 语言；zh-Hant 由 OpenCC 脚本自动生成（勿手写）。
 * 术语表见 common.i18n.js（品牌词不译：M.NationWorld/Discord）。
 * zh 值逐字节=旧 ticket.zh.js 原文；UI 动词/状态词按各语言客服产品惯例翻译。
 * 工单类目/问题类型选项部分由页面内联 JS 按 key 动态生成（MN_I18N.apply 渲染）。
 */
window.MN_I18N
  .add('zh', {
    'meta.title': '人工工单 | M.NationWorld',

    'hero.title': '人工工单',
    'hero.sub': '需要特别权限、或 AI 客服无法处理的事项（支付与账单、创作者结算、账号与处罚申诉、隐私请求等），请在此提交人工工单。',

    'fact.1': '首个人工回复目标：3 天内',
    'fact.2': '工单由人工受理，不经过 AI 客服',
    'fact.3': '客服不会索要密码、验证码或支付信息',

    'form.title': '提交工单',
    'form.label.category': '工单类型',
    'form.category.bug': '问题反馈',
    'form.category.account': '账户问题',
    'form.category.payment': '支付与账单',
    'form.category.payout': '创作者结算',
    'form.category.suggestion': '意见与建议',
    'form.label.type': '问题类型',
    'form.type.refund': '退款问题',
    'form.type.billing': '账单争议',
    'form.type.account': '账号申诉',
    'form.type.penalty': '处罚申诉',
    'form.type.privacy': '隐私请求',
    'form.type.other': '其他',
    // 问题反馈组的“问题类型”选项
    'form.type.bug.display': '页面显示异常',
    'form.type.bug.feature': '功能异常',
    'form.type.bug.editor': '编辑器问题',
    'form.type.bug.translation': '翻译错误',
    'form.type.bug.payment': '支付与订阅异常',
    'form.type.bug.other': '其他 bug',
    // 账户问题组
    'form.type.account.login': '登录与验证问题',
    'form.type.account.hijack': '账号被盗',
    // 支付与账单组
    'form.type.payment.failed': '支付失败',
    'form.type.payment.duplicate': '重复扣费',
    'form.type.payment.subscription': '订阅管理与取消',
    // 创作者结算组
    'form.type.payout.query': '结算查询',
    'form.type.payout.withdrawal': '提现问题',
    'form.type.payout.chargeback': '拒付回扣异议',
    'form.type.payout.share': '分成异议',
    // 意见与建议组
    'form.type.suggestion.feature': '功能建议',
    'form.type.suggestion.ux': '体验反馈',
    'form.type.suggestion.other': '其他建议',
    'form.label.contact': '电子邮件',
    'form.placeholder.contact': '例如 name@example.com',
    'form.label.subject': '标题',
    'form.placeholder.subject': '一句话说明问题',
    'form.label.desc': '详细描述',
    'form.placeholder.desc': '请描述：发生了什么、发生时间、相关订单号或内容链接、您期望的处理结果',
    'form.btn.submit': '生成并复制工单内容',
    'form.hint': '点击后将生成格式化工单内容并复制，请粘贴到官方 Discord 伺服器的工单频道提交。',
    'form.alert.incomplete': '请填写完整（工单类型、联系方式、标题、描述）',
    'form.alert.email': '请输入有效的电子邮件地址',

    // 生成工单文本时的字段前缀
    'form.field.category': '【工单类型】',
    'form.field.type': '【问题类型】',
    'form.field.contact': '【电子邮件】',
    'form.field.subject': '【标题】',
    'form.field.desc': '【描述】',

    'done.title': '工单内容已生成',
    'done.intro': '内容已复制到剪贴板（若未自动复制，请点击下方文本框全选后手动复制），然后按以下步骤提交：',
    'done.step1': '前往官方 Discord 伺服器',
    'done.step2': '在工单频道粘贴并发送',
    'done.step3': '管理员按队列处理（紧急事项优先），首个人工回复目标 3 天内',
    'done.join': '加入伺服器',
    'done.note': '站内工单系统尚未直连，Discord 粘贴为当前提交渠道；系统上线后，此处提交将自动进入排队。',

    // 后端模式成功面板（后端上线后启用，编号/排队位置由 JS 填入）
    'doneapi.title': '工单已提交',
    'doneapi.body': '工单已进入排队处理，编号：',
    'doneapi.bodyPos': '，当前排在第',
    'doneapi.bodyPosSuffix': '位',
    'doneapi.note': '首个人工回复目标为 3 天内；处理进展将通过您留下的电子邮件告知。',

    'fraud': '⚠️ 防诈骗提示：平台客服在正常情况下不会主动私信联系你；特殊情况下（如账号安全核查、订单异常处理）运营团队会以官方名义主动联系，并会先出示官方验证码（12 小时内有效）自证身份——你可以前往帮助中心「验证官方人员身份」输入验证码核实，验证结果会显示验证码的创建时间，以及该工作人员的化名、职位与负责事项。官方人员无论何种情况都不会向你索要密码、短信验证码或支付信息；任何不出示验证码、验证码无效、或索要上述信息的“官方私信”均为冒充，请勿回应，并前往官方 Discord 社区核实或举报。'
  })
  .add('en', {
    'meta.title': 'Support Ticket | M.NationWorld',

    'hero.title': 'Support Ticket',
    'hero.sub': 'For matters that require special permissions or cannot be handled by the AI support (payments and billing, creator payouts, account and penalty appeals, privacy requests, etc.), please submit a support ticket here.',

    'fact.1': 'First human reply target: within 3 days',
    'fact.2': 'Tickets are handled by humans, not through the AI support',
    'fact.3': 'Support will never ask for your password, verification code or payment details',

    'form.title': 'Submit a Ticket',
    'form.label.category': 'Ticket Category',
    'form.category.bug': 'Issue Report',
    'form.category.account': 'Account Issue',
    'form.category.payment': 'Payment & Billing',
    'form.category.payout': 'Creator Payout',
    'form.category.suggestion': 'Feedback & Suggestions',
    'form.label.type': 'Issue Type',
    'form.type.refund': 'Refund Issue',
    'form.type.billing': 'Billing Dispute',
    'form.type.account': 'Account Appeal',
    'form.type.penalty': 'Penalty Appeal',
    'form.type.privacy': 'Privacy Request',
    'form.type.other': 'Other',
    // 问题反馈组的“问题类型”选项
    'form.type.bug.display': 'Page Display Issue',
    'form.type.bug.feature': 'Feature Malfunction',
    'form.type.bug.editor': 'Editor Issue',
    'form.type.bug.translation': 'Translation Error',
    'form.type.bug.payment': 'Payment & Subscription Issue',
    'form.type.bug.other': 'Other Bug',
    // 账户问题组
    'form.type.account.login': 'Login & Verification Issue',
    'form.type.account.hijack': 'Account Hijacked',
    // 支付与账单组
    'form.type.payment.failed': 'Payment Failed',
    'form.type.payment.duplicate': 'Duplicate Charge',
    'form.type.payment.subscription': 'Subscription Management & Cancellation',
    // 创作者结算组
    'form.type.payout.query': 'Payout Inquiry',
    'form.type.payout.withdrawal': 'Withdrawal Issue',
    'form.type.payout.chargeback': 'Chargeback Dispute',
    'form.type.payout.share': 'Revenue Share Dispute',
    // 意见与建议组
    'form.type.suggestion.feature': 'Feature Suggestion',
    'form.type.suggestion.ux': 'Experience Feedback',
    'form.type.suggestion.other': 'Other Suggestion',
    'form.label.contact': 'Email',
    'form.placeholder.contact': 'e.g. name@example.com',
    'form.label.subject': 'Subject',
    'form.placeholder.subject': 'Summarize the issue in one sentence',
    'form.label.desc': 'Detailed Description',
    'form.placeholder.desc': 'Please describe: what happened, when it happened, the related order number or content link, and the outcome you expect',
    'form.btn.submit': 'Generate & Copy Ticket Content',
    'form.hint': 'Clicking this will generate and copy a formatted ticket — paste it in the ticket channel of the official Discord server to submit.',
    'form.alert.incomplete': 'Please fill in all required fields (ticket category, contact, subject, description)',
    'form.alert.email': 'Please enter a valid email address',

    // 生成工单文本时的字段前缀
    'form.field.category': '[Ticket Category]',
    'form.field.type': '[Issue Type]',
    'form.field.contact': '[Email]',
    'form.field.subject': '[Subject]',
    'form.field.desc': '[Description]',

    'done.title': 'Ticket Content Generated',
    'done.intro': 'The content has been copied to the clipboard (if not, click the text box below to select all and copy manually), then submit it as follows:',
    'done.step1': 'Go to the official Discord server',
    'done.step2': 'Paste and send it in the ticket channel',
    'done.step3': 'Admins handle tickets in queue order (urgent matters first); first human reply target within 3 days',
    'done.join': 'Join Server',
    'done.note': 'The on-site ticket system is not yet connected — pasting in Discord is the current submission channel. Once the system is live, submissions here will automatically enter the queue.',

    // 后端模式成功面板（后端上线后启用，编号/排队位置由 JS 填入）
    'doneapi.title': 'Ticket Submitted',
    'doneapi.body': 'Your ticket has entered the queue, number: ',
    'doneapi.bodyPos': ', currently at position ',
    'doneapi.bodyPosSuffix': '',
    'doneapi.note': 'The first human reply is targeted within 3 days; progress will be sent to the email you provided.',

    'fraud': '⚠️ Anti-fraud notice: Under normal circumstances, platform support will not contact you proactively via private messages. In special cases (such as account security checks or order issue handling), the operations team may contact you officially and will first present an official verification code (valid for 12 hours) to prove their identity — you can go to the Help Center under "Verify Official Identity", enter the code to verify it, and the result will show the code\'s creation time, the staff member\'s pseudonym, position and responsibilities. Official staff will never ask you for your password, SMS verification code or payment details under any circumstances; any "official private message" that does not present a verification code, presents an invalid one, or asks for such information is an impersonation — do not respond, and verify or report it in the official Discord community.'
  })
  .add('de', {
    'meta.title': 'Support-Ticket | M.NationWorld',

    'hero.title': 'Support-Ticket',
    'hero.sub': 'Für Angelegenheiten, die Sonderrechte erfordern oder die der KI-Support nicht bearbeiten kann (Zahlung & Abrechnung, Auszahlungen an Creator, Einsprüche zu Konten und Strafen, Datenschutzanfragen usw.), reiche bitte hier ein Support-Ticket ein.',

    'fact.1': 'Ziel für die erste menschliche Antwort: innerhalb von 3 Tagen',
    'fact.2': 'Tickets werden von Menschen bearbeitet, nicht vom KI-Support',
    'fact.3': 'Der Support fragt niemals nach Passwort, Bestätigungscode oder Zahlungsdaten',

    'form.title': 'Ticket einreichen',
    'form.label.category': 'Ticket-Kategorie',
    'form.category.bug': 'Problem melden',
    'form.category.account': 'Kontoproblem',
    'form.category.payment': 'Zahlung & Abrechnung',
    'form.category.payout': 'Creator-Auszahlung',
    'form.category.suggestion': 'Feedback & Vorschläge',
    'form.label.type': 'Problemtyp',
    'form.type.refund': 'Erstattungsproblem',
    'form.type.billing': 'Abrechnungsstreit',
    'form.type.account': 'Konto-Einspruch',
    'form.type.penalty': 'Einspruch gegen Strafe',
    'form.type.privacy': 'Datenschutzanfrage',
    'form.type.other': 'Sonstiges',
    // 问题反馈组的“问题类型”选项
    'form.type.bug.display': 'Anzeigefehler der Seite',
    'form.type.bug.feature': 'Funktionsfehler',
    'form.type.bug.editor': 'Editor-Problem',
    'form.type.bug.translation': 'Übersetzungsfehler',
    'form.type.bug.payment': 'Zahlungs- & Abo-Störung',
    'form.type.bug.other': 'Anderer Bug',
    // 账户问题组
    'form.type.account.login': 'Anmelde- & Verifizierungsproblem',
    'form.type.account.hijack': 'Konto gehackt',
    // 支付与账单组
    'form.type.payment.failed': 'Zahlung fehlgeschlagen',
    'form.type.payment.duplicate': 'Doppelte Abbuchung',
    'form.type.payment.subscription': 'Abo-Verwaltung & Kündigung',
    // 创作者结算组
    'form.type.payout.query': 'Auszahlungsabfrage',
    'form.type.payout.withdrawal': 'Auszahlungsproblem',
    'form.type.payout.chargeback': 'Einspruch gegen Rückbuchung',
    'form.type.payout.share': 'Einspruch zur Erlösbeteiligung',
    // 意见与建议组
    'form.type.suggestion.feature': 'Funktionsvorschlag',
    'form.type.suggestion.ux': 'Erfahrungsfeedback',
    'form.type.suggestion.other': 'Sonstiger Vorschlag',
    'form.label.contact': 'E-Mail',
    'form.placeholder.contact': 'z. B. name@example.com',
    'form.label.subject': 'Betreff',
    'form.placeholder.subject': 'Beschreibe das Problem in einem Satz',
    'form.label.desc': 'Ausführliche Beschreibung',
    'form.placeholder.desc': 'Bitte beschreibe: was passiert ist, wann es passiert ist, die zugehörige Bestellnummer oder den Inhaltslink sowie das erwartete Ergebnis',
    'form.btn.submit': 'Ticketinhalt erstellen & kopieren',
    'form.hint': 'Beim Klicken wird ein formatiertes Ticket erstellt und kopiert — füge es im Ticket-Kanal des offiziellen Discord-Servers ein, um es einzureichen.',
    'form.alert.incomplete': 'Bitte alles ausfüllen (Ticket-Kategorie, Kontakt, Betreff, Beschreibung)',
    'form.alert.email': 'Bitte eine gültige E-Mail-Adresse eingeben',

    // 生成工单文本时的字段前缀
    'form.field.category': '[Ticket-Kategorie]',
    'form.field.type': '[Problemtyp]',
    'form.field.contact': '[E-Mail]',
    'form.field.subject': '[Betreff]',
    'form.field.desc': '[Beschreibung]',

    'done.title': 'Ticketinhalt erstellt',
    'done.intro': 'Der Inhalt wurde in die Zwischenablage kopiert (falls nicht, klicke auf das Textfeld unten, wähle alles aus und kopiere manuell). Reiche ihn dann wie folgt ein:',
    'done.step1': 'Gehe zum offiziellen Discord-Server',
    'done.step2': 'Füge ihn im Ticket-Kanal ein und sende ihn ab',
    'done.step3': 'Admins bearbeiten Tickets in der Reihenfolge der Warteschlange (dringende Fälle zuerst); Ziel für die erste menschliche Antwort: innerhalb von 3 Tagen',
    'done.join': 'Server beitreten',
    'done.note': 'Das interne Ticket-System ist noch nicht angebunden — das Einfügen in Discord ist der aktuelle Einreichungsweg. Sobald das System live ist, gelangen Einreichungen hier automatisch in die Warteschlange.',

    // 后端模式成功面板（后端上线后启用，编号/排队位置由 JS 填入）
    'doneapi.title': 'Ticket eingereicht',
    'doneapi.body': 'Das Ticket wurde zur Bearbeitung in die Warteschlange aufgenommen, Nummer: ',
    'doneapi.bodyPos': ', aktuell an Position ',
    'doneapi.bodyPosSuffix': '',
    'doneapi.note': 'Ziel für die erste menschliche Antwort: innerhalb von 3 Tagen. Den Fortschritt senden wir an die von dir hinterlassene E-Mail-Adresse.',

    'fraud': '⚠️ Betrugswarnung: Unter normalen Umständen kontaktiert dich der Support der Plattform nicht aktiv per Privatnachricht. In besonderen Fällen (z. B. Sicherheitsprüfung des Kontos, Bearbeitung von Bestellungsstörungen) kann das Betriebsteam dich offiziell aktiv kontaktieren und weist sich zunächst mit einem offiziellen Bestätigungscode aus (12 Stunden gültig) — du kannst im Hilfe-Center unter „Offizielle Identität bestätigen" den Code eingeben; das Ergebnis zeigt die Erstellungszeit des Codes sowie Pseudonym, Position und Aufgabenbereich des Mitarbeiters. Offizielle Mitarbeiter fragen dich unter keinen Umständen nach Passwort, SMS-Bestätigungscode oder Zahlungsdaten. Jede „offizielle Privatnachricht" ohne Bestätigungscode, mit ungültigem Code oder mit der Bitte um solche Informationen ist ein Identitätsbetrug — antworte nicht und kläre oder melde den Fall in der offiziellen Discord-Community.'
  })
  .add('ru', {
    'meta.title': 'Тикет в поддержку | M.NationWorld',

    'hero.title': 'Тикет в поддержку',
    'hero.sub': 'По вопросам, требующим особых прав или которые ИИ-поддержка не может обработать (оплата и счета, выплаты авторам, апелляции по аккаунтам и наказаниям, запросы о приватности и т. д.), отправьте тикет здесь.',

    'fact.1': 'Цель первого ответа человека: в течение 3 дней',
    'fact.2': 'Тикеты обрабатывают люди, а не ИИ-поддержка',
    'fact.3': 'Поддержка никогда не запросит пароль, код подтверждения или платёжные данные',

    'form.title': 'Отправить тикет',
    'form.label.category': 'Категория тикета',
    'form.category.bug': 'Сообщить о проблеме',
    'form.category.account': 'Проблема с аккаунтом',
    'form.category.payment': 'Оплата и счета',
    'form.category.payout': 'Выплаты авторам',
    'form.category.suggestion': 'Отзывы и предложения',
    'form.label.type': 'Тип проблемы',
    'form.type.refund': 'Возврат средств',
    'form.type.billing': 'Спор по счёту',
    'form.type.account': 'Апелляция по аккаунту',
    'form.type.penalty': 'Апелляция по наказанию',
    'form.type.privacy': 'Запрос о приватности',
    'form.type.other': 'Другое',
    // 问题反馈组的“问题类型”选项
    'form.type.bug.display': 'Ошибка отображения страницы',
    'form.type.bug.feature': 'Сбой функции',
    'form.type.bug.editor': 'Проблема редактора',
    'form.type.bug.translation': 'Ошибка перевода',
    'form.type.bug.payment': 'Сбой оплаты и подписки',
    'form.type.bug.other': 'Другой баг',
    // 账户问题组
    'form.type.account.login': 'Проблема входа и подтверждения',
    'form.type.account.hijack': 'Аккаунт взломан',
    // 支付与账单组
    'form.type.payment.failed': 'Платёж не прошёл',
    'form.type.payment.duplicate': 'Повторное списание',
    'form.type.payment.subscription': 'Управление подпиской и отмена',
    // 创作者结算组
    'form.type.payout.query': 'Запрос по выплатам',
    'form.type.payout.withdrawal': 'Проблема вывода средств',
    'form.type.payout.chargeback': 'Возражение по чарджбэку',
    'form.type.payout.share': 'Спор о распределении дохода',
    // 意见与建议组
    'form.type.suggestion.feature': 'Предложение функции',
    'form.type.suggestion.ux': 'Отзыв об опыте использования',
    'form.type.suggestion.other': 'Другое предложение',
    'form.label.contact': 'Электронная почта',
    'form.placeholder.contact': 'Например name@example.com',
    'form.label.subject': 'Тема',
    'form.placeholder.subject': 'Опишите проблему одним предложением',
    'form.label.desc': 'Подробное описание',
    'form.placeholder.desc': 'Пожалуйста, опишите: что произошло, когда это произошло, номер заказа или ссылку на контент и ожидаемый результат',
    'form.btn.submit': 'Создать и скопировать текст тикета',
    'form.hint': 'При нажатии будет создан и скопирован форматированный текст тикета — вставьте его в канал тикетов официального сервера Discord для отправки.',
    'form.alert.incomplete': 'Пожалуйста, заполните всё (категория тикета, контакты, тема, описание)',
    'form.alert.email': 'Пожалуйста, введите действующий адрес электронной почты',

    // 生成工单文本时的字段前缀
    'form.field.category': '[Категория тикета]',
    'form.field.type': '[Тип проблемы]',
    'form.field.contact': '[Электронная почта]',
    'form.field.subject': '[Тема]',
    'form.field.desc': '[Описание]',

    'done.title': 'Текст тикета создан',
    'done.intro': 'Текст скопирован в буфер обмена (если нет — нажмите на текстовое поле ниже, выберите всё и скопируйте вручную), затем отправьте его следующим образом:',
    'done.step1': 'Перейдите на официальный сервер Discord',
    'done.step2': 'Вставьте и отправьте его в канале тикетов',
    'done.step3': 'Администраторы обрабатывают тикеты в порядке очереди (срочные вопросы в первую очередь); цель первого ответа человека — в течение 3 дней',
    'done.join': 'Присоединиться к серверу',
    'done.note': 'Внутренняя система тикетов ещё не подключена — вставка в Discord сейчас является каналом подачи. Когда система заработает, отправленные здесь тикеты будут автоматически попадать в очередь.',

    // 后端模式成功面板（后端上线后启用，编号/排队位置由 JS 填入）
    'doneapi.title': 'Тикет отправлен',
    'doneapi.body': 'Тикет поставлен в очередь на обработку, номер: ',
    'doneapi.bodyPos': ', в настоящее время на позиции ',
    'doneapi.bodyPosSuffix': '',
    'doneapi.note': 'Цель первого ответа человека — в течение 3 дней; о ходе обработки сообщим на указанный вами адрес электронной почты.',

    'fraud': '⚠️ Предупреждение о мошенничестве: в обычных условиях поддержка платформы не пишет вам первой в личных сообщениях. В особых случаях (проверка безопасности аккаунта, обработка ошибок заказов) операционная команда может официально связаться с вами по своей инициативе и сначала предъявит официальный код подтверждения (действителен 12 часов) для подтверждения личности — вы можете ввести код в Центре помощи в разделе «Подтверждение личности официального сотрудника»; результат покажет время создания кода, псевдоним, должность и круг обязанностей сотрудника. Официальные сотрудники ни при каких обстоятельствах не попросят у вас пароль, SMS-код подтверждения или платёжные данные. Любое «официальное личное сообщение» без кода подтверждения, с недействительным кодом или с запросом такой информации является выдачей себя за другого — не отвечайте, проверьте или сообщите об этом в официальном сообществе Discord.'
  })
  .add('ms', {
    'meta.title': 'Tiket Sokongan | M.NationWorld',

    'hero.title': 'Tiket Sokongan',
    'hero.sub': 'Untuk perkara yang memerlukan kebenaran khas atau tidak dapat dikendalikan oleh sokongan AI (pembayaran dan bil, pembayaran kreator, rayuan akaun dan hukuman, permintaan privasi, dll.), sila hantar tiket sokongan di sini.',

    'fact.1': 'Sasaran balasan manusia pertama: dalam 3 hari',
    'fact.2': 'Tiket dikendalikan oleh manusia, bukan melalui sokongan AI',
    'fact.3': 'Sokongan tidak akan meminta kata laluan, kod pengesahan atau maklumat pembayaran',

    'form.title': 'Hantar Tiket',
    'form.label.category': 'Kategori Tiket',
    'form.category.bug': 'Laporan Masalah',
    'form.category.account': 'Masalah Akaun',
    'form.category.payment': 'Pembayaran & Bil',
    'form.category.payout': 'Pembayaran Kreator',
    'form.category.suggestion': 'Maklum Balas & Cadangan',
    'form.label.type': 'Jenis Masalah',
    'form.type.refund': 'Masalah Bayaran Balik',
    'form.type.billing': 'Pertikaian Bil',
    'form.type.account': 'Rayuan Akaun',
    'form.type.penalty': 'Rayuan Hukuman',
    'form.type.privacy': 'Permintaan Privasi',
    'form.type.other': 'Lain-lain',
    // 问题反馈组的“问题类型”选项
    'form.type.bug.display': 'Ralat Paparan Halaman',
    'form.type.bug.feature': 'Fungsi Tidak Berfungsi',
    'form.type.bug.editor': 'Masalah Editor',
    'form.type.bug.translation': 'Ralat Terjemahan',
    'form.type.bug.payment': 'Gangguan Pembayaran & Langganan',
    'form.type.bug.other': 'Bug Lain',
    // 账户问题组
    'form.type.account.login': 'Masalah Log Masuk & Pengesahan',
    'form.type.account.hijack': 'Akaun Dicuri',
    // 支付与账单组
    'form.type.payment.failed': 'Pembayaran Gagal',
    'form.type.payment.duplicate': 'Caj Berganda',
    'form.type.payment.subscription': 'Pengurusan & Pembatalan Langganan',
    // 创作者结算组
    'form.type.payout.query': 'Pertanyaan Pembayaran',
    'form.type.payout.withdrawal': 'Masalah Pengeluaran',
    'form.type.payout.chargeback': 'Pertikaian Caj Balik',
    'form.type.payout.share': 'Pertikaian Kongsi Hasil',
    // 意见与建议组
    'form.type.suggestion.feature': 'Cadangan Fungsi',
    'form.type.suggestion.ux': 'Maklum Balas Pengalaman',
    'form.type.suggestion.other': 'Cadangan Lain',
    'form.label.contact': 'E-mel',
    'form.placeholder.contact': 'cth. name@example.com',
    'form.label.subject': 'Tajuk',
    'form.placeholder.subject': 'Terangkan masalah dalam satu ayat',
    'form.label.desc': 'Penerangan Terperinci',
    'form.placeholder.desc': 'Sila terangkan: apa yang berlaku, bila ia berlaku, nombor pesanan atau pautan kandungan berkaitan, dan hasil yang anda harapkan',
    'form.btn.submit': 'Jana & Salin Kandungan Tiket',
    'form.hint': 'Mengklik akan menjana dan menyalin tiket berformat — tampalkannya di saluran tiket pelayan Discord rasmi untuk menghantar.',
    'form.alert.incomplete': 'Sila lengkapkan semua (kategori tiket, maklumat hubungan, tajuk, penerangan)',
    'form.alert.email': 'Sila masukkan alamat e-mel yang sah',

    // 生成工单文本时的字段前缀
    'form.field.category': '[Kategori Tiket]',
    'form.field.type': '[Jenis Masalah]',
    'form.field.contact': '[E-mel]',
    'form.field.subject': '[Tajuk]',
    'form.field.desc': '[Penerangan]',

    'done.title': 'Kandungan Tiket Telah Dijana',
    'done.intro': 'Kandungan telah disalin ke papan keratan (jika tidak, sila klik kotak teks di bawah, pilih semua dan salin secara manual), kemudian hantar mengikut langkah berikut:',
    'done.step1': 'Pergi ke pelayan Discord rasmi',
    'done.step2': 'Tampalkan dan hantar di saluran tiket',
    'done.step3': 'Pentadbir memproses tiket mengikut giliran (perkara kecemasan diutamakan); sasaran balasan manusia pertama dalam 3 hari',
    'done.join': 'Sertai Pelayan',
    'done.note': 'Sistem tiket dalam platform belum bersambung terus — menampal di Discord ialah saluran penghantaran semasa. Selepas sistem dilancarkan, penghantaran di sini akan masuk ke barisan secara automatik.',

    // 后端模式成功面板（后端上线后启用，编号/排队位置由 JS 填入）
    'doneapi.title': 'Tiket Telah Dihantar',
    'doneapi.body': 'Tiket telah masuk ke barisan untuk diproses, nombor: ',
    'doneapi.bodyPos': ', kini berada di kedudukan ',
    'doneapi.bodyPosSuffix': '',
    'doneapi.note': 'Sasaran balasan manusia pertama ialah dalam 3 hari; kemajuan pemprosesan akan dimaklumkan melalui e-mel yang anda berikan.',

    'fraud': '⚠️ Amaran anti-penipuan: Dalam keadaan biasa, sokongan platform tidak akan menghubungi anda secara proaktif melalui mesej peribadi. Dalam keadaan khas (seperti semakan keselamatan akaun, pengendalian anomali pesanan), pasukan operasi akan menghubungi anda secara rasmi dan terlebih dahulu menunjukkan kod pengesahan rasmi (sah selama 12 jam) untuk membuktikan identiti — anda boleh pergi ke Pusat Bantuan di bawah "Sahkan Identiti Pegawai Rasmi" dan masukkan kod untuk menyemak; hasil pengesahan akan menunjukkan masa penciptaan kod, nama samaran, jawatan dan tanggungjawab pegawai tersebut. Pegawai rasmi tidak akan meminta kata laluan, kod pengesahan SMS atau maklumat pembayaran daripada anda dalam apa jua keadaan; mana-mana "mesej peribadi rasmi" yang tidak menunjukkan kod pengesahan, kod tidak sah, atau meminta maklumat tersebut adalah penyamaran — jangan balas, dan sahkan atau laporkan di komuniti Discord rasmi.'
  })
  .add('th', {
    'meta.title': 'ตั๋วฝ่ายสนับสนุน | M.NationWorld',

    'hero.title': 'ตั๋วฝ่ายสนับสนุน',
    'hero.sub': 'สำหรับเรื่องที่ต้องใช้สิทธิพิเศษหรือฝ่ายสนับสนุน AI ไม่สามารถจัดการได้ (การชำระเงินและใบแจ้งหนี้ การจ่ายเงินให้ครีเอเตอร์ การอุทธรณ์บัญชีและการลงโทษ คำขอความเป็นส่วนตัว ฯลฯ) โปรดส่งตั๋วที่นี่',

    'fact.1': 'เป้าหมายการตอบกลับโดยเจ้าหน้าที่ครั้งแรก: ภายใน 3 วัน',
    'fact.2': 'ตั๋วจัดการโดยเจ้าหน้าที่ ไม่ผ่านฝ่ายสนับสนุน AI',
    'fact.3': 'ฝ่ายสนับสนุนจะไม่ขอรหัสผ่าน รหัสยืนยัน หรือข้อมูลการชำระเงิน',

    'form.title': 'ส่งตั๋ว',
    'form.label.category': 'ประเภทตั๋ว',
    'form.category.bug': 'แจ้งปัญหา',
    'form.category.account': 'ปัญหาบัญชี',
    'form.category.payment': 'การชำระเงินและใบแจ้งหนี้',
    'form.category.payout': 'การจ่ายเงินให้ครีเอเตอร์',
    'form.category.suggestion': 'ความคิดเห็นและข้อเสนอแนะ',
    'form.label.type': 'ประเภทปัญหา',
    'form.type.refund': 'ปัญหาการคืนเงิน',
    'form.type.billing': 'ข้อโต้แย้งใบแจ้งหนี้',
    'form.type.account': 'อุทธรณ์บัญชี',
    'form.type.penalty': 'อุทธรณ์การลงโทษ',
    'form.type.privacy': 'คำขอความเป็นส่วนตัว',
    'form.type.other': 'อื่น ๆ',
    // 问题反馈组的“问题类型”选项
    'form.type.bug.display': 'หน้าแสดงผลผิดปกติ',
    'form.type.bug.feature': 'ฟังก์ชันผิดปกติ',
    'form.type.bug.editor': 'ปัญหาตัวแก้ไข',
    'form.type.bug.translation': 'คำแปลผิดพลาด',
    'form.type.bug.payment': 'การชำระเงินและสมาชิกผิดปกติ',
    'form.type.bug.other': 'บั๊กอื่น ๆ',
    // 账户问题组
    'form.type.account.login': 'ปัญหาการเข้าสู่ระบบและการยืนยันตัวตน',
    'form.type.account.hijack': 'บัญชีถูกขโมย',
    // 支付与账单组
    'form.type.payment.failed': 'การชำระเงินล้มเหลว',
    'form.type.payment.duplicate': 'หักเงินซ้ำ',
    'form.type.payment.subscription': 'การจัดการและยกเลิกสมาชิก',
    // 创作者结算组
    'form.type.payout.query': 'สอบถามการจ่ายเงิน',
    'form.type.payout.withdrawal': 'ปัญหาการถอนเงิน',
    'form.type.payout.chargeback': 'ข้อโต้แย้งการปฏิเสธการชำระเงิน',
    'form.type.payout.share': 'ข้อโต้แย้งส่วนแบ่งรายได้',
    // 意见与建议组
    'form.type.suggestion.feature': 'ข้อเสนอแนะฟังก์ชัน',
    'form.type.suggestion.ux': 'ความคิดเห็นการใช้งาน',
    'form.type.suggestion.other': 'ข้อเสนอแนะอื่น ๆ',
    'form.label.contact': 'อีเมล',
    'form.placeholder.contact': 'เช่น name@example.com',
    'form.label.subject': 'หัวข้อ',
    'form.placeholder.subject': 'อธิบายปัญหาในหนึ่งประโยค',
    'form.label.desc': 'คำอธิบายโดยละเอียด',
    'form.placeholder.desc': 'โปรดอธิบาย: เกิดอะไรขึ้น เกิดขึ้นเมื่อใด หมายเลขคำสั่งซื้อหรือลิงก์เนื้อหาที่เกี่ยวข้อง และผลลัพธ์ที่คุณคาดหวัง',
    'form.btn.submit': 'สร้างและคัดลอกเนื้อหาตั๋ว',
    'form.hint': 'เมื่อคลิกจะสร้างเนื้อหาตั๋วตามรูปแบบและคัดลอกให้ — โปรดวางในช่องตั๋วของเซิร์ฟเวอร์ Discord ทางการเพื่อส่ง',
    'form.alert.incomplete': 'โปรดกรอกให้ครบ (ประเภทตั๋ว ข้อมูลติดต่อ หัวข้อ คำอธิบาย)',
    'form.alert.email': 'โปรดป้อนที่อยู่อีเมลที่ถูกต้อง',

    // 生成工单文本时的字段前缀
    'form.field.category': '[ประเภทตั๋ว]',
    'form.field.type': '[ประเภทปัญหา]',
    'form.field.contact': '[อีเมล]',
    'form.field.subject': '[หัวข้อ]',
    'form.field.desc': '[คำอธิบาย]',

    'done.title': 'สร้างเนื้อหาตั๋วแล้ว',
    'done.intro': 'เนื้อหาถูกคัดลอกไปยังคลิปบอร์ดแล้ว (หากไม่ถูกคัดลอกอัตโนมัติ โปรดคลิกกล่องข้อความด้านล่าง เลือกทั้งหมดแล้วคัดลอกด้วยตนเอง) จากนั้นส่งตามขั้นตอนต่อไปนี้:',
    'done.step1': 'ไปที่เซิร์ฟเวอร์ Discord ทางการ',
    'done.step2': 'วางและส่งในช่องตั๋ว',
    'done.step3': 'ผู้ดูแลจัดการตั๋วตามลำดับคิว (เรื่องเร่งด่วนก่อน) เป้าหมายการตอบกลับโดยเจ้าหน้าที่ครั้งแรกภายใน 3 วัน',
    'done.join': 'เข้าร่วมเซิร์ฟเวอร์',
    'done.note': 'ระบบตั๋วในเว็บยังไม่ได้เชื่อมต่อโดยตรง การวางใน Discord เป็นช่องทางส่งในปัจจุบัน หลังจากระบบเปิดใช้แล้ว การส่งที่นี่จะเข้าคิวโดยอัตโนมัติ',

    // 后端模式成功面板（后端上线后启用，编号/排队位置由 JS 填入）
    'doneapi.title': 'ส่งตั๋วแล้ว',
    'doneapi.body': 'ตั๋วเข้าคิวรอดำเนินการแล้ว หมายเลข: ',
    'doneapi.bodyPos': ' ปัจจุบันอยู่ลำดับที่ ',
    'doneapi.bodyPosSuffix': '',
    'doneapi.note': 'เป้าหมายการตอบกลับโดยเจ้าหน้าที่ครั้งแรกภายใน 3 วัน ความคืบหน้าจะแจ้งทางอีเมลที่คุณระบุไว้',

    'fraud': '⚠️ คำเตือนป้องกันการฉ้อโกง: ในสถานการณ์ปกติ ฝ่ายสนับสนุนของแพลตฟอร์มจะไม่ติดต่อคุณผ่านข้อความส่วนตัวโดยไม่ได้รับการร้องขอ ในกรณีพิเศษ (เช่น การตรวจสอบความปลอดภัยของบัญชี การจัดการความผิดปกติของคำสั่งซื้อ) ทีมปฏิบัติการจะติดต่อคุณอย่างเป็นทางการและจะแสดงรหัสยืนยันทางการก่อน (มีอายุ 12 ชั่วโมง) เพื่อยืนยันตัวตน — คุณสามารถไปที่ศูนย์ช่วยเหลือที่หัวข้อ "ยืนยันตัวตนเจ้าหน้าที่ทางการ" ป้อนรหัสเพื่อตรวจสอบ ผลการตรวจสอบจะแสดงเวลาที่สร้างรหัส นามแฝง ตำแหน่ง และหน้าที่รับผิดชอบของเจ้าหน้าที่ผู้นั้น เจ้าหน้าที่ทางการจะไม่ขอรหัสผ่าน รหัสยืนยันทาง SMS หรือข้อมูลการชำระเงินจากคุณไม่ว่ากรณีใด ๆ "ข้อความส่วนตัวทางการ" ใดที่ไม่มีรหัสยืนยัน รหัสยืนยันใช้ไม่ได้ หรือขอข้อมูลดังกล่าว ล้วนเป็นการปลอมตัว — โปรดอย่าตอบกลับ และตรวจสอบหรือรายงานในชุมชน Discord ทางการ'
  })
  .add('vi', {
    'meta.title': 'Phiếu yêu cầu hỗ trợ | M.NationWorld',

    'hero.title': 'Phiếu yêu cầu hỗ trợ',
    'hero.sub': 'Với các việc cần quyền đặc biệt hoặc dịch vụ khách hàng AI không xử lý được (thanh toán và hóa đơn, chi trả cho nhà sáng tạo, kháng nghị tài khoản và hình phạt, yêu cầu về quyền riêng tư…), vui lòng gửi phiếu yêu cầu tại đây.',

    'fact.1': 'Mục tiêu phản hồi đầu tiên của con người: trong 3 ngày',
    'fact.2': 'Phiếu do con người tiếp nhận, không qua dịch vụ khách hàng AI',
    'fact.3': 'Hỗ trợ sẽ không yêu cầu mật khẩu, mã xác minh hoặc thông tin thanh toán',

    'form.title': 'Gửi phiếu yêu cầu',
    'form.label.category': 'Loại phiếu',
    'form.category.bug': 'Phản ánh sự cố',
    'form.category.account': 'Vấn đề tài khoản',
    'form.category.payment': 'Thanh toán và hóa đơn',
    'form.category.payout': 'Chi trả nhà sáng tạo',
    'form.category.suggestion': 'Ý kiến và đề xuất',
    'form.label.type': 'Loại vấn đề',
    'form.type.refund': 'Vấn đề hoàn tiền',
    'form.type.billing': 'Tranh chấp hóa đơn',
    'form.type.account': 'Kháng nghị tài khoản',
    'form.type.penalty': 'Kháng nghị hình phạt',
    'form.type.privacy': 'Yêu cầu quyền riêng tư',
    'form.type.other': 'Khác',
    // 问题反馈组的“问题类型”选项
    'form.type.bug.display': 'Lỗi hiển thị trang',
    'form.type.bug.feature': 'Tính năng bị lỗi',
    'form.type.bug.editor': 'Vấn đề trình soạn thảo',
    'form.type.bug.translation': 'Lỗi bản dịch',
    'form.type.bug.payment': 'Bất thường thanh toán và gói đăng ký',
    'form.type.bug.other': 'Lỗi khác',
    // 账户问题组
    'form.type.account.login': 'Vấn đề đăng nhập và xác minh',
    'form.type.account.hijack': 'Tài khoản bị đánh cắp',
    // 支付与账单组
    'form.type.payment.failed': 'Thanh toán thất bại',
    'form.type.payment.duplicate': 'Bị trừ tiền trùng lặp',
    'form.type.payment.subscription': 'Quản lý và hủy gói đăng ký',
    // 创作者结算组
    'form.type.payout.query': 'Tra cứu khoản chi trả',
    'form.type.payout.withdrawal': 'Vấn đề rút tiền',
    'form.type.payout.chargeback': 'Khiếu nại về khoản hoàn tiền bị thu hồi',
    'form.type.payout.share': 'Khiếu nại về chia sẻ doanh thu',
    // 意见与建议组
    'form.type.suggestion.feature': 'Đề xuất tính năng',
    'form.type.suggestion.ux': 'Phản hồi trải nghiệm',
    'form.type.suggestion.other': 'Đề xuất khác',
    'form.label.contact': 'Email',
    'form.placeholder.contact': 'ví dụ: name@example.com',
    'form.label.subject': 'Tiêu đề',
    'form.placeholder.subject': 'Tóm tắt vấn đề trong một câu',
    'form.label.desc': 'Mô tả chi tiết',
    'form.placeholder.desc': 'Vui lòng mô tả: điều gì đã xảy ra, xảy ra khi nào, số đơn hàng hoặc liên kết nội dung liên quan và kết quả bạn mong muốn',
    'form.btn.submit': 'Tạo và sao chép nội dung phiếu',
    'form.hint': 'Nhấp vào sẽ tạo nội dung phiếu theo định dạng và sao chép — hãy dán vào kênh phiếu yêu cầu của máy chủ Discord chính thức để gửi.',
    'form.alert.incomplete': 'Vui lòng điền đầy đủ (loại phiếu, thông tin liên hệ, tiêu đề, mô tả)',
    'form.alert.email': 'Vui lòng nhập địa chỉ email hợp lệ',

    // 生成工单文本时的字段前缀
    'form.field.category': '[Loại phiếu]',
    'form.field.type': '[Loại vấn đề]',
    'form.field.contact': '[Email]',
    'form.field.subject': '[Tiêu đề]',
    'form.field.desc': '[Mô tả]',

    'done.title': 'Đã tạo nội dung phiếu',
    'done.intro': 'Nội dung đã được sao chép vào bảng nhớ tạm (nếu chưa tự sao chép, hãy nhấp vào ô văn bản bên dưới, chọn tất cả và sao chép thủ công), sau đó gửi theo các bước sau:',
    'done.step1': 'Đến máy chủ Discord chính thức',
    'done.step2': 'Dán và gửi trong kênh phiếu yêu cầu',
    'done.step3': 'Quản trị viên xử lý phiếu theo thứ tự hàng đợi (việc khẩn cấp được ưu tiên); mục tiêu phản hồi đầu tiên của con người trong 3 ngày',
    'done.join': 'Tham gia máy chủ',
    'done.note': 'Hệ thống phiếu trong nền tảng chưa kết nối trực tiếp — dán trong Discord là kênh gửi hiện tại. Khi hệ thống hoạt động, phiếu gửi tại đây sẽ tự động vào hàng đợi.',

    // 后端模式成功面板（后端上线后启用，编号/排队位置由 JS 填入）
    'doneapi.title': 'Đã gửi phiếu',
    'doneapi.body': 'Phiếu đã vào hàng đợi xử lý, số: ',
    'doneapi.bodyPos': ', hiện đứng thứ ',
    'doneapi.bodyPosSuffix': '',
    'doneapi.note': 'Mục tiêu phản hồi đầu tiên của con người là trong 3 ngày; tiến độ xử lý sẽ được thông báo qua email bạn để lại.',

    'fraud': '⚠️ Cảnh báo chống lừa đảo: trong điều kiện bình thường, hỗ trợ của nền tảng sẽ không chủ động liên hệ bạn qua tin nhắn riêng. Trong trường hợp đặc biệt (như xác minh an toàn tài khoản, xử lý bất thường đơn hàng), đội vận hành sẽ liên hệ bạn với danh nghĩa chính thức và trước tiên đưa ra mã xác minh chính thức (có hiệu lực trong 12 giờ) để chứng minh danh tính — bạn có thể đến Trung tâm trợ giúp, mục "Xác minh danh tính nhân viên chính thức", nhập mã để kiểm tra; kết quả sẽ hiển thị thời gian tạo mã, bí danh, chức vụ và công việc phụ trách của nhân viên đó. Nhân viên chính thức sẽ không yêu cầu mật khẩu, mã xác minh SMS hoặc thông tin thanh toán từ bạn trong mọi trường hợp; bất kỳ "tin nhắn riêng chính thức" nào không đưa mã xác minh, mã không hợp lệ hoặc yêu cầu các thông tin trên đều là mạo danh — vui lòng không trả lời, hãy xác minh hoặc báo cáo tại cộng đồng Discord chính thức.'
  })
  .add('id', {
    'meta.title': 'Tiket Dukungan | M.NationWorld',

    'hero.title': 'Tiket Dukungan',
    'hero.sub': 'Untuk hal yang memerlukan izin khusus atau tidak dapat ditangani oleh dukungan AI (pembayaran dan tagihan, pencairan kreator, banding akun dan hukuman, permintaan privasi, dll.), silakan kirim tiket dukungan di sini.',

    'fact.1': 'Target balasan manusia pertama: dalam 3 hari',
    'fact.2': 'Tiket ditangani manusia, tidak melalui dukungan AI',
    'fact.3': 'Dukungan tidak akan meminta kata sandi, kode verifikasi, atau info pembayaran',

    'form.title': 'Kirim Tiket',
    'form.label.category': 'Kategori Tiket',
    'form.category.bug': 'Laporan Masalah',
    'form.category.account': 'Masalah Akun',
    'form.category.payment': 'Pembayaran & Tagihan',
    'form.category.payout': 'Pencairan Kreator',
    'form.category.suggestion': 'Masukan & Saran',
    'form.label.type': 'Jenis Masalah',
    'form.type.refund': 'Masalah Pengembalian Dana',
    'form.type.billing': 'Sengketa Tagihan',
    'form.type.account': 'Banding Akun',
    'form.type.penalty': 'Banding Hukuman',
    'form.type.privacy': 'Permintaan Privasi',
    'form.type.other': 'Lainnya',
    // 问题反馈组的“问题类型”选项
    'form.type.bug.display': 'Tampilan Halaman Bermasalah',
    'form.type.bug.feature': 'Fungsi Bermasalah',
    'form.type.bug.editor': 'Masalah Editor',
    'form.type.bug.translation': 'Kesalahan Terjemahan',
    'form.type.bug.payment': 'Gangguan Pembayaran & Langganan',
    'form.type.bug.other': 'Bug Lainnya',
    // 账户问题组
    'form.type.account.login': 'Masalah Login & Verifikasi',
    'form.type.account.hijack': 'Akun Dibajak',
    // 支付与账单组
    'form.type.payment.failed': 'Pembayaran Gagal',
    'form.type.payment.duplicate': 'Penagihan Ganda',
    'form.type.payment.subscription': 'Pengelolaan & Pembatalan Langganan',
    // 创作者结算组
    'form.type.payout.query': 'Pemeriksaan Pencairan',
    'form.type.payout.withdrawal': 'Masalah Penarikan',
    'form.type.payout.chargeback': 'Sengketa Tagihan Balik',
    'form.type.payout.share': 'Sengketa Bagi Hasil',
    // 意见与建议组
    'form.type.suggestion.feature': 'Saran Fitur',
    'form.type.suggestion.ux': 'Masukan Pengalaman',
    'form.type.suggestion.other': 'Saran Lainnya',
    'form.label.contact': 'Email',
    'form.placeholder.contact': 'mis. name@example.com',
    'form.label.subject': 'Judul',
    'form.placeholder.subject': 'Jelaskan masalah dalam satu kalimat',
    'form.label.desc': 'Deskripsi Rinci',
    'form.placeholder.desc': 'Silakan jelaskan: apa yang terjadi, kapan terjadi, nomor pesanan atau tautan konten terkait, dan hasil yang Anda harapkan',
    'form.btn.submit': 'Buat & Salin Isi Tiket',
    'form.hint': 'Mengklik akan membuat dan menyalin isi tiket berformat — tempelkan di kanal tiket server Discord resmi untuk mengirim.',
    'form.alert.incomplete': 'Silakan lengkapi semua (kategori tiket, kontak, judul, deskripsi)',
    'form.alert.email': 'Silakan masukkan alamat email yang valid',

    // 生成工单文本时的字段前缀
    'form.field.category': '[Kategori Tiket]',
    'form.field.type': '[Jenis Masalah]',
    'form.field.contact': '[Email]',
    'form.field.subject': '[Judul]',
    'form.field.desc': '[Deskripsi]',

    'done.title': 'Isi Tiket Telah Dibuat',
    'done.intro': 'Isi telah disalin ke papan klip (jika tidak tersalin otomatis, klik kotak teks di bawah, pilih semua, lalu salin manual), kemudian kirim dengan langkah berikut:',
    'done.step1': 'Buka server Discord resmi',
    'done.step2': 'Tempel dan kirim di kanal tiket',
    'done.step3': 'Admin memproses tiket sesuai urutan antrean (hal mendesak diprioritaskan); target balasan manusia pertama dalam 3 hari',
    'done.join': 'Gabung Server',
    'done.note': 'Sistem tiket di platform belum terhubung langsung — menempel di Discord adalah kanal pengiriman saat ini. Setelah sistem diluncurkan, pengiriman di sini akan masuk antrean secara otomatis.',

    // 后端模式成功面板（后端上线后启用，编号/排队位置由 JS 填入）
    'doneapi.title': 'Tiket Terkirim',
    'doneapi.body': 'Tiket telah masuk antrean untuk diproses, nomor: ',
    'doneapi.bodyPos': ', saat ini berada di posisi ',
    'doneapi.bodyPosSuffix': '',
    'doneapi.note': 'Target balasan manusia pertama adalah dalam 3 hari; perkembangan penanganan akan diberitahukan melalui email yang Anda berikan.',

    'fraud': '⚠️ Peringatan anti-penipuan: dalam kondisi normal, dukungan platform tidak akan menghubungi Anda secara proaktif melalui pesan pribadi. Dalam keadaan khusus (seperti pemeriksaan keamanan akun, penanganan anomali pesanan), tim operasional akan menghubungi Anda secara resmi dan terlebih dahulu menunjukkan kode verifikasi resmi (berlaku 12 jam) untuk membuktikan identitas — Anda dapat pergi ke Pusat Bantuan pada bagian "Verifikasi Identitas Petugas Resmi" dan memasukkan kode untuk memeriksa; hasil verifikasi akan menampilkan waktu pembuatan kode, nama samaran, jabatan, dan tanggung jawab petugas tersebut. Petugas resmi tidak akan pernah meminta kata sandi, kode verifikasi SMS, atau info pembayaran dari Anda dalam keadaan apa pun; setiap "pesan pribadi resmi" yang tidak menunjukkan kode verifikasi, kodenya tidak berlaku, atau meminta informasi tersebut adalah penipuan identitas — jangan ditanggapi, dan lakukan verifikasi atau laporan di komunitas Discord resmi.'
  })
  .add('fr', {
    'meta.title': 'Ticket d\'assistance | M.NationWorld',

    'hero.title': 'Ticket d\'assistance',
    'hero.sub': 'Pour les demandes nécessitant des droits spéciaux ou que le support IA ne peut pas traiter (paiements et facturation, versements aux créateurs, recours concernant comptes et sanctions, demandes de confidentialité, etc.), veuillez soumettre un ticket d\'assistance ici.',

    'fact.1': 'Objectif de première réponse humaine : sous 3 jours',
    'fact.2': 'Les tickets sont traités par des humains, pas par le support IA',
    'fact.3': 'Le support ne demandera jamais votre mot de passe, code de vérification ou informations de paiement',

    'form.title': 'Soumettre un ticket',
    'form.label.category': 'Catégorie du ticket',
    'form.category.bug': 'Signaler un problème',
    'form.category.account': 'Problème de compte',
    'form.category.payment': 'Paiement et facturation',
    'form.category.payout': 'Versements aux créateurs',
    'form.category.suggestion': 'Avis et suggestions',
    'form.label.type': 'Type de problème',
    'form.type.refund': 'Problème de remboursement',
    'form.type.billing': 'Litige de facturation',
    'form.type.account': 'Recours concernant un compte',
    'form.type.penalty': 'Recours contre une sanction',
    'form.type.privacy': 'Demande de confidentialité',
    'form.type.other': 'Autre',
    // 问题反馈组的“问题类型”选项
    'form.type.bug.display': 'Anomalie d\'affichage de la page',
    'form.type.bug.feature': 'Dysfonctionnement d\'une fonction',
    'form.type.bug.editor': 'Problème d\'éditeur',
    'form.type.bug.translation': 'Erreur de traduction',
    'form.type.bug.payment': 'Anomalie de paiement et d\'abonnement',
    'form.type.bug.other': 'Autre bug',
    // 账户问题组
    'form.type.account.login': 'Problème de connexion et de vérification',
    'form.type.account.hijack': 'Compte piraté',
    // 支付与账单组
    'form.type.payment.failed': 'Paiement échoué',
    'form.type.payment.duplicate': 'Double prélèvement',
    'form.type.payment.subscription': 'Gestion et résiliation de l\'abonnement',
    // 创作者结算组
    'form.type.payout.query': 'Consultation des versements',
    'form.type.payout.withdrawal': 'Problème de retrait',
    'form.type.payout.chargeback': 'Litige de remboursement forcé',
    'form.type.payout.share': 'Litige sur le partage des revenus',
    // 意见与建议组
    'form.type.suggestion.feature': 'Suggestion de fonctionnalité',
    'form.type.suggestion.ux': 'Retour d\'expérience',
    'form.type.suggestion.other': 'Autre suggestion',
    'form.label.contact': 'Adresse e-mail',
    'form.placeholder.contact': 'par ex. name@example.com',
    'form.label.subject': 'Objet',
    'form.placeholder.subject': 'Résumez le problème en une phrase',
    'form.label.desc': 'Description détaillée',
    'form.placeholder.desc': 'Veuillez décrire : ce qui s\'est passé, quand cela s\'est produit, le numéro de commande ou le lien du contenu concerné, et le résultat attendu',
    'form.btn.submit': 'Générer et copier le contenu du ticket',
    'form.hint': 'Cliquer générera et copiera un ticket au format standard — collez-le dans le canal des tickets du serveur Discord officiel pour le soumettre.',
    'form.alert.incomplete': 'Veuillez tout remplir (catégorie du ticket, contact, objet, description)',
    'form.alert.email': 'Veuillez saisir une adresse e-mail valide',

    // 生成工单文本时的字段前缀
    'form.field.category': '[Catégorie du ticket]',
    'form.field.type': '[Type de problème]',
    'form.field.contact': '[Adresse e-mail]',
    'form.field.subject': '[Objet]',
    'form.field.desc': '[Description]',

    'done.title': 'Contenu du ticket généré',
    'done.intro': 'Le contenu a été copié dans le presse-papiers (si ce n\'est pas le cas, cliquez sur la zone de texte ci-dessous, sélectionnez tout et copiez manuellement), puis soumettez-le comme suit :',
    'done.step1': 'Rendez-vous sur le serveur Discord officiel',
    'done.step2': 'Collez et envoyez dans le canal des tickets',
    'done.step3': 'Les administrateurs traitent les tickets dans l\'ordre de la file (les cas urgents en priorité) ; objectif de première réponse humaine sous 3 jours',
    'done.join': 'Rejoindre le serveur',
    'done.note': 'Le système de tickets du site n\'est pas encore connecté directement — le collage dans Discord est le canal de soumission actuel. Une fois le système en ligne, les soumissions faites ici entreront automatiquement dans la file.',

    // 后端模式成功面板（后端上线后启用，编号/排队位置由 JS 填入）
    'doneapi.title': 'Ticket soumis',
    'doneapi.body': 'Le ticket est entré dans la file de traitement, numéro : ',
    'doneapi.bodyPos': ', actuellement en position ',
    'doneapi.bodyPosSuffix': '',
    'doneapi.note': 'L\'objectif de première réponse humaine est sous 3 jours ; l\'avancement du traitement vous sera communiqué par l\'adresse e-mail que vous avez laissée.',

    'fraud': '⚠️ Avertissement anti-fraude : en temps normal, le support de la plateforme ne vous contacte pas de sa propre initiative par message privé. Dans des cas particuliers (vérification de la sécurité d\'un compte, traitement d\'une anomalie de commande), l\'équipe d\'exploitation peut vous contacter à titre officiel et présentera d\'abord un code de vérification officiel (valable 12 heures) pour prouver son identité — vous pouvez vous rendre dans le Centre d\'aide, à la rubrique « Vérifier l\'identité d\'un membre officiel », saisir le code pour le vérifier ; le résultat indiquera l\'heure de création du code, le pseudonyme, le poste et les attributions de l\'intervenant. En aucun cas, un membre officiel ne vous demandera votre mot de passe, vos codes de vérification SMS ou vos informations de paiement ; tout « message privé officiel » sans code de vérification, avec un code invalide, ou demandant ces informations est une usurpation d\'identité — n\'y répondez pas et vérifiez ou signalez-le dans la communauté Discord officielle.'
  })
  .add('es', {
    'meta.title': 'Ticket de soporte | M.NationWorld',

    'hero.title': 'Ticket de soporte',
    'hero.sub': 'Para asuntos que requieren permisos especiales o que el soporte de IA no puede gestionar (pagos y facturación, pagos a creadores, apelaciones de cuentas y sanciones, solicitudes de privacidad, etc.), envía aquí un ticket de soporte.',

    'fact.1': 'Objetivo de primera respuesta humana: en 3 días',
    'fact.2': 'Los tickets los gestionan personas, no el soporte de IA',
    'fact.3': 'El soporte nunca te pedirá tu contraseña, código de verificación ni datos de pago',

    'form.title': 'Enviar un ticket',
    'form.label.category': 'Categoría del ticket',
    'form.category.bug': 'Informar de un problema',
    'form.category.account': 'Problema de cuenta',
    'form.category.payment': 'Pagos y facturación',
    'form.category.payout': 'Pagos a creadores',
    'form.category.suggestion': 'Opiniones y sugerencias',
    'form.label.type': 'Tipo de problema',
    'form.type.refund': 'Problema de reembolso',
    'form.type.billing': 'Disputa de facturación',
    'form.type.account': 'Apelación de cuenta',
    'form.type.penalty': 'Apelación de sanción',
    'form.type.privacy': 'Solicitud de privacidad',
    'form.type.other': 'Otro',
    // 问题反馈组的“问题类型”选项
    'form.type.bug.display': 'Error de visualización de la página',
    'form.type.bug.feature': 'Fallo de una función',
    'form.type.bug.editor': 'Problema del editor',
    'form.type.bug.translation': 'Error de traducción',
    'form.type.bug.payment': 'Anomalía de pago y suscripción',
    'form.type.bug.other': 'Otro bug',
    // 账户问题组
    'form.type.account.login': 'Problema de inicio de sesión y verificación',
    'form.type.account.hijack': 'Cuenta robada',
    // 支付与账单组
    'form.type.payment.failed': 'Pago fallido',
    'form.type.payment.duplicate': 'Cobro duplicado',
    'form.type.payment.subscription': 'Gestión y cancelación de la suscripción',
    // 创作者结算组
    'form.type.payout.query': 'Consulta de pagos',
    'form.type.payout.withdrawal': 'Problema de retiro',
    'form.type.payout.chargeback': 'Disputa de contracargo',
    'form.type.payout.share': 'Disputa de reparto de ingresos',
    // 意见与建议组
    'form.type.suggestion.feature': 'Sugerencia de función',
    'form.type.suggestion.ux': 'Comentarios sobre la experiencia',
    'form.type.suggestion.other': 'Otra sugerencia',
    'form.label.contact': 'Correo electrónico',
    'form.placeholder.contact': 'p. ej. name@example.com',
    'form.label.subject': 'Asunto',
    'form.placeholder.subject': 'Resume el problema en una frase',
    'form.label.desc': 'Descripción detallada',
    'form.placeholder.desc': 'Describe: qué ocurrió, cuándo ocurrió, el número de pedido o enlace de contenido relacionado y el resultado que esperas',
    'form.btn.submit': 'Generar y copiar el contenido del ticket',
    'form.hint': 'Al hacer clic se generará y copiará el contenido del ticket formateado — pégalo en el canal de tickets del servidor oficial de Discord para enviarlo.',
    'form.alert.incomplete': 'Rellena todos los campos (categoría del ticket, contacto, asunto, descripción)',
    'form.alert.email': 'Introduce una dirección de correo electrónico válida',

    // 生成工单文本时的字段前缀
    'form.field.category': '[Categoría del ticket]',
    'form.field.type': '[Tipo de problema]',
    'form.field.contact': '[Correo electrónico]',
    'form.field.subject': '[Asunto]',
    'form.field.desc': '[Descripción]',

    'done.title': 'Contenido del ticket generado',
    'done.intro': 'El contenido se ha copiado al portapapeles (si no se copió automáticamente, haz clic en el cuadro de texto de abajo, selecciona todo y cópialo manualmente) y luego envíalo siguiendo estos pasos:',
    'done.step1': 'Ve al servidor oficial de Discord',
    'done.step2': 'Pégalo y envíalo en el canal de tickets',
    'done.step3': 'Los administradores gestionan los tickets por orden de cola (los asuntos urgentes primero); objetivo de primera respuesta humana en 3 días',
    'done.join': 'Unirse al servidor',
    'done.note': 'El sistema de tickets del sitio aún no está conectado directamente — pegar en Discord es el canal de envío actual. Cuando el sistema esté en línea, los envíos de aquí entrarán automáticamente en la cola.',

    // 后端模式成功面板（后端上线后启用，编号/排队位置由 JS 填入）
    'doneapi.title': 'Ticket enviado',
    'doneapi.body': 'El ticket ha entrado en la cola de procesamiento, número: ',
    'doneapi.bodyPos': ', actualmente en la posición ',
    'doneapi.bodyPosSuffix': '',
    'doneapi.note': 'El objetivo de la primera respuesta humana es en 3 días; el progreso se te comunicará al correo electrónico que dejaste.',

    'fraud': '⚠️ Aviso antifraude: en circunstancias normales, el soporte de la plataforma no te contactará de forma proactiva por mensaje privado. En casos especiales (como la verificación de la seguridad de la cuenta o la gestión de anomalías de pedidos), el equipo de operaciones puede contactarte de forma oficial y mostrará primero un código de verificación oficial (válido durante 12 horas) para acreditar su identidad — puedes ir al Centro de ayuda, en la sección «Verificar la identidad del personal oficial», e introducir el código para comprobarlo; el resultado mostrará la hora de creación del código, el seudónimo, el puesto y las responsabilidades de dicho miembro del personal. El personal oficial nunca te pedirá tu contraseña, códigos de verificación por SMS ni datos de pago; cualquier «mensaje privado oficial» que no muestre un código de verificación, tenga un código no válido o solicite dicha información es una suplantación — no respondas y verifica o denuncia en la comunidad oficial de Discord.'
  })
  .add('pt', {
    'meta.title': 'Ticket de suporte | M.NationWorld',

    'hero.title': 'Ticket de suporte',
    'hero.sub': 'Para assuntos que exigem permissões especiais ou que o suporte de IA não consegue tratar (pagamentos e faturação, pagamentos a criadores, recursos de contas e sanções, pedidos de privacidade, etc.), envie aqui um ticket de suporte.',

    'fact.1': 'Objetivo da primeira resposta humana: em 3 dias',
    'fact.2': 'Os tickets são tratados por pessoas, não pelo suporte de IA',
    'fact.3': 'O suporte nunca pedirá sua senha, código de verificação ou dados de pagamento',

    'form.title': 'Enviar ticket',
    'form.label.category': 'Categoria do ticket',
    'form.category.bug': 'Relatar problema',
    'form.category.account': 'Problema de conta',
    'form.category.payment': 'Pagamentos e faturação',
    'form.category.payout': 'Pagamentos a criadores',
    'form.category.suggestion': 'Opiniões e sugestões',
    'form.label.type': 'Tipo de problema',
    'form.type.refund': 'Problema de reembolso',
    'form.type.billing': 'Disputa de faturação',
    'form.type.account': 'Recurso de conta',
    'form.type.penalty': 'Recurso de sanção',
    'form.type.privacy': 'Pedido de privacidade',
    'form.type.other': 'Outro',
    // 问题反馈组的“问题类型”选项
    'form.type.bug.display': 'Erro de exibição da página',
    'form.type.bug.feature': 'Falha de funcionalidade',
    'form.type.bug.editor': 'Problema do editor',
    'form.type.bug.translation': 'Erro de tradução',
    'form.type.bug.payment': 'Anomalia de pagamento e subscrição',
    'form.type.bug.other': 'Outro bug',
    // 账户问题组
    'form.type.account.login': 'Problema de login e verificação',
    'form.type.account.hijack': 'Conta roubada',
    // 支付与账单组
    'form.type.payment.failed': 'Pagamento falhou',
    'form.type.payment.duplicate': 'Cobrança duplicada',
    'form.type.payment.subscription': 'Gestão e cancelamento da subscrição',
    // 创作者结算组
    'form.type.payout.query': 'Consulta de pagamentos',
    'form.type.payout.withdrawal': 'Problema de levantamento',
    'form.type.payout.chargeback': 'Disputa de estorno',
    'form.type.payout.share': 'Disputa de partilha de receitas',
    // 意见与建议组
    'form.type.suggestion.feature': 'Sugestão de funcionalidade',
    'form.type.suggestion.ux': 'Feedback de experiência',
    'form.type.suggestion.other': 'Outra sugestão',
    'form.label.contact': 'E-mail',
    'form.placeholder.contact': 'ex.: name@example.com',
    'form.label.subject': 'Assunto',
    'form.placeholder.subject': 'Resuma o problema numa frase',
    'form.label.desc': 'Descrição detalhada',
    'form.placeholder.desc': 'Descreva: o que aconteceu, quando aconteceu, o número da encomenda ou link do conteúdo relacionado e o resultado que espera',
    'form.btn.submit': 'Gerar e copiar conteúdo do ticket',
    'form.hint': 'Clicar irá gerar e copiar o conteúdo formatado do ticket — cole-o no canal de tickets do servidor oficial do Discord para enviar.',
    'form.alert.incomplete': 'Preencha todos os campos (categoria do ticket, contacto, assunto, descrição)',
    'form.alert.email': 'Introduza um endereço de e-mail válido',

    // 生成工单文本时的字段前缀
    'form.field.category': '[Categoria do ticket]',
    'form.field.type': '[Tipo de problema]',
    'form.field.contact': '[E-mail]',
    'form.field.subject': '[Assunto]',
    'form.field.desc': '[Descrição]',

    'done.title': 'Conteúdo do ticket gerado',
    'done.intro': 'O conteúdo foi copiado para a área de transferência (se não, clique na caixa de texto abaixo, selecione tudo e copie manualmente) e envie-o seguindo estes passos:',
    'done.step1': 'Vá ao servidor oficial do Discord',
    'done.step2': 'Cole e envie no canal de tickets',
    'done.step3': 'Os administradores tratam os tickets por ordem de fila (assuntos urgentes primeiro); objetivo da primeira resposta humana em 3 dias',
    'done.join': 'Entrar no servidor',
    'done.note': 'O sistema de tickets do site ainda não está ligado diretamente — colar no Discord é o canal de envio atual. Quando o sistema entrar em funcionamento, os envios feitos aqui entrarão automaticamente na fila.',

    // 后端模式成功面板（后端上线后启用，编号/排队位置由 JS 填入）
    'doneapi.title': 'Ticket enviado',
    'doneapi.body': 'O ticket entrou na fila de processamento, número: ',
    'doneapi.bodyPos': ', atualmente na posição ',
    'doneapi.bodyPosSuffix': '',
    'doneapi.note': 'O objetivo da primeira resposta humana é em 3 dias; o progresso será comunicado através do e-mail que indicou.',

    'fraud': '⚠️ Aviso antifraude: em circunstâncias normais, o suporte da plataforma não o contactará por iniciativa própria através de mensagens privadas. Em casos especiais (como a verificação da segurança da conta ou o tratamento de anomalias de encomendas), a equipa de operações pode contactá-lo a título oficial e apresentará primeiro um código de verificação oficial (válido por 12 horas) para comprovar a sua identidade — pode ir à Central de Ajuda, na secção «Verificar a identidade de funcionários oficiais», introduzir o código para o confirmar; o resultado mostrará a hora de criação do código, o pseudónimo, o cargo e as responsabilidades desse funcionário. Em circunstância alguma os funcionários oficiais lhe pedirão a senha, códigos de verificação por SMS ou dados de pagamento; qualquer «mensagem privada oficial» que não apresente um código de verificação, tenha um código inválido ou peça essas informações é uma fraude de identidade — não responda e confirme ou denuncie na comunidade oficial do Discord.'
  });
/* __ZH_HANT_AUTO__ — v0.2.54.0 zh-Hant 由 OpenCC cn→tw 自动生成（勿手改，重跑本脚本再生成） */
window.MN_I18N.add('zh-Hant', {
  "meta.title": "人工工單 | M.NationWorld",
  "hero.title": "人工工單",
  "hero.sub": "需要特別權限、或 AI 客服無法處理的事項（支付與賬單、創作者結算、賬號與處罰申訴、隱私請求等），請在此提交人工工單。",
  "fact.1": "首個人工回覆目標：3 天內",
  "fact.2": "工單由人工受理，不經過 AI 客服",
  "fact.3": "客服不會索要密碼、驗證碼或支付信息",
  "form.title": "提交工單",
  "form.label.category": "工單類型",
  "form.category.bug": "問題反饋",
  "form.category.account": "賬戶問題",
  "form.category.payment": "支付與賬單",
  "form.category.payout": "創作者結算",
  "form.category.suggestion": "意見與建議",
  "form.label.type": "問題類型",
  "form.type.refund": "退款問題",
  "form.type.billing": "賬單爭議",
  "form.type.account": "賬號申訴",
  "form.type.penalty": "處罰申訴",
  "form.type.privacy": "隱私請求",
  "form.type.other": "其他",
  "form.type.bug.display": "頁面顯示異常",
  "form.type.bug.feature": "功能異常",
  "form.type.bug.editor": "編輯器問題",
  "form.type.bug.translation": "翻譯錯誤",
  "form.type.bug.payment": "支付與訂閱異常",
  "form.type.bug.other": "其他 bug",
  "form.type.account.login": "登錄與驗證問題",
  "form.type.account.hijack": "賬號被盜",
  "form.type.payment.failed": "支付失敗",
  "form.type.payment.duplicate": "重複扣費",
  "form.type.payment.subscription": "訂閱管理與取消",
  "form.type.payout.query": "結算查詢",
  "form.type.payout.withdrawal": "提現問題",
  "form.type.payout.chargeback": "拒付回扣異議",
  "form.type.payout.share": "分成異議",
  "form.type.suggestion.feature": "功能建議",
  "form.type.suggestion.ux": "體驗反饋",
  "form.type.suggestion.other": "其他建議",
  "form.label.contact": "電子郵件",
  "form.placeholder.contact": "例如 name@example.com",
  "form.label.subject": "標題",
  "form.placeholder.subject": "一句話說明問題",
  "form.label.desc": "詳細描述",
  "form.placeholder.desc": "請描述：發生了什麼、發生時間、相關訂單號或內容鏈接、您期望的處理結果",
  "form.btn.submit": "生成並複製工單內容",
  "form.hint": "點擊後將生成格式化工單內容並複製，請粘貼到官方 Discord 伺服器的工單頻道提交。",
  "form.alert.incomplete": "請填寫完整（工單類型、聯繫方式、標題、描述）",
  "form.alert.email": "請輸入有效的電子郵件地址",
  "form.field.category": "【工單類型】",
  "form.field.type": "【問題類型】",
  "form.field.contact": "【電子郵件】",
  "form.field.subject": "【標題】",
  "form.field.desc": "【描述】",
  "done.title": "工單內容已生成",
  "done.intro": "內容已複製到剪貼板（若未自動複製，請點擊下方文本框全選後手動複製），然後按以下步驟提交：",
  "done.step1": "前往官方 Discord 伺服器",
  "done.step2": "在工單頻道粘貼併發送",
  "done.step3": "管理員按隊列處理（緊急事項優先），首個人工回覆目標 3 天內",
  "done.join": "加入伺服器",
  "done.note": "站內工單系統尚未直連，Discord 粘貼為當前提交渠道；系統上線後，此處提交將自動進入排隊。",
  "doneapi.title": "工單已提交",
  "doneapi.body": "工單已進入排隊處理，編號：",
  "doneapi.bodyPos": "，當前排在第",
  "doneapi.bodyPosSuffix": "位",
  "doneapi.note": "首個人工回覆目標為 3 天內；處理進展將通過您留下的電子郵件告知。",
  "fraud": "⚠️ 防詐騙提示：平臺客服在正常情況下不會主動私信聯繫你；特殊情況下（如賬號安全核查、訂單異常處理）運營團隊會以官方名義主動聯繫，並會先出示官方驗證碼（12 小時內有效）自證身份——你可以前往幫助中心「驗證官方人員身份」輸入驗證碼核實，驗證結果會顯示驗證碼的創建時間，以及該工作人員的化名、職位與負責事項。官方人員無論何種情況都不會向你索要密碼、短信驗證碼或支付信息；任何不出示驗證碼、驗證碼無效、或索要上述信息的“官方私信”均為冒充，請勿回應，並前往官方 Discord 社區核實或舉報。"
});
