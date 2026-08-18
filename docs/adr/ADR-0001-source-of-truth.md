# ADR-0001 — Building model as single source of truth

**Status:** ACCEPTED

## Context

Plusieurs vues techniques doivent représenter la même habitation.

## Decision

Le `Project` et son `Building Domain Model` constituent l’unique source de vérité persistante.

Les plans plomberie, thermique, électrique, ventilation et autres sont des projections du même modèle.

## Consequences

- aucune copie indépendante de la géométrie par discipline ;
- recalcul centralisé ;
- cohérence inter-modules ;
- davantage de rigueur dans le modèle de domaine.
