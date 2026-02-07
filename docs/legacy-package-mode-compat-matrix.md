# Legacy/Package-Mode Compatibility Matrix

Date: 2026-02-07

## Matrix

| Scenario | Entry path | Expected result | Required check |
|---|---|---|---|
| Baseline (current) | `bun run start:server` + legacy client | Green | `bun run verify:legacy:node22` |
| Baseline protocol | modern + legacy browser protocol suites | Green | `bun run test:browser:protocol:node22` |
| Package-mode trial | server default entry + legacy client | Green or explicit rollback trigger | `bun run verify:legacy:node22` |
| Package-mode trial | protocol browser suites | Green or explicit rollback trigger | `bun run test:browser:protocol:node22` |
| Package-mode trial | static/class guard + lint/format | Green | `bun run check:class-fanout`, `bun run lint`, `bun run format:check` |

## Rollback trigger

Any failed matrix row during trial requires immediate package-mode rollback per `docs/package-mode-trial-runbook.md`.
