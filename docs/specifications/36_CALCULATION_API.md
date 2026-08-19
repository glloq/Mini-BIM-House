# 36 — API définitive des modules de calcul

> **Paquet cible :** `packages/calculation-core`

## 1. Objectif

Fournir une API stable à tous les calculateurs.

## 2. Contrat module

```ts
interface CalculationModule<TSettings, TOutput> {
  id: string;
  version: string;

  dependencies: CalculationDependency[];
  settingsSchemaId: string;

  validate(ctx: CalculationContext, settings: TSettings): ValidationResult;

  calculate(
    ctx: CalculationContext,
    settings: TSettings,
    signal?: AbortSignal,
  ): Promise<CalculationResult<TOutput>> | CalculationResult<TOutput>;
}
```

## 3. Contexte

```ts
interface CalculationContext {
  project: Readonly<Project>;
  derived: Readonly<DerivedModel>;
  climate?: Readonly<ClimateDataset>;
  catalogs: Readonly<CatalogRegistry>;
  constants: Readonly<PhysicalConstants>;
  ruleContext?: Readonly<RuleContext>;
}
```

Le module ne modifie jamais `project`.

## 4. Résultat

```ts
interface CalculationResult<T> {
  moduleId: string;
  moduleVersion: string;
  precision: PrecisionLevel;
  status: 'OK' | 'PARTIAL' | 'FAILED';
  methodId: string;
  inputFingerprint: string;
  outputs: T;
  warnings: CalculationWarning[];
  assumptions: CalculationAssumption[];
  references: CalculationReference[];
  trace?: CalculationTrace;
}
```

## 5. Dépendances

```ts
interface CalculationDependency {
  moduleId: string;
  required: boolean;
  outputSelector?: string;
}
```

Le moteur construit un DAG si possible.

Les cycles sont rejetés sauf orchestrateur dédié.

## 6. Fingerprint

Le cache est indexé par :

```text
module version
settings
relevant input subset
dependency outputs
catalog versions
method version
```

Pas par l'objet projet complet si seules quelques données sont pertinentes.

## 7. Sélecteur d'entrées

Chaque module déclare les zones de données qui l'invalident.

Exemple :

```text
thermal:
building.geometry
assemblies
materials.thermal
climate.design
```

Une modification du nom du projet ne déclenche pas de recalcul thermique.

## 8. Déterminisme

Même entrée + même méthode + mêmes versions ⇒ même sortie.

Les modules ne doivent pas utiliser :

- heure courante ;
- random ;
- locale système ;
- réseau ;

sans les recevoir explicitement.

## 9. Web Workers

Les calculs lourds peuvent être exécutés en worker.

Le contrat doit rester sérialisable.

## 10. Annulation

Un recalcul obsolète doit pouvoir être annulé via `AbortSignal`.

L'UI ne doit pas afficher un résultat d'une ancienne géométrie après une modification récente.

## 11. Progression

Option :

```ts
interface CalculationProgress {
  phase: string;
  completed: number;
  total?: number;
}
```

Seulement pour tâches réellement longues.

## 12. Constantes physiques

Service unique :

```ts
interface PhysicalConstants {
  gravityMs2: number;
  waterDensityKgM3: number;
  waterSpecificHeatJKgK: number;
  airDensityKgM3: number;
  airSpecificHeatJKgK: number;
}
```

Chaque constante peut porter sa source/version.

## 13. Méthodes

Un module peut proposer plusieurs méthodes :

```text
ESTIMATE_SIMPLE
ENGINEERING_...
STANDARD_...
```

Le choix est enregistré dans les settings.

## 14. Traçabilité

`trace` peut contenir :

- étapes ;
- formules identifiées ;
- valeurs intermédiaires ;
- objets sources.

Objectif : répondre à « pourquoi ce résultat ? ».

## 15. Erreurs

Une exception inattendue = bug.

Une donnée manquante = résultat `PARTIAL/FAILED` avec diagnostic structuré.

## 16. Agrégation

L'orchestrateur expose :

```ts
calculateModule(id);
calculateAffected(changes);
calculateScenario(id);
calculateAllEnabled();
```

## 17. Schéma settings

Créer :

```text
schemas/module-settings.schema.json
```

Les settings spécifiques peuvent avoir des sous-schémas.

## 18. Tests

- déterminisme ;
- invalidation ;
- cache ;
- annulation ;
- dépendance manquante ;
- module version change ⇒ cache invalidé ;
- exception capturée comme erreur technique ;
- trace reproductible.

## 19. Critère MVP

Les modules `thermal`, `rainwater` et `electrical` doivent fonctionner via exactement le même orchestrateur sans logique spécifique dans l'UI.
