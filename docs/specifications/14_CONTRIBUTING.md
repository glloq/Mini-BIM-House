# 14 — Contributing

> **Objectif :** empêcher l’architecture de dériver à mesure que le projet grandit.

---

## 1. Règle principale

Une contribution doit respecter la séparation :

```text
Domain
Geometry
Calculations
Rules
Rendering
UI
```

Une couche supérieure peut dépendre d’une couche inférieure autorisée ; l’inverse est interdit.

---

## 2. Avant de coder

Pour toute fonctionnalité significative :

1. identifier l’objet métier concerné ;
2. identifier la source de vérité ;
3. identifier le module propriétaire ;
4. préciser les unités ;
5. préciser si le résultat est persisté ou dérivé ;
6. préciser les références techniques ;
7. vérifier si un ADR est nécessaire.

---

## 3. Pull Requests

Une PR doit rester focalisée.

Elle doit inclure :

- objectif ;
- impact architecture ;
- tests ajoutés ;
- captures si UI ;
- références si calcul technique ;
- migration si format projet modifié ;
- documentation si API publique modifiée.

---

## 4. Modification du modèle de domaine

Toute modification persistante doit vérifier :

- compatibilité fichier ;
- migration ;
- schéma JSON ;
- fixtures ;
- dépendances des modules.

Une propriété calculable ne doit pas être ajoutée au modèle persistant sans justification.

---

## 5. Calculs

Toute nouvelle formule doit documenter :

```text
Nom
Objectif
Entrées
Sorties
Unités
Domaine de validité
Hypothèses
Référence
Niveau de validation
```

Une constante physique ou réglementaire ne doit pas apparaître sans nom ni source.

---

## 6. Unités

Interdit :

```ts
const x = 42; // unité implicite
```

Préférer :

```ts
const wallHeightMm = 2500;
```

ou un type quantité défini par le package `units`.

Les conversions doivent être centralisées.

---

## 7. Matériaux

Une propriété matériau doit distinguer :

- valeur ;
- unité ;
- provenance ;
- méthode ;
- date/version si pertinente.

Les données utilisateur ne doivent pas être présentées comme données normatives.

---

## 8. Règles réglementaires

Interdit :

```ts
if (socketCount < 6) showError();
```

si la valeur provient d’une règle externe.

La logique doit passer par :

```text
Rule Pack → Rule → Evaluation → Diagnostic
```

La référence applicable doit être récupérable depuis le diagnostic.

---

## 9. UI

L’UI ne doit pas contenir :

- formules métier ;
- constantes réglementaires ;
- logique géométrique profonde ;
- conversions dispersées.

Les composants UI affichent et déclenchent des commandes.

---

## 10. Commands

Toute modification structurante du projet doit préférer le pattern Command :

```ts
interface Command {
  execute(state: ProjectState): ProjectState;
  undo(state: ProjectState): ProjectState;
}
```

Cela garantit Undo/Redo et audit des modifications.

---

## 11. Tests requis

### Bug

Ajouter un test reproduisant le problème.

### Feature calcul

Ajouter cas nominal + limites.

### Géométrie

Ajouter fixture et, si utile, golden SVG.

### Format projet

Ajouter validation + migration.

### Règle

Ajouter conforme/non conforme/unknown/frontière.

---

## 12. Documentation

La documentation de référence est dans `docs/`.

Les décisions importantes sont dans `docs/adr/`.

Si le code contredit un document d’architecture validé, la PR doit soit :

- corriger le code ;
- soit proposer explicitement la modification du document/ADR.

---

## 13. Convention de commits recommandée

```text
feat:
fix:
refactor:
test:
docs:
chore:
perf:
```

Pour une modification d’un module :

```text
feat(thermal): add wall transmission losses
```

---

## 14. Définition de terminé

Une fonctionnalité est terminée si :

- le code compile ;
- le typecheck passe ;
- les tests passent ;
- les erreurs utilisateur sont gérées ;
- les unités sont explicites ;
- les références sont documentées ;
- la sauvegarde reste valide ;
- l’UI ne duplique pas la logique métier ;
- la documentation utile est mise à jour.
