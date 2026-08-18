# 03 — Geometry Engine

> **Objectif :** définir le moteur géométrique 2D/2.5D servant de base au dessin architectural, aux métrés et aux calculs.

---

## 1. Principe

Le moteur géométrique doit être indépendant du rendu SVG.

Pipeline :

```text
User command
    ↓
Domain geometry
    ↓
Topology / joins / spaces
    ↓
Derived geometry
    ↓
Drawing scene
    ↓
SVG
```

Le SVG n’est qu’une représentation graphique du résultat.

---

## 2. Coordonnées et unités

### Unité d’édition

Stocker les coordonnées du projet en millimètres.

Avantages :

- valeurs intuitives en architecture ;
- évite de nombreuses conversions UI ;
- précision largement suffisante.

Les calculs physiques convertissent vers SI.

### Précision

Ne jamais comparer directement deux flottants.

Définir des tolérances globales :

```ts
const GEOM_EPS_MM = 1e-6;
const SNAP_EPS_MM = 0.5;
const TOPOLOGY_EPS_MM = 0.1;
```

Les valeurs exactes doivent être ajustées par tests.

---

## 3. Primitives

Le package `geometry` doit fournir au minimum :

```text
Point2D
Vector2D
Line2D
Ray2D
Segment2D
Arc2D
Polyline2D
Polygon2D
BoundingBox2D
Transform2D
```

Puis en 3D léger :

```text
Point3D
Polyline3D
Plane3D
BoundingBox3D
```

---

## 4. Opérations fondamentales

- distance ;
- projection ;
- intersection ;
- angle ;
- orientation ;
- offset ;
- trim ;
- extend ;
- split ;
- polygon area ;
- polygon centroid ;
- point in polygon ;
- polygon clipping ;
- union ;
- difference ;
- buffer ;
- nearest point.

Ces fonctions doivent avoir des tests unitaires indépendants.

---

## 5. Murs

Le mur est défini par un chemin de référence et une largeur dérivée de son assemblage.

Le moteur calcule :

```text
reference path
   ↓ offset
side A / side B
   ↓ joins
final wall polygon
```

Pour une polyligne, chaque segment produit deux offsets puis les jonctions sont résolues.

---

## 6. Référence de mur

Le moteur doit supporter :

- axe central ;
- face intérieure ;
- face extérieure ;
- axe du noyau ;
- face intérieure du noyau ;
- face extérieure du noyau.

Lors d’un changement d’assemblage, seule la géométrie non référencée doit se déplacer.

Cette règle doit être testée explicitement.

---

## 7. Jonctions de murs

Les principales jonctions à gérer :

- L ;
- T ;
- X ;
- murs colinéaires ;
- angle quelconque.

Politiques possibles :

```text
AUTO
MITER
BUTT
DISALLOW
MANUAL
```

Le MVP peut commencer avec `AUTO` + `MITER` + `BUTT`.

---

## 8. Topologie

La géométrie et la topologie sont distinctes.

Exemple : deux murs peuvent visuellement se toucher mais ne pas être logiquement joints si l’utilisateur l’a décidé.

Construire un graphe topologique :

```text
Wall endpoints → Junction nodes → Connected wall edges
```

Ce graphe sert à :

- calculer les contours de pièces ;
- gérer les jonctions ;
- détecter les incohérences.

---

## 9. Ouvertures

Une ouverture est paramétrée dans le repère local de son mur hôte.

Position recommandée : distance depuis l’origine du chemin du mur.

Le moteur doit calculer :

- position monde ;
- orientation ;
- découpe dans la géométrie du mur ;
- symbole de porte/fenêtre ;
- impact sur surface nette.

Une ouverture ne doit pas être stockée comme simple rectangle XY indépendant.

---

## 10. Détection des pièces

Objectif : détecter les cycles fermés du graphe de murs.

Pipeline possible :

1. construire les segments de faces de murs ;
2. résoudre les intersections ;
3. former un graphe planaire ;
4. rechercher les faces fermées ;
5. éliminer l’extérieur ;
6. associer les anciennes pièces aux nouveaux contours.

Le système doit préserver l’identité d’une pièce lorsque sa forme change légèrement.

Heuristiques possibles :

- recouvrement maximal ;
- centroïde ;
- proximité.

---

## 11. Géométrie nette et brute

Toujours distinguer :

- surface brute ;
- surface nette ;
- surface intérieure ;
- surface extérieure ;
- surface d’ouverture ;
- volume brut ;
- volume utile.

Le type de surface doit être explicite dans chaque API.

Éviter une fonction ambiguë comme :

```ts
getWallArea()
```

Préférer :

```ts
getGrossExteriorArea()
getNetExteriorArea()
getGrossInteriorArea()
```

---

## 12. Planchers

Un plancher est un polygone + assemblage.

Le moteur calcule :

- surface ;
- périmètre ;
- volume par couche ;
- géométrie de coupe ;
- bordures.

---

## 13. Toitures

MVP : chaque pan de toiture est explicite.

Chaque pan possède :

- contour projeté ;
- pente ;
- azimut ;
- altitude ;
- assemblage.

Le moteur calcule :

- surface réelle ;
- surface projetée ;
- normales ;
- bords ;
- orientation solaire.

---

## 14. Coupes

Une coupe est définie par :

```text
cut line
view direction
cut depth
view range
```

Le moteur interroge les objets 2.5D et génère une scène 2D composée de :

- géométrie coupée ;
- géométrie vue derrière ;
- annotations ;
- hachures.

Le MVP peut commencer par des coupes orthogonales aux axes principaux.

---

## 15. Façades

Même principe qu’une coupe, mais sans géométrie coupée intérieure.

Les façades servent aussi pour :

- surfaces vitrées ;
- orientations ;
- solaire ;
- enveloppe.

---

## 16. Snapping

Types :

```text
GRID
ENDPOINT
MIDPOINT
INTERSECTION
PROJECTION
PERPENDICULAR
PARALLEL
CENTER
ANGLE
ALIGNMENT
```

Le moteur de snap retourne :

```ts
interface SnapCandidate {
  point: Point2D;
  type: SnapType;
  sourceEntityIds: EntityId[];
  distanceScreenPx: number;
  priority: number;
}
```

La sélection du snap est basée sur la distance écran, pas seulement sur la distance modèle.

---

## 17. Contraintes temporaires

Pendant le dessin :

- horizontal ;
- vertical ;
- angle fixe ;
- longueur saisie ;
- parallèle ;
- perpendiculaire.

Ces contraintes sont des aides d’édition et ne doivent pas forcément devenir des contraintes persistantes dans le MVP.

---

## 18. Sélection

Deux niveaux :

### Broad phase

Index spatial avec bounding boxes.

### Narrow phase

Test géométrique précis.

Prévoir un index spatial simple : R-tree, quadtree ou structure équivalente.

---

## 19. Transformations

Les commandes doivent supporter :

- déplacement ;
- rotation ;
- miroir ;
- duplication ;
- alignement.

Les objets hébergés doivent suivre leur hôte.

---

## 20. Command pattern

Toute modification géométrique passe par une commande réversible.

```ts
interface Command {
  execute(project: Project): Project;
  undo(project: Project): Project;
  describe(): string;
}
```

Exemples :

```text
AddWall
MoveWallEndpoint
ChangeWallPath
InsertOpening
DeleteEntity
MoveEquipment
ConnectNetworkSegment
```

---

## 21. Undo/Redo

Ne pas enregistrer des captures complètes du projet à chaque action si le projet devient lourd.

Prévoir :

- commandes inversables ;
- transaction groupée ;
- snapshot occasionnel si nécessaire.

Exemple : déplacer 20 murs sélectionnés = une seule transaction Undo.

---

## 22. Scène de rendu

Le moteur géométrique ne produit pas directement du SVG.

Il produit une scène sémantique :

```ts
interface DrawingScene {
  primitives: DrawingPrimitive[];
}
```

Primitives :

```text
SemanticLine
SemanticPolyline
SemanticPolygon
SemanticArc
SemanticText
SemanticHatch
SemanticSymbol
SemanticDimension
```

Chaque primitive contient un `graphicRole`.

---

## 23. Performance

Cibles initiales :

- plan d’une maison résidentielle : interaction fluide ;
- plusieurs milliers de primitives SVG acceptables ;
- recalcul géométrique incrémental ;
- index spatial pour sélection ;
- caches dérivés invalidés par entité.

Ne pas optimiser prématurément avec Canvas si SVG suffit.

---

## 24. Tests géométriques prioritaires

Créer des tests dédiés pour :

- intersections segment/segment ;
- offsets ;
- polygones ;
- murs en L ;
- murs en T ;
- murs à angle aigu ;
- changement d’épaisseur ;
- ouverture proche d’une extrémité ;
- détection d’une pièce rectangulaire ;
- pièce en L ;
- suppression d’un mur ouvrant deux pièces ;
- conservation de l’identité d’une pièce ;
- surfaces nettes après ouvertures.

---

## 25. Principe de stabilité

La priorité du moteur géométrique est la **prévisibilité**.

Un changement de matériau, d’épaisseur ou de paramètre ne doit jamais déplacer arbitrairement l’ensemble du bâtiment.

Tout comportement automatique doit avoir une règle géométrique claire, documentée et testée.
