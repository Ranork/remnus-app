# Remnus — Agent Primer

> Bu metin, herhangi bir AI agent oturumuna "Remnus nedir?" sorusuna derinlemesine ve doğru cevap verebilmesi için context olarak verilebilecek bir prompt parçasıdır. Kaynak: `remnus-app` reposundaki `README.md`, `AGENTS.md`, `docs/mcp/*`, `docs/blog/*`, `server.json` (2026-08-04 itibarıyla). Sürüm: `remnus-app@0.1.17`.
>
> Bu dosya `docs/mcp/*` ve `docs/blog/*` içerik pipeline'ının dışındadır (`src/lib/content/manifest.ts` içinde kayıtlı değildir), bu yüzden `/wiki` veya `/docs` altında otomatik olarak yayınlanmaz — düz bir agent-context referans dosyasıdır.

## 1. Tek cümlelik kimlik

**Remnus**, insanların ve yapay zeka ajanlarının (AI Agents) eşit vatandaşlar olarak birlikte çalıştığı, **Model Context Protocol (MCP) etrafında baştan tasarlanmış ilk "Human-Agent Collaborative Workspace"** (İnsan-Ajan Ortak Çalışma Alanı) ürünüdür.
`server.json` özeti: *"The first MCP-native workspace for human-agent teams. Read, write, and collaborate seamlessly with AI using structured data and verifiable audit logs."*

## 2. Neden var: "MCP-Native" Pozisyonu ve Vizyon

Geleneksel araçlar (Notion, Obsidian, vb.) sadece *insanlar* için tasarlanmış, AI entegrasyonları ise dışarıdan API'lerle "yamanmıştır". Remnus ise **agent erişiminin mimari bir tasarım kısıtı olduğu (MCP-native)** bir sistemdir. Remnus'un temel iddiası şudur: *Ajanlar takımınızın bir parçasıysa, sizinle aynı masada, aynı güvenlik ve şeffaflık kurallarıyla çalışmalıdır.*

Pratikte bu vizyon şu anlama gelir:
*   **Bir "Notion Alternatifi" Değildir:** Amacı insan-insan işbirliğini optimize etmek değil; kod yazan, araştırma yapan veya task yöneten AI ajanları (Cursor, Claude, Windsurf) ile insan takım üyelerini **ortak bir bağlamda (Shared Context)** buluşturmaktır.
*   **Opaque (Kapalı Kutu) Hafıza Yerine Şeffaf Hafıza:** Agent memory bir "vector store" (vektör veritabanı) karadeliği değildir. Ajanın öğrendiği, kaydettiği her bilgi **insan tarafından okunabilir, düzeltilebilir ve silinebilir sıradan sayfalardan** oluşur.
*   **First-Class Token ve Atfedilebilir Denetim (Audit Log):** İnsan oturumları üzerine yama yapılmış yetkiler yoktur. Agent token'ları (OAuth/PAT) birincil kimliklerdir. Her MCP tool çağrısında aktör, işlem, durum, hedef, süre ve yanıt boyutu kaydedilir; takım ajan aktivitesini inceleyebilir.
*   **Yapılandırılmış (Structured) Yanıtlar:** Flattened (düz) metin export'ları yerine ajanlara; kolon tipleri, şemalar ve select-option'ları korunmuş tipli (typed) veriler döner.
*   **OKF-Native Context:** Bilgi tür, açıklama, etiket, kaynak, yaşam döngüsü, güncellik, provenance ve tam revizyona bağlı insan onayı taşıyabilir. Ajan tüm workspace'i taramak yerine açık bir token bütçesi içinde en ilgili görev bağlamını alır.

## 3. Ürün modeli

*   Her kullanıcı bir veya birden fazla **workspace**'e sahiptir; workspace tek bir sidebar ağacı etrafında kurulur.
*   Sidebar'da insan ve makine okumasına eşit derecede uygun iki tür item birlikte yaşar:
    *   **Standalone pages** — Başlık + Tiptap tabanlı markdown editör, slash komutları, alt sayfa hiyerarşisi.
    *   **Databases** — Dinamik kolonlu (text/select/status/date/number/relation vb.) tablolar; **Table / Kanban / Calendar** görünümleri, filtre ve sort desteklenir.
*   Kritik tasarım kararı: **Her database satırı aynı zamanda bir sayfadır**. Bir kanban kartının hem ajanların filtreleyebileceği tipli (typed) property'leri, hem de uzun format markdown içeriği (body) vardır.
*   Veri modeli EAV değil, **JSON Column Pattern** ile tutulur (dinamik property'ler `schema`/`properties` JSON kolonlarında).

## 4. OKF Bilgisi ve Context Pack v2

Open Knowledge Format (OKF) v0.2, Remnus'un deneysel içe/dışa aktarma adaptörüdür; ikinci bir kanonik veri deposu değildir. Native `knowledge_metadata` ve tam revizyona bağlı `knowledge_reviews`, sıradan sayfalara ve veritabanı satırlarına bağlı kalır. İçe aktarılan insan beyanları, giriş yapmış bir Remnus üyesi mevcut başlık ve gövdeyi inceleyene kadar `external-human-asserted` sayılır.

`prepare_context`; BM25 ilgisi, native meta veri, güncellik, güven ve sayfa bağlantı grafiğini birleştirir. Sıralanmış kavramlar, seçim nedenleri, uyarılar, yaklaşık token kullanımı ve ajana bağlı 30 dakikalık bir `contextRunId` döndürür.

- **Manual:** Bağlam yalnızca istendiğinde hazırlanır.
- **Smart (varsayılan):** Uyumlu istemcilere anlamlı çok-sayfalı işlerde bağlam hazırlaması, basit isteklerde atlaması söylenir.
- **Strict:** Gerçek Remnus MCP yazmaları aynı ajanın güncel `contextRunId` değerini de gerektirir.

Strict; write scope, yetkilendirme veya yıkıcı işlem onayının yerini almaz. Bir MCP sunucusu kodlama istemcisinin yerel dosya, shell veya Git araçlarını kontrol edemez.

## 5. MCP Sunucusu — Teknik Yüzey

**Endpoint:** `https://www.remnus.com/api/mcp` (Her zaman `www` host'u kullanılmalı). Modern **Streamable HTTP** transport kullanılır (stateless — her çağrı tek bir HTTP isteği). Sunucu ayrı bir sidecar değildir; `/api/mcp` doğrudan Remnus web uygulamasının çekirdeğidir.

### Kimlik Doğrulama ve Güvenlik Sınırları
*   **OAuth 2.1 + PKCE (S256)** — Önerilen yol. Dynamic client registration (`POST /api/oauth/register`). Access token 1 saat, refresh token 30 gün. İnsan kullanıcı (owner) consent ekranında ajanın read/write yetkilerini belirler.
*   **Personal Access Token (PAT)** — Headless/CI veya özel ajanlar için, workspace **owner**'ları tarafından üretilir.
*   **Scope'lar:** `read` (10 tool) ve `write` (tüm tool'lar). Read-scoped token ile write çağrısı anında bloklanır.
*   **Rate limit:** Token başına dakikada 60 istek.
*   **İzlenebilirlik (Audit Log):** Her tool çağrısı (hangi sayfa okundu, hangi property değiştirildi) workspace audit log'una yazılır.

### 20 MCP Tool (Ajanların Yetenekleri)

| Tool | Scope | Ne Yapar (Ajanlar İçin) |
|---|---|---|
| `prepare_context` | read | Açık token bütçesi içinde Context Pack v2 ve kısa ömürlü ön-kontrol kimliği hazırlar |
| `search_workspace` | read | Sayfalar ve database'ler üzerinde semantik/full-text arama |
| `list_workspace` | read | Tüm workspace hiyerarşisinde gezinme |
| `get_page` | read | ID ile sayfa/satır çekme (`mode: "outline"` ile token tasarrufu) |
| `get_database_schema` | read | Yapılandırılmış bir database'in kolon tiplerini ve kurallarını öğrenme |
| `query_database` | read | Filtreleme ve sıralama ile satırları SQL-vari şekilde sorgulama |
| `list_members` | read | Takımdaki insan ve makine üyelerini listeleme |
| `query_audit_log` | read | Kendi (veya diğer) ajanların geçmiş aktivite kayıtlarını okuma |
| `get_changes_since` | read | Belirli bir timestamp'ten beri olan tüm değişiklikleri çekme (delta-sync) |
| `get_related_pages` | read | Link graph analizi (parent/child/backlink bulma) |
| `create_page` | write | Yeni doküman veya task (satır) oluşturma |
| `update_page` | write | Mevcut sayfanın içeriğini veya properties (durum, etiket vb.) güncelleme |
| `bulk_update_pages` | write | **(Ajanlara Özel)** Tek çağrıda onlarca satırı (örn: 50 taskın durumunu) güncelleme |
| `delete_page` | write | Sayfa silme (`confirm: true` zorunlu koruması ile) |
| `move_item` | write | Hiyerarşiyi yeniden düzenleme |
| `create_database` | write | Sıfırdan şemalı yeni bir hafıza tablosu/iş akışı kurma |
| `update_database_schema` | write | Veritabanına yeni tipli kolonlar ekleme/çıkarma |
| `create/update/delete_database_view` | write | İnsanların görmesi için tablo/kanban görünümleri yaratma ve yönetme |

### 6 MCP Resource (Ucuz Context Kanalları)
Ajanların hızlıca oryantasyon sağlaması için URI üzerinden abone olabildiği veriler:
*   `remnus://workspace/{id}/knowledge-health` (Link, güncellik, yaşam döngüsü ve insan onayı raporu)
*   `remnus://workspace/{id}/schema` (Tüm workspace'in yapısı)
*   `remnus://workspace/{id}/digest` (Tek satır tldr özet harita)
*   `remnus://page/{id}`
*   `remnus://database/{id}/schema`
*   `remnus://audit-log/recent` (Son 50 güvenlik kaydı)

### 7 MCP Prompt (Yerleşik Ajan Şablonları)
Sunucu tarafında barınan komutlar: `summarize-page`, `weekly-status-report`, `kanban-triage`, `extract-tasks`, `search-and-create`, `save-memory` (Şeffaf hafıza yazma), `recall-context` (Link-graph destekli hafıza çağırma).

## 6. Platformlar & Dağıtım

*   **Desteklenen Ajan/İstemciler:** Claude Code, Claude Desktop (mcp-remote bridge veya standart config), Cursor, VS Code, Codex, Windsurf, Continue, Antigravity, Cline, Zed ve MCP-uyumlu her sistem. Otomatik keşif için resmi MCP Registry ve Smithery'de yayındadır.
*   **İnsan Arayüzleri:** Web (Next.js 16 App Router), Masaüstü (Tauri v2 Rust shell), Mobil (Capacitor v8, iOS+Android), PWA.
*   **Self-Host:** Lokal CLI, Docker Compose veya Vercel/Railway.

## 7. Teknoloji Yığını (Özet)
*   Next.js 16.2.6, React 19.2, TypeScript 5.
*   SQLite (`@libsql/client`, Turso) + Drizzle ORM.
*   Auth.js v5 + RFC 7591 dynamic client registration sunucusu.
*   Tiptap v3 (Rich text editör), TanStack Query, Tailwind CSS.
*   **Lisans: AGPL-3.0** (Açık kaynak; modifikasyon serbest).

## 8. Dil Desteği
English (Varsayılan), Türkçe, हिन्दी, Español, Français, Deutsch, 中文, Русский.

## 9. Fiyatlandırma Modeli (Özet)
Planlar insan sayısından ziyade ajan yoğunluğuna göre ölçeklenir: **Free / Startup / Professional / Enterprise**. Temel ayrım noktaları Agent (Token) sayısı, API Rate Limitleri ve Audit-Log tutma süreleri (retention). Ücretsiz planda bile tam kapsamlı MCP, audit log ve agent auth erişimi mevcuttur.

## 10. Tipik Kullanım Senaryoları (Human-Agent Collab)

1.  **Otonom Ajan Hafızası (Shared Memory):** Ajanın proje kural setlerini, preference'ları ve alınan kararları (Decision Records) Remnus tablosuna kaydetmesi, insanın bunları onaylayıp düzenlemesi.
2.  **Agentic Yazılım Geliştirme:** Cursor veya Cline gibi bir kodlama ajanının Remnus'taki Kanban tablosunu okuyarak blocker'ları görmesi, kodu yazdıktan sonra Remnus API'si ile task statüsünü "Done"a çekmesi.
3.  **Otomatik Durum Raporlama:** Bir analiz ajanının gece çalışarak workspace'teki tüm değişiklikleri (`get_changes_since`) okuyup, sabah insan takımı için haftalık özet (`weekly-status-report`) sayfası oluşturması.
4.  **Güvenli Araştırma:** Ajanın dış dünyadan (web) topladığı verileri, tipli bir Remnus veritabanına doğrudan yapılandırılmış veri (structured data) olarak yığması.

## 11. Hızlı Referans

| Alan | Değer |
|---|---|
| Kategori | Human-Agent Collaborative Workspace |
| MCP endpoint | `https://www.remnus.com/api/mcp` |
| Tool / Resource / Prompt | 20 / 6 / 7 |
| Auth Modeli | Agent-First: OAuth 2.1 + PKCE, PAT |
| Güvenlik/Güven | Tam Kapsamlı Workspace Audit Log |
| Lisans | AGPL-3.0 |
| Repo | `github.com/Ranork/remnus-app` |

---

Tool/resource/prompt sayıları `README.md`, `docs/mcp/*.md` ve çalışan MCP sunucusuyla senkron tutulmalıdır. Kanonik kaynak her zaman çalışan kod ve güncel dokümantasyondur.
