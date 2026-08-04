/**
 * Remnus — LinkedIn DM exporter (browser console script)
 * =======================================================
 *
 * Kendi LinkedIn mesajlarını, Remnus'un database "Bulk add/update" diyaloğuna
 * doğrudan yapıştırılabilecek düz bir JSON dizisine çevirir. Hiçbir yere veri
 * göndermez — çıktı yalnızca konsolda / panoda / indirilen dosyada kalır.
 *
 * KULLANIM
 * --------
 * 1. https://www.linkedin.com/messaging/ adresini aç.
 * 2. DevTools > Console. (Chrome ilk seferde yapıştırmayı engeller;
 *    konsola `allow pasting` yazıp Enter'a bas, sonra script'i yapıştır.)
 * 3. Bu dosyanın tamamını yapıştır + Enter. `RemnusExport` global'i oluşur.
 * 4. Komutlar:
 *
 *      await RemnusExport.thread()            // açık olan sohbeti dışa aktar
 *      await RemnusExport.all({ limit: 20 })  // soldaki listede gezip hepsini al
 *      await RemnusExport.all({ limit: 30, onlyWithReply: true })
 *      RemnusExport.copy()                    // son sonucu panoya kopyala
 *      RemnusExport.download()                // .json dosyası indir
 *      RemnusExport.debug()                   // selector'lar tutuyor mu, kontrol
 *
 * 5. Remnus'ta Marketing Log database'ini aç > Bulk add/update > "Add new rows"
 *    > panodakini yapıştır > önizlemeyi kontrol et > oluştur.
 *
 * ÇIKTI FORMATI
 * -------------
 * Düz nesnelerden oluşan bir dizi; anahtarlar kolon adlarıyla (case-insensitive)
 * eşleşir. `content` rezerve anahtardır: property'ye değil, satırın sayfa
 * gövdesine yazılır (bkz. src/lib/utils/propertyCoercion.ts extractRowContent).
 * Şemada olmayan select değerleri (ör. Angle) import sırasında otomatik seçenek
 * olarak eklenir.
 *
 * NOTLAR
 * ------
 * - Diyaloğa **JSON** yapıştır, TSV/CSV değil: transkript çok satırlı olduğu için
 *   sekme/virgül ayrımı gövdeyi parçalar.
 * - Tek seferde en fazla 500 satır (MAX_BULK_ROWS). Server action gövde limiti
 *   varsayılan 1MB olduğundan, çok uzun transkriptlerde partiyi küçük tut.
 * - LinkedIn DOM'u haber vermeden değişir. Bir şey boş dönerse önce
 *   `RemnusExport.debug()` çalıştır; hangi selector'ın düştüğünü söyler,
 *   aşağıdaki SELECTORS bloğundan düzeltilir.
 * - `all()` sohbetleri tek tek tıklayarak gezer. Aradaki bekleme bilerek
 *   konur; düşürme.
 * - Otomatik doldurulan tek Status "Published" (= gönderildi). Traction /
 *   Died quietly kararını insan verir; script sana `review` listesinde
 *   hangi satırın ne göründüğünü söyler.
 */
(() => {
  'use strict';

  // ── Ayarlar ─────────────────────────────────────────────────────────────────

  const CONFIG = {
    /** Marketing Log kolon adlarıyla eşleşir; boş bırakılan alan yazılmaz. */
    channel: 'LinkedIn',
    defaultStatus: 'Published',
    /** Şemada yoksa import sırasında otomatik seçenek olarak eklenir. */
    angle: 'Direct outreach',
    titlePrefix: 'LinkedIn DM — ',
    /** null = üst navdaki profil adından otomatik bul */
    me: null,
    /** sohbetler arası bekleme (ms) */
    threadDelayMs: 1400,
    /** geçmişi yukarı kaydırarak yükleme denemesi üst sınırı */
    historyRounds: 40,
  };

  // ── Selector'lar (LinkedIn değişirse burayı güncelle) ───────────────────────

  const SELECTORS = {
    convList: ['ul.msg-conversations-container__conversations-list', '.msg-conversations-container__conversations-list'],
    convItem: ['li.msg-conversation-listitem', '.msg-conversation-listitem'],
    convLink: ['.msg-conversation-listitem__link', 'a[href*="/messaging/thread/"]'],
    convName: ['.msg-conversation-listitem__participant-names', '.msg-conversation-card__participant-names'],
    threadList: ['ul.msg-s-message-list-content', '.msg-s-message-list-content'],
    event: ['li.msg-s-message-list__event'],
    listItem: ['.msg-s-event-listitem'],
    timeHeading: ['.msg-s-message-list__time-heading', 'time.msg-s-message-list__time-heading'],
    groupName: ['.msg-s-message-group__name', '.msg-s-event-listitem__name'],
    groupTime: ['.msg-s-message-group__timestamp', '.msg-s-event-listitem__timestamp'],
    body: ['.msg-s-event-listitem__body', '.msg-s-event__content'],
    threadTitle: ['#thread-detail-jump-target', '.msg-entity-lockup__entity-title', '.msg-thread__link-to-profile'],
    threadHeadline: ['.msg-s-profile-card__profile-info', '.msg-entity-lockup__entity-info', '.msg-thread__profile-card-headline'],
    profileLink: ['a[href*="/in/"]'],
    meName: ['img.global-nav__me-photo', '.global-nav__me-photo'],
  };

  // ── Küçük yardımcılar ───────────────────────────────────────────────────────

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const one = (root, list) => {
    for (const sel of list) {
      const el = root.querySelector(sel);
      if (el) return el;
    }
    return null;
  };

  const many = (root, list) => {
    for (const sel of list) {
      const els = root.querySelectorAll(sel);
      if (els.length) return Array.from(els);
    }
    return [];
  };

  const text = (el) => (el ? el.innerText.replace(/ /g, ' ').trim() : '');

  /** İlk anlamlı satır — LinkedIn ad alanına rozet/derece metni karıştırıyor. */
  const firstLine = (s) => (s || '').split('\n').map((l) => l.trim()).filter(Boolean)[0] || '';

  /** tr-aware normalize: karşılaştırma ve ay/gün eşleme için */
  const norm = (s) =>
    (s || '')
      .toLocaleLowerCase('tr')
      .replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ı/g, 'i')
      .replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c')
      .replace(/â/g, 'a').replace(/î/g, 'i').replace(/û/g, 'u')
      .replace(/\s+/g, ' ')
      .trim();

  const findScrollParent = (el) => {
    let node = el;
    while (node && node !== document.body) {
      const style = getComputedStyle(node);
      const scrollable = /auto|scroll|overlay/.test(style.overflowY);
      if (scrollable && node.scrollHeight > node.clientHeight + 4) return node;
      node = node.parentElement;
    }
    return null;
  };

  // ── Tarih / saat ayrıştırma ─────────────────────────────────────────────────

  const MONTHS = {
    oca: 0, sub: 1, mar: 2, nis: 3, may: 4, haz: 5, tem: 6, agu: 7, eyl: 8, eki: 9, kas: 10, ara: 11,
    jan: 0, feb: 1, apr: 3, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  };

  /** Pazartesi=1 … Pazar=0 (Date.getDay ile aynı düzen) */
  const WEEKDAYS = {
    pazar: 0, pazartesi: 1, sali: 2, carsamba: 3, persembe: 4, cuma: 5, cumartesi: 6,
    sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
  };

  const iso = (d) => {
    if (!(d instanceof Date) || Number.isNaN(d.getTime())) return null;
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  };

  /**
   * "BUGÜN" | "DÜN" | "ÇARŞAMBA" | "30 Tem" | "30 Tem 2025" | "Jul 30, 2025"
   * → ISO tarih. Çözemezse null döner ve ham metin korunur.
   */
  function parseDateHeading(raw, today = new Date()) {
    const s = norm(raw);
    if (!s) return null;

    if (s === 'bugun' || s === 'today') return iso(today);
    if (s === 'dun' || s === 'yesterday') {
      const d = new Date(today);
      d.setDate(d.getDate() - 1);
      return iso(d);
    }

    if (Object.prototype.hasOwnProperty.call(WEEKDAYS, s)) {
      // Son 7 gün içindeki en yakın geçmiş eşleşme
      const target = WEEKDAYS[s];
      const d = new Date(today);
      for (let i = 0; i < 8; i++) {
        if (d.getDay() === target) return iso(d);
        d.setDate(d.getDate() - 1);
      }
      return null;
    }

    // "30 tem" / "30 tem 2025"
    let m = s.match(/^(\d{1,2})\s+([a-z]+)\.?(?:\s+(\d{4}))?$/);
    if (m) return buildDate(Number(m[1]), m[2], m[3], today);

    // "tem 30" / "jul 30, 2025"
    m = s.match(/^([a-z]+)\.?\s+(\d{1,2})(?:,)?(?:\s+(\d{4}))?$/);
    if (m) return buildDate(Number(m[2]), m[1], m[3], today);

    // "30.07.2025" / "30/07/2025"
    m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2,4})$/);
    if (m) {
      const year = Number(m[3].length === 2 ? `20${m[3]}` : m[3]);
      return iso(new Date(year, Number(m[2]) - 1, Number(m[1])));
    }

    return null;
  }

  function buildDate(day, monthWord, yearWord, today) {
    const month = MONTHS[monthWord.slice(0, 3)];
    if (month === undefined) return null;
    if (yearWord) return iso(new Date(Number(yearWord), month, day));
    // Yıl yoksa: bugünden ileri düşüyorsa bir önceki yıl demektir.
    let year = today.getFullYear();
    let d = new Date(year, month, day);
    if (d.getTime() > today.getTime() + 86400000) d = new Date(--year, month, day);
    return iso(d);
  }

  /** "22:40", "10:23 AM", "• 22:40" → "22:40" (24h) */
  function parseTime(raw) {
    const s = (raw || '').replace(/[•·]/g, ' ').trim();
    const m = s.match(/(\d{1,2}):(\d{2})\s*(AM|PM|ÖÖ|ÖS)?/i);
    if (!m) return null;
    let h = Number(m[1]);
    const min = m[2];
    const mer = (m[3] || '').toUpperCase();
    if (mer === 'PM' || mer === 'ÖS') { if (h < 12) h += 12; }
    if (mer === 'AM' || mer === 'ÖÖ') { if (h === 12) h = 0; }
    return `${String(h).padStart(2, '0')}:${min}`;
  }

  // ── "Ben" kimim ─────────────────────────────────────────────────────────────

  function detectMe() {
    if (CONFIG.me) return CONFIG.me;
    const img = one(document, SELECTORS.meName);
    const alt = img?.getAttribute('alt') || '';
    const name = firstLine(alt).replace(/^Fotoğraf[:\s]*/i, '').trim();
    return name || null;
  }

  // ── Tek sohbeti okuma ───────────────────────────────────────────────────────

  async function loadFullHistory(rounds = CONFIG.historyRounds) {
    const list = one(document, SELECTORS.threadList);
    if (!list) return 0;
    const scroller = findScrollParent(list);
    if (!scroller) return many(list, SELECTORS.event).length;

    let last = -1;
    for (let i = 0; i < rounds; i++) {
      const count = many(list, SELECTORS.event).length;
      if (count === last) break;
      last = count;
      scroller.scrollTop = 0;
      await sleep(650);
    }
    return last;
  }

  function readOpenThread({ me }) {
    const list = one(document, SELECTORS.threadList);
    if (!list) return null;

    const events = many(list, SELECTORS.event);
    const messages = [];
    let currentDate = null;
    let currentDateRaw = null;
    let lastSender = null;
    let lastTime = null;

    for (const li of events) {
      const heading = one(li, SELECTORS.timeHeading);
      if (heading) {
        currentDateRaw = text(heading);
        currentDate = parseDateHeading(currentDateRaw);
      }

      const items = many(li, SELECTORS.listItem);
      const nodes = items.length ? items : [li];

      for (const item of nodes) {
        const name = firstLine(text(one(item, SELECTORS.groupName)));
        if (name) lastSender = name;
        const t = parseTime(text(one(item, SELECTORS.groupTime)));
        if (t) lastTime = t;

        const bodyEl = one(item, SELECTORS.body);
        let body = text(bodyEl);

        if (!body) {
          const link = item.querySelector('a[href^="http"]');
          if (link) body = `[bağlantı] ${link.href}`;
        }
        if (!body) continue;

        messages.push({
          date: currentDate,
          dateRaw: currentDateRaw,
          time: lastTime,
          sender: lastSender || '(bilinmiyor)',
          fromMe: !!(me && lastSender && norm(lastSender) === norm(me)),
          text: body,
        });
      }
    }

    const titleEl = one(document, SELECTORS.threadTitle);
    const headlineEl = one(document, SELECTORS.threadHeadline);
    const profileEl = one(document, SELECTORS.profileLink);

    const counterpart =
      firstLine(text(titleEl)) ||
      messages.find((m) => !m.fromMe)?.sender ||
      '(bilinmiyor)';

    // Başlık kartındaki satırlardan adı ve dereceyi at, kalan ilk satır headline'dır.
    const headlineLines = text(headlineEl)
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && norm(l) !== norm(counterpart) && !/^·?\s*\d\.$/.test(l) && !/^(1st|2nd|3rd|1\.|2\.|3\.)$/i.test(l));

    return {
      counterpart,
      headline: headlineLines[0] || null,
      profileUrl: profileEl ? profileEl.href.split('?')[0] : null,
      threadUrl: location.href.split('?')[0],
      messages,
    };
  }

  // ── Markdown gövdesi + bulk-import satırı ───────────────────────────────────

  function toMarkdown(thread, me) {
    const msgs = thread.messages;
    const mine = msgs.filter((m) => m.fromMe).length;
    const theirs = msgs.length - mine;
    const first = msgs[0];
    const last = msgs[msgs.length - 1];
    const range =
      first && last
        ? first.date === last.date
          ? `${first.date || first.dateRaw || '?'}`
          : `${first.date || first.dateRaw || '?'} – ${last.date || last.dateRaw || '?'}`
        : '?';

    const lines = [];
    lines.push(`# ${CONFIG.titlePrefix}${thread.counterpart}`);
    lines.push('');
    if (thread.headline) lines.push(`**Profil:** ${thread.headline}`);
    if (thread.profileUrl) lines.push(`**Profil linki:** ${thread.profileUrl}`);
    lines.push(`**Tarih:** ${range}`);
    lines.push(`**Mesaj:** ${msgs.length} (ben: ${mine}, karşı taraf: ${theirs})`);
    lines.push(
      `**Son mesaj:** ${last ? `${last.fromMe ? 'ben' : thread.counterpart} — ${last.date || last.dateRaw || '?'} ${last.time || ''}`.trim() : '—'}`,
    );
    if (theirs === 0) lines.push('**Durum:** karşı taraftan hiç yanıt yok.');
    else if (last && last.fromMe) lines.push('**Durum:** top karşı tarafta, yanıt bekleniyor.');
    lines.push('');
    lines.push('## Transkript');
    lines.push('');

    let day = Symbol('none');
    for (const m of msgs) {
      const key = m.date || m.dateRaw || 'tarih yok';
      if (key !== day) {
        day = key;
        lines.push(`### ${key}`);
        lines.push('');
      }
      const who = m.fromMe ? (me || 'Ben') : m.sender;
      const body = m.text.split('\n').map((l, i) => (i === 0 ? l : `  ${l}`)).join('\n');
      lines.push(`- **${m.time || '--:--'} — ${who}:** ${body}`);
    }

    lines.push('');
    lines.push('## Çıkarımlar');
    lines.push('');
    lines.push('_(doldurulacak)_');
    lines.push('');
    lines.push('## Takip');
    lines.push('');
    lines.push('_(doldurulacak)_');

    return lines.join('\n');
  }

  /**
   * Bulk add/update diyaloğuna yapıştırılacak düz satır. Anahtarlar kolon
   * adlarıdır; `content` rezerve anahtar olarak sayfa gövdesine gider.
   */
  function toRow(thread, me) {
    const msgs = thread.messages;
    const last = msgs[msgs.length - 1];
    const row = {
      Title: `${CONFIG.titlePrefix}${thread.counterpart}`,
      Channel: CONFIG.channel,
      Status: CONFIG.defaultStatus,
      content: toMarkdown(thread, me),
    };
    if (CONFIG.angle) row.Angle = CONFIG.angle;
    if (last?.date) row.Date = last.date;
    return row;
  }

  function toReview(thread) {
    const msgs = thread.messages;
    const theirs = msgs.filter((m) => !m.fromMe).length;
    const last = msgs[msgs.length - 1];
    let hint;
    if (theirs === 0) hint = 'yanıt yok → Published (takip kararı ver)';
    else if (last && last.fromMe) hint = 'yanıt geldi, son söz bende → Published';
    else hint = 'son mesaj karşı taraftan → Traction / Died quietly ayrımını oku';
    return {
      title: `${CONFIG.titlePrefix}${thread.counterpart}`,
      messages: msgs.length,
      replies: theirs,
      lastDate: last?.date || last?.dateRaw || null,
      undatedMessages: msgs.filter((m) => !m.date).length,
      hint,
    };
  }

  // ── Genel API ───────────────────────────────────────────────────────────────

  let LAST = null;

  async function exportOpenThread({ quiet = false } = {}) {
    const me = detectMe();
    if (!me && !quiet) {
      console.warn('[RemnusExport] Kendi adın bulunamadı; CONFIG.me değerini elle set et, yoksa "ben/karşı taraf" ayrımı yanlış olur.');
    }
    await loadFullHistory();
    const thread = readOpenThread({ me });
    if (!thread || !thread.messages.length) {
      if (!quiet) console.error('[RemnusExport] Açık sohbette mesaj bulunamadı. RemnusExport.debug() çalıştır.');
      return null;
    }
    return { thread, row: toRow(thread, me), review: toReview(thread) };
  }

  const RemnusExport = {
    CONFIG,
    SELECTORS,

    /** Açık olan sohbeti dışa aktarır. */
    async thread() {
      const out = await exportOpenThread();
      if (!out) return null;
      LAST = { rows: [out.row], review: [out.review], threads: [out.thread] };
      console.table(LAST.review);
      console.log('[RemnusExport] Hazır. RemnusExport.copy() veya RemnusExport.download()');
      return LAST;
    },

    /**
     * Sol listedeki sohbetleri sırayla gezip hepsini dışa aktarır.
     * @param {{limit?:number, onlyWithReply?:boolean, delayMs?:number}} opts
     */
    async all(opts = {}) {
      const { limit = 20, onlyWithReply = false, delayMs = CONFIG.threadDelayMs } = opts;
      const me = detectMe();
      const listRoot = one(document, SELECTORS.convList);
      if (!listRoot) {
        console.error('[RemnusExport] Sohbet listesi bulunamadı. RemnusExport.debug() çalıştır.');
        return null;
      }

      const items = many(listRoot, SELECTORS.convItem).slice(0, limit);
      console.log(`[RemnusExport] ${items.length} sohbet gezilecek. Sekmeyi açık bırak.`);

      const rows = [];
      const review = [];
      const threads = [];
      const skipped = [];

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const name = firstLine(text(one(item, SELECTORS.convName))) || `#${i + 1}`;
        const clickTarget = one(item, SELECTORS.convLink) || item;

        clickTarget.scrollIntoView({ block: 'center' });
        clickTarget.click();
        await sleep(delayMs);

        const out = await exportOpenThread({ quiet: true });
        if (!out) {
          skipped.push({ name, reason: 'mesaj okunamadı' });
          console.warn(`[RemnusExport] ${i + 1}/${items.length} atlandı: ${name}`);
          continue;
        }
        if (onlyWithReply && out.review.replies === 0) {
          skipped.push({ name: out.review.title, reason: 'yanıt yok' });
          console.log(`[RemnusExport] ${i + 1}/${items.length} atlandı (yanıt yok): ${name}`);
          continue;
        }

        rows.push(out.row);
        review.push(out.review);
        threads.push(out.thread);
        console.log(`[RemnusExport] ${i + 1}/${items.length} ✓ ${out.review.title} (${out.review.messages} mesaj)`);
        await sleep(250);
      }

      LAST = { rows, review, threads, skipped, me };
      console.table(review);
      if (skipped.length) console.table(skipped);
      console.log(`[RemnusExport] ${rows.length} satır hazır. RemnusExport.copy() veya RemnusExport.download()`);
      return LAST;
    },

    /** Bulk add/update diyaloğuna yapıştırılacak diziyi panoya kopyalar. */
    async copy({ full = false } = {}) {
      if (!LAST) return console.error('[RemnusExport] Önce thread() veya all() çalıştır.');
      const data = full ? LAST : LAST.rows;
      const json = JSON.stringify(data, null, 2);
      try {
        await navigator.clipboard.writeText(json);
        console.log(`[RemnusExport] Panoya kopyalandı (${json.length} karakter). Remnus > Marketing Log > Bulk add/update > Add new rows.`);
      } catch {
        console.warn('[RemnusExport] Pano reddedildi (sekme odakta değil olabilir). Konsolda: copy(RemnusExport.json())');
      }
      return json;
    },

    /** Son sonucu JSON dosyası olarak indirir. */
    download({ full = false } = {}) {
      if (!LAST) return console.error('[RemnusExport] Önce thread() veya all() çalıştır.');
      const data = full ? LAST : LAST.rows;
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `remnus-linkedin-${iso(new Date())}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      console.log(`[RemnusExport] İndirildi: ${a.download}`);
    },

    /** Konsolun `copy()` fonksiyonuna vermek için ham JSON. */
    json({ full = false } = {}) {
      if (!LAST) return null;
      return JSON.stringify(full ? LAST : LAST.rows, null, 2);
    },

    last() {
      return LAST;
    },

    /** Selector'lar hâlâ tutuyor mu? DOM değiştiyse ilk bakılacak yer. */
    debug() {
      const rows = [];
      const check = (label, root, sels) => {
        const hit = sels.find((s) => root.querySelector(s));
        rows.push({
          alan: label,
          eşleşen: hit || '— HİÇBİRİ —',
          adet: hit ? root.querySelectorAll(hit).length : 0,
        });
      };
      check('sohbet listesi', document, SELECTORS.convList);
      check('sohbet satırı', document, SELECTORS.convItem);
      check('sohbet adı', document, SELECTORS.convName);
      check('mesaj listesi', document, SELECTORS.threadList);
      check('mesaj event', document, SELECTORS.event);
      check('mesaj kutusu', document, SELECTORS.listItem);
      check('gün başlığı', document, SELECTORS.timeHeading);
      check('gönderen adı', document, SELECTORS.groupName);
      check('saat', document, SELECTORS.groupTime);
      check('mesaj gövdesi', document, SELECTORS.body);
      check('sohbet başlığı', document, SELECTORS.threadTitle);
      console.table(rows);
      console.log('[RemnusExport] Ben =', detectMe() || '(bulunamadı → CONFIG.me set et)');
      const list = one(document, SELECTORS.threadList);
      console.log('[RemnusExport] Kaydırma kabı =', list ? findScrollParent(list) : null);
      return rows;
    },
  };

  window.RemnusExport = RemnusExport;
  console.log(
    '%c[RemnusExport] hazır.',
    'color:#22c55e;font-weight:bold',
    '\n  await RemnusExport.thread()\n  await RemnusExport.all({ limit: 20, onlyWithReply: true })\n  RemnusExport.copy() / .download() / .debug()',
  );
})();
