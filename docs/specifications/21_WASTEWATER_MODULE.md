# 21 — Module évacuation / eaux usées

> **Module cible :** `modules/wastewater`  
> **Objectif :** représenter et vérifier les réseaux EU/EV/condensats, leurs pentes, diamètres, raccordements et ventilations.

## 1. Modèle

```text
WastewaterNetwork
├── Nodes
│   ├── fixture
│   ├── junction
│   ├── stack
│   ├── vent
│   ├── cleanout
│   └── outlet
└── Segments
    └── gravity-pipe
```

## 2. Types

```text
GREYWATER
BLACKWATER
COMBINED_WASTEWATER
CONDENSATE
VENT
OTHER
```

## 3. Segment gravitaire

```ts
interface WastewaterSegment {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  lengthM: number;
  internalDiameterM: number;
  slope: number;
  invertStartM: number;
  invertEndM: number;
  materialId: string;
}
```

`slope` est stockée sans unité comme rapport, affichable en `%` ou `mm/m`.

## 4. Géométrie verticale

Le réseau doit conserver :

- altitude fil d'eau ;
- traversée de dalle ;
- chute ;
- branchement ;
- sortie bâtiment.

Le plan 2D doit pouvoir générer un profil longitudinal simplifié.

## 5. Calculs

MVP :

- pente réelle ;
- différence d'altitude ;
- longueur ;
- débit de calcul selon méthode active ;
- taux de remplissage si méthode disponible ;
- vitesse si méthode disponible ;
- détection de contre-pente ;
- détection de tronçons déconnectés.

## 6. Pente

```text
slope = Δz / L
```

Diagnostic si :

```text
slope <= 0
```

pour un tronçon gravitaire qui doit descendre.

## 7. Dimensionnement

Les unités de raccordement, débits conventionnels, diamètres minimaux et conditions de branchement proviennent d'une méthode ou d'un Rule Pack.

Le noyau ne contient pas de tableau normatif recopié.

## 8. Ventilation du réseau

Objets :

- ventilation primaire ;
- ventilation secondaire ;
- évent ;
- clapet lorsque permis par le référentiel actif.

Le graphe doit permettre de vérifier qu'un chemin de ventilation existe lorsque requis.

## 9. Regards / accès

Objets prévus :

```text
CLEANOUT
INSPECTION_CHAMBER
MANHOLE
ACCESS_POINT
```

Le Rule Pack décide des exigences d'accessibilité.

## 10. Vue graphique

Plan :

- EU ;
- EV ;
- ventilation ;
- diamètre ;
- pente ;
- sens d'écoulement ;
- altitudes ponctuelles.

Profil :

```text
fixture → branch → stack → collector → outlet
          slope      slope       slope
```

## 11. Modes d'analyse

```text
NETWORK_TYPE
DIAMETER
SLOPE
FLOW_DIRECTION
INVERT_LEVEL
CONNECTIVITY
ERRORS
```

## 12. Warnings

```text
WASTEWATER_DISCONNECTED
WASTEWATER_REVERSE_SLOPE
WASTEWATER_ZERO_SLOPE
WASTEWATER_INVALID_DIAMETER
WASTEWATER_MISSING_VENT
WASTEWATER_LEVEL_CONFLICT
WASTEWATER_METHOD_MISSING
```

## 13. Tests

### WW-001

Vérifier `slope = Δz/L`.

### WW-002

Une contre-pente doit être détectée.

### WW-003

Un réseau déconnecté de la sortie doit être signalé.

### WW-004

Les altitudes doivent rester cohérentes après déplacement d'un nœud.

### WW-005

Les débits agrégés doivent respecter la méthode active.

## 14. Références candidates

- NF DTU 60.11 ;
- série EN 12056 pour évacuation gravitaire à l'intérieur des bâtiments ;
- règles locales d'assainissement.

Les valeurs normatives doivent être encapsulées dans des méthodes/règles versionnées.
