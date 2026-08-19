# 19 — Module alimentation en eau

> **Module cible :** `modules/water`  
> **Objectif :** dessiner et calculer les réseaux EF/ECS et réseaux non potables.

## 1. Modèle graphe

```text
WaterNetwork
├── Nodes
│   ├── source
│   ├── junction
│   ├── fixture
│   ├── valve
│   └── equipment
└── Segments
    └── pipe
```

## 2. Types

```text
POTABLE_COLD
DOMESTIC_HOT_WATER
RECIRCULATION
NON_POTABLE
RAINWATER
OTHER
```

La séparation potable/non potable est sémantique, pas seulement graphique.

## 3. Tronçon

```ts
interface WaterPipeSegment {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  lengthM: number;
  internalDiameterM: number;
  materialId: string;
  roughnessM?: number;
  localLossCoefficient?: number;
  insulationAssemblyId?: string;
}
```

## 4. Appareil

```ts
interface WaterFixture {
  fixtureType: string;
  designFlowLps?: number;
  hotWaterFraction?: number;
  minimumPressurePa?: number;
}
```

Les valeurs réglementaires/conventionnelles viennent d'une méthode/règle externe.

## 5. Débits

Distinguer :

- débit nominal appareil ;
- débit probable ;
- débit théorique max.

La simultanéité est configurable.

## 6. Continuité

```text
A = πD²/4
v = Q/A
```

## 7. Pertes de charge

Darcy-Weisbach :

```text
Δp_linear =
f × (L/D) × (ρv²/2)
```

Pertes singulières :

```text
Δp_local =
ΣK × (ρv²/2)
```

Total :

```text
Δp = Δp_linear + Δp_local
```

Le calcul de `f` est isolé et testé.

## 8. Méthodes alternatives

```ts
interface HydraulicLossMethod {
  id: string;
  calculate(segment, state, context): PressureLossResult;
}
```

Le résultat conserve `methodId`.

## 9. Bilan de pression

```text
pression source
- pertes linéaires
- pertes singulières
- hauteur
- équipements
=
pression disponible
```

```text
Δp_height = ρgΔz
```

## 10. ECS

Calculs supplémentaires :

- pertes thermiques ;
- volume contenu ;
- temps d'attente ;
- isolation.

```text
V = A × L
t ≈ V / Q
```

## 11. Bouclage ECS

Futur sous-module :

- boucle ;
- pompe ;
- pertes ;
- équilibrage ;
- retour.

## 12. Résultat par terminal

```ts
interface WaterPathResult {
  fixtureId: string;
  designFlowM3s: number;
  totalPressureLossPa: number;
  elevationLossPa: number;
  availablePressurePa: number;
  criticalSegmentId?: string;
}
```

## 13. Dimensionnement automatique

Chercher le plus petit diamètre catalogue satisfaisant :

- pression minimale ;
- vitesse limite selon méthode ;
- contraintes/règles actives.

## 14. Plan plomberie

Afficher :

- type de réseau ;
- diamètre ;
- sens ;
- vannes ;
- équipements ;
- transitions de niveau.

Inspecteur tronçon :

```text
Type        EF
Tube        PEX 16×2
L           5.82 m
Ø int.      12 mm
Q           ...
v           ...
Δp          ...
```

## 15. Modes d'analyse

```text
DIAMETER
FLOW
VELOCITY
PRESSURE_LOSS
AVAILABLE_PRESSURE
TEMPERATURE
NETWORK_TYPE
ERRORS
```

## 16. Routage

MVP :

- dessin manuel assisté ;
- snap appareils ;
- segments orthogonaux ;
- traversées ;
- changements de niveau.

Routage automatique plus tard.

## 17. Collisions

Le réseau doit disposer d'une géométrie exploitable pour futures collisions :

- structure ;
- ventilation ;
- autres réseaux.

## 18. Warnings

```text
WATER_DISCONNECTED_FIXTURE
WATER_NO_SOURCE
WATER_INVALID_DIAMETER
WATER_EXCESSIVE_PRESSURE_LOSS
WATER_INSUFFICIENT_TERMINAL_PRESSURE
WATER_METHOD_MISSING
WATER_CROSS_CONNECTION_RISK
WATER_UNKNOWN_PIPE_PROPERTIES
```

## 19. Tests

### WATER-001

`A = πD²/4`.

### WATER-002

À débit constant, diminution de diamètre ⇒ vitesse supérieure.

### WATER-003

Longueur doublée ⇒ terme linéaire doublé, paramètres constants.

### WATER-004

Vérifier `ρgΔz`.

### WATER-005

Terminal déconnecté ⇒ pas de pression valide.

### WATER-006

Conservation des débits aux nœuds.

## 20. Références candidates

- série EN 806 ;
- NF DTU 60.11 ;
- réglementation sanitaire française ;
- catalogues fabricants.

Les données protégées des normes commerciales ne doivent pas être redistribuées sans droit.
