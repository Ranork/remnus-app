import type { Locale } from '@/i18n/routing';

// ── What's New / changelog ────────────────────────────────────────────────────
//
// The single source of truth for the in-app "What's New" panel (sidebar button
// + modal). Entries live in the repo — not the database — deliberately: a
// release note belongs to the commit that shipped the feature, so whoever
// (human or agent) builds something user-visible adds its line here in the same
// change. No migration, no admin CMS, no drift between what shipped and what
// the panel claims.
//
// Writing rules (see CLAUDE.md / AI.md "After a meaningful change"):
//   • One entry per user-visible improvement. Skip refactors, internal scripts,
//     docs-only churn and anything a customer would never notice.
//   • `summary` is exactly ONE sentence. No paragraphs, no bullet lists.
//   • Customer language, not engineering language: say what they can now do,
//     never which table/component/endpoint changed.
//   • Small changes still get written up so they read as worth reading.
//   • Newest entry goes FIRST in the array.
//   • All 8 locales are required — `Record<Locale, string>` makes `tsc` fail
//     on a missing one, so the panel can never fall back to English silently.

export type ChangelogCategory = 'new' | 'improved' | 'fixed';

export type LocalizedText = Record<Locale, string>;

export interface ChangelogEntry {
  /** Stable slug, `YYYY-MM-DD-kebab-topic`. Never reuse or rewrite a shipped id — the
   *  "seen" cookie stores it, and changing it re-flags the entry as unread for everyone. */
  id: string;
  /** Ship date, `YYYY-MM-DD`. Groups the cards in the modal. */
  date: string;
  category: ChangelogCategory;
  title: LocalizedText;
  /** Exactly one sentence. */
  summary: LocalizedText;
}

/** Client-readable cookie holding the id of the newest entry the user has seen. */
export const CHANGELOG_SEEN_COOKIE = 'remnus_whatsnew_seen';

/** A brand-new account has no cookie; only entries this fresh count as unread for
 *  them, so signing up never greets you with a "24 updates" badge. */
const FIRST_VISIT_WINDOW_DAYS = 7;

export const CHANGELOG: ChangelogEntry[] = [
  {
    id: '2026-08-31-card-comments',
    date: '2026-08-31',
    category: 'new',
    title: {
      en: 'Comments on every card',
      tr: 'Her kartta yorumlar',
      de: 'Kommentare auf jeder Karte',
      es: 'Comentarios en cada tarjeta',
      fr: 'Commentaires sur chaque carte',
      hi: 'हर कार्ड पर टिप्पणियाँ',
      ru: 'Комментарии на каждой карточке',
      zh: '每张卡片都可以评论',
    },
    summary: {
      en: 'You can now leave running comments on any page or card, including notes your AI agents add as they work, in a thread that stays separate from the content itself.',
      tr: 'Artık her sayfaya veya karta, ajanlarınızın çalışırken bıraktığı notlar da dahil, içerikten ayrı bir akışta yorum bırakabilirsiniz.',
      de: 'Sie können jetzt auf jeder Seite oder Karte fortlaufend Kommentare hinterlassen, einschließlich Notizen, die Ihre KI-Agenten während der Arbeit hinzufügen, in einem Thread, der vom eigentlichen Inhalt getrennt bleibt.',
      es: 'Ahora puedes dejar comentarios continuos en cualquier página o tarjeta, incluidas las notas que tus agentes de IA añaden mientras trabajan, en un hilo que se mantiene separado del contenido.',
      fr: 'Vous pouvez désormais laisser des commentaires continus sur n’importe quelle page ou carte, y compris les notes que vos agents IA ajoutent pendant leur travail, dans un fil séparé du contenu lui-même.',
      hi: 'अब आप किसी भी पेज या कार्ड पर लगातार टिप्पणियाँ छोड़ सकते हैं, जिसमें आपके AI एजेंट काम करते समय जोड़े गए नोट्स भी शामिल हैं, एक ऐसे थ्रेड में जो सामग्री से अलग रहता है।',
      ru: 'Теперь вы можете оставлять комментарии на любой странице или карточке, включая заметки, которые ваши ИИ-агенты добавляют по ходу работы, в отдельной от самого содержимого ветке.',
      zh: '现在你可以在任何页面或卡片上持续添加评论，包括你的 AI 代理在工作过程中留下的备注，评论会保留在一个与内容本身分开的独立讨论区中。',
    },
  },
  {
    id: '2026-08-24-code-block-paste-stays-inside',
    date: '2026-08-24',
    category: 'fixed',
    title: {
      en: 'Pasting into a code block stays in the block',
      tr: 'Kod bloğuna yapıştırma artık bloğun içinde kalıyor',
      de: 'Einfügen in einen Codeblock bleibt im Block',
      es: 'Pegar en un bloque de código se queda dentro',
      fr: 'Le collage dans un bloc de code y reste',
      hi: 'कोड ब्लॉक में चिपकाया गया टेक्स्ट ब्लॉक के अंदर ही रहता है',
      ru: 'Вставка в блок кода остаётся в блоке',
      zh: '粘贴到代码块的内容不再跳出',
    },
    summary: {
      en: 'Text that looks like markdown — headings, lists, quotes or another set of backticks — now stays inside the code block you paste it into, exactly as written, instead of escaping the block and turning into real headings and lists underneath it.',
      tr: 'Başlık, liste, alıntı veya bir başka üç tırnak içeren markdown görünümlü metinler artık yapıştırdığınız kod bloğunun dışına taşıp altta gerçek başlıklara ve listelere dönüşmüyor, yazdığınız gibi bloğun içinde kalıyor.',
      de: 'Text, der wie Markdown aussieht – Überschriften, Listen, Zitate oder weitere Backticks –, bleibt jetzt genau so, wie er geschrieben ist, in dem Codeblock, in den Sie ihn einfügen, statt aus dem Block auszubrechen und darunter zu echten Überschriften und Listen zu werden.',
      es: 'El texto que parece Markdown —títulos, listas, citas u otro juego de comillas invertidas— ahora se queda tal cual dentro del bloque de código en el que lo pegas, en lugar de salirse del bloque y convertirse en títulos y listas reales debajo.',
      fr: 'Le texte qui ressemble à du Markdown — titres, listes, citations ou une autre série de backticks — reste désormais tel quel dans le bloc de code où vous le collez, au lieu d’en sortir et de se transformer en véritables titres et listes en dessous.',
      hi: 'मार्कडाउन जैसा दिखने वाला टेक्स्ट — शीर्षक, सूचियाँ, उद्धरण या बैकटिक का एक और सेट — अब जिस कोड ब्लॉक में आप उसे चिपकाते हैं उसी के अंदर ज्यों का त्यों रहता है, ब्लॉक से बाहर निकलकर नीचे असली शीर्षकों और सूचियों में नहीं बदलता।',
      ru: 'Текст, похожий на Markdown, — заголовки, списки, цитаты или ещё одна пара обратных кавычек — теперь остаётся в блоке кода, куда вы его вставили, ровно в том виде, в каком написан, а не вырывается наружу и не превращается в настоящие заголовки и списки под ним.',
      zh: '看起来像 Markdown 的文本——标题、列表、引用或又一组反引号——现在会原样留在你粘贴进去的代码块内，而不再跳出代码块、在下方变成真正的标题和列表。',
    },
  },
  {
    id: '2026-08-21-claude-desktop-connect-fix',
    date: '2026-08-21',
    category: 'fixed',
    title: {
      en: 'Claude Desktop connects on the first try',
      tr: 'Claude Desktop ilk denemede bağlanıyor',
      de: 'Claude Desktop verbindet sich beim ersten Versuch',
      es: 'Claude Desktop se conecta al primer intento',
      fr: 'Claude Desktop se connecte du premier coup',
      hi: 'Claude Desktop पहली ही बार में कनेक्ट हो जाता है',
      ru: 'Claude Desktop подключается с первого раза',
      zh: 'Claude Desktop 首次尝试即可连接',
    },
    summary: {
      en: 'Adding Remnus to Claude Desktop no longer leaves you stuck on an "unable to connect" message after you sign in — the connection now finishes the first time, even when Claude starts several sessions at once.',
      tr: 'Remnus’u Claude Desktop’a eklerken oturum açtıktan sonra artık “bağlanılamıyor” uyarısında takılı kalmıyorsunuz; Claude aynı anda birden fazla oturum başlatsa bile bağlantı ilk seferde tamamlanıyor.',
      de: 'Beim Hinzufügen von Remnus zu Claude Desktop bleiben Sie nach der Anmeldung nicht mehr bei „Verbindung nicht möglich“ hängen – die Verbindung kommt jetzt beim ersten Mal zustande, selbst wenn Claude mehrere Sitzungen gleichzeitig startet.',
      es: 'Al añadir Remnus a Claude Desktop ya no te quedas atascado en el mensaje «no se puede conectar» después de iniciar sesión: la conexión ahora se completa a la primera, incluso cuando Claude abre varias sesiones a la vez.',
      fr: 'L’ajout de Remnus à Claude Desktop ne vous laisse plus bloqué sur un message « connexion impossible » après votre connexion : la liaison aboutit désormais du premier coup, même lorsque Claude démarre plusieurs sessions en même temps.',
      hi: 'Claude Desktop में Remnus जोड़ते समय साइन इन करने के बाद अब आप “कनेक्ट नहीं हो सका” संदेश पर अटके नहीं रहते — अब कनेक्शन पहली ही बार पूरा हो जाता है, भले ही Claude एक साथ कई सत्र शुरू करे।',
      ru: 'При добавлении Remnus в Claude Desktop вы больше не застреваете на сообщении «не удалось подключиться» после входа — соединение теперь устанавливается с первого раза, даже если Claude запускает сразу несколько сеансов.',
      zh: '将 Remnus 添加到 Claude Desktop 时，登录后不会再卡在“无法连接”的提示上——即使 Claude 同时启动多个会话，连接现在也能一次成功。',
    },
  },
  {
    id: '2026-08-21-recurring-series-confirmations',
    date: '2026-08-21',
    category: 'fixed',
    title: {
      en: 'Recurring card actions ask first, then confirm',
      tr: 'Tekrarlayan kart işlemleri artık önce soruyor, sonra doğruluyor',
      de: 'Aktionen an wiederkehrenden Karten fragen jetzt erst nach',
      es: 'Las acciones en tarjetas periódicas ahora preguntan primero',
      fr: 'Les actions sur les cartes récurrentes demandent désormais confirmation',
      hi: 'दोहराने वाले कार्ड पर कार्रवाई अब पहले पूछती है, फिर पुष्टि करती है',
      ru: 'Действия с повторяющимися карточками теперь сначала спрашивают',
      zh: '重复卡片的操作现在会先询问，再确认',
    },
    summary: {
      en: 'Removing the repeat pattern from a series now asks whether that should apply from this card on or to the whole series (it used to unlink every card instantly with no way to scope it down), and both that action and deleting a repeating card now confirm what happened afterward — how many cards were kept or unlinked, or a clear error — instead of going silent.',
      tr: 'Bir seriden tekrarlamayı kaldırmak artık bunun bu karttan itibaren mi yoksa serinin tamamı için mi geçerli olacağını soruyor (öncesinde tek tıkla, kapsam seçmeden anında tüm kartların bağlantısını koparıyordu); hem bu işlem hem de tekrarlayan bir kartı silmek artık ne olduğunu — kaç kartın korunduğunu/seriden çıkarıldığını ya da net bir hatayı — sonradan doğruluyor, sessiz kalmıyor.',
      de: 'Das Entfernen der Wiederholung aus einer Serie fragt jetzt, ob das ab dieser Karte oder für die gesamte Serie gelten soll (bisher wurden sofort alle Karten ohne Auswahlmöglichkeit entkoppelt); sowohl diese Aktion als auch das Löschen einer wiederkehrenden Karte bestätigen jetzt im Anschluss, was passiert ist – wie viele Karten beibehalten oder entkoppelt wurden, oder einen klaren Fehler – statt stumm zu bleiben.',
      es: 'Quitar la repetición de una serie ahora pregunta si debe aplicarse desde esta tarjeta en adelante o a toda la serie (antes desvinculaba todas las tarjetas al instante sin poder elegir el alcance); tanto esa acción como eliminar una tarjeta periódica ahora confirman después qué pasó —cuántas tarjetas se mantuvieron o desvincularon, o un error claro— en lugar de quedarse en silencio.',
      fr: 'Retirer la répétition d’une série demande désormais si cela doit s’appliquer à partir de cette carte ou à toute la série (auparavant, toutes les cartes étaient dissociées instantanément sans possibilité de choisir la portée) ; cette action comme la suppression d’une carte récurrente confirment maintenant ce qui s’est passé — combien de cartes ont été conservées ou dissociées, ou une erreur claire — au lieu de rester silencieuses.',
      hi: 'किसी शृंखला से दोहराव हटाना अब पूछता है कि यह इस कार्ड से आगे के लिए हो या पूरी शृंखला के लिए (पहले यह बिना कोई दायरा चुने तुरंत सभी कार्डों को अलग कर देता था); यह कार्रवाई और दोहराने वाला कार्ड हटाना, दोनों अब बाद में पुष्टि करते हैं कि क्या हुआ — कितने कार्ड रखे गए या अलग किए गए, या एक स्पष्ट त्रुटि — चुप रहने के बजाय।',
      ru: 'Удаление повтора из серии теперь спрашивает, применить ли это начиная с этой карточки или ко всей серии (раньше все карточки мгновенно отвязывались без возможности выбрать область действия); и это действие, и удаление повторяющейся карточки теперь показывают, что произошло — сколько карточек сохранено или отвязано, либо явную ошибку — вместо тишины.',
      zh: '从系列中移除重复现在会询问是从这张卡片开始生效，还是应用于整个系列（以前会立即取消所有卡片的关联，且无法选择范围）；这个操作和删除重复卡片现在都会在之后确认发生了什么——保留或取消关联了多少张卡片，或明确的错误提示——而不再是毫无反应。',
    },
  },
  {
    id: '2026-08-20-calendar-today-marker',
    date: '2026-08-20',
    category: 'improved',
    title: {
      en: 'Today stands out in the calendar',
      tr: 'Takvimde bugün belirgin',
      de: 'Heute fällt im Kalender auf',
      es: 'Hoy destaca en el calendario',
      fr: 'Aujourd’hui ressort dans le calendrier',
      hi: 'कैलेंडर में आज अलग दिखता है',
      ru: 'Сегодняшний день заметен в календаре',
      zh: '日历中今天更醒目',
    },
    summary: {
      en: 'The current day in Calendar view is now highlighted more strongly and labelled “Today” right next to its date, so you can find it without counting squares.',
      tr: 'Takvim görünümünde bugünün karesi artık daha belirgin vurgulanıyor ve tarihinin hemen yanında “Bugün” yazıyor; kareleri saymadan bulabiliyorsun.',
      de: 'Der heutige Tag in der Kalenderansicht ist jetzt deutlicher hervorgehoben und direkt neben dem Datum mit „Heute“ beschriftet, sodass du ihn ohne Suchen findest.',
      es: 'El día actual en la vista de Calendario ahora se resalta con más fuerza y lleva la etiqueta «Hoy» junto a su fecha, así lo encuentras sin contar casillas.',
      fr: 'Le jour en cours dans la vue Calendrier est désormais mis en évidence plus nettement et porte la mention « Aujourd’hui » juste à côté de sa date, pour le repérer d’un coup d’œil.',
      hi: 'कैलेंडर व्यू में आज का दिन अब ज़्यादा स्पष्ट रूप से हाइलाइट होता है और उसकी तारीख़ के ठीक बगल में “आज” लिखा रहता है, जिससे वह तुरंत मिल जाता है।',
      ru: 'Текущий день в Календаре теперь выделен заметнее и подписан «Сегодня» рядом с датой — его легко найти с первого взгляда.',
      zh: '日历视图中的当天现在高亮更明显，并在日期旁标注“今天”，一眼就能找到。',
    },
  },
  {
    id: '2026-08-20-collapsible-table-groups',
    date: '2026-08-20',
    category: 'new',
    title: {
      en: 'Collapse groups in a grouped table',
      tr: 'Gruplu tabloda grupları katla',
      de: 'Gruppen in der gruppierten Tabelle einklappen',
      es: 'Contrae grupos en la tabla agrupada',
      fr: 'Réduis les groupes dans le tableau groupé',
      hi: 'समूहित तालिका में समूह छोटे करें',
      ru: 'Сворачивайте группы в сгруппированной таблице',
      zh: '折叠分组表格中的分组',
    },
    summary: {
      en: 'In a grouped table you can now fold any group down to its header, so only the rows you are working on stay on screen.',
      tr: 'Gruplu tablo görünümünde artık istediğin grubu başlığına kadar katlayabiliyorsun; böylece ekranda yalnızca üzerinde çalıştığın satırlar kalıyor.',
      de: 'In einer gruppierten Tabelle kannst du jede Gruppe jetzt auf ihre Überschrift zusammenklappen, sodass nur die Zeilen sichtbar bleiben, an denen du gerade arbeitest.',
      es: 'En una tabla agrupada ahora puedes plegar cualquier grupo hasta su encabezado, de modo que en pantalla solo queden las filas con las que estás trabajando.',
      fr: 'Dans un tableau groupé, tu peux désormais replier n’importe quel groupe sur son en-tête pour ne garder à l’écran que les lignes sur lesquelles tu travailles.',
      hi: 'अब समूहित तालिका में आप किसी भी समूह को उसके शीर्षक तक समेट सकते हैं, ताकि स्क्रीन पर सिर्फ़ वही पंक्तियाँ रहें जिन पर आप काम कर रहे हैं।',
      ru: 'В сгруппированной таблице теперь можно свернуть любую группу до заголовка, чтобы на экране остались только нужные вам строки.',
      zh: '在分组表格中，你现在可以把任意分组收起到只剩标题，屏幕上只留下你正在处理的行。',
    },
  },
  {
    id: '2026-08-20-collapse-all-cards',
    date: '2026-08-20',
    category: 'improved',
    title: {
      en: 'Collapse a whole day or column at once',
      tr: 'Bir günü ya da kolonu tek seferde küçült',
      de: 'Einen ganzen Tag oder eine Spalte auf einmal einklappen',
      es: 'Contrae todo un día o una columna de una vez',
      fr: 'Réduis toute une journée ou une colonne d’un coup',
      hi: 'पूरे दिन या कॉलम को एक साथ छोटा करें',
      ru: 'Сворачивайте целый день или колонку одним нажатием',
      zh: '一键折叠整天或整列',
    },
    summary: {
      en: 'Calendar days and Kanban columns now have a button that collapses or expands every card inside them in one click.',
      tr: 'Takvim günlerinde ve Kanban kolonlarında artık içindeki tüm kartları tek tıkla küçültüp genişleten bir düğme var.',
      de: 'Kalendertage und Kanban-Spalten haben jetzt eine Schaltfläche, die alle Karten darin mit einem Klick ein- oder ausklappt.',
      es: 'Los días del Calendario y las columnas del Kanban ahora tienen un botón que contrae o expande todas sus tarjetas con un solo clic.',
      fr: 'Les journées du Calendrier et les colonnes du Kanban disposent désormais d’un bouton qui réduit ou développe toutes leurs cartes en un clic.',
      hi: 'कैलेंडर के दिनों और कानबन कॉलम में अब एक बटन है जो उनके अंदर के सभी कार्ड को एक ही क्लिक में छोटा या बड़ा कर देता है।',
      ru: 'У дней Календаря и колонок Канбана теперь есть кнопка, которая одним щелчком сворачивает или разворачивает все карточки внутри.',
      zh: '日历的每一天和看板的每一列现在都有一个按钮，一键即可折叠或展开其中的所有卡片。',
    },
  },
  {
    id: '2026-08-18-collapsed-card-accent-icon',
    date: '2026-08-18',
    category: 'improved',
    title: {
      en: 'Collapsed cards keep their icon',
      tr: 'Küçültülmüş kartlar ikonunu koruyor',
      de: 'Eingeklappte Karten behalten ihr Icon',
      es: 'Las tarjetas contraídas conservan su icono',
      fr: 'Les cartes réduites gardent leur icône',
      hi: 'छोटे किए कार्ड अपना आइकन बनाए रखते हैं',
      ru: 'Свёрнутые карточки сохраняют значок',
      zh: '折叠卡片保留其图标',
    },
    summary: {
      en: 'When you collapse a Calendar or Kanban card, its accent line now shows the selected option’s icon too, so you can still tell what it is at a glance.',
      tr: 'Bir Takvim ya da Kanban kartını küçülttüğünde, vurgu çizgisi artık seçili seçeneğin ikonunu da gösteriyor; kart küçükken bile neyi temsil ettiğini bir bakışta görebiliyorsun.',
      de: 'Wenn du eine Kalender- oder Kanban-Karte einklappst, zeigt ihre Akzentlinie jetzt auch das Icon der ausgewählten Option, damit du auf einen Blick erkennst, worum es geht.',
      es: 'Al contraer una tarjeta de Calendario o Kanban, su línea de acento ahora también muestra el icono de la opción seleccionada, así puedes reconocerla de un vistazo.',
      fr: 'Quand tu réduis une carte de Calendrier ou de Kanban, sa ligne d’accent affiche désormais aussi l’icône de l’option sélectionnée, pour la reconnaître d’un coup d’œil.',
      hi: 'जब आप किसी कैलेंडर या कानबन कार्ड को छोटा करते हैं, तो अब उसकी एक्सेंट लाइन पर चुने गए विकल्प का आइकन भी दिखता है, ताकि एक नज़र में पता चल सके कि वह क्या है।',
      ru: 'Когда вы сворачиваете карточку Календаря или Канбана, на её акцентной линии теперь также отображается значок выбранного варианта — сразу понятно, о чём карточка.',
      zh: '折叠日历或看板卡片时，强调线上现在也会显示所选项的图标，一眼就能看出这张卡片是什么。',
    },
  },
  {
    id: '2026-08-18-agent-repeating-tasks',
    date: '2026-08-18',
    category: 'new',
    title: {
      en: 'Agents can set up repeating tasks',
      tr: 'Ajanlar tekrarlayan görev kurabiliyor',
      de: 'Agenten können wiederkehrende Aufgaben anlegen',
      es: 'Los agentes pueden crear tareas periódicas',
      fr: 'Les agents peuvent créer des tâches récurrentes',
      hi: 'एजेंट दोहराने वाले कार्य बना सकते हैं',
      ru: 'Агенты могут создавать повторяющиеся задачи',
      zh: '智能体可以创建重复任务',
    },
    summary: {
      en: 'You can now just tell a connected AI agent to open a task every Monday and it sets the whole schedule up for you.',
      tr: 'Bağladığın yapay zekâ ajanına artık "her Pazartesi şu görevi aç" demen yetiyor, tekrarlama düzenini kendisi kuruyor.',
      de: 'Du kannst einem verbundenen KI-Agenten jetzt einfach sagen, er soll jeden Montag eine Aufgabe anlegen — den ganzen Rhythmus richtet er selbst ein.',
      es: 'Ahora basta con pedirle a un agente de IA conectado que abra una tarea cada lunes y él configura toda la periodicidad.',
      fr: 'Il suffit désormais de demander à un agent IA connecté d’ouvrir une tâche chaque lundi : il met en place toute la récurrence.',
      hi: 'अब आप जुड़े हुए AI एजेंट से बस इतना कह सकते हैं कि हर सोमवार एक कार्य खोले — वह पूरा दोहराव खुद सेट कर देता है।',
      ru: 'Теперь достаточно попросить подключённого ИИ-агента открывать задачу каждый понедельник — он сам настроит весь график.',
      zh: '现在你只需告诉已连接的 AI 智能体"每周一开一个任务"，它就会把整个重复计划设置好。',
    },
  },
  {
    id: '2026-08-18-recurring-calendar-tasks',
    date: '2026-08-18',
    category: 'new',
    title: {
      en: 'Repeating calendar tasks',
      tr: 'Tekrarlayan takvim görevleri',
      de: 'Wiederkehrende Kalenderaufgaben',
      es: 'Tareas de calendario periódicas',
      fr: 'Tâches de calendrier récurrentes',
      hi: 'दोहराने वाले कैलेंडर कार्य',
      ru: 'Повторяющиеся задачи в календаре',
      zh: '重复的日历任务',
    },
    summary: {
      en: 'Calendar cards can now repeat on any schedule you like, and when you change that schedule only the upcoming cards follow it — everything you already filled in stays exactly as it is.',
      tr: 'Takvim kartları artık istediğin düzende tekrarlanabiliyor ve düzeni değiştirdiğinde yalnızca sonraki kartlar ona uyuyor; içini doldurduğun kartlar olduğu gibi kalıyor.',
      de: 'Kalenderkarten lassen sich jetzt in jedem gewünschten Rhythmus wiederholen — änderst du den Rhythmus, folgen nur die kommenden Karten, alles bereits Ausgefüllte bleibt unangetastet.',
      es: 'Las tarjetas del calendario ya pueden repetirse con la frecuencia que quieras, y al cambiarla solo la siguen las tarjetas futuras: todo lo que ya rellenaste se queda igual.',
      fr: 'Les cartes du calendrier peuvent désormais se répéter au rythme de votre choix, et si vous changez ce rythme seules les cartes à venir le suivent — tout ce que vous avez déjà rempli reste intact.',
      hi: 'कैलेंडर कार्ड अब आपकी पसंद के किसी भी क्रम में दोहराए जा सकते हैं, और क्रम बदलने पर सिर्फ़ आगे के कार्ड बदलते हैं — जो आपने पहले भर दिया है वह वैसा ही रहता है।',
      ru: 'Карточки календаря теперь можно повторять с любым удобным ритмом, а при смене ритма меняются только будущие карточки — всё, что вы уже заполнили, остаётся как есть.',
      zh: '日历卡片现在可以按你喜欢的任意周期重复，改变周期时只有后续卡片会跟着变，你已经填好的内容原样保留。',
    },
  },
  {
    id: '2026-08-18-recurring-delete-scopes',
    date: '2026-08-18',
    category: 'new',
    title: {
      en: 'Choose how much of a series to delete',
      tr: 'Seride ne kadarını sileceğini seç',
      de: 'Wähle, wie viel einer Serie du löschst',
      es: 'Elige cuánto de una serie eliminar',
      fr: 'Choisissez ce que vous supprimez dans une série',
      hi: 'चुनें कि शृंखला का कितना हिस्सा हटाना है',
      ru: 'Выбирайте, какую часть серии удалить',
      zh: '自由选择要删除系列中的多少',
    },
    summary: {
      en: 'Deleting a repeating card now asks whether you mean just this one, this one and everything after it, or the whole series, and tells you up front how many cards already have content in them.',
      tr: 'Tekrarlayan bir kartı silerken artık yalnızca bu görevi mi, bundan sonrakileri mi yoksa tüm seriyi mi kastettiğin soruluyor ve kaç kartın içinin dolu olduğu önceden söyleniyor.',
      de: 'Beim Löschen einer wiederkehrenden Karte wirst du jetzt gefragt, ob du nur diese, diese und alle folgenden oder die ganze Serie meinst — inklusive Hinweis, wie viele Karten schon Inhalt haben.',
      es: 'Al eliminar una tarjeta periódica ahora se te pregunta si te refieres solo a esta, a esta y las siguientes o a toda la serie, y se te avisa cuántas tarjetas ya tienen contenido.',
      fr: 'Supprimer une carte récurrente vous demande maintenant si vous visez seulement celle-ci, celle-ci et les suivantes, ou toute la série, en indiquant d’emblée combien de cartes contiennent déjà du contenu.',
      hi: 'दोहराने वाला कार्ड हटाते समय अब पूछा जाता है कि आपका मतलब सिर्फ़ इसी से है, इससे और आगे वालों से, या पूरी शृंखला से — साथ ही बताया जाता है कि कितने कार्ड में पहले से सामग्री है।',
      ru: 'При удалении повторяющейся карточки теперь спрашивают, имеете ли вы в виду только её, её и все последующие или всю серию, и сразу показывают, сколько карточек уже заполнено.',
      zh: '删除重复卡片时，现在会先问你指的是仅这一张、这张及之后的全部，还是整个系列，并提前告诉你有多少张已经填了内容。',
    },
  },
  {
    id: '2026-08-18-whats-new',
    date: '2026-08-18',
    category: 'new',
    title: {
      en: "What's New panel",
      tr: 'Yenilikler paneli',
      de: 'Neuigkeiten-Panel',
      es: 'Panel de novedades',
      fr: 'Panneau Nouveautés',
      hi: 'नया क्या है पैनल',
      ru: 'Панель новинок',
      zh: '更新动态面板',
    },
    summary: {
      en: 'Every new Remnus feature now shows up in the What’s New panel in your sidebar, so you never miss an update.',
      tr: 'Remnus’a gelen her yeni özellik artık kenar çubuğundaki Yenilikler panelinde görünüyor, hiçbir güncellemeyi kaçırmıyorsun.',
      de: 'Jede neue Remnus-Funktion erscheint jetzt im Neuigkeiten-Panel in deiner Seitenleiste, damit du kein Update mehr verpasst.',
      es: 'Cada nueva función de Remnus aparece ahora en el panel de novedades de tu barra lateral, para que no te pierdas ninguna actualización.',
      fr: 'Chaque nouvelle fonctionnalité de Remnus apparaît désormais dans le panneau Nouveautés de votre barre latérale, pour ne rien manquer.',
      hi: 'Remnus की हर नई सुविधा अब आपके साइडबार के "नया क्या है" पैनल में दिखती है, ताकि कोई अपडेट छूटे नहीं।',
      ru: 'Каждая новая возможность Remnus теперь появляется на панели новинок в боковом меню, чтобы вы ничего не пропустили.',
      zh: '每项 Remnus 新功能现在都会显示在侧边栏的更新动态面板中，让你不会错过任何更新。',
    },
  },
  {
    id: '2026-08-17-card-collapse',
    date: '2026-08-17',
    category: 'improved',
    title: {
      en: 'Collapse busy cards',
      tr: 'Kartları küçültme',
      de: 'Karten einklappen',
      es: 'Contraer tarjetas',
      fr: 'Réduire les cartes',
      hi: 'कार्ड छोटा करें',
      ru: 'Сворачивание карточек',
      zh: '折叠卡片',
    },
    summary: {
      en: 'Shrink any calendar or board card down to just its title so a packed day still fits on one screen.',
      tr: 'Takvim ve pano kartlarını tek satıra küçültebiliyorsun, böylece yoğun bir gün bile tek ekrana sığıyor.',
      de: 'Verkleinere jede Kalender- oder Board-Karte auf ihren Titel, damit auch ein voller Tag auf einen Bildschirm passt.',
      es: 'Reduce cualquier tarjeta del calendario o del tablero a solo su título para que un día lleno quepa en una pantalla.',
      fr: 'Réduisez n’importe quelle carte du calendrier ou du tableau à son seul titre pour qu’une journée chargée tienne sur un écran.',
      hi: 'किसी भी कैलेंडर या बोर्ड कार्ड को सिर्फ़ शीर्षक तक छोटा करें, ताकि व्यस्त दिन भी एक ही स्क्रीन में दिखे।',
      ru: 'Сожмите любую карточку календаря или доски до одного заголовка, чтобы насыщенный день помещался на экране.',
      zh: '可将日历或看板卡片折叠为仅显示标题，让排满的一天也能一屏看完。',
    },
  },
  {
    id: '2026-08-17-drag-drop-position',
    date: '2026-08-17',
    category: 'improved',
    title: {
      en: 'Drop cards exactly where you want',
      tr: 'Kartı tam istediğin yere bırakma',
      de: 'Karten genau dort ablegen, wo du willst',
      es: 'Suelta las tarjetas justo donde quieras',
      fr: 'Déposez les cartes exactement où vous voulez',
      hi: 'कार्ड ठीक वहीं छोड़ें जहाँ चाहें',
      ru: 'Перетаскивайте карточки точно на место',
      zh: '把卡片放到你想要的位置',
    },
    summary: {
      en: 'Dragging a card into a day or a column now places it at the exact position you drop it, not at the end of the list.',
      tr: 'Bir kartı güne veya kolona sürüklediğinde artık listenin sonuna değil, tam bıraktığın sıraya yerleşiyor.',
      de: 'Wenn du eine Karte in einen Tag oder eine Spalte ziehst, landet sie jetzt genau an der Stelle, an der du sie loslässt, statt am Listenende.',
      es: 'Al arrastrar una tarjeta a un día o una columna, ahora se coloca justo donde la sueltas y no al final de la lista.',
      fr: 'En glissant une carte dans un jour ou une colonne, elle se place désormais exactement où vous la déposez, et non en fin de liste.',
      hi: 'किसी कार्ड को दिन या कॉलम में खींचने पर वह अब सूची के अंत में नहीं, बल्कि ठीक उसी जगह बैठता है जहाँ आप छोड़ते हैं।',
      ru: 'Перетащенная в день или колонку карточка теперь встаёт ровно туда, куда вы её отпустили, а не в конец списка.',
      zh: '将卡片拖到某一天或某一列时，它会停在你松手的确切位置，而不是列表末尾。',
    },
  },
  {
    id: '2026-08-17-faster-saves',
    date: '2026-08-17',
    category: 'improved',
    title: {
      en: 'Faster saves after a drag',
      tr: 'Sürükledikten sonra daha hızlı kaydetme',
      de: 'Schnelleres Speichern nach dem Ziehen',
      es: 'Guardado más rápido tras arrastrar',
      fr: 'Enregistrement plus rapide après un glisser-déposer',
      hi: 'खींचने के बाद तेज़ सेव',
      ru: 'Быстрое сохранение после перетаскивания',
      zh: '拖动后保存更快',
    },
    summary: {
      en: 'Moving a card in a large database now saves almost instantly, with a clear "saved" indicator when it lands.',
      tr: 'Büyük bir veritabanında kartı taşımak artık neredeyse anında kaydediliyor ve tamamlandığında net bir "kaydedildi" göstergesi çıkıyor.',
      de: 'Das Verschieben einer Karte in einer großen Datenbank wird jetzt fast sofort gespeichert – mit einer klaren „Gespeichert“-Anzeige.',
      es: 'Mover una tarjeta en una base de datos grande ahora se guarda casi al instante, con un indicador claro de "guardado".',
      fr: 'Déplacer une carte dans une grande base est désormais enregistré quasi instantanément, avec un indicateur « enregistré » explicite.',
      hi: 'बड़े डेटाबेस में कार्ड हिलाने पर अब लगभग तुरंत सेव होता है और साफ़ "सेव हुआ" संकेत दिखता है।',
      ru: 'Перемещение карточки в большой базе теперь сохраняется почти мгновенно, с понятным индикатором «сохранено».',
      zh: '在大型数据库中移动卡片几乎可以立即保存，并会显示明确的"已保存"提示。',
    },
  },
  {
    id: '2026-08-12-agent-guides',
    date: '2026-08-12',
    category: 'new',
    title: {
      en: 'New guides for working with agents',
      tr: 'Ajanlarla çalışma rehberleri',
      de: 'Neue Leitfäden für die Arbeit mit Agenten',
      es: 'Nuevas guías para trabajar con agentes',
      fr: 'Nouveaux guides pour travailler avec des agents',
      hi: 'एजेंट के साथ काम करने की नई गाइड',
      ru: 'Новые руководства по работе с агентами',
      zh: '与智能体协作的新指南',
    },
    summary: {
      en: 'Fresh guides on keeping your agent connection secure and on why AI agents forget your project are now live on the blog.',
      tr: 'Ajan bağlantını güvende tutma ve yapay zekâ ajanlarının projeni neden unuttuğu üzerine yeni rehberler blogda yayında.',
      de: 'Neue Leitfäden dazu, wie du deine Agentenverbindung absicherst und warum KI-Agenten dein Projekt vergessen, sind jetzt im Blog.',
      es: 'Ya están en el blog nuevas guías sobre cómo mantener segura la conexión de tus agentes y por qué los agentes de IA olvidan tu proyecto.',
      fr: 'De nouveaux guides sur la sécurisation de la connexion de vos agents et sur l’oubli du contexte par les agents IA sont en ligne sur le blog.',
      hi: 'एजेंट कनेक्शन सुरक्षित रखने और AI एजेंट आपका प्रोजेक्ट क्यों भूल जाते हैं, इस पर नई गाइड अब ब्लॉग पर हैं।',
      ru: 'В блоге появились новые руководства о безопасности подключения агентов и о том, почему ИИ-агенты забывают ваш проект.',
      zh: '博客上线了新指南：如何保障智能体连接安全，以及 AI 智能体为何会忘记你的项目。',
    },
  },
  {
    id: '2026-08-05-agent-batch-read',
    date: '2026-08-05',
    category: 'new',
    title: {
      en: 'Agents read many pages at once',
      tr: 'Ajanlar birçok sayfayı tek seferde okuyor',
      de: 'Agenten lesen viele Seiten auf einmal',
      es: 'Los agentes leen muchas páginas a la vez',
      fr: 'Les agents lisent plusieurs pages d’un coup',
      hi: 'एजेंट एक साथ कई पेज पढ़ते हैं',
      ru: 'Агенты читают много страниц сразу',
      zh: '智能体一次读取多个页面',
    },
    summary: {
      en: 'Connected AI agents can now pull a whole set of pages in a single step, so they answer noticeably faster.',
      tr: 'Bağladığın yapay zekâ ajanları artık bir grup sayfayı tek adımda çekebiliyor ve gözle görülür şekilde daha hızlı yanıt veriyor.',
      de: 'Verbundene KI-Agenten können jetzt einen ganzen Satz Seiten in einem Schritt abrufen und antworten dadurch merklich schneller.',
      es: 'Los agentes de IA conectados ya pueden traer un conjunto de páginas en un solo paso, así que responden mucho más rápido.',
      fr: 'Les agents IA connectés peuvent désormais récupérer tout un ensemble de pages en une seule étape, et répondent donc bien plus vite.',
      hi: 'जुड़े हुए AI एजेंट अब एक ही चरण में कई पेज ला सकते हैं, इसलिए वे साफ़ तौर पर तेज़ जवाब देते हैं।',
      ru: 'Подключённые ИИ-агенты теперь получают целый набор страниц за один шаг и отвечают заметно быстрее.',
      zh: '已连接的 AI 智能体现在可一次性获取整组页面，回答速度明显更快。',
    },
  },
  {
    id: '2026-08-04-context-packs',
    date: '2026-08-04',
    category: 'new',
    title: {
      en: 'Agents get the right context automatically',
      tr: 'Ajanlara doğru bağlam otomatik veriliyor',
      de: 'Agenten erhalten automatisch den richtigen Kontext',
      es: 'Los agentes reciben el contexto correcto automáticamente',
      fr: 'Les agents reçoivent automatiquement le bon contexte',
      hi: 'एजेंट को सही संदर्भ अपने आप मिलता है',
      ru: 'Агенты автоматически получают нужный контекст',
      zh: '智能体自动获得所需上下文',
    },
    summary: {
      en: 'When an agent starts a task, Remnus now gathers the related pages from your workspace and hands them over on its own.',
      tr: 'Bir ajan göreve başladığında Remnus artık çalışma alanındaki ilgili sayfaları kendisi toplayıp ona veriyor.',
      de: 'Wenn ein Agent eine Aufgabe startet, sammelt Remnus jetzt selbst die passenden Seiten aus deinem Workspace und übergibt sie.',
      es: 'Cuando un agente inicia una tarea, Remnus reúne por su cuenta las páginas relacionadas de tu espacio y se las entrega.',
      fr: 'Quand un agent démarre une tâche, Remnus rassemble désormais tout seul les pages liées de votre espace et les lui transmet.',
      hi: 'जब कोई एजेंट काम शुरू करता है, तो Remnus अब आपके वर्कस्पेस से संबंधित पेज खुद जुटाकर उसे दे देता है।',
      ru: 'Когда агент берётся за задачу, Remnus сам собирает связанные страницы вашего рабочего пространства и передаёт их ему.',
      zh: '当智能体开始一项任务时，Remnus 现在会自动汇集工作区中的相关页面并交给它。',
    },
  },
  {
    id: '2026-08-04-agent-connection-fix',
    date: '2026-08-04',
    category: 'fixed',
    title: {
      en: 'Steadier agent connection',
      tr: 'Daha kararlı ajan bağlantısı',
      de: 'Stabilere Agentenverbindung',
      es: 'Conexión de agentes más estable',
      fr: 'Connexion des agents plus stable',
      hi: 'ज़्यादा स्थिर एजेंट कनेक्शन',
      ru: 'Более стабильное подключение агентов',
      zh: '更稳定的智能体连接',
    },
    summary: {
      en: 'Agent connections no longer hang or ask you to sign in again and again.',
      tr: 'Ajan bağlantıları artık takılmıyor ve seni tekrar tekrar giriş yapmaya zorlamıyor.',
      de: 'Agentenverbindungen hängen nicht mehr und fordern dich nicht immer wieder zur Anmeldung auf.',
      es: 'Las conexiones de agentes ya no se quedan colgadas ni te piden iniciar sesión una y otra vez.',
      fr: 'Les connexions d’agents ne se bloquent plus et ne vous redemandent plus de vous reconnecter sans arrêt.',
      hi: 'एजेंट कनेक्शन अब अटकते नहीं हैं और बार-बार साइन इन करने को नहीं कहते।',
      ru: 'Подключения агентов больше не зависают и не просят входить снова и снова.',
      zh: '智能体连接不再卡住，也不会反复要求你重新登录。',
    },
  },
];

/** Falls back to English if a locale somehow slips through (e.g. a new locale added
 *  to routing before the entries were translated). */
export function localizedText(text: LocalizedText, locale: string): string {
  return text[locale as Locale] ?? text.en;
}

export function newestEntryId(): string {
  return CHANGELOG[0]?.id ?? '';
}

/**
 * How many entries the user has not seen yet.
 *
 * `lastSeenId` is the newest entry id they had already seen. Anything above it in
 * the array is unread. With no cookie (first visit, or an id we no longer ship) we
 * fall back to a short recency window instead of "everything", so a fresh account
 * sees "3 updates this week", not the entire product history.
 */
export function countUnseenEntries(
  lastSeenId: string | null | undefined,
  now: Date = new Date(),
): number {
  if (lastSeenId) {
    const index = CHANGELOG.findIndex((e) => e.id === lastSeenId);
    if (index !== -1) return index;
  }
  const cutoff = now.getTime() - FIRST_VISIT_WINDOW_DAYS * 86_400_000;
  return CHANGELOG.filter((e) => {
    const t = new Date(`${e.date}T00:00:00`).getTime();
    return !Number.isNaN(t) && t >= cutoff;
  }).length;
}
