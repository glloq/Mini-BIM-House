# 28 — Contrats machine-lisibles

> **Objectif :** transformer les décisions du modèle métier en contrats vérifiables automatiquement.

## 1. Schémas créés

```text
schemas/
├── project.schema.json
├── material.schema.json
├── assembly.schema.json
├── rule-pack.schema.json
├── calculation-result.schema.json
└── symbol.schema.json
```

## 2. Règle

Les interfaces TypeScript et les JSON Schemas doivent décrire le même domaine.

Une PR qui modifie la structure persistée doit :

1. modifier le schéma ;
2. ajouter/adapter la migration ;
3. mettre à jour les types ;
4. mettre à jour les fixtures ;
5. passer les tests de validation.

## 3. Matériau

Le schéma formalise :

- identité ;
- type générique/produit/personnalisé ;
- propriétés ;
- provenance ;
- apparence.

Les propriétés restent extensibles afin d'ajouter thermique, hygrométrie, acoustique, feu et environnement sans casser le format.

## 4. Assemblage

Un assemblage possède des couches ordonnées.

Chaque couche référence un matériau et une épaisseur.

L'assemblage ne recopie pas les propriétés du matériau.

## 5. Rule Pack

Le Rule Pack contient :

- juridiction ;
- domaine ;
- période de validité ;
- références ;
- règles ;
- évaluateur.

Le JSON ne doit pas permettre l'exécution arbitraire de JavaScript.

Les évaluateurs autorisés doivent rester contrôlés :

```text
DECLARATIVE
JSON_LOGIC
MODULE_FUNCTION
```

## 6. Résultat de calcul

Chaque résultat indique :

- module ;
- version ;
- niveau de précision ;
- statut ;
- méthode ;
- outputs ;
- warnings ;
- hypothèses ;
- références.

Les résultats calculés restent dérivés et ne deviennent pas la source de vérité du projet.

## 7. Symboles

Les symboles sont décrits par primitives sémantiques.

Le schéma n'enregistre pas directement un fragment SVG libre.

Objectifs :

- validation ;
- styles centralisés ;
- export cohérent ;
- contrôle de sécurité ;
- changement de profil graphique.

## 8. Exemples

```text
examples/
├── material.example.json
├── assembly.example.json
├── rule-pack.example.json
├── calculation-result.example.json
└── symbol.example.json
```

Ces exemples doivent rester validables automatiquement en CI.

## 9. Étape suivante

Créer ensuite les schémas spécifiques :

- geometry ;
- building elements ;
- networks ;
- climate ;
- equipment catalogs ;
- module settings ;
- scenario.

## 10. Contrats ajoutés

La seconde couche ajoute :

```text
geometry.schema.json
building-element.schema.json
network.schema.json
climate.schema.json
equipment.schema.json
scenario.schema.json
module-settings.schema.json
```

Ils correspondent aux spécifications 29 à 36 et doivent évoluer avec elles.
