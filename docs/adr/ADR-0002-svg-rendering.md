# ADR-0002 — SVG as primary 2D rendering engine

**Status:** ACCEPTED

## Context

Le projet nécessite des plans techniques, textes, cotes, hachures, symboles et sélection interactive.

## Decision

SVG est le moteur principal de rendu 2D.

Canvas est réservé aux overlays ou champs continus lourds.

## Consequences

- rendu vectoriel ;
- DOM sélectionnable ;
- export SVG naturel ;
- styles sémantiques ;
- nécessité d’optimiser les gros dessins.
