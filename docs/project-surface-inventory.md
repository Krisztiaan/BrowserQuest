# Project Surface Inventory

The project surface inventory classifies scripts, content tools, docs, plans, external audits, and generated artifact policy before cleanup work starts.

Status values:

- `active`: Current supported entry point.
- `legacy`: Still usable for historical compatibility or fixture support, but not the preferred path.
- `replace`: Superseded by a named tool, plan, or ticket.
- `archive`: Preserve as evidence outside the active workflow.
- `delete`: Remove after dependency/reference checks prove it has no remaining value.
- `historical`: Keep as dated evidence and move under an archive/index when appropriate.

Current known replacement candidates:

- `legacy:fix:world-portals` -> Phase 2A `world-authoring-repair`.
- `legacy:fix:tileset-wang:scaffold` -> `terrain-authoring.json` plus `terrain-grammar-validator`.
- `check:world-standardize:dry` -> `terrain-authoring-audit`.
- `legacy:fix:world-standardize` -> dry-run-first `world-authoring-repair`.

## Script Cleanup Decisions

- `fix:world-portals` was moved to `legacy:fix:world-portals` because it is non-recursive and writes `target_map=world`; current portal work belongs in Phase 2 and Phase 2A repair tooling.
- `fix:world-standardize` was moved to `legacy:fix:world-standardize` because broad authoring writes must go through dry-run-first repair plans.
- `fix:tileset-wang:scaffold` was moved to `legacy:fix:tileset-wang:scaffold` because the scaffold Wang sets are audit evidence, not the final terrain grammar.
- `fix:tileset-modernize` was moved to `legacy:fix:tileset-modernize` because final tileset metadata should come from the terrain grammar and generated authoring contract.
- `fix:foreground-layers` was moved to `legacy:fix:foreground-layers` because foreground migration must be validated by the layer contract and region visual audit.
