# AI çalışma durumu

Bu klasör, Claude Code ve Codex arasında görev devri için küçük ve Git ile doğrulanabilir dosyalar taşır.

- Serena memory'leri kalıcı proje bilgisidir; görev günlüğü değildir.
- `CURRENT_TASK.md` geçici görev durumu, kalan iş ve exact next step içindir; working tree'ye özeldir ve Git tarafından izlenmez.
- `CURRENT_TASK.template.md`, yeni clone/worktree'lerde yerel `CURRENT_TASK.md` oluşturmak için izlenen nötr şablondur.
- `DECISIONS.md` görevler arası etkisi olan dayanıklı kararlar içindir.
- `HANDOFF.generated.md` yalnızca Git metadata snapshot'ıdır ve `scripts/ai/update-handoff.ps1` tarafından üretilir.
- Sohbet özeti source of truth değildir. Kod, schema, manifest ve güncel Git durumu önceliklidir.
- Aynı working tree üzerinde yalnızca bir implementer dosya düzenler; paralel implementasyon ayrı worktree/branch gerektirir.
- `CURRENT_TASK.md` ve generated handoff dosyası local kalır ve Git tarafından izlenmez; `README.md`, `DECISIONS.md` ve `CURRENT_TASK.template.md` paylaşılabilir proje bilgisidir.
