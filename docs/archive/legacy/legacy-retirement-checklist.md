> Archived historical note: this document is retained for migration history. Legacy command references (for example, `verify:legacy` or `build:client`) are non-active and may be retired.

# Legacy Runtime Retirement Checklist (T-024)

## Objective

Retire the legacy AMD/RequireJS runtime (`client/index.html` + `build:client`) without gameplay/protocol regressions, and keep a reversible rollback path.

## Readiness criteria (must all be true)

Preflight tracker: `docs/archive/legacy/legacy-retirement-preflight-gaps.md`

1. Modern runtime parity
- Core flows validated on `client/modern.html`: login, move, combat, loot, zone transitions, chat, disconnect/reconnect.
- No blocker bugs open that reproduce only on modern path.

2. Build and verification stability
- `bun run verify:modern` green on default branch for at least 2 consecutive release cycles.
- Legacy gate still green (`bun run verify:legacy`) until final cutover PR merges.

3. Operational readiness
- Team runbook updated to use modern runtime URLs/build artifacts only.
- Monitoring/logging confirms modern path coverage for expected traffic and events.

4. Migration communication
- Internal release notes include retirement date and rollback trigger conditions.
- Any downstream consumers of `client-build/` artifacts are identified and migrated.
  - Inventory source: `docs/archive/legacy/legacy-artifact-consumer-inventory.md`
  - Confirmation protocol: `docs/archive/legacy/legacy-external-consumer-confirmation-protocol.md`

## Cutover steps

1. Freeze legacy-only feature work
- Allow only critical fixes while cutover PR is prepared.

2. Remove legacy default exposure
- Stop routing new users/sessions to `client/index.html`.
- Keep a temporary feature flag for controlled fallback.

3. Remove legacy build pipeline
- Remove `build:client` and `verify:legacy` from required release gates.
- Keep one tagged release containing legacy artifacts for emergency rollback.
  - Execution checklist: `docs/archive/legacy/legacy-retirement-cutover-pr-checklist.md`

4. Cleanup code/assets
- Remove obsolete legacy-only scripts/assets and docs once rollback window expires.

## Rollback plan

Rollback trigger examples:
- P1 regression on modern runtime affecting gameplay/protocol.
- Widespread client compatibility break not covered by modern support matrix.

Rollback actions:
1. Re-enable legacy route/entry by configuration/flag.
2. Re-enable legacy build job from preserved workflow/version.
3. Redeploy last known-good release containing `client-build` artifacts.

Exit rollback mode only after:
- Root cause is fixed on modern path.
- `verify:modern` and targeted smoke checks are green.

## Decision gate

Legacy runtime may be retired only when:
- All readiness criteria are met.
- Cutover/rollback steps are reviewed and explicitly approved by maintainers.
- Final decision record is captured in `docs/archive/legacy/legacy-retirement-readiness-decision.md`.
