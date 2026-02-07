# Legacy External Consumer Confirmation Protocol (T-205)

Date: 2026-02-07

## Purpose

Confirm whether any downstream users still rely on `client-build/` artifacts before retirement cutover.

## Inputs

- Consumer inventory baseline: `docs/legacy-artifact-consumer-inventory.md`
- Preflight tracker: `docs/legacy-retirement-preflight-gaps.md`

## Confirmation workflow

1. Identify stakeholder list:
   - maintainers,
   - deployment owners,
   - any release/distribution consumers.
2. Send confirmation request with explicit cutoff date.
3. Record each response in the log table below.
4. Classify result:
   - `no-consumer` (safe for retirement planning),
   - `active-consumer` (retirement blocked until migration),
   - `unknown` (no response by cutoff).
5. Update preflight gap status after cutoff decision.

## Request template

Subject: `BrowserQuest legacy client-build consumer confirmation (cutoff <DATE>)`

Questions:

1. Do you currently consume artifacts from `client-build/`?
2. If yes, what environment or workflow depends on them?
3. Can you migrate to modern artifacts by `<DATE>`?
4. Who is the owner for this dependency?

## Response log

| Date (UTC) | Stakeholder | Response | Classification | Owner | Migration target date | Notes |
|---|---|---|---|---|---|---|
| `<YYYY-MM-DD>` | `<name/team>` | `<summary>` | `no-consumer/active-consumer/unknown` | `<owner>` | `<date or n/a>` | `<details>` |

## Completion criteria

- Every identified stakeholder has either:
  - confirmed `no-consumer`, or
  - provided an owned migration plan with target date.
- No unresolved `unknown` entries remain past cutoff date.
