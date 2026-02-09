> Archived historical note: this document is retained for migration history. Legacy command references (for example, `verify:legacy` or `build:client`) are non-active and may be retired.

# Legacy Advisory Gate Incident Template (T-198)

Use this template whenever advisory `verify-legacy` fails during demotion rehearsal.

## Metadata

- Date/time (UTC):
- PR/commit:
- Workflow run URL:
- Reporter:

## Failure summary

- Failing job/step:
- First failing line/error:
- Reproducible locally: yes/no

## Reproduction commands

1. `bun run verify:legacy:node22`
2. `bun run test:browser:legacy:node22`
3. `bun run test:browser:protocol:node22`

## Impact classification

- Risk class:
  - `P1` legacy user-facing regression
  - `P2` build/CI-only regression without known user impact
  - `P3` flake/intermittent infrastructure issue
- Affected area:
  - `build:client`
  - legacy browser runtime (`client/index.html`)
  - protocol compatibility
  - CI environment only

## Decision and action

- Decision:
  - keep advisory status
  - restore required `verify-legacy`
- Owner:
- Fix ticket/reference:
- Target date:

## Notes

- Additional context, logs, or artifacts:
