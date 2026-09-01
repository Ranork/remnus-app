# Feature: Toplu silme/taşıma + Geri alma (çöp kutusu)

**Kaynak:** Remnus'un en aktif kullanıcısı (Mitch, ~3.700 MCP çağrısı) 2026-08-31 mailinde:

> "Another suggestion for you is **bulk actions in the API** - like bulk updating a property
> e.g 'review' to 'done', and **bulk deletions**.
>
> For long running projects, the task boards end up with a lot of finished tasks marked 'done',
> which can clog up context when working with active tasks. My solution has been creating a clone
> of the main task board called 'Archive', and periodically migrating cards into Archive, then
> deleting from the main task board. **This has to be done one by one at the moment**, so I've
> written a script and a skill to automate it."

**Üç ayrı görev.** Sırayla sevk edilmeli:

| | Görev | Zorluk | Neden bu sırada |
|---|---|---|---|
| **A** | Toplu silme + toplu taşıma | Düşük | Talep edilen şey bu |
| **B** | Çöp kutusu (silinenlerin geri alınması) | Düşük-orta | A'nın güvenlik ağı, A'dan önce veya birlikte gitmeli |
| **C** | İçerik sürümleri (insan + ajan düzenlemeleri) | **Orta-yüksek** | Tasarım kararı gerektiriyor, ayrı ele alınmalı |

A ve B birlikte sevk edilebilir. **C ayrı bir görevdir**, çünkü blok editörün sürekli kayıt
davranışı yüzünden "sürüm" tanımının kendisi bir tasarım problemi.

---

# A. Toplu silme ve toplu taşıma

Yeni iki write tool: `bulk_delete_pages`, `bulk_move_items`. Tool sayısı **22 → 24**.

## A.1 En kritik madde: kısmi başarısızlık gürültülü olmalı

Mevcut `bulk_update_pages`'in kendi açıklaması şunu itiraf ediyor:

> *"Updates run concurrently and are NOT atomic: if one entry fails the call returns an error,
> but entries that already succeeded stay applied and the error does not say which ones."*

Ve aynı kullanıcı, aynı mailde, bunun gerçek hayattaki sonucunu bildirdi:

> *"A batch update of 11 rows was lost when the connection dropped during the call. **Nothing
> surfaced as a failure, so the work looked done when it was not.**"*

**Yeni tool'lar bu deseni kopyalamayacak.** Zorunlu davranış:

- Yanıt **her zaman** öğe başına sonuç döndürür: `{ id, ok: boolean, error?: string }`
- Bir öğe patlarsa çağrı tümden hata dönmez; başarılılar `ok: true`, başarısızlar `ok: false` + sebep
- Yanıtın başında özet: `{ requested, succeeded, failed }`
- Ajan böylece neyin yapılmadığını **kesin** bilir ve yalnızca onları yeniden dener

Fırsat varken `bulk_update_pages`'i de aynı sözleşmeye taşımak mantıklı, ama bu ayrı bir karar —
mevcut çağıranları bozabilir. Kapsam dışı bırakıldı, ayrı görev olarak değerlendirin.

## A.2 `bulk_delete_pages`

- `delete_page`'in **preview/confirm desenini birebir izler**: `confirm` yoksa ne silineceğinin
  önizlemesini döndürür (başlıklar + sayı), gerçekten silmez
- `confirm: true` ile siler
- `destructiveHint: true` annotation
- Üst sınır koyun (örn. tek çağrıda 100 öğe). Sebep hem güvenlik hem yanıt boyutu
- **Silme yan etkileri tek tek çalışmalı**, toplu diye atlanmamalı: `syncPageLinks`,
  `purgeReferencesTo`, `removePageLinksFor` ve tombstone yazımı. Bunlar `AI.md`'de kritik
  konvansiyon olarak geçiyor; hızlandırmak için kısa devre yapılırsa link grafiği bozulur

## A.3 `bulk_move_items`

Burada tek gerçek tasarım sorusu var ve cevabı spec'in yazarına bırakılmıyor:

Mitch'in kullanımı **database satırlarını bir board'dan diğerine taşımak.** Mevcut `move_item`
sidebar hiyerarşisinde taşıma yapıyor; satırı başka bir database'e taşımak farklı bir iş, çünkü
hedef database'in **şeması farklı olabilir.**

**Karar: şema uyuşmuyorsa reddet.**

- Hedef database'in kolonları kaynağınkini karşılamıyorsa taşıma yapılmaz
- Hata mesajı hangi kolonların eşleşmediğini **isimleriyle** söyler
- Sessizce property düşürmek yasak — veri kaybı olur ve fark edilmez

Arşiv kullanımında iki board aynı şablondan klonlandığı için bu kısıt sorun çıkarmaz, ama
yanlışlıkla yapılan taşımayı durdurur.

---

# B. Geri alma: çöp kutusu ve ajan geri dönüşleri

## B.1 Neden yeni bir tablo, neden soft-delete değil

`deleted_items` tablosu zaten var ama **mezar taşı**: id, tip, başlık, tarih. İçerik yok, yani
geri yükleme yapılamaz. Delta-sync için tasarlanmış, kurtarma için değil. Ona dokunmayın.

**Soft-delete (`deleted_at` kolonu + her sorguya filtre) YAPILMAYACAK.** Gerekçe: koddaki her
sorgunun gözden geçirilmesini gerektirir ve **tek bir unutulan sorgu silinmiş içeriği sızdırır.**
Riski büyük, yüzeyi geniş.

**Yapılacak: ayrı bir `page_snapshots` tablosu.** Silme anında içeriğin tam kopyası oraya yazılır,
ardından bugünkü silme aynen çalışır. Mevcut hiçbir sorgu değişmez, sızma riski sıfır.

## B.2 `page_snapshots`

Tek tablo, `reason` alanı amacı ayırır. **B görevinde yalnızca `delete` yazılır**; `update`
satırları C görevinde devreye girer, ama tabloyu baştan ikisini kaldıracak şekilde kurun.

| `reason` | Ne zaman yazılır | Geri yükleme | Görev |
|---|---|---|---|
| `delete` | Bir sayfa/satır silinirken | Kaydı yeniden oluştur | **B** |
| `update` | İçerik üzerine yazılırken | İçeriği geri yaz | **C** |

Taşıması gerekenler: workspace, orijinal id, tip, başlık, içerik, properties, nerede durduğu
(parent/database/sıra), kim sildi/değiştirdi (insan mı ajan mı + **denormalize görünen ad**,
`page_comments`'taki gibi — token iptal edilince atıf kaybolmasın), zaman, ve içerik hash'i
(bkz. C.3).

**Saklama: 30 gün.** Temizlik mevcut günlük cron'a eklenir, yeni zamanlayıcı kurmayın.

## B.3 Geri yüklemeyi kim yapar

**İnsan. Ajan yapamaz.**

Ajan çöp kutusunu okuyamaz, geri yükleyemez. Sebep: bir insanın bilerek sildiği şeyi ajanın
diriltebilmesi, silmenin kendisini anlamsızlaştırır. Aynı gerekçe `page_comments`'ta ajan
yorumlarının değiştirilemez olmasında da geçerliydi.

**Bu sürümde çöp kutusu için MCP tool'u eklenmiyor.** Tool sayısı 24'te kalır.

## B.4 Arayüz

- Workspace ayarlarında **"Çöp kutusu"** görünümü: son 30 günde silinenler, başlık + tip + kim +
  ne zaman, ve "Geri yükle" aksiyonu
- Geri yükleme öğe hâlâ mevcut bir hedefe dönebiliyorsa çalışır; ebeveyn/database silinmişse
  kullanıcıya net söylenir, sessizce köke atılmaz

---

# C. İçerik sürümleri — insan ve ajan düzenlemeleri

**Bu ayrı bir görevdir. A ve B sevk edildikten sonra ele alın.**

Kapsam B'den farklı: orada silinen bir şeyi geri getiriyoruz, burada **var olan bir sayfanın
önceki içeriğine dönmek** istiyoruz. Ve buradaki asıl zorluk teknik değil, tanımsal.

## C.1 Asıl problem: "sürüm" nedir

Blok editör sürekli otomatik kayıt yapıyor. Her kayıtta sürüm üretilirse:

- Bir sayfa için günde yüzlerce, birbirinden 3 saniye farklı kayıt oluşur
- Depolama patlar
- Ve daha kötüsü: **liste işe yaramaz.** 200 satırlık, hepsi aynı görünen bir geçmişten kimse
  aradığını bulamaz

Yani soru "nasıl kaydederiz" değil, **"neyi bir sürüm sayarız".**

## C.2 Gerçek ihtiyaç ne

Tarayıcı zaten oturum içinde Ctrl+Z veriyor. İnsanın kaybettiği şey o değil. Kaybolan şey:

> Sekmeyi kapattım, ertesi gün açtım, dünkü hali daha iyiydi.

Yani **insan için ihtiyaç oturumlar arası kurtarma**, ince taneli undo değil. Bu, tasarımı
doğrudan belirliyor.

## C.3 Önerilen kural: oturum + büyüklük eşiği

Kaydetme anında, **yeni içeriği değil üzerine yazılacak önceki içeriği** anlık görüntüle — ve
yalnızca şu iki koşuldan biri sağlanıyorsa:

**1. Zaman boşluğu.** Bu sayfanın son anlık görüntüsünden bu yana **10 dakikadan fazla** geçtiyse.
Kesintisiz yazma tek sürüm üretir; ertesi gün dönüş yeni sürüm üretir.

**2. Büyüklük.** Son anlık görüntüden bu yana içerik **%30'dan fazla değiştiyse**, süre dolmamış
olsa bile. Bu, "yarısını sildim ve yazmaya devam ettim" senaryosunu yakalar.

Ek olarak, her iki durumda da:

**3. İçerik hash'i aynıysa hiç yazma.** Otomatik kayıt çoğu zaman değişiklik olmadan tetikleniyor.
Hash karşılaştırması bu boş sürümleri baştan eler. Bu yüzden `page_snapshots` içerik hash'i tutmalı.

Bu üçlü, günlük aktif bir sayfada **3-8 sürüm** üretir, 300 değil.

**Ajan yazmaları farklı:** her MCP yazması ayrı bir sürüm üretir, debounce yok. Gerekçe: ajan
yazmaları tuş vuruşu değil, ayrık ve kasıtlı eylemler. Zaten seyrekler.

## C.4 Depolama sınırı — bu ciddiye alınmalı

Tipik bir sayfa gövdesi 2-10 KB. Sayfa başına 20 sürüm tutulursa sayfa başına 40-200 KB.
Aktif bir workspace'te bu hızla büyür.

Zorunlu sınırlar, üçü birden:

- **Sayfa başına son 20 sürüm.** Yeni geldiğinde en eski düşer.
- **30 gün.** Cron ile temizlenir.
- **Workspace başına toplam anlık görüntü boyutu üst sınırı.** Aşılırsa en eskiden başlayarak
  düşürülür. Değeri belirleyin ve `AGENTS.md`'ye yazın.

Anlık görüntüler kullanıcının depolama kotasına (`storageBytes`) **sayılmaz** — o kota yüklenen
dosyalar için. Ama şirkete maliyeti var, o yüzden sınırlar isteğe bağlı değil.

**Diff saklama düşünülmedi mi:** Düşünüldü, v1'de yapılmıyor. Diff çok daha küçük ama geri
yükleme zincir oynatmayı gerektiriyor ve zincirin bir halkası bozulursa hepsi gider. Tam içerik +
sıkı sınır, v1 için daha güvenli. Depolama gerçekten problem olursa sonradan optimize edilir.

## C.5 Uygulama notları

- **Anlık görüntü sunucu tarafında, kayıt sınırında alınır.** İstemciden gönderilmez, atlanamaz.
- **Önceki içerik saklanır, yeni içerik değil.** Bu ters yapılması çok kolay bir hata.
- Otomatik kayıt yolunun nerede olduğunu bulun (server action). Hem web kaydı hem MCP yazması
  aynı anlık görüntü fonksiyonundan geçmeli, yoksa iki farklı davranış çıkar.
- Anlık görüntü yazımı **kaydı bloklamamalı.** Başarısız olursa kullanıcının kaydı yine de geçer,
  hata sessizce loglanır. Yedekleme mekanizması asıl işi engellemez.

## C.6 Arayüz

- Sayfa üzerinde "Geçmiş" girişi: tarih, kim (insan adı veya ajan adı), kısa bir değişim göstergesi
  (örn. "+240 / −1.100 karakter")
- Bir sürüme tıklayınca önizleme, "Bu sürüme dön" aksiyonu
- **Geri dönmek de bir sürüm üretir.** Yani geri alma da geri alınabilir olmalı.
- Diff/karşılaştırma görünümü **bu sürümde yok** — önizleme yeterli, diff ayrı bir iş

---

# Ortak gereklilikler

## Tool sayısı senkronu: 22 → 24

Bu liste kaçırılırsa doküman aylarca yanlış kalıyor (26 Ağustos'ta bir kez oldu):

- `README.md` — özellik maddesi + `## MCP Tools` tablosu
- `src/components/marketing/LandingTools.tsx` — `TOOLS` dizisi
- `Landing.bridgeToolsH2Part1` + `bridgePricingSelfF3` — **8 locale**
- `docs/mcp/README.md`, `docs/mcp/write-tools.md`
- `docs/WHAT_IS_REMNUS.md` + `docs/REMNUS_NEDIR.md` — hızlı referans tablosu
- `docs/blog/remnus-vs-*.md` — metinde geçen ham sayılar
- `mcpb/manifest.json`
- `skills/remnus/SKILL.md`

## Migration

Sıradaki numara **0047** (0045 comments, 0046 refresh-rotation kullanıldı). `when` değeri için
`AGENTS.md` → Migration Notes'un **sonundaki güncel eşiği** oku, bu dosyadan kopyalama.

Idempotent yaz, **hem local hem Turso'ya uygula**, deploy'dan **önce** production'a uygula.

## i18n

Yeni key'ler 8 dosyaya birden. `en.json` doğruluk kaynağı. Çöp kutusu arayüzü ve toplu işlem
onay metinleri için gerekli.

## Changelog

`src/lib/changelog.ts` başına iki ayrı kayıt (ikisi de kullanıcı-görünür):
- Toplu silme/taşıma
- Çöp kutusu / geri alma

Tek cümle, müşteri dili, 8 locale.

---

# Kapsam dışı — bu sürümde YAPILMAYACAK

- **Soft-delete** (`deleted_at` + global sorgu filtresi). Gerekçe B.1'de.
- **Diff / karşılaştırma görünümü.** Sürüm önizlemesi var, iki sürümü yan yana gösteren arayüz yok.
- **Blok seviyesinde sürümleme.** Sürüm sayfanın tamamıdır, tek bir bloğun geçmişi tutulmaz.
- **Eşzamanlı düzenleme çakışma çözümü.** İki kişi aynı anda yazarsa ne olacağı bu işin konusu değil.
- Çöp kutusu için MCP tool'u
- Ajanın geri yükleme yapabilmesi
- Anlık görüntülerin diff olarak saklanması (bkz. C.4, sonradan optimize edilebilir)
- `bulk_update_pages`'in yanıt sözleşmesini değiştirmek (ayrı görev, mevcut çağıranları bozabilir)
- Şema uyuşmazlığında otomatik property eşleme/dönüştürme
- Çöp kutusunda arama
- Saklama süresini plana göre değiştirmek

Bunlardan biri gerekiyorsa ayrı talep olarak gelsin.

---

# Kabul kriterleri

1. `bulk_delete_pages` `confirm` olmadan silmez, önizleme döndürür
2. Bir öğe başarısız olduğunda yanıt **hangisinin** başarısız olduğunu ve sebebini söyler; başarılılar uygulanmış kalır
3. Read-scope token her iki yeni tool'da da reddedilir
4. Strict modda `contextRunId` olmadan reddedilir
5. Toplu silmede link/tombstone yan etkileri her öğe için çalışır
6. `bulk_move_items` şema uyuşmazlığında taşımaz ve eksik kolonları isimleriyle söyler
**B (çöp kutusu):**

7. Silinen bir sayfa çöp kutusunda görünür ve geri yüklenebilir
8. Ajan çöp kutusuna hiçbir MCP yolundan erişemez
9. Ebeveyni silinmiş bir öğe geri yüklenmeye çalışılırsa kullanıcıya net söylenir
10. 30 günden eski kayıtlar cron ile temizlenir
11. Migration iki kez çalıştırılınca hata vermez

**C (sürümler):**

12. Editörde kesintisiz 10 dakika yazmak **tek** sürüm üretir, her otomatik kayıt için bir tane değil
13. 10 dakikalık aradan sonra yapılan ilk düzenleme yeni sürüm üretir
14. İçeriğin %30'undan fazlası silinirse, süre dolmamış olsa bile sürüm üretilir
15. İçerik değişmeden tetiklenen otomatik kayıt **hiç** sürüm üretmez (hash eşleşmesi)
16. Her MCP yazması bir sürüm üretir (debounce yok)
17. Bir sayfada 20'den fazla sürüm birikmez, en eski düşer
18. Bir sürüme geri dönmek de yeni bir sürüm üretir (geri alma geri alınabilir)
19. Anlık görüntü yazımı başarısız olursa kullanıcının kaydı yine de tamamlanır

# Doğrulama

```
npm run lint -- <değişen dosyalar>
npx tsc --noEmit
```

Toplu silmeyi **önce local'de, gerçek veriyle** dene. Geri yüklemenin çalıştığını görmeden
production'a gitmeyin: kurtarma yolu bozuk bir çöp kutusu, çöp kutusu olmamasından kötüdür —
kullanıcı güvenip siler.
