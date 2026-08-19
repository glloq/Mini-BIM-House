# 23 — Module électrique

> **Module cible :** `modules/electrical`  
> **Objectif :** concevoir graphiquement l'installation électrique, calculer puissance/courant/chute de tension et exécuter des contrôles via Rule Packs.

## 1. Séparation

Le module physique calcule :

- puissance ;
- courant ;
- longueur ;
- section ;
- chute de tension ;
- charge des circuits.

Le Rule Pack contrôle :

- protections ;
- prescriptions logement ;
- implantation ;
- nombres minimaux ;
- exigences spécifiques.

## 2. Modèle

```text
ElectricalSystem
├── service
├── distributionBoards
├── circuits
├── cables
├── protectiveDevices
├── outlets
├── switches
├── luminaires
├── fixedLoads
├── PV
├── battery
└── EV
```

## 3. Circuit

```ts
interface ElectricalCircuit {
  id: string;
  boardId: string;
  voltageV: number;
  phases: 1 | 3;
  conductorSectionMm2?: number;
  lengthM?: number;
  loadIds: string[];
  protectiveDeviceId?: string;
}
```

## 4. Charges

```ts
interface ElectricalLoad {
  activePowerW?: number;
  apparentPowerVA?: number;
  powerFactor?: number;
  demandFactor?: number;
  startingCurrentA?: number;
}
```

## 5. Courant

Monophasé simplifié :

```text
I = P / (U × cosφ)
```

Triphasé équilibré :

```text
I = P / (√3 × U × cosφ)
```

Le moteur doit savoir si `U` est tension phase-neutre ou phase-phase.

## 6. Simultanéité

Séparer :

- puissance installée ;
- puissance appelée ;
- puissance de calcul.

Les facteurs de simultanéité doivent être documentés.

## 7. Chute de tension

Le moteur doit supporter une méthode générique résistive puis un modèle AC plus complet.

Le résultat contient :

```text
ΔU [V]
ΔU [%]
```

par tronçon et par chemin.

## 8. Conducteurs

Catalogue :

- cuivre/aluminium ;
- section ;
- isolation ;
- mode de pose ;
- température ;
- propriétés nécessaires.

Les capacités de courant réglementaires proviennent de tables/méthodes autorisées, pas d'une approximation cachée.

## 9. Protections

Objets :

```text
breaker
fuse
RCD
surgeProtection
disconnect
other
```

Le Rule Pack relie protection, circuit, section et usage.

## 10. Tableau

Vue dédiée :

```text
Main board
├── row
├── protective devices
├── circuits
└── phase assignment
```

Prévoir équilibrage triphasé futur.

## 11. Symboles plan

La bibliothèque graphique doit distinguer :

- prises ;
- commandes ;
- luminaires ;
- tableau ;
- équipements spécialisés ;
- communication.

Les symboles sont sémantiques et profilables.

## 12. Analyse graphique

Modes :

```text
CIRCUITS
LOAD
CURRENT
VOLTAGE_DROP
PROTECTION
PHASE
COMPLIANCE
```

## 13. NF C 15-100

Le référentiel français doit être géré dans un Rule Pack versionné.

AFNOR indique qu'une révision majeure de la série NF C 15-100 date d'août 2024 et comporte notamment une partie dédiée aux bâtiments d'habitation (`NF C 15-100-10`).

Source de contexte :

- https://www.afnor.org/actualites/excellence-efqm/installations-electriques-nf-c15-100/

La norme étant protégée, le dépôt public ne doit pas redistribuer son texte ou ses tableaux sans droit.

## 14. Résultats

```ts
interface ElectricalCircuitResult {
  circuitId: string;
  installedPowerW: number;
  designPowerW: number;
  designCurrentA: number;
  voltageDropV?: number;
  voltageDropPercent?: number;
  warnings: CalculationWarning[];
}
```

## 15. Interactions

Le module reçoit :

- PV ;
- batterie ;
- PAC ;
- ECS ;
- ventilation ;
- éclairage ;
- équipements.

Il fournit ses consommations à `energy-balance`.

## 16. Tests

### ELEC-001

Cas monophasé résistif : `P=2300 W`, `U=230 V`, `cosφ=1` ⇒ `I=10 A`.

### ELEC-002

Puissance installée ≠ puissance de calcul si facteur de demande < 1.

### ELEC-003

La chute de tension totale d'un chemin est cohérente avec les tronçons.

### ELEC-004

Circuit déconnecté du tableau ⇒ erreur.

### ELEC-005

Les règles réglementaires peuvent changer sans changer les équations physiques.

## 17. MVP

- tableau ;
- circuits ;
- prises/luminaires/charges ;
- courant ;
- chute de tension ;
- sections choisies manuellement ou proposées ;
- plan par circuits ;
- Rule Pack France séparé.
