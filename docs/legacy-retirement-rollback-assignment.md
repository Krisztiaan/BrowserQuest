# Legacy Retirement Rollback Assignment Record (T-206)

Date: 2026-02-07

## Purpose

Record accountable rollback ownership and fallback release details before legacy retirement cutover.

## Required assignments

| Field | Value |
|---|---|
| Primary rollback owner | `<name>` |
| Secondary/on-call owner | `<name>` |
| Escalation channel | `<channel>` |
| Decision SLA (minutes) | `<minutes>` |
| Fallback release/tag containing legacy artifacts | `<tag>` |
| Rollback command/runbook reference | `docs/legacy-branch-protection-demotion-runbook.md` |

## Trigger conditions

1. Modern runtime P1 regression after cutover.
2. Protocol regression impacting gameplay compatibility.
3. Confirmed downstream dependency break caused by legacy artifact retirement.

## Execution checklist

- [ ] Owners assigned and acknowledged.
- [ ] Fallback release/tag validated and accessible.
- [ ] Rollback commands validated on a rehearsal environment.
- [ ] Escalation channel monitored during cutover window.

## Verification

- Record linked in:
  - `docs/legacy-retirement-cutover-pr-checklist.md`
  - `docs/legacy-retirement-preflight-gaps.md`
