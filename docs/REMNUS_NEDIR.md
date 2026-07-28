# Remnus — Agent Primer

> Bu metin, herhangi bir AI agent oturumuna "Remnus nedir?" sorusuna derinlemesine ve doğru cevap verebilmesi için context olarak verilebilecek bir prompt parçasıdır. Kaynak: `remnus-app` reposundaki `README.md`, `AGENTS.md`, `docs/mcp/*`, `docs/blog/*`, `server.json` (2026-07-28 itibarıyla). Sürüm: `remnus-app@0.1.14`.
>
> Bu dosya `docs/mcp/*` ve `docs/blog/*` içerik pipeline'ının dışındadır (`src/lib/content/manifest.ts` içinde kayıtlı değildir), bu yüzden `/wiki` veya `/docs` altında otomatik olarak yayınlanmaz — düz bir agent-context referans dosyasıdır.

## 1. Tek cümlelik kimlik

**Remnus**, insanlar ve AI ajanlarının birlikte kullandığı, **Model Context Protocol (MCP) etrafında baştan tasarlanmış**, açık kaynak (AGPL-3.0), Notion-benzeri bir **workspace** ürünüdür. `server.json` özeti: *"MCP-native open-source Notion alternative: read & write pages, databases and kanban boards."*

## 2. Ürün modeli

- Her kullanıcı bir veya birden fazla **workspace**'e sahiptir; workspace tek bir sidebar ağacı etrafında kurulur.
- Sidebar'da iki tür item birlikte yaşar:
  - **Standalone pages** — başlık + Tiptap tabanlı markdown editör, slash komutları, nested sub-page desteği, ikonlar.
  - **Databases** — dinamik kolonlu (text/select/status/date/number/relation vb.) tablolar; **Table / Kanban / Calendar** görünümleri, filtre ve sort desteklenir.
- Kritik tasarım kararı: **her database satırı aynı zamanda bir sayfadır** — yani bir kanban kartının hem tipli property'leri hem de tam markdown içeriği (body) vardır. Bu, "task" ile "not" arasındaki ayrımı ortadan kaldırır.
- Workspace'ler arası davet/roller: **owner / member / viewer**.
- Veri modeli EAV değil, **JSON Column Pattern** ile tutulur (dinamik property'ler `schema`/`properties` JSON kolonlarında) — SQLite/Turso + Drizzle ORM üzerinde.

## 3. Neden var: "MCP-native" pozisyonu

Remnus'un temel iddiası, çoğu araç gibi *insana göre tasarlanıp sonradan MCP eklenen* ("MCP-integrated") değil, **agent erişiminin mimari bir tasarım kısıtı olduğu** ("MCP-native") bir ürün olmasıdır. Pratikte bu şu demek:

- MCP sunucusu ayrı bir wrapper/sidecar değil, `/api/mcp` altında **uygulamanın kendisinin bir parçası**dır — web UI'ı besleyen aynı sorgular ve yetki kontrolleri agent çağrılarını da besler.
- Bir insanın UI üzerinden yapabildiği her şeyi (arama, okuma, yazma, schema değiştirme) bir agent de aynı auth/scope/audit zinciriyle yapabilir.
- Flattened/prose export yerine **tipli, structured tool response**'lar döner (schema, column type'ları, select option'ları korunur).
- Tekil "bir seferde bir item" yazma modeli yerine **batch write tool'ları** vardır (`bulk_update_pages`).
- Auth insan session'ı üstüne "yamalı" değildir; **agent token'ları first-class principal**'dır (OAuth 2.1 + PKCE veya scoped PAT).
- Her agent çağrısı **immutable audit log**'a yazılır (token kimliği + tool + sonuç).
- Agent memory bir opaque vector store değil, **okunabilir/düzeltilebilir sıradan sayfalar**dan oluşan bir database'dir.

Bu farkı Remnus, Notion, Obsidian, AppFlowy ve AFFiNE ile detaylı karşılaştıran blog yazılarında (`docs/blog/remnus-vs-*.md`) somutlaştırır: Notion'a göre günlük kullanımda (view çeşitliliği, offline mobil, template pazarı) daha geride ama headless/agent auth + audit trail'i her planda (Free dahil) sunar; Obsidian tamamen local-first tekil kullanıcı aracıdır, Remnus ise takım + agent'ın birlikte çalıştığı network tabanlı bir workspace'tir; AppFlowy'nin resmi bir agent bağlantı yolu yoktur, Remnus'un first-party MCP sunucusu vardır; AFFiNE self-host'ta 10 seat sınırı olan bir Team lisansına bağlıyken Remnus self-host'ta seat sınırı koymaz.

## 4. MCP sunucusu — teknik yüzey

**Endpoint:** `https://www.remnus.com/api/mcp` (her zaman `www` host'u kullanılmalı; apex `remnus.com` redirect eder ve bazı OAuth client'ları resource-indicator mismatch nedeniyle bunu reddeder). **Streamable HTTP** (stateless) ve **SSE** (stateful) dual transport desteklenir.

### Kimlik doğrulama
- **OAuth 2.1 + PKCE (S256)** — önerilen yol, token yapıştırmaya gerek yok. Dynamic client registration (RFC 7591, `POST /api/oauth/register`). Access token 1 saat, refresh token 30 gün (rotate-on-use). Consent ekranında workspace, scope (read/write) ve agent adı seçilir.
- **Personal Access Token (PAT)** — headless/CI için, yalnızca workspace **owner**'ları üretebilir (`rmns_...` prefix, `Authorization: Bearer` header). Süresiz ya da expiry'li olabilir.
- Her token/bağlantı **tek bir workspace**'e scope'ludur.
- **Scope'lar:** `read` (9 read tool) ve `write` (tüm read tool'lar + 10 write tool). Read-scoped token ile write tool çağrısı hata döner, hiçbir değişiklik yapılmaz.
- **Rate limit:** token başına dakikada 60 istek, aşımda `429`.
- **Audit log:** her tool çağrısı (PAT + OAuth) workspace audit log'una yazılır; `query_audit_log` tool'u veya "AI Agents" panelinden izlenebilir.

### 19 MCP Tool (9 read + 10 write)

| Tool | Scope | Ne yapar |
|---|---|---|
| `search_workspace` | read | Sayfalar ve database'ler üzerinde full-text arama |
| `list_workspace` | read | Sidebar item'larını sayfalama ile listeler |
| `get_page` | read | ID ile sayfa veya database satırı getirir (`mode: "outline"` ile ucuz özet) |
| `get_database_schema` | read | Bir database'in kolon şemasını getirir |
| `query_database` | read | Filtre/sayfalama ile satır sorgular (`fields` projection ile token tasarrufu) |
| `list_members` | read | Workspace üyelerini rolleriyle listeler |
| `query_audit_log` | read | Filtrelenmiş agent aktivite kaydı |
| `get_changes_since` | read | Bir zaman damgası/cursor'dan bu yana ne değişti (delta-sync) |
| `get_related_pages` | read | Bir sayfanın parent/children/outgoing link/backlink/database sibling'leri (link graph) |
| `create_page` | write | Standalone sayfa veya database satırı oluşturur |
| `update_page` | write | Başlık/içerik/property günceller |
| `bulk_update_pages` | write | Tek çağrıda birden çok satırı günceller |
| `delete_page` | write | Sayfa siler (`confirm: true` zorunlu) |
| `move_item` | write | Item'ı yeni bir parent'a taşır |
| `create_database` | write | Özel şemalı yeni database oluşturur |
| `update_database_schema` | write | Kolon ekler/kaldırır |
| `create_database_view` | write | Table/kanban/calendar view ekler |
| `update_database_view` | write | View'ı yeniden adlandırır veya config'ini değiştirir |
| `delete_database_view` | write | Kayıtlı view siler (`confirm: true` zorunlu) |

### 5 MCP Resource (ucuz, subscribe edilebilir context)

| URI | İçerik |
|---|---|
| `remnus://workspace/{id}/schema` | Workspace'teki tüm database'lerin tam JSON şeması |
| `remnus://workspace/{id}/digest` | Tüm workspace'in tek satır/item halinde markdown ağacı — agent'ın oryantasyonu için en ucuz yol |
| `remnus://page/{id}` | Herhangi bir sayfa/satırın markdown içeriği + property'leri |
| `remnus://database/{id}/schema` | Tek bir database'in kolon şeması |
| `remnus://audit-log/recent` | Mevcut token için en son 50 audit log kaydı |

### 7 MCP Prompt (server-side, yeniden kullanılabilir şablonlar)

`summarize-page` (bullet/paragraph/tldr özet), `weekly-status-report` (status'e göre gruplanmış haftalık rapor), `kanban-triage` (blocker/öncelik/next-action analizi), `extract-tasks` (bir sayfadan actionable task checklist çıkarma), `search-and-create` (yeni sayfa yazmadan önce benzer içerik kontrolü), `save-memory` (kalıcı memory'i structured bir satır olarak yazmak için talimat üretir — decision/preference/gotcha/fact tipleri), `recall-context` (bir konu hakkında en iyi eşleşen sayfaların outline'larını + link graph komşuluğunu tek pakette döner).

### Agent Memory kavramı

Remnus'un öne çıkan kullanım senaryolarından biri: agent memory, opaque bir vector/embedding store değil, **sıradan bir database'teki structured sayfalar**dır (Type/Tags/Date property'leriyle). İnsan bu memory'leri workspace içinde okuyabilir, düzeltebilir, gruplayabilir. `save-memory` / `recall-context` prompt çifti bunun için tasarlanmıştır.

## 5. Platformlar & dağıtım

- **Web:** Next.js 16.2.6 (App Router) — cloud'da `remnus.com` / self-host'ta kendi domain'iniz.
- **Masaüstü:** Tauri v2 (Rust shell), Windows/macOS/Linux — `remnus.com`'u sistem WebView'inde yükler.
- **Mobil:** Capacitor v8, iOS + Android — aynı şekilde `remnus.com`'u yükler.
- **PWA:** Workbox tabanlı service worker, install prompt akışı, `/download` sayfası.
- **Self-host seçenekleri:** `npm run dev` ile lokal, Docker Compose (5 dakikalık kurulum, SQLite volume ile persist), tek tıkla Vercel veya Railway deploy.
- **Kayıt/registry:** Resmi MCP Registry'de (`io.github.Ranork/remnus`) ve Smithery'de (`ranorkk/remnus`) yayınlıdır — MCP-aware client'lar otomatik keşfedebilir.
- **Claude Desktop:** `mcpb/` altında paketlenmiş remote-MCP proxy bundle'ı ile bağlanılabilir; standart `mcpServers` JSON config veya `mcp-remote` bridge ile de her editör bağlanabilir.
- **Desteklenen editör/istemciler:** Claude Code, Claude Desktop, Cursor, VS Code, Codex, Windsurf, Continue, Antigravity, Cline, Zed ve genel olarak her MCP-uyumlu client.

## 6. Teknoloji yığını (özet)

- **Framework:** Next.js 16.2.6 (App Router), React 19.2, strict TypeScript 5.
- **Veritabanı:** SQLite (`@libsql/client`, Turso-uyumlu) + Drizzle ORM; dinamik property'ler JSON kolonlarda (EAV değil).
- **Auth:** Auth.js v5 — Google & GitHub OAuth; ayrıca kendi OAuth 2.1 + PKCE authorization server'ı (agent'lar için, RFC 7591 dynamic client registration).
- **i18n:** next-intl v4, `localePrefix: 'never'`.
- **Editör:** Tiptap v3 (rich text/markdown).
- **State/cache:** TanStack Query.
- **Stil:** Tailwind CSS + Lucide icons; flat/borderless, üç katmanlı neutral dark palette (auth sayfaları istisna, rounded-card stilinde).
- **Entegrasyonlar:** Cloudinary (görsel upload), Stripe (billing), PostHog (analytics + error tracking), AWS SES (transactional/newsletter e-posta).
- **Lisans:** **AGPL-3.0** — self-host ve modifikasyon serbest; SaaS fork'ları değişikliklerini açık kaynak yapmak zorunda.

## 7. Dil desteği

8 dil: **English (kaynak/varsayılan), Türkçe, हिन्दी, Español, Français, Deutsch, 中文, Русский.**

## 8. Fiyatlandırma modeli (özet)

Abonelik bir **workspace**'e değil, bir **billing owner (kullanıcı)**'a bağlıdır; owner bir seat pool'u tutar. Planlar: **Free / Startup / Professional / Enterprise** — seat, agent (token) sayısı, storage ve audit-log retention limitleri farklıdır. Ücretsiz planda bile MCP + audit log + scoped token erişimi vardır.

## 9. Tipik kullanım senaryoları

- **Proje planlama**, **task/kanban yönetimi**, **agent memory**, **dokümantasyon bakımı**, **çoklu-agent işbirliği**, **otomatik durum raporlama**.

## 10. Hızlı referans

| Alan | Değer |
|---|---|
| MCP endpoint | `https://www.remnus.com/api/mcp` |
| Tool / Resource / Prompt | 19 / 5 / 7 |
| Auth | OAuth 2.1 + PKCE (önerilen), PAT |
| Rate limit | 60 istek/dk/token |
| Lisans | AGPL-3.0 |
| Repo | `github.com/Ranork/remnus-app` |
| Diller | en, tr, hi, es, fr, de, zh, ru |

---

Bu doküman `remnus_app` MCP'ye canlı bağlanmadan, tamamen repodaki kaynaklardan derlendi. İleride tool/resource/prompt sayıları değişirse (`README.md` / `docs/mcp/*.md` güncellenirse) bu metnin de senkron tutulması gerekir — canonical kaynak her zaman kod ve dokümantasyondur.
