# Implementation Status

## Last completed PR

PR-026

## Completed

- PR-001 — npm TypeScript workspace and minimal React/Vite web application.
- PR-002 — CI workflow and validation of every schema/example pair.
- PR-003 — explicit branded engineering unit conversions.
- PR-004 — branded IDs and core project domain.
- PR-005 — material catalog domain, provenance, validation, and tests.
- PR-006 — ordered assemblies, material-reference diagnostics, and explicit thickness aggregation.
- PR-007 — millimetre geometry primitives, operations, validation, and tests.
- PR-008 — tolerant segment intersections, polyline normalization, and simple offsets.
- PR-009 — schema-aligned wall domain and assembly-derived wall faces.
- PR-010 — explicit straight-wall join topology with golden L/T/X/collinear fixtures.
- PR-011 — hosted openings, host-bound validation, and deterministic net wall area.
- PR-012 — planar-graph room boundary detection and manual/automatic spaces.
- PR-013 — typed semantic scene, view filtering, and graphic-profile tokens.
- PR-014 — deterministic, escaped SVG rendering from semantic scenes.
- PR-015 — camera transforms, cursor-anchored zoom, pan, grid and geometry snapping.
- PR-016 — immutable commands, atomic transactions, ChangeSets, and undo/redo.
- PR-017 — transient wall drawing, orthogonal/length constraints, preview, and cancel.
- PR-018 — host-projected opening insertion with reversible commands.
- PR-019 — associative wall-endpoint dimensions with derived values and undo/redo.
- PR-020 — current-schema project loading, validation, canonical save, and future-version rejection.
- PR-021 — pure sequential project migrations with before/after fixtures and journals.
- PR-022 — validated local autosave adapters and explicit crash recovery.
- PR-023 — searchable material editor model, missing-property/provenance diagnostics, and safe JSON parsing.
- PR-024 — ordered assembly cross-section editor with explicit units, materials, and hatches.
- PR-025 — traceable SI wall quantities, opening deductions, unknown-property warnings, and CSV export.
- PR-026 — deterministic calculation registry, dependency DAG, fingerprints, cache, and traceable results.

## In progress

- None.

## Next

- PR-027 — thermal layer R/U/H calculations.
- Add safe parsing from unknown JSON at persistence boundaries.

## Known issues

- Package installation is blocked in the current environment by an npm registry HTTP 403; dependency-backed checks and the web screenshot remain pending.
- Complex polygon-hole containment and mutual-overlap validation remains a geometry-hardening task.

## Architectural decisions made

- Workspace packages use the `@house-technical-designer/*` namespace.
- Geometry APIs use millimetres; explicit branded conversions isolate SI boundaries.
- Constructors reject non-finite persisted numeric values rather than inventing defaults.

## Test status

- lint: blocked by dependency installation
- typecheck: standalone production sources pass; workspace check blocked by dependency installation
- unit: blocked by dependency installation
- schemas: blocked by dependency installation
- build: blocked by dependency installation
