# Legacy Retirement Preflight Gaps (T-203)

Date: 2026-02-07

## Purpose

Track open gaps against retirement cutover checklist readiness.

Primary references:

- `docs/legacy-retirement-cutover-pr-checklist.md`
- `docs/legacy-artifact-consumer-inventory.md`
- `docs/legacy-gate-demotion-rehearsal-plan.md`
- `docs/legacy-branch-protection-demotion-runbook.md`

## Gap matrix

| Item | Status | Owner | Exit criteria | Notes |
|---|---|---|---|---|
| External `client-build/` consumer confirmation | Open | Maintainers | Explicit confirmation in inventory artifact | Repository-only scan cannot prove absence of external consumers |
| Advisory demotion dry-run execution evidence | Open | Maintainers | Dry-run PR and run URLs captured per T-202 | Requires branch protection change permissions |
| Rollback owner + rollback release/tag assignment | Open | Maintainers | Owner and release/tag recorded in cutover PR prep notes | Operational governance step |
| Legacy gate advisory incident process ready | Done | Repo | Incident template + log bootstrap checked in | See `docs/legacy-advisory-gate-incident-template.md` and `docs/legacy-advisory-incident-log.md` |
| Cutover PR execution checklist availability | Done | Repo | Checklist checked in and linked from retirement checklist | See `docs/legacy-retirement-cutover-pr-checklist.md` |

## Readiness summary

- Preflight is **not yet ready** for retirement cutover execution.
- Blocking gaps are operational (external consumer confirmation + branch-protection dry-run + rollback owner assignment), not code-level.
