# 20 — Module récupération d'eau de pluie

> **Module cible :** `modules/rainwater`

## 1. Séparation des responsabilités

### Calcul physique

- collecte ;
- stockage ;
- consommation ;
- appoint ;
- trop-plein.

### Rule Pack

- usages permis ;
- contraintes sanitaires ;
- séparation des réseaux ;
- filtration ;
- déclaration ;
- entretien.

Les deux couches restent indépendantes.

## 2. Surfaces collectées

```ts
interface RainCollectionSurface {
  surfaceId: string;
  projectedAreaM2: number;
  runoffCoefficient: number;
  preFilterEfficiency: number;
  enabled: boolean;
}
```

## 3. Données pluie

Support :

```text
DAILY
MONTHLY
ANNUAL_ESTIMATE
```

Priorité à la série journalière.

## 4. Volume collecté

```text
V_collect =
P × A × C_runoff × η_filter
```

Conversion fondamentale :

```text
1 mm × 1 m² = 1 L
```

## 5. Plusieurs surfaces

```text
V_total(t) = ΣV_surface_i(t)
```

Chaque surface peut avoir un coefficient différent.

## 6. Demandes

```ts
interface RainwaterDemand {
  useType: string;
  demandSeriesL: number[];
  regulatoryClass?: string;
}
```

Catégories métier :

- jardin ;
- nettoyage ;
- WC ;
- lave-linge ;
- autres usages non potables.

Le Rule Pack décide de la conformité réelle.

## 7. Cuve

```ts
interface RainwaterTank {
  nominalVolumeL: number;
  minimumVolumeL?: number;
  initialVolumeL?: number;
  overflowDestination?: string;
}
```

## 8. Simulation

À chaque pas :

```text
available =
storage[t-1] + collected[t]

served =
min(demand[t], available)

shortage =
demand[t] - served

storage[t] =
clamp(available - served, 0, tankCapacity)

overflow =
max(0, available - served - tankCapacity)
```

L'appoint est un flux séparé.

## 9. Indicateurs

- collecte annuelle ;
- demande ;
- eau utilisée ;
- appoint ;
- trop-plein ;
- taux de couverture ;
- taux d'utilisation ;
- jours cuve vide ;
- jours débordement.

## 10. Solveur de cuve

Tester automatiquement une plage de volumes.

Comparer :

- couverture ;
- débordement ;
- manque ;
- gain marginal.

Exemple :

```text
2 m³   43 %
3 m³   55 %
4 m³   61 %
5 m³   64 %
6 m³   65 %
```

## 11. Réseau

Le réseau physique réutilise `water`, mais reste typé :

```text
RAINWATER
```

Aucune fusion logique avec le potable.

## 12. Gouttières / descentes

Sous-module futur/complémentaire :

- surface drainée ;
- intensité de pluie de calcul ;
- débit ;
- nombre de descentes ;
- section.

## 13. Équipements

```text
leafGuard
prefilter
fineFilter
tank
pump
backflowProtection
overflow
```

Chaque équipement peut avoir :

- rendement ;
- pertes de charge ;
- entretien ;
- référence.

## 14. Vue graphique

Sur plan/toiture :

- zones collectées ;
- zones exclues ;
- gouttières ;
- descentes ;
- filtre ;
- cuve ;
- pompe ;
- usages ;
- trop-plein.

Schéma :

```text
PLUIE
  ↓
TOITURE
  ↓
FILTRE
  ↓
CUVE
  ├── WC
  ├── jardin
  └── nettoyage
```

## 15. Graphe temporel

Afficher :

- pluie ;
- niveau cuve ;
- demande ;
- appoint ;
- trop-plein.

## 16. Rule Pack France

Le registre doit être daté et inclure au minimum les textes applicables suivants :

- Décret n° 2024-796 du 12 juillet 2024 ;
- Arrêté du 12 juillet 2024 relatif aux conditions sanitaires d'utilisation d'eaux impropres à la consommation humaine ;
- Arrêté du 14 mars 2025 relatif à l'utilisation d'eaux impropres à la consommation humaine ;
- articles applicables du Code de la santé publique ;
- textes du Code de l'environnement selon les usages.

Sources officielles :

- https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000049962670
- https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000049962813
- https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000051329413

Le système ne doit pas supposer qu'un ancien texte isolé suffit à qualifier un projet actuel.

## 17. Exemple de règle

La présence d'une filtration prescrite par le référentiel actif doit devenir une règle explicite :

```text
RAINWATER_PREFILTER_REQUIRED
```

et non un composant ajouté silencieusement.

## 18. Tests

### RAIN-001

`1 mm × 1 m² = 1 L`.

### RAIN-002

Sans pluie, stockage stable ou décroissant.

### RAIN-003

Sans demande, `served = 0`.

### RAIN-004

Le stockage ne dépasse jamais la capacité.

### RAIN-005

Invariant :

```text
initial + collected + mainsTopUp
=
final + served + overflow + otherLosses
```

### RAIN-006

Un usage non conforme déclenche une règle sans altérer le bilan hydraulique.

## 19. Critères de sortie MVP

- surfaces toiture reliées au module ;
- pluie importable ;
- simulation temporelle ;
- usages configurables ;
- graphe de cuve ;
- solveur de capacité ;
- séparation potable/non potable ;
- Rule Pack externe ;
- tests de conservation.
