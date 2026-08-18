# 08 — Calculation Engine

> **Objectif :** définir l’API commune des calculateurs et leur orchestration.

## 1. Principe

Chaque module de calcul est indépendant mais peut consommer les résultats d’autres modules.

```text
Project data
   ↓
Validation
   ↓
Dependency graph
   ↓
Calculation modules
   ↓
Derived results
   ↓
Views / reports / rules
```

## 2. Interface de module

```ts
interface CalculationModule<TOutput = unknown> {
  id: string;
  version: string;
  title: string;
  precisionLevel: CalculationPrecisionLevel;

  dependencies: string[];

  validate(ctx: CalculationContext): ValidationResult;
  calculate(ctx: CalculationContext): CalculationResult<TOutput>;
}
```

## 3. CalculationContext

```ts
interface CalculationContext {
  project: Readonly<Project>;
  scenarioId?: EntityId;
  derived: Readonly<DerivedDataStore>;
  settings: CalculationSettings;
  regulatoryContext: RegulatoryContext;
}
```

## 4. CalculationResult

```ts
interface CalculationResult<T> {
  moduleId: string;
  moduleVersion: string;
  status: 'OK' | 'WARNING' | 'ERROR' | 'INCOMPLETE';
  output?: T;
  assumptions: CalculationAssumption[];
  warnings: CalculationWarning[];
  trace: CalculationTrace;
}
```

## 5. Trace

```ts
interface CalculationTrace {
  calculatedAt: string;
  inputFingerprint: string;
  formulas?: FormulaReference[];
  sourceReferences?: string[];
  dependencyResults?: string[];
}
```

## 6. Dépendances

Exemple :

```text
geometry
  ↓
quantities
  ↓
thermal-envelope
  ↓
heating-load
  ↓
annual-energy
  ↓
pv-sizing
```

Le moteur construit un DAG et refuse les cycles.

## 7. Invalidation

Modifier une fenêtre doit invalider uniquement les résultats dépendants :

```text
opening geometry
→ room / envelope geometry
→ thermal
→ heating
→ energy
→ PV scenario
```

Le métré plomberie ne doit pas être recalculé sans raison.

## 8. Cache

Clé recommandée :

```text
module id + version + scenario + input fingerprint
```

## 9. Calculs synchrones / Web Workers

Calculs courts : synchrones.

Calculs lourds : Web Worker.

L’API métier reste identique.

## 10. Unités

Tous les modules utilisent des quantités typées.

Éviter :

```ts
power = 3500
```

Préférer :

```ts
power = W(3500)
```

ou un type équivalent empêchant les erreurs d’unité.

## 11. Valeurs inconnues

Un module ne doit pas transformer arbitrairement une donnée absente en zéro.

Il doit :

- retourner `INCOMPLETE` ;
- demander une hypothèse ;
- ou utiliser une valeur par défaut explicitement tracée.

## 12. Hypothèses

Exemple :

```text
Température extérieure de calcul : -4 °C
Origine : profil climatique X
Niveau : ENGINEERING
```

Toutes les hypothèses importantes doivent être affichables.

## 13. Sensibilité

À terme, chaque module peut déclarer des paramètres variables afin de produire une étude de sensibilité.

Exemple :

```text
épaisseur isolant 100 → 240 mm
```

et mesurer l’effet sur :

- U ;
- puissance chauffage ;
- énergie annuelle ;
- coût ;
- carbone.

## 14. Scénarios

Le moteur calcule chaque scénario avec un contexte immuable.

Comparaison :

```ts
compareResults(base, variant)
```

## 15. Optimisation

Le futur optimiseur ne doit pas réimplémenter les formules.

Il modifie des paramètres de scénario puis appelle les modules existants.

## 16. Formules

Toute formule importante possède :

```ts
interface FormulaReference {
  id: string;
  title: string;
  equation?: string;
  sourceRef?: string;
  notes?: string;
}
```

## 17. Modules purs

Quand possible, la fonction physique centrale doit être pure :

```ts
calcPipePressureLoss(input): output
calcWallThermalResistance(input): output
calcCableVoltageDrop(input): output
```

Le wrapper `CalculationModule` gère projet, validation et traçabilité.

## 18. Erreurs

Distinguer :

- donnée manquante ;
- donnée invalide ;
- domaine hors validité ;
- échec numérique ;
- non-conformité réglementaire.

La non-conformité réglementaire n’est pas une erreur de calcul.

## 19. Tests

Chaque formule doit avoir :

- tests unitaires ;
- valeurs de référence ;
- limites ;
- unités ;
- cas invalides.

Chaque module doit avoir un projet de test minimal reproductible.

## 20. Reproductibilité

Un résultat exporté doit permettre de retrouver :

- version du module ;
- version du projet ;
- paramètres ;
- hypothèses ;
- références ;
- scénario.
