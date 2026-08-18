# ADR-0006 — Versioned project file and explicit migrations

**Status:** ACCEPTED

## Decision

Tout fichier projet contient `schemaVersion`.

Toute rupture de compatibilité exige une migration explicite et testée.

Les migrations sont pures, déterministes et indépendantes de l’UI.

## Consequences

- compatibilité durable ;
- possibilité d’ouvrir d’anciens projets ;
- coût de maintenance assumé dès le début.
