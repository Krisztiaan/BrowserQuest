# Legacy Retirement Readiness Decision Gate (T-207)

Date: 2026-02-07

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
| No unresolved external `client-build/` consumer blockers | `<pass/fail>` | `<link>` |
| Rollback owner + fallback tag assigned | `<pass/fail>` | `<link>` |
| Required verification commands green | `<pass/fail>` | `<link>` |
| Maintainer signoff collected | `<pass/fail>` | `<link>` |

## Decision record

- Decision date (UTC): `<YYYY-MM-DD>`
- Outcome: `<go/no-go>`
- Decision owner: `<name>`
- Notes: `<summary>`

## Signoff

- Maintainer 1: `<name/date>`
- Maintainer 2: `<name/date>`
