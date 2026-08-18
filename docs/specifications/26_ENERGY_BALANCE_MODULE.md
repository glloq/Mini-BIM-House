# 26 — Module bilan énergétique global

> **Module cible :** `modules/energy-balance`  
> **Objectif :** agréger les systèmes sans dupliquer leurs calculs physiques.

## 1. Rôle

Le module ne recalcule pas :

- chauffage ;
- ECS ;
- ventilation ;
- éclairage ;
- PV ;
- batterie.

Il consomme leurs sorties et construit une balance commune.

## 2. Flux

```text
Heating
DHW
Ventilation
Lighting
Equipment
Cooling
   │
   ▼
LOAD PROFILE
   │
   ├── PV
   ├── Battery
   └── Grid
```

## 3. Vecteurs énergétiques

```text
ELECTRICITY
GAS
WOOD
DISTRICT_HEAT
SOLAR
OTHER
```

## 4. Séries temporelles

Format commun :

```ts
interface EnergySeries {
  timestepSeconds: number;
  start: string;
  unit: "Wh";
  values: number[];
}
```

Tous les modules doivent être alignés avant agrégation.

## 5. Indicateurs

- énergie utile ;
- énergie finale ;
- énergie importée ;
- énergie exportée ;
- autoconsommation ;
- autosuffisance ;
- pointe de puissance ;
- répartition par usage ;
- répartition par vecteur.

## 6. Énergie primaire / indicateurs réglementaires

Ils sont calculés uniquement via une méthode ou Rule Pack explicitement sélectionné.

Ne jamais utiliser un coefficient national global codé dans le cœur.

## 7. Scénarios

Comparer :

```text
BASELINE
RENOVATION_A
RENOVATION_B
AUTONOMY
CUSTOM
```

Sur les mêmes indicateurs.

## 8. Graphiques

- Sankey logique dans une vue dédiée si implémenté ;
- barres mensuelles ;
- profils journaliers ;
- répartition par usage ;
- import/export ;
- puissance de pointe.

## 9. Conservation

Invariant général :

```text
energy inputs
=
useful outputs
+ exported energy
+ storage delta
+ losses
```

La définition exacte dépend du périmètre choisi.

## 10. ISO 52000

ISO 52000-1 fournit une structure modulaire globale pour l'évaluation de la performance énergétique des bâtiments.

Source :

- https://www.iso.org/standard/65601.html

Cette logique correspond bien à l'architecture modulaire du projet, mais l'implémentation réglementaire nationale reste séparée.

## 11. RE2020

Le Rule Pack français doit sélectionner la version des textes correspondant à la date et au type de projet.

Source officielle :

- https://rt-re-batiment.developpement-durable.gouv.fr/textes-en-version-consolidee-a617.html

## 12. Tests

### EN-001
Somme des usages = charge totale.

### EN-002
Vérifier cohérence des pas temporels.

### EN-003
Aucune double comptabilisation du chauffage électrique.

### EN-004
Conservation énergie avec PV+batterie.

### EN-005
Changer un coefficient réglementaire ne change pas les kWh physiques.

## 13. MVP

- agrégation annuelle/mensuelle ;
- profil électrique ;
- PV/batterie ;
- graphiques ;
- scénarios ;
- séparation physique/réglementaire.
