> Archived historical note: this document is retained for migration history. Legacy command references (for example, `verify:legacy` or `build:client`) are non-active and may be retired.

# Server Core Class-Migration Plan (2026-02-07)

## Scope

Remaining `server/js/lib/class.js` dependents after tier-2 migration:

- none

## Execution order

1. Complete.

## Guardrails

- Keep module export names unchanged in each slice.
- One module migration per commit unless blocked by direct inheritance coupling.
- If startup regression occurs (`/status` timeout), fix immediately before continuing queue.
- No protocol assertion scope changes during class migration slices.

## Verification per slice

- `bun run verify:legacy:node22`
- `bun run test:browser:protocol:node22`
- `bun run check:class-fanout`

## Rollback strategy

- Revert only the current migration commit if any gate fails and root cause is non-trivial.
- Re-run full verification before starting next module.
