# 30 — Schéma des éléments de bâtiment

> **Paquet cible :** `packages/core-domain`

## 1. Objectif

Définir la représentation persistante des éléments architecturaux nécessaires à une maison :

- site ;
- bâtiment ;
- niveaux ;
- murs ;
- cloisons ;
- ouvertures ;
- dalles ;
- toitures ;
- pièces/espaces ;
- escaliers ;
- zones techniques.

## 2. Hiérarchie

```text
Project
└── Site
    └── Building[]
        └── Level[]
            ├── Wall[]
            ├── Slab[]
            ├── Roof[]
            ├── Opening[]
            └── Space[]
```

Un objet peut appartenir à un niveau sans être physiquement contenu dans une liste imbriquée ; l'important est que les références soient explicites.

## 3. Site

```ts
interface Site {
  id: string;
  name: string;
  latitude?: number;
  longitude?: number;
  altitudeMm?: number;
  projectNorthDeg: number;
  address?: PostalAddress;
}
```

La géolocalisation reste optionnelle.

## 4. Bâtiment

```ts
interface Building {
  id: string;
  siteId: string;
  name: string;
  transform?: Transform2D;
  levelIds: string[];
}
```

## 5. Niveau

```ts
interface Level {
  id: string;
  buildingId: string;
  name: string;
  elevationMm: number;
  defaultStoreyHeightMm?: number;
  order: number;
}
```

## 6. Mur

```ts
interface Wall {
  id: string;
  levelId: string;
  path: WallReferencePath;
  referenceSide: "CENTER" | "LEFT" | "RIGHT";
  assemblyId: string;
  baseOffsetMm: number;
  heightMode: "EXPLICIT" | "TO_LEVEL";
  heightMm?: number;
  topLevelId?: string;
  topOffsetMm?: number;
  role: "EXTERIOR" | "INTERIOR" | "PARTITION" | "OTHER";
}
```

## 7. Ouvertures

Une ouverture est hébergée par un élément.

```ts
interface Opening {
  id: string;
  hostElementId: string;
  type: "DOOR" | "WINDOW" | "VOID" | "OTHER";
  positionAlongHostMm: number;
  sillHeightMm: number;
  widthMm: number;
  heightMm: number;
  definitionId?: string;
}
```

L'ouverture ne stocke pas sa position mondiale comme vérité principale.

## 8. Dalle

```ts
interface Slab {
  id: string;
  levelId: string;
  polygon: Polygon2D;
  assemblyId: string;
  elevationOffsetMm: number;
  role: "FLOOR" | "FOUNDATION" | "TERRACE" | "OTHER";
}
```

## 9. Toiture

MVP :

```ts
interface RoofPlane {
  id: string;
  levelId: string;
  footprint: Polygon2D;
  assemblyId: string;
  slopeDeg: number;
  azimuthDeg: number;
  baseElevationMm: number;
}
```

Une architecture future pourra gérer plusieurs pans connectés.

## 10. Pièces / espaces

```ts
interface Space {
  id: string;
  levelId: string;
  name: string;
  category: string;
  boundaryMode: "AUTO" | "MANUAL";
  manualPolygon?: Polygon2D;
  usageProfileId?: string;
  thermalZoneId?: string;
}
```

En mode `AUTO`, le polygone est dérivé des limites.

## 11. Fenêtre/porte — définition produit

Séparer :

```text
Opening instance
      ↓
Opening definition
```

La définition peut contenir :

- dimensions nominales ;
- thermique ;
- acoustique ;
- matériau ;
- symbole ;
- fabricant ;
- coût ;
- environnement.

## 12. Escaliers

Le MVP peut stocker un objet simplifié :

```ts
interface Stair {
  id: string;
  lowerLevelId: string;
  upperLevelId: string;
  footprint: Polygon2D;
  widthMm: number;
  totalRiseMm: number;
  preferredRiserMm?: number;
  preferredGoingMm?: number;
}
```

Un solveur géométrique détaillé peut être ajouté ensuite.

## 13. Relations

Relations critiques :

```text
Wall → Assembly
Opening → Wall
Slab → Assembly
Roof → Assembly
Space → Level
Equipment → Space
NetworkNode → Space/Element optional
```

Les suppressions doivent vérifier les dépendances.

## 14. Suppression

Aucune suppression silencieuse en cascade d'un objet important.

Exemple :

```text
Delete wall?
- 2 windows hosted
- 1 electrical outlet attached
- 1 room boundary affected
```

La commande doit explicitement gérer les objets dépendants.

## 15. Phases et états

Prévoir les champs futurs sans complexifier le MVP :

```text
EXISTING
NEW
TO_REMOVE
```

Utile pour rénovation et métrés.

## 16. Validation

```text
BUILDING_UNKNOWN_LEVEL
BUILDING_UNKNOWN_ASSEMBLY
BUILDING_INVALID_HOST
BUILDING_OPENING_OUTSIDE_HOST
BUILDING_INVALID_HEIGHT
BUILDING_SPACE_BOUNDARY_FAILED
BUILDING_DUPLICATE_ID
```

## 17. Schéma JSON

Créer :

```text
schemas/building-element.schema.json
```

## 18. Tests

- mur sérialisable ;
- ouverture suit le mur lorsque celui-ci est déplacé ;
- changement d'assemblage change l'épaisseur dérivée ;
- espace automatique invalidé après déplacement d'un mur ;
- suppression d'un host ne laisse pas de référence orpheline.

## 19. Critère MVP

Pouvoir modéliser un niveau rectangulaire avec murs multicouches, quatre fenêtres, une porte et plusieurs pièces détectées automatiquement.
