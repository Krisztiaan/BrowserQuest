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

- `fix:world-portals` -> Phase 2A `world-authoring-repair`.
- `fix:tileset-wang:scaffold` -> `terrain-authoring.json` plus `terrain-grammar-validator`.
- `check:world-standardize:dry` -> `terrain-authoring-audit`.
- `fix:world-standardize` -> dry-run-first `world-authoring-repair`.
