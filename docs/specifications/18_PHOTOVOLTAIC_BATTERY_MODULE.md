# 18 — Modules photovoltaïque et batterie

> **Modules cibles :** `modules/photovoltaic`, `modules/battery`

# Partie A — Photovoltaïque

## 1. Géométrie

```ts
interface SolarSurface {
  surfaceId: string;
  polygon: Polygon2D;
  areaM2: number;
  azimuthDeg: number;
  tiltDeg: number;
  obstacles: SolarObstacle[];
  exclusionZones: Polygon2D[];
}
```

Fonctionnement possible :

- surface saisie manuellement ;
- géométrie dérivée du toit.

## 2. Catalogue panneaux

```ts
interface PvModuleDefinition {
  manufacturer?: string;
  model?: string;
  widthM: number;
  heightM: number;
  nominalPowerWp: number;
  efficiency?: number;
  vocV?: number;
  vmpV?: number;
  iscA?: number;
  impA?: number;
  source: PropertySource;
}
```

## 3. Implantation automatique

Tester :

- portrait ;
- paysage ;
- marges ;
- obstacles ;
- zones interdites ;
- alignement.

Objectifs :

```text
MAX_POWER
MAX_ANNUAL_ENERGY
MIN_PANEL_COUNT_FOR_TARGET
MAX_SELF_CONSUMPTION
CUSTOM
```

## 4. Ombres

MVP :

- obstacles ;
- masque simplifié ;
- coefficient manuel.

Futur :

- horizon ;
- bâtiments voisins ;
- végétation ;
- simulation solaire géométrique.

## 5. Backends solaires

### PVGIS

Backend recommandé lorsque réseau disponible.

### OFFLINE_SIMPLE

Calcul local simplifié, marqué `ESTIMATE`.

Le résultat enregistre toujours le backend utilisé.

## 6. Intégration PVGIS

Isoler :

```text
modules/photovoltaic/adapters/pvgis
```

Le cœur métier ne dépend jamais directement de l'API.

Sources officielles :

- https://joint-research-centre.ec.europa.eu/photovoltaic-geographical-information-system-pvgis_en
- https://joint-research-centre.ec.europa.eu/photovoltaic-geographical-information-system-pvgis/using-pvgis-5/pvgis-5-user-manual_en

## 7. Productible

Sorties :

- puissance installée `kWp` ;
- production annuelle ;
- production mensuelle ;
- productible spécifique ;
- pertes ;
- orientation ;
- inclinaison ;
- source climatique.

## 8. Onduleurs

```ts
interface PvInverter {
  maxDcPowerW?: number;
  nominalAcPowerW: number;
  mpptVoltageMinV?: number;
  mpptVoltageMaxV?: number;
  maxDcVoltageV?: number;
  maxInputCurrentA?: number;
  mpptCount?: number;
}
```

## 9. Vérifications strings

Prévoir :

- `Voc` string ;
- tension MPP ;
- courant ;
- puissance DC ;
- limites MPPT ;
- limites onduleur.

La conformité électrique appartient au Rule Pack électrique.

## 10. Vue graphique

Toiture :

- panneaux ;
- orientation ;
- obstacles ;
- exclusion ;
- strings ;
- puissance par face.

---

# Partie B — Batterie

## 11. Modèle

```ts
interface BatteryDefinition {
  nominalCapacityKWh: number;
  usableCapacityKWh?: number;
  minSoc?: number;
  maxSoc?: number;
  maxChargePowerKW?: number;
  maxDischargePowerKW?: number;
  chargeEfficiency?: number;
  dischargeEfficiency?: number;
}
```

## 12. Simulation temporelle

Séries :

```text
load[t]
pv[t]
soc[t]
```

Ordre :

1. PV direct vers charge ;
2. excédent vers batterie ;
3. déficit depuis batterie ;
4. solde vers réseau.

## 13. Invariant énergétique

```text
PV + gridImport + batteryDischarge
=
load + gridExport + batteryCharge + losses
```

Test obligatoire.

## 14. Pas de temps

Cibles :

```text
1 h
30 min
15 min
```

MVP : `1 h`.

Une simulation mensuelle ne doit pas être utilisée pour annoncer une autoconsommation précise avec batterie.

## 15. Indicateurs

- autoconsommation ;
- autosuffisance ;
- énergie chargée ;
- énergie déchargée ;
- pertes ;
- cycles équivalents ;
- import ;
- export ;
- SOC min/max ;
- temps batterie vide/pleine.

## 16. Hors réseau

Calculer :

```text
unservedEnergyKWh
```

Une configuration avec énergie non servie ne peut pas être qualifiée d'autonome.

## 17. Solveur

Objectifs :

```text
TARGET_SELF_SUFFICIENCY
TARGET_ZERO_UNSERVED_ENERGY
MIN_COST
MIN_BATTERY
MIN_GRID_IMPORT
```

## 18. Tests PV

### PV-001
`20 × 450 Wp = 9.0 kWp`.

### PV-002
Aucun panneau ne coupe une zone d'exclusion.

### PV-003
Implantation déterministe.

### PV-004
Backend et source présents dans le résultat.

## 19. Tests batterie

### BAT-001
Sans PV/batterie : `gridImport = load`.

### BAT-002
PV = charge : aucun flux réseau/batterie.

### BAT-003
Limites SOC.

### BAT-004
Limites puissance.

### BAT-005
Conservation énergétique.

## 20. Références

- PVGIS / JRC Commission européenne ;
- ISO 52010-1 lorsque pertinent ;
- données fabricants ;
- règles électriques dans `electrical`.
