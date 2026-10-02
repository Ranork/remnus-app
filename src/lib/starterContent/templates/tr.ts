import type { TemplateText } from '../types';

const text: TemplateText = {
  locale: 'tr',
  stock: {
    title: 'Başlık',
    status: 'Durum',
    id: 'ID',
    todo: 'Yapılacak',
    inProgress: 'Devam ediyor',
    done: 'Bitti',
  },
  views: { table: 'Tablo', board: 'Kanban', calendar: 'Takvim' },

  meetingNotes: `## Katılımcılar

- Sarah Chen (Ürün Yöneticisi)
- Marcus Johnson (Mühendislik Lideri)
- Aisha Patel (Tasarımcı)

## Gündem

1. Sprint değerlendirmesi ve hız kontrolü
2. Gelecek çeyreğin yol haritası öncelikleri
3. Tasarım sistemi güncellemeleri

## Notlar

Sprint genel olarak iyi geçti. Hız tahminin biraz üzerindeydi. Yeni giriş akışı yayında ve beklendiği gibi çalışıyor.

Gelecek çeyreğin öncelikleri: ilk kullanım deneyimi iyileştirmelerine ve mobil uyumluluğa odaklanmak. Pazarlama ekibinin yeni panoya gelecek ayın sonuna kadar ihtiyacı var.

Tasarım sistemi: Aisha güncellenmiş bileşen kütüphanesini gelecek hafta paylaşacak.

## Yapılacaklar

- [ ] Marcus: test ortamını cumaya kadar kurmak
- [ ] Aisha: tasarım sistemi v2 taslağını gelecek salıya kadar paylaşmak
- [ ] Sarah: gelecek çeyreğin yol haritası taslağını ekibin incelemesine göndermek
`,

  projectBrief: `## Genel bakış

Ekiplerin temel metrikleri gerçek zamanlı takip etmesine yardım eden yeni nesil bir analiz panosu. Amaç, bugünkü tablo tabanlı raporlamanın yerine merkezi ve otomatik bir çözüm koymak.

## Hedefler

- Elle raporlamaya harcanan süreyi %80 azaltmak
- Ekip performans göstergelerini gerçek zamanlı görünür kılmak
- PDF ve CSV olarak dışa aktarmayı desteklemek

## Zaman çizelgesi

| Kilometre taşı | Tarih |
|----------------|-------|
| Başlangıç | {{kickoff}} |
| Tasarımın tamamlanması | {{designDone}} |
| Beta sürümü | {{beta}} |
| Lansman | {{launch}} |

## Ekip

- Ürün: Sarah Chen
- Mühendislik: Marcus Johnson, Kai Rivera
- Tasarım: Aisha Patel
`,

  taskTracker: {
    columns: { priority: 'Öncelik', assignee: 'Sorumlu', dueDate: 'Bitiş tarihi' },
    status: { backlog: 'Bekleyen', inProgress: 'Devam ediyor', review: 'İncelemede', done: 'Bitti' },
    priority: { low: 'Düşük', medium: 'Orta', high: 'Yüksek' },
    rows: {
      landing: 'Açılış sayfası taslaklarını tasarla',
      ci: 'CI/CD hattını kur',
      tests: 'Kimlik doğrulama modülü için birim testleri yaz',
      review: 'feature/payments dalının kod incelemesi',
      docs: 'API belgelerini güncelle',
      staging: 'Test ortamına dağıt',
      loginBug: 'Giriş sonrası yönlendirme hatasını düzelt',
    },
  },

  eventCalendar: {
    columns: { eventDate: 'Etkinlik tarihi', category: 'Kategori', notes: 'Notlar' },
    category: { meeting: 'Toplantı', conference: 'Konferans', deadline: 'Son tarih', personal: 'Kişisel' },
    rows: {
      standup: { title: 'Haftalık ekip toplantısı', notes: 'Her pazartesi tekrarlanır' },
      planning: { title: 'Sprint planlaması', notes: 'Sprint 14 başlangıcı' },
      productReview: { title: 'Çeyrek sonu ürün değerlendirmesi', notes: 'Yol haritasını paydaşlarla gözden geçir' },
      mvp: { title: 'Proje MVP son tarihi', notes: 'Tüm özellikler main dalına birleştirilmiş olmalı' },
      summit: { title: 'Frontend Summit', notes: 'Çevrim içi — kayıt: frontendsummit.io' },
      handoff: { title: 'Tasarım sistemi teslimi', notes: 'Aisha v2 bileşenlerini teslim ediyor' },
      offsite: { title: 'Ekip gezisi', notes: 'İstanbul — 2 gece' },
    },
  },

  readingList: {
    columns: { rating: 'Puan', genre: 'Tür', author: 'Yazar' },
    status: { wantToRead: 'Okunacak', reading: 'Okunuyor', done: 'Okundu' },
    genre: { fiction: 'Kurgu', nonFiction: 'Kurgu dışı', tech: 'Teknoloji', science: 'Bilim' },
    books: {
      pragmatic: 'Pragmatik Programcı',
      dune: 'Dune',
      sapiens: 'Sapiens: Hayvanlardan Tanrılara',
      cleanCode: 'Temiz Kod',
      threeBody: 'Üç Cisim Problemi',
      briefHistory: 'Zamanın Kısa Tarihi',
      thinking: 'Hızlı ve Yavaş Düşünme',
    },
  },

  agentMemory: {
    columns: { type: 'Tür', tags: 'Etiketler', date: 'Tarih' },
    type: { decision: 'Karar', preference: 'Tercih', gotcha: 'Tuzak', fact: 'Bilgi' },
    tags: { architecture: 'mimari', conventions: 'kurallar', api: 'api', database: 'veritabanı', infra: 'altyapı' },
    byType: 'Türe göre',
    rows: {
      postgres: 'Ana veri deposu olarak PostgreSQL kullan',
      functional: 'React’te sınıf bileşenleri yerine fonksiyon bileşenlerini tercih et',
      rateLimit: 'Test ortamı API’si dakikada 100 istekle sınırlı — yazmaları toplu yap',
      tokens: 'Tasarım tokenları Tailwind ayarında değil, tokens.css’te durur',
    },
  },
};

export default text;
