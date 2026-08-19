# 12 — Test Strategy

> **Objectif :** garantir la fiabilité géométrique, numérique, réglementaire et documentaire du projet.
> **Principe :** tout résultat technique doit être testable indépendamment de l’interface.

---

## 1. Niveaux de tests

Le projet utilise cinq niveaux :

1. tests unitaires ;
2. tests de propriétés ;
3. tests d’intégration ;
4. tests de référence métier ;
5. tests end-to-end.

---

## 2. Tests unitaires

Cibles prioritaires :

- conversions d’unités ;
- géométrie 2D ;
- intersections ;
- offsets ;
- calculs de surfaces/volumes ;
- résistances thermiques ;
- pertes de charge ;
- chutes de tension ;
- calculs d’éclairage ;
- métrés ;
- évaluateur de règles.

Une formule ne doit jamais être validée uniquement via un test UI.

---

## 3. Tests numériques

Chaque moteur numérique doit définir :

- tolérance absolue ;
- tolérance relative ;
- domaine d’entrée valide ;
- comportement aux limites ;
- traitement des valeurs manquantes.

Exemple :

```ts
expectClose(actual, expected, {
  absolute: 1e-9,
  relative: 1e-6,
});
```

Les comparaisons flottantes strictes sont interdites lorsqu’elles ne sont pas mathématiquement justifiées.

---

## 4. Property-based testing

Très recommandé pour :

- conversions aller/retour ;
- rotation + rotation inverse ;
- sérialisation + désérialisation ;
- intersection symétrique ;
- conservation de géométrie lors de transformations ;
- invariants des réseaux.

Exemples d’invariants :

```text
area(polygon) >= 0
length(segment) >= 0
convert(convert(x, A, B), B, A) ≈ x
```

---

## 5. Géométrie

Cas minimaux obligatoires :

- rectangle ;
- L ;
- T ;
- X ;
- murs colinéaires ;
- murs presque colinéaires ;
- angles aigus ;
- murs très courts ;
- ouverture proche d’une jonction ;
- changement d’épaisseur ;
- boucle fermée ;
- boucle non fermée.

Le moteur doit tester explicitement ses tolérances géométriques.

---

## 6. Golden tests graphiques

Les vues SVG importantes utilisent des fichiers de référence.

Exemples :

```text
tests/golden/svg/simple-room.svg
tests/golden/svg/wall-junction-T.svg
tests/golden/svg/material-hatches.svg
```

Le test doit comparer la structure sémantique avant de comparer le rendu brut, afin d’éviter les faux positifs liés à l’ordre des attributs SVG.

---

## 7. Tests des modules de calcul

Chaque module possède :

```text
modules/<module>/tests/
├── unit/
├── reference/
├── edge-cases/
└── fixtures/
```

Chaque cas de référence documente :

- les entrées ;
- la source de la méthode ;
- le résultat attendu ;
- les tolérances ;
- les hypothèses.

---

## 8. Validation scientifique et technique

Un résultat `ENGINEERING`, `STANDARD` ou `REGULATORY` doit disposer d’une validation documentée.

Niveaux :

### V0 — Implémentation

Formule implémentée et tests unitaires présents.

### V1 — Référence analytique

Comparaison à un cas calculable manuellement.

### V2 — Référence externe

Comparaison à un exemple publié, une norme, un DTU, un document institutionnel ou un outil de référence.

### V3 — Cross-check indépendant

Comparaison avec une seconde implémentation ou un logiciel tiers fiable.

### V4 — Validation réglementaire

Méthode et domaine validés pour usage explicitement réglementaire.

Le niveau V4 doit rester rare et explicite.

---

## 9. Tests des règles

Chaque règle possède au minimum :

- un cas conforme ;
- un cas non conforme ;
- un cas indéterminé ;
- un cas frontière.

Une règle réglementaire doit inclure la référence de version testée.

---

## 10. Tests des migrations

Pour chaque migration :

```text
before.json
      ↓ migration
expected-after.json
```

Tests obligatoires :

- migration déterministe ;
- aucune perte de donnée non ciblée ;
- validation finale ;
- conservation des identifiants.

---

## 11. Round-trip projet

Test critique :

```text
Project
→ serialize
→ parse
→ validate
→ normalize
→ compare
```

La comparaison doit ignorer uniquement les champs explicitement non persistants.

---

## 12. Tests de performance

Budgets initiaux proposés :

- interaction simple plan 2D : réponse perçue immédiate ;
- déplacement d’un mur : pas de recalcul global bloquant ;
- recalculs lourds : déportables vers Web Worker ;
- gros projet de test : au moins plusieurs centaines d’entités sans effondrement de l’éditeur.

Les budgets précis seront figés après le premier prototype mesurable.

---

## 13. End-to-end

Parcours MVP :

1. créer projet ;
2. créer niveau ;
3. dessiner pièce ;
4. attribuer assemblage ;
5. insérer fenêtre ;
6. afficher métré ;
7. lancer calcul thermique ;
8. sauvegarder ;
9. recharger ;
10. vérifier conservation.

---

## 14. Fixtures canoniques

Créer plusieurs maisons de référence :

- `house-01-single-room` ;
- `house-02-small-flat` ;
- `house-03-two-storey` ;
- `house-04-technical-networks` ;
- `house-05-complete-reference`.

Ces fixtures servent à tous les modules.

---

## 15. CI

Une PR ne doit pas être fusionnée si échouent :

- lint ;
- typecheck ;
- tests unitaires ;
- validation JSON Schema ;
- migrations ;
- golden tests critiques ;
- build de production.

---

## 16. Traçabilité d’un bug technique

Tout bug de calcul corrigé doit ajouter :

- un test reproduisant le bug ;
- une note dans le changelog si le résultat utilisateur change ;
- une revue de l’impact sur les résultats mis en cache ;
- si nécessaire une nouvelle version du module de calcul.

---

## 17. Critères de qualité avant publication

Un module n’est pas déclaré stable avant :

- couverture des cas nominaux ;
- cas limites documentés ;
- unités vérifiées ;
- références citées ;
- erreurs explicites ;
- niveau de validation connu ;
- résultats reproductibles.
