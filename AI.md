# AI Project Guide

Last verified: 2026-07-14

## Language

- Kullanıcıyla Türkçe iletişim kur. Kod, sembol, dosya adı ve commit mesajları İngilizce kalabilir.
- Mevcut kod ve dokümantasyon stilini koru; yeni bir stil dayatma.

## Source of truth

- Çalışan kod, schema, manifest ve güncel Git durumu her zaman son gerçektir.
- `AI.md`, Claude Code ve Codex için canonical ortak çalışma rehberidir.
- `AGENTS.md`, ayrıntılı ürün/source map ve projeye özel zorunlu kuralları taşır. Yapısal değişikliklerde güncellenmeli ve Serena ile senkron tutulmalıdır.
- `.serena/memories/`, kalıcı ve ayrıntılı proje bilgisidir. `mem:core` keşif girişidir.
- `.ai/CURRENT_TASK.md`, yalnızca aktif ve geçici görev durumudur.
- `.ai/HANDOFF.generated.md`, mekanik Git snapshot'ıdır; sohbet özeti veya doğruluk kaynağı değildir.
- Kaynaklar çelişirse kod/Git gerçeğini esas al, sonra stale rehberi düzelt.

## Before starting a coding task

Basit typo, format veya salt soru-cevap işleri dışında:

1. `.ai/CURRENT_TASK.md` dosyasını oku.
2. Branch, HEAD, `git status --short` ve ilgili diff'i kontrol et.
3. Kullanıcının mevcut değişikliklerini kendi çalışman kabul etme; koru ve çakışma varsa bildir.
4. Serena kullanılabiliyorsa gerekli manual/activation akışını uygula, `list_memories` çağır ve yalnızca ilgili memory'leri oku.
5. Önce `mem:core`; göreve göre `mem:conventions`, `mem:tech_stack`, `mem:suggested_commands` ve `mem:task_completion` kullan.
6. Work Plan görevi varsa `remnus-mcp` ile dar `fields` projection kullan; tek görev gövdesini `get_page` ile oku, durumunu başlangıçta `In Progress` yap. Araç yoksa bunu açıkça raporla.
7. Next.js davranışı değişecekse kod yazmadan önce `node_modules/next/dist/docs/` altındaki ilgili güncel rehberi oku.

## During implementation

- Aynı working tree üzerinde yalnızca bir coding agent implementasyon yapsın. Diğer ajanlar yalnızca araştırma/review yapabilir; paralel edit için ayrı worktree ve branch gerekir.
- Kapsamı kullanıcının isteğiyle sınırlı tut; küçük, geri alınabilir ve doğrudan gerekli değişiklikleri tamamla.
- Büyük kaynak dosyalarında önce Serena symbol overview/search, sonra hedefli symbol body kullan.
- Formatter, hook veya senkronizasyon aracı dosyayı değiştirebiliyorsa sonraki editten önce dosyayı yeniden oku.
- Kullanıcı değişikliğiyle çakışan dosyayı körlemesine ezme.

## After a meaningful change

1. En dar ilgili doğrulamaları çalıştır.
2. Aktif görev sürüyorsa `.ai/CURRENT_TASK.md` alanlarını güncelle; bittiyse durumu doğru biçimde kapat.
3. Kalıcı proje bilgisi değiştiyse ilgili Serena memory'sini düzelt; stale bilgiyi yalnızca ekleme yaparak bırakma.
4. Kritik ortak akış değiştiyse `AI.md`; yapısal ürün haritası değiştiyse `AGENTS.md` güncelle.
5. `AGENTS.md` değiştiyse Serena'yı `remnus-app` için aktive et, memory listesini kontrol et ve özellikle `core`/`conventions` ile senkronla.
6. `scripts/ai/update-handoff.ps1` çalıştır.
7. Work Plan görevi tamamlandıysa sonucu, değişen dosyaları ve doğrulamaları görev gövdesine yazıp durumu `Done` yap.

## Agent handoff protocol

- Handoff'ta goal, scope, completed, changed files, decisions, verification, remaining work, known issues ve next exact step alanlarını güncel tut.
- Yeni ajan önce `AI.md`, `.ai/CURRENT_TASK.md`, Git durumu ve ilgili Serena memory'lerini karşılaştırır.
- Önceki ajanın anlatımını kod ve diff ile doğrulamadan source of truth sayma.
- `.ai/HANDOFF.generated.md` yalnızca branch/HEAD/status/diff stat gibi mekanik metadata içerir ve Git tarafından izlenmez.

## Verification order

1. Hedefli lint ve gerekiyorsa TypeScript kontrolü: `npm run lint -- <paths>`, `npx tsc --noEmit`.
2. İlgili unit/integration testi. Bu repoda şu anda genel bir test runner/script yoktur; test varmış gibi davranma.
3. Gerekiyorsa dev server ile çalışma kontrolü.
4. UI işi varsa Playwright veya görsel kontrol.
5. Full build yalnızca iş bitiminde build davranışı değiştiyse, release öncesinde veya kullanıcı açıkça isterse çalıştır.

Onboarding sırasında full build, tüm test suite'i veya dev server çalıştırma.

## Safety rules

- Secret, token, kullanıcı verisi veya gerçek environment değeri okuma, yazma ya da rapora kopyalama; yalnızca variable adını kullan.
- Dosya silme, force push, reset, clean, history rewrite ve geri döndürülemez işlemler için açık onay al.
- Kullanıcı istemedikçe commit veya push yapma.
- Paket kurma veya sürüm yükseltme yapma.
- Production Turso/Stripe/SES/Cloudinary gibi dış sistemlerde yazma işlemini görev açıkça gerektirmiyorsa çalıştırma.
- Windows PowerShell 5.1, UTF-8, Türkçe karakterli yollar ve olası file lock durumlarıyla uyumlu komutlar kullan.

## Project overview

Remnus, workspace etrafında kurulu Notion-benzeri bir üründür. Standalone markdown sayfaları ve dinamik kolonlu database'ler aynı sidebar ağacında yaşar; her database satırı aynı zamanda içerik taşıyan bir sayfadır. Web, Tauri masaüstü, Capacitor mobil ve PWA istemcileri cloud-first olarak aynı Remnus web uygulamasını kullanır. Remote MCP/OAuth yüzeyi AI ajanlarına workspace okuma-yazma yeteneği verir.

Repository monorepo değildir. Ana npm uygulamasına ek olarak dağıtım için paketlenen bağımsız `mcpb/server` yardımcı paketi bulunur.

## Architecture summary

- Next.js 16.2.6 App Router, React 19.2, strict TypeScript 5; ana route'lar `src/app/[locale]/` altındadır.
- next-intl v4, `localePrefix: 'never'`; locale cookie/header/fallback ile çözülür.
- Auth.js v5 config'i edge-safe `src/auth.config.ts` ve DB kullanan `src/auth.ts` olarak ayrıdır.
- SQLite/Turso + Drizzle ORM; dinamik database property'leri EAV yerine JSON kolonlarında tutulur.
- Server actions `src/lib/actions/`, cookie-free servis katmanı `src/lib/services/`, HTTP yüzeyleri `src/app/api/` altındadır.
- Client cache/mutation akışlarında TanStack Query; rich text/markdown editöründe Tiptap v3 kullanılır.
- Entegrasyonlar: Cloudinary, Stripe, PostHog, AWS SES, GitHub/Google OAuth, remote MCP OAuth 2.1.
- Dağıtım: Vercel web + cron, Docker self-host, Tauri GitHub Actions release, Capacitor native shells.

## Repository map

- `src/app/`: layouts, pages, API routes, global styles ve proxy girişleri.
- `src/components/`: feature, editor, database, marketing ve provider bileşenleri.
- `src/lib/actions/`: session-aware server actions.
- `src/lib/services/`: workspace, billing, asset ve page-link domain servisleri.
- `src/db/`: schema, custom migration runner, apply/backfill scriptleri ve migration'lar.
- `messages/`: 8 locale JSON dosyası; `en.json` source of truth.
- `docs/`: public Wiki/Docs uzun-form içerikleri.
- `src-tauri/`, `android/`: masaüstü ve mobil shell'ler.
- `mcpb/`: Claude Desktop remote-MCP proxy bundle'ı.
- `skills/remnus/`: Remnus MCP kullanım skill'i.
- `.serena/memories/`: kalıcı ajan bilgisi; `.ai/`: görev/handoff durumu.

## Critical conventions

- Kullanıcıya görünen tüm uygulama metni next-intl üzerinden gelir. Yeni key'i 8 dosyaya (`en`, `tr`, `hi`, `es`, `fr`, `de`, `zh`, `ru`) ekle; 31 namespace vardır.
- Client'ta `useTranslations`, server component/action'da `getTranslations`; tarih locale'ini hardcode etme.
- Server action/component'ta doğrudan `auth()` çağırma; `src/lib/auth/session.ts` içindeki `getCurrentUser()` kullan.
- Workspace/database erişiminde sırasıyla `assertWorkspaceAccess` veya `assertDatabaseAccess` uygula.
- Workspace UI flat/borderless ve üç katmanlı neutral palette kullanır; auth sayfalarının rounded-card stili bilinçli istisnadır.
- Yapısal sidebar mutasyonları dışında content editlerinde `revalidatePath('/')` kullanma; optimistic client akışını koru.
- `workspace_items`, `standalone_pages`, `databases`, `pages` insertlerinde `createdAt`/`updatedAt` değerlerini açıkça `new Date()` ile yaz.
- Content write/delete yollarında `syncPageLinks`, `purgeReferencesTo`, `removePageLinksFor` ve tombstone yan etkilerini koru; `seed.ts` doğrudan DB yazdığı için ayrıca kontrol edilmelidir.
- MCP write tool'ları write scope doğrulaması yapmalı; audit logging ana cevabı bozmayan best-effort kalmalıdır.
- Public/cookie-less asset ve API istisnaları `proxy.ts` ile `auth.config.ts` içinde birlikte korunmalıdır.

## Critical commands

```powershell
npm ci
npm run dev
npm run lint
npx tsc --noEmit
npm run db:migrate
npx drizzle-kit generate
npm run tauri:dev
npm run cap:sync
npm run mcpb:build
```

- `npm run build`, migration apply/backfill ve deployment komutları yan etkileri nedeniyle yalnızca ilgili görevde çalıştırılır.
- Migration komutundan önce `AGENTS.md` içindeki güncel migration notunu ve hedef database'i doğrula.

## Critical gotchas

- Next.js 16 eğitim verisinden farklı olabilir; local Next docs okunmadan API/route convention varsayma.
- SQLite `DEFAULT CURRENT_TIMESTAMP`, timestamp-mode Drizzle kolonlarına TEXT yazar; legacy satırlarda `Invalid Date` ve aggregate type-order sorunları vardır.
- Birçok yeni migration `_journal.json` dışında manuel apply scripti kullanır. Düz `npx tsx` komutu production Turso'yu hedefleyebilir; hedefi açıkça doğrula.
- ESM import hoisting nedeniyle `dotenv.config()` DB importundan sonra çalışamaz; DB scriptlerinde ilk import olarak `dotenv/config` kullan.
- PWA asset'leri ve bazı public endpoint'ler cookie olmadan çağrılır; matcher/auth whitelist eşleşmezse login redirect'i özelliği kırar.
- `AGENTS.md` çok büyüktür ve Codex project-doc byte limitine takılabilir; dosyanın başındaki adapter her oturumda `AI.md` okumayı zorunlu kılar.
- OneDrive/Google Drive ve Windows file lock/encoding davranışları nedeniyle edit sonrası dosyayı yeniden doğrula.

## Detailed project knowledge

Serena'da `mem:core` genel source map'tir. Kodlama kuralları ve gotcha'lar için `mem:conventions`, doğrulanmış sürümler için `mem:tech_stack`, komutlar için `mem:suggested_commands`, bitirme akışı için `mem:task_completion`, memory düzeni için `mem:memory_maintenance` kullan.

## Active work

Aktif görevi ve exact next step'i `.ai/CURRENT_TASK.md` içinden al. Mekanik Git snapshot'ı gerektiğinde `scripts/ai/update-handoff.ps1` ile yenile.
