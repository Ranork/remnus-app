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
