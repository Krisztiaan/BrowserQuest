# Audit: Typings, Rules, Bugs, Streamlining (2026-02-12)

## TODOs

- [done] Create tickets + progress log
- [done] Run baseline checks (typecheck, lint, tests)
- [done] Scan for typing + rules tightening opportunities
- [done] Scan for potential bugs + simplifications
- [done] Produce final audit report

## Tickets

### T1 — Baseline checks

- **Scope:** Establish current baseline for `typecheck`, `lint`, and `test` so findings are grounded in actual tool output.
- **Out of scope:** Fixing every failure in the repo; only fix issues that block meaningful audit or are low-risk/high-signal.
- **Acceptance criteria:** Baseline outputs captured (pass/fail + key errors) and linked in the progress log.
- **Verification plan:** `bun run typecheck && bun run lint && bun test --timeout 20000`
- **Dependencies/blockers:** Existing working tree has many modifications/deletions; results may reflect WIP refactor state.

### T2 — Typing tightening opportunities

- **Scope:** Identify opportunities to remove `any`, reduce `as`-casts, improve discriminated unions, narrow `unknown`, tighten boundary types.
- **Out of scope:** Large architecture rewrites; protocol redesign.
- **Acceptance criteria:** Concrete list of hotspots with file references + recommended changes (with risk/effort notes).
- **Verification plan:** `bun run typecheck` and any targeted unit tests if changes are applied.
- **Dependencies/blockers:** Depends on T1 results to avoid chasing phantom errors.

### T3 — Rules (ESLint/TSConfig) and guardrails

- **Scope:** Review `eslint.config.mjs` and `tsconfig*.json` for stricter-yet-practical settings; identify rule gaps.
- **Out of scope:** Introducing new linters/tooling unless necessary.
- **Acceptance criteria:** Recommended config deltas + rationale; note any “too noisy” candidates.
- **Verification plan:** `bun run lint` and `bun run typecheck`.
- **Dependencies/blockers:** Depends on T1 to see current warning/error shape.

### T4 — Potential bugs + streamlining

- **Scope:** Look for runtime hazards (unchecked indexing, nullable flows, unsafe JSON parsing, protocol mismatch), and simplify code patterns.
- **Out of scope:** Performance micro-optimizations unless they remove correctness risk.
- **Acceptance criteria:** Prioritized bug list + suggested remediations; optional small safe patches if obvious.
- **Verification plan:** `bun test --timeout 20000` (and specific tests if added).
- **Dependencies/blockers:** Depends on T1 to ensure tests are runnable.

### T5 — Audit report

- **Scope:** Produce a consolidated report (findings + recommendations + quick wins + follow-ups).
- **Out of scope:** Implementing all recommendations immediately.
- **Acceptance criteria:** Report includes severity/impact, effort estimates, and suggested sequencing.
- **Verification plan:** N/A (report), but must reference T1 verification evidence.
- **Dependencies/blockers:** Depends on T1–T4.

## Live progress log

### 2026-02-12

#### T0 (meta) — Setup

- **Start:** 2026-02-12
- **Status:** done
- **Key actions:** Created audit doc with TODOs + tickets.
- **Evidence:** `docs/audit-typing-rules-streamlining-2026-02-12.md`
- **Next action:** Run baseline checks (T1).

#### T1 — Baseline checks

- **Start:** 2026-02-12
- **Status:** done
- **Key actions:**
  - Ran `bun run typecheck` (pass).
  - Ran `bun run lint` (pass with warnings).
  - Ran `bun test --timeout 20000` (pass).
- **Evidence:**
  - `bun run typecheck`: exit 0 (no output)
  - `bun run lint`: exit 0
  - `bun test --timeout 20000`: 194 pass, 1 skip, 0 fail
- **Next action:** Start review for typing/rules/bugs (T2–T4).

#### T2 — Typing tightening opportunities

- **Start:** 2026-02-12
- **Status:** done
- **Key actions:** Scanned for `as any` / `as unknown as` hotspots, and reviewed lint/typecheck deltas for false positives driven by TS config mismatch.
- **Evidence:**
  - `rg "\\bas any\\b" --glob='*.ts' --glob='!tests/**' --glob='!tools/**'` → all hits concentrated in `client/runtime/connection.ts`
  - `rg "\\bas unknown as\\b" --glob='*.ts'` → branded-number casts + seam adapters across server/client/shared
- **Next action:** Tighten ESLint TS project options to better match runtime typecheck and reduce false positives.

#### T3 — Rules (ESLint/TSConfig) and guardrails

- **Start:** 2026-02-12
- **Status:** done
- **Key actions:** Align ESLint’s TS project with runtime expectations; address existing lint warnings with small safe refactors.
- **Evidence:** `bun run lint` (clean) after config + code adjustments.
- **Next action:** (done) Verified `bun run typecheck` + `bun test`.

#### T4 — Potential bugs + streamlining

- **Start:** 2026-02-12
- **Status:** done
- **Key actions:** Fix obvious runtime hazards uncovered by lint (`String(unknown)` issues; unsafe parse fallbacks; `||` defaulting).
- **Evidence:** `bun test --timeout 20000` (pass), `bun run typecheck` (pass).
- **Next action:** Consolidate findings into a final audit report (T5).

#### T5 — Audit report

- **Start:** 2026-02-12
- **Status:** done
- **Key actions:** Wrote report with applied fixes + prioritized follow-ups.
- **Evidence:** This document.
- **Next action:** If desired: expand lint/typecheck coverage to the remaining high-risk areas (notably client runtime + excluded server runtime files).

## Audit report

### Executive summary

- **Baseline:** `bun run typecheck`, `bun run lint`, and `bun test --timeout 20000` pass on the current working tree.
- **Highest-leverage remaining gap:** a small number of `as unknown as` seam casts remain in server protocol/map-registry boundaries.
- **Largest remaining structural caveat:** map data cloning still uses `JSON.parse(JSON.stringify(...))` in client/server map loaders.

### Fixes applied during this audit (low-risk, verification-backed)

- `tsconfig.eslint.json`: enable `noUncheckedIndexedAccess` to align ESLint type-aware rules with runtime typecheck assumptions.
- `server/entry.ts` + `tools/content/prefabs.ts`: replace `||` defaults with `??` for CLI arg parsing.
- `server/metrics.ts`: remove redundant checks in the `onOperationError` hook and avoid `String(unknown)` when parsing player counts.
- `shared/protocol/schema.ts`: simplify schema validation control-flow with `switch` (reduces redundant conditionals and clarifies exhaustiveness).
- `server/ws/runtime-factory.ts`: avoid `[object Object]` error reasons and prevent non-string close-reason hazards by formatting `unknown` safely.

### Findings & recommendations (prioritized)

#### P0 — Tighten typing where it matters most

- **Boundary seam casts:** `server/protocol/outbound-actions.ts` and `server/world/map-registry.ts` still use `as unknown as` casts. Recommendation:
  - Replace casts with typed adapters/guards at the seam so downstream callsites remain fully typed.
  - Prefer local helper types + narrowing (`in` checks / schema shape guards) over chained assertions.

#### P1 — Align tool coverage with the code you run

- **JSON helper duplication:** `safeParseJson`/`safeParseJsonValue` logic exists in multiple protocol/shared spots. Recommendation:
  - Consolidate on shared helpers from `shared/json/safe-json.ts` to reduce drift.

#### P2 — Reduce “escape hatch” casts for branded numbers

- Several ECS/world utilities sort or do arithmetic on branded-number IDs using casts like `(a as unknown as number)`. Recommendation:
  - Add domain helpers (`entityIdToWire`, `compareEntityId`, etc.) and use those in sort/compare paths to centralize conversions and reduce scattered casts.

### Risk register (impact × likelihood)

- **Medium:** remaining seam casts (`as unknown as`) can hide shape drift at server protocol/map-registry boundaries.
- **Medium:** inconsistent error stringification (`String(object)` → `[object Object]`) reduces observability and can mask actionable errors.
- **Low:** `||` defaults on CLI args (mostly correctness/style; fixed where surfaced).

### Suggested sequencing

1. Consolidate duplicate JSON parsing helpers onto shared safe-json utilities.
2. Replace remaining `as unknown as` seam casts with local guards/adapters in protocol/map-registry boundaries.
3. Sweep any remaining branded-number casts into shared helpers and adopt across ECS/world modules.

## Follow-up execution (implemented)

- Added a focused lint target for the modern client runtime entrypoints: `package.json` (`lint:client-runtime`).
- Removed production `as any` uses in `client/runtime/connection.ts` by switching to signature-tied casts and removing redundant assertions.
- Fixed a concrete runtime bug: `client/game.ts` `removeItem(null)` no longer throws while trying to log `item.id`.
- Verification evidence:
  - `bun run lint` (exit 0)
  - `bun run lint:client-runtime` (exit 0; warnings remain)
  - `bun run typecheck` (exit 0)
  - `bun test --timeout 20000` (pass)
