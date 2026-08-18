# 06 — Assemblies and Quantities

> **Objectif :** définir la composition des parois et le moteur de métrés/nomenclature.

## 1. Principe

Un `Assembly` représente une construction multicouche réutilisable : mur, cloison, plancher, toiture, plafond ou complexe spécifique.

```ts
interface AssemblyDefinition {
  id: EntityId;
  name: string;
  category: AssemblyCategory;
  layers: AssemblyLayer[];
  referenceLayerIndex?: number;
  metadata?: Record<string, unknown>;
}
```

## 2. Couche

```ts
interface AssemblyLayer {
  id: EntityId;
  materialId: EntityId;
  thicknessMm: number;
  role: LayerRole;
  quantification?: LayerQuantificationOverride;
}
```

Rôles initiaux :

```text
FINISH
STRUCTURAL
INSULATION
MEMBRANE
SERVICE_CAVITY
AIR_GAP
CLADDING
WATERPROOFING
OTHER
```

## 3. Ordre des couches

L’ordre est toujours explicite.

Pour une paroi verticale, convention interne :

```text
EXTERIOR → INTERIOR
```

Pour toiture/plancher, le sens doit être porté par l’assemblage.

## 4. Noyau de référence

L’assemblage peut définir un noyau structural afin de conserver correctement la géométrie lors des changements d’épaisseur.

```ts
interface AssemblyCore {
  firstLayerIndex: number;
  lastLayerIndex: number;
}
```

## 5. Propriétés dérivées

Le moteur calcule :

- épaisseur totale ;
- masse surfacique ;
- résistance thermique ;
- propriétés environnementales agrégées lorsque compatibles ;
- coût surfacique estimé ;
- quantité de chaque matériau.

Les propriétés acoustiques d’un assemblage ne doivent pas être déduites naïvement par addition des couches.

## 6. Ouvertures

Le métré doit distinguer :

```text
surface brute
- ouvertures
= surface nette
```

Des seuils de déduction pourront être ajoutés par règle métier ou référentiel, mais ne doivent pas être codés implicitement.

## 7. Interfaces entre couches

Prévoir des métadonnées optionnelles :

- colle ;
- fixation ;
- ossature ;
- entraxe ;
- lame d’air ;
- ponts ponctuels.

Ces données pourront alimenter plus tard : thermique avancée, coûts et accessoires.

## 8. Assemblages utilisateur

L’utilisateur doit pouvoir :

- créer ;
- dupliquer ;
- modifier ;
- inverser ;
- enregistrer dans le projet ;
- exporter/importer.

Les assemblages système sont en lecture seule.

## 9. Métré géométrique

Le moteur produit des `QuantityItem` indépendants de l’affichage.

```ts
interface QuantityItem {
  id: string;
  sourceEntityId: EntityId;
  materialId?: EntityId;
  equipmentId?: EntityId;
  quantityType: QuantityType;
  value: number;
  unit: string;
  calculationTrace: QuantityTrace;
}
```

## 10. Types de quantité

```text
AREA
VOLUME
LENGTH
MASS
COUNT
ENERGY
POWER
CUSTOM
```

## 11. Niveaux de quantité

Toujours distinguer :

```text
GEOMETRIC
NET
WASTE_ADJUSTED
PURCHASE
```

Exemple :

```text
Surface géométrique : 96.2 m²
Surface nette       : 91.8 m²
+ pertes 8 %        : 99.1 m²
Conditionnement     : 20 paquets
```

## 12. Conditionnement

Le moteur de quantité peut convertir :

- m² → paquets ;
- m³ → sacs ;
- longueur → barres ;
- unité → cartons ;
- litres → pots.

La conversion reste liée au produit ou au projet, jamais à la géométrie.

## 13. Accessoires

Prévoir un moteur d’accessoires par règles :

```text
plaque de plâtre → rails + montants + vis + bande
isolation → fixations
membrane → adhésif / recouvrement
```

Ces quantités sont des estimations séparées et traçables.

## 14. Agrégation

Le moteur doit pouvoir regrouper par :

- matériau ;
- produit ;
- assemblage ;
- niveau ;
- pièce ;
- lot ;
- discipline ;
- phase.

## 15. Nomenclature globale

Sorties cibles :

```text
Matériaux
Équipements
Réseaux
Accessoires
Main-d’œuvre estimée (plus tard)
Coût
Impact environnemental
```

## 16. Traçabilité

Chaque ligne de métré doit pouvoir être reliée aux objets du plan qui l’ont produite.

Fonction UX cible : cliquer une ligne de nomenclature → surligner les éléments concernés.

## 17. Variantes

Le métré doit être recalculable par scénario afin de comparer :

- delta de masse ;
- delta de coût ;
- delta d’impact ;
- delta de quantité.

## 18. Export

Formats initiaux :

- CSV ;
- JSON ;
- tableau imprimable.

Plus tard : XLSX, IFC quantities.

## 19. Tests

Cas prioritaires :

- mur sans ouverture ;
- mur avec fenêtre ;
- assemblage inversé ;
- plusieurs murs partageant un assemblage ;
- conditionnement ;
- marge chantier ;
- changement d’épaisseur ;
- suppression d’un matériau utilisé ;
- comparaison de scénarios.
