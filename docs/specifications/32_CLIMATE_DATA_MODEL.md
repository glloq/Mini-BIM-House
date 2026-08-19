# 32 — Modèle de données climatiques

> **Paquet cible :** `packages/climate`  
> **Objectif :** fournir une interface commune aux modules thermique, solaire, pluie, ventilation et confort.

## 1. Principe

Les modules ne consomment jamais directement une API météo externe.

```text
remote/local source
      ↓
climate adapter
      ↓
normalized climate dataset
      ↓
modules
```

## 2. Localisation

```ts
interface ClimateLocation {
  latitude: number;
  longitude: number;
  altitudeM?: number;
  timezone: string;
}
```

Le fuseau est obligatoire pour les séries horaires.

## 3. Provenance

```ts
interface ClimateSource {
  id: string;
  provider: string;
  datasetName?: string;
  stationId?: string;
  periodStart?: string;
  periodEnd?: string;
  retrievedAt?: string;
  license?: string;
  referenceUrl?: string;
}
```

## 4. Résolutions

Support :

```text
HOURLY
DAILY
MONTHLY
DESIGN_CONDITIONS
```

Chaque série indique sa résolution.

## 5. Grandeurs

Architecture cible :

```ts
interface ClimateSample {
  timestamp?: string;
  airTemperatureC?: number;
  relativeHumidity?: number;
  globalHorizontalIrradianceWhM2?: number;
  directNormalIrradianceWhM2?: number;
  diffuseHorizontalIrradianceWhM2?: number;
  precipitationMm?: number;
  windSpeedMs?: number;
  windDirectionDeg?: number;
  atmosphericPressurePa?: number;
}
```

Les champs peuvent être absents.

## 6. Données de calcul

Séparer :

```text
historical/measured
typical meteorological
design conditions
user assumptions
```

Le type doit être visible dans les résultats.

## 7. Données manquantes

Chaque série doit exposer :

- taux de complétude ;
- périodes manquantes ;
- méthode de remplissage éventuelle.

Aucune interpolation silencieuse.

```ts
interface DataGap {
  from: string;
  to: string;
  strategy: 'NONE' | 'LINEAR' | 'NEAREST' | 'CLIMATOLOGY' | 'CUSTOM';
}
```

## 8. Calendrier

Les profils utilisent un calendrier explicite :

- année ;
- jours bissextiles ;
- heure locale ;
- DST ;
- index de pas.

Le calcul scientifique peut convertir vers une ligne de temps normalisée, mais l'import doit conserver l'information d'origine.

## 9. Irradiation

Le module solaire peut demander une projection sur plan incliné.

Cette opération est un service climatique/solaire dédié et doit enregistrer :

- méthode ;
- azimut ;
- inclinaison ;
- données d'entrée.

## 10. Pluie

Le module récupération d'eau doit préférer les séries journalières ou horaires lorsque disponibles.

Une moyenne annuelle ne permet qu'un mode `ESTIMATE`.

## 11. Conditions de dimensionnement

Prévoir :

```ts
interface DesignClimateConditions {
  winterOutdoorTemperatureC?: number;
  summerOutdoorTemperatureC?: number;
  indoorReferenceHumidity?: number;
  source: ClimateSource;
}
```

Les conditions réglementaires éventuelles viennent d'un Rule Pack ou jeu de données dédié.

## 12. Cache

Les datasets lourds peuvent être stockés séparément du projet.

Le projet peut conserver :

```text
dataset reference
fingerprint
source
fallback embedded summary
```

## 13. Confidentialité/offline

L'application doit pouvoir fonctionner sans localisation exacte.

L'utilisateur peut saisir :

- valeurs manuelles ;
- fichier climat ;
- ville/station ;
- coordonnées.

## 14. Schéma JSON

Créer :

```text
schemas/climate.schema.json
```

## 15. Tests

- validation RH 0..1 ;
- timestamps ordonnés ;
- fuseau obligatoire pour série horaire ;
- pluie non négative ;
- données manquantes explicitement détectées ;
- même dataset + même méthode ⇒ même résultat.

## 16. Critère MVP

Pouvoir importer une série mensuelle simple température/pluie/irradiation et l'utiliser simultanément dans trois modules sans adaptation spécifique.
