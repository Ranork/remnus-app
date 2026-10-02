# Remnus V2 Revizeleri — Chat Promptları

> **Durum (2026-10-02): R1–R4 tamamlandı ve canlıda; R5–R8 + R8.1–R8.6 tamamlandı (commit'siz); R8.7 tamamlandı (yeni site `/`'de; eski landing `/landing-old`, `/landing-next` arşivde); R8.8 tamamlandı (commit'siz, migration yok); R8.9 tamamlandı (commit'siz, migration yok; şablon tarih açığı 2026-10-02'de kapatıldı); R9–R11 sırada.** Her prompt bitince
> kendi bölümünün sonuna "Tamamlandı" notu düşer; bu satırı da güncelle.

Hazırlanma tarihi: 2026-09-26. Kaynak: Hakan'ın "RemnusV2 Revizeler" listesi (18 madde +
2 "önemli" başlık), Agent OS yol haritası (P1–P13, `.ai/AGENT_OS_ROADMAP_PROMPTS.md`)
canlıya alındıktan ve 2026-09-25 canlı testlerinden sonra.

Bu dosya listeyi **10 ayrı chat oturumuna** böler (R8 kendi alt promptlarını üretir); en
sonda **R11** hepsinin biriktirdiği CLI ve masaüstü değişikliklerini tek seferde yayınlar.
Her `R#` bloğu kendi başına yeterlidir.

**Nasıl çalıştırılır:** Yeni bir chat aç ve şunu yaz (yalnızca numarayı değiştir):

```text
.ai/REMNUS_V2_REVISIONS_PROMPTS.md dosyasındaki "# R1 —" başlıklı bölümü oku ve
içinde tarif edilen işi baştan sona yap. Yalnızca o bölümü ve dosyanın başındaki
"Doğrulanmış bulgular" listesini oku; diğer R bloklarını okuma, onlar başka
oturumların işi. Bölümdeki kod iddialarını (dosya yolu, satır, fonksiyon adı)
uygulamadan önce koddan doğrula — dosya 2026-09-26'da yazıldı ve önceki R adımları
bazılarını değiştirmiş olabilir. İş bitince o bölümün sonuna kısa bir "Tamamlandı"
notu ve gerçekte ne yaptığının özetini ekle.
```

---

## Madde → prompt eşlemesi

| #  | Hakan'ın maddesi (özet)                                                    | Prompt        |
| -- | -------------------------------------------------------------------------- | ------------- |
| 1  | Kurulumda link otomatik açılıyor, sonra ajan aynı linki sohbete tekrar veriyor | R1            |
| 2  | Kurulumun ilk aşaması bitince "yeni chat aç, şu promptu ver" yönlendirmesi | R1            |
| 3  | Remnus, kullanıcının kendi Remnus'unda açılsın; pencere çoğalmasın         | R1            |
| 18 | Proje penceresinin üst şeridindeki yazılar çok karışık                     | R1            |
| 16 | Remnus MCP yeni chat'te 15-20 sn "connecting" kalıyor                      | R2            |
| 7  | Native (tarayıcı) select'ler yerine kendi bileşenimiz                      | R3            |
| 11 | Sayfa silme gibi yerlerde loading yok                                      | R3            |
| 13 | Genel olarak butonlarda loading/geri bildirim                              | R3            |
| 8  | Sidebar çok kalabalık; az kullanılanlar tek yerde toplanmalı               | R4            |
| 5  | Her projenin bilgi haritası kendi içinde; pano + harita iki sabit buton    | R4 (+R7)      |
| 17 | Token tasarrufu daha görünür: sidebar kartı, AI Ajanlarım modalı, panolar  | R4 (+R6)      |
| 14 | Üyelik isteği gelince sidebar'da o workspace'te gösterge                   | R5            |
| 15 | Sidebar MCP ile eklenenlerde bazen yenilenmiyor                            | R5            |
| 4  | İlk kurulumda proje panosu otomatik kurulsun, projeye özel, hep güncel, en üstte sabit | R6 (+R4) |
| 6  | Bilgi haritası sayfasında proje değiştiren select                          | R7            |
| 9  | Zoom out yapınca graph node'larına tıklanmıyor                             | R7            |
| 10 | Graph ekranında erişilebilirlik butonu çıkıyor                             | R7            |
| 12 | Graph'ta "satırları getir" beklerken loading yok                           | R7            |
| Ö1 | Genel UI polish — profesyonel, sade, bize özel; artık Notion gibi değil    | R8 (+R8.x)    |
| Ö2 | Her şey bitince tüm Remnus + MCP hızlandırma                               | R9            |
| Ö2 | Her şey bitince güvenlik testi                                             | R10           |
| —  | CLI npm publish + masaüstü (Tauri) release — her şey bitince, tek seferde  | R11 (son)     |

## Sıra ve bağımlılıklar

| #   | Prompt                                                              | Neden bu sırada |
| --- | ------------------------------------------------------------------- | --------------- |
| R1  | Kurulum akışı + proje penceresi                                     | Müşterinin ilk 5 dakikası. Bağımsız. CLI + masaüstü değişikliği içerir. |
| R2  | MCP bağlantı hızı                                                   | Kurulumdan hemen sonraki ilk izlenim. CLI'a dokunabilir → R1 ile aynı CLI sürümünde yayınlanabilir. |
| R3  | Temel UI bileşenleri (Select, Button loading, ConfirmDialog) + loading taraması | R4 ve R7 bu bileşenleri kullanacak; R8 (polish) bunları tek yerden yeniden boyayacak. |
| R4  | Sidebar yeniden düzeni + proje başına Pano/Harita butonları + tasarruf kartı | R3'ün Menu/Select'ine dayanır. R5 ve R6'nın yerleşimini belirler. |
| R5  | Sidebar canlılığı + üyelik isteği göstergesi                        | Gösterge R4'ün yeni yerleşimine oturur. |
| R6  | Proje panosu: calibrate kurar, projeye özel, güncel kalır           | R4'ün "ana pano" işaretçisine ve tasarruf bileşenine dayanır. |
| R7  | Bilgi haritası düzeltmeleri                                         | R3'ün Select'ini kullanır; R4 giriş noktasını taşımış olur. |
| R8  | UI polish: tasarım dili + temel + uygulama promptları (R8.x)        | Yapı R1–R7 ile oturduktan sonra görsel dil üzerine kurulur. Hakan'ın yön seçimi gerekir. |
| R9  | Tüm Remnus + MCP hızlandırma                                        | Hakan'ın isteği: her şey bittikten sonra. Ölçüm son kod üzerinde yapılmalı. |
| R10 | Güvenlik testi                                                      | R1'in yeni deep-link'i dahil son hali denetlesin. |
| R11 | Yayın: CLI npm publish + masaüstü (Tauri) release                   | **Son madde.** Hakan'ın kararı: her şey bitince tek seferde; R10'un denetlediği son hal yayınlanır. |

Katı bağımlılıklar: R3 → R4, R4 → R5, R4 → R6, R3 → R7, R8 → R8.x, R1–R10 → R11.
R1–R7 → R8 → R9 → R10 → R11 önerilen sıradır.

Hakan'ın elle adımları (promptlar yapmaz, raporlarında listeler): prod migration'ları deploy
günü (R4, R5, R6 gerekirse), push/deploy. CLI npm publish ve masaüstü release'i **R11'de,
en sonda** — ara adımlar yayınlamaz, R11'in "Birikenler" tablosuna satır ekler.

---

## Her prompta gömülü ortak kurallar

`AI.md` her oturumda zaten yüklü (CLAUDE.md onu import ediyor); oradaki kurallar
geçerli. Promptlar ayrıca şunları hatırlatır:

- `git status --short` ile başla; kullanıcının değişikliklerini ezme.
- Serena varsa `list_memories` → `core`, `conventions` (+ görevle ilgili olanlar).
- **Playwright'a geçmeden önce Hakan'a sor** (son çare; kilitli pencere test tarifi ve
  çıktı klasörü kuralı Claude memory'sinde).
- **`npm run build` prod Turso'ya migration uygular.** Yerel build kontrolü gerekiyorsa
  yalnız `npx next build`. `.env` içindeki Turso = prod; `@/db` import eden script'lerde
  ilk import `dotenv/config`, hedef DB'yi açıkça doğrula.
- Migration gerekiyorsa `src/db/apply-00xx-*.ts` desenini izle, `ALTER TABLE ADD COLUMN`
  tercih et (tabloyu yeniden kurmak `search_*` trigger'larını düşürür — AI.md),
  `npm run db:drift` ile kontrol et, **prod'a uygulama deploy günü Hakan'da.**
- Paket kurma/yükseltme yok (gerekiyorsa gerekçesiyle Hakan'a sor ve bekle).
- Kullanıcıya görünen her metin next-intl, 8 locale.
- Kullanıcının fark edeceği her değişiklikte `src/lib/changelog.ts` başına kayıt.
- CLI publish, masaüstü release, push, deploy yok. CLI'a (`cli/`) veya `src-tauri/`'ye
  dokunduysan yayınlama; dosyanın sonundaki **R11 → "Birikenler"** tablosuna kendi satırını ekle
  (CLI sürümü R1'in açtığı sürümde birleşir, yeniden artırma). Push/deploy'u raporda listele.

---

## Doğrulanmış bulgular (2026-09-26, kodda teyit edildi)

Promptlar bunlara dayanıyor. Tahmin değil; ama uygulamadan önce yine koddan doğrula.

1. **Erişilebilirlik butonunun kök nedeni bulundu.** `src/app/layout.tsx` vendored
   `accessibility-preference-widget`'ı `data-exclude-paths="/app,/admin,/db,/page"` ile
   yüklüyor. `/graph`, `/w`, `/dashboard` listede yok → uygulama içinde bu rotalarda
   yüzen buton görünüyor. (R7)
2. **UI bileşen kütüphanesi yok.** `src/components/ui/` yok, Radix/Base UI vb. bağımlılık
   yok; her şey elle Tailwind (v4). 18 dosyada 48 native `<select>` var. (R3)
3. **`ConfirmDialog`'un bekleme durumu yok.** `onConfirm: () => void`; onaya basınca
   diyalog anında kapanıyor, iş arkada sürüyor. (R3)
4. **MCP bağlantı zinciri iki `npx` içeriyor.** `.mcp.json` girdisi
   `npx -y remnus@<sabit sürüm> mcp` (stdio köprüsü, `cli/src/commands/mcp.js`);
   aynı anda SessionStart hook'u `npx remnus@<sabit sürüm> open` çalıştırıyor. Köprü
   açılışta ayrıca workspace haritasını yeniliyor. (R2)
5. **`init` linki tarayıcı açıldığında da yazdırıyor.** `cli/src/commands/init.js`
   ~s.121-127: `detail(url)` koşulsuz. Ajan komut çıktısını komut bittikten sonra
   görüyor ve özetlerken linki sohbete aktarıyor. `open` komutu da workspace URL'sini
   ve "open the link above" cümlesini yazdırıyor; SessionStart hook stdout'u oturum
   bağlamına giriyor. (R1)
6. **Masaüstü deep-link'i yalnız giriş için.** `src-tauri/src/lib.rs` →
   `handle_deep_link_url` sadece `remnus://auth?token=` işliyor; single-instance
   yönlendirmesi var. (R1)
7. **Erişim istekleri yalnız Üyeler sekmesinde.** `workspace_access_requests` tablosu +
   `MembersTab.tsx` + e-posta bildirimi (`kind: 'access_request'`); sidebar'da gösterge
   yok. (R5)
8. **Normal sekmede ilk değişiklik 30 sn'ye kadar gecikebiliyor.** `ActivityTracker`:
   sessiz normal sekmede ayrı change poll yok, sürümü 30 sn'lik heartbeat taşıyor;
   değişiklik görülünce 2.5 sn'ye iniyor ve 1.6× ile geri çekiliyor. Proje penceresinde
   sabit 2.5 sn. `changeVersion` şu kaynakları topluyor: `workspace_items`,
   `standalone_pages`, `databases`, `pages`, `page_comments` (`updatedAt`) ve
   `deleted_items.deletedAt`. (R5)
9. **Calibrate panoyu şartlı kuruyor.** `docs/mcp/calibrate.md` Faz 3: "status screen"
   yalnız bir database'in yaşam döngüsü/tarihi varsa; yoksa hiç pano yok. Rehber sürümü
   `calibrationGuide: 3`. Pano tipi P6/P7'den geliyor (`workspace_items.type =
   'dashboard'` + `dashboards` tablosu, blok tipleri: metric, chart, database_embed,
   list, text, links, activity; katalog `remnus://dashboard/catalog`). "Ana pano" kavramı
   yok. (R4, R6)
10. **Tasarruf kartı Türkçede "98,1 B" gösteriyor.** `AgentSavingsCard.tsx`
    `notation: 'compact'` kullanıyor; Türkçede "B" = bin, ama bayt/milyar gibi okunuyor.
    Kart sıfırken gizleniyor. AI Ajanlarım modalında ayrıntı bölümü var
    (`AgentsModal.tsx` ~s.510). (R4)
11. **Sidebar alt listesi:** tasarruf kartı, AI Ajanlarım, Bilgi haritası (aktif
    workspace'in `/graph/<id>`'si, global), Çöp Kutusu, Plan/Faturalama, PWA kur,
    Yenilikler, Ayarlar, avatar + admin + çıkış. `WorkspaceSidebar.tsx` 1824 satır.
    Proje penceresinde hesap düzeyi olanlar zaten gizli (P1). (R4)
12. **Graph:** `sigma` v3, `GraphCanvas.tsx` (`minCameraRatio: 0.03`,
    `labelRenderedSizeThreshold: 7`, `clickNode`/`doubleClickNode`/`clickStage`),
    `GraphScreen.tsx`'te 2 native select ve bekleme durumu olmayan `showRows` →
    `toggleDatabase`. (R7)

---

# R1 — Kurulum akışı ve proje penceresi

> Madde 1 + 2 + 3 + 18. Kapsam: orta-büyük. Bağımlılığı yok. CLI + masaüstü değişikliği
> içerir (yayın Hakan'da).

```text
Remnus projesinde çalışıyorsun (Next.js 16 App Router, React 19, TS strict, Drizzle +
SQLite/Turso, next-intl 8 locale). AI.md kuralları geçerli. Önce AGENTS.md →
"Project Install (`npx remnus init`)" bölümünü (özellikle §4 proje pencereleri) ve
docs/mcp/project-install.md'yi oku. Serena varsa core + conventions memory'lerini oku.
`git status --short` ile başla, kullanıcının değişikliklerini ezme. Playwright'tan önce
Hakan'a sor. `npm run build` prod'a migration uygular; build gerekiyorsa `npx next build`.
CLI'ı npm'e yayınlamak ve masaüstü release'i çıkarmak senin işin değil — raporda listele.

## Bağlam

Müşteri akışı: kullanıcı ajanına project-install.md'deki "Hand it to your agent"
promptunu verir → ajan `npx remnus init` çalıştırır → CLI tarayıcıyı açar, kullanıcı
workspace seçer → CLI dosyaları yazar ve biter. Sonra yeni bir Claude Code oturumunda
MCP araçları yüklenir, SessionStart hook'u (`npx remnus@<sabit> open`) proje
penceresini açar ve ajan calibrate eder. Hakan bu akışı canlıda denedi; dört kusur
buldu. Dördünü de bu görevde düzelteceksin.

## Görev A — Aynı bağlantı iki kez veriliyor (madde 1)

Semptom: init tarayıcıyı otomatik açıyor, kullanıcı projeyi bağlıyor; sonra ajan
sohbette aynı linki tekrar veriyor. İnsanlar ona tıklayıp projeyi ikinci kez bağlamaya
çalışabiliyor.

Doğrula ve çöz:
1. cli/src/commands/init.js (~s.121-127): tarayıcı başarıyla açılsa bile `detail(url)`
   ile install URL'si yazdırılıyor. Ajan komut çıktısını komut bittikten sonra görüyor
   ve özetlerken linki aktarıyor.
2. Aynı install linki (aynı `deviceId`) iş bittikten sonra yeniden açılınca ne oluyor?
   src/app/[locale]/install/ (page.tsx, InstallForm.tsx), src/app/api/install/ ve
   install akışının server tarafını oku, gerçekten dene. Hedef: tamamlanmış bir install
   linki ikinci kez açılırsa yeni bir bağlantı akışı BAŞLAMAMALI; "Bu proje zaten
   bağlandı — bu sekmeyi kapatıp ajanına dönebilirsin" gibi net bir son durum
   göstermeli. Süresi dolmuş link için de anlaşılır bir durum olsun.
3. SessionStart hook stdout'u Claude Code'da oturum bağlamına giriyor (Claude Code hook
   dokümantasyonundan teyit et). `open` (cli/src/commands/open.js) workspace URL'sini
   ve "open the link above" cümlesini yazdırıyor → ajan her yeni oturumda linki
   kullanıcıya aktarma eğiliminde. Hook çıktısında ajan için ne yazılacağını bilinçli
   tasarla: kullanıcı için anlamlı değilse yazma.

Hedef davranış:
- Tarayıcı açıldıysa CLI çıktısında link ya hiç görünmesin ya da "tarayıcında zaten
  açıldı; yalnızca açılmadıysa kullan" diye açıkça etiketlensin. `--no-browser`,
  `REMNUS_NO_BROWSER=1` ve "açılamadı" durumlarında link mutlaka yazılsın. Seçimini
  gerekçelendir.
- Install sayfası başarıdan sonra "ajanına dönebilirsin, bu sekmeyi kapatabilirsin"
  desin.
- project-install.md'de ajana açık kural: tarayıcı açıldıysa linki sohbete tekrar
  yazma.

## Görev B — Kurulumun ikinci aşaması için hazır prompt (madde 2)

Gerçek: `init`'i çalıştıran oturum Remnus MCP araçlarını göremez (MCP sunucuları oturum
başında yüklenir). project-install.md'deki müşteri promptu "then calibrate the
workspace" diyor ama aynı oturumda calibrate yapılamıyor; kullanıcı ne yapacağını
bilmeden kalıyor.

Hakan'ın istediği: init bittiğinde ajan kullanıcıya net şunu söylesin: "Kurulumun ilk
aşaması tamam. Yeni bir sohbet aç (veya Claude Code'u yeniden başlat) ve şunu yapıştır:
<kısa prompt>". Prompt kullanıcının dilinde olmalı.

Önerilen yaklaşım (daha iyisini bulursan gerekçesiyle sap):
- CLI'ın son çıktısına ajana hitap eden, açıkça ayrılmış bir blok ekle (ör. "FOR THE
  AGENT — tell the human, in their language:"), içinde kopyalanacak hazır prompt.
  Mevcut "Reload MCP servers…" ve "Calibrate the Remnus workspace by following…"
  metinlerini bu bloğa göre sadeleştir; iki ayrı talimat seti kalmasın.
- İkinci oturumu kendiliğinden devam ettir: hook çıktısı ajanın bağlamına girdiği için,
  .remnus/config.json'da `calibrated: false` ise hook kısa bir talimat yazabilir ("Bu
  proje henüz kalibre edilmedi; kullanıcı Remnus kurulumuna devam etmek isterse
  <calibrate URL>'yi izle"). Böylece kullanıcının yapıştıracağı prompt "Remnus
  kurulumuna devam et" kadar kısa olabilir. Yaparsan: çıktı birkaç satırı geçmesin (her
  taze oturumun bağlamına giriyor), `calibrated: true` olunca hiç yazılmasın, kalibrasyon
  kullanıcı istemeden kendiliğinden başlamasın. Claude Code hook sözleşmesini
  dokümandan doğrula (düz stdout mu, `hookSpecificOutput.additionalContext` mı).
- docs/mcp/project-install.md "Hand it to your agent" bölümünü iki aşamalı gerçeğe
  göre yeniden yaz. Aynı promptun başka kopyaları (landing, wiki, docs/mcp/README.md,
  cli/README) varsa grep ile bul, tutarlı yap.
- cli/templates/agents-section.md (AGENTS.md/CLAUDE.md'ye yazılan blok) ile çelişme.

## Görev C — Pencere nerede açılsın (madde 3)

Hakan'ın sözleri: "Remnus açılacaksa otomatik kendi Remnus'unda açılsın. Yeni bir ekran
açmak mantıklı mı bilemedim. Farklı projelerde çalışabilir, birden fazla pencere
isteyebilir ama istemez gibi düşündüm."

Mevcut: `open` → proje token'ı ile tek kullanımlık giriş linki (/api/window/ticket) →
cli/src/lib/window.js'deki proje başına izole Chromium profilinde `--app` penceresi
(workspace'e kilitli oturum). Her taze Claude Code oturumunda hook yeniden çalışıyor.

Önce araştır ve doğrula:
1. Aynı proje için pencere zaten açıkken `open` tekrar çalışınca ikinci pencere mi
   açılıyor? (Aynı `--user-data-dir` ile ikinci Chromium çağrısının mevcut sürece yeni
   pencere olarak devredildiğini teyit et.) Pencereler birikiyorsa bu bir bug.
2. Masaüstü uygulaması (src-tauri/) `remnus://` deep-link şemasını ve single-instance
   yönlendirmesini kullanıyor, ama src-tauri/src/lib.rs → `handle_deep_link_url` yalnız
   `remnus://auth?token=` işliyor. Uygulamada sekmeler var (TabBar).

Hedef davranış (öneri; gerekçeyle değiştirebilirsin):
- Masaüstü uygulaması kuruluysa proje, kullanıcının kendi (kilitsiz, tam) oturumunda o
  uygulamada açılsın — tercihen mevcut pencerede sekme olarak, yeni pencere değil. Bir
  `remnus://open?workspace=<id>` rotası: id'yi sıkı regex ile doğrula, yalnız sabit
  origin'deki `/w/<id>` yoluna git, deep-link'ten ASLA keyfi URL'ye gitme (mevcut auth
  rotasındaki yorumları oku; aynı özen). Kullanıcı giriş yapmamışsa ya da üye değilse
  uygulamanın normal akışı devreye girsin.
- CLI masaüstü uygulamasının kurulu olduğunu işletim sistemine göre güvenilir biçimde
  tespit etsin (Windows: Tauri installer'ın gerçekte yazdığı protokol kaydını kontrol
  et; macOS; Linux). Rotayı bilmeyen eski bir masaüstü sürümünde kullanıcı boş bir şey
  görmesin — nasıl ayırt edeceğini çöz (ör. sürüm tespiti) ya da güvenli fallback'i
  belgele.
- Masaüstü yoksa: izole proje penceresi, ama proje başına tek pencere — açıksa yenisini
  açma (odaklayamıyorsan en azından çoğaltma).
- Kişisel tercih (`desktop | window | browser | off` gibi) için bir yol düşün; commit
  edilen .remnus/config.json'a kişisel tercih yazma.
- Masaüstünde açılan oturum kilitli değildir → Görev D'deki şerit orada görünmez; doğru.

Not: src-tauri değişikliği yeni bir masaüstü release'i gerektirir (Hakan: tag + GitHub
Actions). `cargo check` yapabiliyorsan yap; release'i yapma. Masaüstü kabuğu
https://remnus.com/tauri-app yüklüyor — web tarafındaki kısım web deploy'uyla gelir.

## Görev D — Proje penceresinin üst şeridi (madde 18)

src/components/features/ProjectWindowBanner.tsx (layout'tan `demoBanner` slotuyla
geliyor). Hakan'ın ekran görüntüsü: tek satırda "Proje penceresi · yalnızca
Ford-Netsis-UI — hesabınız, diğer çalışma alanlarınız ve …" (kesiliyor) + "Tam
uygulamayı edinin ↗" + "Bağlantıyı kopyala" + "Bu oturumu kapat". Kalabalık, okunmuyor.

Hedef: tek bakışta anlaşılır, sakin bir gösterge. Öneri: kısa bir "Proje penceresi ·
<workspace>" etiketi; açıklama cümlesi ve eylemler tek bir bilgi/"…" popover'ında.
P1'in kuralları geçerli (AGENTS.md §4): birincil eylem çıkış değil; kopyalama ve tam
uygulama yolu erişilebilir kalmalı. Sidebar başlığına taşımak daha iyi olabilir — karar
senin, gerekçele. i18n: `Layout.projectWindow*` anahtarları, 8 locale.

## Doğrulama

1. `npm run lint -- <dosyalar>`, `npx tsc --noEmit`.
2. CLI'ı repo DIŞINDA geçici bir test dizininde yerel dev sunucuya karşı çalıştır
   (`node <repo>/cli/src/cli.js init --server http://localhost:3000`). Gerçek projelere
   ve prod'a dokunma. Çıktıyı raporda göster: link davranışı + ajan bloğu.
3. Tamamlanmış install linkini ikinci kez aç → "zaten bağlandı" durumu.
4. Hook çıktısını `calibrated: false` ve `true` için elle çalıştırıp gör.
5. `open`'ı iki kez çalıştır → tek pencere. Masaüstü rotasını test edemiyorsan açıkça
   söyle, "test edildi" deme.
6. Şeridi görsel kontrol et (Playwright için önce Hakan'a sor).

## Bitirirken

- cli/package.json sürümünü artır (CLI_VERSION oradan okunuyor), cli README'yi güncelle.
  Publish Hakan'da; R2 de CLI'a dokunacaksa aynı sürümde çıkabileceğini raporda belirt.
- changelog.ts: tek kayıt, `improved` (kurulum sonrası net yönlendirme, masaüstünde
  açılma, sadeleşen şerit).
- AGENTS.md → Project Install; docs/mcp/project-install.md; Serena core/conventions.
- scripts/ai/update-handoff.ps1; commit/push yok; bu bölümün sonuna "Tamamlandı" notu.
```

### ✅ R1 — Tamamlandı (2026-09-26, Claude; commit/push yok)

**Bulgu düzeltmeleri (koddan doğrulandı):** Bulgu 5'in hook kısmı yanlıştı — Claude Code
dokümanına göre SessionStart'ta yalnız **stdout** bağlama girer, exit 0'daki **stderr** yalnız
debug log'a gider; CLI her şeyi stderr'e yazdığı için `open`'ın "open the link above" cümlesi
ajana hiç ulaşmıyordu. Link tekrarının kaynağı `init` çıktısıydı. Ayrıca bulunan gerçek hatalar:
(1) tamamlanmış install linki yeniden açılınca form geri geliyor ve onay, hiçbir CLI'ın
almayacağı **ikinci bir token basıyordu**; (2) aynı profille ikinci `--app` çağrısı **ikinci
pencere açıyordu** (Edge ile ölçüldü: 1 → 2); (3) masaüstü uygulaması kapalıyken gelen deep-link
hiç işlenmiyordu ve açıkken her link iki kez işleniyor (plugin olayı + single-instance argv).

**A — link iki kez:** `init`/`join` linki tarayıcı açıldıysa "Only if no browser window
appeared: …" etiketiyle yazar; `--no-browser`/`REMNUS_NO_BROWSER=1`/açılamadı → düz link
(gerekçe: spawn başarısı pencerenin göründüğünü kanıtlamaz; gizlemek WSL/uzak kullanıcıyı 5 dk
bekletir). Sunucu: `getInstallLinkState` → `open|used|expired`; tüketim token'ı atomik olarak
token'sız `install-used` işaretine çevirir (7 gün); `/install` girişten önce "Bu proje zaten
bağlandı — sekmeyi kapatıp ajanınıza dönebilirsiniz" / "Bağlantının süresi doldu" gösterir,
iki server action da mint'ten önce yeniden kontrol eder. Süre, CLI'ın **sunucu saatiyle**
(`Date` başlığı) bastığı `issued` damgasından. Başarı ekranı: "sekmeyi kapatıp ajanınıza dönün".
**B — ikinci aşama:** `init` tek bir "── For the agent ──" bloğuyla biter (eski iki talimat seti
kaldırıldı): ajan kullanıcıya kendi dilinde "yeni sohbet aç ve yapıştır: Continue the Remnus
setup" der. Hook artık `open --hook`: `calibrated !== true` iken stdout'a tek paragraf (kullanıcı
isterse calibrate rehberini izle, istemeden başlama), `true` iken hiçbir şey. `agents-section.md`
aynı anlamı taşır. project-install.md "Hand it to your agent" iki aşamaya göre yeniden yazıldı;
landing prompt metni (`AgentPrompt.tsx`) docs ile zaten aynı, değiştirilmedi.
**C — pencere:** `open` sırası: masaüstü (≥ 0.1.19, Windows'ta NSIS'in gerçekte yazdığı
`HKCU\Software\Classes\remnus` + `Uninstall\Remnus\DisplayVersion`; macOS Info.plist; Linux
yalnız açık tercihle) → proje penceresi, **proje başına tek** (Chromium profil kilidi) → düz
link. Kişisel tercih `open --prefer auto|desktop|window|browser|off` (kullanıcı veri dizini,
commit edilen config'e değil), `REMNUS_OPEN` ezer. Tauri: `remnus://open?workspace=<id>`
(sıkı id kontrolü, 3 sn tekrar engeli, web hazır olana kadar bekletme, cold-start
`get_current`); web `DesktopOpenListener`: workspace zaten açıksa hiçbir şey, değilse yeni sekme.
**D — şerit:** tek sakin satır "Proje penceresi · <workspace>" + ⓘ popover (açıklama, tam
uygulama, bağlantıyı kopyala + ipucu, oturumu kapat). Sidebar'a taşınmadı: sidebar gizlenebilir,
mobilde çekmece.

**Değişen dosyalar:** cli (init, join, open, doctor, cli.js, lib/install, lib/window, lib/files,
yeni lib/desktop.js, templates/agents-section.md, README, package.json 0.1.10→**0.1.11**),
src/lib/services/installSession.ts, src/app/[locale]/install/page.tsx, ProjectWindowBanner.tsx,
yeni DesktopOpenListener.tsx, AppShell.tsx, src-tauri/src/lib.rs, messages ×8 (Install: used*/
expired*, doneHint/joinedHint; Layout: projectWindowLabel/Explain/About/CopyHint,
projectWindowNotice kaldırıldı), changelog `2026-09-26-clearer-project-setup` (improved),
docs/mcp/project-install.md, AGENTS.md (Project Install §2–§4), Serena core + conventions.

**Doğrulama:** eslint + `tsc --noEmit` temiz; `cargo check` temiz. Repo dışı test projesinde
yerel dev + local.db'ye karşı `init` (tarayıcı dalı ve `--no-browser` dalı) — link etiketi ve
ajan bloğu doğru; onay geçici bir PAT ile script'ten verildi (sonra silindi). Aynı link
ikinci kez: servis `used`, sayfa girişsiz "Bu proje zaten bağlandı"; eski `issued` →
"süresi doldu"; taze link → login, `issued` callback'te korunuyor; tüketim sonrası poll
`{ready:false}`. Hook: `calibrated:false` → stdout tek paragraf, `true` → 0 bayt,
`REMNUS_OPEN=off` → hiçbir şey açılmadı, proje dışı dizin → sessiz exit 0. `open` iki kez →
pencere sayısı 1 → 1 ("already open"); masaüstü 0.1.18 doğru okundu → pencere dalı.
Şerit, açık proje penceresinin ekran görüntüsüyle kontrol edildi (Playwright kullanılmadı).
**Test EDİLMEDİ:** masaüstü `remnus://open` rotası uçtan uca (yeni desktop build gerekiyor —
yalnız derlendi) ve şeridin popover'ı açık hâli (tıklama gerekir; Playwright için Hakan'ın onayı).

**Hakan'ın adımları:** (1) Web deploy (install ekranları, şerit, listener). (2) CLI
`remnus@0.1.11` publish ve masaüstü release (0.1.19) → **R11'e taşındı** (Hakan'ın kararı:
her şey bitince tek seferde; R11 "Birikenler" tablosunda R1 satırı ve yayın sonrası test
listesi var). (3) Mevcut projeler eski pin'de (`open`, `--hook` yok) kalır; yeni davranış
`init` yeniden çalışınca gelir. Not: landing `LandingNext.how.termDone` ("Next, I'll map the project
for you") tek oturum ima ediyor — Emir'in bölümü, dokunulmadı.
Gözlem (kapsam dışı): yeni proje penceresi profilinde Edge, Microsoft hesabı senkron
bildirimini gösteriyor (`--no-first-run` bunu bastırmıyor).

---

# R2 — MCP bağlantı hızı

> Madde 16. Kapsam: orta. Önce ölç. CLI'a dokunursa R1'le aynı sürümde yayınlanır.

```text
Remnus projesinde çalışıyorsun (Next.js 16, TS strict, Drizzle + SQLite/Turso, remote
MCP). AI.md kuralları geçerli. AGENTS.md → "Project Install" ve MCP bölümlerini oku;
Serena varsa core, conventions, tech_stack memory'lerini oku. `git status --short` ile
başla. `npm run build` prod'a migration uygular; build gerekiyorsa `npx next build`.
Token/secret değerini asla yazdırma, rapora koyma — yalnız değişken adı.

## Semptom

Hakan: yeni bir Claude Code sohbetinde Remnus MCP 15-20 saniye "connecting" durumunda
kalıyor. Bu, kurulumdan hemen sonraki ilk izlenim.

## Zincir (doğrula)

1. Claude Code, .mcp.json'daki `npx -y remnus@<sabit> mcp` ile stdio köprüsünü başlatır
   (cli/src/commands/mcp.js).
2. Köprü `initialize`'ı proje başına HTTPS uç noktasına iletir (`/api/mcp/w/<id>`,
   src/app/api/mcp/ — handler.ts, route.ts, w/). Sonra `tools/list`.
3. AYNI ANDA SessionStart hook'u ikinci bir `npx remnus@<sabit> open` çalıştırır
   (window ticket isteği + Chromium açılışı). Köprü de açılışta workspace haritasını
   yeniler (ayrı istek).
4. Sunucu her istekte token sahibinin üyeliğini ve rolünü yeniden okur
   (src/lib/services/agentAccess.ts — 2026-09-25 güvenlik düzeltmesi).

## Kural: önce ölç, sonra düzelt

Her segmenti zaman damgalarıyla ölç ve bir tablo çıkar (soğuk/sıcak ayrı):
- `npx -y remnus@<sürüm> --version` süresi (Windows'ta; soğuk + önbellekli). İki npx
  aynı anda çalışırken npm önbellek kilidi çekişmesi var mı?
- Köprünün süreç başlangıcından ilk stdin okumasına kadar geçen süre.
- `initialize` ve `tools/list` round-trip'i: yerel dev'e karşı ve prod'a karşı. Prod
  ölçümü okuma-yalnız çağrılarla sınırlı kalsın; token gerekiyorsa Hakan'dan ölçüm
  komutunu kendisinin çalıştırmasını iste ya da ona bir test token'ı yolu sor.
- Sunucu tarafı: MCP rotasının soğuk başlangıç maliyeti (import grafiği: MCP SDK, tüm
  tool kayıtları, drizzle/libsql), istek başına McpServer kurulumu ve tool kaydı, auth
  DB gidiş-dönüş sayısı.

Tahmin yürütme; sayılar olmadan "şu yavaş" deme.

## Olası düzeltme yönleri (ölçüme göre seç)

- npx: `--prefer-offline` veya eşdeğeri; köprünün doğrudan önbellekteki `node`
  yolundan çalışması; hook ile köprünün npx çağrılarının çakışmaması.
- Köprü: `tools/list` cevabını sunucu sürümüne/ETag'e bağlı yerel bir önbellekten anında
  verip arkada tazelemek (dikkat: scope'a göre tool listesi değişiyor — read-only token
  daha az tool alır; önbellek anahtarı bunu kapsamalı). `initialize`'ı yerelde cevaplamak
  protokol semantiğini bozuyorsa yapma; nedenini yaz.
- Sunucu: ağır modülleri tembel import, istek başına kurulumu küçültmek, auth
  sorgularını tek sorguda birleştirmek, fonksiyon bölgesi ile Turso bölgesinin yakınlığı.
  Isıtma (warm ping) maliyet getirir — ancak rakamla gerekçelendirirsen öner.

Kısıtlar:
- Üyelik/rol her istekte yeniden okunmalı (AI.md). Auth'u istekler arası önbelleğe alma;
  birleştir, hızlandır ama atlama.
- Mevcut projeler CLI'ın eski sürümüne sabitli (.mcp.json pin). CLI tarafı kazanım
  ancak `init` yeniden çalışınca gelir; sunucu tarafı kazanım herkese anında. İkisini
  raporda ayrı göster; `doctor`'ın "yeni sürüm var" dürtüsünün bunu kapsadığını doğrula.

Hedef: sıcak bağlantı < 3 sn, soğuk < 6 sn (ölçtüğün gerçekliğe göre revize edebilirsin
ama gerekçele).

## Doğrulama

- Önce/sonra ölçüm tablosu (aynı yöntem, aynı makine).
- Tüm MCP araçları hâlâ doğru scope'la listeleniyor; read-only token write tool almıyor.
- test:agent-access ve ilgili test script'leri geçiyor.
- lint + tsc.

## Bitirirken

- CLI değiştiyse cli/package.json sürümü (R1 aynı oturum serisinde artırdıysa tekrar
  artırmadan aynı sürümde birleştir), README. Publish Hakan'da.
- changelog.ts: kullanıcı fark ediyorsa (bağlantı belirgin hızlandıysa) tek kayıt,
  `improved`.
- Kalıcı bilgi: AGENTS.md MCP/Project Install; Serena tech_stack/conventions.
- update-handoff; commit yok; "Tamamlandı" notu.
```

### ✅ R2 — Tamamlandı (2026-09-29, Claude; commit/push yok; prod ölçümü açık)

**Ölçüm (Hakan'ın makinesi, Windows, 22 çekirdek, Türkiye):**

| Segment | Süre |
|---|---|
| `npx -y remnus@0.1.10 --version`, önbellekli | 2,6–3,0 sn (`--prefer-offline` / `--offline` fark etmiyor: npm'in kendi açılışı) |
| İlk oturum (init `remnus` spec'ini önbelleğe aldı, pin ayrı anahtar) | 3,3–3,7 sn; bridge + hook paralel, kilit çekişmesi yok |
| Aynı paket doğrudan `node` | 0,2 sn |
| 5 paralel npx (bridge, hook, playwright, context7, chrome-devtools) | ~3 sn, çekişme yok |
| Prod sıcak istek, tokensız / sahte PAT (Türkiye → fra1 → **iad1**) | ~0,45 sn |
| Prod 25 dk boşta sonra ilk istek (tokensız 401, tüm modüller yüklenir, DB yok) | 1,23 sn → soğuk başlangıç ≈ +0,8 sn |

| Metot (süreç içi, DB RTT 80 ms modeli) | Önce | Sonra | DB round-trip |
|---|---|---|---|
| initialize | 205 ms | 117 ms | 3 → 2 (paralel) |
| tools/list | 232 ms | 130 ms | 3 → 1 |
| prompts/list | 206 ms | 119 ms | 3 → 1 |
| resources/list | 398 ms | 298 ms | 6 → 4 |
| digest read | 395 ms | 297 ms | 8 → 6 |

Bağımlılık import'u düz node ile ~0,8 sn (MCP SDK 0,32, drizzle 0,28, zod 0,10, posthog 0,10);
`initialize` zaten SDK + DB'ye ihtiyaç duyduğundan tembel import kazancı küçük → yapılmadı.

**Yapılanlar (sunucu — herkese deploy anında):**
- `src/app/api/mcp/handler.ts`: context policy yalnız `initialize`'da okunuyor (body `parsedBody`
  olarak transport'a geçiyor); pinned URL'de auth ile paralel, yalnız credential varsa.
  Tool çağrıları dahil her istek bir sorgu az. `lastUsedAt` token başına dakikada bir (`touchLastUsed`).
- `vercel.json` → `"regions": ["dub1"]` (Hakan onayladı): fonksiyonlar Turso `aws-eu-west-1` yanında.
  **Deploy sonrası etkili.**
- Ölçüm araçları: `npm run bench:mcp-request`, `npm run bench:mcp-handshake`.
- Changelog `2026-09-29-faster-agent-connection` (`improved`).
- AGENTS.md (pinned endpoint invariants altı), AI.md gotcha, Serena `tech_stack` + `suggested_commands`.

**Yapılmayan — CLI (npx yerine node yükleyici):** ~2,5 sn kazandırırdı ama commit'lenen
`.mcp.json`'a `node -e "<ev dizininden kod yükle>"` koymak; hem Claude Code'un proje MCP onay
ekranında hem repoyu okuyan AI ajanlarında/tarayıcılarda tedarik zinciri saldırısı gibi görünür,
ve npm'in tarball bütünlük doğrulamasını devre dışı bırakır. `npx -y paket@sürüm` bütün MCP
sunucularının kullandığı tanınmış kalıp → korundu. CLI'a dokunulmadı; R11'e satır yok.

**Doğrulama:** eslint, tsc, `test:agent-access` 34/34, köprü üzerinden scope (write 27/16, read 11/0),
fixture token'lar local.db'den silindi, dev durduruldu (port 3000 boş).

**Prod ölçümü (Hakan, Ford-Netsis-UI, `remnus@0.1.9`, `bench:mcp-handshake`, 5 çalıştırma):**

| | Önce (iad1, 70b00f7 öncesi) | Sonra (dub1, 70b00f7) |
|---|---|---|
| tools/list | 0,5–0,9 sn | 0,22–0,32 sn |
| prompts/list | 0,5–0,9 sn | 0,28–0,35 sn (bir kez 1,47) |
| resources/list | 0,9–2,6 sn | 0,37–0,48 sn |
| sıcak initialize (≈2 sn'si npx) | ~2,4 sn | ~2,5 sn |
| toplam, sıcak medyan | 3,6 sn | 3,4 sn (en iyi 2,7) |
| ilk çalıştırma (soğuk) | 6,9 sn | 6,6 sn |

Sunucu istekleri 2–3× hızlandı (her tool çağrısı dahil). Köprü + sunucu en kötü ~6,6 sn;
Hakan'ın 15–20 sn'si burada yok → kalanı Claude Code'un açılışında. Tekrar yavaşsa
`claude --debug` MCP satırları.

**Açık / Hakan'da:**
1. (Yapıldı, yukarıda.) Deploy öncesi ve sonrası bağlı bir projede:
   `node D:\Workspace\GitHub\remnus-app\scripts\mcp-handshake-timing.mjs --project . --runs 5`
   (salt okuma, yalnız süre yazar). 15–20 sn'nin kalanı (hesaplanan: sıcak ~4–5, soğuk ~6–8 sn)
   bu ölçümle bulunacak; hâlâ yavaşsa `claude --debug` MCP bağlantı satırları.
2. Deploy sonrası sağlık: `/api/health`, tokensız MCP 401, `X-Vercel-Id` içinde `dub1`.
3. Not: paylaşılan `/api/mcp` route'u `vercel.json`'da `memory: 256` — bu uçtaki eski/OAuth
   istemcilerin bcrypt ve soğuk başlangıcı yavaş olabilir; maliyet kararı, R9'a.

---

# R3 — Temel UI bileşenleri ve loading durumları

> Madde 7 + 11 + 13. Kapsam: orta-büyük (geniş dokunuş, sığ değişiklik). R4, R7 ve R8
> buna dayanır.

```text
Remnus projesinde çalışıyorsun (Next.js 16, React 19, TS strict, Tailwind v4, next-intl
8 locale). AI.md kuralları geçerli; özellikle "Workspace UI flat/borderless ve üç
katmanlı neutral palette" kuralı. Serena varsa core + conventions oku. `git status
--short` ile başla. Playwright'tan önce Hakan'a sor.

## Bağlam

Remnus'ta bir UI bileşen kütüphanesi yok: src/components/ui/ yok, Radix/Base UI vb.
yok, her şey elle Tailwind. Sonuç: tarayıcının native select'leri uygulamanın geri
kalanından kopuk görünüyor ve async butonların çoğu basıldığında hiçbir geri bildirim
vermiyor. Bu görev bir temel kurar; ileride R8'deki UI polish çalışması bu bileşenleri
tek yerden yeniden boyayacak. Bu yüzden görsel dili şimdi DEĞİŞTİRME — mevcut paletle
tutarlı yap, yeniden tasarlama.

## Karar 0 — Bağımlılık (kod yazmadan önce Hakan'a sor ve bekle)

AI.md paket kurmayı yasaklıyor. İki yol var:
(a) Erişilebilir bileşenleri elle yazmak (listbox deseni: klavye, typeahead, aria,
    portal, konumlandırma, dışarı tıklama/Escape, modal içinde z-index).
(b) Headless bir kütüphane (ör. Base UI, Radix, Ariakit): Select, Menu, Popover, Dialog,
    Tooltip hazır ve erişilebilir gelir; R4 (menü) ve R8 (tasarım sistemi) de bunlara
    ihtiyaç duyacak.
Önerim (b) — ama bundle etkisini, React 19 uyumunu ve bakım durumunu kısa bir tabloyla
Hakan'a sun, seçimini bekle.

## Görev A — Primitifler

src/components/ui/ altında (isimleri projenin stiline uydur):
- `Select` — tek seçim; opsiyonel arama; ikon/renk noktası taşıyan seçenekler (mevcut
  kullanım yerlerini oku, neye ihtiyaç var gör); disabled; boş durum; mobilde kullanılabilir.
- `Button` — variant'lar (mevcut kullanımlardan çıkar: primary, secondary, ghost,
  danger), `loading` prop'u: spinner, `disabled`, `aria-busy`, genişlik zıplamasın.
- `ConfirmDialog` (src/components/features/ConfirmDialog.tsx) — async `onConfirm`
  destekle: iş bitene kadar diyalog açık kalsın, onay butonu loading, hata olursa
  diyalogda göster. Mevcut senkron kullanımlar bozulmasın.
- Gerekirse `Menu`/`Popover` — R4 kullanacak; burada yalnız gerekirse ekle.

## Görev B — Native select'lerin değiştirilmesi (madde 7)

18 dosyada 48 native `<select>` var. Liste (doğrula):
OAuthAuthorizeForm, InviteManager, InviteStatusTable, AdminUsersTable, BulkRowsDialog,
DashboardBlockEditor, CalendarLayoutSection, FiltersSection, GroupingLayoutSection,
KanbanLayoutSection, PropertiesPanel, SortsSection, DatabasePropertiesSidebar,
GraphScreen, KnowledgeContextPanel, TableLayout, MembersTab, PortabilityTab.
Hepsini yeni Select'e taşı. İstisna yapacaksan (ör. native'in gerçekten daha iyi olduğu
bir yer) gerekçesini yaz. Auth/consent sayfalarının rounded-card stili bilinçli
istisnadır (AI.md) — orada da Select kullan ama o stilde.

## Görev C — Loading taraması (madde 11 + 13)

Hakan: "Sayfa silme gibi yerlerde loading yok. Biri bir butona bastığında ne işlem
olduğunu anlamıyor."
- Önce Hakan'ın örneğini yeniden üret: sidebar silmesi zaten optimistik
  (WorkspaceSidebar `confirmDelete` → `setLoadingItem` + anında kaldırma). Şikâyet büyük
  olasılıkla sayfa içi "…" menüsünden silme, database satırı silme, toplu silme veya
  çöp kutusu işlemleri — hangisi olduğunu bul.
- Sonra sistematik tara: server action çağıran her onClick/onSubmit; `useTransition`/
  `isPending`/loading state'i olmayanları listele. En az şu aileler: sayfa/satır/toplu
  silme, çöp kutusu geri yükleme/kalıcı silme, üye davet/çıkarma/rol değişimi, erişim
  isteği onay/red, token oluşturma/iptal, ayarlar kaydetme, içe/dışa aktarma, pano blok
  işlemleri, şablon uygulama, faturalama butonları.
- Her biri için doğru desen: optimistik ise hata durumunda geri al + bildir; değilse
  Button `loading` ya da ConfirmDialog pending. Aynı işlemin iki kez tetiklenmesini
  engelle (çift tıklama).
- Graph'taki "satırları getir" R7'nin işi — dokunma.
- Raporda bir tablo: yer → önce → sonra.

## Doğrulama

- lint + tsc.
- Klavye ile Select: Tab, ok tuşları, Enter, Escape, typeahead. Modal içinde doğru
  katmanda açılıyor, sayfa kaydırılınca doğru yerde.
- Tüm temalarda (default, dracula, tokyo-night, nord, catppuccin/açık) Select ve Button
  okunaklı.
- Yavaş ağda (DevTools throttling) en az 5 farklı async butonun geri bildirimini gör.
- Mobil genişlikte Select kullanılabilir.

## Bitirirken

- changelog.ts: tek kayıt, `improved` (işlem sürerken butonlar ne olduğunu gösteriyor,
  seçim menüleri uygulamanın geri kalanıyla uyumlu).
- AGENTS.md + Serena conventions: "yeni UI'da native select yok, src/components/ui
  primitifleri kullanılır, async buton loading gösterir" kuralı.
- update-handoff; commit yok; "Tamamlandı" notu.
```


### ✅ R3 — Tamamlandı (2026-09-29, Claude; commit/push yok)

**Karar 0 (Hakan):** shadcn/ui. Base UI tabanlı (`components.json` style `base-nova`); yeni bağımlılıklar
`@base-ui/react` 1.8, `class-variance-authority`. CLI'ın eklediği yanlış `cn` paketi kaldırıldı,
`cn` = `src/lib/cn.ts` (clsx + tailwind-merge, zaten vardı).

**Primitifler:** `src/components/ui/{select,button,dialog}.tsx`. `SimpleSelect` (options, ikon/renk noktası,
size xs/sm/default, title/style/stopPropagation), `Button` (primary/secondary/ghost/danger, `loading`),
`ConfirmDialog` async `onConfirm` (spinner, butonlar+Escape tutulur, hata diyalogda, başarıda meşgul kalır →
çağıran kapatır). Renkler uygulama paleti; shadcn token sınıfları (`bg-popover`…) tanımsız → şeffaf render ettiği
için (Hakan'ın ekran görüntüsü) tamamen kaldırıldı. `UI` i18n namespace'i 8 dilde.

**Select taşıma:** 18 dosyada 48 native select → 46'sı `SimpleSelect` (DashboardBlockEditor 15, CalendarLayout 6,
…). İstisna: OAuthAuthorizeForm'da gerçek select yok (yorum satırıydı). Kalan `<select`: 0.

**Loading taraması (önce → sonra):**
| Yer | Önce | Sonra |
|---|---|---|
| Satır sayfası silme (PageEditor) — Hakan'ın örneği | diyalog anında kapanıyor, silme+yönlendirme sırasında hiçbir şey | diyalog açık, spinner, Escape/çift tık tutulur, sonra yönlendirir (Playwright, 3 sn gecikmeyle doğrulandı, tek POST) |
| Paylaşımı kaldır (SharingTab, ShareModal) | diyalog kapanır, geri bildirim yok | spinner'lı diyalog |
| Pano bloğu sil (DashboardBlockActions) | diyalog kapanır, ikonlar soluk | spinner'lı diyalog |
| Tekrarlayan kart kapsam diyaloğu | onay butonu tepkisiz, çift tık mümkün | `Button loading`, iptal/Escape tutulur |
| Davet iptali (MembersTab) | tepkisiz | satırda spinner |
| Satır sil (DatabaseView.handleDeletePage) | iyimser, hata olursa satır ekrandan kayboluyor | hata olursa geri koyar |
Zaten doğru olanlar (dokunulmadı): çalışma alanı silme, üye çıkarma/devir, erişim isteği, token iptali, çöp kutusu
geri yükleme, sürüm geri yükleme, faturalama, toplu ekleme.

**Ek düzeltmeler (Hakan'ın bildirdikleri):** açık temada editör h1/h2 sabit `color: white` idi (görünmüyordu) →
`[data-theme="catppuccin"]` için `neutral-50`; select popup şeffaflığı (yukarıda).

**Doğrulama:** tsc, eslint (0 hata; uyarılar önceden var), Playwright (yerel dev + local.db, demo kullanıcı):
modal içinde açılma (z-9999), klavye ok/Enter/Escape, typeahead, 5 tema, 375 px genişlik (trigger sıkışması
düzeltildi), async ConfirmDialog. Eksik: DashboardBlockEditor ve 5 tema × tüm sidebar select'lerinin tek tek
görsel turu; Base UI typeahead `ü`/`u` ayrımı yapmıyor.
**Açık:** R8'de `src/components/ui/` yeniden boyanacak (tek yer). Çalışma ağacı: commit'siz (R2'den sonraki tüm iş).

---

# R4 — Sidebar yeniden düzeni, proje başına Pano/Harita, tasarruf kartı

> Madde 8 + 5 + 17 (sidebar ve modal kısmı). Kapsam: büyük. R3'e bağımlı. R5 ve R6 buna
> dayanır. Muhtemelen migration içerir.

```text
Remnus projesinde çalışıyorsun (Next.js 16, React 19, TS strict, Drizzle +
SQLite/Turso, next-intl 8 locale). AI.md kuralları geçerli. AGENTS.md → Project
Install §4 (proje penceresi UI kuralları) ve sidebar ile ilgili bölümleri oku; Serena
varsa core + conventions. `git status --short` ile başla. src/components/ui/ altındaki
R3 primitiflerini kullan. Playwright'tan önce Hakan'a sor. Migration kuralları: apply
script deseni, ALTER TABLE ADD COLUMN, `npm run db:drift`; prod'a uygulama Hakan'da;
`.env` Turso = prod, hedef DB'yi doğrula.

## Bağlam

src/components/features/WorkspaceSidebar.tsx (~1824 satır). Alt kısımda sırayla:
tasarruf kartı (AgentSavingsCard), AI Ajanlarım, Bilgi haritası (aktif workspace'in
/graph/<id>'si — global, workspace'e ait değil), Çöp Kutusu, Plan/Faturalama, PWA kur,
Yenilikler, Ayarlar, avatar + admin + çıkış. Hakan: "Sidebar çok dolu, her şey üst üste
biniyor, yer kalmıyor. Çok kullanılacak olanları bir buton halinde bir yere koyarız ama
diğer her şeyi seçenekler gibi bir yere toplamamız şart."

## Görev A — Alt kısmın sadeleşmesi (madde 8)

- Sidebar içerik için: workspace ağaçları alanın çoğunu almalı.
- Az kullanılanları tek bir hesap/menü noktasında topla (avatar satırı → menü, ya da
  bir "Daha fazla" menüsü): Ayarlar, Plan/Faturalama, Çöp Kutusu, Uygulamayı kur (PWA),
  Yenilikler, admin, tema/dil (varsa), çıkış. Rozetleri (Yenilikler okunmamış sayısı,
  çöp sayısı) menü girişine ve toplam bir noktaya taşı ki kaybolmasın.
- Dışarıda ayrı buton olarak kalacaklara SEN karar ver ve gerekçele (aday: AI Ajanlarım —
  ürünün özü). En fazla 1-2 tane.
- Proje penceresi kuralları (P1, AGENTS.md §4) aynen geçerli: hesap düzeyi girişler orada
  render edilmez (CSS ile gizleme değil, koşullu render; ilgili sunucu çağrıları da
  çalışmasın).
- MobileNavWrapper'daki mobil karşılığını da aynı mantıkla düzenle.

## Görev B — Proje başına sabit Pano + Harita (madde 5, madde 4'ün "en üstte sabit" kısmı)

Hakan'ın fikri: her projenin (workspace'in) içinde, ağacın en üstünde yan yana iki sabit
buton — Pano ve Bilgi haritası. "Ayrı sayfalar gibi değil, butonla açılan sayfalar
gibi. Fikrim iyi olmayabilir, en iyisini sen düşün."
- Öneri: workspace başlığının altında, ağaçtan önce, kompakt iki butonluk bir satır.
  Açık/aktif durumları rota ile senkron (/dashboard/<id>, /graph/<workspaceId>).
  Daha iyi bir yerleşim bulursan gerekçele.
- Global "Bilgi haritası" butonunu kaldır; harita artık her workspace'in içinden açılır.
- "Ana pano" kavramı bugün yok. Bir workspace'in ana panosunu işaret eden kalıcı bir
  alan ekle (öneri: `workspaces.home_dashboard_item_id`, nullable, silinince boşalsın).
  Migration + apply script + drift. Servis fonksiyonu `setHomeDashboard(workspaceId,
  itemId)` (yetki: workspace'e yazma; kilitli pencerede izinli olmalı → AGENTS.md §4
  opt-in desenine uy). R6 bunu MCP'ye bağlayacak; burada MCP'ye dokunma.
- Ana pano ağaçta ikinci kez görünmesin mi? Karar ver (öneri: ağaçta gizle, pinned
  buton onu temsil eder; silme/yeniden adlandırma pano başlığından yapılabilir olsun).
- Ana pano yoksa Pano butonu: pano oluştur + ana pano yap (mevcut "Boş Pano" yolunu
  kullan). R6 bunu otomatik içerikli hale getirecek.
- Kalibrasyon sırasında oluşturulmuş eski panolar: workspace'te tam bir pano varsa onu
  ana pano yapan tek seferlik bir backfill mantıklı mı? Değerlendir; yaparsan apply
  script'inde, idempotent.

## Görev C — Tasarruf kartı görünürlüğü (madde 17, sidebar + modal)

Hakan: "Token tasarrufu daha iyi görünmeli, AI ajanlarım modalında yukarıda kart
şeklinde olmalı, daha göze hitap eden bir şekilde ki dikkat çeksin. Sidebar'da bile
kart gibi olabilir, sen karar ver."
- Kaynak: src/components/features/AgentSavingsCard.tsx, AgentsModal.tsx (~s.510
  ayrıntı bölümü), src/lib/services/agentMetrics.ts. Metriklerin dürüstlük kuralı
  (her sayının tooltip'te dayanağı var) korunmalı.
- Türkçede "98,1 B" okunmuyor (compact notation, B = bin). Birimi açık yaz: "98,1 bin
  token" gibi; tüm locale'lerde doğru okunduğunu kontrol et.
- Tek bir bileşen, üç yüzey: `sidebar` (kompakt kart), `modal` (üstte hero kart),
  `dashboard` (R6 pano bloğu olarak kullanacak — API'yi buna uygun tasarla).
- Sıfırken gizleme kuralını koru ya da yerine dürüst bir "ilk ajan oturumundan sonra
  burada" durumu koy — karar senin.

## Doğrulama

- lint + tsc; migration yerel DB'de uygulanır, `npm run db:drift` temiz.
- Normal oturum, proje penceresi (kilitli) ve mobil genişlik: üçünde de görsel kontrol.
- Pano/Harita butonları: ana pano varken, yokken, silinince; birden fazla workspace.
- Tüm temalarda kart okunaklı.

## Bitirirken

- changelog.ts: kullanıcı fark eder — tek kayıt (`improved`): sade sidebar, her projede
  pano ve harita kısayolu, görünür tasarruf.
- AGENTS.md (sidebar düzeni, ana pano alanı, proje penceresi kuralları), Serena
  core/conventions. Migration notunu "deploy günü uygulanacaklar" olarak raporla.
- update-handoff; commit yok; "Tamamlandı" notu.
```

### ✅ R4 — Tamamlandı (2026-09-29, Claude; commit/push yok)

**Görev A — alt kısım.** Sıra: tasarruf kartı → AI Ajanlarım (dışarıda kalan tek buton: ürünün özü) →
tek hesap satırı (`AccountMenu.tsx`, avatar+ad, yukarı açılan menü): Ayarlar, Plan ve Faturalama (tier rozeti),
Çöp Kutusu (sayı), Uygulamayı yükle, Yenilikler (okunmamış sayı), Admin (yalnız admin), Çıkış.
Okunmamış Yenilikler avatarda kırmızı nokta olarak da görünür. `WhatsNewButton`/`PwaInstallButton` hook'a
çevrildi (modal menü kapanınca ölmesin diye çağıran render eder). Proje penceresi: menüde yalnız Çöp Kutusu +
Yenilikler; AI Ajanlarım/Ayarlar/Faturalama/Kurulum/Admin/Çıkış koşullu render ile hiç yok (kilitli pencerede
doğrulandı). Mobil kullanıcı sayfasına Çöp Kutusu + Yenilikler eklendi (aynı bölünme).

**Görev B — Pano + Harita.** Her açık çalışma alanının en üstünde `WorkspaceQuickLinks` (iki buton, rota ile
senkron aktif durum); global "Bilgi haritası" butonu kaldırıldı. Ana pano: `workspaces.home_dashboard_item_id`
(migration **0054**, `src/db/apply-0054-home-dashboard.ts`, idempotent, `ALTER TABLE ADD COLUMN`; `db:drift` temiz).
**Bilinçli tasarım: FK yok**, okuma anında doğrulanır (`HOME_DASHBOARD_SQL`: öğe var + dashboard + aynı workspace),
böylece pano silinince düğme "oluştur"a döner, çöp kutusundan geri yüklenince (aynı id) kendiliğinden geri gelir —
ikisi de Playwright'ta doğrulandı. Pano yoksa düğme boş pano oluşturup ana yapar (`openOrCreateHomeDashboard`,
lock opt-in). Ana pano ağaçta gizli; silme pano başlığında (async ConfirmDialog → `/w/<id>`), yeniden adlandırma
zaten başlıkta. `setHomeDashboard` servisi + `setWorkspaceHomeDashboard` action hazır; MCP'ye dokunulmadı (R6).
Backfill: tam olarak 1 panosu olan workspace o panoyu ana pano yapar (birden fazlaysa dokunulmaz); yerelde 0 satır
etkilendi, prod'da etkisi deploy günü görünür.

**Görev C — tasarruf kartı.** Tek bileşen, 3 yüzey: `sidebar` (kompakt kart, sıfırken gizli), `modal` (AI
Ajanlarım'ın en üstünde hero; sıfırken dürüst "ilk oturumdan sonra" notu), `dashboard` (R6 için, kendi verisini
çeker). Sayı artık `compactDisplay:'long'` ile yazılı ("98,1 bin", "98.1 thousand", "9.8万"); her rakamın dayanağı
hero'da görünür metin, sidebar'da tooltip. Eski modal alt bölümü kaldırıldı.

**Yol boyu düzeltmeler.** `HOME_DASHBOARD_SQL` ilk halinde tek tablolu sorguda `id`'yi yanlış bağlıyordu (isHome hep
false) — Playwright yakaladı, tabloyu elle yazarak düzeltildi. Silme sonrası `/`'e (pazarlama sayfası) gidiyordu →
`/w/<id>`. shadcn CLI yine sahte `cn` paketi ekledi → kaldırıldı (`ui/dropdown-menu.tsx` elle, palet sınıflarıyla).

**Doğrulama:** tsc, eslint (0 hata; uyarı sayısı 47→46), test:workspace-deletion 13, test:trash-links 32,
test:agent-access 34, test:access 28. Playwright (yerel dev + local.db, demo kullanıcılar; fixture ve seed satırları
silindi): normal oturum, Pano oluştur/aç/sil/geri yükle, hesap menüsü, kilitli proje penceresi (ticket akışı),
mobil 375 px (menü sheet'in önünde), tasarruf kartı sidebar+modal (geçici audit satırlarıyla), açık + 3 koyu tema.
Eksik: çok çalışma alanlı hesapta yan yana Pano satırları, Tauri.

**Deploy (2026-09-29, Claude, Hakan'ın onayıyla):** migration 0054 prod Turso'ya koddan ÖNCE uygulandı (180 workspace, backfill 1 ana pano), `db:drift` prod OK, `78ddf07` push → Vercel success; canlı `/api/health` 200, tokensız MCP 401, `/app` 307.

---

# R5 — Sidebar canlılığı ve üyelik isteği göstergesi

> Madde 15 + 14. Kapsam: orta. R4'e bağımlı (göstergenin yeri). Önce yeniden üret.

```text
Remnus projesinde çalışıyorsun (Next.js 16, React 19, TS strict, Drizzle +
SQLite/Turso). AI.md kuralları geçerli. AGENTS.md → Project Install §4 (canlılık
mekanizması, P1'den) ve erişim isteği akışını (P2) oku; Serena varsa core +
conventions. `git status --short` ile başla. Playwright'tan önce Hakan'a sor.

## Bağlam — mevcut mekanizma (P1, doğrula)

- src/components/providers/ActivityTracker.tsx: 30 sn heartbeat (POST
  /api/activity/ping) + ayrı change poll (GET /api/activity/changes, ~20 bayt).
  Sessiz normal sekmede change poll YOK — sürümü heartbeat taşır; değişiklik görülünce
  2.5 sn'ye iner, 1.6× ile geri çekilir. Proje penceresinde sabit 2.5 sn. Sekme
  gizliyken durur.
- src/hooks/useWorkspaceEvents.ts: sürüm ilerleyince `router.refresh()`; düzenleme
  sürerken (modal/picker/yazma) erteler.
- src/lib/services/changeVersion.ts: `workspace_items`, `standalone_pages`,
  `databases`, `pages`, `page_comments` için max(updatedAt) + `deleted_items.deletedAt`.
- Maliyet kısıtı (P1): koşulsuz sık `router.refresh()` poll'u maliyet yüzünden
  kaldırıldı; geri getirme. Boşta duran sekmenin maliyeti artmamalı.

## Görev A — "Bazen yenilenmiyor" (madde 15)

Hakan: "Herkes MCP ile çalışırken bir şeyler eklediğinde sidebar düzgün yenilenmiyor.
Aslında oluyor ama bazen olmuyor gibi."

Önce yeniden üret (bir sekmede uygulama açık, başka yoldan — MCP tool çağrısı veya
ikinci oturum — değişiklik yap; normal sekme ve proje penceresi ayrı ayrı). Hipotezler
(her birini kanıtla ya da ele):
1. Normal sekmede ilk değişiklik 30 sn'ye kadar görünmüyor (tasarım gereği) → kullanıcı
   "yenilenmedi" sanıyor.
2. Sürümü artırmayan değişiklikler: workspace yeniden adlandırma/ikon (`workspaces`),
   yeni üyelik → yeni workspace'in görünmesi (`workspace_members`), pano spec
   düzenlemesi (`dashboards` — `workspace_items.updatedAt` de artıyor mu?), database
   view değişiklikleri, taşıma/sıralama (parentId/sortOrder değişince updatedAt
   artıyor mu?), knowledge metadata, erişim istekleri. Hangi MCP yazma yolu hangi
   kolonu güncelliyor — tablo çıkar.
3. `router.refresh()` geliyor ama sidebar yerel state'i (`localItems`) yeni props'la
   senkronlanmıyor (useState'in yalnız ilk props'u alması klasik hatası) veya TanStack
   Query önbelleği geçersiz kılınmıyor.
4. Erteleme kapısı takılı kalıyor (modal/picker algılaması yanlış pozitif; `paused`
   hiç düşmüyor).
5. Legacy TEXT zaman damgası (epochMax koruması) veya saat farkı yüzünden sürüm geri
   gidiyor gibi görünüyor.

Düzelt: bulduğun gerçek nedenler. İlk tespit gecikmesini de düşür — ör. heartbeat
cevabı "son N dakikada bu kullanıcının workspace'lerinde ajan aktivitesi var"
(`agent_activity`) bilgisini taşısın ve o sürece normal sekme de hızlı moda geçsin; ya
da görünür + odaklı + son 2 dk'da etkileşimli sekmede daha sık ucuz poll. Seçtiğin
yolun maliyetini hesapla ve rapora yaz: kullanıcı başına saatlik istek sayısı, Vercel
fonksiyon çağrısı ve Turso okuma etkisi. Hedef: ajan yazdıktan sonra, kullanıcı o
workspace'e bakıyorsa ~3 sn içinde sidebar güncel.

## Görev B — Üyelik isteği göstergesi (madde 14)

Hakan: "Workspace'e üye olma isteği geldiğinde sidebar'da o workspace'te bir bildirim/
gösterge çıkmalı ki istek geldiği anlaşılsın."
- Kaynak: `workspace_access_requests` (status='pending'), MembersTab.tsx, e-posta
  bildirimi zaten var.
- Owner/admin (istekleri onaylayabilen roller — koddan doğrula) kendi workspace
  satırında sayı/nokta rozeti görsün; tıklayınca WorkspaceSettingsModal Üyeler
  sekmesinde açılsın (`setSettingsInitialTab('members')` deseni var). R4'ün yeni
  yerleşimine uygun yer seç; hesap menüsünde toplam bir işaret de mantıklı olabilir.
- Yetki: istekleri göremeyen roller sayıyı da görmemeli (sunucu tarafında filtrele,
  istemcide değil).
- Canlı olmalı: yeni istek sayfa yenilenmeden görünsün — değişiklik sürümüne dahil et
  veya sidebar verisiyle gelsin; ek bir sık poll ekleme.
- Proje penceresinde (kilitli oturum) davranış: AGENTS.md §4 ile tutarlı karar ver.

## Doğrulama

- Görev A'daki her hipotez için "kanıtlandı/elendi" + kanıt.
- Gerçek canlı test: fare hareket ederken MCP ile sayfa oluştur/sil/taşı/yeniden adlandır,
  database şeması değiştir, pano düzenle → her biri için kaç saniyede göründüğü tablosu.
  Koda bakıp "çalışıyor" deme.
- Boşta sekmenin ağ trafiği artmadı (DevTools Network, 5 dk).
- `npm run test:access` + gerekiyorsa yeni test; lint + tsc.
- İki kullanıcıyla: biri istek atar, diğerinin sidebar'ında rozet yenilemesiz belirir.

## Bitirirken

- changelog.ts: tek kayıt (`improved`/`new`): ajan değişiklikleri sidebar'a hızlı
  yansıyor, erişim istekleri sidebar'da görünüyor.
- AGENTS.md §4 canlılık notu + Serena core/conventions.
- update-handoff; commit yok; "Tamamlandı" notu.
```

### ✅ R5 — Tamamlandı (2026-09-30, Claude; commit/push yok, migration yok)

**Hipotezler (yerel dev + local.db, Playwright + gerçek MCP HTTP çağrıları):**
1. *Normal sekmede ilk değişiklik 30 sn'ye kadar* — **kanıtlandı.** Boşta sekmede MCP `create_page` 13,0 sn'de
   (sonraki heartbeat'te) göründü (en kötü 30 sn).
2. *Sürümü artırmayan yazmalar* — **kısmen kanıtlandı.** 16 MCP yazma aracının **hepsi** sürümü artırıyor (ajan
   taraması, dosya:satır listesi). Açıklar web tarafındaydı: sidebar sıralama/sürükle-iç içe/başka workspace'e taşıma,
   workspace adı/ikonu/ana pano, yeni üyelik (onay/davet/katılma), erişim isteği, satır sıralama, yorum silme,
   `createWorkspace` (TEXT default). Knowledge metadata bilinçli olarak dışarıda (P10 ölçümü).
3. *`localItems` props'la senkronlanmıyor* — **elendi.** İki senk efekti var; temp-öğe atlaması ikinci efektin tam
   değiştirmesiyle telafi ediliyor. Önbellek (`unstable_cache`/`use cache`) yok.
4. *Erteleme kapısı takılı* — **elendi** (15 sn tavanlı, release timer'lı). Tek kenar durum düzeltildi: pencere dışında
   bırakılan basış `pointerup` almayabiliyordu → `blur` sıfırlıyor.
5. *Legacy TEXT / saat* — **elendi** (`epochMax` koruması). **Ama asıl "bazen" nedeni bulundu:** sürüm **saniye**
   çözünürlüklü; aynı saniyedeki ikinci yazma sürümü artırmıyor (ölçüldü: 0,8 sn arayla iki `create_page` → aynı `v`).
   Poll iki yazmanın arasına düşerse ikinci öğe **bir sonraki yazmaya kadar hiç görünmüyordu**. Aynı açık SSR ile ilk
   ping arasına düşen yazmada da vardı. Canlı testte 8 aynı-saniye çiftinden 2'sinde yarış oluştu, düzeltme ikinci
   öğeyi 2,6 sn sonra getirdi.
6. *(bulgu)* Mobil çekmece gizli ikinci bir `WorkspaceSidebar` bağlıyor → her değişiklikte **iki** RSC yenilemesi
   (aynı milisaniyede çiftler ölçüldü). Artık tek sürücü.

**Yapılan:** `changeVersion` 7. dal `workspaces.updated_at` + `touchWorkspaces()` (web açıkları + erişim istekleri +
üyelik); `heartbeatSignals` (ping `agent: true` → normal sekme 3 dk boyunca 2,5 sn); pencere `focus`'unda anında kontrol;
`renderedAt` + `mayPredateRender` ile "settle" yenilemesi; yalnız masaüstü sidebar yeniler. Görev B: `getWorkspaces`
sahip için SQL'de `pendingAccessRequests` sayar (proje penceresinde 0), workspace satırında kırmızı sayı rozeti →
Ayarlar/Üyeler sekmesi; yeni i18n anahtarı `Workspace.accessRequestsPending` (8 dil).

**Canlı ölçüm (yazma bitişi → sidebar'da görünme, dev):** boşta sekme 13,0 sn (≤30) · boşta + pencereye dönüş
(focus) 2,0 sn (focus'tan 0,8 sn) · ajan aktifken: oluştur 3,3 · yeniden adlandır 3,4 · taşı 2,3 · sil 3,5 · database
oluştur 3,2 · şema değişikliği → yenileme 1,6 · pano oluştur 2,2 · pano düzenle 1,9 · workspace adı (başka yoldan)
1,1 sn. Erişim isteği rozeti ≤5 sn'de belirdi, onayla kalktı; onaylanan ikinci kullanıcının sidebar'ına workspace
3,8 sn'de geldi (sayfa yenilemesiz). Boşta 5 dk: 10 ping, 0 poll (değişmedi).

**Maliyet:** boşta sekme aynı (saatte 120 ping); ping'e bir batch sorgusu eklendi (ajan probu index seek + LIMIT 1,
workspaces dalı PK). Ajan son 3 dk'da çalıştıysa ve sekme görünürse: saatte ~1.440 `changes` çağrısı (proje
penceresiyle aynı; ~20 bayt gövde) = kullanıcı başına ajan-saati başına +1.440 Vercel fonksiyon çağrısı. Turso okuması
çağrı başına workspace'lerdeki satır sayısı kadar (`epochMax` indeks max optimizasyonunu kullanamıyor — 500 öğelik
workspace'te ~1k satır → ajan-saati başına ~1,4 M satır okuma) → **R9 adayı**. RSC yenilemeleri: önce değişiklik başına 2
(çift sidebar), şimdi 1 (+ aynı saniyeye düşerse 1 settle; ölçüm 9 patlamada 16 yenileme).

**Bilinen açıklar:** üyelikten *çıkarılan* kişinin sekmesi canlı güncellenmez (sürüm yalnız dal kaybeder); Tauri
`TabHost` settle yapmıyor; gizlenmiş workspace'in rozeti "gizlileri göster" kapalıyken görünmez. Proje penceresinde
rozet: sunucu 0 döner + UI `!isProjectWindow` (koddan doğrulandı; kilitli pencere canlı test edilmedi).

**Doğrulama:** tsc, eslint (0 hata), test:access 28/28, test:agent-access 34/34, Playwright canlı testler yukarıda.
Test token'ları silindi; demo kullanıcılar 6 saatte temizlenir. Dokümantasyon: AGENTS.md → Live refresh + §5 rozet,
Serena `conventions`/`core`. Changelog: `2026-09-30-live-sidebar-and-access-requests`. CLI/src-tauri'ye dokunulmadı.

---

# R6 — Proje panosu: kalibrasyon kurar, projeye özel, güncel kalır

> Madde 4 + 17 (pano kısmı). Kapsam: büyük. R4'e bağımlı (ana pano alanı + tasarruf
> bileşeni).

```text
Remnus projesinde çalışıyorsun (Next.js 16, TS strict, Drizzle + SQLite/Turso, remote
MCP). AI.md kuralları geçerli. AGENTS.md → dashboard ve Project Install bölümlerini;
docs/mcp/calibrate.md, docs/mcp/dashboards.md, docs/mcp/playbooks.md ve
docs/mcp/playbooks/ klasörünü; src/lib/dashboard/ (schema.ts, catalog.ts, data.ts),
src/lib/services/dashboards.ts ve src/components/features/dashboard/ klasörünü oku.
Serena varsa core + conventions. `git status --short` ile başla. Playwright'tan önce
Hakan'a sor. Gerçek müşteri projelerine ve prod'a dokunma.

## Hakan'ın isteği

"Remnus ilk kurulumda dashboard'ı kendisi kurmalı ve sürekli güncellemeli. Güzel bir
tasarım olmalı, bizim tasarımlarımıza uygun. Herkesin dashboard'ı aynı olmayacak;
herkese kendi projesine göre dashboard çıkarılmalı. Proje dizininin en üstünde sabit
dursun." (Sabitleme R4'te yapıldı: workspace'in ana pano alanı + sidebar'daki Pano
butonu. Bu görev içeriği yapıyor.)

## Mevcut durum (doğrula)

- Calibrate Faz 3 "status screen"i yalnız bir database'in yaşam döngüsü/tarihi varsa
  kuruyor; yoksa pano yok. Rehber sürümü 3.
- Blok tipleri: metric, chart, database_embed, list, text, links, activity. Katalog MCP
  resource'u `remnus://dashboard/catalog` tool şemasına gömülmüyor (tasarım kısıtı —
  koru).
- R4 ana pano için bir alan ve `setHomeDashboard` servisi ekledi (adını koddan doğrula).

## Görevler

A) MCP: ajan ana panoyu kurabilsin ve bulabilsin — `create_dashboard`'a ana pano
   seçeneği veya ayrı küçük bir tool; digest / workspace-map ana panoyu işaretlesin.
   Tool şeması büyümesin (token diyeti, P4): minimum alan.
B) Calibrate rehberi v4: ana pano HER kalibrasyonda kurulur. Status/tarih yoksa bile
   projenin ne olduğunu, nereye bakılacağını, ajan çalışmasını ve tasarrufu gösteren
   anlamlı bir pano mümkün — "sıfırlarla dolu pano gürültüdür" kuralını koru, boş metrik
   koyma. "Running it again" bölümüne sürüm 4 geçişi: ana pano yoksa kur ve işaretle.
   `calibrationGuide: 4`.
C) Projeye özel: her playbook (docs/mcp/playbooks/) kendi proje tipine uygun pano
   bileşimini önersin (ör. web app: açık işler, sürüm/deploy, kararlar; kütüphane:
   API yüzeyi, açık sorular; oyun: sahne/sistem durumu…). Sabit bir şablon değil, veriye
   göre seçim kuralları.
D) Güncel kalma: veri blokları zaten canlı. Yapısal güncellik için
   cli/templates/agents-section.md bloğuna tek satırlık kural: izlenmeye değer yeni bir
   database/alan eklediğinde ana panoya uygun bloğu ekle/güncelle. Token maliyeti düşük
   kalsın. (CLI şablonu değişirse cli sürümü artar; publish Hakan'da.)
E) Yeni blok(lar) — yalnız gerçekten gerekenler, her biri zod şeması + katalog +
   renderer + docs/mcp/dashboards.md ile: ör. `savings` (R4'ün tasarruf bileşeni),
   proje başlığı/özeti (ad, kısa açıklama, stack çipleri, son kalibrasyon). Katalog
   şişmesin; her ekleme için gerekçe yaz.
F) Tasarım: DashboardView/DashboardBlocks görsel kalitesi — ızgara, hiyerarşi, metrik
   kartları, boş durumlar, mobil. Mevcut tasarım diliyle (R8 sonra geliyor; tokenlara
   bağlı yaz ki kolay yeniden boyansın). frontend-design skill'ini kullan.
G) Kalibre edilmemiş workspace: R4'teki "pano oluştur" yolu boş pano yerine mevcut
   database'lerden sunucu tarafında otomatik bileşim üretsin (status kolonu → donut +
   açık iş metriği, tarih kolonu → yaklaşan liste, aktivite, tasarruf).
H) Mevcut kalibre edilmiş workspace'ler (ör. Ford-Netsis-UI): ana pano yoksa
   calibrate'in yeniden çalıştırılması onu kursun; kullanıcıya bunun nasıl
   tetikleneceğini söyleyen tek cümle (R1'deki devam promptu ile tutarlı).

## Doğrulama

- lint + tsc; katalog şablonları strict write gate'ten geçiyor.
- Repo dışında 2 farklı tipte küçük test projesi üzerinde yerel dev'e karşı gerçek
  kalibrasyon (bağımsız bir ajan oturumu gerekiyorsa Hakan'dan iste) → iki farklı pano
  çıktığını ekran görüntüsüyle göster.
- G yolunu elle dene (kalibrasyonsuz workspace).
- tüm temalarda + mobil genişlikte pano görsel kontrolü.

## Bitirirken

- changelog.ts: tek kayıt (`new`): her projenin kendi panosu otomatik kuruluyor.
- docs/mcp/calibrate.md, dashboards.md, playbooks; AGENTS.md; Serena core/conventions.
- update-handoff; commit yok; "Tamamlandı" notu.
```

### ✅ R6 — Tamamlandı (2026-09-30, Claude; commit/push yok, migration yok)

**A — MCP.** `create_dashboard` `home?: boolean` (oluştur + sabitle), `update_dashboard` `home?: boolean` (sabitle /
kaldır; tek başına gönderilebilir → `describeDashboard`, patch yok). Digest/harita satırı `, home` ile işaretli. Şema
iki kısa alan büyüdü (token diyeti); katalog kuralı "tek ana pano, uzat — ikincisini kurma" + "sıfır yok".
**B — Rehber v4.** Her kalibrasyon ana pano kurar: `project` başlığı → yalnız veritabanlarının hak ettiği durum blokları
→ links / activity / savings; boş/0 blok yok; "Running it again" v4 geçişi (ana pano yoksa kur; eski durum ekranı
`home: true` + `project` ile ana pano olabilir; Remnus'un otomatik kurduğu pano yeniden şekillendirilebilir);
`calibrationGuide: 4`. Saha testinden sonra: overview stub'ı log'dan hemen sonra (sıra = oluşturma sırası), overview ana
panoya link verir, Kanban/Calendar yalnız işe yarıyorsa, karar yaşam döngüsü düz select.
**C — Playbook'lar.** 5 playbook'un "Status screen"i "Home dashboard" oldu: proje tipine göre başlık özeti + stack, sonra
yalnız kurulan veritabanlarına göre seçilecek bloklar.
**D — CLI şablonu** (`cli/templates/agents-section.md`): "kalibrasyonu yenile" → rehberin Running it again kısmı; izlenmeye
değer yeni database/alan → ana panoya blok. Sürüm artırılmadı; R11 Birikenler'e satır eklendi.
**E — Yeni bloklar (2).** `project` (summary ≤280 + stack ≤8 çip; workspace adı ve son ajan zamanı canlı) — her ana panonun
başı, tek "gürültülü" öğe; `savings` (alan yok, workspace kapsamlı ölçüm, `AgentSavingsCard variant="dashboard"`) —
madde 17. Katalog + `home` şablonu + insan editörü (özet/stack alanları) + docs.
**F — Tasarım.** Karolar `rounded-lg bg-neutral-900 ring-1 ring-neutral-850` (yalnız palet sınıfları, R8 yeniden
boyar), başlıklar büyük harf/izli değil cümle düzeni, başlıksız karo başlık satırı harcamaz, metrik sayısı karo tabanında
(4xl), `sm` iki sütun (metrikler çiftlenir), proje başlığı karosuz + alt çizgi, savings kendi yüzeyi. Checkbox sütunu liste
bloklarında "true/false" yerine sütun adı.
**G — Kalibrasyonsuz workspace.** Pano butonu boş pano yerine `composeHomeDashboardBlocks` ile sunucuda kurar: yeniden
kalibrasyon cümlesi (bilgi notu) + en büyük durumlu veritabanında açık iş metriği + durum donut'u (≥2 değer) + sıradaki
tarih / hâlâ açık listesi, durum yoksa tarihli veritabanında "en yeni", üst düzey linkler, aktivite (varsa), tasarruf
(>0 ise); `fillRows` masaüstü satır boşluklarını kapatır. Etiketler kullanıcının dilinde (`Dashboard.home.*`).
**H — Yeniden tetikleme cümlesi:** otomatik panonun notu — "bağlı ajanınıza şunu yazın: “Remnus kalibrasyonunu yenile”".
**Ek (Hakan'ın isteği):** Pano/Harita çerçeveli buton; Pano mavi, Harita mor ikon; açık olan kendi renginde çerçeve + ring.

**Doğrulama:** tsc, eslint (0 hata), test:access 28, test:agent-access 34, test:workspace-deletion 13, test:trash-links 32;
katalog render (4 şablon strict kapıdan geçti). **Gerçek kalibrasyon:** iki alt ajan, yalnız rehber + MCP (HTTP sarmalayıcı)
ile repo dışı iki projeyi kalibre etti — web app (Tidewell: Features/Decisions/Feedback/Plans + "Tidewell Home": header,
building/bugs metrikleri, donut, planned listesi, feedback, links, activity, savings) ve kütüphane (patiently: Public
API/Decisions/Releases/Open Questions + "patiently Home": header, open/deprecated metrikleri, stability donut'u,
experimental + releases + still-open listeleri, links, activity, savings). İki farklı pano, uyarısız; ekran görüntüleri
`.playwright-mcp/r6/` (açık+koyu+nord+mobil). G yolu Playwright'ta: demo workspace'te 6 bloklu otomatik pano, silip yeniden
oluşturma, mobil ve 3 tema.

**Saha testinin açtığı, R6 dışı konular (sonraki R'ler için):** log tiklemek tüm gövdeyi yeniden yollatıyor (çağrıların
~%30'u) → append/checkbox yazma yolu (R9 token); kardeş sıralama aracı yok; kürasyonlu Lucide listesi önden görünmüyor (her
iki ajan da bir çağrı kaybetti); `bulk_create_pages.knowledge` `description/status` içermiyor, `bulk_update_pages`'ta
`knowledge` yok; get_page/get_pages knowledge ve ikonları göstermiyor (Faz 4 kontrolü haritadan yapılamıyor); kısmi tarih
("2025-08") için rehber kuralı yok; dosya ↔ Remnus kaynak-gerçeği için varsayılan yok.


### ✅ R5/R6 açıkları kapatıldı (2026-09-30, Hakan: "hepsini şimdi yap, geri dönmeyelim")

- **Üyelikten çıkarılan / eklenen kişinin sekmesi:** `changes`/`ping` artık `n` (görünür workspace sayısı) da
  döndürüyor; `ActivityTracker` `n` değişince sürümü `max(v, son)+0.001` ile ilerletiyor. Rol değişimi `touchWorkspaces`,
  sahiplik devri `workspaces.updatedAt` yazıyor. Canlı: doğrudan üyelik ekleme boşta sekmede 20 sn'de (heartbeat), çıkarma
  pencereye dönüşten 1,75 sn sonra sidebar'dan düştü (önce hiç düşmüyordu).
- **Masaüstü sekmeleri (TabHost) + bilgi haritası aynı-saniye:** sunucu `v`'nin saniyesi açıkken `h: 1` gönderiyor
  (`signalExtras`); TabHost `changeIsHot()` ile, soğuyan ilk turda aktif paneli bir kez daha çekiyor; GraphScreen
  `generatedAt` + `mayPredateRender` ile bir kez daha çekiyor. Tauri canlı test edilmedi (yerel masaüstü derlemesi yok);
  harita akışı Playwright'ta doğrulandı (yazma → 2,4 sn'de harita yeniden çekildi, fazladan istek yok).
- **Log tiklemesi:** `update_page` `tick` (metnin başıyla açık `- [ ]` görevi işaretler, `{item, note}` ile id notu ekler;
  eşleşmeyen varsa tümü reddedilir ve açık görevler listelenir) + `append` (sona ekler). `services/bodyEdits.ts`,
  `npm run test:body-edits` (8 kontrol, CRLF dahil). Rehber: tiklemek ve yeniden çalıştırma bölümü artık gövdeyi
  yeniden yollamıyor. Canlı MCP: append, not ile tick, bilinmeyen tick hatası, content+tick hatası — hepsi beklendiği gibi.
- **Kardeş sıralama:** `move_item` `position` (0 = ilk; aynı parent ile yerinde sıralama; kardeş grubu tek batch'te
  yeniden numaralanır). Canlı: Releases 1. sıraya, sona (99 → 5) ve geri (3) taşındı.
- **İkon listesi:** kürasyonlu Lucide adları rehbere ve write-tools'a `{{LUCIDE_ICONS}}` yer tutucusuyla sunulurken
  koddan (`CURATED_ICON_NAMES`) basılıyor, dashboard kataloğunda da var; tool şemalarına eklenmedi (token).
- **Saha testinin diğer maddeleri:** kısmi tarih kuralı, dosya ↔ Remnus varsayılanı (dosyaya dokunma, logda açık soru),
  "yakında çoğalacak" veritabanı için 3 satır istisnası, ana pano 4–9 köke sayılmaz, overview sırası `position` ile,
  Faz 4 ikon/etiket kontrolünün yazma sonuçlarından yapılması, `warnings` yoksa = sorun yok, links'te iki database id'si
  de geçer, kütüphane playbook'unda Public API'nin kararlılığa göre bölünmesi. MCP hata metinlerindeki
  "Error: Error:" tekrarı giderildi (write araçları).
- **Token maliyeti (ölçüldü):** yeni alanlar yazma oturumlarında +590 B ≈ 148 token (`home`×2, `position`, `tick`,
  `append`). `tick`/`append`/`knowledge`'ı `bulk_update_pages`'a da koymak +350 token ediyordu — koymadım, toplu işte
  `update_page` kullanılır. `bench:mcp-budget` `server-only` yüzünden çalışmıyordu → `src/scripts/serverOnlyStub.ts`.
- **Sonraki R bloklarına taşınanlar:** R7 (panoda erişilebilirlik butonu, harita settle'ını bozma), R8 (pano karoları /
  tasarruf eyebrow'u / çift başlık / Pano-Harita renkleri), R9 (`epochMax` tam tarama maliyeti, tools/list ölçümü),
  R10 (rozet, `n`/`h`/`agent`, `home`, `position`, `tick`/`append`, otomatik pano güvenlik testleri), R11 (SKILL.md
  masaüstüne gömülü → Birikenler).
---

# R7 — Bilgi haritası düzeltmeleri

> Madde 6 + 9 + 10 + 12 (+5'in harita tarafı). Kapsam: küçük-orta. R3'ün Select'ini
> kullanır.

```text
Remnus projesinde çalışıyorsun (Next.js 16, React 19, TS strict, sigma v3 +
graphology). AI.md kuralları geçerli. AGENTS.md → Knowledge map/graph bölümünü (P12)
oku; Serena varsa core + conventions. `git status --short` ile başla. Sigma v3 API'si
için context7 ile güncel dokümana bak. Playwright'tan önce Hakan'a sor.

Dosyalar: src/components/features/graph/ (GraphScreen.tsx, GraphCanvas.tsx,
graphTheme.ts, LocalGraph*), rota src/app/[locale]/(app)/graph/[workspaceId]/,
servis src/lib/services/graph.ts.

## Görev A — Proje değiştirici (madde 6)

Harita sayfasının üst çubuğunda R3'ün Select'i ile workspace değiştirici: kullanıcının
workspace'leri, seçince /graph/<id>'ye gider, mevcut katman/görünüm tercihleri
korunur. Proje penceresinde (kilitli oturum, tek workspace) gösterme. GraphScreen'deki
diğer native select'ler R3'te taşınmadıysa onları da taşı.

## Görev B — Zoom out'ta node'lara tıklanamıyor (madde 9)

Yeniden üret, kök nedeni kanıtla. Hipotezler: uzaklaşınca node'lar ekranda birkaç
pikselin altına iniyor ve sigma'nın isabet testi render edilen boyutu kullanıyor;
`nodeReducer` bir durumda `hidden`/çok küçük boyut veriyor; `zoomToSizeRatioFunction` /
`itemSizesReference` ayarları; özel çizim (badge, dashed edge programı) isabet alanını
bozuyor. Çözüm yönleri: ekranda asgari node boyutu, asgari isabet yarıçapı, ya da
`clickStage`'de imlece belli piksel mesafedeki en yakın node'u seçmek. Hover ve
çift tıklama da aynı ölçekte çalışmalı.

## Görev C — Erişilebilirlik butonu (madde 10)

Kök neden doğrulandı: src/app/layout.tsx vendored widget'ı
`data-exclude-paths="/app,/admin,/db,/page"` ile yüklüyor; /graph, /w, /dashboard
listede yok. Widget'ın excludePaths eşleşme semantiğini (önek mi, tam mı)
public/vendor/accessibility-preference-widget/widget.min.js(.map)'ten doğrula.
Uygulama içi TÜM rotalarda gizlenmeli (widget pazarlama sitesi için); gelecekte eklenen
bir rotanın yine sızmaması için yaklaşımı sağlamlaştır (ör. uygulama rotalarının ortak
önekleri, ya da pazarlama rotalarına izin listesi — widget buna izin veriyorsa).
proxy.ts matcher'ındaki widget istisnasına dokunma gereği var mı kontrol et.

## Görev D — "Satırları getir" bekletiyor (madde 12)

`showRows` → `toggleDatabase` bekleme durumu göstermiyor. Buton loading + haritada
yükleniyor işareti; aynı anda iki kez tetiklenemesin. Ayrıca neden yavaş olduğunu ölç
(sunucu sorgusu mu, layout yeniden hesaplaması mı, büyük veri mi) ve ucuz bir iyileştirme
varsa yap; ölçümü rapora yaz.

## Görev E — Haritanın proje içindeki yeri (madde 5)

R4 giriş noktasını her workspace'in içine taşıdı. Harita sayfasının başlığında proje
kimliği net olsun (ad/ikon) ve projeye/panoya dönüş kolay olsun. R4'ün yaptığıyla
çelişme; eksik kaldıysa tamamla.

## R5/R6'dan devreden (2026-09-30)

- R6'nın pano sayfası `/dashboard/...` erişilebilirlik butonunu hâlâ gösteriyor (ekran
  görüntülerinde görüldü) — Görev C'nin kapsamına dahil, doğrularken panoda da bak.
- R6 GraphScreen'e aynı-saniye "settle" refetch'i ekledi (`mayPredateRender` +
  `generatedAt`); harita değişikliklerinde bunu bozma.

## Doğrulama

- lint + tsc; varsa `src/scripts/bench-graph.ts`.
- Zoom en uzak seviyede, orta ve yakında tıklama/hover/çift tıklama — büyük bir workspace
  ile (yerel veriyle). Masaüstü + dokunmatik (touchpad pinch) davranışı.
- /graph, /w, /dashboard, /page, /db rotalarında widget görünmüyor; pazarlama
  sayfalarında görünüyor.
- Workspace değiştirici normal oturumda var, proje penceresinde yok.

## Bitirirken

- changelog.ts: tek kayıt (`fixed`/`improved`): haritada projeler arası geçiş, uzaktan
  tıklama, satır yüklerken geri bildirim.
- AGENTS.md graph bölümü + Serena (varsa gotcha: widget exclude paths).
- update-handoff; commit yok; "Tamamlandı" notu.
```

### ✅ R7 — Tamamlandı (2026-09-30, Claude; commit/push yok, migration yok, CLI/Tauri'ye dokunulmadı)

İddialar koddan doğrulandı: `GraphScreen`'deki iki select R3'te zaten `SimpleSelect`'e taşınmıştı; `showRows` →
`toggleDatabase` bekleme durumu yoktu; widget `data-exclude-paths="/app,/admin,/db,/page"` idi; R4 girişi
her projeye taşımıştı ama harita başlığında proje kimliği yalnız soluk bir ad olarak vardı.

- **A — Proje değiştirici:** başlıkta `SimpleSelect` (proje ikonu/baş harfi + ad; kullanıcının gizlediği
  workspace'ler hariç, açık olan hep dahil) → `router.push('/graph/<id>')`, geçişte spinner.
  `getGraphWorkspace` artık `{ workspace, switchable }` döner; kilitli oturumda `switchable = null` →
  seçici yok, statik ad. `GraphScreen` workspace id'siyle key'li (geçiş yeni harita açar, eski haritaya
  "canlı yenileme" gibi birleşmez); katman/görünüm tercihleri `localStorage`'dan korunur (test: Ağaç seçili
  kaldı).
- **B — Uzakta tıklanamama, kök neden kanıtlandı:** sigma 3.0.3 isabeti yarı çözünürlüklü bir picking
  framebuffer'ından TEK piksel okuyarak yapıyor (`pickingDownSizingRatio = 2 × dpr`), düğüm orada tam
  çizili diski kadar yer kaplıyor ve çizili boyut zoom'la size/√ratio küçülüyor. Büyük haritada/uzakta
  düğüm 1–4 px; simülasyon: 0,8–1,5 px'lik diskin İÇİNE yapılan tıklamaların %33–56'sı bile boş piksel
  okuyor (hedefin kendisi de imleç isabetinden küçük). `nodeReducer`/hidden veya dashed edge programı
  neden değil. Çözüm: sigma ıskalayınca en yakın görünür düğüm (disk kenarına ≤ 6 px fare / 14 px
  dokunma) — `clickStage`, `doubleClickStage` (sigma'nın zoom'u engellenir) ve hover (rAF ile kısılmış
  kendi `mousemove` dinleyicisi) aynı yoldan.
- **C — Erişilebilirlik butonu:** widget eşleşmesi kaynaktan doğrulandı (`matchesPath`: string = yolun
  kendisi ya da `yol/…`; sonda `*` = ham önek; test edilen yol `pathname+search+hash`). Liste artık
  `src/lib/accessibilityWidget.ts`'ten üretiliyor: `(app)`'in tüm üst klasörleri (`/app`, `/admin`,
  `/dashboard`, `/db`, `/graph`, `/page`, `/w`) + her birinin `?*` ikizi. Sağlamlaştırma:
  `(app)` layout'u `AccessibilityWidgetOff`'u mount ediyor (`configure({disabled:true})`, widget kendini
  sonradan mount ederse tekrar; unmount'ta geri verir) → listeye eklenmemiş gelecekteki bir `(app)` rotası
  da gizli kalır. `proxy.ts` matcher'ına dokunmak gerekmedi (script yolu değişmedi).
- **D — Satırları getir:** tek seferde bir toggle (`rowsPending`), kartta `Button loading` (diğerleri
  disabled), haritada "Satırlar yükleniyor…" status'u, istek düşerse `expanded` geri alınır. **Ölçüm**
  (yerel, 5k sentetik workspace, 1.500 satır): servis sıcak ~33 ms (katlı da açık da), soğuk model
  ~374 ms, payload 258 KB / 97 KB gzip — sunucu değil. Tarayıcı CPU profili: tıklama → satırlar haritada
  1,8–2,2 sn, bunun ~1,3 sn'si sigma'nın her `nodeAdded`/`edgeAdded`/`nodeAttributesUpdated` olayını tek
  tek indekslemesi. **Ucuz iyileştirme:** toplu senkron sırasında sigma boş bir grafa bağlanıp geri
  alınıyor (public `setGraph`, tek tam refresh) → **~0,5 sn** (ağ ~0,25–0,3 sn, dev). Ayrıca yeni satırlar
  veritabanının etrafına ±%2'lik yığın yerine altın açılı "ayçiçeği" olarak yerleşiyor.
- **E — Başlık:** `[proje rozeti/seçici] / Bilgi haritası [Pano]`; Pano yoksa sidebar'daki gibi
  `openOrCreateHomeDashboard` ile oluşturup açıyor (hata mesajı dahil). R4'ün Pano/Harita düğmeleriyle
  çelişmez.
- R6'nın aynı-saniye settle refetch'i (`mayPredateRender` + `generatedAt`) korunuyor; `load` yalnız
  `rowsPending`/`rowsRevert` temizliği kazandı.
- i18n: `Graph.switchWorkspace`, `Graph.openDashboard`, `Graph.loadingRows` (8 locale). Changelog:
  `2026-09-30-knowledge-map-fixes` (`improved`). AGENTS.md (Knowledge Map: Header, Hit testing, Bulk sync,
  Show/hide rows; root layout widget satırı; eski "sidebar'da global Knowledge map satırı" ifadesi
  düzeltildi), Serena `core` + `conventions` güncellendi.

**Doğrulama:** `npx tsc --noEmit` (canary ile tsc'nin gerçekten hata raporladığı teyit edildi), hedefli
eslint temiz. Tarayıcı (Hakan onayıyla; MCP Chrome başka oturumda meşgul olduğu için `playwright-core` +
sistem Chrome, ayrı geçici profil, `.playwright-mcp/r7-*.cjs`, local.db, demo kullanıcı + 5k bench
workspace): widget /graph, /dashboard, /page, /db'de YOK, `/`, /pricing, /wiki'de VAR (uygulamadan çıkınca
geri geliyor); en uzak zoom'da düğüme 0–5 px mesafedeki 12/12 tıklama seçim yaptı, hover imleci pointer,
çift tıklama sayfayı açtı; 390 px'de dokunma 3/3 seçti, yatay taşma yok; satırlar: aria-busy + status
anında, 1,8–2,2 sn → ~0,5 sn; değiştirici normal oturumda var (2 seçenek) ve proje penceresinde (yerel PAT
→ `/api/window/ticket` → activate) yok, statik ad + Pano var; Pano yokken oluşturup açtı. Sayfa hatası yok.
Test verisi temizlendi (token silindi, bench workspace `--cleanup`, geçici script'ler silindi).

**Notlar / Hakan için:**
- Doğrulama sırasında port 3000'deki (09:59'da başlatılmış) `next dev` 12:08'de kendi kendine yeniden
  başlayıp her rotaya 404 vermeye başladı; Hakan'ın onayıyla durduruldu, `.next/dev` →
  `.next/dev-stale-2026-09-30` olarak yeniden adlandırıldı (silinmedi, istenirse silinebilir), benim
  açtığım dev de iş bitince durduruldu → **port 3000 şu an boş**, `npm run dev` ile yeniden başlat.
- Demo kullanıcılarda alttaki çerez/demo çubuğu haritadaki seçim kartının alt kısmını örtüyor (R7
  kapsamı dışı, R8'de bakılabilir).
- Canlıda yavaşlığın sunucu payı (Vercel soğuk başlangıç + Turso'da model yeniden kurulumu) yerelde
  ölçülemez; R9'un ölçüm listesine uygun.
- Push/deploy yok; migration yok; R11 Birikenler'e satır yok (CLI/Tauri değişmedi).

---

# R8 — UI polish: Remnus'un kendi tasarım dili

> Önemli başlık 1. Kapsam: çok büyük, birden çok oturum. Bu prompt yönü belirler, temeli
> kurar ve kalan yüzeyler için R8.x promptlarını bu dosyaya yazar. Hakan'ın seçimi
> gerekir.

```text
Remnus projesinde çalışıyorsun (Next.js 16, React 19, TS strict, Tailwind v4, next-intl
8 locale, Tauri masaüstü + Capacitor mobil kabukları aynı web uygulamasını yükler). AI.md
kuralları geçerli. Önce docs/WHAT_IS_REMNUS.md, AGENTS.md'nin UI/tema bölümleri,
src/app/globals.css ve src/components/ui/ (R3 primitifleri) oku. Serena varsa core +
conventions. `git status --short` ile başla. frontend-design skill'ini kullan.
Playwright'tan önce Hakan'a sor (ekran görüntüsü için alternatif: Hakan'dan iste).

## Hakan'ın isteği

"UI olarak genel anlamda polishlemek gerekiyor. Componentleri, görünümü, her şeyi hem
profesyonel hem basit hem de bize özel bir hale getirmemiz gerekiyor. Artık NOTION gibi
olmamalıyız."

## Konumlandırma (tasarımın cevap vermesi gereken soru)

Remnus bir Notion alternatifi değil: projeye `npx remnus init` ile kurulan, insanla AI
ajanlarının MCP etrafında eşit çalıştığı bir workspace. Kullanıcı çoğunlukla Claude
Code kullanan geliştirici; pencere çoğu zaman ajan çalışırken izlenen bir yan ekran.
Tasarım dili bunu hissettirmeli: ajan aktivitesi birinci sınıf görsel öğe, yoğun ama
okunaklı, sakin, hassas.

## Mevcut sistem (doğrula)

Fontlar Onest (sans), JetBrains Mono, Fraunces (serif). Temalar: varsayılan koyu nötr +
dracula, tokyo-night, nord, catppuccin (açık) — `data-theme` + CSS değişkenleri.
Kural: workspace UI flat/borderless, üç katmanlı nötr palet; auth sayfaları rounded-card
istisnası. R3 ile src/components/ui/ primitifleri geldi.

## Faz 1 — Denetim

Ana yüzeylerin ekran görüntülerini al (sidebar + sayfa, database tablo/kanban/takvim,
pano, harita, modallar/ayarlar, AI Ajanlarım, mobil, proje penceresi, açık tema).
Tutarsızlıkları listele: boşluk ölçeği, radius, tipografi ölçeği, ikon boyutları, buton
stilleri, menüler, modallar, boş durumlar, hover/focus. "Notion gibi" okunan öğeleri ayrı
listele ve nedenini yaz.

## Faz 2 — Araştırma

Referansları incele (ör. Linear, Raycast, Vercel dashboard, Warp, Zed, Arc) — kopyalamak
için değil, hangi ilkenin bize uyduğunu çıkarmak için. Web'de araştır; kafadan atma.

## Faz 3 — Yön seçimi (DUR ve Hakan'ı bekle)

Aynı iki ekranın (sidebar + sayfa, pano) 2-3 farklı yönde görsel taslağını hazırla
(tek bir HTML sayfası/artifact ya da yerel önizleme). Her yön için: ilkeler, renk rolleri,
tipografi, yoğunluk, ajan aktivitesinin görünümü, açık/koyu. Hakan birini seçmeden veya
karıştırmadan koda geçme.

## Faz 4 — Temel (seçilen yönle)

- Tokenlar: renk rolleri (yüzey katmanları, metin, kenar, vurgu, durum, ajan), tipografi
  ölçeği, boşluk, radius, gölge/elevation, hareket. Bütün temalar bu rollerden türesin;
  dracula/nord/... bozulmasın.
- src/components/ui primitiflerini yeni dile göre yeniden boya; gerekli yeni
  primitifler (Tooltip, Badge, Tabs, Card, EmptyState…).
- Uygulama kabuğu: sidebar, üst çubuk/TabBar, sayfa başlığı, Tauri titlebar.
- Kısıtlar: de/ru uzun metinleri, mobil/Capacitor, performans (ağır animasyon/lib yok),
  WCAG kontrast, `prefers-reduced-motion`.

## Faz 5 — Kalan yüzeyler için promptlar

Bu dosyaya, R8'in altına R8.1, R8.2… başlıklı standalone promptlar yaz (bu dosyadaki
formatla): editör, database görünümleri, panolar, harita, modallar/ayarlar, auth/onboarding,
pazarlama sitesi (ayrı değerlendir). Her biri seçilen yönü, tokenları ve bu oturumda
kurulan primitifleri referans alsın.

## R5/R6'dan devreden (2026-09-30)

- Pano (R6): karolar yalnız palet sınıflarıyla yazıldı (`rounded-lg bg-neutral-900 ring-1
  ring-neutral-850`) — R8 tokenlarına bağla. Tasarruf kartının büyük harfli izli eyebrow'u
  ("AJANLARIN KAZANDIRDIKLARI") genel dile uymuyor; ajanların kurduğu panolarda pano başlığı
  ("Tidewell Home") + proje bloğu başlığı (workspace adı) çift başlık gibi duruyor — tek
  başlık kararı ver.
- Pano/Harita butonları (R5/R6'da mavi/mor çerçeveli yapıldı): renkleri R8 paletine taşı.

## Bitirirken

- AI.md "Critical conventions"daki UI kuralını, AGENTS.md'yi ve Serena conventions'ı
  yeni tasarım diline göre güncelle (eski "flat/borderless" kuralı değişiyorsa sil,
  üstüne ekleme).
- changelog.ts: tek kayıt (`improved`) — yeni görünüm.
- update-handoff; commit yok; "Tamamlandı" notu.
```

### ✅ R8 — Tamamlandı (2026-09-30, Claude; commit/push yok, migration yok, CLI/Tauri Rust'a dokunulmadı, paket eklenmedi)

**Faz 1 — Denetim** (Playwright, Hakan onayıyla; demo kullanıcı + local.db; 14 ekran: koyu/açık/Nord/Dracula/Tokyo, 390 px, modallar;
`.playwright-mcp/r8-audit/`) + kod taraması. Bulgular: 5 köşe değeri (4/6/8/12/16) + 11 yerde hiç (kural "rounded-none" diyordu);
7+ gölge tarifi; 15 px altında 11 yazı boyutu, 51 yerde 8–9 px; 104 büyük harfli etiket (`lang="tr"` ile "TİTLE", "KATEGORİSİZ");
547 elle buton / 7 `Button`; 33 elle modal / 1 `Dialog`; açık tema 55 seçici yamayla ayakta; 66 `outline-none`, 9 görünür odak;
ajan aktivitesi kabukta yok. "Notion gibi" okunanlar: emoji + dev başlık, sayfa ağacı, eğik çizgi menüsü, veritabanı sekmeleri +
renkli kanban sütunları + "Priority: High" satırları — asıl neden kabuğun hiçbir yerde "ajanlar burada çalışıyor" dememesi.
Ek i18n açıkları: `SlashCommandList.tsx:136` "Divider", `StandalonePageEditor` "Remove", `PageEditor` "Duplicate", mobil "Language".

**Faz 2 — Araştırma:** Linear (3 girdiden LCH tema, kabukta renk azaltma, ajan oturum durumları), Vercel Geist (ölçek adımı = rol),
Raycast (yoğunluk + klavye), Warp (ajan işi tiplenmiş bloklar), Zed, Arc (alan başına renk kimliği). Kaynaklar yön sayfasında.

**Faz 3 — Yön:** `.ai/R8_DESIGN_DIRECTIONS.html` (artifact https://claude.ai/artifact/PnW33rWD6iEabi5CfuD5Sf): A Sinyal, B Ortak
Masa, C Kesik; aynı iki ekran (sidebar+sayfa, pano), koyu+açık. **Hakan'ın kararı:** B'nin tüm yapısı (kartlar, radiuslar,
sayfayla bütünleşik sidebar) + A'nın tek renk anlayışı; iki renk (insan/ajan) yok; tek vurgu sarı, koyu/açıkta farklı ton; dalga/nabız
efekti yok; C (oyun gibi) yok; varsayılan tema bugünkü gibi; Dracula/Tokyo/Nord kalır. Sayfanın en üstüne "Seçilen yön" eklendi.

**Faz 4 — Temel (yapılan):**
- **Tokenlar** (`globals.css` @theme): nötr rampa yeniden ayarlandı (950 masa · 850 kâğıt · 900 kalkık · 800 çizgi/hover · yeni 750 ·
  700 güçlü çizgi …) ve rol tokenları: `desk sheet raised float hover line line-strong fg fg-2 fg-3 fg-4 ink ink-fg signal signal-fg
  signal-text signal-soft focus link overlay`; köşe (`rounded-control` 8, `rounded-surface` 12; md=lg=8, xl=2xl=12, bare 6), gölge
  (`shadow-lift/sheet/float/modal`, eski lg/xl/2xl aynı gölgelere), `text-2xs` (11) + `text-ui` (13), `ease-snappy`. Beş tema tek blok:
  Dracula/Tokyo/Nord kendi sarısını sinyal olarak kullanıyor, kâğıt masadan bir kademe açık. Açık tema: sarı dolgu `#f5b300`, sarı
  yazı yerine koyu altın `#5c4600`. Global `:focus-visible` halkası + `::selection` sarı (base layer), ince şeffaf scrollbar,
  `.modal-shadow` = modal gölgesi, editör başlık/link/blok seçimi tokenlarda, reduced-motion'da giriş animasyonları anında.
  **Pazarlama** `.marketing-site` altında eski rampa + Tailwind radiusları ile donduruldu (R8.7).
- **`src/lib/cn.ts`:** tailwind-merge yeni tokenları tanıyor (bilinmezse `text-ui`'yi renk sanıp `text-ink-fg`'yi siliyordu).
- **Primitifler:** Button (primary = mürekkep, secondary/outline/ghost/danger/signal), Dialog (float yüzey, modal gölgesi, overlay
  tokenı), DropdownMenu (+`DropdownMenuShortcut`), Select/SimpleSelect yeniden boyandı; yeni: `tooltip`, `badge`, `tabs` (line/segmented,
  kayan gösterge), `card` (masa/kâğıt), `empty-state`, `kbd`, `input`/`textarea`, `remnus-mark` (temaya uyan SVG R).
- **Kabuk:** `AppShell` + `sidebarVisibility.ts` → masa + tek kâğıt (`getSheetClasses`, pano rotası `onDesk`); sidebar masada kenarsız,
  seçili satır "kalkık" (`bg-sheet shadow-lift`), Pano/Harita tek renk çift (R5/R6 mavi/mor çerçeve kalktı), ajan paneli (tasarruf +
  AI Ajanlarım) küçük bir kâğıt, hesap satırı; `ContextMenu`, `AccountMenu`, `TauriTitlebar` + `TabBar` (masada, etkin sekme kalkık),
  `ProjectWindowBanner` ve demo şeridi masada (em dash ve "→" kalktı), `MobileNavWrapper` (float sheet, masa rengi alt çubuk, "Dil").
  Sayfa başlığı: iki editörün elle yazılmış "⋯" menüleri tek `PageActionsMenu`'ya (DropdownMenu) indi, başlık 28/34 semibold,
  `SaveStatus`/Yenile ghost; i18n `Page.removeIcon/pageOptions/widthLabel` (8 locale); "Duplicate" ve "Remove" artık çevrili.
- **R5/R6 devreden:** pano kartları tokenlarda (masada kart, mobilde raised), tasarruf "AJANLARIN KAZANDIRDIKLARI" eyebrow'u cümle
  düzeninde caption, **tek başlık kararı:** proje bloğu varsa pano başlığı küçük etikete iner (`DashboardHeader compact`), büyük başlık
  proje bloğunda; proje bloğundaki nabız kalktı, yığın rozetleri + sabit sarı nokta; metin bloğu tonu ikonla (info = sinyal).
- **Uygulama geneli mekanik geçiş** (TypeScript AST codemod, yalnız string/template literal): 112 büyük harfli etiket → cümle düzeni
  (8–10.5 px → `text-2xs`, 11 → `text-xs`); mavi UI vurgusu → birincil eylemler `bg-ink text-ink-fg` (51), diğer vurgu (seçim, etkin,
  odak, link rengi, tint) → `signal` (~160); sarı dolgu üstündeki beyaz yazı/tik `signal-fg`. Mavi yalnız veri/kullanıcı renginde kaldı
  (callout rengi, ikon rengi, grafik serileri, harita düğüm türleri, seçenek renkleri, admin).
  **Not:** ilk (regex) codemod JSX metnindeki kesme işaretlerinden taşıp ~80 dosyada girintiyi düzleştirmişti; hepsi HEAD'den geri
  alınıp AST codemod'u yeniden uygulandı (R6'dan kirli `DashboardBlockEditor` girintisi HEAD'e hizalanarak onarıldı). Son durum:
  bu dosyalarda eklenen/silinen satır sayıları eşit (yalnız token değişimi), tek boşluk girintili satır yok.
- Changelog: `2026-09-30-new-look` (`improved`, 8 locale). `AI.md` UI kuralı, `AGENTS.md` (Color Theme + UI & Design Aesthetics baştan,
  sidebar/Pano-Harita/sekme/AppShell satırları, i18n §8), Serena `conventions` (UI / Design baştan, primitifler, codemod dersi) +
  `core` güncellendi.

**Doğrulama:** `npx tsc --noEmit` temiz; değişen 160 TS dosyasında eslint **0 hata**, 25 uyarı (hepsi önceden vardı; bu işin
kattığı kullanılmayan import/değişkenler temizlendi). Palet kontrastları betikle ölçüldü (tüm metin kademeleri ≥ 4.5:1, odak ≥ 3:1).
Playwright (Hakan onaylı, dev + local.db, demo): sayfa/veritabanı/pano/harita/ayarlar/ajanlar/hesap menüsü koyu + açık, Nord/Dracula/
Tokyo, 390 px mobil + kullanıcı sayfası, giriş sayfası (çıkış yapmış bağlam) — sayfa hatası yok, `.playwright-mcp/r8-impl/`.
Build çalıştırılmadı (build davranışı değişmedi).

**Hakan için / kalanlar:**
- Görsel kontrolü birlikte yapacağız: `npm run dev` → koyu + açık tema, bir de Dracula/Nord; en çok değişen yerler kenar çubuğu,
  sayfa başlığı ve pano.
- Kasıtlı olarak bu oturumda yapılmayanlar R8.1–R8.8'de: 33 elle modalın `Dialog`'a taşınması, veritabanı görünümlerinin Notion kalıpları,
  editör, harita, auth, pazarlama ve ajan varlık katmanı (canlı "Claude Code çalışıyor", ağaçta iz, köken satırı).
- Demo kullanıcıda alttaki çerez bandı haritadaki seçim kartını örtüyor (R7 notu) → R8.4.
- Push/deploy yok; migration yok; R11 Birikenler'e satır yok.

## R8 alt promptları — sıra

| #    | Prompt | Neden bu sırada |
| ---- | ------ | --------------- |
| R8.1 | Editör ve sayfa içi yüzeyler | Kullanıcının en çok baktığı yer; tipografi ölçeği burada oturur. |
| R8.2 | Veritabanı görünümleri | En "Notion gibi" yüzey; Checkbox primitifi burada doğar. |
| R8.3 | Panolar | R6 panoları masada kart; blok editörü modalı R8.5 kalıbını kullanabilir. |
| R8.4 | Bilgi haritası | Araç çubuğu primitiflere; tema tokenlarıyla sigma renkleri. |
| R8.5 | Modallar, ayarlar, bildirimler | 33 elle katman tek `Dialog`/`Sheet` kalıbına. |
| R8.6 | Giriş, kurulum, onboarding | İlk 5 dakika; auth kartları ortak primitiflere. |
| R8.8 | Ajan varlık katmanı | Yeni özellik; R8.1–R8.2 kabuğu oturduktan sonra. |
| R8.7 | Pazarlama sitesi (son) | Ürün ekran görüntüleri yeni arayüzle yeniden alınır. |
| R8.9 | Şablonlar ve varsayılan içeriğin dili | R8.2/R8.3'te ayrıldı; Hakan: "8.x'lerin sonunda". Arayüz dilinde doğmayan şablon/varsayılan veri. |

Her R8.x kendi başına yeterlidir; ortak referans bloğu her prompta gömülüdür.

---

# R8.1 — Editör ve sayfa içi yüzeyler

> R8'in seçtiği dili editöre ve sayfanın içindeki panellere taşır. Tek oturum.

```text
Remnus projesinde çalışıyorsun (Next.js 16, React 19, TS strict, Tailwind v4, next-intl 8 locale). AI.md kuralları geçerli.
`git status --short` ile başla; kullanıcının değişikliklerini ezme. Serena varsa core + conventions (UI / Design bölümü).
frontend-design skill'ini kullan. Playwright'tan önce Hakan'a sor.

## Ortak referans (R8)
- Seçilen yön: `.ai/R8_DESIGN_DIRECTIONS.html` → "Seçilen yön: Ortak Masa, tek renk" (Hakan: B'nin yapısı + tek renk,
  tek vurgu sarı, nabız/dalga efekti yok). Kurallar: `AGENTS.md` → UI & Design Aesthetics.
- Tokenlar `src/app/globals.css` @theme: desk/sheet/raised/float/hover/line/line-strong, fg…fg-4, ink/ink-fg, signal/
  signal-fg/signal-text/signal-soft, focus, link, overlay; `rounded-control/surface`; `shadow-lift/sheet/float/modal`;
  `text-2xs` (11) + `text-ui` (13). Yeni token eklersen `src/lib/cn.ts` tailwind-merge listesine de ekle.
- Primitifler `src/components/ui/`: Button, Dialog, DropdownMenu(+Shortcut), Select/SimpleSelect, Tooltip, Badge, Tabs,
  Card, EmptyState, Kbd, Input/Textarea, RemnusMark; `features/PageActionsMenu`, `ConfirmDialog`.
- Yasak: CSS `uppercase` etiket, orta noktayla meta birleştirme, 11 px altı yazı, "→" ekli etiket, döngüsel nabız; mavi yalnız
  veri/kullanıcı rengi. Sınıf değişikliğini codemod'la yapacaksan TypeScript parser'ıyla yalnız literal'lerde ve boşluklara
  dokunmadan (R8 dersi, conventions).

## Kapsam
BlockEditor ve eklentileri (`src/components/features/editor/*`: eğik çizgi menüsü, BubbleMenuBar, BlockSelectionToolbar,
BlockDragHandle, FencedCodeBlock, TableControls, ImageBlock/FileBlock, CalloutBlockView, ChildBlockView, YouTube),
`globals.css` içindeki `.prose-editor` kuralları, sayfa panelleri (PageCommentsPanel, PageBacklinksPanel,
KnowledgeContextPanel, LocalGraphPanel, SubItemsPanel), PageHistoryModal, PageMarkdownDialog.

## Görevler
1. Tipografi: içerik H1 (2.25rem) sayfa başlığından (28/34) büyük — H1/H2/H3 ölçeğini sayfa başlığının altına indir,
   gövde 15–16 px/1.7, liste/alıntı/kod aralıkları tek ritimde. Ölçü: 65–75 karakter satır.
2. Eğik çizgi ve seçim menüleri `DropdownMenu` görünümünde (float yüzey, rounded-control satırlar, kısayol `Kbd`),
   bölüm başlıkları cümle düzeninde; `SlashCommandList.tsx` "Divider" çevirisi (8 locale). Notion'dan ayrışma: menüye
   ajana özgü girişleri öne alma fırsatını değerlendir (ör. "Ajandan iste" yoksa önerme, uydurma).
3. Blok tutamakları, seçim (sarı `signal-soft`), kod bloğu, tablo kontrolleri, görsel/dosya blokları token + primitiflere.
4. Yorumlar paneli başlığın hemen altında duruyor (Notion kalıbı): yerini ve varsayılan kapalı/açık halini öner, Hakan'a
   sorarak karar ver; seçilen halini uygula.
5. Callout renkleri kullanıcı verisidir (mavi dahil kalır) ama yüzeyleri (radius, padding, ikon) yeni dile.
6. Sayfa panelleri (bağlantılar, bilgi bağlamı, yerel harita): kart yerine başlık + ince çizgi; boş durumlar `EmptyState sm`.
7. Tüm `text-[8..11px]` değerlerini ölçeğe taşı; `neutral-*` sınıflarını gördüğün yerde rol tokenına çevir.

## Doğrulama
eslint (değişen dosyalar), `npx tsc --noEmit`; Hakan onayıyla Playwright: koyu + açık + bir koyu tema, 390 px, uzun bir
sayfa, kod bloğu, tablo, görsel, eğik çizgi menüsü, blok seçimi.

## Bitirirken
changelog.ts tek kayıt (`improved`); AGENTS.md editör bölümü + Serena conventions; update-handoff; commit yok; bu bölümün
sonuna "Tamamlandı" notu.
```

### ✅ R8.1 — Tamamlandı (2026-09-30, Claude; commit/push yok, migration yok, paket eklenmedi)

**Hakan'ın kararları (soruldu):** yorumlar gövdenin altında, **açık**; başlığın altında yalnız "N yorum" bağlantısı (N>0 iken)
aşağı kaydırır. Ölü `SubItemsPanel.tsx` (Mayıs'tan beri import edilmiyordu) **silindi**.

**Yapılanlar**
- **Tipografi (`globals.css` `.prose-editor`):** gövde 16/1.7 `fg-2` (Küçük/Orta/Büyük tercihi yalnız px'i verir: 14/16/18;
  gerisi em); H1/H2/H3 24/20/18 semibold `fg` → sayfa başlığının (28/34) altında. Tek ritim `--prose-flow` (metin 0.5em,
  nesneler ×1.5 — kod, tablo, callout, medya `.editor-object` ile —, ayırıcı ×3). Liste içi 0.25em, alıntı italiksiz kural +
  `fg-3` (Onest'te italik yok). **Ölçü:** Dar sütun 768px'te ~95 karakter çıkıyordu (ölçüldü) → 560px
  (`pageContainerClass`, `features/pageLayout.ts`); 16px Onest'te satır başına 69–72 karakter ölçüldü. Geniş/Tam dokunulmadı.
- **Kod/tablo/görev:** kod JetBrains Mono (`var(--font-mono)`; önce `monospace`tı), raised kuyu + hairline, "daha fazla göster"
  geçişi raised'a karışır (catppuccin'e özel fade değişkenleri kaldırıldı). Tablo başlığı raised/`fg`, seçili hücre ve sütun
  genişletme tutamacı sarı (mavi değil). Görev kutusu çiziliyor (line kenar, bitince `fg-3` dolgu + tik; üstü çizili `fg-3`).
  Blok seçimi `signal-soft`, köşe 6.
- **Menüler (`editor/menuStyles.ts`):** eğik çizgi, `@`, `:`, sayfa seçici, balon menü, blok seçim çubuğu, tutamaç menüsü ve
  tablo kontrolleri DropdownMenu görünümünde (float yüzey, `shadow-float`, 12 köşe, 8 köşeli satırlar, 16px ikonlar) ama elle
  konumlu — ProseMirror'dan odak çalmamaları gerekiyor. Eğik çizgi menüsü: cümle düzeninde grup başlıkları (Temel bloklar /
  Medya / Sayfalar), satır sonunda markdown kısayolu `Kbd` (`#`, `##`, `-`, `1.`, `[]`, `>`, ```` ``` ````, `---`), `max-h-80`
  + klavye vurgusu görünürde kalır, **"Ayırıcı" çevirisi** (önceki İngilizce kalıyordu) ve filtre artık okurun dilindeki adı da
  eşliyor (aksan/büyük-küçük katlamalı: `/baslik` → "Başlık"). Renk paletleri tek yerde (`editorColors.ts`, değerler aynı),
  yazı/vurgu seçici tek bileşen (`EditorColorPanel`), renk adları ve "Geri/Uygula/Bölümü daralt/Başlık" metinleri i18n'e
  alındı (8 dil). Sürükleme tutamacının elle yapılmış onay modalı → `ConfirmDialog`.
- **Ajana özgü giriş:** değerlendirildi, eklenmedi — editörün içinde çalışan bir ajan eylemi yok; uydurmadım.
- **Blok yüzeyleri:** callout rengi kullanıcı verisi olarak kaldı; yüzey 8 köşe, 16/12 dolgu, 26px ikon kutusu, renk/sil
  kontrolleri hover'da kutunun üst kenarında yüzüyor (metin artık tam genişliği kullanıyor). Görsel/dosya/yer imi/YouTube:
  `raised` + `line`, `Button` primitifi, `×` karakterleri yerine ikon; dosya bloğuna ataç ikonu; alt sayfa satırı gövde
  boyunda altı çizili başlık.
- **Sayfa panelleri:** yeni `PageSection` (ince çizgi + başlık + açılır ok, kart yok) — yorumlar, bilgi bağlamı, geri
  bağlantılar (kart ızgarası yerine satırlar), yerel harita (boş/hata `EmptyState sm`, derinlik anahtarı segment görünümü).
  Bilgi bağlamı formu `Input`/`Textarea`/`SimpleSelect`/`Button loading` primitiflerine geçti. Yorumlar: orta noktasız meta
  (ad + `<time>`), ajan için ayrı renk yok (işaret + "(ajan)"), `fieldClass` yazma kutusu, `Button loading`; `byAgent`
  "by … (agent)" kalıbı 7 dilde "Ad (ajan)" oldu.
- **Diyaloglar:** `PageHistoryModal` ve `PageMarkdownDialog` elle modaldan `Dialog` primitifine (odak tuzağı, Escape);
  geçmiş başlığı cümle düzeni ("Sayfa geçmişi").
- **Ölçek:** kapsamdaki tüm `text-[10/11px]` ölçeğe (`text-2xs`/`text-xs`), `neutral-*` sınıfları rol tokenlarına taşındı
  (editör klasöründe kalan yok).
- **Bulunup düzeltilen hata:** `globals.css`'teki katmansız `input, textarea, button { font-family: inherit }` kuralı her
  input/textarea'daki `font-mono`'yu eziyordu (markdown alanı Onest'le çıkıyordu) → `@layer base`'e alındı.
- **Kapsam dışı ama Hakan'ın bildirdiği:** "Yeni öğe" şablon kartında hover'da başlık beyaza dönüp açık temada kayboluyordu →
  `TemplatePickerModal` kartı rol tokenlarına geçti (modalin geri kalanı R8.5'te).
- **Hakan'ın oturum içi isteği — kenar çubuğu ajan kartı:** tasarruf rakamı ile "AI Ajanlarım" aynı modalı açıyordu → tek
  buton-kart (tek hover, tek tıklama, `cursor-pointer`); proje penceresinde yalnız kapsamlı rakam, tıklanmaz. Rakam artık
  kenar çubuğunun tek sıcak noktası: `signal-soft` panel, dolu `signal` disk, 20px rakam (Hakan: "göze çarpmalı"). Fareyle
  tıklanınca kart odağı bırakıyor (`e.detail > 0`) — modal Escape'le kapanınca karta sarı odak halkası çıkıyordu. Changelog
  `2026-09-30-one-agents-card`.
- Changelog `2026-09-30-pages-easier-to-read` (improved). AGENTS.md (UI & Design + Project Structure → sayfa altı bölümler,
  Editor görünüm/menü notları, SlashCommand*), Serena `conventions` güncellendi.

**Doğrulama:** `npx tsc --noEmit` temiz; eslint (değişen 31+ dosya) 0 hata, 1 eski uyarı (`PageEditor` `onClose`, HEAD'de de
var). Playwright (Hakan onaylı), dev + local.db, demo kullanıcı, uzun test sayfası (başlıklar, listeler, görev, alıntı, kısa +
uzun kod, tablo, 2 callout, ayırıcı, görsel, dosya, yer imi): açık + koyu + Nord, 1440 ve 390 px (yatay kaydırma yok);
eğik çizgi menüsü + TR filtre, balon menü + renk paneli + dönüştür menüsü, blok seçimi, tutamaç menüsü + alt menü, tablo
kontrolleri, yorum gönderme + "1 yorum" atlaması, geçmiş ve markdown diyalogları. Ekran görüntüleri `.playwright-mcp/r81-*`.

**Açık kalan / sonraki adıma not:** veritabanı satırı sayfası (`PageEditor`, peek değil) varsayılan olarak **Tam** genişlikte
açılıyor ve kullanıcının varsayılan genişlik tercihini okumuyor — orada satır uzunluğu kuralı işlemez; R8.2'de (veritabanı
görünümleri) değerlendirilmeli. `PageEditor`'ün özellik paneli R8.2 kapsamında bırakıldı.

---

# R8.2 — Veritabanı görünümleri

> En "Notion gibi" yüzey. Tablo, kanban, takvim, satır sayfası, özellikler kenar çubuğu. Tek oturum (gerekirse iki).

```text
Remnus projesinde çalışıyorsun (Next.js 16, React 19, TS strict, Tailwind v4, next-intl 8 locale). AI.md kuralları geçerli.
`git status --short` ile başla; kullanıcının değişikliklerini ezme. Serena varsa core + conventions. frontend-design skill'ini
kullan. Playwright'tan önce Hakan'a sor.

## Ortak referans (R8)
- Seçilen yön: `.ai/R8_DESIGN_DIRECTIONS.html` → "Seçilen yön: Ortak Masa, tek renk" (Hakan: B'nin yapısı + tek renk,
  tek vurgu sarı, nabız/dalga efekti yok). Kurallar: `AGENTS.md` → UI & Design Aesthetics.
- Tokenlar `src/app/globals.css` @theme: desk/sheet/raised/float/hover/line/line-strong, fg…fg-4, ink/ink-fg, signal/
  signal-fg/signal-text/signal-soft, focus, link, overlay; `rounded-control/surface`; `shadow-lift/sheet/float/modal`;
  `text-2xs` (11) + `text-ui` (13). Yeni token eklersen `src/lib/cn.ts` tailwind-merge listesine de ekle.
- Primitifler `src/components/ui/`: Button, Dialog, DropdownMenu(+Shortcut), Select/SimpleSelect, Tooltip, Badge, Tabs,
  Card, EmptyState, Kbd, Input/Textarea, RemnusMark; `features/PageActionsMenu`, `ConfirmDialog`.
- Yasak: CSS `uppercase` etiket, orta noktayla meta birleştirme, 11 px altı yazı, "→" ekli etiket, döngüsel nabız; mavi yalnız
  veri/kullanıcı rengi. Sınıf değişikliğini codemod'la yapacaksan TypeScript parser'ıyla yalnız literal'lerde ve boşluklara
  dokunmadan (R8 dersi, conventions).

## Kapsam
DatabaseView, ViewsBar, TableLayout, GroupedTableLayout, KanbanBoard, CalendarView, InlineCellEditor, PropertyTags
(StatusChip/UserChip…), DatabasePropertiesSidebar + `database-sidebar/*`, PageEditor'ün özellik bölümü, BulkRowsDialog,
DateRangePicker, recurrence/* diyalogları, AgentEditBadge.

## Görevler
1. Notion kalıplarından çık: renkli kanban sütun zeminleri ve karttaki sol renk şeritleri kalkar (durum/öncelik rozetle
   ya da durum glifiyle — yön sayfasındaki halka glifleri); kart üstündeki "Priority: High" etiket satırları yerine
   değerler (etiket ancak belirsizse); tablo satırı durum tinti (yeşil/kahve) yerine sade satır + durum glifi.
2. Görünüm sekmeleri `Tabs` (line), araç çubuğu `Button ghost`/`Tooltip`; "Yeni" birincil (mürekkep).
3. Özel onay kutuları (5+ kopya) için Base UI Checkbox üzerine `ui/checkbox.tsx` yaz ve hepsini ona taşı (işaretli = sinyal,
   tik `signal-fg`).
4. Özellik düzenleyicideki elle açılır listeler (`absolute … bg-neutral-900 border …`) → `DropdownMenu`/`Select` parçaları
   (arama kutulu seçim için Base UI Combobox değerlendir, paket ekleme yok).
5. Ajan dokunuşu: `AgentEditBadge` tek, tutarlı bir ajan işareti olsun (marka ikonu + tooltip); sarı yalnız "son X dakika"
   ya da canlı durum için (R8.8 ile uyumlu, ama veri tarafına bu promptta girme).
6. Yan kenar çubuğu (özellikler/filtre/sıralama) yüzeyleri raised + çizgi; tüm `text-[8..11px]` ölçeğe.
7. Takvim: bugün işareti sinyal dolgu + `signal-fg`, hafta sonu/ay dışı günler fg-4; olay kartları kart dili.

## Doğrulama
eslint, tsc, `npm run test:recurrence`; Hakan onayıyla Playwright: tablo/kanban/takvim koyu + açık, 390 px, satır peek,
özellik düzenleme, filtre/sıralama, sürükle-bırak.

## Bitirirken
changelog tek kayıt (`improved`: veritabanı görünümleri sadeleşti…); AGENTS.md + Serena; update-handoff; commit yok;
"Tamamlandı" notu.
```

### ✅ R8.2 — Tamamlandı (2026-10-01, Claude; commit/push yok, migration yok, paket eklenmedi)

**Yapılanlar**
- **Notion kalıpları kalktı (görev 1):** kanban sütun zemini, gruplu tablo bölüm zemini, kart sol şeridi, kart/satır renk
  tinti yok. Görünümün "işaret" özelliği (`cardColorCol`, yoksa eski `cardBgCol`; tabloda `rowColorCol`) kanbanda kartın
  üstünde rozet (`PropertyMark`), takvim olayında ve tablo satırında başlıktan önce nokta/durum halkası (`MarkDot`). Grup
  başlıkları seçeneğin glifini taşır (`GroupGlyph`; değersiz grup içi boş halka). Kartta "Etiket:" yalnız değer kendini
  anlatmıyorsa (`isSelfDescribingType`). Kanban ve takvim kartları `bg-raised` + hairline, bırakma çizgisi sinyal.
  Ayarlar: "Kartları işaretle" / "Satırları işaretle" tek seçimi + açıklama; `cardBorderSide`, `groupColBg` artık okunmuyor
  (tiplerde "legacy" notu, kayıtlı config'ler bozulmaz). Ölü `getCardBorderAccents`/`getCardBorderDots`/`getCardBgColor`
  ve `globals.css`'teki `.database-card` açık-tema kuralı + `--database-card-bg`/`--database-muted-group-bg` silindi.
- **Sekmeler + araç çubuğu (görev 2):** `ViewsBar` `Tabs` (line, mürekkep çubuk) üzerinde; aktif sekmeye tık → sekmeye
  bağlı `DropdownMenu` (yeniden adlandır / çoğalt / sil; `DropdownMenuContent` artık `anchor` alıyor, rename alanı
  `finalFocus` ile odakta kalıyor); görünüm ekleme `DropdownMenu`; mobilde tek menü düğmesi. Araç çubuğu ghost `Button` +
  `Tooltip` (yenile, genişlik, toplu ekle, Ayarlar `aria-pressed`), "Yeni" mürekkep birincil + `loading`. Veritabanı başlığı
  sayfa başlığıyla aynı (28/34, simge kaldır balonu R8.1 gibi).
- **Onay kutusu (görev 3):** `src/components/ui/checkbox.tsx` (Base UI; işaretli = sinyal dolgu, tik `signal-fg`). Taşınan
  yerler: kenar çubuğu sütun/grup/kart listeleri (`ToggleRow`), filtre seçenekleri, tablo hücresi (hücre tıkı değiştirir),
  sütun göster/gizle, kanban/takvim kart değerleri, satır sayfası, tekrar silme diyaloğundaki native `accent-red` kutu.
- **Özellik seçicileri (görev 4):** yeni `PropertyValuePicker` — Base UI Combobox, arama kutusu popup içinde (ok tuşları +
  Enter, Esc, "X oluştur", durumlar grup başlıklı). Tablo/kanban hücre editörü (`InlineCellEditor`) ve satır sayfasının
  özellik listesi bunu kullanıyor; elle açılan `absolute bg-neutral-900` listeleri kalmadı. Tablo sütun menüsü (sırala /
  gizle / genişliği sıfırla / filtre) form alanı taşıdığı için `menuStyles` görünümünde elle konumlanan panel olarak kaldı;
  filtre değer alanı `FiltersSection` ile ortak (`FilterValueField`, `useFilterOperators`).
- **Ajan işareti (görev 5):** `AgentEditBadge` tek görünüm: nötr disk üzerinde ajanın marka ikonu + ui `Tooltip`
  ("{ajan} MCP ile düzenledi: {zaman}"); sinyal noktası yalnız son 10 dakikadaki düzenlemede. Veri tarafına girilmedi.
- **Yan panel + ölçek (görev 6):** kenar çubuğu yüzeyleri raised + çizgi, `text-[8..11px]` → `text-2xs`/`xs`/`ui`, codemod
  (TS parser, yalnız literal) ile nötr rampa → rol tokenları.
- **Takvim (görev 7):** bugün tek sinyal dolgulu gün numarası (`signal-fg`, `aria-current="date"`), hafta sonu ve ay dışı
  numaralar `fg-4` (ay dışı hücre hafif desk tonu); gün/ay/hafta aralığı `Intl` ile UI dilinde (`formatRange`); büyük harfli
  gün dizileri ve "Mapped to:" kaldırıldı; boş durum `EmptyState` (döngüsel `animate-pulse` gitti); gün sayısı hover'da
  gün eylemlerine yer verir; olayda yalnız seçilmiş sayfa simgesi.
- **Satır peek + diğerleri:** peek başlığı tek `PeekHeader` (kapat, "Tam sayfada aç", `DropdownMenu`), yüzey `bg-sheet` +
  `shadow-modal`, arka plan `bg-overlay`. `DateRangePicker` float yüzey, yerel ay/gün adları, bugün sinyal halka, aralık
  `signal-soft`, Button'lar; tarih aralığı ayırıcısı "→" yerine "–". `BulkRowsDialog`, `RecurrenceDialog`,
  `RecurrenceScopeDialog` → `Dialog` primitifi (segmented `Tabs`, `Button`, `Textarea`/`Input`); `OptionTile` seçimi sinyal
  halka, kırmızı ton yalnız silmede; `SeriesPanel`/`RecurringBadge`/geri bildirim toast'ı nötr. `PropertyTypeIcon` tablo
  başlığı ve satır sayfasında ortak.
- **i18n (8 dil):** 28 yeni `Database` anahtarı (none, selectProperty, calendar*, cardMark*, groupByHint, columnOptions,
  removeSort, hideColumn, resetWidth, loadingPage, searchPlaceholder, noMatches, openLink, dateRange, agentEditedTooltip…),
  `bulkImport.ignoredColumns`/`moreRows`, `Editor.colorTeal`; değer düzeltmeleri: rowColor → "Satırları işaretle",
  toggleColumns, defaultPageIcon(Color), visibleGroups cümle düzeni, addSelectProperty (durum dahil).

**Doğrulama:** eslint (yalnız önceden var olan 4 uyarı), `npx tsc --noEmit` temiz, `npm run test:recurrence` 26/26.
Playwright (yerel demo çalışma alanı, açık + koyu, 1440 ve 390 px): kanban, tablo, takvim (geçici "Due" özelliği + takvim
görünümü eklenip sonra silindi), sütun menüsü + filtre, seçici ile değer değiştirme (yazma + Enter, Esc), satır peek ve
"⋯" menüsü, tarih seçici, tekrar diyaloğu (özel kurucu dahil), görünüm sekmesi menüsü + yeniden adlandırma, kanban
sürükle-bırak (geri alındı). Test verisi eski hâline döndürüldü.

**Açık kalanlar kapatıldı (2026-10-01, Hakan: "dokunmadığın açık alanları da kapat"):** yeni satır boş başlıkla açılır
(yerel "Başlıksız" yer tutucu; `createPage` artık her satıra sabit `status: 'To Do'` yazmıyor — şemanın kendi varsayılanı,
"To Do" yalnız o seçeneği olan stok Durum sütununda), yeni görünüm/özellik adları UI dilinde (`viewTable/viewBoard/
viewCalendar`, `newProperty`), tarih biçimi (varsayılan + göreli) UI dilinde (`formatDateValue(..., locale)`), değeri boş
filtre artık uygulanmıyor (satırları gizlemiyor; görünüm ve pano aynı), satır peek'i görünümün kutusuna sığıyor (vh yerine
%; mobilde üst şerit artık örtülmüyor). Hâlâ İngilizce olan ve ayrı iş olanlar: şablonlar (`templates.ts`), MCP/Notion
içe aktarmanın görünüm adları.

---

# R8.3 — Panolar

> R6/R8'in panosunu bitirir: bloklar, blok editörü, gömülü veritabanı, boş/hata durumları.

```text
Remnus projesinde çalışıyorsun. AI.md kuralları geçerli. `git status --short` ile başla. Serena varsa core + conventions
(Dashboards bölümü dahil). frontend-design + dataviz skill'lerini kullan. Playwright'tan önce Hakan'a sor.

## Ortak referans (R8)
- Seçilen yön: `.ai/R8_DESIGN_DIRECTIONS.html` → "Seçilen yön: Ortak Masa, tek renk" (Hakan: B'nin yapısı + tek renk,
  tek vurgu sarı, nabız/dalga efekti yok). Kurallar: `AGENTS.md` → UI & Design Aesthetics.
- Tokenlar `src/app/globals.css` @theme: desk/sheet/raised/float/hover/line/line-strong, fg…fg-4, ink/ink-fg, signal/
  signal-fg/signal-text/signal-soft, focus, link, overlay; `rounded-control/surface`; `shadow-lift/sheet/float/modal`;
  `text-2xs` (11) + `text-ui` (13). Yeni token eklersen `src/lib/cn.ts` tailwind-merge listesine de ekle.
- Primitifler `src/components/ui/`: Button, Dialog, DropdownMenu(+Shortcut), Select/SimpleSelect, Tooltip, Badge, Tabs,
  Card, EmptyState, Kbd, Input/Textarea, RemnusMark; `features/PageActionsMenu`, `ConfirmDialog`.
- Yasak: CSS `uppercase` etiket, orta noktayla meta birleştirme, 11 px altı yazı, "→" ekli etiket, döngüsel nabız; mavi yalnız
  veri/kullanıcı rengi. Sınıf değişikliğini codemod'la yapacaksan TypeScript parser'ıyla yalnız literal'lerde ve boşluklara
  dokunmadan (R8 dersi, conventions).
- Pano rotası `onDesk`: bloklar masada kart (`rounded-surface bg-raised lg:bg-sheet shadow-sheet`).
Proje bloğu varsa pano başlığı küçük etikettir (`DashboardHeader compact`) — tek başlık kararı R8'de verildi.

## Kapsam
`src/components/features/dashboard/*` (DashboardBlocks, DashboardBlockEditor, DashboardDatabaseEmbed, BlockActions,
AddBlock), `src/lib/dashboard/*` yalnız görünümle ilgili yerler, `services/homeDashboard.ts` blok kompozisyonu gerekirse.

## Görevler
1. Grafik paleti (`PALETTE`) açık temada da ölç (dataviz skill doğrulayıcısı); halka izi `--color-hover`; eksen/etiketler
   tokenlarda.
2. Yön sayfasındaki "Ajan etkinliği" bloğunu değerlendir: çağrıları ajan oturumu başına gruplayan (başlık: ajan, çağrı ve
   yazma sayısı, son zaman; liste açılır) görünüm — veri zaten `activity` bloğunda; yeni sorgu gerekirse maliyetini ölç.
3. Durum dağılımı için donut yerine yatay yığın çubuk seçeneğini değerlendir (yön sayfasındaki gibi), metrik bloğunda
   büyük sayı + küçük değişim.
4. DashboardBlockEditor sağ çekmecesi: form alanları `Input/Textarea/SimpleSelect`, kaydet `Button primary`, alan etiketleri
   cümle düzeninde; çekmece yüzeyi R8.5'in `Sheet` kalıbıyla hizalı.
5. Boş/hata durumları `EmptyState`; `andMore` gibi küçük yazılar ölçekte.

## Doğrulama
eslint, tsc; Hakan onayıyla Playwright: kalibre edilmiş bir pano + otomatik kurulan pano, koyu/açık, 390 px, blok ekle/düzenle.

## Bitirirken
changelog (`improved`); AGENTS.md Dashboards + Serena; update-handoff; commit yok; "Tamamlandı" notu.
```

### ✅ R8.3 — Tamamlandı (2026-10-01, Claude; commit/push yok, migration yok, paket eklenmedi)

**Yapılanlar**
- **Palet (görev 1):** `DashboardBlocks`'taki `PALETTE` dataviz doğrulayıcısında kalıyordu (bitişik #e66767↔#d55181
  normal görüş ΔE 7,8 < 15; #008300↔#c98500 CVD 6,9). Referans sekizli, doğrulanmış sırasıyla `--chart-1…8` +
  `--chart-muted` tokenlarına taşındı (`globals.css`; koyu temalarda koyu basamaklar, `catppuccin`'de açık basamaklar).
  Doğrulayıcı: koyu sheet/raised'da tüm kontroller PASS (CVD ≥ 8,4, normal ≥ 19,3, ≥ 3:1); açıkta PASS + 3 dilimde 3:1 altı
  uyarısı → her grafikte değer/etiket görünür (rahatlama kuralı). Dracula/Tokyo/Nord yüzeylerinde de yalnız kontrast
  uyarısı. Renk artık sırayla değil varlıkla gider: `ChartPoint.colorIndex` seçenek/durum sütununda seçeneğin yerini korur
  (filtre değişince renk kaymaz); 8'i aşan dilim soluk. Halka izi `--color-hover`; eksen/etiketler tokenlarda; işaretlere
  hover başlıkları (SVG `<title>`; HTML'de React 19 `<title>`ı `<head>`'e taşıdığı için `title` özniteliği).
- **Ajan etkinliği (görev 2):** blok son 100 çağrıyı **oturumlara** ayırıyor (aynı token, 30 dk'dan kısa aralık, en çok 4):
  başlıkta ajanın işareti, adı, canlıysa (15 dk) sabit sinyal nokta, "N çağrı, M yazma" ve göreli zaman; altında çağrılar
  (araç, dokunduğu sayfa/satır/veritabanı adı, saat). En yeni oturum açık, eskiler yerel `<details>` (sunucu bileşeni kalır).
  Hedef adları tek toplu okumayla (öğe/satır/veritabanı, çalışma alanına kapsamlı) — yerelde blok çözümlemesi medyan 3,3 ms.
- **Yığın çubuk + metrik (görev 3):** yeni `chart` varyantı `stack`: tek yatay çubuk, 2px boşluk, sütunun seçenek sırası
  (yapılacak → bitti), sayılı iki sütunlu açıklama. Ev panosu besteleyicisi, katalog örneği, `docs/mcp/dashboards.md`,
  `calibrate.md` ve dört oyun kitabı durum karışımı için `stack` öneriyor; `donut` geçerli kalıyor (dilimler arası boşluk
  eklendi). Editörde yeni grafik varsayılanı `bar`. Metrik: 40px sayı + nötr (mürekkep) değişim satırı — "yukarı" her zaman
  iyi değil, yeşil/kırmızı kalktı.
- **Blok editörü (görev 4):** yeni `ui/sheet.tsx` (Base UI Dialog üzerinde sağ panel; R8.5 bunu kullanacak). Alanlar
  `Input`/`Textarea`/`SimpleSelect`/`Checkbox`, kaydet `Button primary` + `loading`, ekle/kaldır ghost `Button`, blok türü
  seçici kalkık sekme görünümünde, etiketler cümle düzeninde (zaten öyleydi), Escape/odak Sheet'ten.
- **Boş/hata (görev 5):** veri yok, kaynak/sütun silinmiş, okunamayan blok ve gömülü görünümde satır yok → `EmptyState
  size="sm"`; dikkat ikonları `signal-text` (amber kalktı); `andMore` ve "kaldırıldı" yazıları `text-xs`. Blok eylemleri 24px
  düğme + `Tooltip`; "Blok ekle" `Button`. Durum başlığındaki boşluklu uzun tire kalktı ("{name}: duruma göre").
- **i18n (8 dil):** `Dashboard.sessionMeta`, `callFailed`, `editor.variants.stack`; tr/hi `home.byStatus` düzeltmesi.

**Doğrulama:** eslint (bu dosyalarda 0), `npx tsc --noEmit` temiz, `npm run test:recurrence` 26/26; dataviz
`validate_palette.js` (koyu/açık + diğer koyu temalar). Playwright (Hakan onayıyla; yerel demo, otomatik kurulan pano,
açık + koyu, 1440 ve 390 px): yığın çubuk, halka, oturumlar, Sheet ile blok ekle/düzenle/sil (geçici "Öncelik dağılımı"
ve proje başlığı blokları eklenip silindi).

---

# R8.4 — Bilgi haritası

> Harita ekranını yeni dile taşır; sigma renkleri tema tokenlarından gelir.

```text
Remnus projesinde çalışıyorsun. AI.md kuralları geçerli. `git status --short` ile başla. Serena varsa core + conventions
(Knowledge map bölümü: WebGL renkleri OPAK hex olmalı, `graphTheme.ts` `blend`). Playwright'tan önce Hakan'a sor.

## Ortak referans (R8)
- Seçilen yön: `.ai/R8_DESIGN_DIRECTIONS.html` → "Seçilen yön: Ortak Masa, tek renk" (Hakan: B'nin yapısı + tek renk,
  tek vurgu sarı, nabız/dalga efekti yok). Kurallar: `AGENTS.md` → UI & Design Aesthetics.
- Tokenlar `src/app/globals.css` @theme: desk/sheet/raised/float/hover/line/line-strong, fg…fg-4, ink/ink-fg, signal/
  signal-fg/signal-text/signal-soft, focus, link, overlay; `rounded-control/surface`; `shadow-lift/sheet/float/modal`;
  `text-2xs` (11) + `text-ui` (13). Yeni token eklersen `src/lib/cn.ts` tailwind-merge listesine de ekle.
- Primitifler `src/components/ui/`: Button, Dialog, DropdownMenu(+Shortcut), Select/SimpleSelect, Tooltip, Badge, Tabs,
  Card, EmptyState, Kbd, Input/Textarea, RemnusMark; `features/PageActionsMenu`, `ConfirmDialog`.
- Yasak: CSS `uppercase` etiket, orta noktayla meta birleştirme, 11 px altı yazı, "→" ekli etiket, döngüsel nabız; mavi yalnız
  veri/kullanıcı rengi. Sınıf değişikliğini codemod'la yapacaksan TypeScript parser'ıyla yalnız literal'lerde ve boşluklara
  dokunmadan (R8 dersi, conventions).
- Harita kâğıdın içinde yaşar. Mavi burada VERİDİR (düğüm türleri, güven renkleri) — sinyal sarısı
seçim/hover/canlı için.

## Kapsam
`src/components/features/graph/*` (GraphScreen araç çubuğu, lejant, "Dikkat isteyenler" paneli, seçim kartı, LocalGraphPanel),
`graphTheme.ts`.

## Görevler
1. Araç çubuğu: Ağ/Ağaç `Tabs segmented`, Renk/Katmanlar `SimpleSelect`/`DropdownMenu`, arama `Input`, ikon butonlar `Tooltip`'li.
2. `graphTheme.ts` yeni rampayı ve `--color-signal`'i okusun (seçim halkası, hover, ajanın son dokunduğu düğüm); beş temada
   kontrastı ölç (açık temada saydam renk görünmez — opak karışım kuralı).
3. Sağ panel ve seçim kartı: başlık + ince çizgi, `EmptyState sm`, cümle düzeni.
4. R7 notu: demo kullanıcıda alttaki çerez bandı seçim kartını örtüyor — kartı güvenli alana taşı ya da bandı kaldırdıktan
   sonra konumla.

## Doğrulama
eslint, tsc, `npm run bench:graph` (render yolu değiştiyse); Hakan onayıyla Playwright: koyu/açık/Nord, zoom out tıklama,
satırları getir, 390 px.

## Bitirirken
changelog (`improved`); AGENTS.md Knowledge Map + Serena; update-handoff; commit yok; "Tamamlandı" notu.
```

### ✅ R8.4 — Tamamlandı (2026-10-01, Claude; commit/push yok, migration yok, paket eklenmedi)

**Yapılanlar**
- **Araç çubuğu (görev 1):** harita kâğıdın üstünde (`bg-sheet`, alt çizgi); Ağ/Ağaç `Tabs segmented`, Renk ve etkinlik
  günü `SimpleSelect`, Katmanlar `DropdownMenu` + yeni `DropdownMenuCheckboxItem` (primitife eklendi; işaretli = sinyal,
  menü açık kalır), arama `Input` + `menuStyles` öneri listesi, yeniden düzenle/sığdır ghost `Button` + `Tooltip`, Pano
  `Button secondary` (mavi kalktı, oluştururken `loading`), mobil "Dikkat isteyenler" düğmesi sinyal-text ikonlu.
- **Renkler (görev 2):** `graphTheme.ts` artık `--color-signal` / `--color-focus` okuyor. Hover/seçim/arama halkası
  `--color-focus` (2 px). Beş temada ölçüldü: açık temada parlak sinyal beyazda 1,85:1 (halka kayboluyordu), focus altını
  okunur. Ajan yazması `--color-signal`; tuvalde 3:1'in altına düşerse (`contrast()`) focus altınına geçiyor (açık temada).
  Mavi veri rengi kaldı; taslak sarı yerine mor (haritada başka sarı yok), kümeler panoların doğrulanmış `--chart-1…8`'i.
  Lejant ve katman çizgileri tuvalle aynı `readGraphTheme()` nesnesini okuyor (`useGraphTheme` →
  `useSyncExternalStore(watchTheme)`), renk sapamaz. Not: CSS değişkenleri `#fff` gibi kısa döndürebiliyor; `hexToRgb`
  genişletiyor. Ölçülen düşük kontrastlar (etiketli olduğu için kabul): açık temada etiket/satır 2,5–2,6, Nord'da chart-6
  2,5 ve pano 2,96.
- **Sağ panel + seçim kartı (görev 3):** başlık + ince çizgi, cümle düzeni, grup başına "Burada düzeltilecek bir şey yok"
  satırı; hiçbiri yoksa `EmptyState sm`. Seçim kartı float yüzey, Aç `Button primary`, satırlar `Button secondary loading`,
  ajan satırı sinyal noktalı. Yükleme/başarısız/boş durumlar `EmptyState`.
- **Çerez bandı (görev 4, R7 notu):** `CookieConsentBanner` yüksekliğini `--consent-banner-height` olarak yayınlıyor
  (ResizeObserver; bant yokken 0); seçim kartı `bottom: calc(var(--consent-banner-height) + 0.75rem)`.

**Doğrulama:** eslint, `npx tsc --noEmit` temiz (dev'in bozuk `routes.d.ts`'i yeniden başlatmayla onarıldıktan sonra
yeniden koşuldu). `bench:graph` koşulmadı: render yolu değişmedi (yalnız renk ve halka). Playwright (Hakan onayıyla; yerel
demo): açık/koyu/Nord, seçim halkası, ajan modu, satırları getir (~370 ms), uzak zoom'da küçük düğüme tıklama, katman
aç/kapa, ağaç düzeni, çerez bandıyla kart konumu (kart 823 px'te biter, bant 843 px'te başlar), 390 px + mobil panel.
Beş temada kontrast tarayıcıda ölçüldü.

---

# R8.5 — Modallar, ayarlar ve bildirimler

> 33 elle kurulmuş katmanı tek kalıba indirir. Büyük; gerekirse iki oturum (önce kalıp + ayarlar, sonra geri kalanlar).

```text
Remnus projesinde çalışıyorsun. AI.md kuralları geçerli. `git status --short` ile başla. Serena varsa core + conventions.
frontend-design skill'ini kullan. Playwright'tan önce Hakan'a sor.

## Ortak referans (R8)
- Seçilen yön: `.ai/R8_DESIGN_DIRECTIONS.html` → "Seçilen yön: Ortak Masa, tek renk" (Hakan: B'nin yapısı + tek renk,
  tek vurgu sarı, nabız/dalga efekti yok). Kurallar: `AGENTS.md` → UI & Design Aesthetics.
- Tokenlar `src/app/globals.css` @theme: desk/sheet/raised/float/hover/line/line-strong, fg…fg-4, ink/ink-fg, signal/
  signal-fg/signal-text/signal-soft, focus, link, overlay; `rounded-control/surface`; `shadow-lift/sheet/float/modal`;
  `text-2xs` (11) + `text-ui` (13). Yeni token eklersen `src/lib/cn.ts` tailwind-merge listesine de ekle.
- Primitifler `src/components/ui/`: Button, Dialog, DropdownMenu(+Shortcut), Select/SimpleSelect, Tooltip, Badge, Tabs,
  Card, EmptyState, Kbd, Input/Textarea, RemnusMark; `features/PageActionsMenu`, `ConfirmDialog`.
- Yasak: CSS `uppercase` etiket, orta noktayla meta birleştirme, 11 px altı yazı, "→" ekli etiket, döngüsel nabız; mavi yalnız
  veri/kullanıcı rengi. Sınıf değişikliğini codemod'la yapacaksan TypeScript parser'ıyla yalnız literal'lerde ve boşluklara
  dokunmadan (R8 dersi, conventions).
- `ui/dialog.tsx` zaten yeni dilde (float yüzey, modal gölgesi, overlay tokenı).

## Kapsam
`fixed inset-0` ile elle kurulmuş tüm katmanlar (R8 denetimi: 33 dosya): UserSettingsModal, WorkspaceSettingsModal + sekmeleri
(`workspace-settings/*`), AgentsModal + `agents/*` (ConnectModal, ConnectFlow), TrashModal, WhatsNewButton modalı,
TemplatePickerModal, BillingModal, PlanPickerModal, BillingSuccessModal, PwaInstallModal, ShareModal, AvatarCropModal,
IconPicker, AgentDetectModal, WelcomeModal, BulkRowsDialog, RecurrenceDialog, PageHistoryModal, PageMarkdownDialog; bildirimler
(DownloadToast, UpdateBanner, sidebar silme hatası, PwaInstallNudge, DemoFeedbackPrompt).

## Görevler
1. Kalıp: geniş/sekmeli modallar için `Dialog` üzerine `ui/dialog.tsx`'e boyut varyantları (sm/md/lg/full) ve kaydırılabilir
   gövde + sabit başlık/ayak; mobilde alttan açılan `Sheet` (Base UI Drawer/Dialog) — tek bileşen ailesi.
2. Ayarlar: sol sekmeler `Tabs` (dikey) ya da liste; form alanları Input/SimpleSelect/Checkbox (R8.2'nin primitifi), bölüm
   başlıkları cümle düzeninde; tehlikeli bölge tek kalıp.
3. AI Ajanlarım: token satırları kart değil liste; "PAT", "Okuma ve yazma", "Süresiz" gibi etiketler `Badge` varyantları
   (tek renk dili: kapsam yazma = signal, okuma = neutral); bağlanma akışı adımları.
4. Toast: tek `ui/toast` kalıbı (Base UI Toast değerlendir) — DownloadToast, silme hatası, güncelleme bandı aynı dil.
5. Tüm `text-[8..11px]`, özel onay kutuları, elle butonlar primitiflere.
6. Admin yüzeyleri (`features/admin/*`, `/admin`) R8 codemod'unda bilerek atlandı (mavi hâlâ orada): bu oturumda istersen
   aynı kurallarla geçir, ama müşteri yüzeylerinden sonra.

## Doğrulama
eslint, tsc; Hakan onayıyla Playwright: her modalı koyu + açık + 390 px'de aç; Escape/odak tuzağı/odak dönüşü; uzun de/ru
metinleri.

## Bitirirken
changelog tek kayıt (`improved`); AGENTS.md + Serena (yeni Dialog/Sheet/Toast kalıbı, "yeni modal nasıl yazılır"); update-handoff;
commit yok; "Tamamlandı" notu.
```

### ✅ R8.5 — Tamamlandı (2026-10-01, Claude; tek oturumda, commit/push yok, migration yok, paket eklenmedi)

**Yapılanlar**
- **Kalıp (görev 1):** `ui/dialog.tsx` artık tek modal ailesi: `DialogContent size` sm 24rem / md 32rem / lg 44rem /
  full 60rem × sabit yükseklik (sekmeli modal zıplamaz); `DialogBody` eklendi. Şekli içerik seçiyor: `DialogBody` varsa
  **panel** (başlık/ayak ince çizgili sabit çubuk, yalnız gövde kayar), yoksa **compact** (tek blok, bütün olarak kayar) —
  `globals.css` başındaki `dialog-compact` / `in-dialog-compact` / `in-dialog-panel` `@custom-variant`'ları. `sm` altında
  alttan açılan sheet (`animate-sheet-up`, safe-area payı), üstünde ortada. İç içe dialog ebeveyni karartıyor
  (`data-nested-dialog-open`), Escape yalnız üsttekini kapatıyor. Base UI Drawer yerine Dialog (jest gerekmiyor; Base UI'nin
  kendi önerisi). `ui/sheet.tsx` aynı parçaları (header/body/footer/title, kapat düğmesi, overlay) paylaşıyor; ölü
  `animate-in slide-in-from-right` sınıfı yerine `animate-slide-in-right`. Eski elle `p-0 gap-0 max-h-[85vh]` kullanan
  BulkRows/Recurrence/RecurrenceScope/PageHistory/PageMarkdown diyalogları `size` + `DialogBody`'ye taşındı.
- **Ayarlar (görev 2):** Kullanıcı ve Çalışma alanı ayarları `size="full"` Dialog + yeni `Tabs variant="nav"` (dikey
  satırlar, aktif dolu; telefonda kayan şerit) + `TabsPanel`. Yeni `ui/settings.tsx`: `SettingsPage/Section/List/Row`,
  `Field`, tek kalıp `DangerZone` (hesap silme + workspace silme). Yeni `ui/segmented-control.tsx` (Base UI RadioGroup):
  tercihler, paylaşım izni/genişliği, token kapsamı, OS seçimi, demo geri bildirimi. Dil seçimi `SimpleSelect` (bayraklı),
  tema seçici radio grubu; tema şeritleri R8 rollerine (masa/kâğıt/sinyal) güncellendi. Tüm sekmeler (Genel, MCP, Üyeler,
  Paylaşım, Faturalama, Taşınabilirlik, Masaüstü, İçe aktar + Notion/OKF akışları) primitiflere; hesap silme onayı iç içe
  Dialog; avatar kırpma Dialog. Başlıklar cümle düzenine çekildi (en/tr/es/fr anahtarları), eksik çevrilmiş kırpma
  metinleri 6 dilde tamamlandı, `Templates.nameLabel/namePlaceholder` ve `Sharing.openShare` eklendi (8 dil).
- **AI Ajanlarım (görev 3):** token satırları liste (kart yok); `Badge` varyantları — yazma `signal`, okuma `neutral`,
  süre `outline/warning/danger` (Badge'e `warning` eklendi), PAT/OAuth `outline`; ajan türü seçici `DropdownMenu`;
  "·" birleştirmeleri kalktı; iptal async `ConfirmDialog`. Bağlanma akışı adımları çubuk + "Adım n/3"; editör kartları
  seçimde sinyal halkası; otomatik bağlan paneli `signal-soft`; kod blokları/token mono; Claude animasyonu tokenlara ve
  11 px tabanına çekildi. `ConnectModal` iç içe Dialog.
- **Toast (görev 4):** yeni `ui/toast.tsx` (Base UI Toast, modül düzeyi yönetici, `toast()` / `toast.update` /
  `toast.close`; `<Toaster />` `(app)` layout'ta; sağ altta, mobil nav ve çerez bandının üstünde; tone yalnız semantik ikon,
  `progress` sinyal çubuğu). DownloadToast, UpdateBanner (tek id ile evreler: sunuldu → iniyor → hazır/hata), sidebar silme
  hatası, takvim tekrar geri bildirimi ve PwaInstallNudge artık `toast()`; DemoFeedbackPrompt form olduğu için kendi
  kartında ama `toastSurfaceClass` + primitifler.
- **Diğer modallar (görev 5):** Çöp kutusu, Yenilikler (`full`, kategori glifle, okunmamış = `Badge signal`; her kart
  sarı değil), Şablon seçici (iki adım tek Dialog; Escape adımda geri; varsayılan ad UI dilinde), Faturalama + Plan seçici +
  Demo uyarısı (üç kat iç içe), Ödeme başarılı, PWA kur, Paylaş, Ajan bulundu, Karşılama → Dialog. IconPicker popover'ı
  float yüzey + `Tabs` + `Input`/`Button` (konumlama aynı). AgentDetectNotice tek renk. Kapsamdaki `text-[8..11px]`,
  elle onay kutuları ve elle butonlar primitiflere geçti.
- **Admin (görev 6):** yapılmadı — `AdminUserDetailModal` hâlâ elle katman + eski stil; ayrı bir admin turunda.

**Doğrulama:** eslint (değişen dosyalar: 0 hata, 3 eski uyarı), `tsc` temiz (dev açıkken yarım `.next/dev/types` yüzünden
`.playwright-mcp/tsconfig.check.json` ile). Playwright (yerel demo): koyu + açık + 390 px; Escape, odak tuzağı, odak dönüşü
(hesap menüsü düğmesine), iç içe Escape (önce çocuk), ru/de uzun metinler (ayarlar, paylaşım), boş durumlar (Çöp kutusu, Paylaşım),
toast (sunucu eylemi engellenerek silme hatası → öğe geri geldi + toast). Bulunan dev tuzağı: `globals.css` değişikliği
Turbopack önbelleğinde görünmedi → `.next/dev` → `.next/dev-stale-20261001-r85` (silinebilir). Dev durduruldu.

**Açık kalanlar:** dil değişince Ayarlar penceresi kapanıyor (dil değişimi istemci ağacını yeniden kuruyor; eskiden de
böyleydi sanılıyor, yoğunluk vb. `router.refresh` açık tutuyor); bağlanma listesinde "Other tool" etiketi `deeplinks.ts`'de
İngilizce sabitti — sonradan düzeltildi (`connectOtherTool`, 8 dil); admin modalı; pazarlama `SetupGuideModal` R8.7'ye.

---

# R8.6 — Giriş, kurulum ve onboarding

> Müşterinin ilk beş dakikası: giriş, kurulum/katılım bağlantıları, OAuth onayı, karşılama.

```text
Remnus projesinde çalışıyorsun. AI.md kuralları geçerli (kurulum linki ve OAuth güvenlik kurallarına dokunma — yalnız görünüm).
`git status --short` ile başla. Serena varsa core + conventions. frontend-design skill'ini kullan. Playwright'tan önce Hakan'a sor.

## Ortak referans (R8)
- Seçilen yön: `.ai/R8_DESIGN_DIRECTIONS.html` → "Seçilen yön: Ortak Masa, tek renk" (Hakan: B'nin yapısı + tek renk,
  tek vurgu sarı, nabız/dalga efekti yok). Kurallar: `AGENTS.md` → UI & Design Aesthetics.
- Tokenlar `src/app/globals.css` @theme: desk/sheet/raised/float/hover/line/line-strong, fg…fg-4, ink/ink-fg, signal/
  signal-fg/signal-text/signal-soft, focus, link, overlay; `rounded-control/surface`; `shadow-lift/sheet/float/modal`;
  `text-2xs` (11) + `text-ui` (13). Yeni token eklersen `src/lib/cn.ts` tailwind-merge listesine de ekle.
- Primitifler `src/components/ui/`: Button, Dialog, DropdownMenu(+Shortcut), Select/SimpleSelect, Tooltip, Badge, Tabs,
  Card, EmptyState, Kbd, Input/Textarea, RemnusMark; `features/PageActionsMenu`, `ConfirmDialog`.
- Yasak: CSS `uppercase` etiket, orta noktayla meta birleştirme, 11 px altı yazı, "→" ekli etiket, döngüsel nabız; mavi yalnız
  veri/kullanıcı rengi. Sınıf değişikliğini codemod'la yapacaksan TypeScript parser'ıyla yalnız literal'lerde ve boşluklara
  dokunmadan (R8 dersi, conventions).
- Artık ayrı bir "auth kart istisnası" yok: auth sayfaları masa üstünde tek bir `Card` (on="desk").

## Kapsam
`/login`, `/client-login`, `/install` (InstallForm, JoinForm, used/expired ekranları), `/invite/[token]`, `/oauth/authorize`,
`/welcome/[token]`, `/account-delete`, public `/share/*` sayfa kabuğu; onboarding (WelcomeModal, GettingStartedChecklist,
AgentDetectGuide/Notice), CookieConsentBanner, PendingGiftToast.

## Görevler
1. Auth kartlarını `Card` + `Button` + `Input` ile yeniden kur; logo `RemnusMark` (PNG yerine, temaya uyar).
2. OAuth onayı: kapsam seçimi `Badge`/radyo kartları; tehlikeli olmayan varsayılan net.
3. Onboarding: kontrol listesi ve karşılama tek renk dilde; ajan bağlama adımı ürünün asıl vaadi — kopyayı ve hiyerarşiyi buna göre.
4. Çerez bandı: masaya oturan ince bir şerit (alt kenar), demo kullanıcıda haritadaki kartı örtmesin.

## Doğrulama
eslint, tsc; Hakan onayıyla Playwright: çıkış yapmış bağlamda her sayfa koyu + açık + 390 px; tek kullanımlık kurulum linki
akışı (yerel), OAuth onayı (yerel istemci).

## Bitirirken
changelog (`improved`); AGENTS.md + Serena; update-handoff; commit yok; "Tamamlandı" notu.
```

### ✅ R8.6 — Tamamlandı (2026-10-01, Claude; tek oturumda, commit/push yok, migration yok, paket eklenmedi)

**Doğrulanan iddialar:** kapsamdaki tüm rotalar/bileşenler mevcuttu; WelcomeModal ve AgentDetect parçaları R8.5'te zaten
`Dialog`'a geçmişti (AgentDetectNotice/Modal'a dokunulmadı). Kurulum linki ve OAuth sunucu mantığına (mint, tek kullanım,
süre, üyelik/rol kontrolü, scope sıkıştırma, imzalı yönlendirme) dokunulmadı — yalnız görünüm.

**Yapılanlar**
- **Ortak kabuk (görev 1):** yeni `features/auth/AuthScreen.tsx` — `AuthScreen` (masa; sol üstte `RemnusMark` + "Remnus" ana
  sayfaya link, sağ üstte dil menüsü, kâğıdın altında sessiz `footer`, alt boşluk çerez şeridini hesaba katar) + tek `Card`:
  form için `AuthCard` (sola hizalı başlık/açıklama/meta), bitmiş/harcanmış ekranlar için `AuthStatus` (semantik renkli ikon
  diski). Yardımcılar: `AuthSection`, `AuthNotice`, `AuthDivider`, `AuthCode` (mesajlarda `<cmd>{command}</cmd>` + `t.rich`),
  `parts.tsx` (`SubmitButton` = `useFormStatus` spinner, `WorkspaceGlyph`, `ProjectChip`), `ProviderButtons`
  (Google/GitHub nötr ikincil buton, tıklanan döner). PNG logolar `RemnusMark`'a döndü. Taşınanlar: `/login` (+ masaüstü
  Tauri durumu: bekliyor/iptal/hata), `/client-login`, `/install` (InstallForm, JoinForm, done/requested/denied, used/expired,
  hata), `/invite/[token]`, `/oauth/authorize` + `/oauth/authorized`, `/welcome/[token]` (parıltı kalktı; ortak
  `GiftLockup`, rozetler `Badge`, süre uyarısı `warning`), `/account-delete/confirm` (`danger` SubmitButton),
  InviteAcceptClient, ProspectInviteClaimClient. Masaüstü tarayıcı dönüşü `/api/auth/client-bridge` (ham HTML) aynı
  masa/kâğıt renklerine, tema çerezine ya da sistem tercihine göre açık/koyu. `LanguageSwitcher` → `DropdownMenu` (mavi
  aktif satır yerine tik; pazarlama `header` tetikleyicisi aynı kaldı).
- **OAuth onayı (görev 2):** yeni `ui/radio-cards.tsx` (`RadioCards`/`RadioCard`, Base UI RadioGroup; seçili = sinyal halkası
  + nokta + hafif `signal-soft/50` — tam ton koyuda kahverengi okunuyordu). Sıra: çalışma alanı (proje sabitliyse tek satır)
  → erişim kartları (okuma "hiçbir şeyi değiştirmez", yazma "ayrıca oluşturur/düzenler") → bağlantı adı → ajan türü (Tooltip'li
  ikon düğmeler). Sunucunun ön seçtiği kapsam (istemcinin isteği; tam `write` istemedikçe okuma) `Varsayılan` rozetli; viewer'da
  yazma kartı devre dışı + açıklama. Reddet/Yetkilendir aynı formda yan yana (Reddet `formAction`, yalnız tıklanan döner).
  Kurulum/katılım ekranları aynı radyo kartlarını kullanıyor; çalışma alanı listesi de radyo kartı.
- **Onboarding (görev 3):** WelcomeModal tek birincil eylem: kendi panelinde "Ajan bağla" (ilk ajanların işaretleriyle), altında
  hayalet "Önce etrafa bakayım"; vaat cümlesi yeniden yazıldı ("ajanını bağla, işe başlamadan sayfalarını okur, yaptığını
  yazar"). GettingStartedChecklist masada küçük kâğıt: adım çubukları, sıradaki adım tek eylemi taşır (bağla = mürekkep buton;
  ilk çağrı = ne yapılacağını söyleyen ipucu + "Bağlantı adımları"), bitti durumu tek renk; yeşil, 10 px yazı, "→" kalktı.
- **Çerez bandı (görev 4):** masada alt kenar boyunca ince şerit (`sm`'den tek satır, telefonda iki), emoji yok, `Button sm`.
  Yüksekliği `--consent-banner-height` olarak yayımlanıyor ve erişilebilirlik widget'ı ölçülen yükseklik kadar kaldırılıyor
  (sabit 5rem yerine). Demo kullanıcıda haritanın seçim kartı şeridin üstünde kalıyor (ölçüldü).
- **Ayrıca:** `PendingGiftToast` `bg-float` kart + `GiftLockup` + `Badge` (globals.css'teki `.pending-gift-toast*` açık tema
  yamaları silindi; odakta da açılıyor). Public `/share/*` kabuğu uygulamanın çerçevesinde: çubuk + paylaşılan ağaç masada,
  sayfa tek kâğıtta, editörün sütunu (`pageContainerClass`) ve 28/34 başlığı; sabit İngilizce "Saved/Back/Contents/Untitled"
  i18n'e alındı (`Page.*`, yeni `Sharing.contents`), `writeBadge` "Düzenlenebilir". **Hata düzeltmesi:** `/invite/[token]`
  geçersiz/süresi dolmuş mesajlarını `Billing`'den istiyordu (anahtar `Errors`'ta) ve ham anahtar gösteriyordu; düzeltildi.
- **Metinler (8 dil, metin düzenlemesiyle):** yeni `Auth.signInTitle/signInHint/desktopSignInHint`,
  `OAuthAuthorize.heading/headingHint/scopeDefault`, `Onboarding.checklistConnectCta/checklistCallHint/checklistCallCta/
  checklistDoneLabel`, `Sharing.contents`; güncellenen: izin açıklamaları (Install + OAuth), OAuth disclaimer (artık "AI
  Ajanlarım", eski "Ayarlar → Tokenlar" yolu yoktu), başlık cümle düzenleri, karşılama metinleri, "Demoyu deneyin",
  `usedOtherHint/expiredHint` (`<cmd>`). Changelog `2026-10-01-clearer-sign-in-and-setup` (`improved`).

**Doğrulama:** eslint (değişen dosyalar temiz), `tsc` temiz (`.playwright-mcp/tsconfig.check.json`). Playwright (yerel dev +
local.db): çıkış yapmış bağlamda login/client-login/install expired+hata/OAuth hata+geçersiz yönlendirme/davet/hediye/paylaşım
koyu + açık + 390 px; dil menüsü (giriş ve pazarlama; dil değiştirme çalışıyor); demo ile tek kullanımlık kurulum linki uçtan uca
(form → done → aynı link "zaten bağlandı"), katılım (üye) ve erişim isteği ekranları (istek GÖNDERİLMEDİ: e-posta atardı);
yerel kayıtlı istemciyle OAuth onayı (Yetkilendir → kod ile yönlendirme, Reddet → `access_denied`, `scope=write` isteğinde
yazma ön seçili + rozet), başarı ekranı (JS kapalı bağlamda), masaüstü giriş durumu (`__TAURI_INTERNALS__` taklidi, hata
durumu), client-bridge açık/koyu, hesap silme geçerli/geçersiz, karşılama modalı (koyu/açık/390) ve kontrol listesinin üç durumu
+ küçültülmüş hali (geçici olarak `role=user` yapılan demo kullanıcıyla, client-bridge akışıyla oturum yenilendi), demo
haritasında seçim kartı ↔ şerit mesafesi (1440: 20 px, 390: 68 px). Test verileri (davet, hediye, silme jetonu, paylaşımlar,
OAuth istemcisi/kodları, CLI token'ı, sahte OAuth bağlantısı/etkinlik) silindi, roller `demo`'ya geri alındı. Dev durduruldu
(port 3000 boş).

**Açık kalan / not:** AgentDetectNotice/Modal yalnız Tauri'de görünür, R8.5 hali korundu (canlı denenmedi). Pazarlama
sitesindeki dil düğmesi (`header`) ve `/unsubscribe` R8.7'ye kaldı. Karşılama modalı açılınca birincil butonda odak halkası
görünüyor (Base UI ilk odak; diğer modallarla aynı davranış).

---

# R8.8 — Ajan varlık katmanı

> Seçilen yönün "ajan aktivitesi birinci sınıf görsel öğe" vaadini veriye bağlar. Yeni özellik; önce ölçüm ve maliyet.

```text
Remnus projesinde çalışıyorsun. AI.md kuralları geçerli; özellikle AGENTS.md → "Live refresh (the change signal)" maliyet
kuralları (boştaki sekme 30 sn'de bir istek; hızlı yoklama yalnız ajan aktifken). `git status --short` ile başla. Serena varsa
core + conventions (Live refresh, Agent savings, audit retention). Playwright'tan önce Hakan'a sor.

## Ortak referans (R8)
- Seçilen yön: `.ai/R8_DESIGN_DIRECTIONS.html` → "Seçilen yön: Ortak Masa, tek renk" (Hakan: B'nin yapısı + tek renk,
  tek vurgu sarı, nabız/dalga efekti yok). Kurallar: `AGENTS.md` → UI & Design Aesthetics.
- Tokenlar `src/app/globals.css` @theme: desk/sheet/raised/float/hover/line/line-strong, fg…fg-4, ink/ink-fg, signal/
  signal-fg/signal-text/signal-soft, focus, link, overlay; `rounded-control/surface`; `shadow-lift/sheet/float/modal`;
  `text-2xs` (11) + `text-ui` (13). Yeni token eklersen `src/lib/cn.ts` tailwind-merge listesine de ekle.
- Primitifler `src/components/ui/`: Button, Dialog, DropdownMenu(+Shortcut), Select/SimpleSelect, Tooltip, Badge, Tabs,
  Card, EmptyState, Kbd, Input/Textarea, RemnusMark; `features/PageActionsMenu`, `ConfirmDialog`.
- Yasak: CSS `uppercase` etiket, orta noktayla meta birleştirme, 11 px altı yazı, "→" ekli etiket, döngüsel nabız; mavi yalnız
  veri/kullanıcı rengi. Sınıf değişikliğini codemod'la yapacaksan TypeScript parser'ıyla yalnız literal'lerde ve boşluklara
  dokunmadan (R8 dersi, conventions).
- Hakan: insan/ajan için iki renk yok; canlı durum SABİT sarı nokta, nabız/dalga yok.

## Hedef (yön sayfasındaki mock'lar)
- Sidebar ajan panelinde: çalışan ajan ("Claude Code çalışıyor" + son araç çağrısı ve hedefi), son çalışan ajanlar.
- Ağaçta: son N dakikada ajanın dokunduğu öğede küçük sarı işaret / "12 dk" (zamanla söner, animasyonsuz).
- Sayfa başlığının altında köken satırı: "Claude Code 2 dk önce düzenledi · Sen dün" (orta nokta yerine ayrı öğeler) +
  inceleme durumu (knowledge review: "Ajan yazdı, incelenmedi" + İncele).
- (Opsiyonel, ayrı karar) sayfa üst çubuğunda varlık (sen + çalışan ajan avatarı).

## Kurallar
1. Önce ölç: hangi veri nereden (agent_activity hedef id'leri, pages.agent_edited_at, standalone sayfalar için karşılığı var
   mı), audit görünürlük penceresi (`auditVisibleSince`) uygulanmalı, proje penceresi kilidi (`assertWorkspaceLockAllows`).
2. Yeni istek türü eklemeden önce mevcut `GET /api/activity/changes` / heartbeat yanıtına sığdırmayı değerlendir (yanıt ~20 bayt
   kuralı); ek maliyeti bench ile göster, Hakan'a sun, onay al.
3. Migration gerekirse `ALTER TABLE ADD COLUMN`, apply script deseni, prod uygulaması deploy günü Hakan'da.

## Doğrulama
eslint, tsc, ilgili testler (`test:access`, `test:agent-access`); yerel MCP ile gerçek ajan yazması → sidebar/sayfa canlı
güncelleniyor mu (Hakan onayıyla Playwright), boştaki sekme istek sayısı değişmedi mi.

## Bitirirken
changelog (`new`); AGENTS.md (Live refresh + yeni bölüm) + Serena; update-handoff; commit yok; "Tamamlandı" notu.
```

### ✅ R8.8 — Tamamlandı (2026-10-01, commit'siz, migration yok, paket yok)

**Ölçüm (önce):** veri zaten vardı — `agent_activity` (her MCP çağrısı; hedef = item / satır / `databases.id`,
bulk araçlarda hedef yok), satırlarda `pages.agent_edited_at`, standalone sayfalarda karşılığı yok AMA her MCP
create/update `knowledge_metadata.generated_by/generated_at` damgası yazıyor (sayfa + satır). Son insan düzenlemesi:
sürüm geçmişi (`page_snapshots`, insan, debounce'lu). İnceleme: `knowledge_reviews` (başlık+gövde hash'i).
**Yeni istek türü eklenmedi**, `/api/activity/changes` ve heartbeat gövdesi büyümedi → Hakan onayı gereken ek maliyet yok;
yalnız mevcut render'lara sorgu eklendi (bench aşağıda). Migration gerekmedi.

**Yapılan:**
- `src/lib/agentPresence.ts`: ortak pencereler (çalışıyor 3 dk = heartbeat `agent: true`, canlı 10 dk, görünürlük 60 dk) +
  tipler. `AGENT_ACTIVE_WINDOW_MS` buraya taşındı (changeVersion yeniden dışa aktarıyor), `AgentEditBadge` da aynı 10 dk'yı okuyor.
- `services/agentPresence.ts` → `loadAgentPresence`: `(app)` layout'ta `getWorkspaces()` ardından (kilitli pencerede tek
  workspace, adminde yalnız üyelikler). Tek `db.batch`'te iki SQL aggregate (bağlantı başına son çağrı, hedef başına son
  yazma); boş saat = 1 round trip. Etkinlik varsa 1 batch daha: token/OAuth adları + hedef → kenar çubuğu öğesi (satır →
  veritabanı), bulk yazma olduysa bilgi damgalarından. Audit penceresi: `min(60 dk, en kısa plan auditDays)` → her
  workspace'in `auditVisibleSince`'i içinde (plan sorgusu olmadan aynı sonuç).
- Kenar çubuğu (`AgentPresence.tsx`): ajan kartının üstünde ajan satırları (marka diski, ad, "çalışıyor" + sabit sarı
  nokta + son araç mono + hedef / "12 dk. önce"); heartbeat ajan aktif deyip listede 3 dk içi çağrı yoksa tek bağlantı
  varsayılır, birden çoksa adsız "Bir ajan çalışıyor" (tahmin yok). Ağaçta yalnız yazmalar: <10 dk sarı halkalı marka
  diski, <60 dk "12 dk.", sonra yok (animasyonsuz); kapalı ebeveyn alttaki en yeniyi taşır. Workspace satırında ajan
  çalışırken sabit sarı nokta. Tek 30 sn saat (`useServerNow`, istemci saat kaymasından bağımsız).
  `ActivityTracker` heartbeat'in mevcut `agent: true`'sunu `AGENT_EVENT` ile yayınlıyor (istek değil).
- Sayfa köken satırı (`services/pageProvenance.ts` + `PageProvenance.tsx`): `getStandalonePageByItemId` / `getPage`
  `provenance` döndürüyor (web, Tauri sekmeleri, peek). Yalnız ajanın yazdığı sayfada: "Claude Code 2 dk. önce düzenledi",
  "Sen dün düzenledin" (ayrı öğeler, en yeni önce, orta nokta yok), "Ajan yazdı, incelenmedi" + **İncele** (=
  `markPageKnowledgeReviewed`; sonraki her düzenleme canlı yenilemede düşürüyor) / "Sen inceledin". Satır sayfasının eski
  "AI ajanı tarafından düzenlendi" damgası bunun yerine geçti. Bilgi paneliyle `reviewSignal` ile senkron.
- i18n: `Workspace.presence*` (6), `Page.provenance*` (9), 8 dil. Changelog `2026-10-01-see-your-agents-at-work` (`new`).
- `npm run bench:presence` (yalnız local, kendini temizler).
- Yapılmadı (prompt: opsiyonel, ayrı karar): sayfa üst çubuğunda varlık avatarları.

**Doğrulama:** `tsc` (temiz, `.playwright-mcp/tsconfig.check.json` ile de), eslint (0 hata; 2 eski uyarı),
`test:access` 28/28, `test:agent-access` 34/34, `bench:presence` 18/18 kontrol — boş saat ~0,9 ms, yoğun saat (257 çağrı)
~3,6 ms p50, `getPageProvenance` ~0,7 ms, presence yükü ~800 B (RSC içinde). Playwright (Hakan onayıyla; Hakan'ın 3000'deki
sunucusu kapanmıştı, 3100'de ayrı dev + local.db, iş sonunda durduruldu): demo kullanıcı + yerel MCP ile gerçek
`update_page` → kart "Claude Code • çalışıyor / update_page Product Spec" 8 sn'de, ağaç işareti + workspace noktası,
nabız animasyonu yok; sayfada köken satırı, İncele → "Sen inceledin", ikinci ajan yazması açık sayfaya 4 sn'de geldi ve
incelemeyi düşürdü; satır yazması veritabanı öğesini işaretledi; satır sayfasında köken satırı; açık/koyu/390 px ekran
görüntüleri, yatay taşma yok. **Boştaki sekme maliyeti değişmedi:** oturum oturduktan sonra 125 sn = 4 ping, 0 poll,
0 RSC. (Girişten sonraki ilk dakika R5 settle penceresi — demo seed giriş anında yazıyor — bu değişiklikten bağımsız.)
Not: sessiz sekmede ajanın İLK yazması heartbeat'i bekler (≤30 sn, R5 davranışı; ajan önce okursa sekme zaten hızlıdır).

---

# R8.7 — Pazarlama sitesi (ayrı değerlendirme, en son)

> Uygulama yeni dile geçti; pazarlama sitesi `.marketing-site` altında eski palete kilitli. Burada karar verilir ve uygulanır.

```text
Remnus projesinde çalışıyorsun. AI.md kuralları geçerli. `git status --short` ile başla. Serena varsa core + conventions.
frontend-design skill'ini kullan. Playwright'tan önce Hakan'a sor.

## Ortak referans (R8)
- Seçilen yön: `.ai/R8_DESIGN_DIRECTIONS.html` → "Seçilen yön: Ortak Masa, tek renk" (Hakan: B'nin yapısı + tek renk,
  tek vurgu sarı, nabız/dalga efekti yok). Kurallar: `AGENTS.md` → UI & Design Aesthetics.
- Tokenlar `src/app/globals.css` @theme: desk/sheet/raised/float/hover/line/line-strong, fg…fg-4, ink/ink-fg, signal/
  signal-fg/signal-text/signal-soft, focus, link, overlay; `rounded-control/surface`; `shadow-lift/sheet/float/modal`;
  `text-2xs` (11) + `text-ui` (13). Yeni token eklersen `src/lib/cn.ts` tailwind-merge listesine de ekle.
- Primitifler `src/components/ui/`: Button, Dialog, DropdownMenu(+Shortcut), Select/SimpleSelect, Tooltip, Badge, Tabs,
  Card, EmptyState, Kbd, Input/Textarea, RemnusMark; `features/PageActionsMenu`, `ConfirmDialog`.
- Yasak: CSS `uppercase` etiket, orta noktayla meta birleştirme, 11 px altı yazı, "→" ekli etiket, döngüsel nabız; mavi yalnız
  veri/kullanıcı rengi. Sınıf değişikliğini codemod'la yapacaksan TypeScript parser'ıyla yalnız literal'lerde ve boşluklara
  dokunmadan (R8 dersi, conventions).
- `globals.css`: `[data-theme="remnus"] .marketing-site` eski rampayı, `.marketing-site` eski
radiusları geri yükler; açık tema pazarlama yamaları ayrıca duruyor.

## Kapsam
`src/components/marketing/*` (Landing*, next/NextLanding, MarketingShell, LandingBridgeSwitcher), `/pricing`, `/download`,
`/contact`, `/privacy`, `/security`, `/brand` (renk tablosu eski hex'leri listeliyor), `/wiki` + `/docs` (docs bileşenleri,
`.prose-doc`), OG görselleri, PWA `public/screenshots/*` ve manifest renkleri, Capacitor `android/.../colors.xml` (#1d1f23).

## Görevler
1. Önce karar (Hakan'a sor): pazarlama sitesi uygulamanın dilini mi alsın (öneri: evet — ürün ekran görüntüleri yeni arayüzü
   gösterecek) yoksa kendi editoryal dilinde mi kalsın; iki kısa taslak göster.
2. Seçime göre dondurmayı kaldır ya da daralt; mavi vurguları (hero, CTA, bağlantılar) tek vurgu kuralına taşı; ürün
   ekran görüntülerini ve PWA/OG görsellerini yeni arayüzden yeniden al.
3. `/brand` sayfasının token tablosunu yeni rollere göre yaz; e-posta şablonlarının (`src/lib/email/theme.ts`) renklerini
   değerlendir (ayrı karar).

## Doğrulama
eslint, tsc; Hakan onayıyla Playwright: tüm pazarlama sayfaları koyu + açık + 390 px; Lighthouse (performans düşmesin).

## Bitirirken
changelog (`improved`, yalnız müşteri fark ederse); AGENTS.md (landing bölümü) + Serena; update-handoff; commit yok;
"Tamamlandı" notu.
```

### ✅ R8.7 — Aşama 1 tamamlandı (2026-10-01, Claude; commit/push yok, migration yok, paket eklenmedi)

**Kararlar (Hakan):** eski hâl kötü değil ama sarı da etkin kullanılsın (mürekkep + sarı, iki renk), "AI üretimi" hissi veren
kalıplar gitsin, bölüm başına birkaç cümle, ilk bakışta ne yaptığı anlaşılsın, animasyonlu ve profesyonel — yön bana bırakıldı.
İş sırasında: yeni landing **ayrı bir URL'de** dursun; ortağıyla `/`, `/landing-next` ve yeniyi karşılaştırıp seçecek. E-posta
şablonları yeni tokenlara eşlensin.

**Yapılan:**
- **`/landing-v3`** (noindex, bağlantısız, `auth.config.ts` beyaz listesi): `components/marketing/site/` — `SiteLanding`
  (`.site` kapsamı, uygulamanın rol tokenlarını donmadan okur, 5 temayı izler). Bölümler: hero (başlık + tek cümle + tek sarı
  eylem "Demoyu dene" + `HeroStage`), 3 adım (`npx remnus init` kopyala, mini pano, mini denetim satırı), ürün sekmeleri
  (gerçek ekranlar), ajanlar için 4 gerçek, tek satır fiyat, masaüstü + telefon, kapanış, footer. **`HeroStage`** imza öğesi:
  uygulamanın HTML kopyası (masa kenar çubuğu + kâğıt üstünde kanban) ve Claude Code terminali; tek zaman çizgisi — komut
  yazılır, `create_page` ağaca sayfa ekler, `bulk_create_pages` üç kartı sarı halkayla düşürür, `update_page` birini taşır,
  halkalar söner (12,5 sn döngü; ekran dışında durur; reduced-motion'da son hâl). Sarı yalnız yapılacak eylem ve ajanın
  dokunduğu şey. Serif, büyük harfli etiket, numaralı bölüm başlığı, "→", orta nokta yok; numara yalnız gerçek sıra (adımlar).
- **Metin:** yeni `Site` namespace'i (en + tr; diğer 6 dil İngilizceye düşer — seçilirse tamamlanacak). Plan adları/fiyatları
  ve footer bağlantıları mevcut `Landing` anahtarlarından (8 dil). Araç sayısı `LandingTools.tsx`'ten dışa açılan
  `TOOLS.length`.
- **Ürün ekran görüntüleri:** yerel demo workspace'i gerçek MCP yazma araçlarıyla "Paint Clone" projesine çevrildi (mimari +
  karar sayfaları, bağlantılar/etiketler, kalibre ana pano; yalnız `local.db`), 2× çekildi → `public/marketing/app-*-{dark,light}.webp`
  (8 + 2 telefon, 41–130 KB). Tema başına biri görünür (`.site-shot-*`, lazy). Tarifler `.playwright-mcp/r87-*.cjs`.
- **Bağımsız işler (canlıyı da etkiler):** PWA ekran görüntüleri (`public/screenshots/*`) yeni arayüzden yeniden çekildi;
  `manifest.json`, `capacitor.config.ts`, Android `colors.xml` → masa `#111316`, Android accent sarı `#f0b43c`;
  e-posta paleti (`src/lib/email/theme.ts` + `layout.ts`/`templates.ts`) → masa/kâğıt/raised/çizgi, CTA mürekkep, adım çipleri
  ve alıntı çizgisi sarı, bağlantılar `#f3c566`.
- Ufak: `LandingThemeToggle` isteğe bağlı `className` alır (varsayılan görünüm aynı).

**Bilerek yapılmayanlar (seçim bekliyor):** canlı `/` (LandingBridgeSwitcher), `/landing-next` ve `MarketingShell`
sayfaları (pricing, download, contact, privacy, security, brand, wiki/docs) ve `.marketing-site` dondurması aynen duruyor —
karşılaştırma adil olsun diye. OG görseli de seçilen yöne göre yapılacak. Changelog yok (müşterinin gördüğü bir sayfa henüz
değişmedi). Terfi listesi `AGENTS.md` → Marketing → "R8.7 landing draft".

**Doğrulama:** `tsc` (`.playwright-mcp/tsconfig.check.json`) temiz; eslint (yeni + değişen dosyalar) temiz; Playwright
(playwright-core + sistem Chrome; MCP tarayıcısı başka oturumdaydı): `/landing-v3` koyu + açık 1440, 390 px, tr; `/`,
`/landing-next`, `/pricing`, `/download` 200; karşılaştırmalı ölçüm (dev sunucusu, yalnız göreli): `/` 1405 KB · LCP 1068 ms,
`/landing-next` 1419 KB · 892 ms, `/landing-v3` 1208 KB · 524 ms, üçünde CLS 0. Lighthouse makinede yok (paket kurulmadı).
E-posta: hoş geldin şablonu render edilip görsel kontrol edildi.

**Sonraki adım (Aşama 2, seçimden sonra):** seçilen landing `/`'e; diğer pazarlama sayfaları rol tokenlarına + `SiteNav`/
`SiteFooter`'a; `.marketing-site` dondurması + açık tema yamaları silinir; `/brand` token tablosu; `.prose-doc` mavi
bağlantıları; yeni OG; `Site` 6 dil; kaybeden taslak(lar) silinir (silme için Hakan onayı); changelog `improved`.

### ✅ R8.7 — Aşama 2 tamamlandı (2026-10-01, Claude; commit/push yok, migration yok, paket eklenmedi)

**Kararlar (Hakan):** yeni landing seçildi → `/`. Eski landing ve `/landing-next` **silinmeyecek**, iki adreste dursun.
Ek istek: ana sayfaya token tasarrufu için "şu kadar kazandırıyoruz" türü bir reklam bölümü.

**Yapılan:**
- `/` = `SiteLanding home="/"`; eski ana sayfa **`/landing-old`** (`LandingBridgeSwitcher`, noindex), `/landing-next` aynen;
  `/landing-v3` → `/` yönlendirmesi. Eski ikisi `.marketing-site` dondurmasında kalır (görünümleri korunsun diye CSS
  silinmedi); Fraunces artık kök layout'ta değil, yalnız bu iki sayfada (`marketing/legacyFont.ts`) — her sayfadan bir font
  yükü kalktı.
- **Tasarruf bölümü (`SiteSavings`)**: başlık "Aynı iş, %84 daha az token."; yayımlanmış, tekrarlanabilir benchmark oturumu
  (`docs/blog/agent-token-efficiency.md`, `bench:tokens`: 5.740 → 901 token) üç adım + toplam çubuklarla (Remnus çubuğu
  sarı); `SavingsCalculator`: günlük oturum kaydırıcısı + $1/$3/$15 girdi fiyatı → aylık dolar ve token (varsayılan 200
  oturum, $3 → $87/ay). Rakam yalnız ölçülen tasarruf × ziyaretçinin kendi hacmi × seçtiği fiyat; varsayım ekranda
  (AGENTS "Agent Savings Metrics" kuralına not düşüldü). Ölçüm yöntemi bağlantısı blog yazısına.
- **İç sayfalar** `MarketingShell` üzerinden `.site` + `SiteNav`/`SiteFooter`: `/pricing` (`site/SitePricingPage`: plan
  kâğıtları, önerilen planda sarı halka + sarı buton, kendin barındır satırı, `Tooltip`'li karşılaştırma tablosu; ödeme akışı
  `PricingCtaButton`'da, yalnız `className` aldı), `/download` (akıllı birincil eylem sarı, platform listesi kâğıtta, OS
  logoları maske ile temaya uyuyor), `/contact` (ui Input/Textarea/Button; GitHub bağlantısı gerçek repoya), `/privacy` +
  `/security` (`DocSections`: başlık solda, metin sağda), `/brand` (rol tokenları koyu/açık örneklerle, logo koyu+açık, iki
  yazı tipi), `/wiki` + `/docs` (kenar menü masada, yazı kâğıtta, `.prose-doc` rol tokenları + editörle aynı bağlantı stili).
  Mavi parıltılar, büyük harfli mono etiketler, "→" ve orta noktalı meta kalktı.
- **Metin:** `Site` 8 dilde tamam (+ `savings`, `pricing.included/notIncluded`); `Brand` yeni anahtarlar 8 dilde,
  `colorsSubtitle`/`typographySubtitle`/`fontMonoRole` değerleri güncellendi. Mesaj dosyaları biçimi bozulmadan metin
  olarak birleştirildi.
- **OG görseli:** `public/og-image.png` (= `OG_1200x630.png`, 2400×1260): masa üstünde başlık + gerçek pano ekranı + sarı
  "Claude updated the dashboard" rozeti.
- **Changelog** `2026-10-01-new-website-and-emails` (`improved`, 8 dil).

**Doğrulama:** `tsc` temiz; eslint (marketing, docs, `[locale]`, layout, e-posta, changelog) 0 hata (1 eski uyarı:
`share/[...slug]`); Playwright: ana sayfa tasarruf bölümü koyu/açık/390/tr, `/pricing` `/download` `/contact` `/privacy`
`/security` `/brand` `/wiki` `/docs` `/docs/agent-token-efficiency` koyu 1440, `/pricing` `/wiki/read-tools` açık,
`/pricing` `/download` `/wiki` 390; `/landing-old` + `/landing-next` 200 (eski görünüm, serif yerinde), `/landing-v3` 307 → `/`.
Lighthouse makinede yok (paket kurulmadı).

**Açık kalan / bilinen:** Kullanılmayan eski bileşenler ve `Landing` anahtarları arşiv sayfaları için duruyor (Hakan: silme).
Android/Capacitor renk değişikliği `cap sync` + yeni native build ister. Blog dizinindeki breadcrumb "Docs" der (menüde
"Blog") — önceden de böyleydi.

**Ek (aynı gün, Hakan: "bunları düzelt"):** Blog breadcrumb'ı artık "Blog" (`Docs.breadcrumbDocs` 8 dilde + `seo.ts`
JSON-LD'deki iki "Docs" adı). `npx cap sync android` çalıştırıldı: `capacitor.config.json` yeni masa rengiyle üretildi
(git-ignored), eklentiler güncel; izlenen gradle dosyalarında içerik değişmedi. **Android derlemesi bu makinede yapılamadı:**
Android SDK / Android Studio kurulu değil (yalnız JDK 8 ve 25 var); paket kurulmadı. Android uygulaması şu an hiçbir yerde
dağıtılmıyor (telefonlar `/download`'daki PWA'yı kullanıyor), yani renk yalnız APK üretildiğinde görünür.

---

# R8.9 — Şablonlar ve varsayılan içeriğin dili (R8.x'in sonu)

> R8.2/R8.3 turunda ayrı iş diye bırakıldı (Hakan, 2026-10-01: "8.x'lerin sonunda yapalım"). Arayüz 8 dilde ama
> kullanıcının oluşturduğu VERİNİN bir kısmı hâlâ İngilizce doğuyor. R8.7'den sonra, R9'dan önce.

```text
Remnus projesinde çalışıyorsun. AI.md kuralları geçerli. `git status --short` ile başla. Serena varsa core + conventions
(i18n, "UI-created data is named in the UI language" maddesi). Playwright'tan önce Hakan'a sor.

## Bağlam (2026-10-01'de kodda doğrulandı; uygulamadan önce yeniden doğrula)
- R8.2 sonrası UI'dan oluşan veri UI dilinde: yeni satır başlıksız (yerel "Başlıksız" yer tutucu), görünüm adları
  `Database.viewTable/viewBoard/viewCalendar`, yeni özellik `Database.newProperty`, tarihler `formatDateValue(…, locale)`.
  `createPage` (actions/page.ts) varsayılanı şemadan alır; stok `status` sütununda yalnız "To Do" seçeneği varsa onu yazar.
- Hâlâ İngilizce doğanlar:
  1. `src/lib/templates.ts` — 9 şablon (page-blank, page-meeting-notes, page-project-brief, dashboard-blank, db-blank,
     db-task-tracker, db-event-calendar, db-reading-list, db-agent-memory): sütun adları, seçenek değerleri ("To Do",
     "In Progress", "Done"…), görünüm adları, sayfa şablonlarının `initialContent` markdown'ı ve 4 şablonun `seedRows`'u.
     `TemplatePickerModal` adı/açıklamayı `Templates` namespace'iyle (İngilizce ada göre eşleme) çeviriyor ama onay
     adımında başlık alanına İngilizce `template.name` yazılıyor (`selectTemplate` → `setTitle(template.name)`).
  2. Varsayılan veritabanı şeması: `createWorkspaceDatabase` (actions/workspace.ts) ve MCP'nin `createDatabase`'i
     (services/workspace.ts): Title / Status (To Do, In Progress, Done) / ID.
  3. Slash ile oluşan sayfa ve veritabanı başlığı "Untitled" (editor/SlashCommandList.tsx) — kenar çubuğunda İngilizce kalır.
  4. MCP'nin ilk görünümü `seedDefaultViews` → "Table"; Notion içe aktarma görünüm adları "Table/Board/Calendar" ve
     "Untitled" yedekleri (api/import/notion/route.ts, lib/import/notion-parser.ts).
  5. Gösterimde İngilizce yedekler: pageLinkData.ts, ChildBlockExtension (varsayılan başlık), BlockEditor, paylaşılan
     sayfalar (share/*), StandalonePageEditor `document.title`, dashboards servis/aksiyon "Untitled".
  6. Demo tohum içeriği (`src/lib/seed.ts`, `createDemoSeedData`) tamamen İngilizce.
- `users` tablosunda kayıtlı dil yok: sunucu yolu yalnız istek diliyle (next-intl `getLocale`) yerelleştirebilir; MCP
  isteğinde UI dili yok.

## Görevler
1. Karar (Hakan'a sor, kısa seçenek tablosuyla): şablon içeriği 8 dile mi çevrilir (öneri: evet — şablon adı, sütun/seçenek/
   görünüm adları, seed satırları ve sayfa içerikleri yerel dosyada, kod tek yapı), yoksa yalnız yapısal adlar mı?
   Demo tohum içeriği ziyaretçi dilinde mi doğsun (öneri: değerlendir; demo herkese sıfırlanıyor)?
2. Şablon tanımlarını dilden bağımsız yapıya ayır: kimlikler (sütun `id`, seçenek grubu) sabit, görünen metinler
   `Templates.*` anahtarlarından; oluşturma anında isteğin dilinde somutlaştır. `createPage`'in stok "To Do" kuralını yerel
   şemaya göre yeniden yaz (ör. `status` sütununun `todo` grubundaki ilk seçenek). Seçenek DEĞERLERİ veridir: mevcut
   veritabanlarına dokunma, yalnız yeni oluşturulanlar etkilenir.
3. Onay adımındaki başlık alanını yerel adla doldur; slash ile oluşan sayfa/veritabanı başlığını yerel "Başlıksız" yap.
4. MCP yolları için karar: İngilizce kalsın mı (ajanın dili ayrı), yoksa çalışma alanı sahibinin son UI dili mi saklansın
   (yeni sütun = migration; maliyetini göster). Notion içe aktarma isteğin dilini kullanabilir.
5. Gösterim yedeklerini (madde 5) yerel `untitled` anahtarlarına bağla; sunucu bileşeninde `getTranslations`.

## Doğrulama
eslint, tsc, `npm run test:okf` (şablon/okf yolları), ilgili testler; Hakan onayıyla Playwright: tr ve en arayüzde her
şablondan oluşturma, slash ile sayfa/veritabanı, yeni satır, demo hesabı (karar evetse).

## Bitirirken
changelog (`improved`: şablonlar ve yeni içerik artık dilinizde…); AGENTS.md (Templates + i18n) + Serena; update-handoff;
commit yok; "Tamamlandı" notu.
```

### ✅ R8.9 — Tamamlandı (2026-10-01, Claude; commit/push yok, migration yok, paket eklenmedi)

**Kararlar (Hakan, 2026-10-01):** şablon içeriği 8 dilde (tamamı); örnek çalışma alanı (demo + her yeni kaydın ilk
alanı) ziyaretçinin dilinde; MCP varsayılanları İngilizce kalır (`users.locale` migration'ı yapılmadı); Notion içe
aktarma isteğin dilini kullanır.

**Yapılan:**
- Kelimeler kodla ayrıldı: `src/lib/starterContent/` → `types.ts` (`TemplateText`, `SampleText`, `StockDatabaseText`; eksik
  kelime = `tsc` hatası), `templates/<locale>.ts` ×8, `sample/<locale>.ts` ×8 (3 sayfa + Sprint Tahtası + 16 görev gövdesi),
  `index.ts` (`getTemplateText` / `getSampleText`, locale başına ayrı chunk, yalnız sunucuda). `messages/`'a konmadı: her
  sayfanın istemci yüküne binerdi.
- `src/lib/templates.ts` dilden bağımsız yapı oldu: `TEMPLATE_CATALOG` (picker: id, ikon, `Templates.<nameKey>`),
  `buildTemplate(id, text)`, `stockDatabaseSchema(text.stock)` (Title/Status/ID; `select` durum seçenekleri `group`
  taşıyor), `stockStatusDefault` (ilk `todo` seçeneği; grupsuz eski stok sütunlarda "To Do" korunuyor).
- Yeni server action `createFromTemplate` (`actions/templates.ts`): şablonu isteğin dilinde kurar, örnek satırları TEK
  insert'le yazar (eskiden satır başına bir `createPage` round trip'i). `TemplatePickerModal` artık yalnız katalogu biliyor
  (İngilizce ada göre eşleme kalktı; onay adımındaki yerel ad R8.5'te zaten gelmişti, doğrulandı).
- Dil kaynağı `src/i18n/requestLocale.ts` → `getRequestLocale()`: middleware başlığı → `NEXT_LOCALE` çerezi →
  `Accept-Language` → `en`. `/api/*` ve Auth.js olaylarında `getLocale()` hep `en` döndüğü için gerekli.
- Varsayılanlar: `createWorkspaceDatabase` şemasız çağrıda yerel stok şema; `createStandalonePage` /
  `createWorkspaceDatabase` boş adı `Page.untitled` ile saklayıp **saklanan adı döndürüyor** → slash `/sayfa`, `/veritabanı`
  kenar çubuğunda ve alt blokta "Başlıksız"; `createWorkspace`/`renameWorkspace` boş ad, `createDashboard` (`Dashboard.untitled`).
  `createPage` stok kuralı `stockStatusDefault`'a geçti (Görev Takipçisi'nde yeni satır artık "Bekleyen"/"Backlog" alır).
  Yeni `status` sütunu `defaultStatusOptions(Database.statusOption*)` (3 yeni anahtar ×8 dil).
- Örnek çalışma alanı: `seed.ts` yalnız yapı (`SPRINT_TASKS`), kelimeler `sample/<locale>`; `createSeedWorkspace` dili
  istekten çözer (Auth.js `createUser`), `loginAsDemo` demo kullanıcısının adını da yerel yazar. Sprint durum seçenekleri
  grup taşıyor (ev panosu "bitti"yi her dilde görür; `homeDashboard` STATUS_NAME/DONE_WORDS'e Hintçe eklendi).
  İngilizce içerikte eskimiş "Workspace Settings → Tokens" → "Workspace settings → MCP" düzeltildi.
- MCP: `createDatabaseInWorkspace` varsayılanı aynı stok tanımdan (İngilizce) geliyor, isteğe bağlı `stockText`
  (Notion içe aktarma yerel geçiriyor); `seedDefaultViews` "Table" kaldı. **`save-memory` prompt'u düzeltildi:** yerel
  "Ajan Hafızası" veritabanını 8 dildeki adıyla buluyor, sütun adlarını id'den (type/tags/date) ve Tür seçeneğini her
  dilin kelimesinden çözüyor — yoksa yerel şablonla İngilizce "Decision" yazacaktı.
- Notion içe aktarma: görünüm adları, otomatik başlık sütunu ve "Untitled" yedekleri isteğin dilinde.
- Gösterim yedekleri: `pageLinkData` (`withTitle` + iki picker), `ChildBlock` başlığı `''` + görünümde `Page.untitled`,
  `BlockEditor` alt öğe başlığı, paylaşım sayfası metadata (`Sharing.notFound`/`Page.untitled`),
  `StandalonePageEditor` `document.title`, kenar çubuğunda boş başlık yedeği. `services/dashboards` "Untitled" (MCP) bırakıldı.
- es/fr şablon adları cümle düzenine çekildi (artık öğe başlığı olarak saklanıyor; "Rastreador de Tareas" →
  "Seguimiento de tareas" vb.).
- Yeni test `npm run test:starter` (`src/scripts/test-starter-content.ts`): 8 dil × 9 şablon + örnek alan; seed değerleri
  gerçek seçenek mi, pano sütun sırası seçeneklerle aynı mı, şablon görünüm adları `Database.view*` mı, CJK'da tam genişlik
  noktalama sonrası kapanan kalın (`**连接：**`) yok mu, Agent Memory kelimeleri diller arası çakışıyor mu,
  `localeFromAcceptLanguage`.
- Changelog `2026-10-01-templates-in-your-language` (improved, 8 dil); AGENTS.md (i18n + Templates + seed + UI-language
  defaults), AI.md (i18n maddesi), Serena `core` + `conventions`.

**Doğrulama:** `tsc` (temiz), eslint (değişen dosyalarda yalnız önceden var olan 5 uyarı), `npm run test:okf` geçti,
`npm run test:starter` geçti. Playwright (Hakan onaylı, 3100 + local.db): tr demo (Demo Çalışma Alanı / Buradan Başla /
Sprint Tahtası Bekleyen-Devam ediyor-Bitti), tr'de 9 şablonun hepsi (önceden dolu yerel ad, yerel sütun/seçenek/görünüm
ve satırlar), Boş Veritabanı'nda yeni satır = "Başlıksız" + "Yapılacak", Görev Takipçisi'nde yeni satır = "Bekleyen",
slash `/Sayfa` ve `/Veritabanı` → kenar çubuğunda ve blokta "Başlıksız", alt veritabanı Başlık/Durum; en demo + 9 şablon
+ "Untitled"/"To Do"; zh demo "这个工作区是怎样搭建的" kalınları doğru. Görüntüler `.playwright-mcp/r89-*.png`. Konsolda
yalnız YouTube gömme hataları. Dev durduruldu, test demo hesapları silindi.

**Not / açık:**
- Temizlik betiği son 2 saatteki TÜM demo hesaplarını sildi: benim 3 hesabıma ek olarak local.db'deki 2 "Demo User"
  daha gitti (benden önce açılmış; demo hesapları zaten 6 saatte kendiliğinden siliniyor).
- Mevcut veritabanlarına dokunulmadı; dil değişince seçenek değerleri yeniden yazılmaz (veri). Eski İngilizce "Agent
  Memory" veritabanları İngilizce kalır.
- Şablon tarih örnekleri (Etkinlik Takvimi Mayıs–Haziran 2026, Görev Takipçisi son tarihleri) sabit ve geçmişte kaldı;
  takvim bugünün ayında boş açılıyor. Dil işi değil, ayrı küçük iş: tarihleri oluşturma gününe göre kaydırmak.
  → **Kapatıldı, aşağıya bak.**

**✅ Tarih açığı kapatıldı (2026-10-02, Claude; commit'lendi, push yok, migration yok, paket eklenmedi).** Hakan "R8.10" adıyla
istedi; dosyada R8.10 bölümü yok (R8.9 "R8.x'in sonu"), iş bu notun altına yazıldı.
- `src/lib/templates.ts`: Görev Takipçisi, Etkinlik Takvimi ve Ajan Hafızası örnek tarihleri artık sabit dizgi değil,
  oluşturma haftasının pazartesisinden gün ofseti (`weekDays(today)`; `recurrence/rule` yerel tarih yardımcıları).
  `buildTemplate(id, text, today = bugün)`. Takvim görünümü bir hafta önceden başlayan 6 haftalık kayan ızgara açtığı için
  ofsetler 0…25 → her etkinlik açılışta ızgarada; haftanın günü tutuyor ("her pazartesi" toplantısı pazartesi — eskiden
  perşembeydi, gezi cuma). Bitti görevleri geçen hafta, açık görevler bugünden sonra, inceleme bu cuma; hafıza kayıtları
  geçmiş iki haftada.
- `createFromTemplate(…, today?)`: `TemplatePickerModal` kullanıcının yerel tarihini gönderiyor (sunucu UTC'de bir gün
  kayabilir); sunucu tarihinden 2 günden fazla saparsa yok sayılıyor.
- Tarih kayınca yanlış kalacak metinler 8 dilde düzeltildi: "Frontend Summit 2026" → "Frontend Summit",
  "Q3 product review" → "Quarterly product review" (tr "Çeyrek sonu ürün değerlendirmesi" vb.).
- `npm run test:starter` 6 farklı "bugün" (pazartesi, pazar, ay/yıl sonu, artık gün, DST pazarı) için: her etkinlik açılış
  ızgarasında, toplantı pazartesi, bitti < bugün < açık, hafıza geçmişte.
- Changelog `2026-10-02-template-dates-start-this-week` (fixed, 8 dil); AGENTS.md (TemplatePickerModal + templates.ts),
  Serena `core`.
- Doğrulama: `npx tsc --noEmit` temiz, eslint (değişen dosyalar) temiz, `npm run test:starter` geçti; tr şablonu
  2026-10-02 için üretilen tarihler elle kontrol edildi (28 Eyl–23 Eki). UI değişmedi; Playwright çalıştırılmadı.
- **Sayfa şablonları da (Hakan'ın isteği, aynı gün):** Proje Özeti zaman çizelgesi `{{kickoff}}`/`{{designDone}}`/`{{beta}}`/
  `{{launch}}` işaretleriyle; `buildTemplate` pazartesiden 7/25/51/65 gün sonrasını `Intl` uzun tarihle
  (`TemplateText.locale`, 8 dosyaya yeni alan) yazıyor — 2026-10-02 için 5 Ekim → 2 Aralık 2026. Toplantı Notları'nda
  "Q3" / "temmuz sonu" → "gelecek çeyrek" / "gelecek ayın sonu" (8 dil). Test: dolmamış `{{` yok, iki sayfada sabit
  2026 yok, 2031'de oluşturulan özetin 4 tarihi 2031. Changelog kaydına Proje Özeti eklendi (id aynı, henüz yayınlanmadı).
  Şablonlarda sabit tarih kalmadı.

---

# R9 — Tüm Remnus ve Remnus MCP hızlandırma

> Önemli başlık 2a. Kapsam: büyük. Her şey bittikten sonra. Önce ölç.

```text
Remnus projesinde çalışıyorsun (Next.js 16 App Router, React 19, TS strict, Drizzle +
SQLite/Turso, Vercel, remote MCP). AI.md kuralları geçerli. AGENTS.md'yi ve Serena
core, tech_stack, conventions memory'lerini oku. Next.js davranışına dokunacaksan önce
node_modules/next/dist/docs/ altındaki ilgili rehberi oku. `git status --short` ile
başla. Playwright'tan önce Hakan'a sor.
DİKKAT: `npm run build` prod Turso'ya migration uygular — yerel build ölçümü için
yalnız `npx next build` (chunk kanıtı route-bundle-stats.json). `.env` Turso = prod;
ölçüm script'leri prod'a yazmamalı.

## Hedef

Hakan: "Her şey bittikten sonra tüm Remnus'un ve Remnus MCP'nin genel bir hızlandırma
çalışması yapılmalı." Kullanıcının hissettiği gecikmeyi düşür; maliyeti artırma.

## Faz 1 — Temel ölçüm (sayı yoksa iddia yok)

Aynı yöntemle önce/sonra ölçülebilecek bir tablo kur:
- Web: /w/<id>, /page/<id>, /db/<id>, /db/<id>/<row>, /dashboard/<id>, /graph/<id>
  için TTFB, ilk anlamlı içerik, etkileşim gecikmesi; RSC payload boyutu; rota başına JS.
- Sunucu: istek başına DB gidiş-dönüşü (layout sidebar ağacını nasıl yüklüyor?), N+1'ler,
  `EXPLAIN QUERY PLAN` ile indeks eksikleri, Turso bölge gecikmesi.
- İstemci: gereksiz yeniden render, TanStack Query önbellek kullanımı, editör/sigma gibi
  ağır parçaların tembel yüklenmesi.
- MCP: `agent_activity` süre metriklerinden tool başına p50/p95; `prepare_context`,
  `bulk_*`, arama; handler kurulum maliyeti (R2'nin bulgularıyla birleştir).
- Kabuklar: masaüstü ve mobil açılış süresi (ölçebildiğin kadar).
PostHog/Vercel verisine erişim bu oturumda yoksa bunu söyle ve Hakan'dan export iste.

## Faz 2 — Önceliklendirme

Etki × efor tablosu. En yüksek etkili 5-8 kalemi bu oturumda yap; kalanları bu dosyaya
R9.x promptları olarak yaz.

## Kısıtlar

- P1/R5'in maliyet kuralları: koşulsuz sık poll/refresh yok.
- Güvenlik kontrolleri atlanmaz (üyelik/rol her MCP isteğinde, workspace lock
  varsayılan-ret, assert*Access).
- Önbellekleme eklersen invalidation'ı canlılık mekanizmasıyla (changeVersion) tutarlı
  kur; kullanıcıya bayat veri göstermesin.

## R5/R6'dan devreden (2026-09-30)

- **Değişiklik sürümü sorgusunun Turso okuma maliyeti:** `epochMax` (`typeof` korumalı
  `max(case …)`) SQLite'ın indeksli min/max kısayolunu kullanamıyor; her poll ilgili
  workspace'lerin tüm satırlarını tarıyor (500 öğelik workspace ≈ 1k satır/poll; ajan
  çalışırken izlenen sekme saatte ~1.440 poll). Legacy TEXT `updated_at` satırlarını
  INTEGER'a çeviren bir backfill + düz `max()` (ya da `(workspace_id, updated_at)`
  indeksleri) ile ölç ve düşür. `n`/`h` alanları (R5 sonrası) korunmalı.
- Kalibrasyon log tiklemesi artık `update_page` `tick`/`append` ile ucuz (R6 sonrası);
  `bench:mcp-budget` ile tools/list'in ne kadar büyüdüğünü ölç (tick/append/position/home).

## Doğrulama

- Önce/sonra tablosu; her değişiklik için hangi ölçümü düzelttiği.
- Mevcut test script'leri (test:access, test:agent-access, test:trash-links,
  test:workspace-deletion, test:recurrence, test:code-paths, test:okf) geçer; lint + tsc.

## Bitirirken

- changelog.ts: kullanıcı fark ediyorsa tek kayıt (`improved`).
- AGENTS.md + Serena (performans gotcha'ları, yeni önbellek kuralları).
- update-handoff; commit yok; "Tamamlandı" notu.
```

---

# R10 — Güvenlik testi

> Önemli başlık 2b. Kapsam: büyük. En son. Rapor gitignored yere yazılır.

```text
Remnus projesinde çalışıyorsun (Next.js 16, Auth.js v5, Drizzle + SQLite/Turso, remote
MCP + OAuth 2.1, Tauri, Capacitor, CLI). AI.md kuralları geçerli — özellikle yetki
bölümü (getCurrentUser, workspace lock varsayılan-ret, assertWorkspaceAccess/
assertDatabaseAccess, agentAccess, proxy.ts + auth.config.ts istisnaları). AGENTS.md'yi
ve Serena core + conventions'ı oku. `git status --short` ile başla. security-review
skill'i yardımcı olabilir.

## Kurallar (ihlal etme)

- Dinamik testler YALNIZ yerel dev + local.db üzerinde, kendi oluşturduğun test
  kullanıcılarıyla. Prod'a saldırı, yük testi veya yazma YOK; üçüncü taraf servislere
  (Stripe, SES, Cloudinary, PostHog) yazma YOK.
- Repo public (AGPL). Bulgu raporu `.ai/status-reports/SECURITY_AUDIT_<tarih>.md`'ye
  yazılır (gitignored) — commit edilmez. Düzeltme commit mesajları, deploy'dan önce
  sömürü ayrıntısı vermesin.
- Secret/token değeri okuma, yazdırma; yalnız değişken adı.

## Faz 1 — Tehdit modeli

Varlıklar (workspace içeriği, token'lar, hesaplar, faturalama), aktörler (yabancı, üye
olmayan kullanıcı, viewer, eski üye, çalınmış token, kötü niyetli ajan içeriği) ve güven
sınırları (tarayıcı, server action, API route, MCP, OAuth, CLI, masaüstü deep-link,
public/share rotaları).

## Faz 2 — Alan alan inceleme + dinamik test

En az:
1. Yetki: her server action ve API route — getCurrentUser/assert*Access var mı; ID
   parametreli her yolda IDOR (başka workspace'in page/db/row/dashboard/comment id'si).
   Kilitli pencere oturumunun hesap düzeyi yollara erişememesi.
2. MCP: scope zorlaması (read token write yapamaz), workspace-pinned uç noktada 403,
   üyelik/rol her istekte, çıkarılan üyenin token'ı, audit log.
3. OAuth 2.1: PKCE, redirect_uri tam eşleşme, code tekrar kullanımı, consent (viewer
   read-only), revoke.
4. Kurulum/katılım akışları: deviceId tahmin edilebilirliği, poll'dan token sızması,
   yarış durumu; window ticket (tek kullanım, 60 sn); erişim isteği spam'i.
5. XSS: Tiptap içeriği, markdown içe aktarma, pano text bloğu, yorumlar, wiki `.md`,
   SVG/yüklemeler, ajanın yazdığı içerik (prompt injection'ın UI'a sızması).
6. CSRF (server action origin), SSRF (sunucunun kullanıcı verisiyle fetch ettiği her
   yer: içe aktarma, OG, webhooks), open redirect (login/callbackUrl, install).
7. Rate limiting: login, davet, erişim isteği, MCP, install poll.
8. İstemci paketinde secret (NEXT_PUBLIC_*), güvenlik başlıkları (CSP, frame-ancestors,
   Tauri'nin remnus.com yüklediği gerçeğiyle), cron uçları (CRON_SECRET), Stripe webhook
   imzası, admin rotaları.
9. Hesap/workspace silme sonrası artık veri ve token'lar.
10. CLI: yazdığı dosyalar (.claude/settings.json hook komutu, AGENTS.md bloğu,
    .mcp.json) — workspace adı gibi sunucudan gelen verilerle enjeksiyon; sürüm pin'i;
    credentials dosyasının izinleri.
11. Masaüstü deep-link (R1'in `remnus://open` rotası dahil) ve Capacitor.
12. Bağımlılıklar: `npm audit` (yalnız okuma; yükseltme yok, öner).

Mevcut test script'lerini (test:access, test:agent-access, test:workspace-deletion,
test:trash-links) genişletmek serbest.

## Faz 3 — Rapor ve düzeltme

- Rapor: her bulgu için şiddet (Critical/High/Medium/Low), etkilenen yol, yeniden üretim,
  önerilen düzeltme, durum.
- Critical/High: bu oturumda düzelt (küçük, testli). Büyükse Hakan'a sor.
- Medium/Low: bu dosyaya R10.x promptları olarak yaz (sömürü ayrıntısı olmadan; ayrıntı
  gitignored raporda).

## R5/R6'dan eklenen yüzeyler (2026-09-30) — mutlaka test et

- Erişim isteği rozeti: sayı yalnız sahibe (`getWorkspaces` SQL'i); üye/viewer/kilitli
  pencere 0 görmeli.
- `/api/activity/changes` + `ping`: `n` (görünür workspace sayısı), `h`, `agent` alanları —
  yalnız çağıranın kendi verisi olmalı; kilitli pencerede tek workspace.
- MCP: `create_dashboard`/`update_dashboard` `home` (başka workspace'in panosu
  sabitlenemez), `move_item` `position` (kardeş renumber yalnız aynı workspace),
  `update_page`/`bulk_update_pages` `tick`/`append` (başka workspace'in sayfası).
- `openOrCreateHomeDashboard` → `composeHomeDashboardBlocks` (kilitli pencere, üye olmayan).

## Bitirirken

- changelog.ts: müşterinin gördüğü bir davranış değişmediyse güvenlik düzeltmeleri
  changelog'a girmez (AI.md); değiştiyse kayıt davranışı anlatsın, açığı değil.
- AGENTS.md + AI.md "Critical conventions" (yeni kurallar varsa), Serena conventions.
- update-handoff; commit yok; "Tamamlandı" notu.
```

---

# R11 — Yayın: CLI publish + masaüstü (Tauri) release (SON MADDE)

> Hakan'ın kararı (2026-09-26): CLI'ı npm'e yayınlamak ve masaüstü sürümünü çıkarmak ayrı
> ayrı değil, **R1–R10 bittikten sonra tek seferde** yapılır. Önceki R adımları CLI'a veya
> `src-tauri/`'ye dokunduysa yayınlamaz; aşağıdaki "Birikenler" listesine satır ekler.

## Birikenler (her R adımı kendi satırını ekler)

| R  | CLI (`cli/`)                                                                 | Masaüstü (`src-tauri/`)                                              |
| -- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| R1 | `cli/package.json` → **0.1.11** (link etiketi, "For the agent" bloğu, `open --hook`, `open --prefer`, masaüstü tespiti, proje başına tek pencere, `issued` damgası) | `remnus://open?workspace=<id>` rotası (lib.rs `handle_open_link`, cold start, tekrar engeli) — **0.1.19** gerektirir; CLI eşiği `DESKTOP_OPEN_MIN_VERSION = '0.1.19'` (`cli/src/lib/desktop.js`) |
| R6 | `cli/templates/agents-section.md`: iki satır — "kalibrasyonu yenile" isteği → rehberin "Running it again" bölümü; izlenmeye değer yeni database/alan → ana panoya blok. Sürüm artırılmadı (0.1.11'de birleşir). Yalnız yeni `init`/`sync` ile yazılan AGENTS.md'ye girer | — |
| R6+ | — | `skills/remnus/SKILL.md` değişti (`tick`/`append`, `move_item` `position`); masaüstü `install_remnus_skill` bunu `include_str!` ile gömüyor → sonraki masaüstü sürümüne girer |

```text
Remnus projesinde çalışıyorsun. AI.md kuralları geçerli. Bu, V2 revizyonlarının son adımı:
R1–R10'un biriktirdiği CLI ve masaüstü değişikliklerini yayınlamak. Önce bu dosyadaki
"Birikenler" tablosunu ve her R bölümünün "Tamamlandı" notunu oku. `git status --short`
ile başla. Dışarıya dönük her adımı (npm publish, tag push, release) çalıştırmadan önce
Hakan'dan açık onay al; token/OTP değerini asla yazdırma.

## Ön koşullar (doğrula, eksikse dur ve raporla)

1. R1–R10 "Tamamlandı" notları var; web tarafı commit'li ve master canlıda (Vercel deploy
   success, `/api/health` 200). Masaüstü rotasının web yarısı (`DesktopOpenListener`) ve
   install ekranları web deploy'la gelir — masaüstü release'inden ÖNCE canlıda olmalı.
2. `cli/package.json` sürümü tek ve son hâlde (R2 vb. aynı sürümde birleştirdiyse tekrar
   artırma); npm'de o sürüm henüz yok (`npm view remnus versions`).
3. `node --check` tüm `cli/src/**/*.js`; `cargo check` (src-tauri) temiz.

## Sıra

1. **Masaüstü release:** `npm run release:patch` (sürümü 0.1.18 → 0.1.19 yapar, tag'i
   oluşturur) → `git push origin master --follow-tags` → GitHub Actions "Tauri Release" 4 işin
   de yeşil olduğunu ve `latest.json`'un yayınlandığını doğrula. Çıkan sürüm 0.1.19 değilse
   `DESKTOP_OPEN_MIN_VERSION`'ı ona eşitle ve CLI'ı ondan sonra yayınla.
2. **CLI publish:** `cd cli && npm publish` (Hakan'ın npm oturumu/2FA). Sonra
   `npm view remnus version` ile doğrula.
   Neden bu sıra: CLI masaüstüne yalnız ≥ eşik sürümde link gönderir, yani ters sıra da
   bozmaz; ama eşik sürümü release'ten sonra kesinleşir.

## Yayın sonrası test (canlıda, gerçek müşteri projesine dokunmadan, geçici bir dizinde)

- `npx remnus@<yeni> init` → link etiketi + "For the agent" bloğu; aynı linki ikinci kez aç
  → "Bu proje zaten bağlandı"; 5 dk sonra yeni bir linki aç → "süresi doldu".
- Yeni sohbet + "Remnus kurulumuna devam et" → ajan calibrate rehberini izliyor; kalibrasyon
  sonrası yeni oturumda hook stdout'u boş.
- Masaüstü 0.1.19 kurulu: uygulama **açıkken** ve **kapalıyken** `npx remnus open` → proje
  sekmede açılıyor; aynı workspace zaten aktifken tekrar → yeni sekme yok; giriş yapılmamışken
  → giriş sonrası açılıyor.
- Masaüstü kaldırılmış/eski: `open` iki kez → tek proje penceresi.
- `npx remnus doctor` → "yeni sürüm var" dürtüsü eski pin'li projede görünüyor.

## Bitirirken

- Birikenler tablosuna "yayınlandı: CLI x.y.z, desktop x.y.z, tarih" yaz.
- AGENTS.md / Serena'da sürüm numaraları geçen yerler (Project Install) güncel.
- `.ai/CURRENT_TASK.md`, update-handoff; bu bölümün sonuna "Tamamlandı" notu.
```
