# ADR-0003 — Geometry units and physical units

**Status:** ACCEPTED

## Decision

La géométrie d’édition 2D utilise le millimètre comme unité interne principale.

Les modules physiques utilisent les unités SI.

Les conversions sont réalisées aux frontières des modules via le package `units`.

## Consequences

- précision intuitive pour le bâtiment ;
- calculs physiques homogènes ;
- interdiction des conversions implicites dispersées.
