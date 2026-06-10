# BrowserQuest Modernization Progress

This is the live execution notebook for `PLAN.md`.

## Current Constraints

- Branch: `modern/cx`.
- Use `rtk` for commands.
- Do not revert unrelated user changes.
- Keep `PLAN.md` as the live plan and update it when investigations change scope or order.
- Treat `EXTERNAL-AUDIT.md` as evidence until Phase 0A archives/imports it.
- Do not run write-capable legacy map or tileset tools unless the relevant ticket explicitly requires it.

## Current Working Tree Snapshot

- `PLAN.md` is untracked plan work from the planning phase.
- `EXTERNAL-AUDIT.md` is untracked external evidence from the audit phase.

## Ticket Log

### 2026-06-10 11:00 - Ticket 0.1 Restore Formatting Baseline

- Status: done
- Scope:
  - Fix only current formatting failures in the configured Prettier lane.
  - Do not broaden Prettier scope.
- Key actions:
  - Created `PROGRESS.md` as the live notebook.
  - Confirmed the formatting failure was scoped to `server/log.ts`.
  - Ran the configured formatter.
- Evidence:
  - `rtk bun run format:check`: failed before fix with `server/log.ts`.
  - `rtk bun run format`: rewrote `server/log.ts`; all other configured files unchanged.
  - `rtk bun run format:check`: pass, `All matched files use Prettier code style!`
  - `rtk git diff --check`: pass.
- Next action:
  - Commit Ticket 0.1 and start Ticket 0.2 typecheck baseline.

### 2026-06-10 11:10 - Ticket 0.2 Restore TypeScript Baseline

- Status: done
- Scope:
  - Fix current `bun run typecheck` failures without feature refactors or map-pack behavior changes.
- Key actions:
  - Ticket 0.1 committed as execution baseline.
  - Fixed combat windup logging position narrowing in `server/world/ecs-command-pipeline.ts`.
  - Preserved branded `GridPos` through `resolvePlanOrigin` in `client-command-apply-system.ts`.
  - Extended the movement prediction host player contract to match `VisualBridgeCharacterLike`.
  - Replaced fragile non-character interpolation narrowing with an explicit adapter/predicate pair.
  - Updated `tests/unit/mmo/server-door-traversal.test.ts` to use the current `world_01` map id contract.
- Evidence:
  - `rtk bun run typecheck`: failed before fixes with TS18048, TS2345, VisualBridgeCharacterLike, and `never` narrowing errors.
  - `rtk bun run typecheck`: pass after fixes.
  - `rtk bun test tests/unit/ecs/client-attack-intent-follow.test.ts tests/unit/ecs/client-auto-aggro-system.test.ts tests/unit/mmo/server-door-traversal.test.ts --timeout 20000`: pass, 17 pass / 0 fail.
- Next action:
  - Commit Ticket 0.2 and start Ticket 0.3 lint baseline.
