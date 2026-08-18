# ADR-0004 — Stable calculation module API

**Status:** ACCEPTED

## Context

Les modules doivent être ajoutables sans dépendance directe à l’UI.

## Decision

Tout module de calcul expose une interface commune comprenant au minimum :

- identifiant ;
- version ;
- dépendances ;
- validation ;
- calcul ;
- métadonnées de résultat.

Le moteur d’orchestration appelle les modules et gère leurs dépendances.

## Consequences

- tests indépendants ;
- calculs exécutables dans Web Workers ;
- possibilité de modules additionnels ;
- résultats standardisés.
