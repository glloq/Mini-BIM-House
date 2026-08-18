# ADR-0007 — Derived values are not authoritative persisted state

**Status:** ACCEPTED

## Decision

Les résultats calculables depuis le modèle ne sont pas une source de vérité persistante.

Ils peuvent être mis en cache avec :

- version du module ;
- hash des entrées ;
- date de calcul.

## Consequences

- absence de divergence modèle/résultat ;
- recalcul reproductible ;
- invalidation de cache obligatoire.
