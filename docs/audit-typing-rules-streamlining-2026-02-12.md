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
  - `bun run lint`: 0 errors, 23 warnings (mostly `@typescript-eslint/no-unnecessary-condition`, `prefer-optional-chain`, `no-base-to-string`)
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
- **Highest-leverage gap:** lint/type-aware analysis previously ran with a TS project (`tsconfig.eslint.json`) that did *not* enable `noUncheckedIndexedAccess`, which produced false positives and discouraged correct defensive checks.
- **Largest typing hotspot:** production `as any` usage is concentrated in `client/runtime/connection.ts` (entity plumbing between protocol events and legacy runtime objects).

### Fixes applied during this audit (low-risk, verification-backed)

- `tsconfig.eslint.json`: enable `noUncheckedIndexedAccess` to align ESLint type-aware rules with runtime typecheck assumptions.
- `server/entry.ts` + `tools/content/prefabs.ts`: replace `||` defaults with `??` for CLI arg parsing.
- `server/metrics.ts`: remove redundant checks in the `onOperationError` hook and avoid `String(unknown)` when parsing player counts.
- `shared/protocol/schema.ts`: simplify schema validation control-flow with `switch` (reduces redundant conditionals and clarifies exhaustiveness).
- `server/ws/runtime-factory.ts`: avoid `[object Object]` error reasons and prevent non-string close-reason hazards by formatting `unknown` safely.

### Findings & recommendations (prioritized)

#### P0 — Tighten typing where it matters most

- **Client runtime event plumbing:** `client/runtime/connection.ts` uses `as any` repeatedly for entities/items/mobs. Recommendation:
  - Introduce narrow runtime-facing interfaces (e.g. `RemovableEntity`, `BlinkableItem`, `AttackLinkable`) and/or typed wrappers around `game.getEntityById`.
  - Replace `as any` casts with `as unknown as Parameters<Game['...']>[0]` as an intermediate step when the true runtime types are not yet modeled.
  - Add this file (and adjacent runtime files) to `bun run lint` coverage so regressions are caught.

#### P1 — Align tool coverage with the code you run

- **Lint coverage is curated:** the `lint` script targets a hand-picked file list, which misses large portions of `client/` and `server/` runtime code. Recommendation:
  - Add a second script (e.g. `lint:all`) that runs `eslint "{client,server,shared,tools,tests}/**/*.ts"` (plus existing ignores) so you can opt-in to full coverage in CI or before release.
- **Typecheck excludes key runtime modules:** `tsconfig.node.json` excludes `server/runtime.ts`, `server/world-server.ts`, `server/entry.ts`, and `server/startup/*.ts`. Recommendation:
  - Create incremental strict projects (like the existing `tsconfig.strict.server-config.json`) to bring these areas under `strict: true` over time rather than keeping them permanently excluded.

#### P2 — Reduce “escape hatch” casts for branded numbers

- Several ECS/world utilities sort or do arithmetic on branded-number IDs using casts like `(a as unknown as number)`. Recommendation:
  - Add domain helpers (`entityIdToWire`, `compareEntityId`, etc.) and use those in sort/compare paths to centralize conversions and reduce scattered casts.

### Risk register (impact × likelihood)

- **High:** client runtime `as any` plumbing (silent runtime mis-wiring or method-missing crashes when protocol/entity shapes drift).
- **Medium:** missing lint/typecheck coverage for excluded server runtime files (regressions can sneak in behind passing `typecheck`).
- **Medium:** inconsistent error stringification (`String(object)` → `[object Object]`) reduces observability and can mask actionable errors.
- **Low:** `||` defaults on CLI args (mostly correctness/style; fixed where surfaced).

### Suggested sequencing

1. Add `lint:all` (or expand existing `lint`) to include the high-churn runtime files you care about now.
2. Add strict typecheck projects for `server/startup/**` and the websocket runtime boundary (smallest, highest-signal).
3. Replace `as any` in `client/runtime/connection.ts` via typed adapters/interfaces, then enforce with lint.
4. Sweep branded-number casts into shared helpers and adopt them across ECS/world modules.

## Follow-up execution (implemented)

- Added a focused lint target for the modern client runtime entrypoints: `package.json` (`lint:client-runtime`).
- Removed production `as any` uses in `client/runtime/connection.ts` by switching to signature-tied casts and removing redundant assertions.
- Fixed a concrete runtime bug: `client/game.ts` `removeItem(null)` no longer throws while trying to log `item.id`.
- Verification evidence:
  - `bun run lint` (exit 0)
  - `bun run lint:client-runtime` (exit 0; warnings remain)
  - `bun run typecheck` (exit 0)
  - `bun test --timeout 20000` (pass)
