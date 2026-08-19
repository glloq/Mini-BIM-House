# 05 — Materials Catalog

> **Objectif :** définir la bibliothèque générale de matériaux, son extensibilité et la provenance de chaque propriété technique.

---

## 1. Rôle du catalogue

Le catalogue de matériaux est un des composants centraux du projet.

Il alimente :

- dessin ;
- hachures ;
- assemblages ;
- thermique ;
- hygrothermie ;
- acoustique ;
- poids ;
- coût ;
- métré ;
- environnement.

Le catalogue ne doit pas être une simple liste de noms.

---

## 2. Trois catégories de matériaux

### GENERIC

Matériau générique sans fabricant.

Exemples :

- béton courant ;
- laine minérale générique ;
- plaque de plâtre ;
- bois massif ;
- verre.

Utilité : esquisse et pré-étude.

### PRODUCT

Produit réel identifié.

Exemples :

- isolant précis ;
- plaque précise ;
- bloc maçonné précis.

Utilité : étude détaillée, coût, environnement, performances fabricant.

### CUSTOM

Matériau créé par l’utilisateur.

Utilité :

- matériau local ;
- produit absent du catalogue ;
- expérimentation ;
- valeurs mesurées.

---

## 3. Identité

```ts
interface MaterialIdentity {
  name: string;
  shortName?: string;
  category: MaterialCategory;
  subcategory?: string;

  manufacturer?: string;
  productReference?: string;
  sku?: string;

  description?: string;
  tags?: string[];
}
```

---

## 4. Catégories initiales

```text
CONCRETE
MORTAR
MASONRY
BRICK
STONE
EARTH
WOOD
WOOD_PRODUCT
GYPSUM
INSULATION_MINERAL
INSULATION_BIOBASED
INSULATION_SYNTHETIC
METAL
GLASS
MEMBRANE
PLASTIC
CERAMIC
FLOORING
COATING
PAINT
AIR_GAP
WATERPROOFING
ROOFING
COMPOSITE
OTHER
```

La catégorie sert principalement au classement et aux valeurs graphiques par défaut.

---

## 5. Propriétés physiques

```ts
interface PhysicalProperties {
  densityKgM3?: SourcedValue<number>;
  specificHeatJKgK?: SourcedValue<number>;
  porosity?: SourcedValue<number>;
}
```

Évolutions possibles :

- résistance mécanique ;
- module d’Young ;
- coefficient de dilatation ;
- dureté.

Ces propriétés ne sont pas prioritaires pour le MVP.

---

## 6. Propriétés thermiques

```ts
interface ThermalProperties {
  conductivityWMK?: SourcedValue<number>;
  thermalResistanceM2KW?: SourcedValue<number>;
  emissivity?: SourcedValue<number>;
}
```

`thermalResistanceM2KW` est utile pour les produits dont la résistance déclarée est plus pertinente qu’un lambda générique.

Ne pas recalculer automatiquement l’un depuis l’autre si l’épaisseur de référence n’est pas explicitement connue.

---

## 7. Propriétés hygrothermiques

```ts
interface HygrothermalProperties {
  vaporResistanceFactorMu?: SourcedValue<number>;
  sdM?: SourcedValue<number>;
  waterAbsorption?: SourcedValue<number>;
  moistureCapacity?: SourcedValue<number>;
}
```

Une membrane peut être définie principalement par `sdM` plutôt que par `mu`.

---

## 8. Propriétés acoustiques

```ts
interface AcousticProperties {
  absorptionByBand?: SourcedValue<FrequencyBandValues>;
  soundReductionIndexRwDb?: SourcedValue<number>;
  dynamicStiffness?: SourcedValue<number>;
}
```

Attention : de nombreuses performances acoustiques dépendent de l’assemblage complet, pas du matériau isolé.

Le moteur doit donc distinguer :

- propriété matériau ;
- propriété système/assemblage ;
- valeur mesurée d’un produit complet.

---

## 9. Feu

```ts
interface FireProperties {
  reactionToFireClass?: SourcedValue<string>;
  smokeClass?: SourcedValue<string>;
  dropletsClass?: SourcedValue<string>;
}
```

Ne pas interpréter automatiquement une classe comme une résistance au feu d’une paroi complète.

---

## 10. Environnement

```ts
interface EnvironmentalProperties {
  declarationType?: 'FDES' | 'PEP' | 'EPD' | 'GENERIC' | 'OTHER';
  declarationId?: string;
  declarationValidUntil?: string;

  functionalUnit?: string;
  referenceServiceLifeYears?: number;

  indicators?: EnvironmentalIndicatorSet;
}
```

Les données environnementales sont généralement rattachées à une unité fonctionnelle ou déclarée. Le logiciel doit conserver cette unité.

---

## 11. Économie

```ts
interface EconomicProperties {
  purchaseUnit?: string;
  pricePerUnit?: SourcedValue<number>;
  currency?: string;
  packageQuantity?: number;
  wasteDefaultPercent?: number;
}
```

Le prix doit être clairement daté car il évolue rapidement.

---

## 12. Apparence graphique

```ts
interface MaterialAppearance {
  hatchCategory?: string;
  fillPatternId?: string;
  displayColor?: string;
  textureRef?: string;
}
```

La couleur n’est qu’une propriété d’affichage et ne doit pas servir de donnée technique.

---

## 13. SourcedValue

Chaque valeur importante doit conserver sa provenance.

```ts
interface SourcedValue<T> {
  value: T;
  unit?: string;

  sourceType: SourceType;
  sourceRef?: string;
  sourceUrl?: string;

  retrievedAt?: string;
  validFrom?: string;
  validUntil?: string;

  method?: string;
  confidence?: 'LOW' | 'MEDIUM' | 'HIGH' | 'VERIFIED';
  notes?: string;
}
```

`SourceType` :

```text
STANDARD
REGULATION
MANUFACTURER
INIES
LAB_TEST
BOOK
GUIDE
USER
DEFAULT
DERIVED
OTHER
```

---

## 14. Valeurs manquantes

Une propriété absente reste `undefined`.

Ne jamais utiliser automatiquement `0`.

Exemple :

```ts
conductivityWMK: undefined;
```

signifie : donnée inconnue.

```ts
conductivityWMK: 0;
```

serait physiquement très différent et doit donc être évité.

---

## 15. Valeurs par défaut

Les valeurs par défaut doivent être explicitement identifiées :

```text
sourceType = DEFAULT
```

L’UI doit pouvoir afficher un indicateur :

```text
Valeur générique
Valeur fabricant
Valeur utilisateur
Valeur vérifiée
```

---

## 16. Matériaux utilisateur

L’utilisateur doit pouvoir :

- créer ;
- dupliquer ;
- renommer ;
- éditer ;
- exporter ;
- importer ;
- supprimer.

Un matériau du catalogue système ne doit jamais être modifié directement.

Lorsqu’un utilisateur veut le modifier :

```text
System material
      ↓ duplicate
Custom material
```

---

## 17. Catalogue système et catalogue projet

Séparer :

```text
SystemCatalog
ProjectCatalog
```

### SystemCatalog

Lecture seule, livré avec l’application.

### ProjectCatalog

Contient :

- matériaux personnalisés ;
- copies modifiées ;
- matériaux réellement utilisés par le projet.

Le fichier projet doit rester autonome autant que possible.

---

## 18. Références externes

Un matériau produit peut posséder plusieurs références :

```ts
interface ExternalReference {
  system: string;
  identifier: string;
  url?: string;
}
```

Exemples de systèmes :

```text
INIES
MANUFACTURER
EPD
GTIN
CUSTOM
```

---

## 19. INIES

Pour la France, INIES constitue une source importante pour les données environnementales et sanitaires liées aux produits et équipements du bâtiment.

Le projet doit prévoir une intégration possible mais ne doit pas dépendre du webservice pour fonctionner.

Architecture recommandée :

```text
INIES / source externe
       ↓ importer
NormalizedMaterialRecord
       ↓
Project catalog
```

La donnée importée conserve :

- identifiant source ;
- date ;
- version ;
- unité déclarée ;
- validité.

Référence : https://www.inies.fr/

Le webservice INIES permet l’alimentation numérique d’outils d’évaluation environnementale ; son usage doit respecter ses conditions d’accès : https://www.inies.fr/en/the-digitised-data-webservice/

---

## 20. Dédoublonnage

Deux matériaux ayant le même nom ne sont pas nécessairement identiques.

La détection de doublons peut utiliser :

- fabricant ;
- référence produit ;
- identifiant externe ;
- hash de propriétés.

Ne jamais fusionner automatiquement deux matériaux sans confirmation ou règle fiable.

---

## 21. Versionnement

```ts
interface CatalogMetadata {
  catalogVersion: string;
  schemaVersion: string;
  generatedAt: string;
}
```

Le catalogue livré avec l’application peut évoluer indépendamment des projets existants.

Un ancien projet doit continuer à reproduire ses résultats.

Donc les matériaux réellement utilisés doivent conserver les valeurs nécessaires dans le projet ou un snapshot versionné.

---

## 22. Migration

Si le schéma change :

```text
v1 material
  ↓ migration
v2 material
```

Toutes les migrations doivent être :

- déterministes ;
- testées ;
- non destructives autant que possible.

---

## 23. Assemblages prédéfinis

Le catalogue peut fournir des assemblages types indépendamment des matériaux :

```text
Mur ossature bois type
Mur maçonné + ITE
Cloison légère
Toiture chaude
Plancher bois
```

Lors de l’insertion, l’utilisateur choisit les matériaux exacts ou conserve les matériaux génériques.

---

## 24. Quantification

Chaque matériau doit déclarer comment il est quantifié :

```ts
interface QuantificationRule {
  basis: 'VOLUME' | 'AREA' | 'LENGTH' | 'MASS' | 'UNIT' | 'CUSTOM';
  purchaseUnit?: string;
  conversion?: number;
}
```

Exemples :

- isolant panneau : m² ;
- béton : m³ ;
- peinture : L ;
- membrane : m² ;
- brique : unité ou m² ;
- bois : m³ ou ml selon usage.

---

## 25. Conditionnement

Option utile :

```ts
interface Packaging {
  unitName: string;
  quantityPerPackage: number;
  packageCoverage?: number;
}
```

Le métré peut alors calculer :

```text
Besoin : 81.3 m²
Paquet : 5.4 m²
Résultat : 16 paquets
```

---

## 26. Pertes chantier

Les pertes sont séparées du matériau lui-même.

Valeur de catalogue : suggestion.

Valeur de projet : choix utilisateur.

Cela évite d’imposer arbitrairement une marge unique.

---

## 27. Recherche et filtrage

L’UI doit permettre :

- recherche texte ;
- catégorie ;
- fabricant ;
- propriété disponible ;
- source ;
- générique/produit/custom ;
- plage lambda ;
- densité ;
- coût ;
- indicateur environnemental.

---

## 28. Comparateur matériaux

Prévoir un comparateur horizontal :

```text
Matériau A | Matériau B | Matériau C
lambda
rho
Cp
mu
coût
carbone
source
```

Les cellules inconnues restent clairement marquées.

---

## 29. Tests

Tests prioritaires :

- import/export ;
- conservation de provenance ;
- duplication système → custom ;
- absence de valeur ≠ zéro ;
- migration ;
- conversion d’unités ;
- quantification ;
- conditionnement ;
- calcul par assemblage ;
- snapshot projet.

---

## 30. Règle fondamentale

Le catalogue doit permettre de commencer simplement avec quelques dizaines de matériaux génériques, tout en étant capable d’évoluer vers plusieurs milliers de produits documentés sans modifier l’architecture du logiciel.
