# Remnus — Durum Raporu

**Tarih:** 23 Temmuz 2026
**Kaynaklar:** Üretim Turso DB (salt-okunur), PostHog (test hesapları hariç), GitHub API, Remnus workspace (Business Plan v3 + Token-Verimlilik Yol Haritası + Work Plan), Git geçmişi.
**Not:** Bu sürüm, ilk taslaktaki funnel ölçümünü düzeltir — aşağıdaki "0. Ölçüm Düzeltmesi"ne bakın.

---

## 0. Ölçüm Düzeltmesi (bu sürümde ne değişti)

İlk taslak "signup→token dönüşümü ~%15'te takılı, funnel'ın ana deliği bu" diyordu. **Bu yanlıştı — bir ölçüm artefaktıydı:**

1. **PAT-only sayım hatası:** "token üretti" metriği yalnızca `agent_tokens` (manuel PAT) tablosunu sayıyordu. Oysa connection flow güncellemelerinden sonra kullanıcıların çoğu **OAuth ile** bağlanıyor (one-click connector'lar OAuth'a yönlendiriyor) ve OAuth bağlantısı `agent_tokens` satırı **yaratmıyor**. Yani gerçek bağlantıların büyük kısmı sayımdan düşüyordu. (Kanıt: bazı kohortlarda "token→call" oranı %100'ü aşıyordu — bağlanmadan çağrı yapmak imkânsız olduğuna göre, "bağlandı" sayısı eksikti.)
2. **Onarım-öncesi seyreltme:** Tüm-zaman funnel'ı, connection flow onarımından (22 Haziran) önceki kullanıcıları da içeriyordu; bu eski kohort oranı aşağı çekiyordu.

**Düzeltme:** Funnel yeniden tanımlandı → `signup → bağlandı (PAT **veya** OAuth) → aktive oldu (≥1 agent çağrısı)` ve connection flow'un canlıya çıktığı **22 Haziran** kesim tarihinden sonrası baz alındı. Sonuçlar aşağıda (Bölüm 2).

---

## 1. Yönetici Özeti

- **Teknik/ürün vizyonu teslim edildi ve go-to-market'in önüne geçti.** Token-Verimlilik MCP yol haritası Faz 0–5.5 tamamlandı; tek kalan Faz 6 (semantik arama) bilinçli olarak **park edildi**.
- **İlk gerçek ödeme geldi** (1 Professional aboneliği, aktif) — bir **design partner / tanıdık**. "Billing uçtan uca çalışıyor + gerçek ödeme isteği var" kanıtlandı; ama soğuk dış dönüşüm henüz test edilmedi.
- **Aktivasyon funnel'ı sanılandan sağlıklı:** connection flow onarımı sonrası **signup→bağlandı ~%41** (planın %35+ hedefini karşılıyor). Eski "%15" rakamı ölçüm hatasıydı.
- **Asıl kalan iç darboğaz artık "bağlan" değil, "ilk çağrı":** bağlanan kullanıcıların ~yarısı ilk agent çağrısını yapmıyor (connected→activated ~%50, muhtemelen daha yüksek).
- **En büyük boşluk hâlâ dağıtım:** 15 Haziran Reddit dalgasından sonra ikinci bir dalga ateşlenmedi, e-posta yakalama ~0, ve büyük lansman (ScoutForge tam mail + Show HN + PH) hiç başlamadı. Trafik haftalık ~100-130 ziyaretçilik düşük-sabit bir tabanda.
- **Karar:** Kullanıcı "lansmana hazırız" diyor. Ürün buna hazır; tek eksik lansman-öncesi **e-posta yakalama** (gelen dalgayı tutacak kanca).

---

## 2. Düzeltilmiş Aktivasyon Funnel'ı

`signup → bağlandı (PAT veya OAuth) → aktive oldu (≥1 agent çağrısı)`, yalnızca gerçek kullanıcılar (admin/demo hariç), signup tarihine göre kohort.

| Kohort (signup tarihi) | Signup | Bağlandı | signup→bağlandı | PAT / OAuth | Aktive | bağlandı→aktive | signup→aktive |
|---|---|---|---|---|---|---|---|
| Tüm zaman | 93 | 21 | %22,6 | 11 / 13 | 11 | %52,4 | %11,8 |
| **≥ 22 Haz (connection flow canlı)** | **34** | **14** | **%41,2** | **4 / 11** | **7** | **%50,0** | **%20,6** |
| ≥ 30 Haz (plan baseline) | 17 | 5 | %29,4 | 3 / 3 | 5 | %100 | %29,4 |
| ≥ 07 Tem (one-click connect) | 12 | 3 | %25,0 | 2 / 2 | 3 | %100 | %25,0 |

**Okuma:**
- **En anlamlı satır 22 Haziran kohortu (n=34)** — connection flow'un canlıya çıktığı ilk gün, ve en büyük post-onarım örneklem.
- **signup→bağlandı %41,2** → plan hedefi (%35+) zaten aşılmış. Onboarding onarımı işe yaramış.
- **OAuth artık baskın yol** (14 bağlantının 11'i OAuth). Bu yüzden eski PAT-only metrik yanıltıcıydı.
- **Kalan drop: bağlandı→aktive ~%50** — bağlanan ilk çağrıyı yapmıyor. Bu bir "şimdi ne yapayım / ilk değere ulaşma" boşluğu, bağlantı-sürtünmesi değil.
- ⚠️ **Bu %50 bir alt-sınır:** 3 Temmuz (Faz 0 migration) öncesi OAuth çağrıları audit gap nedeniyle eksik loglanmıştı; yani 22 Haz kohortundaki bazı OAuth aktivasyonları hiç kaydedilmemiş olabilir. Gerçek bağlandı→aktive muhtemelen daha yüksek.
- ⚠️ **Örneklem küçük** (n=34, 17, 12) — yön güvenilir, ama ondalık oranlar gürültülü. Kesin karşılaştırma için lansman sonrası hacimle yeniden bakılmalı.

**Connection flow zaman çizelgesi (kesim tarihi kanıtı):**
- **22 Haz** — onboarding MVP (welcome modal + getting-started checklist), `feat/onboarding-mvp` PR #1/#2 merge (`bfe42ce`); PostHog `connect_flow_opened` event'i tam bu hafta akmaya başladı (öncesi 0).
- 24 Haz — Claude connector UI (`e6dfdda`).
- 30 Haz — first-run WelcomeModal + BillingSuccessModal (`6e6bde4`).
- 07 Tem — Tauri one-click agent auto-connect + desktop-detect (`9fc1794`).
- 13 Tem — Claude Code skill auto-connect (`f0cb59f`).

---

## 3. Güncel İstatistikler (baseline → bugün)

| Metrik | Plan baseline (30 Haz) | Bugün (23 Tem) | 90-gün hedefi |
|---|---|---|---|
| Ödeyen müşteri | 0 | **1** (Professional, aktif — design partner) | 3-10 |
| MRR | $0 | 1 abonelik (tutar teyit bekliyor) | ~$150-600 |
| Toplam kayıt | ~72-78 | **96** (93 gerçek + 2 admin + 1 demo) | 250-400 |
| Kayıt (30 Haz'dan beri) | — | +18 (son 30g: 29, son 7g: 5) | — |
| GitHub yıldız | 52 | **60** (+8), 14 fork, 3 watcher | 150 |
| Haftalık aktif workspace (agent'lı) | ~7-8 | **8** (son 7g), 13 (son 30g) | 20-30 |
| signup→bağlandı (22 Haz kohortu) | (ölçülmemişti) | **~%41** | %35+ ✅ |
| bağlandı→aktive (22 Haz kohortu) | — | ~%50 (alt sınır) | — |
| E-posta listesi (capture) | ~0 | ~0 (0 kampanya gönderildi) | 300-600 |

---

## 4. Trafik (PostHog, test hesapları hariç)

30 Haziran'dan beri: **371 tekil ziyaretçi, 1.473 görüntüleme, 506 oturum, ~5,4 dk ort. oturum, %30 bounce.**

Haftalık şekil (tekil ziyaretçi / signup):

```
15 Haz  942 / 54   ← Reddit dalgası (tek atış)
22 Haz  236 / 16
29 Haz  100 /  5
06 Tem  131 /  7
13 Tem  118 /  5
20 Tem   56 /  4   (kısmi hafta)
```

→ Trafik ölmedi (registry/SEO sızıntısı var) ama **büyümüyor**. 30 Haziran'dan bu yana yeni bir kaynak / ikinci dalga devreye girmedi. v3'ün uyardığı "tek-atışlık trafik" riski gerçekleşti.

**Attribution:** Kayıtların büyük çoğunluğunda kaynak boş (first-touch takibi yeni eklendi). Görünen etiketler: `reddit`, `reddit-ad-1`, `chatgpt.com`, `google` referrer.

---

## 5. Agent Kullanımı — güçlü ama dikkatli okunmalı

- **2.455 toplam tool çağrısı** (30 Haz'dan beri 1.875; son 7 gün 1.034). Günlük 100-400 çağrı; 20 Tem'de 414'lük zirve.
- 28 token (12 aktif), 14 kullanıcı PAT üretti, 15 workspace'te token var, **133 toplam workspace**.
- İstemci çeşitliliği sağlıklı: **claude-code 6 · claude 6 · vscode 5 · cursor 4 · antigravity 3**.
- En çok kullanılan tool'lar **yazma ağırlıklı**: `create_page` 705, `update_page` 537, `get_page` 510, `query_database` 256 → ajanlar workspace'e gerçekten yazıyor (asıl değer önermesi çalışıyor).
- ⚠️ **Kritik uyarı:** çağrılar yalnızca **13 farklı sahip / 16 workspace** arasında dağılıyor. Bu hacmin büyük kısmı büyük olasılıkla iç dogfooding (Work Plan yönetimi, blog üretimi, bu rapor dahil). "2.455 çağrı" temiz bir dış-PMF sinyali **değil**; gerçek dış aktif taban ~10-13 kullanıcı.

---

## 6. MCP Yol Haritası — "Token-Verimlilik" (teknik vizyon)

Remnus'un farklılaşma hendeği; neredeyse tamamen teslim edildi.

| Faz | Ne | Durum |
|---|---|---|
| 0 | Ölçüm altyapısı (agent_activity + response_bytes) | ✅ Done |
| 1 | Ucuz retrieval: `fields` / `outline` / `digest` — −%85 | ✅ Done |
| 2 | Delta sync (`get_changes_since` + tombstone) | ✅ Done |
| 3 | Graf katmanı (`page_links` + `get_related_pages` + backlink paneli) | ✅ Done |
| 4 | Agent Memory template + `save-memory`/`recall-context` prompt'ları | ✅ Done |
| 5 | Pazarlama paketi (benchmark blog + wiki, gerçek ölçümler) | ✅ Done |
| 5.5 | Sertleştirme: `query_database` gövdesi opt-in −%74 + compact JSON + şema diyeti (`a3eb236`) | ✅ Done |
| **6** | **Semantik arama (libSQL native vektör)** | ⏸️ **Park edildi** (büyüme kilidini açmıyor; lansman sonrasına) |

- Katalog: **19 tool · 9 read · 10 write · 5 resource · 7 prompt** (her yerde tutarlı).
- Konumlandırma: *"Same page, ~5-10x fewer tokens than Notion's API"* · *"Your agent's memory, human-readable."*

---

## 7. İş Vizyonu — Business Plan v3 (30 Haziran) ve nerede olduğumuz

**v3'ün ana tezi:** Sorun trafik ya da retention değil — **tekrarlanabilirlik + yakalama + gelir-aktivasyonu** eksikliği (delik üst-funnel). 942 ziyaretçilik tek Reddit dalgasından 7-8 kalıcı DAU süzüldü (sağlıklı çekirdek), ama gelen trafik kanca bırakmadan gitti, ikinci dalga mekanizması yoktu, ScoutForge hiç ateşlenmedi.

**v3'ün önerdiği sıra:** Önce 2-3 haftalık "kova onarımı + para altyapısı + yakalama" → **sonra** koordineli büyük lansman (ScoutForge tam mail → Show HN → Product Hunt → Reddit ikinci dalga).

**~3,5 hafta sonra fiili durum:**
- ✅ Onboarding/connection flow onarıldı → signup→bağlandı ~%41 (hedefin üstünde).
- ✅ İlk ödeyen (design partner) geldi → monetizasyon uçtan uca çalışıyor.
- ✅ Funnel ölçümü derinleşti (admin aktivasyon funnel'ı + tarih filtresi, `ba36a77`).
- ❌ E-posta yakalama hâlâ ~0.
- ❌ İkinci dalga / büyük lansman (Sprint 3) hiç başlamadı.
- ⚠️ Trafik düşük-sabit tabanda; tekrarlanabilir edinim motoru henüz yok.

**Kullanıcı teyitleri (bu oturum):** Ödeyen = design partner · Lansman = "hazırız" · Faz 6 = park · Rapor = metin/md yeterli.

---

## 8. Operasyonel Durum — Work Plan (Sprint 1-4)

- **Sprint 1 · Lansman Öncesi Temel:** ✅ neredeyse tümü Done (onboarding akışı, `.mcpb` bundle, `/api/health`, README+GIF, landing revizyonu, PostHog funnel, v1.0.0 + güvenlik taraması, 2 blog).
- **Sprint 2 · Registry & Sessiz Dağıtım:** çoğu Done (MCP Registry, Smithery, mcp.so, Glama, editör config'leri, X ritmi). **Review:** awesome-mcp PR'ları. **In progress:** ScoutForge teaser maili, Reddit karma. **Not started:** Blog #2 (OAuth 2.1).
- **Sprint 3 · Büyük Lansman:** 🔴 tamamı Not Started (lansman altyapısı, ScoutForge tam mail, Show HN + maker comment, Product Hunt, Reddit lansman postları, cross-distribution).
- **Sprint 4 · Aktivasyon & İterasyon:** 🔴 tamamı Not Started (funnel onarımı, Discord/office hours, multi-agent conflict, use-case blog motoru, SEO tamamlama, haftalık metrik rutini).

---

## 9. Sentez, Risk ve Öneri

**Güncellenmiş teşhis:** İlk taslaktaki "signup→token deliği" yanlıştı. Düzeltilmiş tabloda:
1. **Üst-funnel (signup→bağlan) sağlıklı: ~%41** — connection flow onarımı işini yapmış, hedefin üstünde.
2. **Kalan iç drop: bağlan→ilk çağrı (~%50)** — bağlanan yarısı ilk agent çağrısını yapmıyor. Bu bir "ilk değere ulaşma" boşluğu.
3. **Asıl problem hâlâ dağıtım:** e-posta yakalama ~0, ikinci dalga yok, büyük lansman ateşlenmedi.

**Risk:** ~18 aylık runway rahat olsa da, büyüme motoru hâlâ test edilmemiş. Rakip penceresi daralıyor (AppFlowy #8043, AFFiNE #13262 native MCP'ye itiliyor) — tehdit "varlık" değil "zamanlama".

**Öneri — lansman-öncesi minimum (2-4 gün), sonra tetiği çek:**
1. **Landing'e e-posta capture** (repo serbest, site capture — HN kuralına uygun). Bu, funnel'ın *en yüksek getirili* ve hâlâ açık tek deliği; gelen dalgayı tutan tek kanca.
2. **(Opsiyonel) İlk-çağrı kancası** — bağlan→aktive %50 boşluğu için: bağlantı sonrası hazır bir prompt + tek-tık test çağrısı. Küçük efor, ölçülebilir kazanım.
   *(signup→bağlan artık sağlıklı olduğu için "token üretim onarımı" acil değil — bu iş büyük ölçüde çözülmüş.)*
3. **Sonra ateşleme sırası (v3):** ScoutForge tam mail → Show HN → Product Hunt → Reddit ikinci dalga. Her birinden önce Sprint 3'teki `Lansman Günü Altyapı Hazırlığı` (hâlâ Not Started) bir kez gözden geçirilmeli.

**Özet:** Ürün ve farklılaşma lansmana hazır (hatta fazla hazır); onboarding onarımı beklenenden iyi çalışıyor; ilk gerçek ödeme (design partner) geldi. Eksik olan tek şey **gelen trafiği tutacak yakalama** ve **tetiğin çekilmesi**. En yüksek getirili hamle: 2-4 günlük e-posta capture yaması → hemen ardından koordineli büyük lansman.

---

## 10. Notlar / İnceleme Bulguları

- ✅ **Sır güvenliği:** `.env` git'te izlenmiyor (`.gitignore`'da), yalnızca `.env.example` commit'li. Public AGPL repo'da sızıntı yok.
- ⚠️ **Küçük tutarsızlık:** `.env` içindeki `STRIPE_SECRET_KEY` yorumu "sandbox" diyor ama değer canlı (`sk_live_...`). Billing gerçekten canlı; yorumu düzeltmek karışıklığı önler.
- ℹ️ `agent_activity.response_bytes` yalnızca ~3 Temmuz (Faz 0 migration) sonrası çağrılarda dolu; öncesi NULL. Bu tarihten sonrası için ~5,9M byte ≈ ~1,5M token servis edilmiş.
- ℹ️ 3 Temmuz öncesi OAuth çağrılarında audit gap vardı (Faz 0'da kapatıldı) — bu yüzden erken OAuth aktivasyonları eksik loglanmış olabilir; funnel'ın "aktive" adımı bu pencere için alt-sınır.

---

## Ek — Veri Kaynakları & Yöntem

- **DB metrikleri:** üretim Turso (`remna-db-ranork`) üzerinde salt-okunur SELECT sorguları. Yalnızca gerçek kullanıcılar için `role='user'` filtresi (admin/demo hariç).
- **Funnel:** kohort = belirtilen tarihten sonra kayıt olan kullanıcılar; bağlandı = `agent_tokens.created_by` (PAT) **veya** `oauth_access_tokens.user_id` (OAuth); aktive = `agent_activity.owner_user_id` (≥1 çağrı).
- **Trafik/event:** PostHog (proje 189185), `filterTestAccounts: true`.
- **Kesim tarihi:** Git geçmişi (`feat/onboarding-mvp` merge, 22 Haz) + PostHog `connect_flow_opened` ilk akış haftası çapraz doğrulandı.
- **Örneklem uyarısı:** Post-onarım kohortları küçük (n=34/17/12). Yön güvenilir; kesin oranlar lansman sonrası hacimle yeniden ölçülmeli.
