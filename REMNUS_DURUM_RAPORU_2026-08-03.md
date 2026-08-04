# Remnus — Girişim Durum Raporu

**Hazırlanma tarihi:** 2026-08-03
**Kapsam:** Ürün, mühendislik, büyüme/pazarlama, rekabet, gelir ve maliyet — girişim bütünü.
**Kaynaklar:** Bu repo (kod, Git geçmişi, `AGENTS.md`/`AI.md`/`.ai/`), Remnus workspace'indeki iç planlama sayfaları (Remnus MCP), PostHog (canlı analytics), GitHub API (`gh`). Vercel MCP bu oturumda **yetkilendirilemedi** (OAuth gerekiyor, non-interactive oturumda tamamlanamaz) — maliyet/runtime bölümü bu nedenle kısmen dolaylı kaynaklara (kod + iç görev notları) dayanıyor; canlı Vercel Usage/Analytics doğrulaması yapılamadı.

---

## TL;DR

- **Ürün teknik olarak olgun, dağıtım hâlâ zayıf.** MCP sunucusu (19 tool, 5 resource, 7 prompt), OAuth 2.1 + PAT, token-verimlilik mühendisliği (%74-90 küçülme kazanımları) ve çoklu platform (Web/Tauri/Capacitor/PWA) production-grade. Buna karşın 90 gün içinde yazılan **4 ayrı stratejik büyüme planı (v1→v4)** hâlâ "büyük lansman" (Show HN, Product Hunt) hiç ateşlenmeden birikiyor; iç Work Plan panosunda bu adımların tamamı **"Not started."**
- **Trafik tek bir organik Reddit dalgasından besleniyor, kalıcı bir kazanım motoru yok.** 15-21 Haziran'da r/vibecoding gönderisi haftalık 54 kayda kadar çıkardı; sonraki haftalarda 3-7'ye düştü. GitHub yıldızı da aynı örüntüde: 2 → 52 (30 Haziran) → **61 (bugün)** — yavaşlayan büyüme.
- **Gelir tarafı iç planlama dokümanlarına göre hâlâ çok erken aşamada:** en güncel iç not (Plan v4) "93 kullanıcı, 1 tanıdık müşteri" diyor — yani bilinen tek ödeme, soğuk/organik bir dönüşüm değil, kişisel bir tanıdık. Bu oturumda güncel MRR/ödeyen sayısını doğrulayacak bir veri kaynağına (Stripe/DB) erişim yoktu.
- **Somut ve güncel bir maliyet bulgusu var:** `/api/mcp` rotasındaki eski (artık kaldırılmış) SSE transport'u, boşta bağlantıları sunucu tarafında hiç kapatmıyordu; Vercel'i 300 saniyede zorla sonlandırmaya, istemciyi tekrar bağlanmaya zorluyordu — 24 saatte 785 timeout, sadece 7 token'dan. Bu, "Fluid Provisioned Memory" maliyetinin "Fluid Active CPU"nun ~5-6 katına çıkmasının kök nedeniydi. Bugünkü son commit (`4d0faed`) bu kod yolunu tamamen kaldırdı; **maliyetin gerçekten düştüğü henüz canlıda doğrulanmadı** (Vercel MCP erişimi yok).
- **Rekabet penceresi daralıyor ama kapanmadı.** Remnus'un iddia ettiği üçlü (MCP-native + Notion-tarzı DB views + AGPL açık kaynak) hâlâ tek başına hiçbir rakipte yok, ama parçalar hızla toplanıyor: Outline Şubat 2026'da first-party MCP ekledi, ClickUp/Airtable de resmi MCP'ye geçti. En yakın orta-vadeli tehdit AppFlowy (~70K yıldız, AGPL) ve AFFiNE (~68K yıldız, MIT) — ikisi de DB-view + açık kaynağı zaten sağlıyor, yalnızca native MCP'leri eksik.
- **Bir dokümantasyon tutarsızlığı bulundu ve düzeltilmedi:** kök `README.md` hâlâ "Streamable HTTP + SSE dual transport" yazıyor; oysa SSE desteği bugünkü son commit'te tamamen kaldırıldı. Aynı geçiş sırasında 4 başka dosya (`docs/WHAT_IS_REMNUS.md`, `docs/REMNUS_NEDIR.md`, `docs/mcp/README.md`, `docs/mcp/getting-started.md`) güncellendi ama kök `README.md` atlanmış görünüyor.

---

## 1. Ürün ve Vizyon

Remnus, insan ve AI ajanlarının Model Context Protocol (MCP) etrafında eşit vatandaşlar olarak çalıştığı bir **"Human-Agent Collaborative Workspace"**. Notion'a benzer sayfa + dinamik-kolonlu database modeli sunuyor (her database satırı aynı zamanda içerik taşıyan bir sayfa), ama konumlandırması "Notion alternatifi" değil: ajan erişimi mimari bir tasarım kısıtı (agent access as an architectural constraint). Şeffaf agent memory (vektör store değil, insanın okuyup düzeltebildiği sıradan sayfalar), immutable audit log ve ajan token'larının birincil kimlik olarak ele alınması bu konumlandırmanın somut karşılıkları.

**Lisans:** AGPL-3.0-only — bilinçli bir karar (iç planlama dokümanlarında gerekçesi: SaaS-fork loophole'unu kapatmak; MIT/Apache seçilseydi bir rakip Remnus'u alıp kapalı-kaynak SaaS olarak satabilirdi).

## 2. Zaman Çizelgesi

| Tarih | Olay |
|---|---|
| 2026-05-18 | İlk commit ("Initial commit from Create Next App") — proje sıfırdan başladı |
| 2026-06-11 | Plan v2 (ilk stratejik GTM planı) — bu noktada repo henüz hiçbir registry'de yok, 2 GitHub yıldızı |
| ~2026-06-15/21 | Organik r/vibecoding Reddit gönderisi — 2.477 pageview / 942 tekil ziyaretçi, projenin en büyük tek trafik dalgası |
| 2026-06-30 | Plan v3 — GitHub yıldızı 52'ye çıkmış, registry'ler (MCP Registry/Smithery/Glama/mcp.so) yayında, ama hâlâ 0 ödeyen müşteri |
| 2026-07-03 → 07-08 | Token-verimlilik mühendislik sprint'i (Faz 0-5.5): ölçüm altyapısı, `fields`/`outline`/digest projeksiyonları, delta-sync, page-links graf katmanı, Agent Memory prompt'ları, benchmark blog yazısı |
| 2026-07-07/08 | Rakip analizi + influencer listesi güncellendi; Plan v4 yazıldı (en güncel 90-günlük strateji) |
| 2026-07-28/29 | LinkedIn 1:1 outreach süreci başlatıldı (ayrı bir runbook ile) — stratejik planların önerdiği "büyük lansman"dan farklı, manuel/ilişki-tabanlı bir kanal |
| 2026-08-03 (bugün) | Son commit: `/api/mcp`'den legacy SSE transport'un kaldırılması (maliyet düzeltmesi) |

Proje **~2,5 aylık**; 411 commit, `v0.1.0`'dan `v0.1.16`'ya 17 sürüm etiketi.

## 3. Mühendislik Durumu

**Stack:** Next.js 16.2.6 (App Router), React 19.2, TypeScript 5, SQLite/Turso + Drizzle ORM, Auth.js v5, Tiptap v3, TanStack Query, Tailwind CSS 4.

**MCP yüzeyi:** 19 tool (9 read, 10 write) + 5 resource + 7 prompt. OAuth 2.1 + PKCE (dynamic client registration, RFC 7591) ve PAT (`rmns_` prefix) ile kimlik doğrulama; 60 istek/dk/token rate limit; her çağrı immutable audit log'a yazılıyor.

**Platformlar:** Web (Vercel), Tauri v2 masaüstü (Windows/macOS/Linux — v0.1.15'te ACL izin düzeltmesi yapıldı), Capacitor v8 mobil (iOS/Android), PWA. Ayrıca `mcpb/` altında Claude Desktop için paketlenmiş bağımsız bir MCP proxy paketi var (bu, monorepo olmayan tek istisna paket).

**Yakın dönem mühendislik odağı — Token Verimlilik Yol Haritası (tamamlandı, Faz 0-5.5):**
- `query_database` satır gövdeleri artık varsayılan olarak dönmüyor (opt-in) → naive sorguda **-%74**
- `get_page(mode: "outline")`, workspace digest resource'u → **-%80/-%90** senaryo bazlı
- Delta-sync (`get_changes_since`) ve page-links graf katmanı (`get_related_pages`) — ajanların tüm workspace'i taramadan senkronize olmasını sağlıyor
- Agent Memory template'i + `save-memory`/`recall-context` prompt'ları — "vektör store değil, okunabilir sayfa" konumlandırmasının somut karşılığı
- Faz 6 (opsiyonel semantik arama, libSQL native vektör) — plan yazıldı, **implementasyon onayı bekliyor**, kod yok

**Bugünkü (son) değişiklik — maliyet odaklı:** `/api/mcp`'deki legacy stateful-SSE kod yolu (Cursor/Windsurf/Continue/Antigravity gibi eski istemciler için) tamamen kaldırıldı; tüm trafik artık tek, stateless `WebStandardStreamableHTTPServerTransport` üzerinden akıyor. Detay için bkz. **Bölüm 6 (Maliyet)**.

**Bulunan tutarsızlık (düzeltilmedi):** Kök `README.md:29` hâlâ *"MCP Server — 19 tools + 5 resources + 7 prompts, Streamable HTTP + SSE dual transport"* diyor. SSE artık yok. Aynı gün yapılan geçişte 4 doküman dosyası (`docs/WHAT_IS_REMNUS.md`, `docs/REMNUS_NEDIR.md`, `docs/mcp/README.md`, `docs/mcp/getting-started.md`) düzeltildi ama kök README bu taramanın dışında kalmış. Küçük ama dışa dönük (GitHub'da ilk görülen dosya) bir doğruluk sorunu.

## 4. Büyüme ve Kullanım Metrikleri (PostHog + GitHub, canlı veri)

### Trafik (son 30 gün, 2026-07-04 → 2026-08-03)

| Metrik | Değer |
|---|---|
| Tekil ziyaretçi | 440 |
| Sayfa görüntüleme | 1.856 |
| Oturum | 599 |
| Ort. oturum süresi | ~5 dk 54 sn |
| Bounce rate | %27,9 |

Günlük aktif kullanıcı (pageview DAU) son 30 günde **4 ile 34 arasında dalgalanıyor** — istikrarlı bir taban yerine gün-gün büyük varyans gösteriyor; bu, iç planlama dokümanlarındaki "kova delik" (leaky funnel, tekrarlanabilir kazanım kanalı yok) teşhisiyle örtüşüyor.

### Kümülatif (proje başlangıcından bugüne, 2026-05-18 → 2026-08-03)

| Metrik | Değer |
|---|---|
| Signup (site geneli) | 98 |
| OAuth/editor bağlantısı tamamlanan (`connect_completed`) | 14 |
| Oluşturulan MCP token (`mcp_token_created`) | 47 |
| Agent çağrısı (legacy `agent_call` event) | 4.609 |

**Önemli caveat (iç planlama dokümanlarından doğrulanmış):** 4.609 agent-çağrısı rakamının büyük kısmı kurucunun kendi dogfooding'i (bu workspace'teki planlama/outreach işleri dahil) — Plan v4'ün kendi uyarısı: *"2.455 tool çağrısının büyük kısmı iç kullanım; gerçek dış aktif taban ~10-13 kullanıcı."* Kanonik `$mcp_tool_call` event'i bu sorguda 0 döndü — bu muhtemelen event isimlendirmesinin `agent_call`'dan yeni `@posthog/mcp` şemasına (`$mcp_tool_call`) geçiş sürecinde olduğunu gösteriyor; iki event bir arada tam bir "gerçek dış kullanım" resmi vermiyor, ek doğrulama gerekir.

### Haftalık signup eğrisi — "tek atışlık dalga" örüntüsü doğrulandı

```
2026-06-15 haftası: 54  ← r/vibecoding organik postu
2026-06-22 haftası: 16
2026-06-29 haftası:  5
2026-07-06 haftası:  7
2026-07-13 haftası:  5
2026-07-20 haftası:  7
2026-07-27 haftası:  3
```

İç planlama dokümanlarının (Plan v3) tespitiyle bire bir örtüşüyor: trafik gelebiliyor, ama yakalama/tekrar mekanizması yok, dalga hızla sönüyor.

### GitHub (canlı, `gh api`)

| Metrik | Değer |
|---|---|
| Yıldız | 61 |
| Fork | 14 |
| Açık issue | 0 |
| Contributor | 2 (Ranork: 315 katkı, Azkhar: 83 katkı) |
| Lisans | AGPL-3.0 |

Yıldız trendi: 2 (Haziran başı) → 52 (30 Haziran, esas olarak Reddit dalgasından) → **61 (bugün)** — son 5 haftada yalnızca +9, büyüme belirgin şekilde yavaşladı.

## 5. Rekabet Durumu

Workspace'teki `Competitors` sayfasından (Temmuz 2026, en güncel iç analiz) özet:

- **Remnus'un iddia ettiği üçlü kombinasyon — (1) MCP-native (bearer token + OAuth 2.1 + headless/CI ajan desteği), (2) Notion-tarzı DB views, (3) AGPL açık kaynak — hâlâ hiçbir rakipte tam olarak bir arada yok**, ama boşluk daralıyor.
- **Outline**, 18 Şubat 2026'da her workspace'e first-party MCP sunucusu ekledi — önceki iç planlarda "MCP'si yok" olarak işaretlenmişti, bu artık **geçersiz**. Outline hâlâ DB-view sunmuyor ve BSL 1.1 (OSI-onaylı değil).
- **ClickUp** ve **Airtable** de 2026'da resmi MCP'yi canlıya aldı — ama ikisi de kapalı kaynak + kurumsal fiyatlı.
- **En büyük orta-vadeli tehdit: AppFlowy (AGPL, ~70K+ yıldız) ve AFFiNE (MIT, ~68K+ yıldız).** İkisi de DB-view + açık kaynağı zaten sağlıyor; yalnızca eksikleri (native MCP) tam olarak Remnus'un güçlü olduğu alan. Her ikisinde de bu yönde açık GitHub feature request var (AppFlowy #8043, AFFiNE #13262).
- Notion'ın resmi MCP'si hâlâ bearer token desteklemiyor ve headless/CI ajanlar için tasarlanmadı — Remnus'un asıl konumlandığı boşluk hâlâ geçerli, ama Notion bu alana aktif yatırım yapıyor.

**Stratejik çıkarım (iç dokümanların ortak vurgusu):** moat ürün özelliklerinden çok hıza, topluluğa ve "headless/CI agent için tasarlandı" konumlandırmasına dayanmalı — çünkü büyük oyuncuların MCP açığını kapatması an meselesi.

## 6. Büyüme/Pazarlama Geçmişi ve Mevcut Durum

Workspace'te **4 ayrı 90-günlük stratejik plan** bulundu (v1 → v4), her biri bir öncekinin üzerine, gerçek veriyle güncellenerek yazılmış:

- **Plan v1** (en erken, lansman-öncesi): MCP primitif tamamlama (Resources/Prompts/OAuth), AGPL kararı, freemium tasarımı — hedef 1.500 yıldız/150 aktif workspace (kurucunun ilk hedefi).
- **Plan v2** (11 Haziran): "darboğaz kod değil dağıtım" teşhisi; hedefler 1.500'den 300-600 yıldız/30-60 aktif workspace'e **düşürüldü** (daha gerçekçi).
- **Plan v3** (30 Haziran): Reddit dalgası sonrası veri ışığında — "kova delik değil, tekrarlanabilirlik/yakalama eksik" teşhisi; önce "kova onarımı" (e-posta capture, aktivasyon, monetizasyon testi) sonra büyük lansman öneriliyor.
- **Plan v4** (en güncel): AFFiNE'in native MCP'yi Aralık 2025'te gönderdiğini not ederek "ilk MCP-native workspace" iddiasının artık geçersiz olduğunu kabul ediyor; konumlandırmayı token-verimliliği + yazma-yeteneği + headless uyumuna kaydırıyor. **Baseline not: "93 kullanıcı, 1 tanıdık müşteri."**

**Kritik gözlem — plan ile icra arasında boşluk:** İç `Work Plan` panosunda (Remnus MCP database, 33 görev) durum şöyle:

| Sprint | Durum |
|---|---|
| Sprint 1 · Lansman Öncesi Temel | Neredeyse tamamı **Done** (onboarding flow, .mcpb bundle, health endpoint, README, landing mesajı, PostHog funnel) |
| Sprint 2 · Registry & Sessiz Dağıtım | Çoğunlukla **Done** (MCP Registry, Smithery, mcp.so/Glama); ScoutForge teaser e-postası ve Reddit karma inşası hâlâ **In progress**; Blog #2 (OAuth teknik yazısı) **Not started** |
| Sprint 3 · Büyük Lansman | **Tamamı Not started** — Show HN, Product Hunt, ScoutForge tam lansman e-postası, Reddit lansman postları, lansman-günü altyapı hazırlığı dahil hiçbiri başlamamış |
| Sprint 4 · Aktivasyon & İterasyon | **Tamamı Not started** |

Yani üç ayrı stratejik doküman turu boyunca tutarlı biçimde önerilen "önce kovayı onar, sonra Show HN/Product Hunt'ı ateşle" sıralamasının **ilk yarısı (kova onarımı — Sprint 1) yapıldı, ikinci yarısı (büyük lansman — Sprint 3) hiç tetiklenmedi.** Bunun yerine son hareket (2026-07-28'den itibaren) tamamen farklı, manuel bir kanala kaydı: **LinkedIn 1:1 outreach** — kurucunun kişisel ağındaki (4.895 bağlantı) kişilere profil-okuma + organik sohbet + yalnızca ilgili acı çıkarsa ürün paylaşımı disipliniyle işleyen bir runbook. Bu, ölçeklenmesi zor ama düşük riskli, ilişki-öncelikli bir pivot; workspace'teki en son güncel state (2026-07-29 koşu logu): 4 satır (Onur Güneş, İlyas Saltay, Sule Sentürk, Murat Kader, Avni Bilal Demirtaş, Dinçer Karaduman — hepsi "S1 Selam Gönderildi", henüz hiçbiri ürün paylaşım aşamasına (S4) ulaşmamış.

## 7. Fiyatlandırma ve Gelir

**Yayındaki plan tablosu** (`src/lib/billing/plans.ts` + `messages/en.json`, kod = tek doğruluk kaynağı):

| Plan | Fiyat | Seat | Agent (token) | Storage | Audit log | Workspace |
|---|---|---|---|---|---|---|
| Free | $0 | 2 | 2 | 512 MB | 7 gün | 2 |
| Startup | $10/ay | 5 | 5 | 5 GB | 30 gün | Sınırsız |
| Professional | $29/ay | 15 | Sınırsız | 20 GB | 90 gün | Sınırsız |
| Enterprise | Özel | Sınırsız | Sınırsız | 1 TB | 365 gün | Sınırsız |

Stripe entegrasyonu (Checkout + Customer Portal + webhook) kodda canlı; ancak **bu oturumda gerçek abone/MRR sayısını doğrulayacak bir veri kaynağına (Stripe API, üretim DB'si) erişim yoktu.** En güncel bilinen dolaylı kanıt, iç planlama dokümanının (Plan v4) kendi ifadesi: *"Mevcut taban (93 kullanıcı, 1 tanıdık müşteri) çok erken."* — yani en son iç değerlendirmede **1 bilinen ödeyen müşteri, o da kurucunun kişisel tanıdığı**, soğuk/organik bir dönüşüm değil. Bugünkü PostHog verisi (98 kümülatif signup) bu "93" rakamıyla tutarlı bir büyüme gösteriyor, ancak paying-customer sayısının o tarihten bugüne değişip değişmediği doğrulanamadı — **bu, raporun en belirsiz kaldığı nokta.**

## 8. Maliyet ve Altyapı

**Somut, güncel bulgu — bugün düzeltilen bir maliyet kaçağı:** `.ai/CURRENT_TASK.md`'deki en son görev kaydına göre, `/api/mcp` rotasındaki eski (2025-öncesi MCP spec'inden kalma) stateful-SSE transport kod yolu, Cursor/Windsurf/Continue/Antigravity gibi istemcilerden gelen bağlantıları sunucu tarafında hiç kapatmıyordu. Her böyle bağlantı, Vercel `maxDuration`'a (önceden 300 saniye) çarpıp zorla sonlandırılana kadar boşta bekliyor, sonra istemci yeniden bağlanıp döngü tekrarlıyordu.

- **Ölçülen etki:** Son 24 saatte `/api/mcp` üzerinde 785 "Runtime Timeout" hatası, yalnızca 7 farklı token'dan; 2026-06-17'den beri toplam 9.928 kez.
- **Maliyet imzası:** Vercel Usage panelinde "Fluid Provisioned Memory" (~$15/aya-kadar) rakamı "Fluid Active CPU" (~$2,7/aya-kadar) rakamının **~5,5 katı** — yani harcanan para aktif hesaplamadan değil, boşta bekleyen (I/O-wait) bellekten geliyordu.
- **Neden önceki düzeltme (`0fa3411`, bu route'a 256MB bellek sınırı koyan commit) yetmedi:** yalnızca çarpma-başına maliyeti düşürdü, hang'lerin *sıklığını* değiştirmedi.
- **Bugünkü kesin çözüm (`4d0faed`, HEAD):** legacy SSE kod yolu tamamen kaldırıldı; tüm trafik artık stateless transport üzerinden akıyor; `maxDuration` 300 → 60 saniyeye düşürüldü.
- **Doğrulama durumu:** Kod değişikliği commit edilmiş ve HEAD'de, ama **canlıya deploy edilip 24-48 saat sonra Vercel Usage'da maliyetin gerçekten düştüğü teyit edilmedi** — bu oturumda Vercel MCP'ye erişim olmadığı için bu rapor da doğrulayamadı.

**Diğer altyapı/üçüncü-taraf bağımlılıkları (kod + `AGENTS.md`'den, aktif olarak kullanılıyor):**

| Servis | Amaç |
|---|---|
| Vercel | Web hosting + 1 günlük cron (`/api/cron/emails`, her gün 09:00) |
| Turso (libSQL) | Prod veritabanı |
| Cloudinary | Asset/görsel depolama |
| Stripe | Ödeme/abonelik |
| AWS SES | Transactional + lifecycle e-posta |
| PostHog | Analytics + MCP kullanım telemetrisi |
| GitHub Actions | Tauri masaüstü release CI |

**Planlanan (aspirational) bütçe** (Plan v1'den, gerçek harcama değil): aylık ~$100 — domain, Vercel Pro ($20), Resend (ücretsiz katman), tek seferlik Product Hunt/Canva görselleri, küçük Reddit Ads testi. Bu, yukarıdaki gerçek Vercel maliyet bulgusuyla karşılaştırıldığında bile SSE-kaynaklı kaçak muhtemelen bu bütçenin önemli bir kısmını tek başına tüketiyordu.

## 9. Ekip

Git/GitHub verisine göre **2 GitHub contributor**: `Ranork` (315 katkı — kurucu, Emir Oğuz) ve `Azkhar` (83 katkı). İç planlama dokümanlarında (Plan v3) ayrıca "1-2 katkıcı (Hakan Temur, Alex Gurevich)" ve dış PR'lardan bahsediliyor — bu isimlerin GitHub contributor kayıtlarıyla birebir eşleşip eşleşmediği bu oturumda doğrulanamadı. Genel resim: **esasen tek-kurucu (solo founder) operasyonu**, sınırlı ek katkı ile.

## 10. Riskler (iç dokümanlardan sentezlenmiş, güncel duruma göre yeniden değerlendirilmiş)

1. **Rekabet penceresi daralıyor.** AppFlowy veya AFFiNE native MCP gönderirse, "MCP-native + DB-views + açık kaynak" boşluğu kapanır; moat'ın hıza/topluluğa kaymış olması gerekir (iç dokümanlar bunu zaten öngörmüş).
2. **Plan-icra boşluğu.** Üç ayrı strateji turunun aynı "önce kova, sonra büyük lansman" sırasını önermesine rağmen büyük lansman (Sprint 3) hâlâ hiç tetiklenmedi. Bu ya bilinçli bir bekleme/pivot ya da yürütme sürtünmesi — rapor bunu bir gözlem olarak not ediyor, sebebini bilmiyor.
3. **Tek-kurucu kapasitesi.** 4 stratejik plan + token-verimlilik roadmap'i + LinkedIn outreach runbook'u + aktif mühendislik (bugün bile bir maliyet düzeltmesi) — hepsi tek kişiye yükleniyor gibi görünüyor.
4. **Gelir doğrulama boşluğu.** En güncel bilinen iç veri "1 tanıdık müşteri" diyor; bu rapor güncel MRR'ı bağımsız doğrulayamadı.
5. **AGPL'in çift ucu.** SaaS-fork'u caydırıyor ama bazı kurumsal alıcıları (ör. Google'ın iç politikası AGPL'i yasaklıyor) kapı dışı bırakıyor — hedef kitle (vibe coder/AI-native startup) bundan büyük ölçüde etkilenmiyor olsa da orta vadede dual-licensing gündeme gelebilir.
6. **Dokümantasyon senkron sorunu.** Bugün bulunan SSE/README tutarsızlığı, hızlı ardışık mühendislik değişikliklerinde pazarlama/dokümantasyon yüzeylerinin geride kalabildiğini gösteriyor.

## 11. Bu Oturumda Erişilemeyen / Doğrulanamayan Bilgiler

- **Vercel** (canlı runtime hataları, güncel Usage/maliyet grafiği, deployment geçmişi) — MCP sunucusu OAuth gerektiriyor, bu non-interactive oturumda tamamlanamadı. Kullanıcı `claude mcp` veya `/mcp` ile yetkilendirirse sonraki oturumda kullanılabilir.
- **Gerçek Stripe/MRR/ödeyen-müşteri sayısı** — DB veya Stripe API erişimi olmadan yalnızca iç planlama dokümanlarının (en güncel: "1 tanıdık müşteri") dolaylı ifadesine dayanıldı.
- **Kanonik `$mcp_tool_call` event'inin `agent_call`'a göre gerçek payı** — event isimlendirme geçişi net değil, iki rakam birbirini tam tamamlamıyor.

---

*Bu rapor; bu repodaki kod ve Git geçmişi, Remnus workspace'indeki iç planlama sayfaları (Plan v1-v4, Competitors, Influencers, Work Plan, LinkedIn Outreach, Token-Verimlilik Yol Haritası) ve PostHog/GitHub'dan çekilen canlı verilerin sentezidir. Tarihi olarak "donmuş" planlama dokümanlarındaki rakamlar (ör. "93 kullanıcı") o dokümanın yazıldığı tarihe aittir; bu raporun kendi PostHog/GitHub sorguları (98 signup, 61 yıldız) 2026-08-03 itibarıyla güncel ve doğrulanmıştır.*
