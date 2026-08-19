# 29 — Contrat géométrique

> **Paquet cible :** `packages/geometry`  
> **Objectif :** définir une géométrie déterministe, sérialisable et indépendante du rendu.

## 1. Principes

La géométrie du projet constitue une donnée métier. Elle ne dépend ni de React, ni de SVG, ni d'un moteur 3D.

Règles :

1. toutes les coordonnées géométriques d'édition sont persistées en millimètres ;
2. les modules physiques reçoivent des valeurs converties en unités SI ;
3. aucun arrondi d'affichage ne modifie la géométrie ;
4. les identifiants géométriques sont stables ;
5. les valeurs dérivées peuvent être recalculées ;
6. les opérations utilisent une tolérance géométrique centralisée.

## 2. Primitives

```ts
interface Point2D {
  x: number;
  y: number;
}

interface Point3D {
  x: number;
  y: number;
  z: number;
}

interface Vector2D {
  x: number;
  y: number;
}

interface Segment2D {
  start: Point2D;
  end: Point2D;
}

interface Arc2D {
  center: Point2D;
  radiusMm: number;
  startAngleRad: number;
  endAngleRad: number;
  clockwise: boolean;
}

interface Polyline2D {
  points: Point2D[];
  closed: boolean;
}

interface Polygon2D {
  outer: Point2D[];
  holes?: Point2D[][];
}
```

## 3. Coordonnées locales et monde

Chaque niveau possède un repère local.

```text
project/world
   ↓
building
   ↓
level
   ↓
host object
   ↓
local geometry
```

Le MVP peut garder les bâtiments non tournés localement, mais l'API doit accepter des transformations.

```ts
interface Transform2D {
  translation: Point2D;
  rotationRad: number;
  scale: number; // normalement 1
}
```

## 3.1 Frontière géométrie / physique

La conversion se fait uniquement aux frontières de modules :

```text
geometry: 4200 mm
      ↓ units package
physics: 4.2 m
```

Les calculateurs ne doivent jamais recevoir une longueur géométrique en millimètres sans conversion explicite.

## 4. Orientation

Convention :

- `x` vers l'est du repère de dessin local ;
- `y` vers le nord du repère de dessin local ;
- `z` vers le haut ;
- angles en radians dans le noyau ;
- affichage en degrés dans l'UI.

Le nord projet est une propriété du site et ne modifie pas les coordonnées internes.

## 5. Tolérances

Un service unique :

```ts
interface GeometryTolerance {
  pointMergeMm: number;
  collinearMm: number;
  angularRad: number;
  areaMm2: number;
}
```

Interdiction d'utiliser des constantes `1e-6` dispersées.

## 6. Polygones

Le moteur doit fournir au minimum :

```text
area
perimeter
containsPoint
intersects
union
difference
intersection
offset
orientation
selfIntersectionCheck
```

Les opérations booléennes doivent avoir des tests de non-régression.

## 7. Lignes de référence des murs

Un mur est défini à partir d'une ligne/polyligne de référence, pas de deux faces dessinées séparément.

```ts
interface WallReferencePath {
  type: 'LINE' | 'POLYLINE';
  points: Point2D[];
}
```

L'épaisseur provient de l'assemblage.

Le choix du côté de référence est stocké :

```text
CENTER
LEFT
RIGHT
```

## 8. Offsets

Le moteur doit gérer :

- offset gauche/droite ;
- jonctions ;
- coins convexes ;
- coins concaves ;
- limites de mitre ;
- segments très courts.

Une opération d'offset impossible doit produire un diagnostic explicite.

## 9. Arcs

Les arcs sont autorisés dans l'architecture du schéma, mais ne sont pas requis pour le premier éditeur de murs.

Ils permettent ensuite :

- murs courbes ;
- escaliers ;
- réseaux ;
- symboles.

## 10. Géométrie 2.5D

Le projet n'a pas besoin d'un modeleur solide complet pour le MVP.

Chaque objet 2D peut recevoir :

```ts
interface VerticalExtent {
  baseElevationMm: number;
  topElevationMm: number;
}
```

Cela suffit pour :

- surfaces ;
- volumes ;
- coupes simples ;
- collisions verticales ;
- réseaux multi-niveaux.

## 11. Géométrie dérivée

Ne pas persister comme vérité :

- faces du mur ;
- polygonisation finale des pièces ;
- surface nette ;
- centres ;
- bounding boxes ;
- triangulations.

Ces données peuvent être mises en cache avec empreinte d'entrée.

## 12. Identifiants

Les primitives internes temporaires n'ont pas besoin d'ID persistants.

Les objets métier référencés, eux, doivent posséder des IDs stables :

```text
wall-...
opening-...
space-...
network-node-...
```

Le format exact peut être UUID ou ULID, mais ne doit pas dépendre du tableau dans lequel l'objet est stocké.

## 13. Validation

Codes :

```text
GEOM_NON_FINITE_COORDINATE
GEOM_ZERO_LENGTH_SEGMENT
GEOM_SELF_INTERSECTION
GEOM_INVALID_POLYGON
GEOM_OFFSET_FAILED
GEOM_DEGENERATE_AREA
GEOM_TOLERANCE_CONFLICT
```

## 14. Tests minimum

### GEO-001

Distance symétrique :

```text
distance(A,B) = distance(B,A)
```

### GEO-002

Aire d'un rectangle 5000 × 4000 mm = 20 000 000 mm².

### GEO-003

Inversion de l'ordre des points modifie l'orientation mais pas la valeur absolue de l'aire.

### GEO-004

Offset d'un segment horizontal de 200 mm produit une distance normale de 200 mm.

### GEO-005

Une polyligne avec deux points identiques consécutifs est normalisée ou rejetée selon l'opération.

### GEO-006

Les opérations identiques avec les mêmes entrées produisent le même résultat.

## 15. Schéma machine-lisible

Créer :

```text
schemas/geometry.schema.json
```

Il doit contenir :

- `Point2D` ;
- `Point3D` ;
- `Segment2D` ;
- `Polyline2D` ;
- `Polygon2D` ;
- `Transform2D`.

## 16. Critère de sortie

Le contrat est validé lorsque l'éditeur peut créer, déplacer et sérialiser un rectangle de bâtiment sans dépendance au moteur de rendu.
