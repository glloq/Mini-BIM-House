# 37 — Pipeline de rendu technique

> **Paquet cible :** `packages/drawing-engine`

## 1. Objectif

Séparer strictement :

```text
modèle métier
→ scène sémantique
→ filtres de vue
→ styles
→ placement annotations
→ SVG
```

## 2. Vue

```ts
interface DrawingView {
  id: string;
  type: string;
  levelId?: string;
  scale: number;
  viewport: Box2D;
  visibleDisciplines: string[];
  graphicProfileId: string;
  analysisOverlayId?: string;
}
```

## 3. Scène sémantique

```ts
interface ScenePrimitive {
  id: string;
  sourceObjectId?: string;
  semanticRole: string;
  geometry: unknown;
  layer: string;
  zIndex: number;
  metadata?: Record<string, unknown>;
}
```

Aucun style concret obligatoire à cette étape.

## 4. Style resolver

```text
semanticRole
+ viewType
+ scale
+ graphicProfile
+ object state
→ resolved style
```

États :

```text
NORMAL
SELECTED
HOVER
WARNING
ERROR
GHOST
```

Les états UI ne doivent pas changer les exports techniques sauf demande explicite.

## 5. Ordre de rendu

Exemple architecture :

1. arrière-plan/site ;
2. éléments sous plan de coupe ;
3. éléments vus ;
4. éléments coupés ;
5. réseaux ;
6. symboles ;
7. hachures/overlays ;
8. annotations ;
9. cotes ;
10. sélection UI.

## 6. Plan de coupe

Une vue de plan possède :

```text
cutElevation
viewDepth
```

Les éléments sont classés :

```text
CUT
BELOW
ABOVE
OUTSIDE
```

## 7. Échelle

Le moteur gère simultanément :

- espace modèle en mm ;
- SVG viewBox ;
- unité écran ;
- unité papier.

Exemple :

```text
1:50
1 mm papier = 50 mm modèle
```

## 8. Traits

Les épaisseurs de trait sont définies en unités papier pour export.

L'écran peut appliquer un minimum de visibilité sans changer la valeur d'impression.

## 9. Hachures

Les hachures sont générées dans le repère papier ou modèle selon le profil.

Elles doivent rester stables lors du zoom écran.

## 10. Textes

Le moteur gère :

- style ;
- hauteur papier ;
- rotation ;
- ancrage ;
- masque de fond éventuel.

Les textes métiers restent des données, pas des chemins vectoriels.

## 11. Cotation

Une cote contient :

```text
references to geometry
dimension type
offset
format profile
override text optional
```

La valeur numérique est dérivée de la géométrie.

Une `override text` ne modifie jamais la dimension réelle.

## 12. Placement d'annotations

MVP :

- placement manuel ;
- maintien du lien à l'objet.

Futur :

- collision de labels ;
- placement automatique ;
- leader lines.

## 13. Hit testing

Le rendu doit fournir une indexation :

```text
screen point
→ candidate scene primitives
→ source object
```

Ne pas dépendre uniquement des événements DOM des milliers d'éléments SVG.

## 14. Performance

Prévoir :

- culling viewport ;
- groupes par calque ;
- memoization scène ;
- overlay Canvas possible pour cartes denses ;
- worker pour certaines analyses.

Le dessin technique principal reste SVG.

## 15. Analyse colorée

Les résultats de calcul produisent un `AnalysisOverlay` :

```ts
interface AnalysisOverlay {
  id: string;
  metric: string;
  unit?: string;
  values: Record<string, number | string | null>;
  scale: AnalysisScale;
}
```

Le calcul n'émet pas de couleur.

## 16. Export

Cibles :

```text
SVG
PDF via pipeline dédié/print
DXF futur
```

Une exportation désactive les états hover/selection.

## 17. Golden tests

Comparer :

- structure SVG normalisée ;
- positions ;
- styles sémantiques ;
- annotations.

Éviter les tests basés uniquement sur screenshots pixel-perfect.

## 18. Critère MVP

Un même niveau peut produire automatiquement :

- plan architecte ;
- plan thermique ;
- plan plomberie ;
- plan ventilation ;
- plan électrique ;

sans dupliquer la géométrie.
