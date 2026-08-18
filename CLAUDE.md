@AI.md

# Claude Code-specific instructions

- Serena kullanılabiliyorsa büyük kod tabanlarında sembolik araçları tercih et ve görevle ilgili memory'leri değişiklikten önce oku.
- Kalıcı proje bilgisi değiştiğinde ilgili Serena memory'sini ve gerekirse `AI.md` bölümünü güncelle.
- Yapısal ürün değişikliklerinde ayrıntılı harita olan `AGENTS.md` dosyasını ve özellikle `core`/`conventions` memory'lerini senkron tut.
- Claude-specific skills, agents ve hooks yalnızca göreve somut fayda sağladığında kullan.
- Kullanıcının fark edeceği bir geliştirme yaptıysan, kullanıcı ayrıca istemese bile aynı
  değişiklikle birlikte `src/lib/changelog.ts` dosyasının başına bir Yenilikler kaydı ekle.
  Yazım kuralları `AI.md` içindeki `## Changelog / What's New` bölümündedir: tek cümle,
  müşteri dili, 8 locale. Bunu bir sonraki tura bırakma; iş bitmeden yaz.
