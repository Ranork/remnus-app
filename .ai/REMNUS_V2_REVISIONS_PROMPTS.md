# Remnus V2 Revizeleri — Chat Promptları

> **Durum (2026-09-26): R1 tamamlandı (commit'lenmedi); R2–R10 başlamadı.** Her prompt bitince
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

## Bitirirken

- AI.md "Critical conventions"daki UI kuralını, AGENTS.md'yi ve Serena conventions'ı
  yeni tasarım diline göre güncelle (eski "flat/borderless" kuralı değişiyorsa sil,
  üstüne ekleme).
- changelog.ts: tek kayıt (`improved`) — yeni görünüm.
- update-handoff; commit yok; "Tamamlandı" notu.
```

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
