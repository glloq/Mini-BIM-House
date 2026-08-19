# Implementation Status

## Last completed PR

PR-068

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
- PR-027 — traceable thermal layer R/U/H calculations with explicit surface-method inputs and unknown-value diagnostics.
- PR-028 — deterministic room, zone, level, and building thermal aggregation with manual bridge contributions.
- PR-029 — semantic U-value and design heat-loss overlays with explicit units, scales, and missing-data values.
- PR-030 — validated Rule Pack contracts, date-aware version registry, explicit overlap conflicts, and UNKNOWN results.
- PR-031 — safe declarative evaluation, protected property paths, and versioned registered rule functions without dynamic code execution.
- PR-032 — traceable rule report view models and responsive evidence UI without implicit compliance claims.
- PR-033 — schema-aligned technical network graphs with port validation, connectivity, paths, components, and cycle detection.
- PR-034 — transient network routing with compatible-port snapping, node placement, path editing, and reversible snapshots.
- PR-035 — unit-bearing network analysis overlays with explicit unknown/error states and semantic scene projection.
- PR-036 — typed potable, hot-water, recirculation, non-potable, and rainwater network extensions with cross-connection diagnostics.
- PR-037 — SI hydraulic area, velocity, Darcy-Weisbach losses, elevation pressure, and node continuity with unknown propagation.
- PR-038 — deterministic catalog pipe sizing with externally supplied limits and uncertainty-safe smallest-diameter selection.
- PR-039 — semantic plumbing plan primitives and SI pipe inspector models with explicit missing-data warnings.
- PR-040 — validated hourly, daily, monthly, and design climate datasets with completeness, explicit gaps, and deterministic fingerprints.
- PR-041 — uncertainty-safe rainwater time-step simulation with explicit top-up, overflow, indicators, and mass-conservation tests.
- PR-042 — deterministic tank-capacity comparison with explicit initial-fill policy, marginal gains, and a unit-bearing chart model.
- PR-043 — external Rule Pack integration for rainwater prefilter evidence with explicit UNKNOWN results and hydraulic isolation.
- PR-044 — typed ventilation networks with terminals, ducts, fans, filters, dampers, heat recovery, and uncertainty-safe validation.
- PR-045 — SI duct area, velocity, Darcy-Weisbach losses, airflow continuity, and critical-branch analysis with unknown propagation.
- PR-046 — semantic ventilation plans, unit-bearing duct inspectors, and flow, velocity, and pressure overlays with explicit unknown states.
- PR-047 — analytical well-mixed room CO2 time-step balance with explicit SI inputs, summaries, and unknown propagation.
- PR-048 — graph-backed electrical boards, circuits, loads, protections, and cables with explicit reference validation.
- PR-049 — installed/design power, voltage-reference-aware current, and resistive path voltage-drop calculations with catalog-supplied resistance.
- PR-050 — semantic electrical cable and symbol plans with circuit, current, and voltage-drop overlays and explicit unknown states.
- PR-051 — traceable lumen-method lighting, target quantity proposals, deterministic grid placement, and electrical load adapters.
- PR-052 — roof-linked solar surfaces with derived inclined area, orientation, obstacles, exclusions, and explicit unknown heights.
- PR-053 — deterministic roof-plane photovoltaic layout with portrait/landscape comparison, margins, gaps, and obstacle/exclusion avoidance.
- PR-054 — traceable offline photovoltaic energy estimates and an HTTP-free, injected PVGIS transport contract with boundary validation.
- PR-055 — hourly battery dispatch with SOC/power limits, charge/discharge losses, off-grid unmet energy, and conservation tests.
- PR-056 — aligned whole-building energy aggregation across uses, vectors, PV, battery, and grid with external primary-energy factors.
- PR-057 — steady-state hygrothermal interface profiles and surface-condensation screening with explicit method limits and unknown propagation.
- PR-058 — traceable room and building heating loads with explicit transmission, ventilation, heat-recovery, and additional-load terms.
- PR-059 — traceable domestic-hot-water useful energy, ideal mixing, storage equivalence, and reheating time with explicit water properties.
- PR-060 — graph-backed gravity wastewater slopes, connectivity, level diagnostics, and externally supplied design-flow aggregation.
- PR-061 — per-band room equivalent absorption, simplified traceable reverberation time, and external treatment comparisons.
- PR-062 — immutable physical quantities, packaging and waste allowances, material/labor pricing, lot totals, currency diagnostics, and scenario comparison.
- PR-063 — explicit environmental declaration links, functional-unit conversion, life-cycle impacts, validity warnings, and traceable item/lot/level/building totals.
- PR-064 — versioned, safe semantic symbol library v1 with paper/model scaling, profile overrides, and architecture, water, ventilation, and electrical symbols.
- PR-065 — validated generic and initial French graphic profiles with paper line weights, screen colors, monochrome print variants, and complete semantic-role coverage.
- PR-066 — millimetre-based standard/custom sheets, printable-area and viewport validation, reusable title-block templates, and explicit unknown fields.
- PR-067 — deterministic clean SVG export with canonical metadata, semantic groups, stable fingerprints, safe filenames, and interaction-free technical output.
- PR-068 — ordered vector PDF print jobs with sheet sizes, explicit metadata, injected traceable conversion backends, and validated PDF artifacts.
- PR-069 — deterministic four-room reference house exercising canonical persistence, integrated energy calculations, technical networks, and semantic SVG export.
- PR-070 — reproducible microbenchmark baseline for 100 walls, 1,000 SVG primitives, a 500-segment network, annual hourly battery dispatch, and complete thermal aggregation.
- PR-071 — MVP user guide covering quick start, core concepts, precision levels, and explicit product limitations.

## In progress

- PR-072 — release 0.1 readiness assessment.

## Next

- Resolve the documented application, deployment, and licensing blockers before declaring release 0.1.

## Known issues

- Complex polygon-hole containment and mutual-overlap validation remains a geometry-hardening task.

## Pre-PR69 stabilization

Completed in the current stabilization checkpoint:

- Canonical `Project` level collections now use typed wall, opening, space, slab,
  and MVP roof-plane contracts; material, assembly, equipment, network, scenario,
  and module-setting collections no longer use arbitrary JSON arrays.
- `project.schema.json` composes the canonical first-class schemas, including the
  new MVP `RoofPlane` definition, instead of accepting untyped building arrays.
- Project I/O now performs nested validation for all MVP building elements and
  rejects non-finite nested geometry before returning a typed project.
- Project I/O uses a generated standalone validator compiled from the canonical
  JSON Schemas, with a reproducibility check and separate project-reference
  integrity validation; populated persistence round trips are covered.
- Calculation precision and warning names are aligned with specification 36 and
  the persisted calculation-result schema.
- CI uses reproducible `npm ci` installation.
- Canonical project commands now provide immutable cross-domain undo/redo and an
  explicit assembly invalidation map without copying persisted state into the
  editor facade.
- Polygon holes now reject degeneracy, self-intersection, outer-boundary
  crossing/touching, outside placement, mutual intersection, and containment.
- The calculation orchestrator now requires explicit serializable settings
  schemas, input ownership, and validation before execution. Real adapters cover
  thermal → heating and lighting/PV → battery → energy-balance with stable energy
  use IDs and a conservation check.
- Real adapters also exercise water, rainwater, ventilation, wastewater, IAQ,
  hygrothermal, acoustics, DHW, cost, and environmental scientific kernels.
- The populated pre-reference fixture covers one level, wall, opening, slab,
  roof, space, materials, assemblies, water/ventilation/electrical networks, PV,
  battery and climate-driven invariants without creating the PR-069 example.
- Cross-contract tests serialize real TypeScript objects and validate ProjectFile,
  Material, Assembly, building elements, TechnicalNetwork, RulePack,
  CalculationResult, and ModuleSettings against their canonical JSON Schemas.

PR-068A readiness:

- Required persistence, schema/type, calculation orchestration, energy ownership,
  editor command, geometry-hole, physical-invariant, rule-state, and CI gates pass.
- PR-069 now provides the separate end-to-end reference-house change.

Release blockers (non-PR69 architecture work):

- The web app now creates, validates, imports, summarizes, saves, previews and
  exports canonical projects and draws validated walls directly on the plan through
  a persistent undo/redo command session. v0.1 still needs library editors,
  calculation controls, and technical overlays.
- GitHub Pages deployment is configured to run only after successful CI on main.
- A project license must be selected before a public stable release.
- Stair remains deliberately deferred because it is not required by the PR-069
  reference house; no detailed roof modeller was introduced beyond `RoofPlane`.

## Architectural decisions made

- Workspace packages use the `@house-technical-designer/*` namespace.
- Geometry APIs use millimetres; explicit branded conversions isolate SI boundaries.
- Constructors reject non-finite persisted numeric values rather than inventing defaults.

## Test status

- format: pass
- lint: pass
- typecheck: pass across all workspaces
- unit: 399 tests pass across 71 files
- schemas: all 13 schema/example pairs pass
- build: pass across all workspaces
