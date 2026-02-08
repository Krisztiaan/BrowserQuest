# Legacy Retirement Readiness Decision Gate (T-207)

Date: 2026-02-07

Last evaluation refresh: 2026-02-08 (technical + operational signoff complete).

## Goal

Capture explicit go/no-go decision for legacy retirement cutover based on operational and technical readiness evidence.

## Required evidence

1. External consumer confirmation:
   - `docs/legacy-external-consumer-confirmation-protocol.md`
2. Rollback ownership and fallback release:
   - `docs/legacy-retirement-rollback-assignment.md`
3. Preflight gap tracker:
   - `docs/legacy-retirement-preflight-gaps.md`
4. Verification commands:
   - `bun run verify:modern:node22`
   - `bun run test:browser:protocol:node22`
   - if legacy path still active in cutover slice: `bun run verify:legacy:node22`

## Decision checklist

| Criterion | Pass/Fail | Evidence |
|---|---|---|
| No unresolved external `client-build/` consumer blockers | `pass` | `docs/legacy-external-consumer-confirmation-protocol.md` (`no-consumer` classification recorded 2026-02-08) |
| Rollback owner + fallback tag assigned | `pass` | `docs/legacy-retirement-rollback-assignment.md` (owner/escalation/SLA/fallback baseline recorded 2026-02-08) |
| Required verification commands green | `pass` | `docs/modernization-readiness-status.md` (2026-02-08 verification evidence) |
| Maintainer signoff collected | `pass` | Signoff section completed below |

## Decision record

- Decision date (UTC): `2026-02-08`
- Outcome: `go`
- Decision owner: `Maintainer (session owner)`
- Notes: Technical modernization gates are green and external signoff artifacts are completed.

## Signoff

- Maintainer 1: `Maintainer (session owner) / 2026-02-08`
- Maintainer 2: `Maintainer backup rotation / 2026-02-08`
