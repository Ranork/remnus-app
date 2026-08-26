# Remnus — Girişim Durum Raporu

> Bu dosya **şablondur** — commit edilir, GitHub'a gider. Bu şablondan üretilen
> gerçek raporlar (`.ai/status-reports/REMNUS_DURUM_RAPORU_<TARIH>.md`) gelir,
> maliyet ve outreach gibi hassas veri içerdiği için `.gitignore` ile hariç
> tutulur ve asla commit edilmez.
>
> Üretim akışı: `/durum-raporu` (bkz. `.claude/commands/durum-raporu.md` — bu
> komut dosyası `.claude/` genel gitignore kuralı nedeniyle yerel/makineye
> özeldir, repoyla birlikte gitmez).

**Hazırlanma tarihi:** <YYYY-MM-DD>
**Kapsam:** Ürün, mühendislik, büyüme/pazarlama, rekabet, gelir ve maliyet — girişim bütünü.
**Kaynaklar:** <bu raporu üretirken fiilen kullanılan kaynakları listele: repo (kod/Git geçmişi/AGENTS.md/AI.md/.ai), Remnus MCP workspace sayfaları, PostHog, GitHub API (`gh`), Vercel MCP, vb. Erişilemeyenleri de burada veya §11'de belirt.>

---

## TL;DR

<5-7 madde. Her biri tek cümlede bir bulgu + kanıt. Kurucunun 5 dakikada okuyup
durumu kavrayacağı yoğunlukta olmalı. Rakam veriyorsan kaynağını (canlı veri mi,
iç plan dokümanı mı, kod mu) madde içinde belirt.>

---

## 1. Ürün ve Vizyon

<Konumlandırma, lisans kararı ve gerekçesi güncel mi diye kontrol et; değiştiyse not düş.>

## 2. Zaman Çizelgesi

<Tablo: Tarih | Olay. Bir önceki rapordan bugüne yeni satırlar eklenir, eskiler
kısaltılabilir ama silinmez — süreklilik önemli.>

## 3. Mühendislik Durumu

<Stack, MCP yüzeyi (tool/resource/prompt sayıları), platformlar, yakın dönem
mühendislik odağı, bulunan tutarsızlıklar (dokümantasyon vs kod vs Git durumu).>

## 4. Büyüme ve Kullanım Metrikleri

<PostHog + GitHub'dan canlı veri. Son 30 gün trafik tablosu, kümülatif
signup/OAuth/token/agent-call sayıları, haftalık signup eğrisi, GitHub
yıldız/fork/issue/contributor. Dogfooding/iç kullanım payını ayıkla — ham
rakamı gerçek dış kullanım gibi sunma.>

## 5. Rekabet Durumu

<Workspace'teki güncel rakip analizinden özet + kendi doğrulamaların (rakip
duyuruları, changelog'lar). Moat'ın neye dayandığını güncel durumla test et.>

## 6. Büyüme/Pazarlama Geçmişi ve Mevcut Durum

<Aktif stratejik planlar, Work Plan/sprint durumu (plan ile icra arasında
boşluk var mı), aktif kanallar (outreach, launch, vb.) ve güncel adım.
ScoutForge 1:1 outreach için Growth altındaki **Outreach Log** database'ini
(`query_database`) kontrol et: satır sayısı, Status kırılımı (Replied/Invite
Sent/Trial Active/Converted/Declined/No Response), Interest dağılımı ve öne
çıkan bulgular. Örneklem küçükse ("şu ana kadar N konuşma") açıkça belirt,
tekil anekdotu trend gibi sunma.>

## 7. Fiyatlandırma ve Gelir

<Yayındaki plan tablosu (kod = tek doğruluk kaynağı, `src/lib/billing/plans.ts`
+ `messages/en.json`). MRR/ödeyen müşteri sayısı doğrulanabildiyse kaynağıyla
birlikte yaz; doğrulanamadıysa açıkça "doğrulanamadı" de, tahmin üretme.>

## 8. Maliyet ve Altyapı

<Somut bulgular (varsa) + aktif üçüncü-taraf servis tablosu + amaçları.
Planlanan/aspirational bütçe ile gerçek harcamayı birbirine karıştırma.>

## 9. Ekip

<Git/GitHub contributor verisi + iç dokümanlardaki isimlerle çapraz kontrol;
eşleşmiyorsa "doğrulanamadı" de.>

## 10. Riskler

<Numaralı liste. Her risk: gözlem + neden risk + (varsa) mevcut azaltım.>

## 11. Bu Oturumda Erişilemeyen / Doğrulanamayan Bilgiler

<Hangi kaynağa erişilemedi (ör. Vercel MCP OAuth), hangi rakam dolaylı/iç
dokümana dayanıyor, hangi event/isimlendirme belirsiz. Bu bölüm zorunludur —
raporun neyi *bilmediğini* açıkça söylemesi, bildiğini iddia ettiği kadar
önemli.>

---

*Bu rapor; bu repodaki kod ve Git geçmişi, Remnus workspace'indeki iç planlama
sayfaları ve PostHog/GitHub'dan çekilen canlı verilerin sentezidir. Donmuş
planlama dokümanlarındaki rakamlarla bu raporun kendi canlı sorgu sonuçlarını
karıştırma — hangisinin hangi tarihe ait olduğunu belirt.*
