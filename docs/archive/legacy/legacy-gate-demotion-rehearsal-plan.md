> Archived historical note: this document is retained for migration history. Legacy command references (for example, `verify:legacy` or `build:client`) are non-active and may be retired.

# Legacy Gate Demotion Rehearsal Plan (T-195)

Date: 2026-02-07

## Objective

Define a reversible, low-risk plan to demote legacy CI gate coverage (`verify:legacy`) from required to advisory once retirement blockers are cleared.

## Preconditions (must all be true)

1. `T-194` inventory complete and maintainers confirm external `client-build/` consumers are migrated or explicitly accepted.
2. `verify:legacy` has a recent stable baseline (no unresolved red runs on default branch).
3. Rollback owner and rollback release reference are identified before demotion.

## Rehearsal phases

### Phase 1: Advisory rehearsal (no removal)

1. Keep `.github/workflows/verify-legacy.yml` active, but remove required-check enforcement in branch protection.
2. Keep workflow trigger paths unchanged to preserve visibility.
3. Keep local command behavior unchanged:
   - `bun run verify:legacy`
   - `bun run verify:legacy:node22`
4. Record failures as advisory incidents and track if they indicate real production risk.

### Phase 2: Decision checkpoint

1. Evaluate advisory run history for a defined window (for example, 2 release cycles).
2. If no blocking regressions are found and external consumers are clear, proceed to retirement-cutover execution.
3. If advisory failures expose real compatibility risk, restore required status and defer cutover.

## CI workflow impact

- Code changes in this repository:
  - none required for initial rehearsal (workflow stays intact).
- Operational change outside repo:
  - branch protection rules switch `verify-legacy` from required -> optional/advisory.
- Operational runbook:
  - `docs/archive/legacy/legacy-branch-protection-demotion-runbook.md`

## Command matrix

| Stage | Required commands |
|---|---|
| Baseline before demotion | `bun run verify:modern:node22`, `bun run verify:legacy:node22`, `bun run test:browser:protocol:node22` |
| Advisory rehearsal monitoring | `bun run verify:modern:node22`, `bun run verify:legacy:node22` |
| Rollback to required | `bun run verify:legacy:node22`, `bun run test:browser:legacy:node22`, `bun run test:browser:protocol:node22` |

## Rollback triggers

1. Advisory failures reveal user-facing regressions specific to legacy runtime behavior.
2. Unknown external `client-build/` dependency is discovered after demotion.
3. Maintainers decide retirement risk is higher than expected.

## Rollback actions

1. Reinstate `verify-legacy` as required in branch protection.
2. Re-run full legacy verification matrix (legacy + protocol browser coverage).
3. Freeze further retirement changes until root cause and consumer impact are resolved.
4. Record incident using `docs/archive/legacy/legacy-advisory-gate-incident-template.md`.
5. Append incident summary row to `docs/archive/legacy/legacy-advisory-incident-log.md`.
