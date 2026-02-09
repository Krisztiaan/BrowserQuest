> Archived historical note: this document is retained for migration history. Legacy command references (for example, `verify:legacy` or `build:client`) are non-active and may be retired.

# Legacy Branch-Protection Demotion Runbook (T-197)

Date: 2026-02-07

## Goal

Provide exact steps to demote `verify-legacy` from required to advisory status in branch protection with a reversible rollback path.

## Preconditions

1. `docs/legacy-artifact-consumer-inventory.md` is complete and external consumer status is confirmed by maintainers.
2. `docs/legacy-gate-demotion-rehearsal-plan.md` has been reviewed and approved.
3. Baseline commands are green:
   - `bun run verify:modern:node22`
   - `bun run verify:legacy:node22`
   - `bun run test:browser:protocol:node22`

## Change steps

1. Open repository branch protection settings for default branch.
2. Capture current required-status-check list for rollback reference.
3. Remove `verify-legacy` from required checks.
4. Keep modern/protocol required checks unchanged.
5. Save branch protection changes.

## Dry-run verification

1. Open a test PR that touches legacy-sensitive files (for example under `client/**`).
2. Confirm `verify-legacy` still runs when triggered by workflow paths.
3. Confirm mergeability does not depend on `verify-legacy` completion.
4. Record run links and outcomes in rehearsal notes.

## Rollback

Rollback triggers:

1. Advisory legacy failures indicate real user-impacting compatibility risk.
2. A previously unknown external `client-build/` consumer is identified.
3. Maintainers request immediate re-hardening.

Rollback steps:

1. Re-open branch protection settings.
2. Re-add `verify-legacy` to required checks.
3. Re-run:
   - `bun run verify:legacy:node22`
   - `bun run test:browser:legacy:node22`
   - `bun run test:browser:protocol:node22`
4. Confirm required-check enforcement is restored on new PRs.

Rehearsal evidence reference:

- `docs/legacy-branch-protection-dry-run-evidence.md`
