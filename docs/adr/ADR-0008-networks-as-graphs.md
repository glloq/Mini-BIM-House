# ADR-0008 — Technical networks represented as graphs

**Status:** ACCEPTED

## Context

Plomberie, ventilation, chauffage et électricité nécessitent connectivité, parcours et calculs de réseau.

## Decision

Les réseaux techniques sont représentés par :

```text
Nodes + Segments + Equipment + Terminals
```

Le dessin est une représentation graphique de ce graphe.

## Consequences

- calcul de parcours ;
- continuité vérifiable ;
- dimensionnement par branche ;
- détection de composants non connectés ;
- possibilité d’algorithmes de graphes communs.
