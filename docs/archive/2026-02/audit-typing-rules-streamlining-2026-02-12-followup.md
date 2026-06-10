> Historical evidence: this audit records the state and decisions from February 2026. Use `PLAN.md` and `docs/README.md` for current implementation guidance.

# Audit (Follow-up): Typings, Rules, Bugs, Streamlining (2026-02-12)

Context: This is a follow-up audit after recent refactors/commits. It re-establishes baseline tool output and records additional opportunities.

## TODOs

- [done] Create tickets + progress log
- [done] Run baseline checks (lint/typecheck/tests)
- [done] Identify low-hanging typing/rules improvements
- [done] Identify potential bugs + simplifications
- [done] Produce consolidated audit report

## Tickets

### F1 — Baseline (current HEAD)

- **Scope:** Capture `lint`, `lint:client-runtime`, `typecheck`, `test`, and `format:check` outcomes.
- **Acceptance criteria:** Commands run and outcomes recorded with pass/fail and notable warnings.
- **Verification plan:** `bun run lint && bun run lint:client-runtime && bun run typecheck && bun test --timeout 20000 && bun run format:check`
- **Dependencies/blockers:** None.

### F2 — Typing + rules tightening (incremental)

- **Scope:** Identify (and optionally implement) low-risk changes that reduce unsoundness (`any`/`unknown`), remove redundant conditionals, and align TS/ESLint expectations.
- **Out of scope:** Large rewrites of legacy client runtime (`client/game.ts`) unless needed for correctness.
- **Acceptance criteria:** Short prioritized list with file refs and suggested changes; apply only verification-backed safe edits.
- **Verification plan:** Re-run F1 commands after any code changes.
- **Dependencies/blockers:** Depends on F1.

### F3 — Potential bugs + streamlining

- **Scope:** Look for crashers, incorrect null-handling, unchecked indexing, unsafe JSON parsing, and logging/observability hazards; propose simplifications.
- **Acceptance criteria:** Prioritized list with risk/impact and concrete next actions; apply any obvious fixes.
- **Verification plan:** Targeted unit tests (if applicable) + F1 commands.
- **Dependencies/blockers:** Depends on F1.

### F4 — Audit report

- **Scope:** Produce a consolidated report: what’s solid, what’s risky, what to do next.
- **Acceptance criteria:** Report includes “quick wins”, “medium effort”, “bigger refactors”, and a short risk register.
- **Verification plan:** N/A (report), but must reference F1 evidence.
- **Dependencies/blockers:** Depends on F1–F3.

## Live progress log

### 2026-02-12

- **F0 start:** 2026-02-12
- **Status:** in_progress
- **Key actions:** Created follow-up audit doc with TODOs + tickets.
- **Evidence:** `docs/archive/2026-02/audit-typing-rules-streamlining-2026-02-12-followup.md`
- **Next action:** Run F1 baseline commands.

#### F1 — Baseline (current HEAD)

- **Start:** 2026-02-12
- **Status:** done
- **Key actions:**
  - Ran `bun run lint` (pass).
  - Ran `bun run lint:client-runtime` (pass).
  - Ran `bun run typecheck` (pass).
  - Ran `bun test --timeout 20000` (pass; 1 optional test skipped).
  - Ran `bun run format:check` (initially failed on 2 Playwright files; fixed by running `bun run format`; check now passes).
- **Evidence:**
  - `bun run format:check`: pass after formatting `tests/browser/modern-protocol-actions.playwright.ts` and `tests/browser/modern-ui-smoke.playwright.ts`
  - `bun test --timeout 20000`: 194 pass, 1 skip, 0 fail
- **Next action:** Run scans for additional typing/rules/bug opportunities (F2/F3).

#### F2 — Typing + rules tightening (incremental)

- **Start:** 2026-02-12T01:44:25+00:00
- **Status:** done
- **Key actions:**
  - Removed remaining non-null assertions in `shared/maps/processmap.ts` by initializing optional map fields via `??=` inside the relevant mode branches.
  - Replaced `as unknown as number` EntityId sorts with `entityIdToWire` comparators for deterministic ordering in ECS utilities:
    - `server/ecs/archetype-index.ts`
    - `server/ecs/spatial-index.ts`
    - `server/ecs/interest-tracker.ts`
- **Evidence:**
  - Re-ran F1 verification after changes (all pass): `bun run lint`, `bun run lint:client-runtime`, `bun run typecheck`, `bun test --timeout 20000`, `bun run format:check`
- **Next action:** Record remaining F3 findings and produce consolidated report (F4).

#### F3 — Potential bugs + streamlining

- **Start:** 2026-02-12T01:44:25+00:00
- **Status:** done
- **Key actions:**
  - Scanned for non-null assertions (none found after F2).
  - Inventoried `as unknown as` usage (mostly legacy boundaries + plugin/module seams) and `JSON.parse` callsites.
- **Early notes / opportunities:**
  - **Boundary casts:** `client/runtime/connection.ts` and `client/game.ts` contain several `as unknown as …` casts bridging the legacy runtime to newer typed seams; consider wrapping these in small adapter functions (single cast site) to reduce scattering.
  - **JSON parsing:** Most protocol parsing already uses `try/catch` + schema checks (`shared/protocol/{registry,contract}.ts`). Remaining `JSON.parse(...) as RuntimeConfig` style casts (e.g. `server/startup.ts`) could be tightened by validating the parsed object shape before returning it.
  - **Clone via JSON stringify:** `client/map-source.ts` and `server/map.ts` use `JSON.parse(JSON.stringify(...))` for deep cloning; safe for plain data, but it silently drops `undefined`, `Infinity`, and non-JSON values. If map data evolves, consider `structuredClone` (where available) or a typed clone function.
- **Next action:** Produce consolidated audit report (F4) and mark F3 done.

#### F4 — Audit report

- **Start:** 2026-02-12T01:44:25+00:00
- **Status:** done

## Consolidated audit report (F4)

### What’s solid

- Baseline checks are clean (eslint, typecheck, tests, prettier check).
- Protocol boundaries already do defensive parsing with `try/catch` and runtime validators (`shared/protocol/schema.ts`).

### Quick wins (done)

- Removed non-null assertions from `shared/maps/processmap.ts` by using `??=` initialization.
- Replaced EntityId numeric-sort casts in ECS helper structures with `entityIdToWire(...)` comparators.

### Quick wins (recommended next)

- Consolidate repeated `safeParseJson` helpers (client + shared protocol) into one shared helper (keep return type `unknown` + narrow via guards).
- For new code: prefer `satisfies` over `as` assertions when shaping constants (keeps inference while validating keys).

### Medium effort

- Reduce `as unknown as` usage in the legacy client runtime by introducing explicit adapter seams (typed wrappers that call into `client/game.ts`).
- Tighten config-loading typing (`server/startup.ts`): validate parsed JSON object and reuse existing preflight helpers instead of returning `RuntimeConfig` via assertion.

### Bigger refactors (only if needed)

- Gradually migrate `client/game.ts` and legacy entity collections toward typed kernel-driven views (so connection/runtime no longer needs cast-heavy bridging).

### Risk register (short)

1. **Legacy boundary casts hide shape drift** (client runtime): moderate likelihood, medium impact.
2. **JSON stringify clone silently drops values** (maps/config): low likelihood today, potentially high impact if map/config structures grow non-JSON types.
3. **Config parsing returns asserted types** (`server/startup.ts`): low likelihood if preflight always runs, medium impact if a call path bypasses it.
