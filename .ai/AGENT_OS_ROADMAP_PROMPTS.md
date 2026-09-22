# Remnus → "Agent OS" Yol Haritası — Chat Promptları

Hazırlanma tarihi: 2026-09-21. Kaynak: Hakan'ın 10 maddelik geliştirme listesi.

Bu dosya, geliştirme isteklerini **9 ayrı chat oturumuna** böler. Her `P#` bloğu
kendi başına yeterlidir. Promptlar sıralıdır — bağımlılıklar aşağıdaki tabloda.

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

Tek katı bağımlılık P6 → P7. Gerisi sırayı bozmadan gitmeli ama zorunluluk
değil; bir adımı atlarsan sonraki adımın o adıma yaptığı atıflar boşa düşer.

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

---

# Deploy öncesi — biriken borç (unutma listesi)

> P adımları tamamlandıkça buraya ekle. Buradaki her madde **deploy'u bloklar**.
> Son güncelleme: 2026-09-22 (P5 sonrası).

## 1. Turso'ya uygulanmamış migration'lar

Her ikisi de şu an **yalnızca `local.db`'de**. Kod bu kolonları/tabloyu okuduğu
için deploy edilirse production patlar.

| Migration | Ne ekliyor | Geldiği adım |
| --------- | ---------- | ------------ |
| `0048_access_requests` | `workspace_access_requests` tablosu (`npx remnus join` akışı) | P2 |
| `0049_agent_metrics` | `agent_activity.baseline_bytes` / `duration_ms` / `items_affected` (tasarruf kartı) | P5 |

```powershell
# Turso = PRODUCTION. Bu iki komut prod'a yazar; çalıştırmadan önce hedefi doğrula.
npx tsx src/db/apply-0048-access-requests.ts
npx tsx src/db/apply-0049-agent-metrics.ts
```

İkisi de idempotent (`CREATE TABLE IF NOT EXISTS` / `PRAGMA table_info` guard),
yani yanlışlıkla iki kez çalıştırmak zararsız. `0049` ayrıca hedef veritabanını
başlarken ekrana yazar.

## 2. Sıra kuralı: önce migration, sonra deploy

`0042` bu sırayı ters yapıp **tüm workspace'lerde her database görünümünü boş
bıraktı**; `0045` notunda da aynı uyarı var. Kural: migration Turso'ya uygulanır,
doğrulanır, **sonra** kod deploy edilir. Tersi değil.

## 3. `.env` / script tuzakları (her seferinde geçerli)

- `.env` içindeki `DATABASE_URL` **production Turso**'dur; `.env.local` onu
  `file:local.db` ile ezer ama bunu yalnızca Next.js görür. Apply script'leri
  `.env` okur → düz `npx tsx ...` **prod'a gider**.
- Yerele uygulamak için açık override şart:
  `DATABASE_URL="file:local.db" npx tsx src/db/apply-00XX-*.ts`
- `@/db` import eden script'lerde `import 'dotenv/config'` **ilk import** olmalı;
  değilse sessizce `local.db`'ye düşer ve "Turso'ya uygulandı" yalanı üretir.

## 4. Deploy'u bloklamayan ama biriken işler

- **Serena senkronu:** P5'te Serena araçları oturumda sunulmadığı için
  `mem:core` / `mem:conventions` güncellenemedi. `AGENTS.md`'deki **Agent
  Savings Metrics** bölümü ile senkronlanmalı.
- **Tasarruf kartının tarayıcı kontrolü:** P5'te görsel doğrulama yapılmadı.
  Kart `savedBytes = 0` iken bilerek hiç render edilmiyor, yani boş görmek hata
  değil — gerçek bir ajan çağrısından sonra bakılmalı.
- **`auditDays` uygulanmıyor:** plan limitlerinde ilan ediliyor ama hiçbir şey
  `agent_activity`'yi budamıyor. Budama eklendiği gün "kazanılan token" tüm
  zamanlar toplamı olduğu için **geriye doğru küçülmeye başlar**; o noktada
  pencereli toplama çevrilmeli (`src/lib/services/agentMetrics.ts`).

---
