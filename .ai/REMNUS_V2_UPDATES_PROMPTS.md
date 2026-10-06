# Remnus V2 Güncellemeleri — Chat Promptları

> **Durum (2026-10-06):** U1–U4 tamamlandı. U3+U4 `236bf5c`/`c0a09a1` ile canlıydı; U1, U2 ve
> U1'in açık kalanları (test profili silindi, `ZOOM_INIT` kaldırıldı, fr 360 px nav) Hakan'ın
> isteğiyle aynı gün commit'lenip push'landı ve masaüstü 0.1.20 olarak yayınlandı.

Hazırlanma tarihi: 2026-10-05. Kaynak: Hakan'ın "V2 Landing Güncellemeleri" (13 madde + 1 açık
tema maddesi) ve "V2 Uygulama Güncellemeleri" (9 madde; takvimde çok günlü kart ve select
varsayılan seçeneği Hakan'ın isteğiyle listeden çıkarıldı) listeleri.

Liste **4 ayrı chat oturumuna** bölündü. Her `U#` bloğu kendi başına yeterlidir.

**Nasıl çalıştırılır:** Yeni bir chat aç ve şunu yaz (yalnızca numarayı değiştir):

```text
.ai/REMNUS_V2_UPDATES_PROMPTS.md dosyasındaki "# U1 —" başlıklı bölümü oku ve içinde
tarif edilen işi baştan sona yap. Yalnızca o bölümü, dosyanın başındaki "Ortak kurallar"
ve "Doğrulanmış bulgular" listelerini oku; diğer U bloklarını okuma, onlar başka
oturumların işi. Bölümdeki kod iddialarını uygulamadan önce koddan doğrula — dosya
2026-10-05'te yazıldı ve önceki U adımları bazılarını değiştirmiş olabilir. İş bitince
o bölümün sonuna kısa bir "Tamamlandı" notu ve gerçekte ne yaptığının özetini ekle.
```

---

## Madde → prompt eşlemesi

| Liste    | #  | Hakan'ın maddesi (özet)                                                          | Prompt |
| -------- | -- | -------------------------------------------------------------------------------- | ------ |
| Landing  | 4  | landing-next'in metin dili ve anlatımı, mevcut tasarım korunarak                  | U1     |
| Landing  | 6  | "%84 daha az token" neye karşı, belirtilsin                                       | U1     |
| Landing  | 5  | "Ajanınızla hemen başlayın" prompt kartı hero'da da olsun                         | U1     |
| Landing  | 3  | Başlıklardaki vurgu kelimelerine alt çizgi / stroke                               | U1     |
| Landing  | 1  | Hero konsolu sahnenin sağ altından taşsın (bağımsız pencere hissi)                | U1     |
| Landing  | 2  | Konsol hep Claude olmasın; Codex, Cursor… dönüşümlü                               | U1     |
| Landing  | 9  | Eski temadaki mavi parıltıların verdiği derinlik, yeni temaya uygun biçimde       | U2     |
| Açık tema| 1  | "Ajanlarının yazdığı her şey, okunabilir hâlde." bölümünün zemini beyaz           | U2     |
| Landing  | 7  | "Masaüstünde ve telefonunda." kutuları doğrudan link                              | U2     |
| Landing  | 8  | Footer'a Scout Forge badge'i                                                      | U2     |
| Landing  | 13 | Fiyat ve İndir sayfalarındaki açık kaynak bölümlerine GitHub ikonu                | U2     |
| Landing  | 10 | İndir sayfasında OS'a göre sarı indir butonu ortalı ve büyük                      | U2     |
| Landing  | 11 | İndir sayfasında butonun altına büyük masaüstü + mobil görünümler (hero gibi)     | U2     |
| Landing  | 12 | Android: Chrome "ana ekrana ekle" istemi İndir'de; masaüstünden girince QR        | U2     |
| Uygulama | 4  | Takvim/Kanban kartlarında "Show Property Labels" çalışmıyor                       | U3     |
| Uygulama | 2  | Takvim/Kanban kart rengi özelliği geri gelsin                                     | U3     |
| Uygulama | 3  | Takvim/Kanban kartlarında accent, mark'a alternatif ve açılıp kapanabilir         | U3     |
| Uygulama | 5  | Takvimde bugün çerçeve + "Bugün" badge'iyle belirgin                              | U3     |
| Uygulama | 6  | Comments / Knowledge context / Local map (+ Repeat) sayfa içi floating grup       | U4     |
| Uygulama | 1  | Dashboard, sayfalardaki gibi genişleyip daralabilsin                              | U4     |
| Uygulama | 7  | Sidebar'daki token tasarrufu bölümü küçültülebilsin ve tamamen kaldırılabilsin    | U4     |
| Uygulama | 8  | AI Agents modalında ajanı olmayan workspace'ler altta katlanır bir bölümde        | U4     |
| Uygulama | 9  | What's new badge'leri renkli                                                      | U4     |

## Sıra ve bağımlılıklar

| #  | Prompt                                    | Ne zaman / neden |
| -- | ----------------------------------------- | ---------------- |
| U3 | Uygulama — Takvim ve Kanban kartları      | **İlk.** Bir kırık ayar (madde 4) ve V2'de kaybolan iki özellik (2, 3) var; mevcut kullanıcıyı bugün etkiliyor. Küçük-orta. |
| U4 | Uygulama — Sayfa ve kabuk                 | U3'ten sonra. En büyük uygulama işi floating panel grubu (madde 6). U3 ile dosya çakışması yok, ama aynı changelog'a yazdıkları için sırayla. |
| U1 | Landing — Anlatım ve hero                 | U2'den **önce olmak zorunda**: metin ve bölüm yapısı burada oturur; U2'nin görsel katmanı ve İndir sayfasının hero görünümü bunun üstüne kurulur. |
| U2 | Landing — Görsel derinlik, İndir ve Fiyat | **Son.** U1'in son hâli üstünde arka plan derinliği ve açık tema; İndir sayfası landing hero'sunu örnek alır. |

Katı bağımlılık: **U1 → U2.** U3/U4 landing'den bağımsızdır; pazarlama öncelikliyse U1 → U2
öne alınabilir. Aynı working tree'de aynı anda tek chat çalışır (AI.md); paralel çalışmak
istenirse ayrı worktree + branch gerekir.

---

## Ortak kurallar

`AI.md` her oturumda zaten yüklü; oradaki kurallar geçerli. Ayrıca:

- `git status --short` ile başla; kullanıcının değişikliklerini ezme.
- Serena varsa `list_memories` → `core`, `conventions` (+ görevle ilgili olanlar).
- **Playwright'a geçmeden önce Hakan'a sor** (son çare).
- **`npm run build` prod Turso'ya migration uygular.** Yerel build gerekiyorsa yalnız
  `npx next build`.
- Paket kurma/yükseltme yok (gerekiyorsa gerekçesiyle Hakan'a sor ve bekle).
- Kullanıcıya görünen her metin next-intl, **8 locale**. Yeni client namespace'i veya
  public rota eklersen `npm run test:i18n-client -- --write`.
- Tasarım dili (V2 R8): rol tokenları, tek vurgu sarı `signal`, mavi yalnız veri/kullanıcı
  rengi, büyük harfli etiket / orta nokta / 11 px altı yazı / döngüsel nabız yok. Yeni UI
  `src/components/ui/` primitifleriyle. `frontend-design` skill'i görsel işlerde kullanılabilir.
- **Changelog:** uygulama işleri (U3, U4) `src/lib/changelog.ts` başına kayıt ekler. Landing
  ve İndir/Fiyat sayfası işleri (U1, U2) uygulama kullanıcısının Yenilikler panelinde
  görmeyeceği değişikliklerdir → kayıt yok.
- Commit, push, deploy, CLI publish, masaüstü release yok. Raporda listele.

---

## Doğrulanmış bulgular (2026-10-05, kodda teyit edildi)

1. **Canlı landing `src/components/marketing/site/`** (`SiteLanding`, `/`). Sıra: `SiteHero`
   (+ `HeroStage`) → `SiteSteps` → `SiteProduct` → `SiteSavings` → `SiteAgents` →
   `SitePricing` → `SiteApps` → `SiteClosing` → `SiteFooter`. Metin `Site` namespace'i (8 dil).
   `/landing-next` (`components/marketing/next/`, `LandingNext` namespace'i, **yalnız en + tr**)
   ve `/landing-old` arşivde duruyor; Hakan silinmesini istemedi.
2. **Ses farkı:** `LandingNext` "siz" diye hitap ediyor ("Ajanınıza verin"), `Site` "sen"
   ("Projeni bağla"). Hakan'ın isteği next'in metin dilini esas almak.
3. **Hero konsolu:** `HeroStage.tsx` — sahne kapsayıcısı `overflow-hidden` (~s.134), terminal
   `md:absolute md:right-5 md:bottom-5` (~s.223), terminal başlığı sabit "Claude Code" (~s.348).
   Ajan adı başka yerlerde de geçiyor: `Site.stage.label` ("Claude Code terminalde…"),
   `stage.editing` ("Claude düzenliyor"), `stage.edited`.
4. **"Ajanınızla hemen başlayın" kartı** = `next/AgentPrompt.tsx` → `QuickStartCard` (ajan
   işaretleri, tek cümle, kopyalanan prompt + kopyala butonu, 3 numaralı adım). Prompt metni
   (`AGENT_SETUP_PROMPT`) bilerek çevrilmiyor. Bileşen eski paletle yazılmış (`neutral-*`,
   `blue-*`, `uppercase` etiket); sitede rol tokenlarına çevrilmesi gerekir.
   Metinler: `LandingNext.hero.quickTitle/quickBody/step1-3/copy`.
5. **Tasarruf bölümü:** `SiteSavings.tsx` + `savingsBenchmark.ts`; başlık
   `Site.savings.title`. Kaynak benchmark `docs/blog/agent-token-efficiency.md`
   (`bench:tokens`, 5.740 → 901 token). Mevcut kıyas etiketi `savings.usual` = "Her şeyi
   okumak" — ama başlıkta neye karşı olduğu yazmıyor.
6. **`SiteApps.tsx`:** kutular `div`, içlerinde ayrı bir metin linki var (`/download` ve
   `/download#mobile-install`).
7. **Scout Forge badge'i** yalnız eski `LandingFooter.tsx`'te (~s.68–84: link
   `https://scoutforge.net/apps/remnus?ref=badge`, görsel
   `https://scoutforge.net/badge/remnus/image?theme=dark&size=default`). `SiteFooter.tsx`'te yok.
8. **Mavi parıltılar R8.7'de bilerek kaldırıldı** (tek vurgu kuralı). Yeni derinlik mavi
   olamaz; masa/kâğıt tokenları ve sarı `signal` sınırları içinde kalmalı.
9. **İndir sayfası:** `DownloadView.tsx` (258 satır). Akıllı birincil buton
   `buttonVariants({ variant: 'signal', size: 'lg' })` (~s.102–131), mobil bölüm
   `#mobile-install` (~s.177), Android satırı `pwaAndroidTitle/Body` (~s.198).
   `beforeinstallprompt` altyapısı var: `src/lib/pwa/installPrompt.ts`,
   `providers/PwaInstallCapture.tsx`, `features/PwaInstallModal.tsx`. **QR kütüphanesi yok.**
10. **Açık kaynak yerleri:** `SitePricingPage.tsx` ~s.138 (GitHub linki), `SiteAgents`
    (`f4Title` "Açık kaynak"), İndir sayfasındaki açık kaynak/Releases bölümü.
11. **Uygulama tarafı ilgili dosyalar:** `CalendarView.tsx`, `KanbanBoard.tsx`,
    `DatabaseView.tsx`, `database-sidebar/CalendarLayoutSection.tsx` +
    `KanbanLayoutSection.tsx`; sayfa altı paneller `PageEditor.tsx`,
    `StandalonePageEditor.tsx`, `KnowledgeContextPanel.tsx`, `PageCommentsPanel.tsx`;
    `dashboard/DashboardView.tsx`; `WorkspaceSidebar.tsx` (tasarruf kartı,
    `AgentSavingsCard`); `AgentsModal.tsx`; `WhatsNewModal.tsx`.

---

# U1 — Landing: anlatım ve hero

> Landing maddeleri 4, 6, 5, 3, 1, 2 (bu sırayla). Kapsam: büyük (8 dilde metin).
> U2'den önce yapılmalı.

```text
Remnus projesinde çalışıyorsun. AI.md kuralları geçerli. `git status --short` ile başla.
Serena varsa core + conventions. frontend-design skill'ini kullanabilirsin. Playwright'tan
önce Hakan'a sor. Bu dosyanın "Ortak kurallar" ve "Doğrulanmış bulgular" (1–5) bölümleri
geçerli.

## Kapsam
Canlı landing: src/components/marketing/site/ ve messages/*.json → "Site". /landing-next
ve /landing-old'a dokunma (arşiv; silinmeyecek).

## Görev A — Anlatım (madde 4)
Hakan: "Landing next içindeki anlatımı yeni landing tasarımını koruyarak uygulayalım. Hero
animasyonu vs. tasarımsal şeyler mevcut landingteki kalsın, next'tekileri taşıma; burada
bahsettiğimiz şey metin dili ve anlatım."
- Kaynak: `LandingNext` (tr + en) ve `next/*` bileşenlerinin hikâyesi: anlama borcu
  (comprehension debt) sorunu, "ajanlar geliştirir, Remnus işlerini okunabilir sayfalara ve
  panolara çevirir, hakimiyet sizde kalır", proje haritası, son söz insanda, güven, SSS.
- Hedef: `Site` metinleri bu dil ve hikâyeyle yeniden yazılır; bileşen, görsel, animasyon
  ve sahne aynen kalır. Bir mesajın yeni bir bölüm gerektirdiğini düşünüyorsan (ör. sorun
  bölümü, SSS) önce Hakan'a kısa bir öneri göster, onay almadan yeni bölüm ekleme.
- Hitap: next "siz" diyor, site "sen" (bulgu 2). Next'in dili esas alınacak; başlamadan
  Hakan'a tek cümleyle teyit ettir.
- Sıra: önce tr + en'i yaz, Hakan'a göster; onaydan sonra diğer 6 dil.

## Görev B — Tasarruf neye karşı (madde 6)
"Aynı iş, %84 daha az token." başlığı/lede'si neye karşı olduğunu söylesin: benchmark'ın
kıyas tarafını `docs/blog/agent-token-efficiency.md`'den doğrula (ör. ajanın repodaki .md
dosyalarını / tüm çalışma alanını okuması) ve bunu müşteri dilinde yaz. Rakam ve yöntem
değişmez; yalnız kıyas açık olur. `savings.usual` etiketi de aynı kıyasla tutarlı olsun.

## Görev C — Hero'da prompt kartı (madde 5)
Next'teki "Ajanınızla hemen başlayın" kartı (`QuickStartCard`, bulgu 4) SiteHero'da da
olsun. Bileşeni site için rol tokenlarıyla yeniden kur (eski palet, uppercase ve mavi yok;
kopyala butonu mevcut site kopyala düğmesiyle tutarlı). Prompt metni çevrilmez. Hero
yerleşimi bozulmasın (başlık + lede + eylemler + sahne); 390 px'de tek sütun.
`SiteSteps`'teki `npx remnus init` adımıyla çelişmesin; gerekirse adım metnini uyumla.

## Görev D — Başlık vurgusu (madde 3)
Hakan: "Başlıklardaki vurgulanacak kelime gruplarına altı çizgili veya stroke'lu gibi
şeyler yapılabilir, tek düzeliği giderir." Görev A'nın yeni başlıkları üzerinde yap.
- Vurgu metinde işaretlensin (ör. next-intl rich text `<em>…</em>` etiketi), bileşen
  `SectionHead` / `PageHead` / `SiteHero` başlığında render etsin; 8 dilde aynı anlam
  grubuna işaret konur.
- Tek vurgu kuralı: sarı `signal` alt çizgi (el çizimi / kalın offset underline) ya da
  outline stroke; ikisini kod içinde dene, Hakan'a iki ekran göster, birini seç. Her
  başlıkta en fazla bir vurgu grubu.

## Görev E — Hero konsolu (madde 1 + 2)
1. Taşma: konsol sahnenin sağ altından dışarı taşsın, ayrı bir pencere gibi dursun
   (bulgu 3: sahne `overflow-hidden`; terminal sahnenin içinde konumlu). Sahnenin kendi
   içeriği kırpılmaya devam etsin, yalnız terminal taşsın. Mobilde (md altı) taşma yok,
   mevcut yığılma kalsın. Yatay sayfa kaydırması oluşmamalı.
2. Dönüşümlü ajan: her 12,5 sn'lik döngüde (ya da birkaç döngüde bir) ajan değişsin:
   Claude Code → Codex → Cursor (Hakan farklı liste vermezse). Terminal başlığı, işaretler,
   "X düzenliyor / X az önce düzenledi" çipleri ve `stage.label` aynı ajana uyar. Ajan adı
   çevrilmez; cümleler `{agent}` parametresiyle. Ajan logoları için `site/` ve `next/`'teki
   mevcut işaretleri kullan, yeni dış görsel ekleme. reduced-motion'da tek ajan, son hâl.

## Doğrulama
eslint (değişen dosyalar), tsc; Hakan onayıyla Playwright: `/` koyu + açık 1440 ve 390 px,
tr + en; hero döngüsü en az iki ajan değişimi; yatay taşma yok; `/landing-next` hâlâ 200.

## Bitirirken
Changelog yok (pazarlama sayfası). AGENTS.md → Marketing bölümünü (hero ajan dönüşümü,
vurgu işaretleme kuralı, hitap) güncelle + Serena `conventions` gerekirse; update-handoff;
commit yok; "Tamamlandı" notu.
```

### ✅ U1 Tamamlandı (2026-10-06, commit'siz, migration yok, paket yok)

Hakan'ın kararları: hitap **siz** (de Sie, fr vous, ru вы, hi आप; es tú, zh 你 kaldı); iki yeni
bölüm onaylandı (Sorun + SSS); vurgu stili **sarı alt çizgi** (outline stroke denendi, seçilmedi);
tr + en metni onaylandıktan sonra diğer 6 dil yazıldı.

- **A — Anlatım:** `Site` metinleri (8 dil) /landing-next'in hikâyesiyle yeniden yazıldı: anlama
  borcu → ajanların işi okunabilir sayfa ve panolara → son söz sizde. Yeni `SiteProblem` (hero'dan
  sonra; kaynaklı %52, diff / sohbet / Remnus sütunları, Remnus sütunu signal çizgili) ve `SiteFaq`
  (Uygulamalar'dan sonra; 6 soru, `<details>`). Bileşen, görsel ve animasyonlar aynı; adımlar
  "Ajanınıza verin / Ajanınız size anlatsın / Son söz sizde" oldu.
- **B — Tasarruf:** başlık kıyası söylüyor ("Aynı iş, her şeyi okuyan bir ajana göre %84 daha az
  token."), lede iki ölçümü anlatıyor, `savings.usual` = "Her şeyi tam okumak". Kıyas tarafı
  blog yazısından doğrulandı: her sayfa gövdesi + panonun tüm sütunları/satır gövdeleri + tam
  sayfa ↔ özet, `fields` projeksiyonu, outline. Rakam ve yöntem değişmedi.
- **C — Prompt kartı:** `site/HeroPrompt.tsx` (rol tokenları; `next/AgentPrompt`'taki çevrilmeyen
  prompt; `CopyCommand`'dan ayrılan ortak `CopyButton`) hero'da eylemlerin altında, sahnenin
  üstünde; 390'da tek sütun. `steps.s1Body` artık "yukarıdaki prompt'u yapıştırın; bu komutu o
  çalıştırır" diyor, `npx remnus init` görseli kaldı.
- **D — Vurgu:** mesajda `<em>…</em>` (başlık başına en fazla bir grup, 8 dilde aynı anlam grubu;
  build script'i sayıları en ile karşılaştırdı), `site/emphasis.tsx` → `t.rich(key, { em })`,
  `.site-em` (globals.css). `SectionHead`/`PageHead` başlığı artık `ReactNode`.
- **E — Konsol:** terminal md+'da sahnenin sağ altından taşıyor (figure'a göre konumlu; sahne ve
  kâğıt konumlu değil, `overflow-hidden` yalnız panoyu kırpıyor), md altında eski yığılma.
  Ajan her döngüde değişiyor (Claude Code → Codex → Cursor): başlık, işaretler, çipler ve
  `stage.label` `{agent}` ile; reduced-motion'da tek ajan. Yan düzeltme: sahnedeki ajan işaretleri
  siyah çiziliyordu (AIMark `fill` yok) → figure'a `.site-marks`.
- **Ek:** telefonda yatay taşma — `SiteSteps` ızgarası `grid-cols-1` (uzun de/ru mini satırları
  sütunu genişletiyordu), `SiteNav`'da sözcük markası sm altında yalnız ekran okuyucuda.
- **Ek (Hakan'ın oturum içi isteği) — masaüstü zoom:** Ayarlar → Masaüstü yakınlaştırması
  `transform: scale()` ile yapılıyordu; harita tıklamaları ve yüzen butonlar kayıyordu. Artık
  WebView'un kendi zoom'u (`getCurrentWebview().setZoom()`, yetki zaten vardı); `useZoom` ve
  5 bileşendeki bölme kaldırıldı; eski anahtar `remnus_desktop_zoom` → `remnus_desktop_zoom_native`
  (0.1.19'un init script'i böylece etkisiz). Changelog `2026-10-06-desktop-zoom-stays-aligned`
  (8 dil). Web deploy'uyla gelir, masaüstü sürümü gerekmez; `src-tauri/src/lib.rs` `ZOOM_INIT`
  bir sonraki masaüstü sürümünde silinebilir.

**Açık kalanlar kapatıldı (2026-10-06, U2'den sonra, Hakan'ın isteğiyle):** `com.remnus.bench`
test profili silindi; `src-tauri/src/lib.rs` `ZOOM_INIT` kaldırıldı (`cargo check` geçti, 0.1.20'de);
fr 360 px nav taşması nav aralıkları ve CTA dolgusu telefonda daraltılarak giderildi (8 dil × 360/390
taşma yok).

Doğrulama: `tsc` (check config) temiz, eslint 0 hata (1 eski uyarı), `test:i18n-client` ok.
Playwright (Hakan onaylı, playwright-core + sistem Chrome, dev :3100): `/` koyu + açık 1440 ve
390, tr + en (+ 6 dilde örnekler); ajan dönüşümü Codex ve Cursor'a kadar görüldü; 8 dilde 390,
820, 1240 ve 1440'ta yatay taşma yok (fr 360 px'te nav'da 12 px taşma kaldı, eskiden beri);
`/landing-next`, `/landing-old`, `/pricing`, `/download` 200. Masaüstü: debug Tauri
(`com.remnus.bench` profili) + :3000 proxy, %150 zoom: eski anahtar taşındı, devicePixelRatio
1,5 → 2,25, haritada imleç altındaki düğüm tıklamayla seçildi (kapsayıcı ölçeklenmiyor),
yüzen grup köşede (sağ 16, alt 72 + çerez şeridi), sıfırlama %100'e döndü. Test demo
kullanıcıları id ile silindi; dev ve proxy durduruldu. Ekranlar `.playwright-mcp/u1/`.

---

# U2 — Landing: görsel derinlik, İndir ve Fiyat sayfaları

> Landing maddeleri 9, açık tema 1, 7, 8, 13, 10, 11, 12. Kapsam: orta-büyük. **U1'den sonra.**

```text
Remnus projesinde çalışıyorsun. AI.md kuralları geçerli. `git status --short` ile başla.
Serena varsa core + conventions. frontend-design skill'ini kullanabilirsin. Playwright'tan
önce Hakan'a sor. Bu dosyanın "Ortak kurallar" ve "Doğrulanmış bulgular" (1, 6–10)
bölümleri geçerli. U1 tamamlandı; landing metni ve hero'su son hâlinde.

## Görev A — Arka planda derinlik (landing madde 9)
Hakan: "Eski temada mavi parıltılarla arka planda derinlik hissi yaratmıştık. Bunu yeni
temada da, temamıza uygun olarak istiyoruz. Arka plan çok tek düze."
- Mavi yok (bulgu 8). Seçenekler: masa tonunda çok hafif radyal ışık/gölge alanları,
  ince doku/grain, bölümler arası ton geçişi, kâğıtların altında yumuşak ışık; sarı yalnız
  çok seyrek ve düşük opaklıkta. Tüm temalarda (koyu, açık ve diğerleri) çalışsın.
- İki yön dene, Hakan'a ekran göster, birini uygula. Animasyon gerekiyorsa döngüsel nabız
  yasak; statik ya da kaydırmaya bağlı. Performans: büyük blur katmanı LCP/CLS'i bozmasın.
- Kapsam `.site` (landing + iç pazarlama sayfaları).

## Görev B — Açık tema: ürün bölümü zemini (açık tema madde 1)
"Ajanlarının yazdığı her şey, okunabilir hâlde." (`SiteProduct`) bölümünün zemini açık
temada, sayfanın gerisinden bağımsız olarak beyaz olsun; ürün ekran görüntülerindeki gri
ile kontrast için. Koyu temaya dokunma.

## Görev C — Küçük site düzeltmeleri (madde 7, 8, 13)
- 7: "Masaüstünde ve telefonunda." kutularının tamamı link olsun (bulgu 6); içteki ayrı
  link kalkar ya da görsel etikete döner; odak halkası ve hover kâğıdın tamamında.
- 8: `SiteFooter`'a Scout Forge badge'i (bulgu 7'deki link ve görsel; `theme` açık/koyu
  temaya göre seçilsin, ölçü eskisiyle aynı, `loading="lazy"`). Dış görsel CSP'ye takılırsa
  `next.config.ts` başlıklarını kontrol et.
- 13: Fiyat ve İndir sayfalarındaki açık kaynak bölümlerine GitHub ikonu (bulgu 10). Projede
  hazır GitHub işareti varsa onu kullan (lucide'in marka ikonları kaldırıldıysa yerel SVG).

## Görev D — İndir sayfası hero'su (madde 10 + 11)
- 10: OS'a göre sarı birincil indir butonu ortalı ve büyük (bulgu 9).
- 11: Butonun altında, landing hero'su gibi büyük bir sahne: masaüstü uygulama ekranı ve
  önünde/yanında telefon görünümü (mevcut `public/marketing/app-*-{dark,light}.webp`
  görüntüleri; tema başına biri `.site-shot-*`). Platform listesi bunun altında kalır.
  390 px'de taşma yok.

## Görev E — Android "ana ekrana ekle" + QR (madde 12)
Hakan: "Android'ler için Chrome'dan direkt ana sayfaya ekle bildirimi gönderilebiliyor; onu
İndir sayfasına koyup masaüstünden girilince Android kısmında QR kod konabilir."
- Android Chrome'da: Android bölümünde "Ana ekrana ekle" butonu, mevcut
  `beforeinstallprompt` altyapısıyla (`installPrompt.ts`) yerel istemi açsın; istem yoksa
  (zaten kurulu / desteklenmiyor) mevcut elle tarif kalsın.
- Masaüstünden girildiğinde: Android bölümünde `/download#mobile-install` adresine giden bir
  QR kod ve "telefonunla tara" cümlesi.
- **Karar 0:** projede QR kütüphanesi yok. Kod yazmadan önce Hakan'a sor: (a) küçük bir
  bağımlılık (ör. `qrcode`) kurmak mı, (b) sabit adres olduğu için QR'ı bir kez üretip
  `public/` altına SVG olarak koymak mı (öneri: b — bağımlılık yok, adres değişmez; tema
  için iki renk). Cevabı bekle.

## Doğrulama
eslint, tsc; Hakan onayıyla Playwright: `/`, `/pricing`, `/download` koyu + açık, 1440 ve
390 px; Android UA emülasyonuyla `/download`; QR'ın telefonla okunduğunu Hakan'dan iste.

## Bitirirken
Changelog yok (pazarlama sayfası). AGENTS.md → Marketing (arka plan derinliği, İndir hero,
QR) + gerekirse Serena; update-handoff; commit yok; "Tamamlandı" notu.
```

### ✅ U2 Tamamlandı (2026-10-06, migration yok, paket yok)

Hakan'ın kararları: derinlik = **iki yön birlikte** (ışık alanları + gren, bantsız); QR =
"hangisi mantıklıysa" → statik SVG (bağımlılık yok); QR'ı telefonla okuttu, açıldı.

- **A — Derinlik:** `globals.css` `.site`: üstte kâğıt tonunda lamba ışığı, `main > section::before`
  ile solda/sağda sırayla yumuşak ışık alanları (bölümden 10rem taşar, ek yeri yok), hero sahnesi
  ve İndir sahnesinin altında çok hafif signal sıcaklığı (`.site-stage-glow`), sabit SVG gren
  (`.site::after`). Hepsi z-index -1, `.site` yığın bağlamında (kâğıtların, görsellerin, yazının
  altında); yalnız gradyan + küçük data-URI karo, animasyon/blur/mavi yok, tüm temalarda.
- **B — Açık tema ürün bölümü** beyaz bant (`.site-product`), koyu tema aynı.
- **C — Küçük düzeltmeler:** Uygulamalar kutularının tamamı link (CTA ok'lu etiket, hover gölge,
  global odak halkası); footer'da Scout Forge rozeti tema başına (koyu/açık SVG, lazy); GitHub işareti
  `ui/github-mark.tsx` → /pricing self-host butonu, landing fiyat linki, İndir "tüm sürümler" linki
  (`ProviderButtons` da aynı işareti kullanıyor).
- **D — İndir hero'su:** ortalı `PageHead` (`align="center"`), OS'a göre büyük sarı buton (algılama
  sırasında satır yüksekliği sabit), altında `DownloadStage` (masaüstü pano görüntüsü + önünde
  telefon, tema başına), platform listesi altta; 390'da taşma yok.
- **E — Android + QR:** Android Chrome'da Android satırında "Ana ekrana ekle" (`installPrompt`'un
  yerel istemi); istem yoksa yazılı adımlar. Masaüstünde telefon bölümünde QR
  (`public/marketing/qr-mobile-install.svg`, `https://remnus.com/download#mobile-install`, v5, H
  düzeltme, ortada Remnus işareti, her temada koyu-üstü-beyaz). Telefon bölümündeki genel "kur"
  butonu kalktı (masaüstü Chrome'da da çıkıyordu); mobilde hero butonu duruyor.
- **Metin:** `Download` 8 dilde 6 yeni anahtar; tr ve de İndir sayfasına özgü metinler siz/Sie oldu
  (uygulamanın kurulum modalı ve dürtmesindeki ortak anahtarlara dokunulmadı).

Doğrulama: tsc temiz, eslint 0 hata, test:i18n-client ok; Playwright: `/`, `/download`, `/pricing`,
`/wiki` koyu + açık, 1440 ve 390 (yatay taşma yok); Android UA + taklit `beforeinstallprompt` →
buton çıktı ve yerel istem açıldı, QR gizli; QR'ı Hakan telefonla okuttu. Not: dev'de `globals.css`
düzenlemesi iki kez bayat kaldı, `.next/dev` kenara alınıp yeniden başlatılarak çözüldü.

---

# U3 — Uygulama: Takvim ve Kanban kartları

> Uygulama maddeleri 4, 2, 3, 5. Kapsam: orta. Bağımlılığı yok; **önerilen ilk iş.**

```text
Remnus projesinde çalışıyorsun. AI.md kuralları geçerli. `git status --short` ile başla.
Serena varsa core + conventions. Playwright'tan önce Hakan'a sor. Bu dosyanın "Ortak
kurallar" ve "Doğrulanmış bulgular" (11) bölümleri geçerli.

## Bağlam
Takvim ve Kanban kartlarının ayarları database görünüm kenar çubuğunda
(`database-sidebar/CalendarLayoutSection.tsx`, `KanbanLayoutSection.tsx`); kartlar
`CalendarView.tsx` ve `KanbanBoard.tsx`'te çizilir, ayarlar `DatabaseView.tsx` üzerinden
akar. Maddeler 2 ve 3 "geri gelsin" diyor: V2 yeniden tasarımında (R8 / R8.x) kaybolmuş
olmalılar. Önce `git log -S` ile eski hâli bul (kart rengi, accent, mark ayarları ve
render'ları) ve neyin neden kalktığını raporla; geri getirirken V2 tasarım dilini koru.

## Görev A — "Show Property Labels" çalışmıyor (madde 4)
Ayar açılıp kapatılınca kartlarda özellik etiketlerinin görünmesi/gizlenmesi gerekiyor.
Ayarın kaydedildiği yerden kartın render'ına kadar zinciri izle, kök nedeni bul, iki
görünümde de düzelt. Kök nedeni raporda yaz.

## Görev B — Kart rengi geri gelsin (madde 2)
Kartın rengi (eski davranış: satırın seçili bir özelliğine / kart rengine göre zemin veya
şerit) Takvim ve Kanban'da yeniden ayarlanabilsin. Eski ayar verisi DB'de duruyorsa onu
oku; yeni kolon gerekmesin (property config JSON'u). Renkler V2 paletinden; mavi yalnız
veri/kullanıcı rengi kuralı burada "kullanıcı rengi" sayılır.

## Görev C — Accent, mark'a alternatif (madde 3)
Hakan: "Takvim ve Kanban kartları için accent özelliği mark'a alternatif olarak açılabilir
şekilde geri gelsin." Şu anki "mark" göstergesini koddan doğrula; ayarlarda mark ↔ accent
seçimi (ya da accent aç/kapa) olsun, varsayılan bugünkü görünüm (mark) kalsın. Seçim
`SegmentedControl` / `RadioCards` gibi mevcut primitiflerle.

## Görev D — Takvimde bugün belirgin (madde 5)
Bugünün hücresi çerçeve (sarı `signal` halka/kenarlık) ve "Bugün" badge'iyle belirgin
olsun; ay, hafta ve gün görünümlerinin hepsinde. Badge metni next-intl, 8 dil; tarih
locale'i hardcode edilmez. Seçili/odaklı hücre durumuyla karışmasın.

## Doğrulama
eslint (değişen dosyalar), tsc, `npm run test:recurrence` (takvim render'ına
dokunduysan); Hakan onayıyla Playwright: demo workspace'te bir takvim ve bir kanban,
koyu + açık, ayarları aç/kapa, sayfa yenileyince ayarın kalıcı olduğu.

## Bitirirken
Changelog: tek kayıt ya da iki (`fixed`: özellik etiketleri; `improved`: kart rengi +
accent + bugün), 8 dil, müşteri dili. AGENTS.md (database görünümleri bölümü) + Serena
gerekirse; update-handoff; commit yok; "Tamamlandı" notu.
```

### ✅ U3 — Tamamlandı (2026-10-05, Claude; commit/push yok, migration yok, paket eklenmedi)

**Kök nedenler:** Kart rengi ve accent V2 R8.2'de (`2221158`) bilerek kaldırılmıştı (`getCardBgColor`,
`getCardBorderAccents`, kenar çubuğundaki "Kart renkleri" bölümü). R8.2 `cardBgCol`'u işaretin yedeği olarak
okuyor, `cardBorderSide`'ı yok sayıyordu. "Show property labels" ayarı kaydediliyordu ama kart, etiketi yalnız
`showPropertyLabels && !isSelfDescribingType(type)` olunca çiziyordu. Bu yüzden select, status, kişi, url ve
e-posta değerlerinde ayar hiçbir şey değiştirmiyordu ve kartların çoğu bu türlerden oluşuyor.

**Yapılan:**
- **Etiketler (madde 4):** filtre kaldırıldı (`isSelfDescribingType` silindi). Ayar açıkken her değerin önünde ad
  var, kapalıyken hiçbirinde yok. Varsayılan "açık" (tipteki belgeli varsayılan). Kanban, takvim ve pano gömmesi
  (`DashboardDatabaseEmbed` artık `showPropertyLabels` da geçiriyor) aynı davranıyor.
- **Kart rengi (madde 2):** `cardBgCol` yeniden kartı boyuyor. İlk sürüm hap renginin %13'lük karışımıydı;
  Hakan görünce "güzel dursun" dedi, çünkü sarı haki/zeytin, kırmızı kahve-bordo bir lekeye dönüyordu. Son hâl:
  renk başına elle seçilmiş `wash` + `edge` (`CARD_TINTS`, `lib/types/properties.ts`). Açık temada temiz
  pasteller (`--card-<renk>-wash/-edge`, `globals.css` catppuccin bloğu), koyu temalarda parlak tonun düşük
  opaklığı. Üstten aşağı hafifçe sönen gradient (`--card-wash-fade`: açık %72, koyu %30) ve kartın kenar
  çizgisi aynı tonda (`--card-edge` / hover `--card-edge-strong`). `cardBgCol` artık işaret yedeği değil.
- **Accent (madde 3):** yeni `cardMarkStyle: 'mark' | 'accent'` (varsayılan `mark` = bugünkü görünüm).
  `accent`'te işaret, kartın seçilen kenarının biraz içinde yuvarlak uçlu bir çubuk oluyor (`CardAccent`,
  kanbanda `md` 3 px, takvimde `sm` 2,5 px; multi-select'te her değer için bir parça). Takvimde çubuğun
  olduğu tarafa ek iç boşluk veriliyor (`ACCENT_ROOM`). Kenar `cardBorderSide` (sol/üst/sağ/alt).
- **Tek arayüz:** `CardAppearance` + `getCardAppearance` / `applyCardAppearance` / `DEFAULT_CARD_APPEARANCE`
  (`lib/types/views.ts`). Kenar çubuğunda ortak `database-sidebar/CardAppearanceControls.tsx`: "Kartları
  işaretle" select'i → görünüm `SegmentedControl` (Rozet/Nokta ↔ Vurgu çizgisi) → accent'te konum
  (ok ikonlu 4'lü segment) → "Kart arka planı" select'i. Her birinin altında açıklama var.
- **Bugün (madde 5):** gün numarası sinyal dolgulu kaldı. Yanına `signal-soft` zeminli "Bugün" rozeti, hücreye
  2 px sinyal çerçeve ve hafif `signal-soft` zemin eklendi. Rozet yalnız `xl` ve üstünde görünüyor; telefonda
  dar hücrede "Bu…" diye kesiliyordu. Container query denendi ama hücreye containment eklediği için bırakıldı:
  `IconPicker` portal'sız ve `position: fixed`, containment onu hücreye göre konumlardı. Ay ve hafta görünümü
  aynı kodu kullanıyor; `aria-current="date"` korundu.
- **i18n:** 9 yeni `Database` anahtarı, 8 dilde (`cardMarkStyle`, `cardMarkStyleBadge`, `cardMarkStyleDot`,
  `cardMarkAccentHint`, `accentLeft/Top/Right/Bottom`, `cardBackgroundHint`). Eski `accentLine`,
  `accentPosition`, `cardBackground` anahtarları yeniden kullanıldı.
- **Changelog:** `2026-10-05-card-colors-and-today` (`improved`) + `2026-10-05-card-property-labels` (`fixed`).
- **Doküman:** AGENTS.md (Database views, `views.ts`, `PropertyTags`, `KanbanBoard`, `CalendarView`) + Serena
  `conventions`.

**Bilerek yapılanlar / etkiler:**
- Ayara hiç dokunulmamış kanban ve takvimler (varsayılan açık) artık chip'lerin önünde de etiket gösterir; bu,
  R8.2 öncesi davranışa dönüş.
- Yalnız `cardBgCol`'u olan eski görünümler (R8.2'de bunu işaret olarak gösteriyordu) artık işaret yerine renkli
  kart gösterir; bu da R8.2 öncesi görünüme dönüş. Notion içe aktarımı zaten ikisini birden yazıyor.
- Eski kapalı kartta ikonlu kalın accent şeridi geri getirilmedi; düz çizgi yeterli görüldü.

**Doğrulama:** `npx tsc --noEmit -p .playwright-mcp/tsconfig.check.json` temiz. Düz `tsc` yalnız bayat
`.next/types/validator.ts` (`/app/route.js`, `8f8ea3c` öncesi build) için hata veriyor, kodla ilgisi yok.
eslint (değişen 12 dosya): 0 hata, 2 eski uyarı (`DatabaseView` `pathname`, `PropertyTags` `<img>`).
`npm run test:recurrence` 26/26, `npm run test:i18n-client` ok.

**Görsel kontrol (Playwright, Hakan onayıyla, 2026-10-05):** yerel dev `:3100` + `local.db`, demo girişi.
Kontrol edilenler:
- Kanban: varsayılan etiketler, etiket kapalı, rozet → vurgu çizgisi (sol ve üst), Öncelik'e göre kart rengi;
  yenilemeden sonra kalıcı.
- Takvim: test için demo veritabanına geçici "Teslim" tarih özelliği eklendi. Nokta → çizgi, Kategori'ye göre
  renk, bugün çerçevesi ve rozeti.
- Temalar: catppuccin (açık), remnus, nord, dracula. Genişlik: 1440 ve 390 px, yatay taşma 0.

Konsolda yalnız bilinen üçüncü taraf gürültüsü (YouTube/doubleclick) ve önceden var olan Next
`scroll-behavior` uyarısı var. Ekranlar `.playwright-mcp/u3/` altında (gitignored). Demo kullanıcısı id ile
silindi (`.playwright-mcp/u3/cleanup.ts`, 1 workspace); dev sunucusu ve yetim süreç ağacı durduruldu.

---

# U4 — Uygulama: sayfa ve kabuk

> Uygulama maddeleri 6, 1, 7, 8, 9. Kapsam: büyük (madde 6). U3'ten sonra.

```text
Remnus projesinde çalışıyorsun. AI.md kuralları geçerli. `git status --short` ile başla.
Serena varsa core + conventions. Next.js davranışı değişirse önce node_modules/next/dist/docs
altındaki ilgili rehberi oku. Playwright'tan önce Hakan'a sor. Bu dosyanın "Ortak kurallar"
ve "Doğrulanmış bulgular" (11) bölümleri geçerli. AI.md performans kuralı: tıkla-aç UI'yı
ilk yüke statik import etme (`src/lib/lazyComponent.tsx`); mount'ta yeni okuma action'ı
ekleme, `getPagePanels`'i genişlet.

## Görev A — Sayfa içi floating panel grubu (madde 6)
Hakan: "Sayfanın en altında olan comments, knowledge context, local map özellikleri sayfa
altında görünmeyebiliyor. Onları sayfa içi floating bir buton grubu yapıp içeriklerini de
o float'tan çıkan parça gibi yapabiliriz. Center peek ve side peek'lerde modalın dışında
durabilir bu floating grup. Repeat bilgisi vs. de bu grubun içine 4. buton olarak
eklenebilir."
- Bugün: bu paneller `PageEditor.tsx` / `StandalonePageEditor.tsx` içinde sayfanın
  altında (`PageCommentsPanel`, `KnowledgeContextPanel`, yerel harita). Repeat bilgisi
  tekrarlayan takvim satırlarında (`features/recurrence/`) — yerini koddan bul.
- Hedef: sayfanın sağ alt köşesinde dikey bir buton grubu (Yorumlar, Bilgi bağlamı,
  Yerel harita, Tekrar — yalnız ilgili sayfa türünde görünen butonlar); biri tıklanınca
  içeriği gruba bağlı bir panel olarak açılır (aynı anda tek panel; Esc ve dışarı tıklama
  kapatır). Yorum sayısı gibi sayaçlar butonda küçük rozet.
- Center peek ve side peek'te grup modalın/peek'in **dışında**, kenarına yapışık durur.
- Mobilde: grup alt köşede, panel alttan açılan `Sheet`.
- Panellerin içerik bileşenleri ve veri akışı aynı kalır; yalnız yer değişir. Panel
  içerikleri lazy yüklensin.
- Önce yerleşim taslağını (ASCII ya da tek ekran) Hakan'a göster, onaydan sonra uygula.

## Görev B — Dashboard genişlik (madde 1)
Hakan: "Dashboard sayfalardaki gibi genişleyip daralabilsin." Sayfalardaki genişlik
(tam genişlik) ayarını ve nerede saklandığını koddan bul; dashboard'a aynı kontrolü ve
aynı saklama biçimini getir (`dashboard/DashboardView.tsx`, `DashboardHeader.tsx`).
Yeni DB kolonu gerekiyorsa `ALTER TABLE ADD COLUMN` + apply script deseni, prod'a uygulama
Hakan'da.

## Görev C — Tasarruf kartı küçülsün / kalksın (madde 7)
Sidebar'daki token tasarrufu bölümü (`AgentSavingsCard`, `WorkspaceSidebar.tsx`)
küçültülebilsin (tek satırlık özet) ve tamamen gizlenebilsin. Tercih kullanıcı başına
kalıcı olsun (mevcut kullanıcı tercihi deseni; yalnız cihaza bağlıysa localStorage
yeterli — hangisi mevcut desense o). Gizlendikten sonra geri açmanın yolu olsun (ör.
hesap menüsü ya da AI Ajanlarım modalındaki tasarruf ayrıntısı).

## Görev D — AI Agents modalında boş workspace'ler (madde 8)
`AgentsModal.tsx`: hiç ajanı olmayan workspace'ler listenin altında, varsayılan kapalı,
sayısını gösteren katlanır bir bölümde ("Ajanı olmayan çalışma alanları (n)") dursun.
Ajanı olanlar üstte, bugünkü sırayla.

## Görev E — What's new badge'leri renkli (madde 9)
`WhatsNewModal.tsx`: `new` / `improved` / `fixed` badge'leri kategoriye göre renkli
olsun, V2 tasarım dili içinde (`Badge` primitifinin varyantları; sarı `signal` "Yeni"
için, diğerleri tek renk dilini bozmayan iki ayrı ton). Açık + koyu temada kontrast.

## Doğrulama
eslint (değişen dosyalar), tsc, `npm run test:i18n-client` (yeni namespace eklendiyse
`--write`); Hakan onayıyla Playwright: bir sayfa, bir database satırı (center + side
peek), tekrarlayan bir takvim satırı, bir dashboard; koyu + açık, 1440 ve 390 px.

## Bitirirken
Changelog: bu iş için bir ya da iki kayıt (`improved`), 8 dil, müşteri dili. AGENTS.md
(sayfa panelleri, dashboard, sidebar) + Serena `core`/`conventions` senkron;
update-handoff; commit yok; "Tamamlandı" notu.
```

### ✅ U4 — Tamamlandı (2026-10-05, Claude; commit/push yok, migration yok, paket eklenmedi)

**Hakan'ın kararları (taslak onayı):**
- Yerleşim: "dikey grup + yanından açılan kart".
- Geri bağlantılar: kendi butonu olsun.
- Görsel kontrol: Playwright ile yapılsın.
- Taslaktan bilinçli sapma (önerilirken söylendi): kart sayfaya tıklayınca kapanmıyor; yorum okurken yazmaya
  devam edilebilsin diye yalnız ×, Esc veya aynı butonla kapanıyor.

**Yapılan:**
- **A — Yüzen panel grubu (`features/PageFloat.tsx`):**
  - Butonlar, yukarıdan aşağı:
    - Yorumlar (sayı rozeti).
    - Bilgi bağlamı.
    - Geri bağlantılar (yalnız varsa, sayı rozeti).
    - Yerel harita.
    - Tekrar (yalnız tekrarlanabilir satırlarda; satır seriye bağlıysa sarı nokta).
  - Kart grubun yanında açılıyor; aynı anda tek kart. Yorumlar ve Bilgi bağlamı ilk açılıştan sonra bağlı
    kalıyor, yarım yorum kaybolmuyor.
  - Telefonda kart alttan açılan `Dialog`.
  - Tam sayfada grup sağ altta sabit; mobil gezinmenin ve çerez şeridinin üstünde duruyor.
  - Peek'lerde grup `DatabaseView.peekFloatSlot`'a portal'la çiziliyor:
    - Center peek'te modalın sağında. 64 px yer yoksa köşesinde; `ResizeObserver` ile ölçülüyor.
    - Side peek'te çekmecenin solunda. Kartlar sağa, çekmecenin üstüne açılıyor (`data-card-side`); solda
      yalnız dar bir pano şeridi var, orada kart kırpılıyordu.
    - Telefonda sheet'in köşesinde.
  - Veri: açılışta tek `loadPagePanels` (eski `getPagePanels` tek çağrısı). Paneller `initial` alıyor,
    değişikliği geri bildiriyor. Panel kodu `lazyComponent`; harita yalnız kendi butonuna yaklaşınca yükleniyor.
  - Başlık altındaki "N yorum" bağlantısı artık Yorumlar panelini açıyor.
  - Panel gövdeleri başlıksız hâle getirildi:
    - `CommentsThread`, `KnowledgeForm`, `BacklinksList`.
    - `LocalGraphPanel` → `LocalGraphView`.
    - `SeriesPanel` `bare` aldı.
  - Kullanılmayan `scrollToSection` silindi.
  - **Ek düzeltme:** peek'te tekrar kuralı kaydedilince satır yeniden okunmuyordu (eski davranış:
    `router.refresh` peek verisini yenilemiyor). Artık `DatabaseView.reloadPeekPage` ile okunuyor; panel ve
    sarı nokta anında güncelleniyor.
- **B — Pano genişliği:** `dashboard/DashboardWidth.tsx`.
  - Dar / Geniş / Tam:
    - Dar `max-w-4xl`.
    - Geniş, eski `max-w-6xl`; varsayılan bu.
    - Tam.
  - Başlıktaki "⇆ Geniş" butonu sırayla dolaşıyor (lg+).
  - `localStorage['dashboard-width-<id>']`.
- **C — Tasarruf kartı:** `SidebarSavings` + `useSavingsCardMode`. Modlar `full` / `compact` / `hidden`;
  `localStorage['remnus_savings_card']`, olayla canlı eşitleniyor.
  - Kartın üzerine gelince küçült/büyüt ve gizle kontrolleri çıkıyor.
  - Gizleyince "Geri al"lı bildirim; AI Ajanlarım penceresinde "Kenar çubuğunda göster".
  - Kart artık üç tıklama hedefli bir çerçeve. Klavye durağı yalnız AI Ajanlarım satırı; buton içinde buton
    olamayacağı için.
  - Proje penceresinde yalnız boyut kontrolü var (geri açma yolu yok).
- **D — AI Ajanlarım:** ajanı olmayan çalışma alanları altta, kapalı, sayılı bir bölümde (`EmptyWorkspaces`).
- **E — Yenilikler:** kategori çipleri veri paletinden renklendi:
  - Yeni mor.
  - İyileştirme turkuaz.
  - Düzeltme turuncu.
  - Sarı yalnız "Okunmadı".
- **i18n:** 10 yeni anahtar, 8 dilde:
  - `Workspace.savingsCompact/Expand/Hide/HiddenToast/HiddenToastHint/ShowInSidebar`.
  - `UI.undo`.
  - `WorkspaceSettings.agentsEmptyWorkspaces`.
  - `Page.floatGroupLabel/floatRepeat`.
- **Changelog:** `2026-10-05-page-panels-float`, `2026-10-05-dashboard-width-and-tidier-panels` (ikisi de
  `improved`).
- **Doküman:** AGENTS.md (performans kuralı, sayfa düzeni, SeriesPanel, PageFloat, geri bağlantılar, harita,
  sidebar, tasarruf kartı, panolar, AgentsModal, Yenilikler) + Serena `core`/`conventions`.

**Doğrulama:**
- `tsc` (check config) temiz.
- eslint, değişen dosyalar: 0 hata, 3 eski uyarı (`DatabaseView` `pathname`, `PageEditor` `onClose`,
  `WorkspaceSidebar` `workspaceId`).
- `npm run test:i18n-client` ok.
- **Playwright** (Hakan onaylı, yerel dev `:3100` + `local.db`, demo girişi):
  - Sayfa: grup, Yorumlar (yorum eklendi; rozet ve "1 yorum" bağlantısı geldi; kapatıp açınca dizi
    korunuyor, Esc kapatıyor), Bilgi bağlamı, Yerel harita.
  - Koyu tema.
  - Tasarruf kartı: hover kontrolleri, tek satır, gizle + bildirim, pencereden geri açma.
  - AI Ajanlarım: ajansız çalışma alanı bölümü.
  - Yenilikler: koyu + açık.
  - Pano: Geniş → Tam → Dar.
  - Center peek: grup dışarıda; Tekrar → kural kaydedildi → panel ve nokta anında güncellendi.
  - Side peek: kartlar çekmecenin üstüne açılıyor.
  - 390 px: sayfa, alttan açılan panel, peek. Yatay taşma 0.
  - Konsolda yalnız bilinen üçüncü taraf gürültüsü.

**Temizlik:** demo kullanıcısı, iki çalışma alanı ve test için eklenen `agent_savings_rollup` satırı id ile
silindi (`.playwright-mcp/u4/cleanup.ts`); dev sunucusu ve yetim süreçler durduruldu.

**Açık:** `src/components/features/PageSection.tsx` artık hiçbir yerde kullanılmıyor. Silmek için Hakan'ın
onayı bekleniyor.

