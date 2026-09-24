# Remnus → "Agent OS" Yol Haritası — Chat Promptları

Hazırlanma tarihi: 2026-09-21. Kaynak: Hakan'ın 10 maddelik geliştirme listesi.

Bu dosya, geliştirme isteklerini **13 ayrı chat oturumuna** böler (P10–P13,
2026-09-23'teki Jev/graph araştırmasından sonra eklendi). Her `P#` bloğu kendi
başına yeterlidir. Promptlar sıralıdır — bağımlılıklar aşağıdaki tabloda.

**Nasıl çalıştırılır:** Yeni bir chat aç ve şunu yaz (yalnızca numarayı değiştir):

```text
.ai/AGENT_OS_ROADMAP_PROMPTS.md dosyasındaki "# P1 —" başlıklı bölümü oku ve
içinde tarif edilen işi baştan sona yap. Yalnızca o bölümü oku; dosyadaki diğer
P bloklarını okuma, onlar başka oturumların işi. Bölümün içindeki kod iddialarını
(dosya yolları, satır numaraları, fonksiyon adları) uygulamadan önce koddan
doğrula — dosya 2026-09-21'de yazıldı ve önceki adımlar bazılarını değiştirmiş
olabilir. İş bitince o bölümün sonuna kısa bir "tamamlandı" notu ve gerçekte ne
yaptığının özetini ekle.
```

Alternatif olarak ilgili `P#` bloğunun içindeki metni doğrudan kopyalayıp
yapıştırabilirsin; iki yol da aynı işi tarif eder.

Aklında bulunsun istediğin her şey için gidip internetten araştırma yapabilirsin. Kafadan atmak yerine her detayıyla araştırmalar yapıp düzgün bir şey ortaya çıkarabiliriz.

## Sıra ve gerekçe

| #   | Prompt                                                              | Kapsadığı istek       | Neden bu sırada                                                                                                                               |
| --- | ------------------------------------------------------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| P1  | Proje penceresi: canlı güncelleme + UI temizliği + doğru çıkış yolu | 9, 7, 6               | Küçük, birbirinden bağımsız, hemen görünür. P8/P9'da calibrate'i test ederken pencerenin canlı olması şart.                                   |
| P2  | Projeye katılma akışı + erişim isteği                               | ekip kullanımı        | Ekip kullanımının önündeki tek sert engel. Diğerlerinden bağımsız, bu yüzden erkene alındı — sonraki adımlar da iki kişiyle test edilebilsin. |
| P3  | Yazma yolu hızlandırma (bulk batch)                                 | 4                     | Tek başına ölçülebilir; calibrate'i hızlandırmadan calibrate'i iyileştirmenin anlamı yok.                                                     |
| P4  | Token diyeti + yerel proje haritası                                 | 10                    | Ürünün asıl vaadi. P3'ten sonra, çünkü "hız" iddiasının yazma tarafı çözülmüş olmalı.                                                         |
| P5  | Tasarruf metrikleri (Brave tarzı)                                   | 8                     | P4'te eklenen sayaçlar olmadan gösterilecek dürüst bir sayı yok.                                                                              |
| P6  | Dashboard sayfa tipi + component modeli (çekirdek)                  | 2 (+1'in veri modeli) | Yeni ürün yüzeyi; P1-P5 stabil olduktan sonra.                                                                                                |
| P7  | Dashboard'ların MCP ile yönetimi                                    | 1                     | P6'nın şemasına doğrudan bağımlı, ondan önce başlanamaz.                                                                                      |
| P8  | Calibrate v2 (Serena ve benzerlerinden öğrenme)                     | 5                     | Artık dashboard önerebilir, hızlı bulk kullanabilir, yerel haritayı yazabilir.                                                                |
| P9  | Proje tipi playbook'ları                                            | 3                     | P8'in iskeletine takılan içerik katmanı.                                                                                                      |
| P9.5 | Kalibrasyon saha testi + rehberin ham `.md` adresi + tasarruf kartı | P8/P9'dan ertelendi   | P10 gerçek etiketli veriyle ölçülmeli; P13 calibrate'in yazdığı `sources`'a dayanıyor. Hakan'ın katılımı gerekiyor (giriş + ikinci oturum).    |
| P10 | Bulma temeli: harf katlama, `keywords`, tek turda corpus, FTS5      | 2026-09-23 araştırması | Jev'den önce bulma katmanı. Dış servis/paket yok, ölçülebilir; Türkçe görevlerde `prepare_context` bugün 0 sonuç dönüyor.                     |
| P11 | Anlamsal bulma: embedding + Turso vektör + hibrit sıralama          | 2026-09-23 araştırması | P10'un FTS5'ine ve regresyon setine dayanır. İlk dış servis (embedding) → sağlayıcı kararı Hakan'ın.                                          |
| P12 | Remnus Graph: bilgi haritası (Obsidian kopyası değil)               | 2026-09-23 isteği     | Bağımsız başlayabilir; P10'un harf katlaması bahsedilme katmanını iyileştirir.                                                                |
| P13 | Proje haritası: kod katmanı + graph'ın ajan tarafı                  | 2026-09-23 isteği     | P12'nin graph servisine bağımlı; P8'in calibrate'te yazdığı `knowledge.sources` bu işin yakıtı.                                               |

Katı bağımlılıklar: P6 → P7, P10 → P11, P12 → P13. Gerisi sırayı bozmadan
gitmeli ama zorunluluk değil; bir adımı atlarsan sonraki adımın o adıma yaptığı
atıflar boşa düşer.

---

## Her prompta gömülü ortak kurallar

Promptların her biri şu ortak gövdeyi zaten içeriyor, ayrıca hatırlatmana gerek yok:

- `AI.md` + `AGENTS.md` ilgili bölümünü ve Serena memory'lerini oku.
- `git status` kontrol et, kullanıcının değişikliklerini ezme.
- Doğrulama sırası: `npm run lint -- <paths>` → `npx tsc --noEmit` → dev server /
  görsel kontrol → build yalnızca gerekiyorsa.
- Kullanıcı istemedikçe commit/push yok, paket kurulumu yok.
- Migration gerekiyorsa: hedef veritabanını **açıkça** doğrula. Düz `npx tsx`
  komutu prod Turso'yu hedefleyebilir; `@/db` import eden script'te ilk import
  `dotenv/config` olmalı.
- Kullanıcının fark edeceği her değişiklikte `src/lib/changelog.ts` başına kayıt
  (tek cümle, müşteri dili, 8 locale).

---

## Araştırma sırasında çıkan, promptlara gömülmüş somut bulgular

Bunlar tahmin değil, kodda doğrulandı — promptlar bunlara dayanıyor:

1. **`publish()` bir no-op.** `src/lib/realtime/publish.ts` SSE kaldırıldığı için
   boş fonksiyon; MCP yazma yollarındaki her `publish({scope:'sidebar'})` çağrısı
   hiçbir şey yapmıyor. Canlı güncelleme tamamen `/api/activity/ping`
   heartbeat'ine bağlı.
2. **Sidebar en kötü ihtimalle ~40 sn gecikiyor.** ActivityTracker 30 sn'de bir
   ping atıyor, `useWorkspaceEvents` ise yenilemeyi kullanıcı **10 sn boyunca
   hiç fare/klavye hareketi yapmazsa** uyguluyor. Ajanın çalışmasını izleyen
   insan fareyi oynattığı sürece yenileme hiç gelmiyor.
3. **Silme işlemleri hiç yenileme tetiklemiyor.** `changeVersion`,
   `max(updatedAt)` üzerinden hesaplanıyor; satır silindiğinde maksimum
   düşmediği için sürüm artmıyor. `deleted_items` tombstone tablosu bu hesaba
   dahil değil.
4. **`bulk_create_pages` gerçekten seri.** 50 kayıt için `createPageInWorkspace`
   kayıt başına 3-6 ayrı DB gidiş-dönüşü yapıyor (parent doğrulama, iki insert,
   `syncPageLinks` sil+ekle, sonra `recordGeneratedKnowledge`). Turso gecikmesi
   kayıt başına çarpıldığı için beklemenin kaynağı bu — kod değil ağ.
5. **Satır sıra numarası tam tarama ile bulunuyor.** `createPageInWorkspace`
   içinde her satır için o database'in **tüm** `sortOrder` değerleri çekilip JS
   tarafında max alınıyor; database büyüdükçe her ekleme yavaşlıyor.
6. **Her MCP tool cevabı iki kez serileştiriliyor.** Tüm read/write tool'ları
   `content: [{type:'text', text: JSON.stringify(out)}]` **ve**
   `structuredContent: out` döndürüyor. Aynı JSON iki kez telde. `response_bytes`
   ise yalnız bir kopyayı sayıyor, yani mevcut kullanım metriği ~2× eksik.
7. **Read-scope token'lar da 14 write tool şemasını alıyor.** `handler.ts`
   içinde `registerWriteTools(server, ctx)` koşulsuz çağrılıyor; write tool'ları
   scope'u yalnız çalışma anında kontrol ediyor. Read-only oturumda bu şemalar
   tamamen israf.
8. **Projeye katılma diye bir akış yok.** `npx remnus init` yalnızca kullanıcının
   _sahibi olduğu_ workspace'leri listeliyor (`src/app/[locale]/install/page.tsx`
   owner rolüne göre sorguluyor, `mintAgentToken` → `assertOwnerAccess`). Ekip
   arkadaşı repoyu klonladığında `.remnus/config.json` doğru `workspaceId`'yi
   söylüyor ama o workspace seçim listesinde yok; `init` mevcut bağlantıyı
   "değiştireceğim" diye uyarıp yeni bir workspace açmaya götürüyor. Erişim
   isteği gönderme kavramı da hiç yok — `workspace_invites` yalnız owner'dan
   e-postaya giden ters yön. Detay P2'da.

---

# P1 — Proje penceresi: canlı güncelleme, UI temizliği, doğru çıkış yolu

> İstek 9 + 7 + 6. Tahmini kapsam: orta. Bağımlılığı yok.

```text
Remnus projesinde çalışıyorsun (Next.js 16 App Router, React 19, TS strict,
Drizzle + SQLite/Turso). Önce `AI.md` ve `AGENTS.md` içindeki
"Project Install (`npx remnus init`)" bölümünü, özellikle §4 "Signed-in project
windows (workspace-locked sessions)" kısmını oku. Serena varsa `list_memories`
çağırıp `core` ve `conventions` memory'lerini oku. `git status --short` ile
başla ve kullanıcının mevcut değişikliklerini ezme.

## Bağlam

`npx remnus open` (ve Claude Code'un SessionStart hook'u) projenin workspace'ini
izole bir Chromium profilinde, workspace'e kilitli bir oturumla açıyor. Bu
pencereye "proje penceresi" diyoruz. Ajan MCP üzerinden workspace'i doldururken
insan bu pencereden izliyor. Şu an bu deneyimde üç kusur var ve üçünü de bu
görevde düzelteceksin.

## Görev A — Canlı güncelleme (en önemlisi)

**Semptom:** Ajan calibrate ederken veya normal çalışırken sidebar güncellenmiyor;
insan pencereyi kapatıp açmadan yeni sayfaları görmüyor.

**Doğrulanmış kök nedenler** (bunları tekrar araştırmana gerek yok, ama kodu
okuyup teyit et):

1. `src/lib/realtime/publish.ts` bir no-op. SSE kanalı kaldırılmış, ama MCP
   yazma yollarındaki `publish({ scope: 'sidebar', ... })` çağrıları duruyor ve
   hiçbir şey yapmıyor.
2. Tek canlılık sinyali `/api/activity/ping` cevabındaki `changeVersion`
   (`src/app/api/activity/ping/route.ts`). `ActivityTracker`
   (`src/components/providers/ActivityTracker.tsx`) bunu **30 saniyede bir**
   çekiyor ve sekme gizliyken hiç çekmiyor.
3. `src/hooks/useWorkspaceEvents.ts` yenilemeyi, kullanıcı **10 saniye boyunca
   hiçbir fare/klavye/scroll olayı üretmezse** uyguluyor (`IDLE_TIMEOUT_MS`).
   Ajanın çalışmasını izleyen insan fareyi oynattığı sürece yenileme süresiz
   erteleniyor. Toplam en kötü gecikme 40 sn+.
4. `computeChangeVersion` yalnız `max(updatedAt)` topluyor. Bir öğe
   **silindiğinde** maksimum düşmediği için sürüm artmıyor → silme hiçbir zaman
   yenileme tetiklemiyor. `deleted_items` tombstone tablosu (bkz. AGENTS.md
   "Database Tables") bu hesaba dahil değil.

**Hedef davranış:** Ajan bir yazma yaptıktan sonra proje penceresindeki sidebar
**~2-3 saniye içinde** güncellenmeli. İnsan fareyi oynatıyor olsa bile.

**Kısıtlar — bunları ihlal etme:**

- Eski koşulsuz 10 sn'lik `router.refresh()` poll'u **maliyet yüzünden**
  kaldırılmıştı (her tick'te ~100 KB RSC payload, Vercel Fast Origin Transfer'in
  ana kalemi). Geri getirme. Sık atılan istek, sürüm artmadıkça gövdesi birkaç
  byte olan bir JSON olmalı; `router.refresh()` yalnız sürüm gerçekten
  ilerlediğinde çağrılmalı.
- Boşta duran normal web sekmelerinin maliyeti artmamalı. Hızlı tempo sadece
  "yakınlarda bir şey oluyor" sinyali varken açılmalı.
- SSE'yi geri getirmeyi düşünüyorsan önce `publish.ts` başındaki yorumu oku:
  in-memory EventEmitter Vercel'in çok-instance'lı runtime'ında fan-out
  yapamıyor. Harici bir pub/sub (Upstash vb.) eklemek bu görevin kapsamı
  **dışında** — paket kurma. Adaptif polling ile çöz.

**Önerilen yaklaşım** (daha iyisini bulursan gerekçesiyle sap):

- Değişiklik sinyalini heartbeat'ten ayır. `/api/activity/ping` oturum/engagement
  işini yapmaya devam etsin; değişiklik sorgusu için gövdesi minimal ayrı bir uç
  nokta düşün (veya mevcut uç noktayı "sadece sürüm" modunda çağırabilecek hale
  getir) — session yazma işini her 2 saniyede bir tekrarlama.
- **Adaptif tempo:** temel tempo 30 sn. Şu durumlarda 2-3 sn'ye düş:
  (a) pencere bir proje penceresi ise (`lockClaimsOf(session.user).workspaceLock`),
  (b) son N dakika içinde bu workspace'te ajan aktivitesi görüldüyse
  (`agent_activity` tablosunda `max(created_at)` ucuz bir sinyal),
  (c) son sürüm artışının üzerinden 60 sn'den az geçtiyse.
  Sessizlikte üstel olarak temel tempoya geri çık.
- **Idle kapısını ayrıştır.** Yenilemeyi ertelemenin gerçek gerekçesi, kullanıcı
  bir şey yazarken/sürüklerken imlecin ve odağın sıfırlanmaması. `mousemove` bu
  gerekçeyi karşılamıyor. Ertelemeyi yalnız gerçek düzenleme durumlarında uygula:
  açık modal/picker/rename/drag (`isAnyModalOrPickerOpen` zaten var), editörde
  aktif yazma, veya son ~1.5 sn içinde tuş basımı. Yapısal sidebar değişiklikleri
  (öğe eklendi/silindi/taşındı) bu kapıdan muaf olabilir — yeni bir sayfanın
  ağaçta belirmesi kullanıcının işini bölmez.
- **Silmeleri sürüme dahil et.** `computeChangeVersion` içine `deleted_items`
  için de bir `max(deleted_at)` agregası ekle (workspace'e göre filtreli). Var
  olan `epochMax` yardımcısını ve TEXT/INTEGER tip karışıklığı korumasını aynen
  kullan — bu tuzağın açıklaması aynı dosyanın başında yazılı.
- Sekme gizliyken ping'in tamamen durması davranışını koru, ama görünürlük geri
  geldiğinde anında bir sorgu at (bu zaten var) ve o ilk sorgudan sonra idle
  kapısına takılmadan yenile.

**Ölü kod:** `publish()` çağrıları ya gerçek bir işleve kavuşmalı ya da bu görevde
temizlenmeli. Karar senin, ama yarım bırakma: no-op'a giden 15 çağrı kalırsa bir
sonraki okuyucu canlı bir mekanizma sanacak.

## Görev B — Proje penceresinde gereksiz sidebar butonları

`src/components/features/WorkspaceSidebar.tsx` (~1731 satır) alt kısmında şu
butonlar var: **AI Agents**, **Trash**, **Plan / Billing**, **PWA Install**,
**What's New**, **Settings**, ve en altta avatar + admin linki + çıkış.

Proje penceresi workspace'e kilitli bir oturum. Hesap düzeyindeki her şey zaten
sunucuda reddediliyor (`getCurrentUser()` kilitli oturumda hata fırlatıyor), ama
kullanıcı çalışmayan butonlar görüyor. AI Agents özellikle yanıltıcı: proje
token'ıyla açılan pencerede anlamlı bir şey göstermiyor.

Yapılacak:

- `src/app/[locale]/(app)/layout.tsx` içinde `lockClaimsOf(session.user).workspaceLock`
  zaten hesaplanıyor (proje penceresi banner'ı için). Bundan türeyen bir
  `isProjectWindow: boolean` prop'unu `WorkspaceSidebar` ve `MobileNavWrapper`'a
  geçir. Client tarafında tahmin yürütme (user-agent, pencere boyutu vb.) — tek
  doğruluk kaynağı sunucudaki lock claim'i.
- Proje penceresinde **gizlenecekler:** AI Agents, Plan/Billing, PWA Install,
  Settings (hesap ayarları), admin linki, workspace oluştur/değiştir kontrolleri
  ve "gizli workspace'leri göster" toggle'ı. Kısaca: workspace içeriği olmayan
  her şey.
- **Kalacaklar:** workspace ağacı, Trash (silinen içerik bu workspace'e ait ve
  lock buna izin veriyor — `actions/trash.ts` opt-in listesinde), What's New.
- Avatar/kullanıcı paneli: çıkış butonu bu pencerede kullanıcıyı login ekranına
  atıyor ve izole profilde tekrar giriş yapmak anlamsız. Görev C'deki karara
  uydur.
- Butonları CSS ile gizleme; JSX'te koşullu render et ki ilgili modal'ların
  state'i ve `getUserAgentTokenCount` / `getMyTier` gibi ek sunucu çağrıları da
  proje penceresinde hiç çalışmasın (bu aynı zamanda P4'ün hedeflediği gereksiz
  isteklerden biri).

## Görev C — "Bu bir proje penceresidir" bildirimi

`src/app/[locale]/(app)/layout.tsx` içindeki `projectWindowBanner` şu an
`signOut({ redirectTo: '/login' })` yapan bir buton gösteriyor. Bu yanlış: izole
Chromium profilinde login olmak kullanıcıyı hiçbir yere götürmüyor, sadece proje
oturumunu kapatıyor.

İstenen: kullanıcıyı **kendi tarayıcısında** tam uygulamaya / indirme sayfasına
yönlendiren bir yol. `/download` route'u zaten var ve public.

Dikkat edilecek teknik gerçek: sayfa izole bir `--user-data-dir` profilinde açılan
Chromium `--app` penceresinde çalışıyor. Web'den işletim sisteminin varsayılan
tarayıcısını açmanın güvenilir bir API'si **yok**; `target="_blank"` aynı izole
profilde yeni bir pencere açar. Bu yüzden:

- Banner metnini yeniden yaz: burasının tek bir projeye kilitli bir pencere
  olduğunu ve hesabın tamamına nereden ulaşılacağını söylesin.
- Birincil eylem: `/download` sayfasına giden bir bağlantı (yeni pencerede).
  İkincil, sessiz bir seçenek olarak adresi panoya kopyalayan bir kontrol koy —
  kullanıcı kendi tarayıcısına yapıştırabilsin.
- Çıkışı (signOut) birincil eylem olmaktan çıkar. Tutacaksan ikincil ve açıkça
  "bu pencereyi kapat" anlamında etiketle.
- CLI tarafına da bak (`cli/src/commands/open.js`, `cli/src/lib/window.js`):
  pencere açılırken terminale tam URL'yi yazdırmak, kullanıcının kendi
  tarayıcısına geçmesinin en dürüst yolu. Küçük bir ekleme ise yap.

i18n: `Layout.projectWindowNotice` ve `Layout.projectWindowSignIn` anahtarlarını
güncelle/yenile. **8 locale zorunlu** (`en, tr, hi, es, fr, de, zh, ru`);
`messages/en.json` source of truth. Eksik locale `tsc`'yi patlatır.

## Doğrulama

1. `npm run lint -- <dokunduğun dosyalar>` ve `npx tsc --noEmit`.
2. `npm run dev` ile normal web oturumunda: sidebar'ın eskisi gibi çalıştığını,
   boşta duran sekmenin ağ trafiğinin artmadığını (DevTools → Network) gör.
3. Canlı güncellemeyi gerçekten test et: bir pencerede uygulamayı açık tut,
   başka bir yoldan (ikinci sekme, MCP tool çağrısı veya doğrudan bir server
   action) yeni sayfa oluştur/sil ve sidebar'ın 2-3 sn içinde güncellendiğini
   fare hareket ederken doğrula. Sadece koda bakıp "çalışıyor" deme.
4. Proje penceresini gerçekten aç (`npx remnus open`) ve B + C'yi gözle doğrula.
   Açamıyorsan bunu raporunda açıkça söyle, "test edildi" deme.

## Bitirirken

- Kullanıcının fark edeceği değişiklikler bunlar: canlı güncelleme, sadeleşen
  proje penceresi. `src/lib/changelog.ts` **başına** kayıt ekle — tek cümle,
  müşteri dili, 8 locale, id biçimi `YYYY-MM-DD-kebab-konu`, kategori `improved`.
- Kalıcı davranış değişti: `AGENTS.md` → Project Install §4 altındaki
  invariant listesine proje penceresi UI kuralını ve yeni canlılık mekanizmasını
  yaz. Serena `core`/`conventions` memory'lerini senkronla.
- `scripts/ai/update-handoff.ps1` çalıştır.
- Commit/push yapma.
```

## ✅ Tamamlandı — 2026-09-21

Dört kök neden de kodda doğrulandıktan sonra üç görev de yapıldı. Gerçekte yapılanlar:

**A — Canlı güncelleme.** Değişiklik sinyali `/api/activity/ping` içinden
`src/lib/services/changeVersion.ts`'e taşındı ve `deleted_items` için bir
`max(deleted_at)` agregası eklendi — silmelerin sürümü düşürmesi sorunu böyle kapandı
(tombstone'lar yalnızca insert edildiği için sayı monotonik kalıyor). Altı agrega tek bir
`unionAll` deyimi olarak gidiyor: 2.5 sn'lik tempoda maliyet agregalar değil Turso
round-trip'leri. Yeni `GET /api/activity/changes` uç noktası salt-okunur ve gövdesi
`{"v":…}` (≈20 bayt); `ping` session satırı yazdığı için hızlı tempoda çağrılmıyor.
`ActivityTracker` adaptif: proje penceresinde görünür olduğu sürece düz 2.5 sn, normal
sekmede yalnızca bir değişiklik görüldükten sonra ~90 sn (1.6× backoff) ve sonra tamamen
duruyor — **boştaki normal sekme hala 30 sn'de tek istek**. Idle kapısı
`src/lib/interactionGate.ts` olarak ayrıştırıldı ve `useWorkspaceEvents` + `TabHost`
tarafından paylaşılıyor; artık `mousemove`'a değil yalnızca basılı pointer'a, son 1.5
sn'deki tuş basımına ve son 15 sn içinde yazılmış odaklı bir edit alanına takılıyor.

**Sapma (gerekçeli):** proje penceresi sessizlikte temel tempoya geri çekilmiyor.
Pencerenin tek varlık sebebi bir ajanı izlemek; geri çekilmek tam da kaldırılmak istenen
gecikmeyi geri getirirdi. Maliyet kısıtı ihlal edilmiyor: ≈1 KB/dk (kaldırılan poll 600
KB/dk idi) ve pencere gizlenince tamamen duruyor. `agent_activity` sinyali kullanılmadı —
`max(created_at)` yalnızca `workspace_id` indeksine dayandığı için yoğun bir workspace'te
her poll'de pahalıya patlardı; aynı işi sürüm artışının kendisi bedavaya görüyor.

**Ölü kod:** `src/lib/realtime/publish.ts` ve 45 çağrı yeri tamamen silindi (yarım
bırakılmadı); bu sırada ortaya çıkan boş döngüler ve sahipsiz kalan 33 binding de
temizlendi.

**B — Proje penceresi UI.** Layout tek bir `isProjectWindow` boolean'ını lock claim'inden
türetip `WorkspaceSidebar` / `MobileNavWrapper` / `ActivityTracker`'a geçiriyor. Gizlenenler
(CSS ile değil, JSX'te): AI Agents, Plan/Billing, Settings, PWA Install, admin linki,
sidebar çıkış butonu, workspace oluştur/gizle/ayarlar, gizli-workspace toggle'ı ve
workspace ikon picker'ı. Kalanlar: ağaç, Trash, What's New. `getUserAgentTokenCount` ve
`getMyTier` artık proje penceresinde hiç çağrılmıyor — ikisi de `getCurrentUser()`
kullandığı için orada yalnızca hata dönebiliyorlardı.

**C — Bildirim.** `ProjectWindowBanner.tsx` (yeni client bileşen): yeniden yazılmış metin +
birincil `/download` bağlantısı + `origin/app` adresini panoya kopyalayan ikincil kontrol;
signOut "Bu oturumu kapat" olarak gerilere alındı. `Layout.projectWindowSignIn` kaldırıldı,
yerine `projectWindowGetApp` / `projectWindowCopyLink` / `projectWindowCopied` /
`projectWindowEndSession` geldi ve `projectWindowNotice` yeniden yazıldı — 8 locale. CLI
zaten URL'yi basıyordu; `open.js`'e kendi tarayıcısına geçmesini söyleyen tek satırlık bir
not eklendi.

### Doğrulama — ne yapıldı, ne yapılmadı

Yapılanlar: `npx tsc --noEmit` temiz; dokunulan tüm dosyalarda `npm run lint` 0 hata / 0
**yeni** uyarı (WorkspaceSidebar'daki 6 uyarı HEAD'de de vardı). `computeChangeVersion`
gerçek veriyle çalıştırıldı (local.db'nin scratch kopyası, prod'a dokunulmadan): `unionAll`
çalışıyor, bir tombstone sürümü **yükseltiyor**, başka bir workspace'e sızmıyor ve
temizlikten sonra taban değere dönüyor. Dev server'da `GET /api/activity/changes`
oturumsuz çağrıda 401 + 7 baytlık `{"v":0}` döndürüyor (minimal gövde tasarımı telde
doğrulandı).

**Yapılmayan:** tarayıcıda uçtan uca canlı test (roadmap'in 3. ve 4. adımları) — dev server
`.env` üzerinden PRODUCTION Turso'ya bağlanıyor, test sayfası oluşturmak/silmek prod'a
yazardı. Kullanıcı bu doğrulamayı kendisi yapmayı seçti. Yani "2-3 sn içinde güncelleniyor"
ve "proje penceresi sade görünüyor" henüz **gözle doğrulanmadı**. Not: `.next` içindeki
üretilmiş `routes.d.ts` bozuktu (`type PageRoutes = never`) ve tüm route'lar 404 veriyordu;
dev server yeniden başlatılınca düzeldi.

Ayrıca: `src/lib/changelog.ts` başına `2026-09-21-live-project-window` kaydı (8 locale,
`improved`), `AGENTS.md`'ye "Live refresh (the change signal)" bölümü + Project Install §4
invariant'ları, Serena `core`/`conventions` senkronu ve `update-handoff.ps1` çalıştırıldı.
Commit/push yapılmadı.

---

# P2 — Projeye katılma akışı (ekip arkadaşı var olan workspace'e bağlanır)

> Orijinal 10 maddelik listede yoktu; araştırma sırasında çıkan bir engel olarak
> eklendi. Diğer promptlardan bağımsız, sırf ekip kullanımını açtığı için erkene
> alındı.

**Ürün kararı verildi** (bu prompt onu uyguluyor): Bir kişi, başkasının bağladığı
bir projeye bağlanmak istediğinde sistem önce **o workspace'e erişimi ve yazma
yetkisi var mı** diye bakar. Varsa kendi token'ı otomatik üretilir ve kendi
`.remnus/credentials.json`'ı yazılır (zaten git-ignored). Yoksa workspace
sahibine **erişim isteği** gönderebilir. Ayrıca, kurulum prompt'unun yanına
"bu projede zaten Remnus var, beni bağla" diyen ikinci bir prompt gelir.

```text
Remnus'ta "projeye katılma" akışını kuracaksın. Önce `AI.md`, `AGENTS.md` →
"Project Install" (§2 Install channel, §4 project windows) ve şu dosyaları oku:
`src/app/[locale]/install/page.tsx`, `src/app/[locale]/install/InstallForm.tsx`,
`src/lib/services/installSession.ts`, `src/lib/actions/agentToken.ts`,
`src/lib/actions/invites.ts`, `src/lib/billing/plans.ts` + `src/lib/services/billing.ts`,
`cli/src/commands/init.js`, `cli/src/commands/doctor.js`, `cli/src/commands/mcp.js`,
`cli/src/lib/project.js`, `cli/src/lib/files.js`. Serena varsa `core` +
`conventions` memory'lerini oku. `git status --short` ile başla.

## Problem

Bir proje bir Remnus workspace'ine bağlandıktan sonra `.remnus/config.json`
**commit ediliyor** ve içinde `workspaceId`, `workspaceName`, `mcpUrl`, `serverUrl`
var. `.remnus/credentials.json` ise kişiye özel ve git-ignored — doğru tasarım.

Ekipten ikinci bir geliştirici repoyu klonladığında:

- Elinde doğru workspace id'si var ama bağlanacak bir yolu yok.
- `npx remnus init` çalıştırırsa: mevcut config'i görüp *"This project is already
  connected to X. Continuing will replace that connection"* diye uyarıyor, sonra
  onu yalnızca **sahibi olduğu** workspace'leri listeleyen kurulum ekranına
  götürüyor (`install/page.tsx` üyelik sorgusunu `role = 'owner'` ile yapıyor;
  `mintAgentToken` de `assertOwnerAccess` çağırıyor). Yani doğru workspace listede
  hiç yok, kullanıcı yeni bir workspace açmaya itiliyor ve ekip ortak bellekte
  buluşamıyor.
- MCP köprüsü (`cli/src/commands/mcp.js`) credentials olmadığında
  *"Run `npx remnus init` to reconnect"* diyor — yanlış tavsiye, çünkü init onu
  bağlantıyı değiştirmeye götürüyor.

## Kurulacak akış

### 1. CLI: katılma modu

- **`npx remnus join`** komutu ekle (mevcut `init`/`doctor`/`open`/`mcp` deseniyle
  aynı yapıda, `cli/src/cli.js`'e kaydı dahil).
- Ayrıca **`init`, var olan bir `.remnus/config.json` gördüğünde varsayılan olarak
  katılma moduna geçsin.** Bugünkü "bağlantıyı değiştireceğim" davranışı açık bir
  bayrağın arkasına alınsın (ör. `--reconnect` / `--new`). Bir ekip arkadaşının
  yanlışlıkla projenin workspace bağlantısını değiştirip commit'lemesi, bu işin
  en pahalı hatası — varsayılan güvenli taraf olmalı.
- Katılma modunda CLI **yalnızca** `.remnus/credentials.json` yazar. Committed
  dosyalara dokunmaz: `config.json` içeriğini (özellikle `calibrated: true`
  bayrağını) sıfırlamaz, `.mcp.json` / `AGENTS.md` / `.claude/settings.json`
  bloklarını gereksiz yere yeniden yazmaz. Eksik olan bir şey varsa (ör. repoda
  `.mcp.json` yok) onu tamamlamak meşru; var olanı ezmek değil. `.gitignore`
  marker bloğu yoksa eklensin — credentials asla commit'lenmemeli.
- Katılma, mevcut install kanalını kullansın: `deviceId` üret, tarayıcıyı aç,
  `/api/install/poll` ile bekle (`cli/src/lib/install.js`). Yeni bir kimlik
  doğrulama yolu icat etme. URL'ye hedef workspace'i taşıyan bir parametre ekle
  (ör. `workspace=<id>`), `project` ve `mode` parametrelerinin yanına.
- **Hata mesajlarını düzelt:** `mcp.js` credentials bulamadığında ve `doctor`
  "config var, credentials yok" durumunu gördüğünde `remnus join` önersin,
  `remnus init` değil. `doctor`'a "bu projeye bağlı değilsin / erişim isteğin
  beklemede" durumlarını ekle.
- CLI paketi **sıfır bağımlılıklı ESM** kalmalı. Paket ekleme.

### 2. Sunucu: erişim kontrolü ve token üretimi

Kurulum ekranı (`install/page.tsx`) bir `workspace` parametresiyle geldiğinde
"katılma" görünümüne geçsin. Sunucu tarafında sırayla:

1. **Üyelik var mı?** `workspace_members` içinde bu kullanıcı için satır var mı?
2. **Rol ne?** `owner` ve `member` → write scope alabilir. `viewer` → yalnız read
   scope; write isteği reddedilmeli. Rolün verdiğinden fazlasını veren bir token
   üretilmemeli, bu bir yetki yükseltmesi olur.
3. **Üyeyse token üret.** `mintAgentToken` bugün `assertOwnerAccess` çağırıyor;
   bunu, üyelik rolünü de kabul eden bir yola genişlet. **Dikkat:** bu fonksiyon
   agent limiti (`checkCanAddAgent`) ve PostHog funnel olayı da içeriyor — o
   mantığı koru, sadece erişim kapısını değiştir. Owner-only kalması gereken
   başka çağrı yerleri var mı diye `mintAgentToken` kullanımlarını tara; UI'daki
   "token üret" akışının owner-only kalması gerekiyor olabilir. Gerekiyorsa
   ayrı bir servis fonksiyonu yaz, mevcut fonksiyonun sözleşmesini gizlice
   değiştirme.
4. **Agent limiti kimin cebinden?** Limitler workspace'in `billing_owner_id`
   kullanıcısının planından geliyor (`getPlanForWorkspace`, `countAgents`). Yani
   katılan kişinin token'ı **sahibin** agent kotasından yiyor. Limit dolduğunda
   katılan kişiye anlaşılır bir mesaj göster ("bu workspace'in ajan kotası dolu,
   sahibine haber ver"), ham bir hata değil.
   **Ayrıca çözülmesi gereken çoğalma problemi:** `countAgents` iptal edilmemiş
   her PAT'ı sayıyor, ve her `join` yeni bir PAT üretiyor. Aynı kişi projeyi
   ikinci makinesinde açtığında, ya da aynı workspace'e bağlı ikinci bir projeye
   katıldığında kota bir daha yeniyor — Free planda 2 agent var, bu çok çabuk
   doluyor. En az şunu yap: aynı kullanıcı + aynı workspace + aynı proje için
   var olan bir token varsa yenisini üretmeden önce eskisini iptal et (token
   adı zaten `Remnus CLI · <proje>` biçiminde, eşleştirme için kullanılabilir) —
   ve bu davranışı kullanıcıya söyle, sessizce oturumunu düşürme. Daha iyi bir
   model öneriyorsan (ör. kotanın token değil kişi başına sayılması) gerekçesini
   yaz; bu faturalandırmayı etkileyen bir karar, tek başına verme, raporla.
5. **Üye değilse:** token üretme. Bunun yerine erişim isteği yolunu sun (§3).

**Güvenlik notları:**

- `workspaceId` commit edilen bir dosyada duruyor — yani **sır değil** ve asla
  yetki kanıtı sayılamaz. Her istekte üyelik yeniden sorgulanmalı; formdan gelen
  workspace id'si client girdisidir (mevcut kodda bu re-verify deseni zaten var,
  aynısını uygula).
- Üye olmayan birine workspace hakkında **hiçbir metadata sızdırma**: isim, üye
  listesi, içerik, hatta "böyle bir workspace var mı" bilgisi. Ekranda gösterilen
  proje/workspace adı CLI'ın taşıdığı, kullanıcının kendi diskindeki değerden
  gelsin — sunucudan değil.
- Mevcut install kanalı kuralları aynen geçerli: sonuç tek seferlik okunur,
  5 dakika TTL, `/api/install/poll` `no-store` (AGENTS.md → Project Install §2).

### 3. Erişim isteği (yeni)

Bugün yalnız ters yön var: owner bir e-postaya davet gönderiyor
(`workspace_invites`, `src/lib/actions/invites.ts`). Kullanıcıdan sahibe giden
istek kavramı yok; onu ekleyeceksin.

- **Veri modeli:** yeni bir tablo (ör. `workspace_access_requests`): workspace,
  isteyen kullanıcı, istenen scope/rol, durum (`pending`/`approved`/`denied`),
  oluşturma ve sonuçlanma zamanları, opsiyonel kısa not. Aynı kişi + aynı
  workspace için birden çok açık istek olmasın (unique index). Migration için
  `AGENTS.md` → "Migration Notes"a uy, `npx drizzle-kit generate` kullan,
  `createdAt`/`updatedAt` değerlerini açıkça `new Date()` ile yaz (SQLite
  `DEFAULT CURRENT_TIMESTAMP` tuzağı). **`.env` içindeki Turso production
  olabilir** — apply script'ini çalıştırmadan önce hedefi açıkça doğrula ve
  raporunda hangi veritabanına uyguladığını yaz.
- **Sahibe bildirim:** mailing altyapısı hazır (`src/lib/email/`, `email_log`).
  `email_log.kind` düz TEXT kolonu — yeni bir tür eklemek için migration
  gerekmiyor (AGENTS.md bunu açıkça söylüyor). Mevcut şablon düzenine uy.
  Bildirim best-effort olsun: e-posta gönderilemedi diye istek kaydı kaybolmasın.
- **Onay arayüzü:** workspace ayarlarındaki üyeler sekmesi (`MembersTab`,
  bekleyen davetleri zaten listeliyor) doğal ev. Bekleyen istekler orada
  görünsün, tek tıkla onay/ret olsun. Sidebar'da küçük bir bildirim işareti
  değerlendirilebilir ama şart değil.
- **Onay = üyelik + koltuk.** Onaylamak kişiyi `workspace_members`'a ekler, yani
  **koltuk tüketir**. `countSeats` bekleyen davetleri de sayıyor; onay anında
  `checkSeatLimit` uygula ve limit doluysa sahibe bunu net söyle. Onay sonrası
  isteyen kişi `npx remnus join` komutunu tekrar çalıştırınca bağlanabilmeli;
  CLI bekleme durumunu anlaşılır biçimde raporlasın ("isteğin gönderildi,
  onaylandığında tekrar çalıştır").
- **Ret/spam:** reddedilen bir isteğin hemen yeniden gönderilebilmesi kötüye
  kullanıma açık; basit bir oran sınırı veya "reddedildi, tekrar isteyemezsin"
  durumu düşün. Aşırı mühendislik yapma, ama açık kapı da bırakma.

### 4. İkinci prompt: "bu projede Remnus var, beni bağla"

Bugün tek bir giriş prompt'u var (`docs/mcp/project-install.md` → "Hand it to
your agent"). İkincisini ekle: repoyu klonlayan kişinin ajanına verdiği,
kurulum değil **katılma** yapan prompt.

- Yeni sayfa: `docs/mcp/project-join.md`. Calibrate sayfasının desenine uy —
  canlı sunulan, projeye kopyalanmayan bir rehber. `src/lib/content/manifest.ts`'e
  ekle (`hidden` olup olmayacağına karar ver: bu sayfa hem insanın okuyacağı hem
  ajanın çekeceği bir metin, muhtemelen görünür olmalı).
- Prompt metni kısa ve tek satır olsun, kurulum prompt'uyla aynı biçimde. Örnek:
  *"Bu projede Remnus kurulu; <URL> yönergelerini izleyerek beni bu projenin
  workspace'ine bağla."*
- Rehber şunları anlatsın: `npx remnus join` çalıştır; tarayıcıda giriş yap;
  erişimin yoksa istek gönder ve sahibin onayını bekle; bağlandıktan sonra MCP
  sunucularını yeniden yükle (`/mcp`); **calibrate'i tekrar çalıştırma** —
  workspace zaten kurulu (`config.json` `calibrated: true` ise bunu açıkça söyle).
- `cli/templates/agents-section.md` bloğuna bir cümle ekle: bu projede Remnus
  tool'ları görünmüyorsa ve `.remnus/credentials.json` yoksa yapılacak şey
  `npx remnus join`. Blok **kısa** kalmalı — o metin her oturumda token harcıyor.
- `docs/mcp/project-install.md` içine "Birisi bu projeyi zaten bağladıysa" diye
  kısa bir bölüm ve yeni sayfaya bağlantı ekle.

## Kapsam dışı (ayrıca not düş, yapma)

- Eşzamanlı yazma çakışması (iki kişinin ajanı aynı sayfayı güncelliyor):
  `update_page` merge ediyor, sürüm/ETag kontrolü yok. Bunu bu görevde çözme,
  ama raporunda bir risk olarak yaz.
- "Hangi ekip arkadaşının ajanı" ayrımının arayüzde yeterince görünür olup
  olmadığı (`AgentEditBadge`, `agent_activity`): gözlemini yaz, değiştirme.

## Doğrulama

1. `npm run lint -- <paths>`, `npx tsc --noEmit`.
2. Migration'ı **yerel** DB'ye uygula ve şemayı doğrula.
3. **İki gerçek hesapla uçtan uca senaryo** (bu görevin asıl testi, atlamak yok):
   - A kullanıcısı bir projeyi bağlar, `.remnus/config.json` commit edilir.
   - B kullanıcısı aynı dizini/kopyayı alır, credentials'ı siler, `npx remnus join`
     çalıştırır. B üye değilken: erişim isteği gitmeli, CLI bunu anlaşılır
     şekilde söylemeli, A'nın ekranında istek görünmeli.
   - A onaylar → B tekrar `join` çalıştırır → kendi `credentials.json`'ı oluşur,
     `.gitignore`'da olduğu doğrulanır, MCP bağlantısı çalışır.
   - B `viewer` rolündeyken write scope isteyemediğini doğrula.
   - B committed dosyaların değişmediğini `git status` ile doğrula — bu akışın en
     kolay kırılan yeri.
4. Agent kotası dolu bir workspace'te katılma denemesinin anlaşılır hata verdiğini
   doğrula.

## Bitirirken

- Kullanıcıya görünen bir yetenek geldi → `src/lib/changelog.ts` **başına** kayıt,
  kategori `new`, tek cümle, müşteri dili, 8 locale.
- `AGENTS.md` → Project Install §2'deki *"Only workspaces the user owns are
  offered"* cümlesi artık yanlış: orayı, yeni erişim kurallarını ve katılma
  akışının invariant'larını yaz. `docs/mcp/project-install.md` içindeki dosya
  tablosunu ve anlatımı da birlikte güncelle — ikisi çelişirse kimse hangisine
  güveneceğini bilemez.
- Serena `core`/`conventions` memory'lerini senkronla.
- `scripts/ai/update-handoff.ps1`. Commit/push yok.
```

## Tamamlandı — 2026-09-22

Bölüm baştan sona uygulandı. Commit/push yapılmadı; P1'in commit edilmemiş
değişiklikleri korundu.

**CLI (`cli/`, sıfır bağımlılık, ESM):** `join` komutu eklendi
(`src/commands/join.js`, `cli.js`'e kayıtlı). `init`, var olan bir
`.remnus/config.json` görünce varsayılan olarak `join`'e devrediyor; bağlantıyı
değiştirmek artık `--reconnect` (veya `--new`) istiyor. `join` **tek dosya**
yazıyor: `.remnus/credentials.json`. `config.json`'a (özellikle `calibrated`),
`AGENTS.md` bloğuna ve `.claude/settings.json`'a dokunmuyor; yalnızca **eksik**
olan `.mcp.json` `remnus` girdisini ve `.gitignore` bloğunu tamamlıyor, var olanı
asla ezmiyor. `installUrl` artık `workspace=<id>` taşıyor. `mcp.js` ve `doctor`
artık `init` değil `join` öneriyor; `waitForInstall` zaman aşımı mesajı çağıran
komutu adıyla söylüyor.

**Sunucu:** `/install` sayfası `workspace` parametresiyle katılma görünümüne
geçiyor (`joinView` + yeni `JoinForm.tsx`). Üyelik her render'da ve her action
içinde DB'den yeniden okunuyor. `mintAgentToken` owner-only kaldı; katılma için
ayrı `mintProjectAgentToken` yazıldı — ortak `issueAgentToken` (satır + PostHog
funnel + ilk-ajan e-postası) korunarak. `viewer` yazma isteyemiyor (sessizce
düşürülmüyor, reddediliyor). Her join, aynı kişinin aynı projedeki önceki
token'ını **limit kontrolünden önce** iptal ediyor ve bunu kullanıcıya söylüyor.
Kota dolduğunda ham hata yerine "sahibine haber ver" mesajı dönüyor.
`/api/install/poll` artık `status` (`connected`/`requested`/`denied`) taşıyor, bu
sayede CLI 5 dakika beklemek yerine cevabı öğreniyor.

**Erişim isteği:** Migration **0048** + `workspace_access_requests` tablosu
(`src/db/apply-0048-access-requests.ts`). UNIQUE (workspace_id, user_id) — kişi
başına tek açık istek, ve satır yeniden kullanıldığı için `denied` kaydı 7 günlük
bekleme süresini uygulanabilir kılıyor. Servis `src/lib/services/accessRequests.ts`,
action'lar `src/lib/actions/accessRequests.ts`. Onay = `checkCanAddSeat` + üyelik
(her zaman `member`); koltuk reddi isteği **pending** bırakıyor. Sahibe e-posta:
yeni `email_log.kind` `access_request` (düz TEXT kolon, migration yok),
best-effort, satır commit edildikten sonra. Onay arayüzü `MembersTab`'da.
**Üye olmayan hiçbir metaveri görmüyor** — var olmayan bir id de aynı `pending`
cevabını alıyor ve hiçbir şey saklanmıyor.

**Dokümantasyon:** `docs/mcp/project-join.md` (manifest'e görünür olarak eklendi,
`/wiki/project-join` 200 dönüyor), `project-install.md`'ye iki bölüm + link,
`cli/README.md`, `cli/templates/agents-section.md`'ye tek cümle. `AGENTS.md`'de
"Only workspaces the user owns are offered" cümlesi düzeltildi ve yeni **§5
Joining a connected project** bölümü ile 0048 migration notu yazıldı. 8 locale'e
25 yeni key. `changelog.ts` başına `2026-09-22-join-a-project` (`new`, tek cümle,
8 locale). Serena `core` + `conventions` senkronlandı.

**Doğrulama:** `npx tsc --noEmit` temiz; değişen dosyalarda `eslint` temiz (tek
uyarı MembersTab'daki mevcut `<img>`). Migration **yalnızca yerel `local.db`'ye**
uygulandı ve `PRAGMA` ile doğrulandı — **Turso'ya uygulanmadı** (deploy'dan önce
gerekli). Yeni `npm run test:access` (28 assertion, gerçek DB, kendi kaydını
temizliyor) ve CLI için 43 assertion'lık bir koşum: "join sonrası `git status`
temiz" dahil hepsi geçti.

**Yapılmayanlar / riskler:**
- **İki gerçek hesapla tarayıcı testi yapılamadı.** Bu uygulamada giriş yalnızca
  Google/GitHub OAuth ile — şifreli credentials provider'ı yok — yani senaryo
  gerçek hesap kimlik bilgileri olmadan script'lenemiyor. Sunucu-action bacağı
  (form POST → mint/approve) manuel doğrulama bekliyor.
- **Kota token başına sayılıyor, kişi başına değil.** Aynı kişinin ikinci
  makinesi hâlâ ikinci bir ajan yeri yiyor; join yalnızca *aynı proje + aynı
  kişi* için eskisini iptal ederek çoğalmayı sınırlıyor. Kişi-başına sayım
  faturalandırma kararı olduğu için uygulanmadı, sadece raporlanıyor.
- **Eşzamanlı yazma çakışması çözülmedi** (kapsam dışı): `update_page` merge
  ediyor, sürüm/ETag yok, iki ajan aynı sayfayı yazarsa sonraki kazanıyor.
- **Ajan ayrımı gözlemi:** `AgentEditBadge` token adını gösteriyor ve join
  token'ları `Remnus CLI · <proje>` biçiminde, yani aynı projeye katılan iki kişi
  arayüzde **aynı etikete** sahip oluyor — kimin ajanı olduğu ayırt edilemiyor.
  Değiştirilmedi.
- `cli/package.json` sürümü **0.1.8'de bırakıldı**: `.mcp.json` kendini
  `remnus@<sürüm>` ile pinliyor, yayınlanmamış bir sürüme bump etmek kurulumları
  kırardı. Yayın sırasında bump edilmeli.
- Not: `Errors.notFound` hiçbir locale'de yok ama `agentToken.ts` onu birkaç
  yerde çağırıyor — bu görevden önce de vardı, dokunulmadı.

# P3 — Yazma yolu hızlandırma: bulk çağrılar tek round-trip'e insin

> İstek 4. Tahmini kapsam: orta-büyük, tamamen backend. Bağımlılığı yok.

```text
Remnus projesinde çalışıyorsun. Önce `AI.md`'yi ve `AGENTS.md` içindeki
"Database Tables" + "Critical conventions" bölümlerini oku. Serena varsa
`core` ve `conventions` memory'lerini oku. `git status --short` ile başla.

## Problem

Bir ajan projeyi Remnus'a kalibre ederken 50-150 sayfa/satır yaratıyor ve bu
dakikalar sürüyor. İnsan "takıldı mı?" diye düşünüyor. Hedef: **50 kayıtlık bir
`bulk_create_pages` çağrısı tek haneli saniyede bitsin.**

## Doğrulanmış kök neden

Darboğaz CPU değil, **ağ gidiş-dönüşü**. Turso uzak bir veritabanı ve her ifade
ayrı bir round-trip.

- `src/app/api/mcp/tools/write.ts` → `bulk_create_pages` (satır ~283-383) girdileri
  **kasıtlı olarak seri** işliyor ve her biri için `createPageInWorkspace` çağırıyor.
- `src/lib/services/workspace.ts` → `createPageInWorkspace` (satır ~1090) kayıt
  başına şunları yapıyor: parent/database doğrulama sorgusu, (satırsa) o
  database'in **tüm** `sortOrder` değerlerini çekip JS'te max alma, property
  çözümleme sorgusu, 1-2 insert, içerik varsa `syncPageLinks` (sil + ekle), ve
  parent paylaşımlıysa ek bir sorgu.
- Ardından `bulk_create_pages` her kayıt için ayrıca `recordGeneratedKnowledge`
  çağırıyor.

Kayıt başına ~4-6 round-trip × 50 kayıt = 200-300 sıralı ağ turu.

## Yapılacak iş

### 1. Önce ölç, sonra değiştir

Scratchpad'e küçük bir ölçüm script'i yaz (repo'ya commit etme): 50 sayfa + 50
database satırı yaratan bir `bulk_create_pages` senaryosunun süresini ve attığı
ifade sayısını raporlasın. **Yerel `local.db` kullan.** `@/db` import eden bir
tsx script'inde ilk import satırı `dotenv/config` olmalı, aksi halde sessizce
yanlış hedefe düşer; ve `.env` içindeki Turso bağlantısı **production** olabilir —
bu script'i asla prod'a yönlendirme. Hedefi çalıştırmadan önce açıkça doğrula ve
raporunda hangi veritabanına vurduğunu yaz.

Ağ gecikmesi yerel dosyada görünmez. Bu yüzden asıl metrik **ifade sayısı**
olsun: "50 kayıt için X ifade" → hedef "50 kayıt için ≤ 6 ifade". Süreyi de
raporla ama optimizasyonun kanıtı ifade sayısı.

### 2. `src/db/index.ts` içindeki sürücüyü oku

Drizzle'ın libSQL sürücüsü `db.batch([...])` destekliyorsa, birden çok ifadeyi
**tek** round-trip'te göndermenin doğal yolu bu. Destekliyorsa kullan;
desteklemiyorsa çok-satırlı `insert().values([...])` ile ifade sayısını düşür.
Hangi yolu seçtiğini ve neden seçtiğini kodda tek satırlık bir yorumla değil,
raporunda açıkla.

### 3. Toplu yaratma yolunu yaz

`src/lib/services/workspace.ts` içine `createPagesInWorkspaceBulk()` ekle. İskelet:

1. **Bellekte doğrula.** Tüm girdileri gez; icon/parentRef/şema hatalarını
   DB'ye hiç gitmeden yakala. Her girdi için kendi `ok/error` sonucu üretilmeye
   devam etsin — mevcut tool sözleşmesi bu ve bozulmamalı.
2. **Referansları toplu çöz.** Tüm benzersiz `parentId`'ler için tek `IN` sorgusu,
   tüm benzersiz `databaseId`'ler için tek sorgu (workspace doğrulaması dahil).
   Kayıt başına `assertItemInWorkspace` çağırma.
3. **Sıra numaralarını tek sorguda al.** İlgili database'ler için
   `select database_id, max(sort_order) ... group by database_id`. Aynı çağrıda
   birden çok satır aynı database'e gidiyorsa artışı bellekte yürüt. Mevcut
   "tüm satırları çek, JS'te max al" davranışını kaldır — bu database büyüdükçe
   yavaşlayan gizli bir maliyet.
4. **ID'leri önden üret.** `crypto.randomUUID()` uygulama tarafında üretiliyor;
   yani `ref`/`parentRef` ilişkileri **insert'ten önce** bellekte çözülebilir.
   Bu, seri işlemeyi zorunlu kılan tek gerekçeyi ortadan kaldırır. Girdileri
   topolojik sırala (ebeveynler önce), sonra hepsini tek batch'te yaz.
5. **Insert'leri topla.** `workspace_items`, `standalone_pages`, `pages` için
   çok-satırlı insert. SQLite'ın bind parametre limitine (~999) dikkat et:
   satır başına kolon sayısına göre chunk'la.
6. **`createdAt`/`updatedAt` değerlerini açıkça `new Date()` ile yaz.** Bu repoda
   en pahalı tuzak bu: SQLite `DEFAULT CURRENT_TIMESTAMP` timestamp-mode Drizzle
   kolonlarına TEXT yazar ve satır sonsuza dek `Invalid Date` okur. AGENTS.md
   "createdAt gotcha" bölümünü oku.
7. **Yan etkileri de topla:** `syncPageLinks` için toplu bir varyant yaz
   (`from_id` başına sil+ekle mantığını koruyarak tek sorguya indir);
   `recordGeneratedKnowledge` için toplu insert. Bunlar best-effort kalmalı —
   bir link senkron hatası yaratmayı iptal etmemeli.
8. **Koru:** parent paylaşımlıysa çocuğu otomatik paylaşma davranışı, ajan
   damgaları (`agentEditedAt`/`agentTokenId`), audit log, `contextRunId`
   doğrulaması, scope kontrolü.

### 4. Diğer bulk tool'larını da gözden geçir

`bulk_update_pages`, `bulk_move_items`, `bulk_delete_pages` aynı şekilde mi
çalışıyor? Aynı desende ise aynı tedaviyi uygula. **Silme yolunda dikkat:**
`purgeReferencesTo` → `removePageLinksFor` → tombstone (`recordDeletionTombstone`)
ve delete-öncesi snapshot sırası korunmalı; `purgeReferencesTo` önce çalışmak
zorunda çünkü hedefleri `page_links` satırlarından buluyor.

### 5. Limit ve dokümantasyon

- 50 kayıtlık üst sınırı yükseltmeyi değerlendir (ör. 100). Yükseltirsen cevap
  gövdesinin ve Vercel fonksiyon süresinin sınırlarını hesaba kat, ve tool
  açıklamasındaki sayıyı, `docs/mcp/write-tools.md`'yi, `docs/mcp/calibrate.md`
  içindeki "up to 50" ifadesini birlikte güncelle. Yükseltmemeye karar verirsen
  gerekçeni yaz.
- Kısmi başarısızlık semantiği değişirse tool açıklamasını güncelle. Tercih:
  semantiği **değiştirme** — önden doğrula, geçerli olanları batch'le, geçersiz
  olanlar kendi hatasıyla dönsün.

### 6. Kurulumun geri kalanına da bak

İstek "ilk kurulum hızı" idi, sadece bulk değil. Şunlara kısa bir göz at ve
ucuz kazanç varsa al:

- `cli/src/commands/init.js` + `cli/src/lib/install.js`: tarayıcı sonucunu
  bekleyen polling aralığı gereksiz uzun mu?
- `create_database`: şema + view + ilk satırlar kaç round-trip?

## Doğrulama

1. `npm run lint -- <paths>`, `npx tsc --noEmit`.
2. Ölçüm script'ini tekrar çalıştır; öncesi/sonrası ifade sayısı ve süreyi
   tablo olarak raporla.
3. Elle bir doğrulama: dev server'da bir database yarat, bulk ile satır ekle,
   ağaç yapısını (`ref`/`parentRef` ile iç içe sayfalar) ve sıralamayı gözle
   kontrol et. Özellikle: aynı çağrıda aynı database'e eklenen satırların
   `sortOrder` değerleri çakışmamalı.
4. Bir de "kısmi hata" senaryosu test et: 10 kayıtlık çağrının 3'ü geçersiz
   olsun; 7'si yaratılmalı, 3'ü kendi hatasıyla dönmeli.

## Bitirirken

- Kullanıcı bunu fark eder (kurulum gözle görülür hızlanır) → `src/lib/changelog.ts`
  başına kayıt, kategori `improved`, tek cümle, 8 locale.
- `AGENTS.md`'de bulk yazma yolunun yeni davranışını ve korunması gereken
  invariant'ları (id'ler önden üretilir, tombstone/purge sırası, chunk limiti)
  yaz. Serena memory'lerini senkronla.
- `scripts/ai/update-handoff.ps1` çalıştır. Commit/push yapma.
```

## Tamamlandı — 2026-09-22

Bölüm baştan sona uygulandı. Commit/push yapılmadı; P1/P2'nin commit edilmemiş
değişiklikleri korundu.

**Ölçüm (yerel `local.db`, hedef komut satırından `DATABASE_URL="file:local.db"` ile sabitlendi; prod Turso'ya hiç dokunulmadı).** Metrik ifade/round-trip sayısı: `db.batch()` uzak libsql'e **tek HTTP isteği** olarak gidiyor (`@libsql/client/http.js` → "execute the batch and close the stream in a single HTTP request"), yani bir batch = bir ağ turu.

| Senaryo | Önce | Sonra |
| --- | --- | --- |
| `bulk_create_pages`, 100 kayıt (50 sayfa + 50 satır) | **750** round-trip / 431 ms | **5** round-trip / 25 ms |
| `bulk_move_items`, 50 öğe | 200 / 22 ms | **3** / 3 ms |
| `bulk_update_pages`, 50 sayfa | 400 / 111 ms | 301 / 74 ms |
| `bulk_update_pages`, 50 satır | 400 / 105 ms | 251 / 69 ms |
| `bulk_delete_pages`, 50 | 450 | değişmedi (bilinçli — aşağıya bak) |
| `create_database` (2 kolon + 2 view) | 3 | zaten ucuz, dokunulmadı |

Yeni create yolu **batch boyundan bağımsız 5 round-trip**: (1) tek batch'te üç okuma (parent varlığı ∥ database'ler+schema ∥ parent share satırları), (2) gruplandırılmış `max(sort_order)`, (3) tek batch çok-satırlı insert, (4) link grafiği batch'i, (5) knowledge damgası.

**Yapılanlar**

- `createPagesInWorkspaceBulk()` (`src/lib/services/workspace.ts`) — id'ler `crypto.randomUUID` ile önden üretiliyor (`ref`/`parentRef` bellekte çözülüyor), tüm doğrulama batch'ten ÖNCE bellekte yapılıyor, `sortOrder` artık tek gruplu sorgudan (eski "tüm satırları çek, JS'te max al" davranışı kaldırıldı), `createdAt`/`updatedAt` açıkça `new Date()`.
- `syncPageLinksBulk()` (`pageLinks.ts`) ve `recordGeneratedKnowledgeBulk()` (`knowledge.ts`) — toplu, best-effort varyantlar. `chunkRows()` (`services/sqlChunk.ts`, 900 bind param) ile chunk'lanıyor; birden fazla chunk yine tek batch.
- `bulk_create_pages` tool'u bu yola bağlandı; **kısmi başarısızlık semantiği değişmedi** (10 kayıtlık çağrıda 3 geçersiz → 7 yaratıldı, 3'ü kendi hatasıyla döndü).
- `bulkMoveItemsInWorkspace()` toplu hale getirildi: tüm öğeler aynı hedefe gittiği için subtree kontrolünün ihtiyaç duyduğu ata zinciri tek recursive CTE ile bir kez okunuyor (`depth < 100` döngü koruması da eklendi — eski per-item `while` döngüsü bozuk veride sonsuza kadar dönerdi).
- `updatePageById` artık `itemType` döndürüyor; `bulkUpdatePages` bunu kullanarak provenance damgasını tek ifadeye indiriyor.
- Üst sınır **50 → 100**'e çıkarıldı (round-trip artık N'den bağımsız, `bulk_delete_pages`/`bulk_move_items` zaten 100). `write.ts` zod+description, `docs/mcp/write-tools.md`, `docs/mcp/calibrate.md`, `docs/WHAT_IS_REMNUS.md`, `docs/REMNUS_NEDIR.md`, `skills/remnus/SKILL.md`, `mcpb/manifest.json`, `AGENTS.md` birlikte güncellendi.
- CLI kurulum polling'i (`cli/src/lib/install.js`): düz 2 sn yerine kademeli (ilk 60 sn 750 ms → 2 sn → 3 sn). Tarayıcıda onay ile terminalin devam etmesi arasındaki ölü süre ~2 sn'den ~0,75 sn'ye indi, toplam istek sayısı neredeyse aynı.
- `src/lib/changelog.ts` başına iki kayıt (8 locale): kurulum hızı için `improved`, aşağıdaki paylaşım kalıtımı düzeltmesi için `fixed`. `AGENTS.md` → Performance Rules → "Bulk write path" ve `.serena/memories/conventions.md` + `core.md` senkronlandı.

**Bilinçli yapılmayanlar**

- **`bulk_delete_pages` toplu hale getirilmedi.** Deseni aynı değil: zaten `Promise.allSettled` ile eşzamanlı (seri değil), sırası yük taşıyor (snapshot → delete → tombstone → `purgeReferencesTo` → `removePageLinksFor`; purge hedeflerini bir sonraki adımın sildiği `page_links` satırlarından buluyor) ve descendant ağacına özyineliyor. Kazanç küçük, hata bedeli silinmiş kullanıcı içeriği.
- **`bulk_update_pages` tam toplu hale getirilmedi.** Giriş başına farklı dal (item/row), version snapshot debounce mantığı ve property merge'ü yeniden yazmak, eşzamanlı zaten çalışan bir yolda kazandıracağından fazla risk taşıyor. Sadece provenance damgası batch'lendi.

**Yol boyunca bulunan mevcut hata — DÜZELTİLDİ.** `shared_pages.created_by`, `user.id`'ye **NOT NULL** FK; ama MCP tarafındaki `autoShareIfParentShared` oraya **token id** yazıyordu (`agentCtx?.tokenId ?? 'system'`) — web UI'daki eşdeğeri (`actions/workspace.ts`) gerçek `userId` alıyor. Insert best-effort olduğu için hata yutuluyordu; sonuç: **ajanın yayınlanmış bir sayfanın altına yarattığı sayfalar hiçbir zaman yayınlanmıyordu.** Bu kozmetik değil: `/share/[...slug]` public ağacı **yalnızca kendi `shared_pages` satırı olan** öğelerden kuruluyor, yani o sayfalar ziyaretçiye görünmüyor ve ebeveyndeki child-block butonu boşa düşüyordu.

**Çözüm:** `created_by` artık çağırandan değil **ebeveyn share satırından miras alınıyor** (hem tek-sayfa `create_page` hem toplu yol). Gerekçe: (a) ebeveyn satırı zaten var olduğu için değer tanım gereği FK-geçerli; (b) semantik olarak doğru — bu satır o kişinin "alt ağacı yayınla" kararı yüzünden var; (c) `ON DELETE CASCADE` tutarlı hale geliyor: yayınlayan kişi silinince miras alan alt ağaç da onunla gidiyor (ajan sahibi kullanılsaydı ebeveyn public kalıp çocuklar kaybolabilirdi). `TokenContext.ownerUserId` kullanılmadı: PAT'lerde null olabiliyor ve token tipine göre farklı cascade davranışı doğuruyordu.

**Davranış değişikliği (bilerek).** Artık bir ajanın yayınlanmış sayfa altına yarattığı sayfa da herkese açık oluyor. Bu, web UI'da bir insan aynı sayfayı yarattığında zaten olan şey — eski "olmuyor" hali tasarlanmış bir güvenlik özelliği değil, kırık bir FK yazımının yan etkisiydi. Yayınlanmamış ebeveyn altındaki sayfalar (test edildi) gizli kalmaya devam ediyor.

**Aynı sınıftan başka hata var mı? Yok.** `user` tablosuna FK veren 26 kolonun tamamı denetlendi; ajanın yazdığı diğer tüm user FK'leri (`page_comments.author_user_id`, `page_snapshots.deleted_by_user_id`) nullable ve ajan aktör için açıkça `null` yazıp atfı token FK kolonlarında taşıyor — doğru desen. `shared_pages.created_by` NOT NULL olduğu için o deseni kullanamıyordu, miras çözümü bu yüzden.

**Doğrulama.** `npx tsc --noEmit` temiz; `npm run lint` değişen dosyalarda 0 hata (2 uyarı mevcut/ilgisiz); `npm run test:recurrence` 26/26. Ek olarak scratchpad'de üç geçici script yazıldı ve repo'dan silindi: ölçüm, 44 kontrollük servis-seviyesi eşdeğerlik süiti (sortOrder çakışması, çağrılar arası devam, `ref`/`parentRef` kenar durumları, cascade, share kalıtımı, Invalid Date, kısmi hata, paylaşım kalıtımının gerçek ajan token'ıyla çalışması ve yayınlanmamış ebeveyn altında ÇALIŞMAMASI) ve 20 kontrollük MCP handler-seviyesi süit (gerçek zod şeması + handler wiring + read-scope reddi). Hepsi geçti. Dev server/Playwright ile görsel kontrol yapılmadı — handler-seviyesi süit aynı yolu tarayıcısız doğruluyor.

---

# P4 — Token diyeti ve yerel proje haritası

> İstek 10. Tahmini kapsam: büyük. P3'ten sonra yapılması önerilir.

````text
Remnus projesinde çalışıyorsun. Önce `AI.md`'yi, `docs/mcp/token-efficient-usage.md`
dosyasını ve `AGENTS.md` içindeki "Project Install" bölümünü oku. Serena varsa
`core` + `conventions` memory'lerini oku. `git status --short` ile başla.

## Hedef

Remnus'u kullanan bir ajan oturumu, aynı işi Remnus'suz yapan bir oturumdan
**belirgin biçimde daha az token harcamalı ve daha hızlı olmalı.** Kullanıcının
tepkisi "ne kadar az limit kullanıyor, ne kadar hızlı" olmalı. Bu görev o iddiayı
ölçülebilir hale getirmek ve en büyük kalemleri kesmek.

## Kural: önce ölç

Hiçbir optimizasyonu ölçmeden yapma. İlk iş, bir MCP oturumunun token bütçesinin
nereye gittiğini çıkarmak:

1. Scratchpad'e bir script yaz: MCP handler'ını yerelde ayağa kaldır (veya
   `registerReadTools`/`registerWriteTools`/`registerPrompts`/`registerResources`
   fonksiyonlarını sahte bir `McpServer` ile çağırıp topladıkları şemaları
   serileştir) ve şunları byte + tahmini token olarak raporla:
   - `tools/list` cevabının tamamı, **tool başına döküm**
   - `resources/list`, `prompts/list`
   - sunucu `instructions` metni (`buildInstructions`, handler.ts ~180)
   - `cli/templates/agents-section.md`'nin projeye yazdığı blok
2. Sonra tipik bir oturumun ilk 5 dakikasını modelle: initialize + tools/list +
   digest okuma + bir `query_database` + bir `get_page`. Toplam token tahmini çıkar.
3. Bu tabloyu raporuna koy. Optimizasyon sonrası aynı tabloyu tekrar üret.

## Doğrulanmış kalemler (bunlarla başla)

Aşağıdakiler kodda teyit edildi. Her biri için "yap" demiyorum; ölç, karar ver,
gerekçeni yaz.

### 1. Her tool cevabı iki kez serileştiriliyor

`src/app/api/mcp/tools/read.ts` ve `write.ts` içindeki **her** tool şöyle dönüyor:

```
return { content: [{ type: 'text', text: JSON.stringify(out) }], structuredContent: out };
```

Aynı JSON telde iki kez. MCP spec'i `outputSchema` tanımlayan bir tool için
`structuredContent` döndürmeyi zorunlu kılar ve geriye dönük uyumluluk için
serileştirilmiş metni de döndürmeyi **önerir** (SHOULD, MUST değil).

Araştır: Claude Code / Cursor / Claude Desktop gibi istemciler ikisini de modele
veriyor mu, yoksa `structuredContent` varken metin bloğunu atlıyor mu? Bulgularına
göre karar ver. Seçenekler: (a) metin bloğunu insan-okunur kısa bir özetle
değiştir ("12 rows, 3 databases" gibi) ve tam veriyi `structuredContent`'te bırak,
(b) olduğu gibi bırak. (a) doğruysa bu tek değişiklik her okuma cevabını yarıya
indirir — ama uyumluluğu kırma riskini ciddiye al ve kararını gerekçelendir.

Not: `agent_activity.response_bytes` şu an yalnız **bir** kopyayı ölçüyor, yani
mevcut kullanım metriklerimiz gerçeğin yarısını gösteriyor. P5 bu sayıya
dayanacak; burada düzelt veya en azından belgelendir.

### 2. Read-scope token'lar 14 write tool şemasını boşuna alıyor

`src/app/api/mcp/handler.ts` içinde `registerWriteTools(server, ctx)` koşulsuz
çağrılıyor; write tool'ları scope'u yalnız **çalışma anında** kontrol edip hata
döndürüyor. Read-only bir oturum için bu şemalar tamamen israf ve ajanı
çağıramayacağı tool'larla kandırıyor. `ctx.scope === 'write'` koşuluna bağla.
(Proje kurulumları write token aldığı için bu, kurulu projelerde değil read-only
entegrasyonlarda kazanç sağlar — yine de doğru davranış.)

### 3. Tool yüzeyi diyeti

25 tool'un açıklamaları ve zod şemaları **her oturumda** gönderiliyor. Şunlara bak:

- Açıklamalardaki ve `.describe()` çağrılarındaki tekrarı kırp. "The workspace
  item ID to delete" gibi alan adından zaten anlaşılan açıklamalar yer kaplıyor.
  Ama ajanın davranışını değiştiren cümleleri (ör. `update_page`'in merge
  semantiği, `confirm: true` kuralı) **silme** — onlar token'ın hak edilmiş kısmı.
- Nadir kullanılan tool'ları birleştirmeyi değerlendir: üç ayrı
  `create/update/delete_database_view` tek bir `manage_database_view` olabilir mi?
  Birleştirme şemayı karmaşıklaştırıyorsa yapma.
- Uzun anlatımı tool açıklamasından çıkarıp `docs/mcp/*.md` ve MCP **resource**
  yüzeyine taşı — resource listesi tool şemasından çok daha ucuz.

### 4. Yerel proje haritası (kullanıcının fikri — en büyük yapısal iş)

Fikir: ajan her şeyi MCP'ye sorarak öğrenmesin; projenin yanında, neyin nerede
olduğunu anlatan yerel bir dosya dursun, ajan önce ona baksın.

Bu iyi bir fikir ama **dürüst olmak gerekirse tek başına token tasarrufu
garantisi değil**: yerel dosyayı okumak da context'e giriyor. Gerçek kazançlar
şunlar, tasarımı bunlara göre yap:

- **Round-trip ve gecikme:** yerel dosya ağ turu değil, milisaniye.
- **Kısmi okuma:** ajan dosyayı grep'leyebilir, tamamını context'e almak zorunda
  değil. MCP cevabı ise all-or-nothing.
- **Soğuk başlangıç:** oturumun ilk turunda ajan hangi id'ye gideceğini bilerek
  başlar; "önce ara, sonra oku" iki turu tek tura iner.

Tasarım gereksinimleri:

- **Nerede duracak:** `.remnus/` altında (config/credentials ile aynı yer).
  Örn. `.remnus/workspace-map.md`. Commit edilip edilmeyeceğine karar ver ve
  gerekçesini yaz: ekip paylaşımı için commit etmek cazip, ama sürekli değişen
  bir üretilmiş dosya diff gürültüsü yaratır. Önerim: varsayılan olarak
  `.gitignore`'a ekle (CLI'ın `ensureGitignore` marker bloğu bunun için zaten
  var), ama açıkça bir seçenekle commit edilebilir olsun.
- **İçerik:** `getWorkspaceDigest` (`src/lib/services/workspace.ts`) zaten
  kompakt, tek-satır-per-öğe bir harita üretiyor ve
  `remnus://workspace/{id}/digest` resource'u olarak sunuluyor. Yerel haritayı
  **bunun önbelleği** olarak tasarla; yeni bir format icat etme. Üstüne
  eklenecekler: workspace id, sunucu URL'si, üretildiği zaman ve bir
  **tazelik işareti** (`get_changes_since`'in döndürdüğü `nextCursor` bunun için
  biçilmiş kaftan).
- **Kim günceller:** en doğal yer `cli/src/commands/mcp.js` içindeki stdio↔HTTPS
  köprüsü — her JSON-RPC mesajı zaten oradan geçiyor. Bir yazma çağrısı
  başarıyla döndüğünde haritayı "kirli" işaretle ve arka planda tazele. Köprü
  kuralını unutma: **stdout'a protokol byte'ları dışında hiçbir şey yazılamaz**,
  loglar stderr'e (`cli/src/lib/ui.js`). Alternatif/ek olarak `remnus sync` gibi
  açık bir komut ve `remnus open`/`doctor` içinde tazeleme.
- **Tazelik dürüstlüğü:** harita eskiyebilir, özellikle workspace'i birden çok
  kişi/ajan kullanıyorsa. Dosyanın başında makine ve insan için okunur bir
  "bu bir önbellek, şu cursor'dan itibaren doğrulanmadı" bandı olsun ve
  `AGENTS.md` bloğu ajana kuralı açıkça versin: *önce haritayı oku; yazmadan
  önce veya harita eskiyse `get_changes_since(cursor)` ile deltayı al — tüm
  ağacı yeniden tarama.*
- **`cli/templates/agents-section.md` güncellemesi:** şu anki blok ajana "önce
  ara" diyor. Yeni sıralamayı yaz: (1) yerel harita, (2) delta senkron,
  (3) hedefli okuma, (4) en son geniş arama. Blok **kısa** kalsın — o metin de
  her oturumda token harcıyor; eklediğin her satırın davranış değiştirdiğinden
  emin ol.
- **CLI kısıtı:** `cli/` paketi sıfır bağımlılıklı, ESM, standalone. Bağımlılık
  ekleme.

### 5. Delta-senkron ritüelini varsayılan yap

`get_changes_since` zaten var ve doğru araç. Oturum başlangıcı ritüeli
"digest oku" değil "cursor'ı ver, deltayı al" olmalı. Bunu hem sunucu
`instructions`'ında hem AGENTS.md bloğunda hem `docs/mcp/token-efficient-usage.md`
içinde tutarlı hale getir.

### 6. Cevap şekillendirme

- `query_database` gövdeleri opt-in — bu doğru, koru.
- JSON cevaplardan `null`/boş alanları düşürmeyi değerlendir (şema hâlâ
  tanımlıyor; ajan yokluğu okuyabiliyor).
- `get_page` için varsayılan modun `outline` olması ajanı ucuza doğru iter mi,
  yoksa her seferinde ikinci bir çağrı mı yarattırır? Ölç, karar ver.

## Kapsam dışı

- Harici altyapı (Redis/Upstash/yeni servis) ekleme, paket kurma.
- `/api/mcp` yollarının davranışını değiştirme — AGENTS.md'de "frozen" olarak
  işaretli. Payload içeriğini iyileştirmek serbest, yol/auth semantiğini
  değiştirmek değil.

## Doğrulama

1. `npm run lint -- <paths>`, `npx tsc --noEmit`.
2. Öncesi/sonrası token tablosu (yukarıdaki ölçüm script'i ile).
3. Gerçek bir MCP istemcisiyle uçtan uca dene: Claude Code'da `/mcp` ile
   bağlantıyı yenile, bir okuma ve bir yazma yap, cevapların bozulmadığını gör.
   `structuredContent`/metin kararını değiştirdiysen bunu mutlaka gerçek bir
   istemcide doğrula — burası uyumluluğun kırılabileceği tek yer.
4. CLI'a dokunduysan: `npx remnus doctor` ve `npx remnus mcp` hâlâ çalışıyor mu;
   stdout'a kaçak log gitmiyor mu (köprüyü elle bir JSON-RPC satırıyla besleyip
   çıktıyı incele).

## Bitirirken

- `docs/mcp/token-efficient-usage.md` ve `docs/mcp/read-tools.md` içindeki
  ölçülmüş yüzdeleri yeni gerçeğe göre güncelle — eski sayıları bırakma.
- `src/lib/changelog.ts` başına kayıt (kategori `improved`), tek cümle: kullanıcı
  için anlamı "ajanların daha az okuyup daha hızlı çalışması".
- `AGENTS.md` + Serena memory güncelle: yerel harita dosyası, tazelik sözleşmesi
  ve tool yüzeyi kuralları kalıcı bilgi.
- `scripts/ai/update-handoff.ps1`. Commit/push yok.
````

## Tamamlandı — 2026-09-22 (Claude)

Ölçüm önce yapıldı, sonra kesildi. `npm run bench:mcp-budget`
(`src/scripts/mcp-token-budget.ts`) tool/prompt/resource yüzeylerini gerçek in-memory
transport üzerinden ölçüyor ve **modelin gördüğü** kısmı (`description` + `inputSchema`)
yalnızca telde kalandan (`outputSchema`, `annotations`) ayırıyor — çünkü Anthropic tools
API'sinde output-schema alanı yok. Sonuç: write scope 31,0 KB → 21,7 KB (~7.750 → ~5.410
tok), read scope ~7.750 → ~1.360 tok.

Yapılanlar:

1. **Read token'ı artık write tool'larını hiç almıyor** — `handler.ts` `registerWriteTools`'u
   yalnızca `ctx.scope === 'write'` iken kaydediyor. Read scope tools/list'i 25 değil 11.
2. **Tool yüzeyi diyeti** — davranış değiştirmeyen açıklamalar kırpıldı, davranış
   değiştirenler (merge semantiği, `confirm: true`, cross-database move'un tümden reddi)
   korundu. `contextRunId`'deki `z.string().uuid()` 14 write şemasına ~180 baytlık regex
   basıyordu → `z.string().max(64)`; `z.union([z.literal(…)…])` → `z.literal([…])`; iki yerde
   kopyalanan kolon tanımı tek `COLUMN_INPUT` oldu.
3. **Çift serileştirme KALDI, gerekçelendirildi.** Araştırma: Claude Code ikisi birden
   varken modele yalnızca `structuredContent`'i veriyor (anthropics/claude-code#55677,
   #79944); Claude Desktop/Cursor yalnızca metin bloğunu veriyor (blockscout/mcp-server#324
   tam da metni kısaltarak kırıldı); SDK de `outputSchema` varken `structuredContent`
   olmadan cevabı reddediyor. Her istemci bir kopya iletiyor, yani `response_bytes` zaten
   modelin gördüğü boyut — bu da schema yorumuna yazıldı. Yani (b) seçildi, ama bilerek.
4. **Yerel proje haritası** `.remnus/workspace-map.md` — digest'in CLI tarafındaki
   önbelleği (`cli/src/lib/map.js` + `rpc.js`). Cursor'ı **digest'in kendisi** üretiyor
   (`getChangeHeadCursor`, item sorgularından önce), `get_changes_since` artık **her zaman**
   `nextCursor` dönüyor ve `settledCursor` açık saniyeyi bir kez tekrar bildirip kapandıktan
   sonra susuyor. Köprü (`cli/src/commands/mcp.js`) oturum başında ve her başarılı yazmadan
   sonra 1,5s debounce ile tazeliyor; yazma tool'larını `tools/list` annotation'larından
   öğreniyor; hata tek bir stderr uyarısı, stdout'a asla bir bayt gitmiyor. Yeni komut
   `npx remnus sync` (`--track` / `--untrack`), varsayılan git-ignore.
5. **Delta ritüeli varsayılan** — sunucu `instructions`, `agents-section.md`, SKILL.md ve
   `docs/mcp/token-efficient-usage.md` aynı sırayı söylüyor: harita → delta → hedefli okuma →
   en son arama.
6. **Cevap şekillendirme** — ölçüldü: `list_workspace` %15 null taşıyordu (düzeltildi),
   diğer okuma cevapları %0–2 (dokunulmadı).

Yapılmayanlar (gerekçeli): view tool'larını `manage_database_view` altında birleştirme
(mod ayrıştırıcısı + moda özel opsiyonel alanlar şemayı kazandığından fazla karmaşıklaştırıyor),
tool açıklamalarını resource'lara taşıma (kırpma kazancı zaten alındı), `get_page`
varsayılanını `outline` yapma (harita artık gövde boyutunu yazıyor; varsayılanı çevirmek her
kısa sayfa okumasını iki tura çıkarırdı).

Doğrulama: `npx tsc --noEmit` temiz; hedefli `npm run lint` 0 hata; before/after ölçüm tablosu;
yerel dev server + geçici local PAT ile uçtan uca (köprü stdout'u saf, harita yazma sonrası
güncellendi, read token'ı `create_page` göremiyor), test token'ları ve sayfaları silindi.
Ayrıntı: `.ai/CURRENT_TASK.md`.

**Not:** `file:local.db`'de eksik olan 0044/0045/0046/0047 migration'ları **yalnızca yerele**
uygulandı (hepsi idempotent). Production Turso'ya dokunulmadı.

---

# P5 — Tasarruf / fayda metrikleri (Brave tarzı)

> İstek 8. P4'ten sonra. Metrik seti aşağıda kararlaştırıldı; prompt onu uyguluyor.

**Karar verilen metrik seti** (gerekçesiyle):

- **Birincil — "Kazanılan token":** Her MCP okumasında, aynı bilgiyi naif yolla
  almanın maliyeti hesaplanabiliyorsa farkı kaydet (digest yerine tüm ağacı
  okumak; `fields` projeksiyonu yerine tüm kolonlar; `outline` yerine tam sayfa;
  delta yerine tam tarama). Brave'in "engellenen reklam" sayacının doğru
  karşılığı bu — ve uydurma değil, her kalemin tanımlı bir temeli var.
- **İkincil — "Yeniden kullanılan bilgi":** Bu oturumda okunan, ama **daha önceki
  bir oturumda** yazılmış sayfa/satır sayısı. Ürünün asıl vaadi bu: ajanın
  yeniden keşfetmek zorunda kalmadığı karar/gotcha sayısı.
- **Üçüncül — "Ajan üretimi":** Bu hafta ajanların yarattığı/güncellediği sayfa
  ve satır sayısı (`agent_activity` üzerinden zaten var).
- **Hız:** tool çağrılarının p50 gecikmesi — "hızlı" iddiasının kanıtı.
- **Gösterilmeyecekler:** uydurma dolar tasarrufu ve "kazanılan saat". Yanlış
  çıktığında tüm panele olan güveni götürür. İstenirse dolar, varsayılan kapalı
  ve kullanılan fiyat varsayımı açıkça yazılı bir ek olarak gelebilir.

```text
Remnus projesinde çalışıyorsun. Önce `AI.md`'yi, `AGENTS.md` içindeki
"Database Tables" (özellikle `agent_activity`) ve "Migration Notes" bölümlerini
oku. Serena varsa `core` + `conventions` memory'lerini oku. `git status --short`.

## İş

Kullanıcıya, Remnus'un ona ne kazandırdığını gösteren küçük ve **dürüst** bir
metrik yüzeyi ekle. Referans his: Brave'in "şu kadar reklam engellendi" sayacı —
her açılışta orada duran, tek bakışta anlaşılan bir sayı.

## Gösterilecek metrikler (karar verilmiş, tartışma açık değil)

1. **Kazanılan token (birincil, kümülatif).** Bir MCP okuması, aynı bilgiyi naif
   yoldan almaktan ucuzsa aradaki farkı kaydet:
   - `digest` resource okuması ↔ tüm öğelerin gövdesini okumak
   - `query_database` + `fields` ↔ aynı sorgunun tüm kolonlu hali
   - `get_page` `mode:"outline"` ↔ `mode:"full"` (`fullContentChars` zaten
     hesaplanıyor)
   - `get_changes_since` (cursor'lı) ↔ tam listeleme
   Her kalem için temel (baseline) **gerçekten hesaplanabilir** olmalı. Tahmin
   edemediğin bir çağrı için sıfır yaz; uydurma.
2. **Yeniden kullanılan bilgi.** Bu oturumda ajanın okuduğu, ama 24 saatten önce
   yazılmış sayfa/satır sayısı. "Ajanın yeniden keşfetmek zorunda kalmadığı
   karar/gotcha" anlatısı bu.
3. **Ajan üretimi.** Son 7 günde ajanların yarattığı/güncellediği sayfa + satır.
4. **Hız.** Tool çağrılarının p50 gecikmesi (ms).

**Dolar veya "kazanılan saat" gösterme.** İstenirse sonradan, varsayımı açıkça
yazılı bir ek olarak gelir.

## Veri modeli

`agent_activity` tablosu zaten her MCP çağrısını `tool_name`, `status`,
`created_at`, `response_bytes`, `owner_user_id`, `workspace_id` ile logluyor
(`src/app/api/mcp/context.ts` → `logActivity`).

- **Önce şunu doğrula:** `response_bytes` yalnız metin bloğunu mu ölçüyor? Tool
  cevapları hem `content[].text` hem `structuredContent` olarak aynı JSON'u
  döndürüyor; ölçüm tek kopyayı sayıyorsa metrik ~2× eksik. P4'te düzeltilmiş
  olabilir; kontrol et ve tutarlı hale getir.
- Yeni alan gerekiyorsa (`baseline_bytes` veya `saved_bytes`, nullable integer)
  migration yaz. **Migration kuralları:** `AGENTS.md` → "Migration Notes"u oku,
  `npx drizzle-kit generate` kullan, apply script'ini hedef veritabanını açıkça
  doğrulayarak çalıştır. `.env` içindeki Turso **production** olabilir — prod'a
  yazma. Hangi veritabanına uyguladığını raporunda yaz.
- Gecikme için: ölçüm yoksa `logActivity`'ye süre alanı ekle (çağrı başında
  `performance.now()`). Best-effort kalsın; log hatası asıl cevabı bozmamalı —
  bu tabloda geçerli kural bu.
- Hesaplama `src/lib/actions/agentToken.ts` içindeki `getMyAgentUsage()`
  desenini takip etsin (30 günlük pencere, `owner_user_id` üzerinden atıf).
  Yeni bir servis fonksiyonu yazarken workspace'e göre de filtrelenebilir olsun —
  proje penceresi yalnız kendi workspace'ini görmeli.

## UI

- Sidebar'ın altına kompakt bir kart. Tek satırda büyük sayı (kazanılan token),
  altında iki-üç küçük destek metriği. Tıklanınca ayrıntı (mevcut `AgentsModal`
  içine bir sekme iyi bir ev olabilir — yeni modal icat etmeden önce oraya bak).
- **Her sayının bir tooltip'i olsun ve temelini açıklasın.** "Bu neye göre
  tasarruf?" sorusunun cevabı arayüzde bulunmalı; yoksa sayı inandırıcı değil.
- Workspace UI'ı düz/çerçevesiz, üç katmanlı neutral palet kullanıyor
  (`AGENTS.md` → Color Theme / UI & Design Aesthetics). Bu dile uy; yeni bir
  aksan rengi getirme.
- Proje penceresinde de görünmeli (bu, kilitli oturumun görmeye hakkı olan
  workspace-içi bir veri) — ama P1'de eklenen `isProjectWindow` ayrımına saygı
  göster, hesap düzeyinde bir şey gösterme.
- Sayı 0 ise kartı gösterme veya "henüz veri yok" de; sıfır dolu bir pano
  ürünü küçültür.

## i18n

Tüm metinler next-intl üzerinden, **8 locale zorunlu** (`en, tr, hi, es, fr, de,
zh, ru`). `messages/en.json` source of truth. Sayı ve tarih biçimlerini locale'e
bırak, hardcode etme.

## Doğrulama

1. `npm run lint -- <paths>`, `npx tsc --noEmit`.
2. Migration uygulandıysa: yerel DB'de şemanın doğru olduğunu ve eski satırların
   (null baseline) hesabı bozmadığını doğrula.
3. Dev server'da gerçek birkaç MCP çağrısı yap ve kartın sayılarının arttığını
   gör. Sadece mock veriyle "çalışıyor" deme.
4. Sayıların dürüstlüğünü kendin denetle: küçük bir workspace'te elle hesapla ve
   karta bak. Tutmuyorsa formül yanlıştır, UI değil.

## Bitirirken

- `src/lib/changelog.ts` başına kayıt (kategori `new`), tek cümle, 8 locale.
- `AGENTS.md`'ye metriklerin tanımını ve baseline formüllerini yaz — bu tam olarak
  altı ay sonra kimsenin hatırlamayacağı ve yanlış yorumlanacak türden bilgi.
  Serena memory'sini senkronla.
- `scripts/ai/update-handoff.ps1`. Commit/push yok.
```

## ✅ Tamamlandı — 2026-09-22

Metrik yüzeyi kuruldu, dört sayı da gerçek MCP çağrılarıyla doğrulandı.

**Ölçüm katmanı.** `agent_activity`'ye üç nullable kolon eklendi (migration `0049`,
`src/db/apply-0049-agent-metrics.ts`): `baseline_bytes`, `duration_ms`,
`items_affected`. **Yalnızca local.db'ye uygulandı — Turso (production) hâlâ
bekliyor** ve bu kod deploy edilmeden önce oraya uygulanmalı. `logActivity`
isteğe bağlı bir `metrics` parametresi aldı; süre ölçümü `handleMcpRequest`'in
başında açılan request-scoped `AsyncLocalStorage` ile yapılıyor, böylece ~30
handler'a kronometre geçirmek gerekmedi.

**Baseline'lar (hepsi hesaplanan, tahmin edilen yok).** digest resource'u
(`getWorkspaceDigest` artık `{ text, naiveBytes }` dönüyor), `get_page`/`get_pages`
outline modu, ve `fields` projeksiyonlu `query_database` (`queryDatabaseRows` ek
bir `baselineBytes` dönüyor, read.ts onu serialize etmeden ayırıyor).
`get_changes_since` bilinçli olarak NULL yazıyor — naif karşılığı haritanın
tamamını yeniden kurmak olurdu ve bu sıcak yolda per-call maliyet demek.
Promptta istenen `response_bytes` kontrolü yapıldı: tek kopya sayımı zaten
kasıtlıydı ve schema'da gerekçesiyle belgeliydi; değiştirilmedi.

**İki düzeltme yol boyunca çıktı.** (1) Bulk yazmalar tek çağrı olarak
loglandığı için 40 sayfalık `bulk_create_pages` "1" sayılacaktı — `items_affected`
bu yüzden var. (2) Hatırlama metriği ilk ölçümde **kalıcı olarak 0** okudu:
eski satırlarda `created_at` TEXT (`CURRENT_TIMESTAMP` gotcha'sı) ve SQLite tip
sıralaması her TEXT'i her integer'ın üstüne koyuyor. `asEpochSeconds()` iki
biçimi de normalize ediyor.

**UI.** `AgentSavingsCard` sidebar'ın alt kümesine girdi (büyük sayı + üç küçük
destek metriği, her birinde temelini açıklayan tooltip); ayrıntı `AgentsModal`
içine yeni bir blok olarak eklendi, yeni modal icat edilmedi. Proje penceresinde
workspace'e filtreli çalışıyor ve tıklanamıyor. `savedBytes` 0 iken kart hiç
render edilmiyor. 12 anahtar × 8 locale eklendi.

**Doğrulama (mock değil, gerçek çağrılar).** Yerel dev server'a geçici bir PAT ile
gerçek MCP çağrıları yapıldı; loglanan baseline'lar aynı isteğin naif halinin
gerçek boyutuyla birebir tuttu: `query_database` projeksiyonlu 2217 bayt /
baseline 3685 ↔ tüm kolonlu çağrının gerçek cevabı 3685; `get_page` outline 697 /
baseline 2797 ↔ full çağrı 2797. digest baseline'ı (18.074 bayt) ham içerikten
elle toplanarak doğrulandı — MATCH. Toplam 20.910 bayt ≈ 5.2K token, 3 çağrı;
kalem kalem toplamı tutuyor. `bulk_create_pages`/`bulk_update_pages` `items=3`
yazdı, p50 formülü 35ms'i doğru seçti. Test sayfaları silindi, geçici token ve
ürettiği kayıtlar (CASCADE) temizlendi — local.db bulunduğu hâlde bırakıldı.
`npx tsc --noEmit` ve hedefli `npm run lint` temiz. **Kart tarayıcıda görsel
olarak doğrulanmadı** (Playwright için önceden onay isteniyor).

**Dokümantasyon.** `AGENTS.md` → yeni **Agent Savings Metrics** bölümü (baseline
formül tablosu, dört metriğin tanımı, bilinçli NULL'lar, dolar/saat göstermeme
kararı), `agent_activity` satırı ve Migration Notes güncellendi.
`src/lib/changelog.ts` başına `new` kaydı (8 locale). **Serena bu oturumda
kullanılamıyordu** (araçlar sunulmadı), bu yüzden `mem:core`/`mem:conventions`
senkronu yapılamadı — sıradaki oturumda yapılmalı.

---

# P6 — Dashboard sayfa tipi + component modeli (çekirdek)

> İstek 2 ve isteğin 1'in veri modeli. Büyük. P1-P5 sonrası.

````text
Remnus projesinde çalışıyorsun. Önce `AI.md`'yi ve `AGENTS.md` içindeki
"Database Tables", "Project Structure", "Trash & Version History",
"Critical conventions" bölümlerini oku. Serena varsa `core` + `conventions`
memory'lerini oku. `git status --short` ile başla.

## Amaç

Remnus'a **Dashboard** adında yeni bir sayfa tipi geliyor. Bir dashboard, HTML
yazmadan, önceden tanımlı component'lerden kurulan bir özet ekranı: workspace'in
kendi database'lerinden beslenen metrikler, grafikler, gömülü tablolar ve kısa
metin blokları. Asıl kullanıcısı bir **AI ajanı** — proje kalibrasyonunda
"bu projenin durum ekranı" üretecek. Bu yüzden biçim, az token'la yazılabilen,
katı şemalı bir JSON olmalı.

Bu görev **çekirdeği** kuruyor: veri modeli, component kataloğu, sunucu tarafı
render. MCP tool'ları bir sonraki görevin işi — ama şemayı öyle tasarla ki o
görev sadece şemayı kullansın, yeniden tanımlamasın.

## Kritik tasarım kararları (önce bunları ver, sonra kod yaz)

### 1. Depolama

Mevcut model: `workspace_items` (sidebar ağacı, `type` enum'u şu an
`['page','database']`) + tipe göre 1:1 detay tablosu (`standalone_pages`,
`databases`).

Önerilen yol: `workspace_items.type` enum'unu `'dashboard'` ile genişlet ve
`standalone_pages` muadili bir `dashboards` tablosu ekle (`item_id` FK, `spec`
JSON kolonu, açık `created_at`/`updated_at`). Farklı bir yol seçeceksen
gerekçesini yaz.

Enum genişletmenin bedeli: `type === 'page'` / `'database'` varsayan **her**
yeri bulman gerekiyor. Şunları tara ve listele: sidebar render/ikon/context menu,
`getAllWorkspaceItems`, silme/taşıma/kopyalama yolları, trash snapshot'ları
(`page_snapshots.item_type`), tombstone (`deleted_items.item_type`), MCP
`list_workspace`/`get_page`/`search_workspace`, digest üretimi
(`getWorkspaceDigest`), OKF export/import, paylaşım (`shared_pages`), arama.
Her biri için ya davranış tanımla ya da açıkça "v1 kapsamı dışı, şöyle
davranıyor" diye yaz. **Sessizce kırılan bir yol bırakma.**

Migration: `npx drizzle-kit generate` + AGENTS.md "Migration Notes"a uy.
`.env` içindeki Turso **production** olabilir; apply script'ini çalıştırmadan
önce hedefi açıkça doğrula ve raporunda yaz.

### 2. Spec formatı

`src/lib/dashboard/schema.ts` tek doğruluk kaynağı olsun: zod ile tanımlı,
sürümlü bir yapı. Kabaca:

```
{ version: 1, blocks: [ { id, type, ...typeSpecificProps } ] }
```

Kurallar:

- Her bloğun **kalıcı bir `id`'si** olsun (kısa, çakışmasız). Bir sonraki
  görevde MCP `update_dashboard` blokları id ile yamalayacak; dizinin sırasına
  güvenen bir tasarım orada çöker.
- Bloklar **veriyi değil, veri kaynağını** taşısın: `databaseId` + filtre +
  gruplama. Satırların kopyası spec'e gömülmemeli, yoksa ilk günden bayatlar.
- Zod şeması hem sunucu render'ında hem (P7'de) MCP yazma doğrulamasında
  kullanılacak. İki yerde iki şema yazma.
- Bilinmeyen `type` ya da geçersiz alan: yazmada reddet, render'da sayfanın
  tamamını çökertmeyen bir "bu blok okunamadı" durumu göster.

### 3. Component kataloğu v1 — az ve iyi

Sekizden fazla component ile başlama. Önerilen set (gerekçesiz ekleme yapma,
gerekçeli çıkarma yapabilirsin):

- **metric** — tek sayı + etiket + opsiyonel trend. Kaynak: bir database üzerinde
  count/sum/filtre.
- **chart** — bar / line / donut. Kaynak: bir database, bir gruplama kolonu,
  opsiyonel tarih ekseni.
- **database_embed** — mevcut bir database'in bir view'ını (tablo/kanban) gömme.
  Mevcut `TableLayout`/`KanbanBoard` bileşenlerini yeniden kullan, yenisini yazma.
- **list** — bir sorgunun ilk N satırı, kompakt liste (ör. "açık kararlar").
- **text** — kısa markdown (başlık, açıklama, uyarı). Uzun içerik dashboard'un
  işi değil, sayfanın işi.
- **links** — seçilmiş sayfalara/database'lere hızlı geçiş.
- **activity** — son ajan aktivitesi (`agent_activity`'den, workspace'e filtreli).

Her component için: zod şeması, varsayılanlar, ve **ajanın anlayacağı kısa bir
açıklama**. Bu açıklamalar P7'de katalog olarak sunulacak; şimdiden tek yerde,
şemanın yanında dursunlar.

### 4. Render

- Sunucu component'i olarak render et. Blokların verisini **sunucuda** çöz;
  her blok için ayrı client fetch yapan bir tasarım hem yavaş hem P4'ün token/hız
  hedefine aykırı. Aynı database'i kullanan blokların sorgularını birleştir.
- Erişim kontrolü: `assertWorkspaceAccess` / `assertDatabaseAccess` zinciri her
  blok kaynağı için geçerli. Bir blok başka bir workspace'in database'ini
  gösteremez.
- Kilitli oturum (proje penceresi) desteği: layout ve route'lar
  `getCurrentUserAllowingWorkspaceLock()` + `assertWorkspaceLockAllows()`
  desenine uymalı (AGENTS.md → Project Install §4). Bu opt-in'i unutursan
  dashboard proje penceresinde hata verir.
- Grafikler: bu repoda hâlihazırda kullanılan grafik çözümünü bul ve onu kullan;
  yeni bir grafik kütüphanesi **kurma** (paket kurma yasağı). Yoksa hafif, inline
  SVG ile çiz.
- Görsel dil: düz/çerçevesiz, üç katmanlı neutral palet (AGENTS.md → Color Theme,
  UI & Design Aesthetics). Renk, kategorik ayrım için tutarlı bir küçük palet
  kullansın; her blok kendi renk dünyasını kurmasın.
- Kaynağı silinmiş blok: sayfayı çökertme, "kaynak kaldırılmış" durumu göster.

### 5. Oluşturma ve düzenleme (insan tarafı, v1)

- `TemplatePickerModal` / sidebar "yeni öğe" akışına Dashboard seçeneği ekle
  (`src/lib/templates.ts` mevcut desen).
- v1 için insan düzenlemesi minimum olabilir: blok silme, sıralama, başlık
  değiştirme. Tam bir görsel editör bu görevin kapsamı değil — ama "yalnızca
  ajan düzenleyebilir" durumunda bırakırsan bunu arayüzde açıkça söyle.
- `page_links` entegrasyonu: bir dashboard bir database'e/sayfaya referans
  veriyorsa link grafiğine girsin mi? Girerse `purgeReferencesTo` silme
  yollarında dashboard'u da düzeltmeli. Kararını ver ve iki tarafı da tutarlı
  bırak — yarısı bağlı, yarısı bağlı değil olmasın.

## Kapsam dışı (v1)

- Public paylaşım (`/share/...`) üzerinden dashboard sunumu.
- Çapraz workspace veri kaynakları.
- Kullanıcı tanımlı yeni component tipleri (katalog sabit).
Bunları raporunda "yapılmadı, gerekçe" olarak yaz.

## Doğrulama

1. `npm run lint -- <paths>`, `npx tsc --noEmit`.
2. Migration'ı yerel DB'ye uygula ve eski satırların bozulmadığını doğrula.
3. **Görsel doğrulama zorunlu.** `npm run dev` ile gerçek bir dashboard yarat
   (elle spec yazarak olur), her component tipini en az bir kez render et,
   boş/hatalı/kaynağı silinmiş durumları gör. Ekran görüntüsü alamıyorsan
   raporunda "görsel kontrol yapılamadı" de — "çalışıyor" deme.
4. Sidebar'da yeni tipin ikonu, sıralaması, context menüsü, silinmesi ve trash'ten
   geri yüklenmesi çalışıyor mu — enum genişletmesinin bedeli tam olarak burada.

## Bitirirken

- `src/lib/changelog.ts` başına kayıt (kategori `new`), tek cümle, 8 locale.
- `AGENTS.md`'ye Dashboard bölümü ekle: tablo, spec sürümlemesi, katalog, enum
  genişletmesinin dokunduğu yerlerin listesi. Serena `core`/`conventions`
  senkronla.
- `docs/mcp/` altına dashboard'ların ne olduğunu anlatan bir sayfa hazırlığı yap
  (dolduran P7 olacak) ve `src/lib/content/manifest.ts`'e eklenip eklenmeyeceğine
  karar ver.
- `scripts/ai/update-handoff.ps1`. Commit/push yok.
````

## ✅ Tamamlandı — 2026-09-22 (Claude)

Dashboard sayfa tipi, spec'i, kataloğu ve sunucu render'ı hazır. MCP tool'ları hâlâ P7'nin işi ve
şemayı yeniden tanımlamasına gerek yok. Commit/push yapılmadı; her şey P1–P5 ile aynı working
tree'de duruyor.

**Ne yapıldı**

- **Depolama:** `workspace_items.type` → `page | database | dashboard` + yeni `dashboards` tablosu
  (`item_id` FK CASCADE, `spec` JSON), `standalone_pages` ile birebir aynı desen. Migration `0050`
  (`src/db/apply-0050-dashboards.ts`, idempotent). **DDL gerekmedi:** kolon CHECK'siz düz TEXT —
  aynısı `page_snapshots.item_type` ve `deleted_items.item_type` için de geçerli, ikisi de artık
  `'dashboard'` kabul ediyor. Yalnızca local.db'ye uygulandı (hedef açıkça verildi); **Turso hâlâ
  bekliyor**, deploy öncesi uygulanmalı.
- **Spec:** `src/lib/dashboard/schema.ts` tek zod kaynağı — sürümlü, yazmada `strictObject`
  (bilinmeyen alan reddedilir), okumada blok-bazında toleranslı (`parseDashboardSpec`). Her bloğun
  kalıcı `id`'si var ve **id ile** yamalanır; bloklar veriyi değil kaynağı taşır.
  `DASHBOARD_BLOCK_CATALOG` ajan açıklamalarını şemanın yanında tutuyor — P7 olduğu gibi sunsun.
- **Katalog (7, gerekçesiz ekleme yok):** `metric` · `chart` (bar/line/donut) · `database_embed` ·
  `list` · `text` · `links` · `activity`.
- **Render:** uçtan uca sunucu bileşeni. `resolveDashboard` tüm panoyu sabit sayıda sorguyla çözer
  (her kaynak veritabanının satırları bir kez okunur, blok başına bellekte filtrelenir). Erişim
  kontrolü **yapısal**: veritabanı araması workspace'e kısıtlı, yani başka workspace'in verisine
  ulaşan bir kod yolu yok. Grafikler inline SVG — **paket kurulmadı**, `TrafficTrendChart`'ın
  doğrulanmış 8 renklik paleti kullanıldı. `database_embed` gerçek `TableLayout`/`KanbanBoard`'ı
  kullanıyor; satır düzenlemeleri gerçek action'lara gider, görünüm ayarları ziyarete özel kalır.
- **Üç hata durumu da tek kutucukla sınırlı:** kaynak silinmiş / kolon yok / blok okunamadı.
- **İnsan düzenlemesi (v1):** ad + ikon, blok sıralama, blok kaldırma. Görsel blok kurucu yok ve
  arayüz bunu açıkça söylüyor. `loadSpecForWrite` ham blok dizisiyle çalışır: okunamayan bir blok
  ilgisiz bir düzenlemede sessizce silinmez.
- **`src/lib/tableFilters.ts`** `DatabaseView.tsx`'ten çıkarıldı; bir filtre görünümde de panoda da
  aynı satırları seçsin diye.

**Enum genişletmesinin dokunduğu her yer** `tsc` ile tek tek bulundu; hepsine davranış verildi veya
gerekçeli dışlama yazıldı — tam tablo `AGENTS.md` → **Dashboards**. Sessizce kırılan yol bırakılmadı;
bulunan iki gerçek tuzak kapatıldı: `getPageById` bir panoyu `databaseId: null` olan bir "database"
gibi döndürüyordu, ve bir pano paylaşılsaydı public `/share/…` sayfası ham JSON spec'ini
yayınlayacaktı (artık menüde yok **ve** route reddediyor).

**Kararlar (prompt'un sorduğu noktalar)**

- `page_links`: **her iki yönde de dışarıda.** `to_type` bir panoyu dürüstçe adlandıramaz, ve
  panonun kendi referansları veri kaynağı — render anında çözülüyor, ölünce "kaynak kaldırılmış"
  gösteriliyor; bu `purgeReferencesTo`'nun JSON spec'i yeniden yazmasından iyi. Editörün link
  seçicisi de panoları filtreliyor, yani yarısı bağlı yarısı bağlı değil durumu yok.
- OKF/knowledge: dışarıda, **tek yerde** (`getOkfWorkspaceSnapshot`) filtreleniyor.
- `docs/mcp/dashboards.md` yazıldı ama **bilerek `WIKI_PAGES`'e eklenmedi**: henüz var olmayan MCP
  tool'larını anlatan bir referans sayfası yayınlamak, gönderilmemiş bir yeteneği duyurmak olurdu.
  P7 aynı değişiklikte manifest kaydını ekler ve sayfanın **Tools** bölümünü doldurur.

**Kapsam dışı bırakılanlar (v1, hepsi karar):** public paylaşım, çapraz workspace kaynakları,
kullanıcı tanımlı blok tipleri, görsel blok kurucu.

**Doğrulama**

- `npx tsc --noEmit` temiz; `npm run lint` tüm yeni/değişen yollarda 0 hata.
- Migration sonrası eski satırlar bozulmadı (7 database, 33 sayfa, 33 standalone page, 275 satır).
- `resolveDashboard`, 7 blok tipi + 3 hata durumunu kapsayan 15 bloklu bir spec ile gerçek yerel
  veri üzerinde çalıştırıldı; tüm sayımlar, grafik kovaları, kesme ve hata durumları doğru.
- **Görsel kontrol yapıldı** (Playwright + demo girişi + yerel dev server): 7 blok tipinin hepsi,
  boş pano, okunamayan blok, kaynağı/kolonu silinmiş blok, `sum`/`avg`/`max`, trend oku, line
  grafiğinin ay kovaları ve yerelleştirilmiş eksen etiketleri. Sidebar ucundan ucuna: ikon, href,
  aktif durum, alt sayfa eklemenin olmaması, context menü, inline yeniden adlandırma, şablon
  seçiciden oluşturma, silme (spec'li snapshot + tombstone) ve çöp kutusundan geri yükleme.
  Seed edilen test kayıtları sonrasında temizlendi.

**Yol boyunca bulunan, P6'ya ait olmayan bir hata düzeltildi:** `src/lib/actions/agentMetrics.ts`
(P5), `actions/trash.ts`'te belgelenen "use server" re-export tuzağına düşmüştü —
`ReferenceError: AgentMetrics is not defined` ile sidebar'ı mount eden **her** route'un **tüm**
server action'larını çökertiyordu. Belgelenen doğrudan from-clause re-export ile düzeltildi.

**P7 için:** `src/lib/dashboard/schema.ts` ile `DASHBOARD_BLOCK_CATALOG`'u olduğu gibi kullan,
yeniden tanımlama. `setDashboardSpec` / `deleteDashboardBlock` / `moveDashboardBlock`
(`src/lib/actions/dashboard.ts`) hazır örüntüler. Migration `0050`'yi Turso'ya uygulamayı unutma.

---

# P7 — Dashboard'ların MCP ile yönetimi

> İstek 1. P6'ya doğrudan bağımlı; P6 bitmeden başlama.

```text
Remnus projesinde çalışıyorsun. Önce `AI.md`'yi, `AGENTS.md` içindeki Dashboard
bölümünü (P6'da yazıldı) ve `docs/mcp/write-tools.md` + `docs/mcp/read-tools.md`
dosyalarını oku. `src/lib/dashboard/schema.ts` bu görevin sözleşmesi — onu
değiştirmeden kullan; değiştirmen gerekiyorsa gerekçesini raporla.
`git status --short` ile başla.

## Amaç

Bir AI ajanı, HTML yazmadan ve az token harcayarak proje dashboard'ları
üretebilsin ve güncelleyebilsin. Ölçüt net: **tipik bir dashboard'un spec'i
~500 token'ın altında yazılabilmeli.**

## Tasarım kısıtı: katalog tool şemasına girmesin

Component kataloğunun tamamını tool açıklamasına veya `inputSchema`'ya gömmek en
kolay yol — ve en pahalı yol, çünkü `tools/list` **her oturumda** gönderiliyor.
Bunun yerine:

- Katalog bir **MCP resource** olsun: `remnus://dashboard/catalog` (bkz.
  `src/app/api/mcp/resources.ts` içindeki mevcut resource desenleri). Ajan
  yalnız dashboard yapacağı zaman okur.
- Aynı içerik insan ve doküman tarafı için `docs/mcp/dashboards.md` olarak da
  yayınlansın ve `src/lib/content/manifest.ts`'e eklensin (calibrate sayfasının
  `hidden: true` deseni burada da uygun olabilir).
- Tool'ların kendi şemaları **kısa** kalsın: blok dizisini serbest ama zod ile
  doğrulanan bir yapı olarak al, her component tipini ayrı ayrı şemaya yazma.
  Hata mesajları öğretici olsun: geçersiz `type` → geçerli tiplerin listesi;
  eksik alan → hangi alan ve ne beklendiği.

## Eklenecek tool'lar

Mevcut desenlere birebir uy (`src/app/api/mcp/tools/write.ts`):
scope kontrolü (`ctx.scope !== 'write'` → `READ_ONLY_ERROR`), `contextRunId`
desteği ve `requireContext`, `logActivity` ile audit log, `outputSchema`,
`annotations`.

- **`create_dashboard`** — `title`, `parentId`/`parentRef`, `icon`/`iconColor`,
  `blocks`. Sidebar'da yeni bir dashboard öğesi yaratır.
- **`update_dashboard`** — id ile blok bazlı **yama**. `update_page`'in merge
  felsefesini izle: gönderilmeyen blok silinmez. Ayrı ve açık işlemler ver:
  blok ekle / belirli bloğu güncelle / belirli bloğu sil / sırayı değiştir.
  Tüm spec'i her seferinde yeniden göndermek zorunda bırakma — bu tam olarak
  token israfı demek.
- **Okuma:** `get_page` bir dashboard id'si ile çağrıldığında ne dönecek?
  Kararını ver: ya `get_page` dashboard'u spec olarak döndürsün (tercih edilen —
  yeni tool = yeni şema = yeni token), ya da ayrı bir okuma tool'u ekle ve
  gerekçelendir.
- **Silme:** mevcut `delete_page` yeterli olmalı (P6'da enum genişletmesi
  yapıldı). Doğrula; `confirm: true` önizleme semantiği korunmalı.

Her yazma sonrası: sidebar/veri değişiklik sinyalini tetikle (P1'de canlılık
mekanizması yenilendi — oradaki doğru yolu kullan, no-op `publish()` çağrısını
kopyalayıp geçme).

## Ajanın işini kolaylaştıran ayrıntılar

- **Şablonlar.** Katalogda 2-3 hazır dashboard iskeleti bulunsun (ör. "proje
  durumu", "backlog sağlığı"). Ajan sıfırdan kurmak yerine iskeleti alıp
  `databaseId`'leri doldursun; bu hem token hem kalite kazancı.
- **Kendi kendini doğrulama.** `create_dashboard` cevabı, bir blok veri
  kaynağıyla eşleşmiyorsa (boş sonuç, olmayan kolon) uyarı döndürsün. Ajan
  yarattığı ekranı görmüyor; tek geri bildirim kanalı bu cevap.
- **Deep link.** Cevapta dashboard'un uygulama içi URL'si dönsün ki ajan insana
  "şuraya bak" diyebilsin (`src/lib/mcp/deeplinks.ts` mevcut desene bak).

## İnsan tarafı düzenleme

P6'da minimumda bırakıldıysa burada tamamla: blok ekle/sil/sırala ve blok
ayarlarını düzenle. Ajanın yazdığını insanın düzeltebilmesi ürünün "birlikte
çalışma" iddiasının somut kısmı. Görsel dil workspace ile aynı: düz, çerçevesiz,
neutral palet.

## i18n

Kullanıcıya görünen her metin next-intl'den, **8 locale**. MCP tool açıklamaları
ve doküman içeriği İngilizce kalır.

## Doğrulama

1. `npm run lint -- <paths>`, `npx tsc --noEmit`.
2. **Gerçek bir MCP istemcisiyle uçtan uca test et.** Claude Code'da `/mcp` ile
   bağlantıyı yenile; bir dashboard yarat, bir blok ekle, bir blok güncelle, bir
   blok sil ve her adımdan sonra tarayıcıda sonucu gör. Yalnız unit seviyede
   doğrulama bu iş için yetersiz.
3. Token ölçümü: tipik bir dashboard'u yaratmanın kaç token tuttuğunu ölç ve
   raporla. ~500 token hedefinin üstündeyse şemayı sadeleştir.
4. Hata yollarını test et: geçersiz component tipi, olmayan `databaseId`, başka
   workspace'in database'i (reddedilmeli), read-scope token (reddedilmeli).

## Bitirirken

- `docs/mcp/dashboards.md` yaz, `docs/mcp/write-tools.md` + `read-tools.md` +
  `README.md` navigasyonunu güncelle, `src/lib/content/manifest.ts`'e ekle.
- `src/lib/changelog.ts` başına kayıt (kategori `new`), tek cümle, 8 locale.
- `AGENTS.md` + Serena memory güncelle.
- `scripts/ai/update-handoff.ps1`. Commit/push yok.
```

> **✅ Tamamlandı — 2026-09-23 (Claude).** Commit yok; değişiklikler working tree'de.
>
> **Koddan doğrulanıp prompttan sapan iddialar:** `src/lib/mcp/deeplinks.ts` uygulama-içi URL
> deseni içermiyor (yalnız editör bağlantı builder'ları) → deep link için `TokenContext.appOrigin`
> + `appUrl()` eklendi (`src/app/api/mcp/context.ts`, origin `runMcpRequest`'te istekten). P1'deki
> "doğru canlılık yolu" `workspace_items.updated_at` → `changeVersion`; `publish()` artık yok. P6'nın
> dashboards.md taslağı `WIKI_PAGES` dışındaydı → yeniden yazılıp **görünür** sayfa olarak eklendi.
> `schema.ts` **değiştirilmedi**.
>
> **Yapılanlar:** Tek yazma yolu `src/lib/services/dashboards.ts` (MCP + web aksiyonları): yalnız
> dokunulan bloklar doğrulanır, öğretici hatalar (geçersiz tip → geçerli tipler; bilinmeyen alan →
> tipin alanları; eksik alan → beklenen), isim→id normalizasyonu (kolon adı, select değeri harf
> düzeltme, database item id, view adı), ham spec metni üzerinde compare-and-swap, yazımdan sonra
> `resolveDashboard` ile `warnings`. MCP: `create_dashboard`, `update_dashboard` (add / update-merge /
> remove / order + başlık/ikon, hep-ya-hiç), `remnus://dashboard/catalog` resource'u (alan imzaları
> `z.toJSONSchema` ile zod'dan türetilir, 3 şablon: project-status, backlog-health, weekly-pulse).
> `get_page` dashboard'u `spec` nesnesi + `url` olarak döndürür (ayrı okuma tool'u yok), outline =
> blok listesi; `delete_page` değişmeden çalışıyor (önizleme/onay doğrulandı). İnsan tarafı: blok
> ekle + blok ayarlarını düzenle çekmecesi (`DashboardBlockEditor`), 8 locale. Dokümanlar, sayılar
> (27 tool / 7 resource), changelog, AGENTS.md, Serena `core`/`conventions` güncel.
>
> **Karar/sapmalar:** `create_dashboard`'da `parentRef` yok (ref'ler yalnız bulk çağrı içinde
> çözülür; `parentId` bir sayfa olmalı). Olmayan/başka workspace'in database'i → ret (aynı mesaj);
> kolon/değer sorunları ve boş sonuç → uyarı.
>
> **Doğrulama:** tsc + hedefli lint temiz. Gerçek HTTP MCP istemcisiyle (SDK Streamable HTTP, yerel
> PAT) yarat → ekle → güncelle → sil adımlarının her biri tarayıcıda canlı yenilemeyle görüldü
> (Playwright). Hata yolları: geçersiz tip, olmayan databaseId, başka workspace'in database'i,
> read-scope token — hepsi reddedildi. 6 eşzamanlı yama kayıpsız. Token (bytes/4): tipik 6 bloklu
> dashboard ≈ 1.086 B ≈ **272 token**; iki tool write-scope oturuma ≈ 555 token ekler, read-scope'a 0;
> katalog ≈ 1.540 token ve yalnız dashboard kuran oturum okur. Claude Code `/mcp` ile canlı bağlantı
> bu oturumda mümkün değildi (remnus MCP bağlı değil); yerine aynı SDK istemcisi gerçek HTTP'yle
> kullanıldı. Yerel test verisi temizlendi. Turso'ya `0050` migration'ı hâlâ uygulanmadı (P6'dan).

---

# P8 — Calibrate v2: başkalarının onboarding tasarımından öğrenmek

> İstek 5. P3, P4, P6, P7 sonrası — çünkü calibrate artık hızlı bulk, yerel
> harita ve dashboard önerebilir hale gelmiş olacak.

```text
Remnus projesinde çalışıyorsun. Bu görev ağırlıklı olarak **tasarım ve metin**
işi, kod işi değil — ama çıktısı ürünün en kritik akışını belirliyor.

Önce oku: `AI.md`, `docs/mcp/calibrate.md` (mevcut hali),
`docs/mcp/project-install.md`, `cli/templates/agents-section.md`,
`AGENTS.md` → "Project Install". `git status --short` ile başla.

## Bağlam

`npx remnus init` bir projeyi bir Remnus workspace'ine bağlıyor. Sonra ajan
`/wiki/calibrate` adresindeki rehberi çekip workspace'i o projeye göre kuruyor:
projeyi okuyor, kavramları modelliyor, sayfa ve database'leri yaratıyor. Rehber
canlı sunuluyor (projeye kopyalanmıyor), yani iyileştirmeler anında herkese
gidiyor.

Mevcut rehber fena değil ama tek bir ajanın tek seferlik yazımı. Bu görevde onu,
bu işi zaten çözmüş sistemlerden öğrenerek yeniden tasarlayacaksın.

## Faz 1 — Araştırma (atlamadan yap, bulgularını raporla)

Aşağıdaki sistemlerin **onboarding / bağlam kurma** tasarımlarını incele. Her
biri için şu soruyu yanıtla: *ajanı neye zorluyor, neyi yasaklıyor, çıktının
kalitesini nasıl garanti altına alıyor?*

- **Serena MCP** — bu repoda `.serena/memories/` zaten var; onboarding ve memory
  yazma prompt'larını incele. Serena araçları oturumunda mevcutsa
  `initial_instructions`'ı çağırıp gerçek metni oku. Değilse projedeki
  memory dosyalarının yapısından ters mühendislik yap.
- **Bu repodaki `skills/remnus/`** ve `claude-project-onboarding` skill'i.
- **Claude Code `/init`** akışı — CLAUDE.md üretirken neyi okuyor, neyi yazmıyor.
- **"Memory bank" deseni** (Cline/Roo tarzı): kalıcı dosya seti, her oturumda
  okunma sözleşmesi, güncelleme tetikleyicileri.
- **Aider'ın repo-map** yaklaşımı: bütün kod tabanını okumadan yapı çıkarmak.
- **AGENTS.md sözleşmesi** ve Cursor rules gibi ajan talimat formatları.

Web erişimin varsa güncel kaynaklara bak; yoksa yerelde bulabildiklerinle çalış
ve neyi doğrulayamadığını açıkça yaz. **Uydurma kaynak gösterme.**

Aradığın kalıplar özellikle şunlar:
- Ajanı "dosya kopyalamak" yerine "model kurmaya" iten mekanizmalar.
- Kısmi ilerlemenin kaydedilmesi (oturum yarıda kesilirse ne oluyor).
- Kendi kendini denetleme / çıktı kalite kapıları.
- İnsana ne zaman soruluyor, ne zaman sorulmuyor.
- Rehberin kendi token maliyetinin nasıl sınırlandığı.

## Faz 2 — `docs/mcp/calibrate.md`'yi yeniden yaz

Mevcut rehberin güçlü yanlarını **koru**: "filing clerk değil, product manager"
çerçevesi; process/domain kavram ayrımı (2a/2b); page-vs-database kararı;
"her şey okuduğun bir şeye dayanmalı" kuralı; ağaç yapısının planlanması; ikon ve
view zorunlulukları.

Ekleyeceklerin (araştırmanın desteklediği kadarıyla — her ekleme bir davranış
değiştirmeli):

1. **Ölçülebilir bir tamamlanma tanımı.** "Yeterince yaptım" kararı şu an ajanın
   sezgisine bırakılmış. Somut bir öz-denetim listesi ver: ağacın kök seviyesi
   okunabilir mi, her database'in gerçek satırları ve doğru view'ları var mı,
   her satırın gövdesi başlığından fazlasını söylüyor mu, hiçbir şey uydurulmadı mı.
2. **Kesilme/devam etme.** Uzun bir calibrate oturumu bölünebilir. Ajan
   ilerlemesini nereye yazacak? Öneri: workspace'in kendi içinde bir
   "Calibration Log" kaydı — ürünün kendi vaadini kendi kurulumunda kullanmak
   hem doğru hem gösterişli. `.remnus/config.json`'a `calibratedAt` ve rehber
   sürümü eklemeyi de değerlendir (şu an yalnız `calibrated: true` var).
3. **Ne yapılmayacağı listesi.** Şablon doldurma, tek sayfaya duvar gibi metin
   yapıştırma, boş "Backlog" database'i açma, README'yi kopyalama. Mevcut metin
   bunları dağınık şekilde söylüyor; tek ve net bir "bunları yaparsan calibrate
   başarısızdır" listesi daha etkili.
4. **Yeni yeteneklerin kullanımı** (önceki görevlerde geldiler):
   - Hızlanan bulk yazma → "her database'in satırlarını tek çağrıda yaz".
   - Dashboard sayfa tipi → "proje için bir durum ekranı kur"; hangi projede
     hangi dashboard anlamlı, kısa ve somut anlat.
   - Yerel workspace haritası → calibrate bitince tazelensin.
   - **Knowledge metadata (2026-09-23 eki).** Kavram sayfaları yaratılırken
     write tool'larının `knowledge` alanı (`KNOWLEDGE_INPUT`,
     `src/app/api/mcp/tools/write.ts`) doldurulsun: `tags` (workspace'in
     dilinde **ve** İngilizce teknik karşılığı — ör. "davet", "invitation"),
     `sources` (kavramın dayandığı depo-göreli dosya yolları — ör.
     `src/auth.ts`), `conceptType`. Bugün yerel DB'de `knowledge_metadata`
     **0 satır**. P10 (bulma — etiketler `prepare_context`'te 2.5× ağırlıklı),
     P12 (graph etiket katmanı) ve P13 (sayfa ↔ kod dosyası) bu alanlardan
     beslenir. Rehber maliyetini gözet: tek kısa kural + bir örnek yeter.
5. **Rehberin kendi maliyeti.** Metni yazdıktan sonra token olarak ölç ve
   raporla. Mevcut rehber ~3000 token civarında; yeni hali bunu **çok**
   aşmamalı. Uzunluk kaliteyi garanti etmiyor; her paragrafın ajanın davranışını
   değiştirdiğinden emin ol, yoksa sil.
6. **Dil.** Rehber İngilizce kalır (her dilde ajan okuyor) ama kısa ve
   emir kipinde olsun.

## Faz 3 — Akışın kendisi

Sadece metin değil, akış da gözden geçirilsin:

- `cli/templates/agents-section.md` bloğu ile calibrate rehberi tutarlı mı?
  İkisi de ajana "önce şunu yap" diyor; çelişiyorlarsa ajan ikisini de zayıf
  uygular.
- `npx remnus init` çıktısı calibrate'i yeterince net öneriyor mu?
- Ajanın MCP tool'larını henüz göremediği "init'ten hemen sonra" durumu rehberde
  ele alınmış — koru ve öne al.
- Kalibre edilmiş bir workspace'e **ikinci kez** calibrate çalıştırılırsa ne
  oluyor? Rehber "adapt, don't duplicate" diyor ama bu zayıf bir güvence.
  Somutlaştır.

## Kapsam dışı

Proje tipine özel playbook'lar — o ayrı bir görev (P9). Burada yalnız o
playbook'lara bağlanacak **kancayı** hazırla: rehberde "projenin tipine uygun
playbook varsa onu da oku" adımı ve boş bir indeks yeri.

## Doğrulama

1. Dokümantasyon değişikliği olsa bile: `npm run lint -- <paths>` ve
   `npx tsc --noEmit` (manifest'e dokunduysan gerekiyor).
2. `/wiki/calibrate` sayfasını dev server'da aç ve render'ı gör.
3. **Rehberi kendin uygula.** Küçük bir örnek proje seç (bu repo olmaz — kendi
   kendini kalibre etmek dürüst bir test değil) ve rehberi adım adım okuyarak
   hangi noktada tereddüt ettiğini not al. Tereddüt ettiğin her yer rehberdeki
   bir boşluktur. Gerçekten yazma yapmana gerek yok; kafada yürütüp boşlukları
   raporlaman yeterli, ama bunu gerçekten yap.

## Bitirirken

- Rehber kullanıcıya görünen bir ürün yüzeyi → `src/lib/changelog.ts` başına
  kayıt (kategori `improved`), tek cümle, 8 locale.
- `AGENTS.md` + Serena memory: calibrate akışının yeni sözleşmesi kalıcı bilgi.
- `.remnus/config.json` şeması değiştiyse `cli/` tarafını ve
  `docs/mcp/project-install.md` tablosunu birlikte güncelle.
- `scripts/ai/update-handoff.ps1`. Commit/push yok.
```

> **✅ Tamamlandı — 2026-09-23** (P9 ile aynı oturumda). Ayrıntılı özet P9'un sonundaki
> notta.

---

# P9 — Proje tipine özel calibrate playbook'ları

> İstek 3. P8'in bıraktığı kancaya takılır.

```text
Remnus projesinde çalışıyorsun. Önce `AI.md`, `docs/mcp/calibrate.md` (P8'de
yenilendi), `src/lib/content/manifest.ts` ve `docs/mcp/README.md` dosyalarını oku.
`git status --short` ile başla.

## Amaç

Calibrate rehberi bilinçli olarak genel: her projeye uyan bir düşünme çerçevesi
veriyor. Ama bir oyun projesiyle bir API servisinin workspace'i birbirine
benzemez. Bu görevde, **proje tipine özel playbook'lar** ekleyeceksin: ajan
projeyi tanıdıktan sonra ilgili playbook'u okuyup o alana özgü database'leri,
şemaları ve dashboard'ları kuracak.

## Yapı

- Dosyalar: `docs/mcp/playbooks/<tip>.md`.
- Bir indeks sayfası: `docs/mcp/playbooks.md` — hangi playbook'un ne zaman
  seçileceğini anlatır.
- `src/lib/content/manifest.ts`'e ekle. Calibrate sayfası `hidden: true` ile
  yayınlanıyor (insan için gezilecek değil, ajan tarafından çekilecek sayfa);
  playbook'lar için de aynı deseni değerlendir — ama indeks sayfası insanlar
  için görünür olabilir, çünkü "Remnus benim proje tipimde ne yapar?" sorusunun
  cevabı iyi bir pazarlama yüzeyi. Kararını gerekçelendir.
- Canlı sunum ilkesini koru: playbook'lar projeye kopyalanmaz, URL ile çekilir.

## Kaç tane, hangileri

**4-6 gerçek playbook ile başla, 12 yüzeysel playbook ile değil.** Önerilen
başlangıç (kanıtın varsa değiştir):

1. **Web uygulaması / SaaS ürünü**
2. **API / backend servisi**
3. **Oyun projesi**
4. **Veri / ML projesi**
5. **Kütüphane / SDK**
6. **Mobil uygulama** (opsiyonel, ilk turda atlanabilir)

## Her playbook'un içeriği (sabit iskelet)

1. **Tanıma sinyalleri** — bu playbook ne zaman seçilir. Somut olsun: manifest
   bağımlılıkları, dizin isimleri, dosya uzantıları, config dosyaları. "Oyun
   gibi görünüyorsa" değil, "`Assets/`, `*.unity`, `project.godot`, `Cargo.toml`
   içinde bevy" düzeyinde.
2. **Modellenecek kavramlar** — bu alanda gerçekten takip edilen şeyler ve her
   biri için **kolonlarıyla birlikte** önerilen database şeması. Oyun için
   düşman/bölge/item/denge parametreleri; API için endpoint envanteri, şema
   sürümleri, veri kalitesi sorunları; SaaS için roadmap, deney/feature flag,
   müşteri geri bildirimi. Generic "Title/Status/Priority" şablonu yapıştırma.
3. **Örnek satırlar** — her database için 1-2 gerçekçi satır, gövdesiyle birlikte.
   Ajan bir satırın ne kadar dolu olması gerektiğini örnekten öğreniyor.
4. **Önerilen dashboard** — P6/P7'deki component kataloğundan kurulmuş, o alana
   uygun bir durum ekranı. Blokları somut yaz.
5. **Bu tipte yapılmayacaklar** — o alana özgü tipik hata. Örn. oyun projesinde
   tüm asset listesini içe aktarmak; API projesinde OpenAPI dosyasını sayfaya
   yapıştırmak.
6. **Yine de kanıt kuralı** — playbook bir şablon değil, bir ipucu listesi.
   Kodda karşılığı olmayan bir database açılmaz. Bu cümle her playbook'ta olmalı,
   yoksa playbook'lar tam da calibrate'in engellemeye çalıştığı şablon doldurmayı
   geri getirir.

## Seçim mantığı

- Calibrate rehberine seçim adımını yaz: proje tanındıktan sonra **en fazla iki**
  playbook okunur. Hiçbiri uymuyorsa hiçbiri okunmaz ve genel akış devam eder —
  "en yakınını seç" yanlış cevap.
- Monorepo / karma projeler: birden çok playbook'un parçalarını birleştirmek
  meşru; bunu açıkça yaz.
- Token maliyeti: her playbook'un boyutunu ölç ve raporla. Bir playbook
  ~800-1200 token'ı aşıyorsa fazla anlatıyordur.

## Doğrulama

1. `npm run lint -- <paths>`, `npx tsc --noEmit` (manifest'e dokunuluyor).
2. Dev server'da `/wiki/playbooks` ve her playbook sayfasını aç; render, navigasyon
   ve `hidden` davranışı doğru mu?
3. Her playbook için sağlama: önerdiğin şemayı Remnus gerçekten destekliyor mu?
   `src/lib/templates.ts` içindeki `SchemaColumn` tiplerine bak — desteklenmeyen
   bir kolon tipi öneren playbook, ajanı başarısız bir tool çağrısına sürükler.
4. Önerdiğin dashboard blokları P6'daki katalogda gerçekten var mı? Uydurma blok
   tipi yazma.

## Bitirirken

- İndeks sayfası insanlara görünür yapıldıysa bu kullanıcıya görünen bir
  değişiklik → `src/lib/changelog.ts` başına kayıt, tek cümle, 8 locale.
- `docs/mcp/README.md` navigasyonunu ve calibrate'ten playbook'lara giden
  bağlantıyı güncelle.
- `AGENTS.md` + Serena memory: playbook sisteminin yeri ve genişletme kuralı.
- `scripts/ai/update-handoff.ps1`. Commit/push yok.
```

> **✅ P8 + P9 tamamlandı — 2026-09-23** (tek oturum, commit yok). Gerçekte yapılanlar:
>
> - **Araştırma:** Serena'nın gerçek prompt'ları yerel uv önbelleğinden okundu (0.1.4:
>   onboarding + `think_about_*` öz-denetim + `prepare_for_new_conversation`; 1.3.1'de yalnız
>   onboarding kalmış). Ayrıca yerel `claude-project-onboarding` skill'i, `skills/remnus/SKILL.md`;
>   web'den Cline Memory Bank, Aider repo-map (`--map-tokens`, varsayılan 1k), Claude Code
>   memory/`/init` dokümanı, agents.md, Cursor rules. Claude Code `/init`'in iç prompt metni
>   doğrulanamadı; yalnız dokümandaki davranışı kullanıldı.
> - **Rehber v2** (`docs/mcp/calibrate.md`, "Guide version: 2"): 16,2 KB ≈ 4.055 token →
>   12,0 KB ≈ 3.000 token. Eklenenler: araç-yok durumu en başta, "şunu yaparsan başarısız"
>   listesi, workspace'te **Calibration Log** (kurmadan önce plan, işaretli adım listesi =
>   kesilince devam noktası), playbook kancası, `knowledge` etiket kuralı + örnek, dashboard
>   kuralı, 7 maddelik ölçülebilir bitiş kontrolü, insana ne zaman sorulacağı, "Running it
>   again" (yalnız genişlet; üzerine yazma/silme yok; log yoksa v1). Strict mod için
>   `CONTEXT_REQUIRED` notu eklendi.
> - **Kod doğrulaması sonucu küçük kod değişikliği:** `knowledge` alanı `bulk_create_pages`'te
>   yoktu (rehber satırları bulk ile yazdırıyor, `prepare_context` etiketleri satır bazında
>   puanlıyor). Bulk girdisine alt küme eklendi (`conceptType`/`tags`/`sources`); maliyet
>   write oturumlarında ≈ +92 token. Ayrıca `rewriteLinks` alt klasör linklerini çözüyor.
>   `search_workspace` etiketleri okumuyor — rehber buna göre yazıldı.
> - **Akış:** `agents-section.md` yarım kalmış logu devam ettirir; `init` çıktısı ajana
>   yapıştırılacak cümleyi veriyor; `.remnus/config.json`'a ajanın yazdığı `calibratedAt` +
>   `calibrationGuide` (CLI şeması değişmedi, `sync` alanları koruyor); project-install /
>   project-join güncellendi.
> - **Playbook'lar:** indeks `/wiki/playbooks` (görünür, sitemap'te) + web-app, api-service,
>   game (mod/sunucu eklentisi dahil), data-ml, library-sdk (`hidden`); her biri 707–896
>   token. Mobil ilk turda bilinçli atlandı. Kolon tipleri `SchemaColumn`'dan, dashboard
>   blokları katalogdan doğrulandı.
> - **Rehberi uygulama testi:** `Skyblock-Quests` (Hytale modu) üzerinde salt-okuma kuru
>   çalıştırma → 4 boşluk bulundu ve kapatıldı (agent dosyaları `.serena/.clinerules`,
>   dil seçimi, fix commit = gotcha, mod'lar için oyun sinyalleri + Quests kavramı).
> - Changelog 2 kayıt (8 locale), `AGENTS.md` Project Install §7, Serena `core`/`conventions`.
>   Doğrulama: tsc temiz, eslint 0 hata, bench ölçümü, yerel DB'de MCP uçtan uca test
>   (temizlendi), dev server'da tüm sayfalar/linkler. Açık kalan: yeni CLI sürümü yayınlanmadan
>   `agents-section`/`init` metni projelere ulaşmaz.

---

# P9.5 — Kalibrasyon saha testi (+ rehberin ham markdown adresi, tasarruf kartı)

> 2026-09-23'te P8/P9 oturumundan ertelendi (kullanım limiti). **P10'dan önce yap:**
> P10 etiketli gerçek veriyle ölçülmeli, P13 de calibrate'in yazdığı `sources`'a
> dayanıyor. Bu oturumda sen (Hakan) de bulunmalısın: tarayıcıda giriş ve ikinci bir
> Claude Code oturumu açmak gerekiyor.

```text
Remnus projesinde çalışıyorsun. Önce `AI.md`, `docs/mcp/calibrate.md`,
`docs/mcp/playbooks.md` ve `AGENTS.md` → "Project Install" §7'yi oku.
`git status --short` ile başla. Amaç: P8'in calibrate rehberini gerçek, bağımsız bir
ajanla denemek ve bulduğun her boşluğu rehberde kapatmak.

## Adım 0 — Rehberin ham markdown adresi (önce bunu yap)

2026-09-23 ölçümü: `/wiki/calibrate` sayfası 229 KB HTML (~57k token), rehberin
kendisi 12 KB markdown (~3k token). Ajan sayfayı `curl` ile çekerse 19 kat öder;
WebFetch ile çekerse küçük bir modelin ÖZETİNİ görür ve kurallar düşebilir.
- Her wiki sayfasını ham markdown olarak da sun: `/wiki/<slug>.md` (text/markdown,
  manifest'teki dosyanın kendisi). `/llms.txt`'deki rewrite + iki katmanlı public
  allowlist desenini kullan (`next.config.ts` rewrite, `proxy.ts` matcher istisnası,
  `auth.config.ts`). Gizli sayfalar da (calibrate, playbook'lar) bu adresten gelmeli.
- `cli/src/commands/init.js` `calibrateUrl`'i, `calibrate.md`'deki playbook linkini
  ve `playbooks.md`'deki linkleri bu adrese çevirmeyi değerlendir (GitHub'da da
  çalışmaya devam etmeli). `project-install.md` ve AGENTS.md §7'yi güncelle.

## Adım 1 — Test ortamı (asıl projeye dokunma)

1. Dev server'ı yerel DB ile başlat (`.env.local` → `file:local.db`).
2. Projeyi kopyala, asıl klasörü asla değiştirme:
   `git clone D:\Workspace\GitHub\Skyblock-Quests <scratchpad>\sq-test`
   (Hytale modu: Türkçe commit/arayüz + İngilizce kod → Türkçe+İngilizce etiket
   testi için ideal; P8'de kuru çalıştırması yapıldı).
3. Kopyada: `node D:\Workspace\GitHub\remnus-app\cli\bin\remnus.js init --server http://localhost:3000`
   → Hakan tarayıcıda yerel hesabıyla girer, **yeni** bir workspace seçer.
   Bu, `init` akışını ve yapıştırılacak cümleyi de test eder.

## Adım 2 — Bağımsız ajanla kalibrasyon

Kopya klasörde **yeni** bir Claude Code oturumu aç (MCP araçları ancak böyle yüklenir)
ve yalnızca `init`'in yazdırdığı cümleyi ver. Müdahale etme; gözlemle:
- Rehberi nasıl çekti, kaç token harcadı (Adım 0 sonrası `.md` adresini mi kullandı)?
- Calibration Log'u her şeyden önce açtı mı, planı kurmadan önce yazdı mı?
- Hangi playbook'u seçti (beklenen: Game, mod sinyaliyle)? Kanıtsız bir şey kurdu mu?
- Satırları tek `bulk_create_pages` ile ve `knowledge` etiketleriyle mi yazdı?
- Bitiş kontrolünü (Faz 4, 7 madde) gerçekten yaptı mı? `config.json`'a
  `calibratedAt` + `calibrationGuide` yazdı mı?
Bir kez de oturumu yarıda kesip yeni oturumda devam ettir: logdan devam ediyor mu?

## Adım 3 — Ölç ve düzelt

- `knowledge_metadata`'da etiket/kaynaklı satır sayısı (P10/P13 bu sayıya bakacak).
- Ajanın takıldığı her yer rehberde bir boşluktur → `calibrate.md` / playbook'u
  düzelt; davranış değiştiyse `Guide version`'ı artır ve "Running it again" 2. adımına
  yaz. Rehber ~3k tokenı çok aşmasın.
- **Tasarruf kartı (P5'ten kalan, Hakan Playwright'ı onayladı):** bu gerçek ajan
  çağrılarından sonra AI Agents penceresindeki kartı (`AgentSavingsCard`) Playwright ile
  aç; `savedBytes = 0` iken kartın hiç görünmemesi beklenen davranış.

## Kapsam dışı

Bu repo üzerinde kalibrasyon (kendini kalibre etmek dürüst bir test değil).

## Bitirirken

- Kullanıcıya görünen bir değişiklik olduysa (`.md` adresi) `src/lib/changelog.ts`, 8 locale.
- `AGENTS.md` §7 + Serena memory, `scripts/ai/update-handoff.ps1`. Commit/push yok.
- Test workspace'ini ve kopya klasörü sil (yerel), `.ai/CURRENT_TASK.md`'yi güncelle.
```

> **✅ Tamamlandı — 2026-09-23 (Claude).** Commit yok; değişiklikler working tree'de.
>
> **Adım 0 — ham markdown.** Her wiki sayfası `/wiki/<slug>.md` (ve `/wiki.md`) olarak da
> sunuluyor: `src/app/api/wiki-md/[[...slug]]/route.ts` (`getWikiMarkdown`), `next.config.ts`
> rewrite, `proxy.ts` matcher istisnası (**zorunlu** — yoksa intl middleware `/<locale>/wiki/x.md`
> yapıp 404 veriyor; `/wiki` zaten `auth.config.ts`'te public), `auth.config.ts` allowlist.
> Göreli `.md` linkler ham çıktıda `/wiki/x.md` oluyor, kaynak dosyalar değişmedi (GitHub'da
> çalışıyor). HTML sayfa `<link rel="alternate" type="text/markdown">` veriyor, `/llms.txt` bir
> cümleyle söylüyor, ham yanıtta `Link: rel=canonical`. `init` artık `.md` adresini basıyor
> (`calibrateUrlFor` yoklayıp eski sunucuda `/wiki/calibrate`'e düşüyor) + "(read the whole
> file, e.g. with curl)". Ölçüm: calibrate 229.825 B HTML → 12.096 B md; ajanın çektiği üç
> sayfa (calibrate + playbooks + game) ≈ 18,5 KB ≈ 4,6k tok (HTML ≈ 640 KB ≈ 160k tok olurdu).
>
> **Adım 1–2 — saha testi.** Skyblock-Quests scratchpad'e clone'landı, yerel CLI ile `init`
> (Hakan tarayıcıdan yeni workspace "Speed-Test" açtı). npm'de 0.1.9 yok (0.1.8), bu yüzden
> kopyada `.mcp.json` + hook yerel CLI'a yönlendirildi. Ajan = bağımsız headless `claude -p`
> (Opus 5, dar allowlist, `--strict-mcp-config`), yalnızca init cümlesiyle. 3 oturum:
> (1) tam kalibrasyon, Faz 4'te PID ile kesildi; (2) yeni oturum, aynı cümle → devam
> ($1,43, 29 tur); (3) rehber v3 sonrası "Running it again" doğrulaması ($4,41, 50 tur).
> Gözlemler: rehberi `curl` ile `.md`'den çekti (3. oturum önce WebFetch denedi — https'de özet
> görecekti → cümleye "read whole" eklendi); log'u Faz 1'den sonra açtı, plan build'den önce
> yazıldı ✓; Game playbook'unu mod sinyaliyle seçti, diğerlerini okumadı ✓; düşman/bölge/denge
> gibi kanıtsız kavramları log'da gerekçeyle atladı ✓; satırlar 4 `bulk_create_pages` ile,
> `knowledge` etiketli ✓; dashboard 10 blok ✓; `calibratedAt` + `calibrationGuide` yazıldı ✓.
> Devam testi: log "yalnızca adım 1" derken map her şeyi gösteriyordu; ajan yeniden kurmadı,
> doğruladı — ama bu modelin sağduyusu, v2 rehberi tersini söylüyordu.
>
> **Adım 3 — bulunan boşluklar ve düzeltmeler.**
> - İlk log bütün adımlar `[x]` + **uydurma id'lerle** yazıldı, sonra düzeltildi; build boyunca
>   hiç işaretlenmedi → rehber: işaretsiz oluştur, her adımı inince işaretle, id yalnızca tool
>   sonucundan; devam ederken işaretsiz adımı önce map'le karşılaştır. (v3 re-run'da log
>   işaretsiz açıldı, id'ler gerçek; ama adımlar yine en sonda topluca işaretlendi — kalan davranış.)
> - **Sunucu hatası:** status seçenekleri `{name, group}` gelince `"[object Object]"` olarak
>   kaydediliyordu; ajan kolonları `confirm: true` ile silip yeniden kurdu. `autoColorOptions`
>   artık `value|name|label` okuyor, grup alias'ları (`to do`/`in progress`/`done`) kabul ediyor,
>   metinsiz seçenek / bilinmeyen grupta kolonu adlandıran hata fırlatıyor (MCP ile doğrulandı).
> - **29 `[[Başlık]]` sahte link, 13 gövdede; `page_links` = 0** (P13'ün grafiği boş kalırdı) →
>   rehber, `write-tools.md` ve skill artık `<a data-page-link href="/page/<id>">` biçimini veriyor;
>   pano için düz `[Başlık](/dashboard/<id>)`. v3 re-run: 29 → 29 gerçek link, `page_links` 0 → 23.
> - `lucide:BookOpen` küratörlü değil → rehber: küratörlü set, emoji her zaman geçer.
> - `npx remnus sync` yayındaki 0.1.8'de yok → Faz 4 artık köprünün her yazımdan sonra yenilediği
>   map'i okuyor. Ajan ayrıca map'in `trackMap: false` yüzünden tazelenmediğini sandı (yanlış).
> - **Digest/map sırası id'ye göreydi** (her öğe `sortOrder: 0`), kenar çubuğu `createdAt`'e göre →
>   map'te Genel Bakış ilk değildi, "overview first" kontrolü güvenilmezdi. Digest artık
>   `sortOrder, createdAt, id` (kenar çubuğuyla aynı).
> - Proje penceresinde `OnboardingGuide` → `getOnboardingProgress` → `getCurrentUser()` her sayfa
>   yüklemesinde 500 veriyordu → pencerede JSX'ten çıkarıldı (§4 listesine eklendi).
> - Rehber `Guide version: 3`; "Running it again" 2. adım v3'ü (`[[…]]` → link, gövdede izin
>   verilen tek düzenleme) anlatıyor. 13.162 B ≈ 3.290 tok (v2: 12.090 B ≈ 3.020).
>
> **Etiket sayısı (P10/P13 için).** Silmeden önce test workspace'inde: `knowledge_metadata`
> 47 satır, 46'sı `conceptType` + `tags` (TR+EN) + `sources` taşıyor (39/39 satır, 4/4 DB,
> 3/4 sayfa — etiketsiz olan Calibration Log). Kavramlar: action-type 14, decision 11, gotcha 9,
> backlog 9, overview/architecture/data-format 1'er. Bu workspace talimat gereği **silindi**;
> P10 gerçek etiketli veri isterse aynı düzen ~15 dk'da yeniden kurulur: clone → yerel CLI `init`
> → kopyada `.mcp.json`/hook'u yerel CLI'a çevir → `claude -p "<init cümlesi>" --mcp-config
> .mcp.json --strict-mcp-config --permission-mode acceptEdits --allowedTools …`.
>
> **Tasarruf kartı.** Pencere bileti (proje PAT'i) ile Playwright'ta proje penceresi açıldı:
> kart görünüyor — "311,5 B token tasarrufu · 76 yazıldı · 25 ms" (≈1,25 MB digest tasarrufu /4).
> `savedBytes = 0` iken gizlenmesi koddaki `savedBytes <= 0 → null` ile tutarlı.
>
> **Doğrulama.** `npx tsc --noEmit` temiz; değişen kaynaklarda eslint 0 hata; `node --check`
> init.js; dev server'da `.md` route'ları 200/404, HTML sayfalar ve korumalı rotalar değişmedi;
> `bench:mcp-budget` model-görünür 24.301 → 24.341 B. Changelog: `wiki-markdown`,
> `agent-status-options` (fixed), `calibration-links`, 8 locale. Temizlik: test workspace (+token,
> audit satırları), kopya klasör, pencere profili ve Playwright artıkları silindi; asıl
> Skyblock-Quests klasörü hiç değişmedi.
>
> **Deploy notu:** CLI 0.1.9 web deploy'undan sonra yayınlanmalı (`.md` route'u ve `sync` onda).

---

# P10 — Bulma temeli: harf katlama, `keywords`, tek turda corpus, FTS5 arama

> 2026-09-23 araştırmasından ("Jev MCP'yi hızlandırır mı?" → "önce bulma
> katmanı"). Tahmini kapsam: orta-büyük, backend. Dış servis ve paket yok.
> P8'in calibrate'e eklediği `knowledge` metadata'sı bu işin etkisini büyütür.

````text
Remnus projesinde çalışıyorsun. Önce `AI.md`'yi, `AGENTS.md` içindeki "Database
Tables", "Performance Rules" ve "Critical conventions" bölümlerini, ayrıca
`docs/mcp/context-first.md` ile `docs/mcp/read-tools.md` dosyalarını oku. Serena
varsa `core` + `conventions` memory'lerini oku. `git status --short` ile başla.

## Neden bu iş var

2026-09-23'te "Jev gibi hızlı bir karar modeli (TypeSafe AI) MCP'yi hızlandırır
mı?" sorusu araştırıldı. Sonuç: Jev yalnızca önüne konan adayları sıralar; bizim
sorunumuz sıralama değil **bulma**. Karar: Jev şimdilik yok (bkz. dosyanın
sonundaki "Ertelenen — Jev" notu); önce bu görev, sonra anlamsal bulma (P11).

## Doğrulanmış bulgular (2026-09-23 — uygulamadan önce koddan tekrar doğrula)

1. **`prepare_context` yalnız sözcük eşleşmesiyle çalışıyor.**
   `src/lib/services/contextPack.ts` → `tokenize` + `rankCorpus`. `bench:context`
   fixture'ının kopyasıyla denendi: İngilizce görev bulundu; "Davetlere
   görüntüleyici rolü ekle", "Abonelik koltuk limitlerini uygula", "Kullanıcı
   oturum açma güvenliğini düzelt" → **0 kavram**; "Stop sending mail to people
   who opted out" → 0 ("mail" ile "email" `termFrequency`'nin önek kuralına
   takılmıyor).
2. **`tokenize` İngilizce büyük "I" harfini bozuyor.** `toLocaleLowerCase('tr-TR')`
   "Invites" → "ınvites", "API" → "apı", "Integration" → "ıntegration" yapıyor
   (noktasız ı). Görevde küçük harfle "invites"/"api" yazılırsa **eşleşmiyor** —
   İngilizce bir workspace'te "I" harfi içeren her büyük harfli başlık bugün
   kısmen kör.
3. **`listKnowledgeCorpus` (`src/lib/services/knowledge.ts` ~426) her
   `prepare_context` çağrısında workspace'in tüm sayfa + satır gövdelerini 4
   sıralı sorguyla çekiyor**, sonra `rankCorpus` tüm corpus'u her seferinde
   yeniden tokenize ediyor. Diğer çağıran: `src/lib/okf/workspaceSnapshot.ts`.
   MCP fonksiyonu `vercel.json`'da 256 MB bellekle sınırlı.
4. **`searchWorkspace` (`src/lib/services/workspace.ts` ~190) `LIKE '%q%'`
   kullanıyor.** SQLite `LIKE` yalnız ASCII'de büyük/küçük harf katlıyor —
   doğrulandı: "çözüm" → "Çözüm Notları"nı, "istanbul" → "İstanbul Ofisi"ni
   **bulmuyor**. Sıralama yok (`sortOrder`), tam tarama. Kullanıcıları yalnız
   MCP: `tools/read.ts` (`search_workspace`) ve `prompts.ts` (2 yer). Web
   uygulamasında global arama yok.
5. **FTS5 yerelde çalışıyor.** `@libsql/client` 0.17.3 / SQLite 3.45.1, bellek
   içi DB: `tokenize="unicode61 remove_diacritics 2"` ile "çözüm"/"cozum"/
   "ÇÖZÜM" ve "istanbul"/"İstanbul" eşleşti, önek (`guven*`) çalıştı,
   parametreli `batch` insert ve trigger ile senkron çalıştı.
   **Turso'da doğrulanmadı:** Turso dokümanı FTS5'in libSQL veritabanlarında
   yerleşik olduğunu söylüyor, ama (a) `tursodatabase/libsql#1811` (açık): TS
   istemcisi FTS5 tablosuna batch insert'te panic — uzak DB'de raporlanmış;
   (b) yeni `tursodb` (MVCC) veritabanları FTS index modüllerini desteklemiyor.
   Prod veritabanının hangi motor olduğunu Hakan'dan/Turso panelinden doğrula
   (`.env`'yi okuma).
6. **Change-version knowledge tablolarını izlemiyor.**
   `src/lib/services/changeVersion.ts` item/sayfa/database/satır/tombstone
   maksimumlarından hesaplanıyor; `knowledge_metadata` ve `knowledge_reviews`
   dahil değil. Bir insanın "reviewed" işaretlemesi cursor'ı oynatmaz.

## Kural: önce ölç

Scratchpad'e (repo'ya değil) ölçüm yaz, **yalnız `file:local.db`** ile
(`DATABASE_URL="file:local.db"`; `@/db` import eden script'te ilk import
`dotenv/config`; hedefi ekrana yazdır):
- Bulma kalitesi: `bench:context`'i genişlet (E) ve öncesi/sonrası isabet
  tablosu üret.
- Hız: 1.000 sayfa + 2.000 satırlık sentetik bir workspace'te `prepare_context`
  ve `search_workspace` için round-trip sayısı ve ms. Sentetik veriyi yalnız
  yerel DB'ye yaz, iş bitince sil.

## Yapılacak iş

### A. Harf katlamayı düzelt (en küçük, en yüksek getirili)

Tek bir `foldText()` yardımcı fonksiyonu yaz ve **hem görev hem corpus** için
kullan: dilden bağımsız küçük harf, NFKD + birleşik işaretleri at (`\p{M}`),
`ı`→`i`. Böylece "Çözüm"≡"cozum", "Invites"≡"invites", "İstanbul"≡"istanbul".
FTS5'in `remove_diacritics 2` katlamasıyla aynı sonucu hedefle ki iki katman
aynı şeyi eşleştirsin. `STOP_WORDS`'ü de bu katlamadan geçir ("için"/"icin"
ikilisi gereksizleşir).

### B. Ajan tarafı sorgu genişletme (`keywords`)

Çağıran ajan zaten güçlü bir LLM; eşanlamlıyı ve çeviriyi o üretsin, sunucu
sıralasın.
- `prepare_context` input'una opsiyonel `keywords: string[]` ekle (üst sınır
  koy, ör. 24 × 60 karakter). Açıklama tek cümle, ör.: "Extra terms: synonyms
  and the workspace's own language (e.g. English terms for a Turkish task)".
- `rankCorpus`: terimler = görev ∪ keywords. Keyword'lere ayrı ağırlık verip
  vermemeye ölçerek karar ver.
- Ajan talimatı: sunucu `instructions` (`handler.ts` → `buildInstructions`),
  `cli/templates/agents-section.md`, `skills/remnus/SKILL.md`,
  `docs/mcp/context-first.md` aynı kısa kuralı söylesin. P4'ün token diyetine
  uy: `npm run bench:mcp-budget` öncesi/sonrası; eklenen yük ~60 token'ı
  geçmesin.

### C. Corpus: tek round-trip + önbellek

1. `listKnowledgeCorpus` içindeki 4 sıralı sorguyu `db.batch` ile tek ağ turuna
   indir (P3 deseni; `AGENTS.md` → "Bulk write path").
2. Corpus'u ve tokenize edilmiş halini süreç içi, boyutu sınırlı bir önbellekte
   tut (LRU; 256 MB'lık fonksiyonun küçük bir kesri). Anahtar: `workspaceId` +
   change cursor (`getChangeHeadCursor`) **+ knowledge tablolarının kendi
   maksimumu** (bulgu 6). Alternatif: knowledge tablolarını
   `computeChangeVersion`'a eklemek — canlı UI yoklamasına maliyetini ölçüp
   karar ver, gerekçelendir. Serverless'ta önbellek best-effort'tur; doğruluk
   anahtardan gelir.
3. OKF snapshot yolunun davranışı değişmemeli.

### D. `search_workspace` için FTS5

1. **Önce Turso'da kanıtla, sonra tasarla.** Prod'a dokunmadan: Hakan'dan bir
   dev/branch Turso veritabanı iste ve orada FTS5 tablosu + `db.batch` ile
   parametreli insert + trigger + `MATCH` dene. #1811 tekrar ediyorsa trigger
   yolunun (insert'i sunucu yapar) istemci batch'inden etkilenmediğini ayrıca
   test et. Sonucu raporla. Turso'da çalışmıyorsa D'yi yapma; A–C ile bitir ve
   nedenini yaz.
2. Tasarım kararları (gerekçeleriyle raporla):
   - **Senkron: trigger mı, uygulama kodu mu?** Trigger her yazma yolunu yakalar
     (web action, MCP, bulk, seed, çöp kutusu/snapshot geri yükleme, import);
     uygulama kodu `syncPageLinks` gibi bir yerde unutulabilir. Tercih trigger.
   - **rowid tuzağı:** kaynak tablolar TEXT PK'li; örtük rowid `VACUUM` ile
     değişebilir → kaynak rowid'ine bağlı external-content FTS kullanma.
     `UNINDEXED item_id` kolonuyla silmek de FTS tablosunu tam tarar — ölçek
     için kararlı bir INTEGER anahtar/eşleme tablosu düşün.
   - Kapsam: standalone sayfa başlığı `workspace_items.title`'da, gövdesi
     `standalone_pages.content`'te; satırlar `pages`'te; database adları da
     aranabilir olmalı. `workspace_id` filtre kolonu.
   - Tokenizer: `unicode61 remove_diacritics 2` + her terime önek `*` (alt-dize
     davranışının çoğunu korur). Gerçek alt-dize gerekiyorsa `trigram`'ı
     ölçerek değerlendir (daha büyük index).
3. Sorgu: kullanıcı metninden güvenli FTS5 sorgusu kur (tırnak/operatör kaçışı);
   FTS hatasında veya 3 karakterden kısa sorguda eski `LIKE` yoluna düş.
   `bm25()` ile başlık ağırlıklı sırala, `snippet()` ile özet çıkar. Çıktı
   şeması aynı kalsın; tool açıklamasındaki "substring" ifadesini gerçeğe göre
   düzelt.
4. Migration: sıradaki boş numara, `_journal.json` dışı apply script deseni
   (`src/db/apply-00XX-*.ts`), idempotent, hedefi ekrana yazan; ayrıca
   backfill. Önce yalnız yerele uygula.
5. `prepare_context` için FTS'i birinci aşama yapmayı (top-N aday → yalnız
   onların gövdesini oku → mevcut güven/tazelik skoru) C'deki önbellekle
   **ölçerek** karşılaştır. Büyük workspace'te C yetmiyorsa bu yolu seç.

### E. Regresyon seti

`src/scripts/benchmark-context-pack.ts`'ye iki grup ekle: `mustHit` (assert
edilir) ve `tracked` (isabet oranı raporlanır, assert edilmez). Türkçe görevler,
eşanlamlı ("mail"/"email") ve büyük-I vakaları `tracked`'a; A+B ile çözülenleri
`mustHit`'e taşı. Kalanları P11 taşıyacak.

## Kapsam dışı

Embedding/vektör (P11), Jev veya başka dış model, web UI'a arama kutusu
(ayrı ürün kararı — değerli bulursan öneri olarak yaz).

## Doğrulama

1. `npm run lint -- <paths>`, `npx tsc --noEmit`, `npm run bench:context`.
2. Öncesi/sonrası tablo: isabet, round-trip, ms, token (`bench:mcp-budget`).
3. Gerçek MCP istemcisiyle uçtan uca: Türkçe bir görevle `prepare_context`
   (keywords'lü ve keywords'süz); Türkçe büyük harfli bir başlığı ("Çözüm …")
   `search_workspace` ile küçük harfle bul.
4. Trigger'lar: web'de sayfa düzenle / sil / çöp kutusundan geri al → arama
   sonucu doğru mu?

## Bitirirken

- Kullanıcı fark eder (ajanlar Türkçe görevlerde doğru sayfayı buluyor, arama
  Türkçe harflerde çalışıyor) → `src/lib/changelog.ts` başına kayıt
  (`improved`; harf hatası ayrı yazılacaksa `fixed`), tek cümle, 8 locale.
- `AGENTS.md` (arama/bağlam, yeni migration, trigger invariant'ı) + Serena
  `core`/`conventions`; `docs/mcp/read-tools.md`, `docs/mcp/context-first.md`.
- Yeni migration'ı bu dosyanın sonundaki "Deploy öncesi" tablosuna ekle.
- `scripts/ai/update-handoff.ps1`. Commit/push yok.
````

> **✅ P10 tamamlandı — 2026-09-23 (Claude). A, B, C, E yapıldı; D (FTS5) ilk turda
> ertelendi, 2026-09-24'te Turso dev kanıtıyla yapıldı (aşağıda "D — 2026-09-24").**
>
> **Bulgular koddan doğrulandı.** 1–4 ve 6 aynen geçerliydi; yalnız satırlar kaymıştı
> (`listKnowledgeCorpus` ~433, `searchWorkspace` ~226). Ek olarak: satırların
> breadcrumb'ı satır × öğe `find()` ile kuruluyordu; `getKnowledgeRevision` her
> `prepare_context`'te tüm metadata satırlarını çekiyordu.
>
> **Ne yapıldı**
> - **A:** `foldText()` + `foldTextWithOffsets()` (`src/lib/services/textFold.ts`).
>   `tokenize`, `STOP_WORDS` ve başlık bonusu bunu kullanıyor. `tr-TR` küçültme
>   kaldırıldı. FTS5 probu: `unicode61 remove_diacritics 2` "ı"yı **katlamıyor**
>   (ılık → ılık); FTS gelirse trigger'da `replace(…,'ı','i')` şart.
> - **B:** `prepare_context.keywords` (≤24 × 60), `KEYWORD_WEIGHT = 0.5`. Distractor
>   keyword'lü taramada MRR 0.3–0.6 aralığında 0.92, 0.8'de 0.83, 1.0'da 0.75 çıktı.
>   Kural `renderInstructions`, CLI AGENTS bloğu, skill ve `context-first.md`'de aynı.
> - **C:** `listKnowledgeCorpus` 4 sıralı sorgudan tek `db.batch`'e indi (OKF snapshot
>   çıktısı aynı, `test:okf` geçti). Ters indeksli `buildCorpusIndex` kuruldu: sıralı
>   vocabulary + önek aralığı. Süreç içi ~24 MB'lık LRU önbellekte tutuluyor. Anahtar
>   `getKnowledgeCorpusVersion` (tek tur): change version + öğe/satır sayısı (recurrence
>   pruning tombstone yazmıyor) + knowledge metadata/review/revoke maksimumları. Sıcak
>   saniyede `null` döner ve önbelleğe alınmaz. `stale` her çağrıda yeniden hesaplanıyor.
>   **Karar:** knowledge tabloları `computeChangeVersion`'a **eklenmedi**. Ölçüm: toplamlar
>   ~2 ms, yani 2,5 sn'lik her UI poll'una ~%50 ek; bunu gerektiren bir ekran yok.
>   `getKnowledgeRevision` artık SQL toplamı.
> - **D yerine (Hakan'ın seçimi):** `search_workspace` şema değişikliği olmadan
>   harf katlıyor. `foldingSearchPatterns()` → `LIKE iskelet ESCAPE '\' AND GLOB
>   sınıfları`. GLOB sınıfları tek başına ~10× yavaştı; LIKE ön-filtresi bunu kapattı.
>   Katlama tr/es/fr/de harflerini kapsıyor; diğer yazılar eskisi gibi birebir eşleşiyor.
>   3 sorgu tek `db.batch`. Tool açıklaması: "Case- and accent-insensitive".
> - **E:** `bench:context` v2. `mustHit` 11 vaka assert ediliyor, `tracked` 4 vaka
>   raporlanıyor. Önbellek anahtarı davranışı da assert'li.
>
> **D neden ilk turda yapılmadı:** Turso CLI yoktu ve dev/branch DB yoktu; Hakan "D'yi
> bu turda atla" dedi. Prod motoru **klasik libSQL** (Hakan).
>
> **D — 2026-09-24 (yapıldı).** Hakan boş bir dev DB açtı (`remnus-dev-…`,
> `aws-eu-west-1`, bilgileri gitignore'daki `.env.turso-dev`'de). Tüm betikler prod
> URL/token'ıyla eşleşirse ya da DB boş değilse çalışmayı reddetti, sonunda da her şeyi
> sildi.
> - **Kanıt (Turso dev, SQLite 3.47.0):** FTS5 + `unicode61 remove_diacritics 2`
>   çalışıyor. **#1811 tekrarlamadı:** parametreli `client.batch` doğrudan FTS5'e yazdı.
>   Foreign key'ler açık; FK cascade silmeleri trigger'ları tetikliyor.
>   `contentless_delete=1` destekleniyor. Contentless tabloda kolonların yalnız bir
>   kısmını UPDATE etmek yasak; bu yüzden her değişiklik rowid ile sil + üç kolonu
>   birden yaz. Gerçek `apply-0052` betiği dev'de iki kez sorunsuz çalıştı ve
>   uygulamanın `searchWorkspace`'i dev'e karşı 9/9 kontrolü geçti.
> - **Maliyet ölçümü** (aynı 3.000 doküman, Hrana `rows_read`/`rows_written`):
>   - Okunan satır, belirli terimlerde: 5,4–7k → 1,0–1,6k. Bunun ~1k'sı breadcrumb
>     ağacı okuması.
>   - Dokümanların yarısında geçen bir terimde: eşit (6,0k).
>   - Yazılan satır, bir düzenlemede: 1 → 3.
>   - Depolama: contentless +%28; içeriği de saklayan varyant +%120.
>   - Gecikme her iki yolda da ağ baskın (~95 ms RTT); sunucu farkı 0–25 ms.
>   - Hız değil, okunan satır ve alaka sıralaması kazanç.
> - **Kararlar:**
>   - Contentless FTS: snippet zaten kaynak satırdan kesiliyor.
>   - Önce sırala, sonra join: tersi yaygın bir terimde 2× satır okudu.
>   - bm25 ağırlıkları ws 0 / title 10 / body 1.
>   - Her kelime tırnaklı önek ifadesi; ws token'ı `ws : "w<id>"`.
>   - Sorguda combining mark silinmiyor, çünkü Hintçe ünlü işaretleri unicode61'de
>     ayraç sayılıyor.
>   - CJK/Thai (boşluksuz yazılar) ve < 3 harf doğrudan taramaya gidiyor. İndeks
>     yoksa (bir kez uyarı loglanır) ya da sıfır sonuç dönerse de taramaya düşülüyor;
>     kelime ortasındaki parçalar böylece yine bulunuyor.
>   - 11 trigger, yeniden kurulum tek transaction'da. Upsert ve silip-yeniden-yazma
>     kullanılıyor, böylece indeks bakımı kullanıcının kendi yazma işlemini asla
>     düşürmüyor.
>   - `db:drift` artık FTS tablosunu ve trigger'ları da denetliyor.
> - **Doğrulama:**
>   - `local.db`'ye uygulandı (iki kez, idempotent; 266 doküman). 104 yetim satır,
>     eskisi gibi aranamıyor.
>   - Gerçek servis yollarıyla 18/18 kontrol geçti: tekli/toplu oluşturma, başlık/gövde
>     düzenleme, sürüm geri yükleme, satırı başka DB'ye taşıma, sayfa ve database
>     silme, çöp kutusundan geri alma, workspace izolasyonu ve silme, kelime parçası
>     taraması, `search_docs` = canlı öğe+satır.
>   - Contentless kenar durumları: olmayan rowid'i sil + ekle, 5× yeniden yaz,
>     `delete-all`.
>   - Web arayüzünden elle test yapılmadı; trigger'lar DB düzeyinde ve web aynı
>     tablolara yazıyor. Playwright gerekirse ayrıca yapılabilir.
>   - **Turso prod'a uygulanmadı:** bu adım deploy günü, Hakan'ın onayıyla yapılacak.
>
> **Öncesi → sonrası** (yerel `file:local.db`; sentetik 1.000 sayfa + 4×500 satır,
> 3,39M karakter, 3.000 knowledge satırı; ölçüm sonrası silindi):
>
> | ölçüm | öncesi | sonrası |
> |---|---|---|
> | `bench:context` mustHit top-1 | 5/11 | **11/11** |
> | `bench:context` tracked (TR/eşanlamlı, keywords yok) | 0/4 | 0/4 (P11'e) |
> | `prepare_context` round-trip (graph dahil) | 13 | 11 soğuk / **10** sıcak |
> | ↳ corpus kısmı | 4 | 1 (+1 anahtar) |
> | `prepare_context` ms (yerel CPU) | 500–650 | ~400 soğuk / **~20** sıcak |
> | `listKnowledgeCorpus` (knowledge satırı yokken) | 4 RT, ~110–150 ms | 1 RT, ~70–130 ms |
> | `search_workspace` round-trip | 3 | **1** |
> | `search_workspace` "cozum" / "guven" | 0 sonuç | doğru sonuç |
> | `search_workspace` ms (yerel, en kötü) | 12–20 | 20–90 (yoğun sentetik veri) |
> | model-görünür şema (`bench:mcp-budget`) | 24.341 B | 24.531 B |
> | instructions smart/write · AGENTS bloğu | 1.074 · 1.851 B | 1.090 · 1.869 B |
>
> Oturum başına ek yük ~224 B ≈ 56 token. 60 sınırının altında.
>
> **D.5 (FTS birinci aşama mı, C önbelleği mi):** FTS olmadığı için karşılaştırılamadı.
> C sıcak çağrıyı çözüyor. Açık kalan soğuk örnek: büyük workspace'te her yeni
> serverless instance ~3,4 MB çekip ~400 ms indeks kuruyor. FTS gelirse "top-N aday →
> yalnız onların gövdesi" yolu tam bunun için.
>
> **Doğrulama:** `npx tsc --noEmit` temiz. Değişen dosyalarda eslint 0 hata; 4 uyarı
> önceden vardı. `bench:context`, `test:okf` geçti. Pattern kenar durumları bellek-içi
> DB'de 18/18 (`%`, `_`, `*`, `[`, `\`, Kiril, ß, İ/ı). **Gerçek MCP istemcisi** (SDK
> Streamable HTTP, yerel dev server, geçici read PAT; sonra silindi) şunları gösterdi:
> instructions'ta "with keywords" var. Şemada `keywords` var. "Davetlere görüntüleyici
> rolü ekle" keywords olmadan 0 kavram, keywords ile "Workspace invitation roles"
> döndü. "debug the integrations api" → "Integrations API". `search_workspace`
> "cozum" / "ÇÖZÜM" / "çözüm notları" → "Çözüm Notları" [title]. "sikayet" →
> [content]; snippet orijinal yazımla geliyor. Trigger doğrulaması (madde 4) D
> olmadığı için yok.
>
> **Kapsam dışı ama ölçülen:** `prepare_context`'in kalan 9 round-trip'i en üst kavramın
> `getRelatedPages` komşuluğundan geliyordu. **Takip olarak yapıldı (2026-09-23):** konu,
> iki parent adayı, children, outgoing, backlinks ve kardeşler artık tek `db.batch`;
> bağlantı id'lerinin çözümü ikinci bir batch. Yerel DB'de eski kopyayla 383 vaka
> karşılaştırıldı (6'sı bağlantılı fixture: üç id biçimi, yabancı workspace, kopuk link,
> satır altındaki öğe). Hepsi birebir aynı ve aynı sırada. Round-trip çağrı başına
> 7,1 → 1,0 (bağlantı varsa 2). `prepare_context` sıcak çağrısı artık 2–3 round-trip
> (soğukta +1 corpus). MCP yolunda context-run kaydı için +2 sıralı sorgu kalıyor.
> Müşterinin fark edeceği bir hız farkı olmadığı için changelog kaydı yok.
> Web'de global arama kutusu hâlâ yok. Öneri: FTS ile birlikte ürün kararı olarak ele
> alınsın. Bugünkü LIKE+GLOB tam tarama, her tuşa basışta çalışacak bir UI kutusu için
> yeterince hızlı değil.
>
> **Değişen dosyalar:** `src/lib/services/{textFold (yeni),contextPack,knowledge,
> changeVersion,workspace}.ts`, `src/app/api/mcp/{tools/read,handler}.ts`,
> `src/scripts/benchmark-context-pack.ts`, `cli/templates/agents-section.md`,
> `skills/remnus/SKILL.md`, `docs/mcp/{context-first,read-tools}.md`, `AGENTS.md`,
> Serena `core`/`conventions` (dosya olarak; Serena araçları yok),
> `src/lib/changelog.ts` (`2026-09-23-agent-context-languages` improved,
> `2026-09-23-search-letters` fixed). Commit/push yok.

---

# P11 — Anlamsal bulma: embedding + Turso vektör + hibrit sıralama

> 2026-09-23 araştırmasının 2. adımı. P10'a bağımlı (FTS5 + regresyon seti).
> Kullanıcı içeriğini üçüncü tarafa gönderen ilk özellik → sağlayıcı kararı Hakan'ın.

````text
Remnus projesinde çalışıyorsun. Önce `AI.md`, `AGENTS.md` (P10'da yazılan
arama/bağlam bölümü dahil), `docs/mcp/context-first.md` ve bu dosyadaki P10
bölümünün **"Tamamlandı" notunu** oku (P10 promptunun kendisini değil). Serena
varsa `core` + `conventions`. `git status --short` ile başla.

## Amaç

P10 sonrası kalan açık: aynı kelimeyi paylaşmayan ama aynı şeyi anlatan görev
ve sayfalar (Türkçe görev ↔ İngilizce sayfa; "kullanıcıyı her yerden çıkar" ↔
"session revoke"). Hedef: P10'un `tracked` vakalarının tamamı `mustHit`'e
geçsin; mevcut `mustHit`'lerde gerileme olmasın.

## Önce karar: sağlayıcı (kod yazmadan Hakan'a sor)

Seçenekleri fiyat / gizlilik / kalite ile özetle ve **Hakan'a sor**; onaysız
uygulama:
- Vercel AI Gateway üzerinden (uygulama zaten Vercel'de; tek anahtar,
  sağlayıcı değiştirmek kolay): `voyage-4-lite` (~$0.02/1M token), `voyage-4`
  (~$0.06/1M), `text-embedding-3-small` (~$0.02/1M). Bunlar 2026-09-23
  fiyatları — güncelini doğrula.
- Doğrudan sağlayıcı API'si.
- Self-host (BGE-M3 vb.) — serverless'ta pratik değil; Docker self-host için
  not düş.
Paket kurma: `fetch` ile REST yeterli. Anahtarı yalnız env değişken adıyla an.
Anahtar yoksa özellik **kapalı** ve her şey P10 davranışına düşer — self-host
kurulumlar bozulmamalı. Gizlilik: gizlilik sayfasındaki üçüncü taraf işleyici
metnini bul ve güncelle (8 locale). Workspace bazında kapatma seçeneği gerekip
gerekmediğini de Hakan'a sor.

## Tasarım (ölç, karar ver, gerekçelendir)

1. **Depolama:** yeni tablo (ör. `content_embeddings`: öğe id + tür +
   `workspace_id` + `content_hash` + model + `F32_BLOB(dim)` + `updatedAt`).
   Boyut kolon tipine gömülü → model değişimi migration demek; model id'yi
   sakla. Yerelde doğrulandı: `vector32`, `F32_BLOB`, `libsql_vector_idx`,
   `vector_top_k`, `vector_distance_cos` çalışıyor (@libsql/client 0.17.3).
   Turso'da P10'daki dev veritabanıyla tekrar doğrula.
2. **Çok kiracılık tuzağı:** `vector_top_k` ANN index'i **tüm veritabanı**
   üzerinde global. Küçük bir workspace'in öğeleri global top-k'ya hiç
   girmeyebilir → filtre sonrası boş sonuç. Workspace'ler birkaç bin öğe
   mertebesinde olduğundan önce **workspace içi tam tarama**yı ölç
   (`WHERE workspace_id = ? ORDER BY vector_distance_cos(...) LIMIT 50`);
   ANN'i yalnız ölçüm gerektiriyorsa ekle.
3. **Ne gömülür:** v1'de öğe başına tek vektör (başlık + description + tags +
   outline + gövdenin başı). Parça (chunk) seviyesi yalnız eval gerektiriyorsa.
4. **Ne zaman gömülür:** yazma yoluna senkron embedding çağrısı **ekleme**
   (P3'ün kazandığı hızı geri verir). Hash uyuşmazlığı = kirli. Kirlileri
   yazmadan sonra `after()` ile best-effort göm (Next 16 davranışını
   `node_modules/next/dist/docs/` altından oku); güvenlik ağı olarak cron veya
   sorgu anında küçük bir kota. `vercel.json` cron'ları günlük — tazelik için
   tek başına yetmez.
5. **Sorgu:** görev + keywords için tek embedding çağrısı (metin hash'iyle
   önbellekle). Aday = FTS5 top-N ∪ vektör top-N, **Reciprocal Rank Fusion**
   ile birleştir, sonra mevcut güven/tazelik skoru ve bütçe. Embedding çağrısı
   hata verir veya zaman aşımına uğrarsa (ör. 800 ms) sessizce P10 yoluna düş,
   `warnings`'e yaz.
6. `search_workspace`'e anlamsal mod eklemeye ölçerek karar ver (şema büyütmek
   token demek — P4 kuralı).
7. Backfill script'i: önce yerel; maliyet tahmini (token × fiyat) raporda.
   Prod backfill'ini Hakan çalıştırır.

## Kapsam dışı

Jev veya başka reranker. Yalnız şunu bırak: son sıralama tek bir fonksiyonda
toplansın ki ileride bir reranker (bkz. "Ertelenen — Jev") tek yerden
takılabilsin. Jev kodu yazma.

## Doğrulama

1. lint, `npx tsc --noEmit`, `npm run bench:context` (mustHit/tracked tablosu).
2. Gecikme: `prepare_context` p50/p95, embedding açık/kapalı.
3. Anahtar yokken tüm akışlar P10 davranışında mı?
4. Gerçek MCP istemcisiyle Türkçe bir görev uçtan uca.
5. Maliyet: tipik bir workspace için backfill + aylık tahmin.

## Bitirirken

- Changelog (`improved`), 8 locale; gizlilik metni.
- `AGENTS.md` + Serena; `docs/mcp/context-first.md`; self-host dokümanında yeni
  env değişkeni (yalnız adı).
- Migration → "Deploy öncesi" tablosu; yeni env değişkeni → aynı listeye not.
- `scripts/ai/update-handoff.ps1`. Commit/push yok.
````

---

# P12 — Remnus Graph: bilgi haritası (Obsidian kopyası değil)

> 2026-09-23. Hakan: "Obsidian gibi olmayalım ama graph iyi bir özellik;
> kendimize göre entegre edelim." Tahmini kapsam: büyük, ağırlıkla UI. P10
> önerilir (bahsedilme katmanı onun `foldText`'ini kullanır), zorunlu değil.

````text
Remnus projesinde çalışıyorsun. Önce `AI.md`, `AGENTS.md` (sidebar, page links,
proje penceresi kilidi, UI kuralları) ve `docs/WHAT_IS_REMNUS.md`'yi oku. Serena
varsa `core` + `conventions`. `git status --short` ile başla. Yeni route ve
`next/dynamic` kullanacağın için önce `node_modules/next/dist/docs/` altındaki
ilgili rehberi oku. UI işi olduğu için `frontend-design` skill'i varsa kullan.

## Ürün fikri — neden Obsidian kopyası değil

Obsidian'ın graph'ı dolu, çünkü kullanıcılar her yere `[[link]]` yazıyor.
Remnus'ta açık link seyrek: 2026-09-23'te yerel DB'de **331 öğe (40 sidebar +
291 satır), 8 `page_links` satırı, 0 `knowledge_metadata`**. Birebir kopya,
birbirinden kopuk noktalar ekranı olur. Remnus'un farkı insan + ajanın birlikte
tuttuğu bilgi; graph bunu göstermeli:
- **Bilgi nasıl bağlı** (hiyerarşi, database, link, bahsedilme),
- **Neye güvenilir** (human-reviewed / taslak / eskimiş / deprecated),
- **Ajan nereye dokundu** (son N günde okunan/yazılan yerler),
- **Neresi bakım istiyor** (öksüz, eskimiş, incelenmemiş merkezler).
Hedef güzel bir "yıldız haritası" değil, bir **bakım ve yön bulma aracı**.

## Kenar katmanları (v1)

| Katman | Kaynak | Not |
|---|---|---|
| Hiyerarşi | `workspace_items.parentId` | her zaman var |
| Database üyeliği | `pages.databaseId` | satırlar varsayılan **katlı**: database düğümü + sayı rozeti; tıklayınca açılır |
| Açık link | `page_links` (`page_link`, `child_block`) | `getRelatedPages`'teki database id çözümlemesini yeniden kullan |
| Bağlantısız bahsedilme | gövdede başka bir öğenin başlığı geçiyor | ucuz ama gürültülü; aşağıya bak |
| Ortak etiket | `knowledge_metadata.tags` | etiket düğümü mü, doğrudan kenar mı — yoğunluğa göre karar ver |

Bahsedilme algoritması: başlıkları P10'daki `foldText` ile katla, sözcük
dizisi olarak bir hash kümesine koy (en fazla L sözcük), her gövdeyi sözcük
penceresiyle tara — O(toplam sözcük × L). Başlık × gövde `includes` döngüsü
kullanma. Tek sözcüklü genel başlıkları ("Notes", "Todo", "Backlog") ve çok sık
geçen başlıkları dışla; eşiği ölç. Sonuç change cursor ile önbelleklenir.
Bahsedilme kenarı kesikli çizilir (v1'de yalnız gösterilir; "bağlantıya çevir"
kapsam dışı).

## Görünümler

1. **Workspace haritası** — yeni route (ör. `src/app/[locale]/(app)/graph/`),
   girişi `WorkspaceSidebar.tsx`'te; proje penceresinde de görünsün (P1'in
   sidebar sadeleştirmesiyle çelişmediğini kontrol et). İsteğe bağlı:
   `(app)/app/page.tsx`'teki `resolveLastPath` bu route'u tanısın.
   - İki yerleşim, **tek renderer**: *Ağ* (ForceAtlas2, worker'da) ve *Ağaç*
     (radyal ağaç — `d3-hierarchy` ile x/y hesapla, aynı sigma'ya ver).
   - Renk modu: tür · güven/tazelik · ajan aktivitesi. Boyut: derece.
   - Katman aç/kapa, arama/odak (düğüm + komşuları vurgulanır); tıklayınca
     öğeye git (`/page/[itemId]`, `/db/[id]`, `/db/[id]/[pageId]`,
     `/dashboard/[itemId]`).
   - Yan panel **"Dikkat isteyenler"**: öksüzler (hiyerarşi dışında kenarı
     olmayan), eskimiş/deprecated, çok bağlantılı ama incelenmemiş olanlar.
     Remnus'u Obsidian'dan ayıran kısım bu.
   - Küme (Louvain) renklendirmesi yalnız yeterli kenar varsa anlamlı; yoksa
     seçeneği gizle.
2. **Yerel graph paneli** — sayfada 1–2 adım komşuluk. `PageBacklinksPanel`,
   `PageEditor.tsx` (~878, peek'te gizli) ve `StandalonePageEditor.tsx` (~357)
   içinde; onun yanında ya da içinde bir sekme olarak, **kapalı başlasın** (her
   sayfa açılışında WebGL ve ağır bundle yüklenmesin).

## Veri katmanı

- Servis: `src/lib/services/graph.ts` (cookie'siz — P13'teki MCP tarafı aynı
  servisi kullanacak). Action: `src/lib/actions/` altında. Proje penceresi
  kilidi: `getCurrentUserAllowingWorkspaceLock()` + `assertWorkspaceLockAllows()`
  (admin kısayolundan önce), sonra `assertWorkspaceAccess`.
- Tek `db.batch` (P3 deseni). Kompakt yük: düğümler dizi, kenarlar
  `[kaynakIdx, hedefIdx, türKodu]`. Satırlar katlı gelir; database açılınca
  ayrı çağrı. 5.000 düğümlük sentetik workspace'te yük boyutunu ve süreyi ölç.
- Ajan aktivitesi: `agent_activity.targetId` (son N gün) + öğelerdeki
  `agentEditedAt`. `agent_activity`'de `(workspace_id, target_id)` indeksi yok;
  sorguyu ölç, gerekirse indeks migration'ı ekle.
- Canlılık: P1'in `changeVersion` yolu (P7 notunda doğrulandı) ile harita
  yenilensin. Yeniden yerleşim kullanıcının gördüğü düzeni bozmasın: mevcut
  düğüm konumlarını koru, yeni düğümü komşusunun yanına koy.

## Teknoloji (npm'de 2026-09-23'te doğrulandı)

`sigma` 3.0.3 · `graphology` 0.26.0 · `@react-sigma/core` 5.0.6 (peer: React
^18||^19, sigma ^3.0.2, graphology ^0.26) · `graphology-layout-forceatlas2`
0.10.1 (worker) · `graphology-communities-louvain` 2.0.2 · `d3-hierarchy` 3.1.2.
Gerekçe: MIT, WebGL, graph algoritmaları hazır; graphology Node'da da çalıştığı
için P13'te sunucu aynı modeli kullanabilir. Sigma v4 beta — kullanma.
Değerlendirilip elenenler: react-force-graph (hızlı MVP ama algoritma yok),
cosmos.gl (bu ölçekte gereksiz), Cytoscape (ölçekte yavaş), Reagraph (büyük
graph'ta bilinen performans sorunu).
- **Paket kurulumu AI.md gereği onaya tabi:** listeyi ve kurulum komutunu
  Hakan'a göster, onay al, sonra kur. Sürümleri tekrar doğrula.
- Kütüphane yalnız graph route'u/paneli açılınca yüklensin (`next/dynamic`,
  `ssr: false`); diğer sayfaların bundle'ı büyümemeli.
- WebGL renkleri CSS token'larından okunsun; açık/koyu tema; düz, çerçevesiz,
  neutral palet (AGENTS.md UI kuralları). Dokunmatik ve dar ekran
  (Capacitor/PWA) çalışsın.

## Kapsam dışı

Kod dosyası katmanı ve MCP tarafı (P13), anlamsal/Jev ilişki kenarları,
graph'tan düzenleme (sürükleyip taşıma), public paylaşım sayfalarında graph.

## Doğrulama

1. lint, `npx tsc --noEmit`.
2. Dev server + görsel kontrol: boş, küçük ve 5.000 düğümlük sentetik
   workspace (yalnız yerel DB, sonra sil). Etkileşim akıcılığı, yük boyutu.
   Playwright gerekiyorsa önce Hakan'a sor (tercihi: son çare).
3. Proje penceresinde kilitli oturumla aç: başka workspace'in graph'ı
   reddedilmeli.
4. Koyu/açık tema, dar ekran.
5. İş sonunda `next build`: graph kütüphanelerinin yalnız graph chunk'ında
   kaldığını gör.

## Bitirirken

- Changelog (`new`), tek cümle, 8 locale. Tüm UI metni next-intl, 8 locale
  (yeni namespace açarsan `AI.md`'deki namespace sayısını güncelle).
- `AGENTS.md` (graph servisi, katmanlar, invariant'lar) + Serena.
- `scripts/ai/update-handoff.ps1`. Commit/push yok.
````

---

# P13 — Proje haritası: kod katmanı + graph'ın ajan tarafı

> 2026-09-23. P12'ye bağımlı (graph servisi). P8'in calibrate'te
> `knowledge.sources` doldurması bu işin yakıtı.

````text
Remnus projesinde çalışıyorsun. Önce `AI.md`, `AGENTS.md` (Project Install ve
P12'de yazılan graph bölümü), `docs/mcp/project-install.md`,
`docs/mcp/read-tools.md` dosyalarını oku; bu dosyadaki P8, P10, P12
bölümlerinin "Tamamlandı" notlarına bak. Serena varsa `core` + `conventions`.
`git status --short` ile başla.

## Amaç

"Tüm proje" = Remnus'taki bilgi + o bilginin dayandığı kod. Remnus zaten
projelere kuruluyor (`npx remnus init`); bir sayfanın hangi dosyalara dayandığı
`knowledge_metadata.sources[].resource` alanına yazılabiliyor
(`KNOWLEDGE_INPUT`, `src/app/api/mcp/tools/write.ts`). Bu görev (1) graph'a kod
katmanını ekler, (2) graph'ı **ajan için** de faydalı kılar.

## Önce ölç

Calibrate edilmiş gerçek bir workspace'in yerel kopyasında `sources` doluluk
oranını çıkar. P8'den sonra hâlâ boşsa A'nın değeri düşüktür — önce
calibrate'in `sources` yazmasını düzeltmeyi öner ve raporla.

## A. Kod düğümleri — `sources`'tan türet (CLI değişikliği yok)

- `resource` depo-göreli bir yol gibi görünüyorsa (şema yok; `/` içeriyor ya
  da bilinen bir uzantısı var) dosya düğümü olur; yol parçalarından klasör
  hiyerarşisi kurulur. URL'ler ayrı "harici kaynak" düğümü mü olacak, hiç mi
  gösterilmeyecek — karar ver.
- Kenar: sayfa → dosya ("dayanıyor"). P12'nin katman anahtarlarına eklenir;
  varsayılan kapalı olabilir.

## B. İsteğe bağlı: CLI'dan dosya ağacı + import kenarları

Yalnız A'dan sonra ve değeri ölçülürse. Kısıtlar:
- `cli/` sıfır bağımlılık, ESM. `git ls-files` + JS/TS/Python için regex import
  taraması yeter; tree-sitter vb. yok.
- Sunucuya **yalnız yollar ve kenarlar** gider, kod içeriği asla. Boyut sınırı
  koy.
- Bu CLI'a özel bir yükleme: **MCP `tools/list`'e yeni tool ekleme** (her
  oturuma şema maliyeti — P4 kuralı). Mevcut kimlik bilgisiyle ayrı bir HTTP
  yolu ya da `remnus sync` içine gömülü bir çağrı kullan; `proxy.ts` +
  `auth.config.ts` istisnalarını birlikte güncelle.
- Depolama: workspace başına tek JSON satırı yeterli olabilir; ölç.

## C. Ajan tarafı

1. **Dosyadan bilgiye:** ajan bir dosyayı düzenlemeden önce "bu dosyaya hangi
   Remnus sayfaları dayanıyor?" diye sorabilmeli. Yeni tool açmadan mevcut bir
   tool'a parametre ekle (ör. `get_related_pages`'e `resource`); şema artışını
   `npm run bench:mcp-budget` ile ölç.
2. **`prepare_context` graph genişletmesi:** bugün yalnız en üstteki kavramın
   komşuları ekleniyor (`contextPack.ts`). P12 servisinin graph'ı üzerinden ilk
   k kavramdan kişiselleştirilmiş PageRank ya da bütçeli 1–2 adım genişletme
   dene; `bench:context`'te isabet ve token etkisini ölç. Kazanç yoksa yapma,
   nedenini yaz.
3. **Harita/digest'e merkezler:** `getWorkspaceDigest` ve
   `.remnus/workspace-map.md`'ye "en bağlı N öğe" satırı ajanın yön bulmasını
   hızlandırır mı? Token maliyetini ölç; davranış değiştirmiyorsa ekleme.
4. İsteğe bağlı: dashboard kataloğuna (P6/P7) "Bilgi sağlığı" bloğu (öksüz /
   eskimiş / incelenmemiş sayıları) — P12'nin "Dikkat isteyenler" hesabını
   yeniden kullan.

## Kapsam dışı

Kod içeriğini indekslemek, sembol seviyesinde graph (Serena'nın işi),
anlamsal/Jev ilişki önerileri.

## Doğrulama

1. lint, `npx tsc --noEmit`; CLI'a dokunduysan `npx remnus doctor` ve köprünün
   stdout'u saf mı (P4'teki kural).
2. Gerçek MCP istemcisiyle: bir dosya yolu ver → ilgili sayfalar geliyor mu.
3. Graph'ta kod katmanı: dev server'da görsel kontrol.
4. `bench:context` öncesi/sonrası.

## Bitirirken

- Changelog (`new`/`improved`), 8 locale.
- `AGENTS.md` + Serena; `docs/mcp/read-tools.md`, `docs/mcp/project-install.md`;
  CLI değiştiyse sürüm notu (yayınlamak Hakan'ın işi).
- `scripts/ai/update-handoff.ps1`. Commit/push yok.
````

---

# Ertelenen — Jev (TypeSafe AI "System One") deneyi

> Bir P bloğu değil; 2026-09-23 araştırmasının kaybolmaması için referans.
> Ele alma zamanı: P11'den sonra, `bench:context`'te hâlâ **sıralama** hatası
> (doğru aday bulunmuş ama yanlış sırada) görülüyorsa.

- **Ne:** Metin üretmeyen karar modeli. `state` + soru sözlüğü alır; `choice`,
  `score` ya da `noul` (evet/hayır olasılığı) ve kalibre edilmiş güven döner.
  70–500 ms, $0.042 / 1M girdi token'ı (çıktı ücretsiz), 64k bağlam. İngilizce
  birincil, diğer diller "eşit iyi değil". Müşteri verisiyle eğitim yok; ZDR
  yalnız enterprise. Erişim: `api.typesafe.ai/v1/systemone` (bekleme listesi),
  Vercel AI Gateway (`typesafe-ai/jev`), OpenRouter. Paket gerekmez, `fetch`
  yeter.
- **MCP'yi doğrudan hızlandırmaz** (+1 ağ adımı). Dolaylı kazanç: daha isabetli
  bağlam → ajanın "ara → yanlış sayfa → tekrar ara" turları azalır.
- **Aday kullanımlar (öncelik sırasıyla):**
  1. `prepare_context`'te ilk ~30 aday için yeniden sıralama + bütçe dağıtımı
     ("göreve yarar mı?" `noul`; "tam / outline / yalnız başlık" `choice`).
     Jev-Mem makalesinin geri getirme deseni. Çağrı başına ≈ $0.0008.
  2. Yazma yolu hijyeni (calibrate / bulk): kopya tespiti, `conceptType`/tag
     sınıflandırması, ilişki önerileri (destekler / çelişir / bağımlı) →
     P12'ye kesikli "önerilen" kenar katmanı.
  3. Eskime: X değişince backlink'lerde "çelişiyor mu?" → insan incelemesine
     düşer. Jev asla "human-reviewed" damgası basmaz.
  4. Ajanın yazdığı / içe aktarılan içerikte prompt-injection taraması —
     güvenlik sınırı değil, filtre.
  5. Silme kapısı: düşük öncelik (`confirm: true` + Strict mod zaten var).
- **Koşullar:** opt-in, best-effort, hata/zaman aşımında Jev'siz yola düşer;
  gizlilik metni + workspace bazında kapatma; Türkçe eval seti ile ölç; tarih
  karşılaştırma ve sayma kodda kalır (Jev'in bilinen zayıf yanları). P11'in
  bıraktığı tek sıralama fonksiyonuna takılır.
- **Kaynaklar:** https://www.firecrawl.dev/blog/what-is-jev ·
  https://docs.typesafe.ai/models · https://arxiv.org/html/2609.23986v1 ·
  https://github.com/codaaiteam/jev-mcp

---

# Deploy öncesi — biriken borç (unutma listesi)

> P adımları tamamlandıkça buraya ekle. Buradaki her madde **deploy'u bloklar**.
> Son güncelleme: 2026-09-24 (P10-D sonrası). Deploy günü yapılacak tek ek iş:
> `0052`'yi Turso prod'a uygulamak (§2 madde 1). Aşağıdaki sıra deploy gününün
> kontrol listesi.
>
> **Karar (Hakan, 2026-09-23):** deploy yol haritası bitince **toplu** yapılacak —
> P10–P13 ara deploy olmadan bu listeye eklenerek ilerler. Her P adımı bitince kendi
> migration'ını, deploy sırasını ve canlı kontrolünü buraya yazar.

## 1. Veritabanı: Turso güncel (2026-09-23)

`0048` (P2), `0049` (P5), `0050` (P6) ve `0051` (audit retention) Turso'ya
**uygulandı**. `npm run db:drift` (salt-okuma) sonrası: "OK — all 39 declared
tables, their columns and named indexes exist." Yerel `local.db` de eşitlendi
(eksik çıkan 0030/0037/0040/0041 uygulandı).

Yeni bir migration eklenince: script'i yerelde ve Turso'da çalıştır, sonra
`npm run db:drift` ile ikisini de doğrula. Hangi migration'ın nerede uygulandığını
not tutmaya güvenme — 2026-09-23'te notlar yerel DB için yanlış çıktı.

P9.5 migration **eklemedi** (status seçenek düzeltmesi, digest sırası, `.md` route'u
yalnızca kod).

**P10 → `0052_search_index` (deploy'u bloklar):** `search_workspace`'in FTS5 indeksi.
Yerelde **uygulandı**, Turso dev'de kanıtlandı, **Turso prod'a henüz uygulanmadı**.
Deploy günü prod'a uygulanacak. Betik idempotent ve her çalıştırmada indeksi
baştan kurar, yani aynı zamanda onarım komutu. Kod indeks yokken eski taramaya
düştüğü için deploy'la sırası kritik değil, ama sıralı arama ancak bu migration'la
canlıya çıkar. `db:drift` artık FTS tablosunu ve 11 trigger'ı da denetliyor.

## 2. Deploy günü sırası

1. `0052`'yi Turso prod'a uygula: `npx tsx src/db/apply-0052-search-index.ts`. Düz
   çalıştırma `.env`'i okuduğu için prod'a gider; betik hedef host'u yazar, doğru
   olduğunu gör. Çıktıda "Index rebuilt: N documents" satırı olmalı. Sonra
   `npm run db:drift` → Turso için **OK** görmeden deploy etme (artık
   `search_fts` + trigger'ları da denetliyor).
2. Web uygulamasını deploy et (Vercel). Bu adımla canlıya çıkanlar: kalibrasyon
   rehberi **v3** ve playbook'lar (sunucudan canlı servis ediliyor), ham markdown
   adresleri `/wiki/<slug>.md` + `/wiki.md` (P9.5), status/select seçenek düzeltmesi
   (`{name}` artık `"[object Object]"` olmuyor), map/digest'in kenar çubuğu sırası,
   proje penceresindeki onboarding 500'ünün kalkması. **P10:** `prepare_context`
   `keywords` + harf katlama + tek-tur corpus/önbellek, `search_workspace`'in
   sıralı FTS araması (eski taramayı yedek olarak tutarak) ve aksan/büyük harf
   katlaması, `getRelatedPages`'in 2 batch'i, sunucu `instructions`'ındaki
   "(with keywords)".
3. **Sonra** CLI'ı yayınla — `cli/package.json` zaten `0.1.9` (npm'de şu an `0.1.8`):
   ```powershell
   cd cli
   npm login      # bu makinede npm oturumu yok
   npm publish
   ```
   Yeni `init` metni, `.md` rehber adresi + "read the whole file" ipucu, `sync`
   komutu, ajan talimatı (yarım kalan kalibrasyonu sürdür) ve P10'un AGENTS bloğundaki
   "`prepare_context` (with `keywords`)" ancak bununla projelere ulaşır.
   **Web'den sonra** olmalı: `init` `.md` adresini yokluyor, route yoksa
   HTML'e düşüyor — önce yayınlarsan ilk kurulumlar HTML adresini (57k token) basar.
   Not: 0.1.9 ile bağlanan projeler `.mcp.json`'da `remnus@0.1.9`'a sabitlenir;
   yayınlanmadan o sürümle `init` çalıştırılmamalı (bridge npm'den inemez).
4. **Deploy sonrası duman testi** (salt okuma, bir dakika):
   ```powershell
   curl.exe -sI https://www.remnus.com/wiki/calibrate.md          # 200, text/markdown, Link: rel=canonical
   curl.exe -s -o NUL -w "%{http_code}" https://www.remnus.com/wiki/playbooks/game.md   # 200
   curl.exe -s -o NUL -w "%{http_code}" https://www.remnus.com/wiki/yok.md             # 404
   curl.exe -s -o NUL -w "%{http_code}" https://www.remnus.com/wiki/calibrate          # 200 (HTML değişmedi)
   curl.exe -s https://www.remnus.com/llms.txt | Select-String "raw markdown"
   ```
   `/wiki/*.md` 307/login'e düşerse `proxy.ts` matcher istisnası canlıda tutmamıştır.
   **P10 (bağlı bir ajanla, salt okuma):** `tools/list`'te `prepare_context` şemasında
   `keywords` var mı; Türkçe büyük harfli bir başlığı (ör. "Çözüm …") `search_workspace`
   küçük harf ve Türkçe harfsiz ("cozum") buluyor mu; başlığı eşleşen sayfa, kelimeyi
   yalnız gövdesinde geçirenlerin önünde mi; Türkçe bir görev + İngilizce
   `keywords` ile `prepare_context` doğru sayfayı döndürüyor mu.
5. **P10 — aramayı canlıda ölç (deploy'dan ~1 hafta sonra, salt okuma).**
   `search_workspace` artık önce FTS indeksini, gerekirse aksan katlayan taramayı
   (LIKE ön-filtre + GLOB) kullanıyor. Taramanın maliyeti yerelde en kötü ~16 →
   ~90 ms çıktı, ama o ölçüm yoğun sentetik veride yapıldı; gerçek workspace
   boyutlarını bilmiyoruz. Her MCP çağrısının süresi zaten
   `agent_activity.duration_ms`'te. Turso panelinin SQL konsolunda (salt okuma) şunu
   çalıştır:
   ```sql
   SELECT tool, count(*) AS calls,
          round(avg(duration_ms)) AS avg_ms, max(duration_ms) AS max_ms
   FROM agent_activity
   WHERE tool IN ('search_workspace', 'prepare_context')
     AND duration_ms IS NOT NULL
     AND created_at > unixepoch('now', '-7 days')
   GROUP BY tool;
   ```
   Bakılacaklar:
   - Vercel loglarında `[search] full-text index unavailable` uyarısı var mı?
     Varsa `0052` prod'da eksik ya da bozuk demektir; betiği yeniden çalıştır.
   - `search_workspace` ortalaması ~150 ms'yi ya da en büyük değeri ~1 sn'yi
     geçiyor mu? Geçiyorsa hangi sorguların taramaya düştüğüne bak (CJK, çok kısa
     sorgu, sıfır sonuç).
   - Turso panelindeki "rows read" grafiği arama kaynaklı düşmeli. Belirli
     terimlerde dev'de ~5× azaldı.
6. **Canlı kalibrasyon testi (deploy + CLI yayınından sonra, ertelendi):** gerçek bir
   projede yayınlanmış CLI ile `npx remnus init` → yeni Claude Code oturumu → yalnızca
   `init`'in bastığı cümle. P9.5'in yerelde göremediği iki şeyi dener: yayınlanmış npm
   CLI'ı ve https üzerinde WebFetch (yerelde localhost'ta hata verdiği için ajan curl'e
   düşmüştü; canlıda özet döndürebilir). Bak: rehberi curl ile mi çekti; log her adımda
   mı işaretlendi (P9.5'te hâlâ sonda toplu işaretleniyordu); gövdelerde
   `data-page-link` var mı, `[[…]]` kaldı mı; `get_related_pages` bağlantı döndürüyor mu;
   `config.json`'da `calibrationGuide: 3`. Bu, P10/P11'in ölçümleri için canlıda gerçek
   etiketli veri de bırakır.

## 3. Sıra kuralı: önce migration, sonra deploy

`0042` bu sırayı ters yapıp **tüm workspace'lerde her database görünümünü boş
bıraktı**; `0045` notunda da aynı uyarı var. Kural: migration Turso'ya uygulanır,
doğrulanır, **sonra** kod deploy edilir. Tersi değil.

## 4. `.env` / script tuzakları (her seferinde geçerli)

- `.env` içindeki `DATABASE_URL` **production Turso**'dur; `.env.local` onu
  `file:local.db` ile ezer ama bunu yalnızca Next.js görür. Apply script'leri
  `.env` okur → düz `npx tsx ...` **prod'a gider**.
- Yerele uygulamak için açık override şart:
  `DATABASE_URL="file:local.db" npx tsx src/db/apply-00XX-*.ts`
- `@/db` import eden script'lerde `import 'dotenv/config'` **ilk import** olmalı;
  değilse sessizce `local.db`'ye düşer ve "Turso'ya uygulandı" yalanı üretir.

## 5. Kapananlar (2026-09-23)

- **Serena senkronu (P5):** Agent Savings Metrics `mem:conventions`'a işlendi.
- **`auditDays`:** artık uygulanıyor — plan penceresi kadar görünürlük (upgrade
  eski geçmişi hemen gösterir), 400 günden eski kayıtlar gece silinir; silmeden
  önce tasarruf `agent_savings_rollup`'a aktarıldığı için sayaç küçülmez
  (`src/lib/services/auditRetention.ts`, AGENTS.md → Billing & Plan Limits).
- **`skills/remnus/SKILL.md`:** kolon tipleri güncellendi (13 tip).
- **Tasarruf kartının tarayıcı kontrolü:** gerçek ajan çağrısı gerektirdiği için
  **P9.5**'e taşındı (Playwright onaylı) — **P9.5'te yapıldı**: proje penceresinde
  kart görünüyor ("311,5 B token tasarrufu · 76 yazıldı · 25 ms").

---
