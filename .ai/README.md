# AI çalışma durumu

Bu klasör, Claude Code ve Codex arasında görev devri için küçük ve Git ile doğrulanabilir dosyalar taşır.

- Serena memory'leri kalıcı proje bilgisidir; görev günlüğü değildir.
- `CURRENT_TASK.md` geçici görev durumu, kalan iş ve exact next step içindir.
- `DECISIONS.md` görevler arası etkisi olan dayanıklı kararlar içindir.
- `HANDOFF.generated.md` yalnızca Git metadata snapshot'ıdır ve `scripts/ai/update-handoff.ps1` tarafından üretilir.
- Sohbet özeti source of truth değildir. Kod, schema, manifest ve güncel Git durumu önceliklidir.
- Aynı working tree üzerinde yalnızca bir implementer dosya düzenler; paralel implementasyon ayrı worktree/branch gerektirir.
- Generated handoff dosyası local kalır ve Git tarafından izlenmez; diğer üç dosya paylaşılabilir proje bilgisidir.
