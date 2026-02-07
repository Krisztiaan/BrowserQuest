# Legacy Branch-Protection Demotion Dry-Run Evidence (T-202)

Date: 2026-02-07

## Dry-run setup

- Repository: `Krisztiaan/BrowserQuest`
- Baseline default branch (`modernize`) protection status: not protected.
- Rehearsal scope: sandbox protected branch `t202-protected` (created for dry-run only).

## Executed steps

1. Created sandbox protected target branch from `modernize` head.
2. Applied required checks on `t202-protected`:
   - `modern (node 22.x)`
   - `legacy (node 22.x)`
3. Opened rehearsal PR:
   - https://github.com/Krisztiaan/BrowserQuest/pull/1
4. Captured initial PR state:
   - `mergeStateStatus = BLOCKED` while required checks were in progress.
5. Demoted required checks on `t202-protected`:
   - removed `legacy (node 22.x)`
   - kept `modern (node 22.x)` required
6. Captured final PR state:
   - `mergeStateStatus = CLEAN`

## Workflow run URLs (pull_request runs)

- verify-legacy: https://github.com/Krisztiaan/BrowserQuest/actions/runs/21775481193
- verify-modern: https://github.com/Krisztiaan/BrowserQuest/actions/runs/21775481217
- verify-legacy-browser: https://github.com/Krisztiaan/BrowserQuest/actions/runs/21775481203
- verify-modern-browser: https://github.com/Krisztiaan/BrowserQuest/actions/runs/21775481200
- verify-protocol-invariant: https://github.com/Krisztiaan/BrowserQuest/actions/runs/21775481199

Outcome:

- All listed pull_request workflow runs completed successfully during rehearsal.

## Rollback readiness and cleanup

Executed rollback path immediately after evidence capture:

1. Removed protection from sandbox branch (`t202-protected`).
2. Closed rehearsal PR without merge:
   - https://github.com/Krisztiaan/BrowserQuest/pull/1
3. Deleted temporary remote branches:
   - `t202-dry-run`
   - `t202-protected`

Verification:

- Protection endpoint now returns `Branch not protected` for `t202-protected`.

## Notes

- Because `modernize` had no branch protection at baseline, this was a sandbox rehearsal of the runbook mechanics rather than a production branch-protection change.
