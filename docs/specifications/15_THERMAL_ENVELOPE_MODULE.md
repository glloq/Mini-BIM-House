# 15 — Module thermique / enveloppe

> **Module cible :** `modules/thermal`  
> **Niveau initial :** `ENGINEERING`  
> **Objectif :** calculer et visualiser les performances thermiques stationnaires de l'enveloppe et fournir des données fiables aux modules chauffage, énergie, hygrothermie et optimisation.

## 1. Périmètre

Le module doit calculer :

- résistance thermique de chaque couche ;
- résistance totale des parois ;
- coefficient de transmission `U` ;
- coefficient de déperdition `H` ;
- pertes par transmission ;
- ponts thermiques lorsque les données existent ;
- agrégation par élément, pièce, zone, niveau et bâtiment ;
- températures superficielles simplifiées ;
- comparaison de variantes.

Le module ne doit pas :

- contenir directement la RE2020 ou une réglementation nationale ;
- dimensionner les générateurs de chauffage ;
- inventer les propriétés manquantes ;
- présenter une simulation stationnaire comme une simulation thermique dynamique.

## 2. Dépendances

```text
geometry
materials
assemblies
architecture
climate
   │
   ▼
thermal
   ├── heating
   ├── hygrothermal
   ├── energy-balance
   └── optimizer
```

## 3. Entrées

### Géométrie

```ts
interface ThermalElementGeometry {
  elementId: string;
  type: 'wall' | 'roof' | 'floor' | 'window' | 'door' | 'other';
  grossAreaM2: number;
  netAreaM2: number;
  orientationDeg?: number;
  tiltDeg?: number;
  boundary: ThermalBoundary;
}
```

### Limites

```ts
type ThermalBoundary =
  | { kind: 'exterior'; climateZoneId: string }
  | { kind: 'ground'; groundModelId?: string }
  | { kind: 'unheated-space'; adjacentZoneId: string }
  | { kind: 'heated-space'; adjacentZoneId: string }
  | { kind: 'adiabatic' };
```

### Couches

```ts
interface ThermalLayerInput {
  materialId: string;
  thicknessM: number;
  lambdaWmK?: number;
  declaredResistanceM2KW?: number;
}
```

Valeur absente = inconnue. Aucune substitution silencieuse.

## 4. Unités internes

| Grandeur        | Unité    |
| --------------- | -------- |
| longueur        | m        |
| surface         | m²       |
| conductivité λ  | W/(m·K)  |
| résistance R    | m²·K/W   |
| transmission U  | W/(m²·K) |
| pont linéique ψ | W/(m·K)  |
| pont ponctuel χ | W/K      |
| coefficient H   | W/K      |
| puissance       | W        |
| énergie         | Wh / kWh |

## 5. Résistance des couches

Pour une couche homogène :

```text
R_layer = d / λ
```

avec `d` en mètres.

Une résistance déclarée peut être utilisée si sa provenance correspond explicitement au produit/cas d'emploi.

## 6. Résistance totale

```text
R_total = R_si + ΣR_layer + ΣR_air + R_se
U = 1 / R_total
```

Les valeurs `R_si` et `R_se` sont fournies par la méthode active, jamais dispersées en constantes dans le code.

```ts
interface ThermalResistanceBreakdown {
  insideSurface: number;
  layers: Array<{ layerId: string; resistance: number }>;
  airLayers: number[];
  outsideSurface: number;
  total: number;
  uValue: number;
}
```

## 7. Cas nécessitant un calcul dédié

Ne pas traiter naïvement comme paroi homogène :

- fenêtres ;
- portes complexes ;
- ossatures répétitives ;
- planchers sur sol ;
- parois ventilées ;
- composants avec valeurs `U` certifiées.

Prévoir :

```ts
interface ThermalTransmittanceProvider {
  supports(element: BuildingElement): boolean;
  calculate(element: BuildingElement, ctx: ThermalContext): UValueResult;
}
```

## 8. Déperditions

```text
H_element = U × A
```

Bâtiment :

```text
H_transmission =
    Σ(U_i × A_i)
  + Σ(ψ_j × L_j)
  + Σχ_k
```

Pour un écart de température :

```text
Φ_transmission = H_transmission × ΔT
```

## 9. Ponts thermiques

Niveaux :

- `NONE` : ignorés avec warning ;
- `MANUAL` : valeur utilisateur ;
- `CATALOG` : valeur issue d'un catalogue/référence ;
- `NUMERICAL` : futur moteur 2D/3D.

```ts
interface LinearThermalBridge {
  id: string;
  junctionType: string;
  lengthM: number;
  psiWmK: number;
  source: PropertySource;
}
```

## 10. Ouvertures

```ts
interface WindowThermalProperties {
  uwWm2K: number;
  solarFactorG?: number;
  frameFraction?: number;
  source: PropertySource;
}
```

Le calcul stationnaire utilise :

```text
H_window = Uw × A
```

Les apports solaires restent un calcul distinct.

## 11. Sortie

```ts
interface ThermalEnvelopeResult {
  precision: 'ESTIMATE' | 'ENGINEERING' | 'STANDARD' | 'REGULATORY';
  totalHeatTransferCoefficientWK: number;
  designTransmissionLossW?: number;
  elements: ThermalElementResult[];
  rooms: ThermalRoomResult[];
  zones: ThermalZoneResult[];
  warnings: CalculationWarning[];
  assumptions: CalculationAssumption[];
  references: CalculationReference[];
}
```

## 12. Vue graphique

Modes obligatoires :

- `U_VALUE` ;
- `HEAT_LOSS` ;
- `SURFACE_TEMPERATURE` ;
- `MISSING_DATA` ;
- `ASSEMBLY`.

Le plan architectural reste visible en fond.

La légende doit toujours afficher l'unité et l'échelle.

## 13. Inspecteur de paroi

Exemple :

```text
Mur Nord
Surface nette     28.60 m²
R                 5.43 m²K/W
U                 0.184 W/m²K
H                 5.26 W/K
Part des pertes   8.3 %
```

Afficher également :

- couches ;
- épaisseurs ;
- `λ` ;
- provenance ;
- warnings.

## 14. Coupe thermique

La coupe est générée depuis l'`Assembly`.

```text
extérieur
├─ enduit
├─ maçonnerie
├─ isolant
├─ frein-vapeur
├─ vide technique
└─ plaque
intérieur
```

Aucune duplication graphique indépendante.

## 15. Variantes

Comparer :

- épaisseur ;
- R ;
- U ;
- pertes ;
- masse ;
- coût si disponible ;
- impact environnemental si disponible.

## 16. Invalidations

Recalcul si modification de :

- géométrie ;
- ouverture ;
- assemblage ;
- matériau ;
- propriété thermique ;
- climat ;
- consigne ;
- pont thermique.

Une modification purement graphique n'invalide pas le calcul.

## 17. Codes de diagnostic

```text
THERMAL_MISSING_LAMBDA
THERMAL_INVALID_THICKNESS
THERMAL_INVALID_U_VALUE
THERMAL_UNKNOWN_BOUNDARY
THERMAL_MISSING_CLIMATE
THERMAL_UNSUPPORTED_ASSEMBLY
THERMAL_BRIDGE_NOT_INCLUDED
THERMAL_GROUND_METHOD_REQUIRED
```

## 18. Tests de référence

### T-001

```text
d = 0.20 m
λ = 0.040 W/(m·K)
Rsi = 0.13
Rse = 0.04
```

Attendu :

```text
R_layer = 5.00
R_total = 5.17 m²K/W
U ≈ 0.1934 W/m²K
```

### T-002

Doubler `A` double `H`, sans changer `U`.

### T-003

Absence de `λ` : calcul incomplet, aucune valeur inventée.

### T-004

Les ouvertures sont déduites de la surface nette.

### T-005

Invariant :

```text
ΣH_elements + ΣH_bridges = H_building
```

## 19. Références cibles

- ISO 6946 — résistance et transmission thermique ;
- ISO 10211 — ponts thermiques ;
- ISO 52016-1 — besoins et charges énergétiques ;
- ISO 52010-1 — données climatiques / irradiation selon orientation ;
- RE2020 via Rule Pack français dédié.

Sources officielles :

- https://www.iso.org/standard/65708.html
- https://www.iso.org/standard/65710.html
- https://www.iso.org/standard/65696.html
- https://www.iso.org/standard/65703.html
- https://rt-re-batiment.developpement-durable.gouv.fr/

## 20. Critères de sortie MVP

- parois multicouches calculables ;
- ouvertures intégrées ;
- agrégation pièce/zone/bâtiment ;
- vues `U_VALUE` et `HEAT_LOSS` ;
- warnings de données manquantes ;
- provenance des propriétés ;
- tests T-001 à T-005 validés ;
- sortie exploitable par `heating`.
