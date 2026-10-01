import type { SampleText } from '../types';

const text: SampleText = {
  workspaceName: (userName) => `${userName} Çalışma Alanı`,
  personalWorkspace: 'Kişisel Çalışma Alanı',
  demoWorkspace: 'Demo Çalışma Alanı',
  demoUserName: 'Demo Kullanıcı',
  agentTokenName: 'Claude AI Ajanı',

  startHere: {
    title: 'Buradan Başla',
    content: `### Herkese merhaba!

AI ajanlarıyla bir şey geliştirirken **Remnus'un** projeyi kontrol altında tutmamıza **nasıl yardım ettiğini** göstermek için *örnek proje olarak Microsoft Paint'in basit bir klonunu* yapıyorum.

Burada gördüğün her şeyi *Claude Code* ve *Remnus* yan yana çalışarak hazırladı!

<div data-yt-id="OVi9pjY_p84"></div>

**Bu çalışma alanının nasıl kurulduğunu görmek için videoyu izle!**

<div data-callout-icon="⚡" data-callout-color="blue" data-callout-text="Sprint Tahtası'nda ajan rozeti taşıyan her satırı MCP üzerinden gerçek bir AI ajanı yazdı. Canlı etkinlik kaydını görmek için sol alttaki AI Ajanlarım panelini aç."></div>

### AI ajanı gerçekte ne yaptı

Bu çalışma alanını kuran gerçek oturumun izi, doğrudan Remnus'un ajan denetim kaydından:

| Ne zaman | Eylem | Ne oldu |
|----------|-------|---------|
| Bağlandı | \`list_workspace\` | Ajan yönünü bulmak için çalışma alanını taradı |
| Planlama | \`create_page\` | Paint klonu için **Ürün Tanımı**'nı yazdı |
| Kurulum | \`create_database\` | Tanımdan **Sprint Tahtası**'nı oluşturdu |
| İş listesi | \`create_page\` ×16 | Her görevi kendi kabul kriterleriyle üretti |
| Geliştirme | \`update_page\` | *iskelet*, *fırça* ve *silgi* görevlerini tamamladıkça **Bitti** yaptı |
| Gözden geçirme | \`query_database\` | Sıradaki görevi seçmek için tahtayı yeniden okudu |
| Sürüyor | \`update_page\` | *çizgi aracı*nı **Devam ediyor**'a taşıdı |

Hikâyenin tamamını yazılı olarak mı okumak istersin? Aşağıdaki sayfayı aç 👇

{{HOW_BUILT_CB}}
`,
  },

  howBuilt: {
    title: 'Bu Nasıl Kuruldu',
    content: `Bu çalışma alanı elle doldurulmadı. Bir AI ajanı (**Claude Code**) Remnus'a **MCP** üzerinden bağlandı ve her şeyi kendisi kurdu: tanımı, görev tahtasını ve ilerleme takibini. Bir insan da bunların hepsini gerçek zamanlı izledi.

Bu sayfa, **Buradan Başla**'daki videonun yazılı eşi: aynı hikâye, kendi hızında okuyabileceğin biçimde.

## İş akışı

1. **Bağlan:** Ajan bu çalışma alanına bir MCP tokenıyla kimlik doğruladı ve burada neler olduğunu görmek için \`list_workspace\` çağırdı.
2. **Planla:** Tarayıcıda çalışan bir Paint klonu için bir **Ürün Tanımı** yazdı (kenar çubuğundan açabilirsin).
3. **Parçalara ayır:** Bu tanımdan **Sprint Tahtası** veritabanını oluşturdu ve her biri kendi kabul kriterleri ve notlarıyla **16 görev** üretti.
4. **Geliştir ve takip et:** Özellikleri yazdıkça görevleri tahtada ilerletti (\`Bekleyen → Devam ediyor → Bitti\`) ve yaptığı işi her görevin sayfasına geri yazdı.
5. **Senkron kal:** Bir insan istediği an araya girip her şeyi düzenleyebilir; ajan bir sonraki sorgusunda yeni durumu görür. Kopyala-yapıştır yok, bağlam kaybı yok.

## İşaretler nasıl okunur

Remnus ajanın işini **görünür ve denetlenebilir** kılar. Başka araçlarda görmediğin kısım bu:

<div data-callout-icon="⚡" data-callout-color="blue" data-callout-text="Bir satırdaki ajan rozeti, onu en son bir AI ajanının düzenlediği anlamına gelir. Değişikliği hangi tokenın ne zaman yaptığını görmek için üzerine gel."></div>

- **⚡ ajan rozeti:** Bir ajanın dokunduğu her Sprint Tahtası satırı işaretlenir. Neyi bir insanın, neyi bir makinenin yazdığını her zaman bilirsin.
- **AI Ajanlarım paneli:** Kenar çubuğunun sol altındaki **AI Ajanlarım**'a tıkla. Her tokenı, kapsamını ve son araç çağrılarının canlı kaydını (\`create_page\`, \`update_page\`, \`query_database\`…) görürsün.

## Kendin dene

Kendi AI ajanını bir dakikadan kısa sürede kendi çalışma alanına bağlayabilirsin:

1. **Çalışma alanı ayarları → MCP**'yi aç ve bir MCP tokenı oluştur (okuma ya da yazma kapsamı).
2. Remnus'u istemcine (Cursor, VS Code ya da Claude) MCP sunucusu olarak ekle. Uç nokta ve kimlik doğrulama başlığı tokenı oluşturur oluşturmaz gösterilir; tek tıkla kurulum düğmeleri de var.
3. Ajanından bir proje planlamasını, bir veritabanını doldurmasını ya da bir sayfayı özetlemesini iste. Yaptığı her eylem denetim kaydında, işaretli ve geri alınabilir biçimde görünür.

<div data-callout-icon="🔒" data-callout-color="green" data-callout-text="Kontrol sende: tokenların kapsamı vardır, her yazma kaydedilir ve erişimi istediğin an geri alabilirsin."></div>

Remnus'un bütün fikri bu. AI ajanların çalışacak gerçek bir alana kavuşur, sen de yaptıkları her şeyi eksiksiz görmeye devam edersin.
`,
  },

  productSpec: {
    title: 'Ürün Tanımı',
    content: `# Ürün Tanımı: Paint Klonu

Tarayıcıda çalışan sade bir çizim uygulaması. Bağımlılık yok, hesap yok, kurulum gerekmiyor.

## MVP Özellikleri

### Tuval ve çizim

- Serbest fırça / kalem aracı
- Ayarlanabilir fırça boyutu
- Silgi aracı
- Boya kovası (alan doldurma)
- Tuvali temizleme düğmesi

### Renk

- Renk seçici (yerleşik \`<input type="color">\`)
- Hazır renk paleti
- Geçerli rengin önizleme kutusu

### Şekiller

- Çizgi aracı
- Dikdörtgen aracı (kenar + dolgulu)
- Daire / elips aracı (kenar + dolgulu)

### Dosya

- Tuvali PNG olarak kaydetme (indirme)
- Bir görsel dosyasını tuvale yükleme / açma

### Arayüz

- Araç simgeleri olan araç çubuğu
- Sık kullanılan araçlar için klavye kısayolları (B = fırça, E = silgi, F = doldurma vb.)
- Geri alma (tek adımlı ya da geçmiş yığınıyla çok adımlı)

## Kapsam dışı (v1)

- Katmanlar
- Metin aracı
- Bulut kaydı
- Ortak çalışma

`,
  },

  sprintBoard: {
    name: 'Sprint Tahtası',
    columns: { title: 'Başlık', status: 'Durum', priority: 'Öncelik', category: 'Kategori' },
    status: { backlog: 'Bekleyen', inProgress: 'Devam ediyor', done: 'Bitti' },
    priority: { high: 'Yüksek', medium: 'Orta', low: 'Düşük' },
    category: { canvas: 'Tuval', color: 'Renk', shapes: 'Şekiller', file: 'Dosya', ui: 'Arayüz' },
    views: { board: 'Kanban', table: 'Tablo' },
  },

  tasks: {
    scaffold: {
      title: 'Proje iskeletini kur',
      content: `# Proje iskeletini kur

Paint klonu için temel HTML/CSS/JS yapısını oluştur. Çatı ya da derleme aracı yok, yalnızca düz dosyalar.

## Görevler
- [x] \`<canvas>\` öğesi ve araç çubuğu yer tutucusuyla \`index.html\` oluştur
- [x] \`style.css\` oluştur (sıfırlama, kenar çubuğu + tuval alanı düzeni, temel tema)
- [x] \`main.js\` oluştur (giriş noktası, tuval bağlamının başlatılması)
- [x] Tuvalin kullanılabilir alanı doldurduğunu ve doğru yeniden boyutlandığını doğrula

## Kabul kriterleri
- \`index.html\` tarayıcıda açılınca boş bir tuval ve boş bir araç çubuğu görünür ✅
- Yüklenirken konsolda hata yok ✅

## Çıktı

### Oluşturulan dosyalar
- \`index.html\`: \`<main id="canvas-area">\` içinde \`<aside id="toolbar">\` + \`<canvas id="canvas">\` barındıran kabuk
- \`style.css\`: CSS sıfırlama, flex düzeni (56px kenar çubuğu + kalan alanı dolduran tuval), koyu çerçeveli beyaz tuval
- \`main.js\`: tuval bağlamının başlatılması, kullanılabilir alanı dolduran ve pencere yeniden boyutlandığında çizimi \`getImageData\`/\`putImageData\` ile koruyan \`resizeCanvas()\`

### Notlar
- Tuval, her eksende 32px boşluk bırakarak kullanılabilir alana göre boyutlanır ve her \`window.resize\`'da yeniden hesaplanır
- Her yeniden boyutlandırmada beyaz arka plan boyanır; kaydedilen PNG hiçbir zaman saydam olmaz
- Araç çubuğu, sonraki görevlerin ekleyeceği araç düğmelerine hazır dikey bir \`<aside>\`
`,
    },
    brush: {
      title: 'Serbest fırça / kalem aracını yap',
      content: `# Serbest fırça / kalem aracını yap

Kullanıcının fare ya da dokunmayla tuvale serbest çizgiler çizmesini sağla.

## Görevler
- [x] Tuvalde \`mousedown\`, \`mousemove\`, \`mouseup\` olaylarını izle
- [x] Akıcı yollar çizmek için \`ctx.beginPath()\` / \`ctx.lineTo()\` / \`ctx.stroke()\` kullan
- [x] Çizgilere geçerli rengi ve fırça boyutunu uygula
- [x] Fare düğmesi basılı değilken çizimi engelle

## Kabul kriterleri
- Tıklayıp sürüklemek kesintisiz bir çizgi çizer ✅
- Çizginin rengi ve boyutu seçili değerleri yansıtır ✅
- Fareyi bırakmak çizimi durdurur ✅

## Çıktı

### \`main.js\` değişiklikleri
- \`tool\`, \`color\`, \`size\`, \`isDrawing\`, \`lastX\`, \`lastY\` değerlerini tutan bir \`state\` nesnesi eklendi
- \`getPos(e)\`: fare ve dokunma koordinatlarını tuval sınırlarına göre normalleştirir
- \`applyBrushStyle()\`: her çizgiden önce \`strokeStyle\`, \`lineWidth\`, \`lineCap\`, \`lineJoin\`, \`globalCompositeOperation\` ayarlar
- \`onPointerDown\`: başlangıç konumunu kaydeder, tek tıklamada bir nokta çizer
- \`onPointerMove\`: her karede son konumdan geçerli konuma bir çizgi parçası çizer
- \`onPointerUp\` / \`mouseleave\`: çizimi durdurur
- Dokunma olayları (\`touchstart\`, \`touchmove\`, \`touchend\`) fare olaylarının yanına, \`preventDefault\`'a izin vermek için \`passive: false\` ile bağlandı
`,
    },
    eraser: {
      title: 'Silgi aracını yap',
      content: `# Silgi aracını yap

Kullanıcının arka plan rengiyle çizerek tuvalin bölümlerini silmesini sağla.

## Görevler
- [x] Silgi aracını araç çubuğuna ekle
- [x] Silgi etkinken \`ctx.globalCompositeOperation = 'destination-out'\` ayarla
- [x] Silgi genişliği için geçerli fırça boyutunu kullan
- [x] Fırçaya geri dönülünce birleştirme işlemini eski haline getir

## Kabul kriterleri
- Silgi, sürüklenince çizilen içeriği siler ✅
- Silgi boyutunu fırça boyutu kaydırıcısı belirler ✅
- Araç değiştirmek normal çizim davranışını geri getirir ✅

## Çıktı

### \`main.js\` değişiklikleri
- \`applyBrushStyle()\` artık \`state.tool === 'eraser'\` durumuna göre dallanıyor: \`globalCompositeOperation = 'destination-out'\` ayarlıyor ve opak siyah çizgi kullanıyor (alfa kanalındaki pikselleri siler)
- \`onPointerDown\` nokta boyaması da silerken \`destination-out\` uyguluyor, dolgudan sonra birleştirme işlemini sıfırlıyor
- Silgi \`state.size\`'ı fırçayla paylaşıyor, ayrı bir boyut gerekmiyor
- Silgi dışındaki herhangi bir araca geçince bir sonraki çizgide \`applyBrushStyle()\` sayesinde \`source-over\` kendiliğinden geri geliyor
`,
    },
    brushSize: {
      title: 'Ayarlanabilir fırça boyutunu yap',
      content: `# Ayarlanabilir fırça boyutunu yap

Çizgi/silgi genişliğini belirleyen bir kaydırıcı ya da giriş alanı sun.

## Görevler
- [ ] Araç çubuğuna \`<input type="range">\` ekle (en az 1, en çok 64)
- [ ] Geçerli boyut değerini kaydırıcının yanında göster
- [ ] Seçilen boyutu her çizgiden önce \`ctx.lineWidth\`'e uygula
- [ ] Varsayılan boyut: 4px

## Kabul kriterleri
- Kaydırıcıyı oynatmak fırça genişliğini hemen değiştirir
- Fırça ve silgi araçlarının ikisi de geçerli boyutu kullanır
`,
    },
    fill: {
      title: 'Alan doldurmayı yap (boya kovası)',
      content: `# Alan doldurmayı yap (boya kovası)

Tıklanınca tuvalin bitişik bir bölgesini geçerli renkle doldur.

## Görevler
- [ ] Piksel verisini \`ctx.getImageData()\` ile oku
- [ ] Tıklanan pikselden başlayan yinelemeli bir BFS/DFS alan doldurma algoritması yaz
- [ ] Doldurulan pikselleri \`ctx.putImageData()\` ile geri yaz
- [ ] Kenar yumuşatmalı sınırlar için bir tolerans eşiği ekle (ör. ±15)

## Kabul kriterleri
- Kapalı bir bölgenin içine tıklamak onu geçerli renkle doldurur
- Dolgu keskin kenarlardan taşmaz
- Tipik tuval boyutlarında (≤1920×1080) performans kabul edilebilir
`,
    },
    clear: {
      title: 'Tuvali temizleme düğmesini yap',
      content: `# Tuvali temizleme düğmesini yap

Tuvalin tamamını boş, beyaz haline döndür.

## Görevler
- [ ] Araç çubuğuna bir "Temizle" düğmesi ekle
- [ ] Tıklanınca \`ctx.clearRect(0, 0, canvas.width, canvas.height)\` çağır, ardından beyazla doldur
- [ ] Geri alınabilmesi için temizlemeden önce geçmişe bir anlık görüntü ekle

## Kabul kriterleri
- Temizle'ye tıklamak çizilen her şeyi kaldırır
- İşlem Geri Al ile geri alınabilir
`,
    },
    colorPicker: {
      title: 'Renk seçiciyi yap',
      content: `# Renk seçiciyi yap

Kullanıcının tarayıcının yerleşik renk girişiyle çizim için istediği rengi seçmesini sağla.

## Görevler
- [ ] Araç çubuğuna \`<input type="color">\` ekle
- [ ] Seçilen rengi genel bir \`currentColor\` durum değişkeninde sakla
- [ ] Her renk değişikliği olayında \`ctx.strokeStyle\` ve \`ctx.fillStyle\`'ı güncelle
- [ ] Varsayılan renk: \`#000000\`

## Kabul kriterleri
- Renk seçiciyi açmak işletim sisteminin renk seçicisini gösterir
- Bir renk seçmek sonraki çizgileri ve dolguları hemen etkiler
`,
    },
    palette: {
      title: 'Hazır renk paletini yap',
      content: `# Hazır renk paletini yap

Hızlı seçim için bir sıra hazır renk kutusu göster.

## Görevler
- [ ] ~16 klasik boya renginden bir dizi tanımla (siyah, beyaz, kırmızı, yeşil, mavi, sarı vb.)
- [ ] Her birini araç çubuğunda tıklanabilir küçük bir \`<div>\` kutusu olarak çiz
- [ ] Tıklanınca \`currentColor\`'ı ayarla ve renk seçici girişinin değerini eşitle
- [ ] Etkin kutuyu bir kenarlık/halkayla vurgula

## Kabul kriterleri
- Bir kutuya tıklamak etkin rengi hemen değiştirir
- Renk seçici girişi seçilen kutunun rengini gösterir
- Etkin kutu görsel olarak belli olur
`,
    },
    line: {
      title: 'Çizgi aracını yap',
      content: `# Çizgi aracını yap

Kullanıcının iki nokta arasında düz bir çizgi çizmesini sağla.

## Görevler
- [ ] \`mousedown\`'da başlangıç noktasını kaydet ve tuvalin anlık görüntüsünü al
- [ ] \`mousemove\`'da anlık görüntüyü geri yükle, ardından imlece bir önizleme çizgisi çiz
- [ ] \`mouseup\`'ta son çizgiyi tuvale işle
- [ ] Shift basılıyken açıyı 45°'lik adımlarla sınırla

## Kabul kriterleri
- Sürüklemek canlı önizlemeli düz bir çizgi çizer
- Fareyi bırakmak çizgiyi kalıcı olarak işler
- Shift açıyı sınırlar
`,
    },
    rect: {
      title: 'Dikdörtgen aracını yap',
      content: `# Dikdörtgen aracını yap

Tıklayıp sürükleyerek kenar çizgili ya da dolgulu dikdörtgenler çiz.

## Görevler
- [ ] \`mousedown\`'da başlangıç noktasını kaydet ve tuvalin anlık görüntüsünü al
- [ ] \`mousemove\`'da anlık görüntüyü geri yükle ve önizleme dikdörtgenini çiz
- [ ] \`mouseup\`'ta dikdörtgeni işle
- [ ] Bir araç çubuğu seçeneğiyle kenar (\`ctx.strokeRect\`) ve dolgu (\`ctx.fillRect\`) arasında geçiş yap
- [ ] Shift basılıyken kareyle sınırla

## Kabul kriterleri
- Sürüklemek canlı bir dikdörtgen önizlemesi çizer
- Kenar / dolgu geçişi çalışır
- Shift kareyle sınırlar
`,
    },
    ellipse: {
      title: 'Daire / elips aracını yap',
      content: `# Daire / elips aracını yap

Tıklayıp sürükleyerek kenar çizgili ya da dolgulu elipsler çiz.

## Görevler
- [ ] \`mousedown\`'da başlangıç noktasını kaydet ve tuvalin anlık görüntüsünü al
- [ ] \`mousemove\`'da anlık görüntüyü geri yükle ve \`ctx.ellipse()\` ile önizleme elipsini çiz
- [ ] \`mouseup\`'ta elipsi işle
- [ ] Dikdörtgen aracındaki kenar/dolgu geçişini yeniden kullan
- [ ] Shift basılıyken kusursuz bir daireyle sınırla

## Kabul kriterleri
- Sürüklemek canlı bir elips önizlemesi çizer
- Kenar / dolgu geçişi çalışır
- Shift daireyle sınırlar
`,
    },
    save: {
      title: 'PNG olarak kaydetmeyi yap',
      content: `# PNG olarak kaydetmeyi yap

Kullanıcının geçerli tuvali PNG dosyası olarak indirmesini sağla.

## Görevler
- [ ] Araç çubuğuna bir "Kaydet" düğmesi ekle
- [ ] Tıklanınca \`canvas.toDataURL('image/png')\` çağır
- [ ] İndirmeyi geçici bir \`<a download>\` öğesiyle programatik olarak başlat
- [ ] Varsayılan dosya adı: \`painting.png\`

## Kabul kriterleri
- Kaydet'e tıklamak tuvaldekiyle aynı görünen bir PNG indirir
- Beyaz arka plan korunur (tuval saydam değildir)
`,
    },
    open: {
      title: 'Görsel açmayı / yüklemeyi yap',
      content: `# Görsel açmayı / yüklemeyi yap

Kullanıcının yerel bir görsel dosyasını açıp tuvale çizmesini sağla.

## Görevler
- [ ] Gizli bir \`<input type="file" accept="image/*">\` tetikleyen bir "Aç" düğmesi ekle
- [ ] Seçilen dosyayı \`FileReader.readAsDataURL()\` ile oku
- [ ] Yüklenen görseli \`ctx.drawImage()\` ile tuvale sığacak şekilde ölçekleyerek çiz
- [ ] Geri alınabilmesi için çizmeden önce geçmişe bir anlık görüntü ekle

## Kabul kriterleri
- Bir görseli açmak onu tuvalde gösterir
- Görsel, tuval boyutlarına sığacak şekilde orantılı ölçeklenir
- İşlem geri alınabilir
`,
    },
    undo: {
      title: 'Geri alma geçmişini yap',
      content: `# Geri alma geçmişini yap

Kullanıcının tuvalin önceki hallerine adım adım dönmesini sağla.

## Görevler
- [ ] \`ImageData\` anlık görüntülerinden oluşan bir \`history\` dizisi tut (en çok 50 kayıt)
- [ ] İşlenen her çizim işleminden önce bir anlık görüntü ekle
- [ ] Geri Al'da (\`Ctrl+Z\`) son anlık görüntüyü çıkar ve \`ctx.putImageData()\` ile geri yükle
- [ ] Klavye kullanmayanlar için araç çubuğuna bir Geri Al düğmesi ekle
- [ ] Geçmiş boşken Geri Al düğmesini devre dışı bırak

## Kabul kriterleri
- \`Ctrl+Z\` her seferinde bir işlem geri gider
- 50 adıma kadar geçmiş kullanılabilir
- Geri alınacak bir şey yokken Geri Al düğmesi devre dışı görünür
`,
    },
    toolbar: {
      title: 'Araç çubuğu arayüzünü ve araç simgelerini yap',
      content: `# Araç çubuğu arayüzünü ve araç simgelerini yap

Bütün araç düğmelerini ve denetimleri barındıran kenar araç çubuğunu kur.

## Görevler
- [ ] CSS ile solda dikey bir araç çubuğu tasarla
- [ ] Şunlar için simgeli düğmeler ekle: Fırça, Silgi, Doldur, Çizgi, Dikdörtgen, Elips, Aç, Kaydet, Geri Al, Temizle
- [ ] Unicode simgeleri ya da basit SVG simgeleri kullan (dış simge kütüphanesi yok)
- [ ] Etkin araç düğmesini seçili durum stiliyle vurgula
- [ ] Her düğmeye ipucu ekle (\`title\` niteliği)

## Kabul kriterleri
- Bütün araçlara araç çubuğundan ulaşılır
- Etkin araç açıkça vurgulanır
- Araç çubuğu 1080p'de okunur ve küçük ekranlarda taşmaz
`,
    },
    shortcuts: {
      title: 'Klavye kısayollarını yap',
      content: `# Klavye kısayollarını yap

Araçlar arasında hızlı geçiş ve sık eylemler için klavye kısayollarını bağla.

## Kısayol haritası
| Tuş | Eylem |
|-----|-------|
| B | Fırça |
| E | Silgi |
| F | Doldurma (kova) |
| L | Çizgi |
| R | Dikdörtgen |
| C | Daire / elips |
| Ctrl+Z | Geri al |
| Ctrl+S | PNG olarak kaydet |
| Delete | Tuvali temizle |

## Görevler
- [ ] \`document\` üzerine bir \`keydown\` dinleyicisi ekle
- [ ] \`event.key\`'e göre doğru araca ya da eyleme yönlendir
- [ ] \`Ctrl+\` birleşimlerini \`event.ctrlKey\` / \`event.metaKey\` ile koru
- [ ] Odak bir giriş alanındayken kısayolları çalıştırma

## Kabul kriterleri
- Her kısayol doğru aracı ya da eylemi etkinleştirir
- Kısayollar tarayıcı varsayılanlarıyla çakışmaz (bilerek ezilmesi gereken Ctrl+S dışında)
`,
    },
  },
};

export default text;
