# Project decisions

Görevler arası uygulanacak, gelecekteki implementasyonu etkileyen dayanıklı kararları burada kaydet.

## 2026-07-14 — Canonical ortak ajan rehberi

- Context: Projede kapsamlı bir `AGENTS.md` ve yalnızca onu import eden minimal bir `CLAUDE.md` vardı; geçici görev/handoff katmanı yoktu.
- Decision: Ortak workflow için `AI.md` canonical rehberdir. `AGENTS.md` ayrıntılı ürün/source map olarak korunur ve `AI.md` adapter'ı taşır. Serena kalıcı bilgi, yerel ve ignored `.ai/CURRENT_TASK.md` geçici durum, tracked `.ai/CURRENT_TASK.template.md` başlangıç şablonu, ignored `HANDOFF.generated.md` mekanik snapshot olarak kullanılır.
- Alternatives: Claude ve Codex için aynı proje bilgisini ayrı dosyalarda çoğaltmak; tüm ayrıntılı `AGENTS.md` içeriğini tek seferde taşımak.
- Consequences: Yeni oturumlar `AI.md` ve Git durumunu doğrular. Yapısal ürün değişiklikleri `AGENTS.md` ile ilgili Serena memory'lerini birlikte günceller.
- Related files: `AI.md`, `AGENTS.md`, `CLAUDE.md`, `.ai/README.md`, `scripts/ai/update-handoff.ps1`.

## 2026-07-29 — Aktif görev durumu working tree'ye özeldir

- Context: Aynı branch üzerinde birden fazla kişi çalışırken izlenen `.ai/CURRENT_TASK.md` sık sık merge conflict üretiyor ve bir kişinin geçici görev durumu diğerinin yerel bağlamını eziyordu.
- Decision: `.ai/CURRENT_TASK.md` Git tarafından izlenmez ve her clone/worktree kendi kopyasını tutar. İzlenen `.ai/CURRENT_TASK.template.md` yalnızca nötr başlangıç şablonudur. Paylaşılması gereken kalıcı kararlar `AI.md`, `AGENTS.md`, `DECISIONS.md` ve Serena memory'lerinde; ekipler arası görev ilerlemesi Work Plan/issue/PR yüzeyinde tutulur.
- Alternatives: `skip-worktree`; özel merge driver/`merge=ours`; kişi veya branch adına göre birden fazla tracked current-task dosyası.
- Consequences: Geçici görev notları pull/merge çatışması üretmez. Yeni clone/worktree yerel dosyayı şablondan oluşturur. Kaynak kodda paralel çalışma hâlâ ayrı branch/worktree gerektirir.
- Related files: `.gitignore`, `.ai/CURRENT_TASK.template.md`, `.ai/README.md`, `AI.md`, `AGENTS.md`, `.agents/rules/agents-document.md`.

## Template

### YYYY-MM-DD — Decision title

- Context:
- Decision:
- Alternatives:
- Consequences:
- Related files:
