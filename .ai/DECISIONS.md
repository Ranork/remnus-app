# Project decisions

Görevler arası uygulanacak, gelecekteki implementasyonu etkileyen dayanıklı kararları burada kaydet.

## 2026-07-14 — Canonical ortak ajan rehberi

- Context: Projede kapsamlı bir `AGENTS.md` ve yalnızca onu import eden minimal bir `CLAUDE.md` vardı; geçici görev/handoff katmanı yoktu.
- Decision: Ortak workflow için `AI.md` canonical rehberdir. `AGENTS.md` ayrıntılı ürün/source map olarak korunur ve `AI.md` adapter'ı taşır. Serena kalıcı bilgi, `.ai/CURRENT_TASK.md` geçici durum, ignored `HANDOFF.generated.md` mekanik snapshot olarak kullanılır.
- Alternatives: Claude ve Codex için aynı proje bilgisini ayrı dosyalarda çoğaltmak; tüm ayrıntılı `AGENTS.md` içeriğini tek seferde taşımak.
- Consequences: Yeni oturumlar `AI.md` ve Git durumunu doğrular. Yapısal ürün değişiklikleri `AGENTS.md` ile ilgili Serena memory'lerini birlikte günceller.
- Related files: `AI.md`, `AGENTS.md`, `CLAUDE.md`, `.ai/README.md`, `scripts/ai/update-handoff.ps1`.

## Template

### YYYY-MM-DD — Decision title

- Context:
- Decision:
- Alternatives:
- Consequences:
- Related files:
