# Takvimde Tekrarlayan Kartlar — Tasarım Araştırması

Durum: Öneri (henüz uygulanmadı) · Hazırlayan: Claude · Tarih: 2026-08-18

## 1. Bağlam: Remnus'un takvimi neden özel bir durum

Mevcut model (kod üzerinden doğrulandı):

- Takvim kartı = `pages` tablosunda gerçek bir satır; `properties[dateCol]` değeri kartı güne yerleştirir.
- Tarih formatları: `YYYY-MM-DD`, `YYYY-MM-DDTHH:mm`, aralık için `start/end`
  (`CalendarView.getPagesForDay`, `formatDateValue`).
- Her satır aynı zamanda **içerik taşıyan bir sayfadır**: gövde metni, alt öğeler
  (`workspace_items.parentId`), sayfa linkleri (`page_links`), ajan düzenleme izi
  (`agentEditedAt`), MCP üzerinden okunabilirlik.
- Ayrı bir `events` tablosu yok. `rrule` gibi bir bağımlılık yok ve paket kurulmayacak.

Son madde tüm tasarımı belirliyor: Google Calendar'da bir tekrar örneği neredeyse boştur,
silinip yeniden üretilmesi zararsızdır. **Remnus'ta gelecekteki bir örneğin içi çoktan
doldurulmuş olabilir.** Kullanıcının belirttiği senaryo tam olarak budur.

## 2. Üç mimari seçenek

### A) Sanal genişletme (RFC 5545 / Google Calendar modeli)

Tek bir "master" kayıt RRULE tutar; örnekler görünen pencere için anlık hesaplanır.
İstisnalar `RECURRENCE-ID` ile override kaydı, silmeler `EXDATE` olarak saklanır.

- (+) Sonsuz seri, O(1) depolama, kural değişimi anında tüm geleceği etkiler.
- (−) Örneğin `page.id`'si yoktur: içerik yazılamaz, link verilemez, ajan okuyamaz,
  sürüklenemez, filtre/sıralama farklı davranır. **Remnus'un "her satır bir sayfadır"
  modelini kırar.** Tek başına kullanılamaz.

### B) Materyalizasyon (Notion tekrarlı şablon, Todoist, Asana)

Örnekler önceden gerçek satır olarak üretilir.

- (+) Her örnek gerçek sayfa: içerik, link, MCP, ajan, filtre, export hepsi bedavaya çalışır.
  Okuma yollarında **sıfır değişiklik** gerekir.
- (−) Depolama; kural değişimi gelecekteki satırların yeniden yazılmasını gerektirir;
  ufuk (horizon) + tazeleme işi ister.

### C) Tembel materyalizasyon (hibrit)

Seri sanaldır; kullanıcı bir örneğin içine yazdığı an gerçek satıra "katılaşır".

- (+) Depolama az.
- (−) İkili durum: hayalet kartlar sürüklenemez, linklenemez, ajan tarafından bulunamaz.
  Kullanıcıya açıklaması zor. v1 için önerilmiyor; "her gün · 5 yıl" gibi uç kullanımlar
  sorun çıkarırsa ileride kaçış kapısı olarak durur.

### Öneri: B + A'nın semantiği

**Materyalize edilmiş örnekler, bir seri kaydına bağlı.** Depolama ve okumada B,
düzenleme/silme semantiğinde A (RRULE, RECURRENCE-ID, EXDATE, THISANDFUTURE).

## 3. Kullanıcının asıl isteği: THISANDFUTURE bölme (split)

> "1 hafta öncesinden her gün dedim, kartlar oluştu. Bugün haftada bire çevirmek istiyorum;
> önceki günlükler bozulmasın."

Doğru semantik **seriyi ikiye bölmek**tir. Google Calendar'ın "Bu ve sonraki etkinlikler"
seçeneği tam olarak böyle çalışır:

1. Mevcut seri, düzenlenen örneğin bir gün öncesinde **kapatılır** (`UNTIL = occurrence − 1`).
   Geçmişte üretilmiş kartlar hiç dokunulmadan eski seriye bağlı kalır.
2. Düzenlenen örnekten başlayan **yeni bir seri** yeni kuralla oluşturulur
   (`parentSeriesId` ile eskisine bağlanır).
3. Eski serinin bu tarihten sonraki materyalize kartları temizlenir — *kirli olanlar hariç*
   (bkz. §4).
4. Yeni seri ileriye doğru materyalize edilir.

Bölmenin kritik faydası: **geçmiş, tasarım gereği değişmez hale gelir.** "Bu kart kural
değişmeden önce mi sonra mı üretildi?" sorusunu hiç sormak zorunda kalmazsınız; geçmiş
kendi donmuş kuralına sahip ayrı bir nesneye aittir. Arayüzde de anlatılabilir olur:

    Günlük · 3 Ağu'ya kadar   →   Haftalık · 10 Ağu'dan itibaren

## 4. Kirli örnek koruması (Remnus'u farklılaştıran kısım)

Bir örnek şu koşullardan **herhangi biri** sağlanıyorsa *kirli / özelleştirilmiş* sayılır:

- `content !== ''` (gövdeye yazılmış)
- Başlık, serinin şablon başlığından farklı
- `properties`, şablondan farklı (tarih hariç)
- Altında `workspace_items` var (alt sayfa)
- Gelen/giden `page_links` var
- `agentEditedAt` dolu (bir ajan dokunmuş)
- `occurrenceDate` ile güncel tarih uyuşmuyor (elle taşınmış)
- Durumu `complete` grubunda (tamamlanmış iş)

Yeniden üretim davranışı:

| Örnek | Davranış |
|---|---|
| Gelecekteki temiz kart | Sessizce silinir, yeni ritimde yeniden üretilir |
| Gelecekteki kirli kart | **Seriden koparılır (detach), yerinde bırakılır** — içerik asla kaybolmaz |
| Geçmişteki her kart | Asla dokunulmaz |

Onay diyaloğunda tek satır özet: *"3 gelecek kartın içi doldurulmuş. Onlar olduğu gibi
kalacak, seriden çıkarılacak."* + 10 saniyelik geri alma.

Tek cümleyle: **hiçbir seri işlemi kullanıcı emeğini sessizce yok etmez.**

## 5. Silme kapsamları (kullanıcının istediği üçlü)

| Seçenek | Etki |
|---|---|
| **Bu görevi sil** | Satır silinir + `exDates`'e occurrence tarihi eklenir (tazeleme işi geri getirmesin) |
| **Bundan sonraki görevleri sil** | `UNTIL = occurrence − 1`; sonraki kartlar silinir, kirli olanlar §4'e göre korunur |
| **Tüm görevleri sil** | Seri + geçmiş/gelecek tüm kartlar; `recordDeletionTombstone` yazılır, sayı önceden gösterilir |

Onay metni her zaman sayı içermeli: *"38 kart silinecek · 6'sının içi dolu."*

## 6. Düzenleme kapsamları

Aynı üçlü şu alanlar için geçerli: tarih/saat, tekrar kuralı, başlık, özellikler
(durum, atanan kişi…), ikon.

Öneri: **Kapsam sorusu yalnızca seri-şablonuna ait bir alan değiştiğinde sorulur.**

Gövde içeriği doğası gereği örneğe özeldir → varsayılan "sadece bu". Ancak ikincil bir
eylem sunulur: *"Bu içeriği sonraki kartlara da uygula"* (şablona yaz). Kullanıcının
"gelecek görevlendirmeler yapıp içeriğini dolduruyorlar" senaryosu doğrudan bunu ister.

## 7. Kural modeli

RFC 5545 alt kümesi, **string değil JSON** olarak saklanır — kod tabanı zaten
`properties`/`schema`/`views` için JSON kullanıyor ve JSON, MCP/ajan tarafında okunabilir.

```ts
export interface RecurrenceRule {
  freq: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number;                 // 1 = her, 2 = iki ...de bir
  byWeekday?: Weekday[];            // haftalık: ['MO','WE','FR']
  monthlyMode?: 'dayOfMonth' | 'nthWeekday' | 'lastDay';
  byMonthDay?: number;              // ayın 15'i
  bySetPos?: -1 | 1 | 2 | 3 | 4;    // "3. Salı", "son Cuma"
  byMonth?: number;                 // yıllık: 1-12
  skipWeekends?: 'none' | 'next' | 'prev';
  end:
    | { type: 'never' }
    | { type: 'onDate'; date: string }
    | { type: 'afterCount'; count: number };
  startDate: string;                // DTSTART
  exDates: string[];                // silinmiş tekil örnekler
  timezone?: string;                // IANA (ileride sunucu tarafı iş için)
}
```

Motor ~200 satır saf fonksiyon: `expand(rule, from, to): string[]`. `rrule` paketi (~40 kB)
gereksiz; zaten paket kurmuyoruz.

### Arayüzde sunulacak hazır seçenekler ("tamamı" dediği kısım)

- Tekrarlama yok
- Her gün
- Hafta içi her gün (Pzt–Cum)
- Haftada bir — {haftanın günü}
- İki haftada bir — {gün}
- Ayda bir — ayın {N}. günü
- Ayda bir — {N}. {gün} (ör. 3. Salı)
- Ayın son {gün}ü / ayın son günü
- Yılda bir — {tarih}
- **Özel…** → tam kurgulayıcı (aralık + sıklık + gün çipleri + aylık mod + bitiş koşulu)

Seçicinin altında her zaman **doğal dil özeti**: *"Her 2 haftada bir Salı ve Perşembe,
12 Ara 2026'ya kadar."* Karmaşık kuralı basit hissettiren şey budur; ICU mesajı olarak
8 locale'e yazılır.

## 8. Veri modeli

**Öneri: ayrı tablo + `pages` üzerinde üç sistem kolonu.**

```
recurrence_series (
  id, database_id, date_col_id,
  rule                json,   -- §7
  template            json,   -- title, properties, icon, iconColor, content
  materialized_until  text,
  parent_series_id    text,   -- THISANDFUTURE bölmesi bunu doldurur
  created_by, created_at, updated_at
)
```

```
pages.series_id        text     null   -- index
pages.occurrence_date  text     null   -- RECURRENCE-ID (üretildiği tarih)
pages.series_detached  integer  0      -- kirli olduğu için koparılmış
```

`properties` JSON'una **koymayın**. Gerekçe kod tabanında zaten yazılı: `schema.ts:66-72`,
`cardCollapsed` kolonu için — sistem durumu kullanıcı şemasına sızarsa Table kolonlarına,
export'a, MCP satır okumalarına ve filtrelere bulaşır. Aynı gerekçe burada birebir geçerli.

`unique (series_id, occurrence_date)` → çift tazeleme kopya üretemez.

Reddedilen alternatif: kuralı tarih değerinin içine gömmek (`2026-08-18|RRULE:FREQ=DAILY`) —
mevcut tüm tarih ayrıştırıcılarını (`formatDateValue`, `getPagesForDay`, filtreler, MCP,
Notion import) kırar ve seri kimliğini ifade edemez.

## 9. Materyalizasyon ufku ve tazeleme

- Ufuk: `max(bugün + 90 gün, görünen takvim penceresinin sonu)`; seri başına sert üst sınır
  **500 örnek** (mevcut `MAX_BULK_ROWS = 500` ile aynı ölçek).
- Tetikleyiciler (ikisi birden; yeni altyapı gerekmiyor):
  1. **Okumada** — takvim `materialized_until`'ın ötesini isterse server action tazeler.
     Kendi kendini onaran, cron'a bağımlı olmayan yol; Docker self-host için de çalışır.
  2. **Vercel cron** — projede zaten var; gecelik iş, uygulamayı açmayan kullanıcılar için.
- Oluşturma diyaloğunda önizleme: *"Her gün · süresiz → 90 günlük pencerede 90 kart."*
- Plan limitleri: Free çalışma alanı 5.000 satır üretememeli; tier başına tavan konmalı.

## 10. Arayüz yüzeyleri (dosya bazında)

| Yüzey | Yer |
|---|---|
| Tekrar seçici | `DateRangePicker.tsx` altına "Tekrarla: Tekrarlama yok ▾" satırı |
| Kart rozeti | `CalendarView` / `KanbanBoard` / `TableLayout` başlığında ⟳; kopuk örnekte üstü çizili variant |
| Kapsam diyaloğu | Yeni `RecurrenceScopeDialog.tsx` — `ConfirmDialog` dilinde, 3 radyo + canlı etki satırı |
| Seri paneli | Sayfa peek/full görünümünde: "Her hafta Salı · 8 Eki'den beri · 24 kart" + Seriyi düzenle / Seriden çıkar |
| Layout ayarı | `CalendarLayoutSection.tsx` — tekrarı hangi tarih kolonu sürükler (varsayılan `dateCol`) |

## 11. Kenar durumlar

- **Ayın 31'i, 30 günlük ay:** `dayOfMonth` modunda ayı **atla** (RFC/Google davranışı).
  Sıkıştırma isteyen için ayrı `lastDay` modu var.
- **29 Şubat:** aynı atlama kuralı.
- **DST:** tarihler yerel duvar saati string'i olarak saklanıyor (`YYYY-MM-DDTHH:mm`,
  zaman dilimi yok) → 09:00 yaz saatinde de 09:00 kalır; kullanıcı beklentisiyle uyumlu.
  `timezone` alanı yalnızca ileride sunucu tarafı iş için saklanır.
- **Aralıklar (`start/end`):** tekrar **süreyi** taşır, bitiş tarihini değil.
- **`sortOrder`:** yeni örnekler sona eklenir; gün içi sürükleme örneğe özeldir.
- **Filtre/sıralama:** etkilenmez — örnekler gerçek satırlar.
- **MCP / ajanlar:** `create_page` / `update_page` araçlarına `recurrence` girdisi;
  bir ajan "her Pazartesi standup kartı aç" diyebilmeli. Ajan bir seri satırını güncellerken
  **seriye ait olduğu bilgisini almalı** ve yazma kapsamını seçebilmeli. İnsan–ajan eşitliği
  Remnus'un ana iddiası; burada somutlaşır.
- **OKF export/import:** kural dışa aktarımda taşınmalı; Notion import'un tekrarlı şablonları
  eşlenmeli.
- **Çöp kutusu:** seri silmede `recordDeletionTombstone` yazılmalı, restore akışı bozulmamalı.
- **Realtime:** her seri işleminden sonra `publish({ scope: 'database' })`.
- **Geri alma:** seri işlemleri ~10 sn toast ile geri alınabilir olmalı.

## 12. Yapılmaması gerekenler

- Yıllar öncesinden satır üretmek (ufuk + tavan zorunlu).
- Geçmiş kartları sessizce değiştirmek.
- Tekrarı `properties` JSON'una gömmek.
- `rrule` paketi eklemek.
- Sanal örnekleri gerçek kart gibi göstermek (sürüklenemeyen hayalet kart).

## 13. Aşamalar

**Faz 1 — çekirdek**
Kural modeli + genişletme motoru + `recurrence_series` migration + materyalizasyon +
tekrar seçici + kart rozeti + **3 seçenekli silme** + tarih/kural için "bu / bu ve sonrakiler".

**Faz 2 — koruma ve yayılım**
Kirli örnek tespiti ve detach, özellik/başlık/içerik yayılımı (kapsamlı), seri paneli,
geri alma toast'u.

**Faz 3 — çevre**
MCP `recurrence` girdisi, OKF export/import, cron tazeleme, plan bazlı tavanlar,
hafta sonu atlama, 8 locale doğal dil özeti.
