# 40 — CI, validation et qualité

> **Objectif :** empêcher les régressions géométriques, scientifiques et de format dès les premières PR.

## 1. Pipeline minimal

```text
install
↓
format/lint
↓
typecheck
↓
schema validation
↓
unit tests
↓
domain tests
↓
golden drawing tests
↓
build
```

## 2. Jobs recommandés

```text
lint
typecheck
schemas
unit
geometry
calculations
rules
migrations
drawing
build-web
```

Au début ils peuvent être regroupés, mais les catégories doivent rester identifiables.

## 3. Validation JSON

Tous les fichiers de :

```text
examples/
fixtures/
catalogs/
rule-packs/
```

qui possèdent un schéma doivent être validés en CI.

## 4. TypeScript

Exiger :

```text
strict: true
noImplicitAny
noUncheckedIndexedAccess
exactOptionalPropertyTypes
```

à évaluer selon compatibilité des librairies.

Éviter `any` dans le domaine.

## 5. Tests scientifiques

Chaque formule critique possède :

- cas analytique ;
- unité ;
- tolérance ;
- référence ;
- test indépendant.

## 6. Tolérances

Ne jamais écrire :

```ts
expect(x).toBeCloseTo(y)
```

sans expliquer la tolérance du domaine si elle est importante.

Centraliser par catégorie :

```text
geometry
thermal
hydraulic
energy
```

## 7. Golden tests dessin

Tester :

- scène sémantique ;
- SVG normalisé ;
- symboles ;
- hachures ;
- cotations.

Les IDs non déterministes doivent être normalisés.

## 8. Tests Rule Packs

Pour chaque règle :

```text
PASS
FAIL
UNKNOWN
NOT_APPLICABLE
```

au minimum lorsqu'applicable.

## 9. Tests migrations

Obligatoires avant toute modification de `schemaVersion`.

## 10. Tests end-to-end

Scénario MVP :

1. nouveau projet ;
2. dessiner maison ;
3. créer pièces ;
4. assigner mur ;
5. lancer thermique ;
6. ajouter VMC ;
7. ajouter réseau eau ;
8. sauvegarder ;
9. recharger ;
10. exporter SVG.

## 11. Couverture

La couverture n'est pas l'objectif principal.

Priorité à la couverture des invariants :

- géométrie ;
- conservation ;
- conversions d'unités ;
- migrations ;
- règles ;
- dépendances.

## 12. Benchmarks

Créer des benchmarks pour :

- 100 murs ;
- 1000 objets graphiques ;
- réseau 500 tronçons ;
- simulation batterie annuelle horaire ;
- recalcul thermique complet.

Les seuils de performance seront établis après baseline.

## 13. Sécurité

Vérifier :

- aucun `eval` dans Rule Packs ;
- SVG utilisateur sanitizé ou primitives contrôlées ;
- fichiers JSON limités en taille/profondeur ;
- import CSV robuste ;
- pas de secret API dans le client.

## 14. GitHub Actions

Workflow cible :

```text
.github/workflows/ci.yml
.github/workflows/pages.yml
```

`pages.yml` ne déploie que si CI principale passe.

## 15. Dependabot / mises à jour

Optionnel au début, recommandé ensuite.

Les mises à jour de dépendances géométriques doivent déclencher les golden tests.

## 16. Releases

Une release doit inclure :

- version app ;
- version schema projet ;
- liste migrations ;
- versions Rule Packs embarqués ;
- changelog.

## 17. Critère de sortie

Aucune PR modifiant `geometry`, `calculation-core`, `rule-engine` ou `project-io` ne peut être mergée si ses suites spécialisées échouent.
