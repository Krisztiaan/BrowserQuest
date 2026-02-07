# Legacy Retirement Cutover PR Checklist (T-199)

Date: 2026-02-07

Use this checklist when preparing the PR that removes legacy `build:client` pipeline and required legacy gate enforcement.

## Preconditions

- [ ] `docs/legacy-external-consumer-confirmation-protocol.md` confirms no unresolved blocking external `client-build/` consumers.
- [ ] Advisory rehearsal completed per `docs/legacy-gate-demotion-rehearsal-plan.md`.
- [ ] Rollback owner and rollback release/tag are confirmed in `docs/legacy-retirement-rollback-assignment.md`.
- [ ] Go/no-go is captured in `docs/legacy-retirement-readiness-decision.md`.

## Code and scripts

- [ ] Remove `build:client` references from active release path scripts as planned.
- [ ] Update `verify:legacy` strategy (retire or keep advisory-only command path).
- [ ] Keep modern/protocol verification gates unchanged.

## CI/workflows

- [ ] Update `.github/workflows/verify-legacy.yml` posture (manual/advisory/archive) per approved plan.
- [ ] Confirm required checks list in branch protection no longer depends on legacy gate.
- [ ] Validate CI trigger paths after workflow edits.

## Documentation

- [ ] Update `README.md` support policy and verification sections.
- [ ] Update `docs/client-build-support.md` support tiers and gate descriptions.
- [ ] Update `docs/legacy-retirement-checklist.md` with cutover completion evidence.
- [ ] Link incident template `docs/legacy-advisory-gate-incident-template.md` if advisory period remains active.

## Verification

- [ ] `bun run verify:modern:node22`
- [ ] `bun run test:browser:modern:node22`
- [ ] `bun run test:browser:protocol:node22`
- [ ] If legacy paths still present in PR: `bun run verify:legacy:node22`

## Rollback readiness

- [ ] Rollback commands documented in PR description.
- [ ] Last known-good release containing legacy artifacts is referenced.
- [ ] Branch-protection rollback steps are linked (`docs/legacy-branch-protection-demotion-runbook.md`).
