# 27 — Modules coût et environnement

> **Modules cibles :** `modules/cost`, `modules/environmental`

# Partie A — Coût

## 1. Objectif

Transformer les métrés en estimation structurée sans modifier la géométrie.

## 2. Prix

```ts
interface CostEntry {
  itemId: string;
  price: number;
  currency: string;
  priceUnit: string;
  wasteFactor?: number;
  labor?: number;
  source?: PropertySource;
  validAt?: string;
}
```

## 3. Distinction

```text
quantité géométrique
quantité commandée
prix matériau
main-d'œuvre
équipement
total lot
```

## 4. Conditionnement

Exemple :

```text
besoin      53.2 m²
paquet       5.4 m²
achat       ceil(53.2/5.4) = 10 paquets
```

Le conditionnement ne doit pas modifier le métré physique.

## 5. Lots

```text
structure
envelope
insulation
roof
plumbing
ventilation
electrical
heating
finishes
other
```

## 6. Scénarios

Comparer :

- investissement ;
- coût annuel ;
- remplacement ;
- énergie ;
- horizon configurable.

Les calculs financiers avancés restent un module futur distinct.

---

# Partie B — Environnement

## 7. Principe

Le module environnement utilise :

- quantités ;
- FDES ;
- PEP ;
- DED si méthode autorisée ;
- données utilisateur.

Aucune donnée environnementale n'est dérivée d'un nom de matériau.

## 8. Référence INIES

INIES est la base française de référence pour les données environnementales et sanitaires du bâtiment et la RE2020.

Elle contient notamment :

- FDES pour produits de construction ;
- PEP pour équipements ;
- données environnementales par défaut.

Sources :

- https://www.inies.fr/
- https://www.inies.fr/contenu-de-la-base/fdes-produits-de-construction/
- https://www.inies.fr/contenu-de-la-base/pep-equipements-du-batiment/

## 9. Liaison matériau → donnée environnementale

```ts
interface EnvironmentalDataLink {
  projectObjectId: string;
  declarationId: string;
  declarationType: 'FDES' | 'PEP' | 'DED' | 'CUSTOM';
  functionalUnit: string;
  conversionFactor: number;
  validity?: DateRange;
}
```

## 10. Vérification des unités fonctionnelles

Avant calcul :

```text
project quantity
    ↓ conversion
environmental functional unit
```

Une incohérence d'unité bloque le calcul.

## 11. Cycles de vie

Le modèle doit être compatible avec des étapes :

```text
product
construction
use
end-of-life
benefits-beyond-boundary
```

La nomenclature précise dépend du référentiel environnemental actif.

## 12. Résultats

- impacts par matériau ;
- impacts par lot ;
- impacts par niveau ;
- impacts bâtiment ;
- contribution relative ;
- données manquantes.

## 13. Vue graphique

Modes :

```text
CARBON_BY_ELEMENT
CARBON_BY_MATERIAL
CARBON_BY_LOT
MISSING_ENV_DATA
COST_BY_ELEMENT
COST_BY_LOT
```

## 14. Comparaison

Exemple :

```text
Mur A
coût
carbone
U
épaisseur

vs

Mur B
...
```

Le comparateur multi-critère doit afficher les unités et ne pas produire de score opaque par défaut.

## 15. Provenance

Chaque résultat doit garder :

- déclaration ;
- version ;
- date ;
- source ;
- unité ;
- conversion ;
- méthode.

## 16. Données distantes

Une intégration INIES éventuelle passe par un adapter dédié.

Le projet doit continuer à fonctionner avec un catalogue local/importé.

## 17. Tests coût

### COST-001

Conditionnement arrondi vers le haut.

### COST-002

Changer le prix ne change pas la quantité physique.

### COST-003

Devise absente/incompatible ⇒ diagnostic.

## 18. Tests environnement

### ENV-001

Quantité × facteur avec unités compatibles.

### ENV-002

Unité fonctionnelle incompatible ⇒ blocage.

### ENV-003

Donnée expirée ⇒ warning.

### ENV-004

Somme des éléments = total lot = total bâtiment à tolérance près.

## 19. MVP

- prix matériaux/équipements ;
- conditionnement ;
- coûts par lot ;
- données environnementales liées manuellement ;
- FDES/PEP/DED comme types ;
- vues contribution ;
- comparaison de variantes.
