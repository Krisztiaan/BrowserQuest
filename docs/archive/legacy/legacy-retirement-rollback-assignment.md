# Legacy Retirement Rollback Assignment Record (T-206)

Date: 2026-02-07

Execution status (2026-02-08): `done`.

## Purpose

Record accountable rollback ownership and fallback release details before legacy retirement cutover.

## Required assignments

| Field | Value |
|---|---|
| Primary rollback owner | `Maintainer on-call (session owner)` |
| Secondary/on-call owner | `Maintainer backup rotation` |
| Escalation channel | `Maintainer incident channel + repository issue escalation` |
| Decision SLA (minutes) | `30` |
| Fallback release/tag containing legacy artifacts | `pre-cutover baseline commit ee38fea` |
| Rollback command/runbook reference | `docs/archive/legacy/legacy-branch-protection-demotion-runbook.md` |

## Trigger conditions

1. Modern runtime P1 regression after cutover.
2. Protocol regression impacting gameplay compatibility.
3. Confirmed downstream dependency break caused by legacy artifact retirement.

## Execution checklist

- [x] Owners assigned and acknowledged.
- [x] Fallback release/tag validated and accessible.
- [x] Rollback commands validated on a rehearsal environment.
- [x] Escalation channel monitored during cutover window.

## Verification

- Record linked in:
  - `docs/archive/legacy/legacy-retirement-cutover-pr-checklist.md`
  - `docs/archive/legacy/legacy-retirement-preflight-gaps.md`
