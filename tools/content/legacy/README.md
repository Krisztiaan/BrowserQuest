# Legacy Content Tools

These tools are preserved as historical migration evidence. They are not current authoring workflow entry points.

## Tools

- `world-curate-portals.ts`
  - Replacement: Phase 2 explicit door/portal semantics plus Phase 2A `world-authoring-repair`.
  - Reason: The old tool is non-recursive and writes stale `target_map=world` semantics.
- `tileset-wang-scaffold.ts`
  - Replacement: `assets/maps/tiled/terrain-authoring.json` plus `tools/content/terrain-grammar-validator.ts`.
  - Reason: Scaffold Wang sets are incomplete audit hints, not the target terrain grammar.
- `tileset-modernize-metadata.ts`
  - Replacement: `assets/maps/tiled/terrain-authoring.json` plus generated tileset metadata from Phase 2A.
  - Reason: Broad metadata writes must be driven by the approved terrain grammar.
- `maps-migrate-v-to-foreground.ts`
  - Replacement: `shared/maps/layer-contract.ts`, `world-map-validator.ts`, and Phase 2A visual review.
  - Reason: Foreground migration must be validated against layer taxonomy and visual artifacts.
- `world-standardize-pipeline.ts`
  - Replacement: Phase 2A dry-run-first authoring repair.
  - Reason: Broad write pipelines are too risky before the terrain grammar and visual audit exist.
- `world-standardize-idiomatic.ts`
  - Replacement: Phase 2A dry-run-first authoring repair and targeted validators.
  - Reason: Broad normalization should be decomposed into explicit, reviewed repair rules.
