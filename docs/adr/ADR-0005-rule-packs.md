# ADR-0005 — Regulations implemented as versioned rule packs

**Status:** ACCEPTED

## Context

Les réglementations et normes évoluent et dépendent du pays, de la date et du contexte du projet.

## Decision

Les règles externes sont isolées dans des `Rule Packs` versionnés.

Une règle doit conserver sa référence, son domaine d’application et sa date/version.

## Consequences

- aucune constante réglementaire anonyme dans le code métier ;
- plusieurs versions peuvent coexister ;
- diagnostics traçables ;
- maintenance facilitée.
