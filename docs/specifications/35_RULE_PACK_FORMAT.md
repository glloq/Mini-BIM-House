# 35 — Format des Rule Packs

> **Paquet cible :** `packages/rule-engine`

## 1. Objectif

Décorréler complètement :

```text
physique
géométrie
UI
réglementation
```

Une réglementation nouvelle doit pouvoir être ajoutée sans modifier les calculateurs lorsque les grandeurs nécessaires existent déjà.

## 2. Structure

```ts
interface RulePack {
  id: string;
  version: string;
  jurisdiction: Jurisdiction;
  validity: DateRange;
  references: StandardReference[];
  parameters?: Record<string, unknown>;
  rules: RuleDefinition[];
}
```

## 3. Juridiction

```ts
interface Jurisdiction {
  country: string;
  region?: string;
  municipality?: string;
  domain: string;
}
```

## 4. Validité

```text
validFrom
validTo
projectDateSelector
```

Le moteur doit pouvoir expliquer pourquoi un pack est sélectionné.

## 5. Références

```ts
interface StandardReference {
  id: string;
  type:
    | "LAW"
    | "REGULATION"
    | "STANDARD"
    | "DTU"
    | "GUIDELINE"
    | "DATA_SOURCE"
    | "OTHER";
  title: string;
  version?: string;
  url?: string;
  notes?: string;
}
```

## 6. Règle

```ts
interface RuleDefinition {
  id: string;
  severity: "ERROR" | "WARNING" | "INFO";
  appliesTo: string;
  evaluator: RuleEvaluator;
  messageTemplate: string;
  referenceIds: string[];
  tags?: string[];
}
```

## 7. Évaluateurs autorisés

```text
DECLARATIVE
JSON_LOGIC
MODULE_FUNCTION
```

Interdit :

```text
eval()
new Function()
arbitrary JavaScript
remote script
```

## 8. Fonctions métier enregistrées

Les contrôles complexes utilisent un registre :

```ts
registerRuleFunction(
  "electrical.checkCircuit",
  checkCircuit
);
```

Une fonction doit être :

- versionnée ;
- testée ;
- pure autant que possible ;
- sans accès réseau.

## 9. Paramètres

Certains référentiels ont des valeurs/tabulations.

La structure permet :

```json
{
  "parameters": {
    "profileId": "licensed-local-profile"
  }
}
```

Pour les normes protégées, le dépôt public peut contenir le moteur et les clés attendues sans redistribuer les tableaux protégés.

## 10. Résultat

```ts
interface RuleResult {
  ruleId: string;
  status: "PASS" | "FAIL" | "UNKNOWN" | "NOT_APPLICABLE";
  severity: "ERROR" | "WARNING" | "INFO";
  objectIds: string[];
  message: string;
  referenceIds: string[];
  evidence?: Record<string, unknown>;
}
```

## 11. UNKNOWN

Une règle doit retourner `UNKNOWN` si les données nécessaires manquent.

Il est interdit de convertir automatiquement `UNKNOWN` en `PASS`.

## 12. Suggestions

Une règle peut fournir une suggestion :

```ts
interface RuleSuggestion {
  type: "TEXT" | "COMMAND_PROPOSAL";
  description: string;
  commandId?: string;
  commandArgs?: unknown;
}
```

Aucune correction n'est appliquée sans action utilisateur.

## 13. Packs composables

Exemple :

```text
FR-BASE
 + FR-ELECTRICAL-2024
 + FR-VENTILATION
 + FR-RAINWATER-2025
```

Résoudre explicitement les conflits de paramètres.

## 14. Priorités

En cas de doublon :

1. même règle + version exacte ;
2. pack plus spécifique ;
3. conflit non résolu ⇒ erreur de configuration.

Ne jamais « choisir le dernier chargé ».

## 15. Signature / intégrité

Futur :

- hash ;
- signature ;
- source ;
- version publiée.

Utile pour packs réglementaires validés.

## 16. Schéma JSON

Étendre :

```text
schemas/rule-pack.schema.json
```

## 17. Tests

- sélection par date ;
- `UNKNOWN` ;
- `NOT_APPLICABLE` ;
- référence obligatoire ;
- conflit de packs ;
- fonction non enregistrée ;
- JSON Logic interdit d'accès externe ;
- déterminisme.

## 18. Critère MVP

Pouvoir charger deux versions d'un même pack, choisir celle applicable selon date projet et expliquer chaque résultat de règle.
