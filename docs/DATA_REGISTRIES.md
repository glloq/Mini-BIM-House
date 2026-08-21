# Registres de données — nomenclature de référence

Ce document décrit comment les données de `Mini-BIM-House` sont organisées pour
qu'on puisse en ajouter des centaines sans que le code devienne un catalogue.

## Le problème que cela résout

Un catalogue écrit en TypeScript fonctionne à quinze entrées. À cinq cents, il
devient un fichier que personne ne peut relire, que deux personnes ne peuvent
pas modifier en même temps, et dont rien ne vérifie la cohérence : un tube qui
déclare un port de chauffage, une fenêtre qui nomme un symbole inexistant, une
pompe à chaleur dont le débit de calcul est écrit à la main à côté de celui que
le modèle déduit — tout cela compile.

## Sept registres, pas un seul catalogue

Un tube PER n'est pas une pompe à chaleur, une fenêtre n'est pas un meuble, un
isolant n'est pas un objet posé. Les données sont donc séparées :

| Registre          | Ce qu'il contient                                     |
| ----------------- | ----------------------------------------------------- |
| `MATERIAL`        | laine de verre, béton, bois, cuivre                   |
| `ASSEMBLY`        | mur, plancher, toiture, cloison, élément de structure |
| `OPENING`         | fenêtre, baie, porte, protection solaire              |
| `EQUIPMENT`       | PAC, lavabo, radiateur, prise, VMC                    |
| `NETWORK_PRODUCT` | tube, câble, gaine, conduit de fumée                  |
| `SYMBOL`          | représentation en plan, en élévation, en schéma       |
| `PROPERTY_SCHEMA` | propriétés autorisées et leur validation              |

Un registre décide de ce qu'une entrée doit dire. C'est ce qui rend la
validation possible : sans lui, chaque fiche devrait porter tous les champs que
n'importe laquelle des sept pourrait vouloir.

## Une famille n'est pas une entrée de catalogue

`HEAT_PUMP_AIR_WATER_MONOBLOC` est une **famille** : elle dit de quoi une telle
chose est faite, par quoi elle se raccorde, comment elle se dessine, quels
modules la lisent et où en est le travail. Une **entrée de catalogue** dit
ensuite que celle-ci fait 8 kW.

La nomenclature vit dans `packages/catalog-registry/data/families/*.json` : 518
familles, une par ligne de la liste des métiers. Elle n'est pas du code parce
qu'elle n'en est pas : elle change sans que le code change, et plusieurs
personnes doivent pouvoir travailler sur des parties différentes sans se
rencontrer dans le même fichier. Ce que TypeScript garde, c'est la forme
qu'elles doivent avoir et les règles qu'elles doivent respecter.

### Pourquoi JSON et non YAML

Le dépôt valide déjà du JSON avec ajv contre des schémas versionnés, et
l'audit de licences passe à chaque intégration. Ajouter un analyseur YAML
mettrait une dépendance entre les données et la validation qui existe déjà.
C'est une décision, pas une préférence.

## Les axes d'avancement

Une famille n'est pas « faite » ou « pas faite ». Une fenêtre peut être
modélisée, dessinée, chiffrée et n'avoir aucune donnée acoustique ; une pompe à
chaleur peut avoir une courbe complète et pas de symbole. Chaque famille se
mesure donc sur seize axes — `MODEL`, `PROPERTIES`, `PORTS`, `PLACEMENT`, les
trois symboles, `NETWORK`, `CALCULATION`, `QUANTITIES`, `COST`, `CARBON`,
`RULES`, `TESTS`, `GENERIC_DATA`, `PRODUCT_DATA` — avec quatre valeurs :
`NONE`, `PARTIAL`, `READY`, `VALIDATED`.

`NONE` et `PARTIAL` ne sont pas des échecs : la plus grande partie de cinq
cents familles y restera longtemps, et un plan qui prétend le contraire est un
plan auquel personne ne peut se fier. `VALIDATED` veut dire qu'un test le
prouve, ce qui est la seule différence entre « écrit » et « qui marche ».

Tous les axes pèsent le même poids, délibérément : une famille qui a un symbole
et pas de modèle n'est pas plus avancée qu'une famille qui a un modèle et pas
de symbole, et pondérer reviendrait à décider à la place de celui qui fait le
travail quelle moitié compte.

## La file d'attente

```
npm run catalog:status        # toute la nomenclature
npm run catalog:status 2      # la vague 2 seulement
```

Chaque ligne est un travail que quelqu'un peut prendre sans parler à personne :
la famille dit ce qu'elle est, ce qui la lit, et où elle en est.

Les vagues sont un ordre de travail, pas une importance :

1. maison architecturale — matériaux, assemblages, fenêtres, portes,
   protections solaires, mobilier ;
2. plomberie — EF, ECS, EU, EP, tubes, robinetterie, appareils, cuves, pompes ;
3. électricité et éclairage — tableaux, protections, câbles, appareillage,
   charges, luminaires, commandes ;
4. chauffage et ventilation — PAC, émetteurs, plancher chauffant, circulateurs,
   robinetterie, VMC, gaines, bouches ;
5. énergie — photovoltaïque, onduleurs, câblage, batterie, secours, recharge ;
6. systèmes complémentaires — poêle, conduits de fumée, domotique, données,
   sécurité, extérieur.

## Ce qu'une famille déclare

```json
{
  "id": "HEAT_PUMP_AIR_WATER_MONOBLOC",
  "label": "Pompe à chaleur air/eau monobloc",
  "domain": "HEATING",
  "registry": "EQUIPMENT",
  "priority": 4,
  "ports": [
    "HEATING_FLOW",
    "HEATING_RETURN",
    "ELECTRICAL_AC",
    "CONDENSATE",
    "CONTROL"
  ],
  "calculators": [
    "heating",
    "electrical",
    "energy-balance",
    "acoustics",
    "cost",
    "environmental"
  ],
  "placement": {
    "allowedHosts": ["SLAB", "WALL", "SITE"],
    "levelRequired": true,
    "rotationAllowed": true
  },
  "clearances": [
    "PHYSICAL",
    "MAINTENANCE",
    "SERVICE",
    "AIR_INTAKE",
    "AIR_EXHAUST"
  ],
  "propertySchema": "HEAT_PUMP",
  "status": { "MODEL": "READY", "PORTS": "READY", "GENERIC_DATA": "READY" }
}
```

Rien de tout cela n'est décoratif : les ports sont vérifiés contre le registre
des ports, les dégagements contre la liste des zones, les modules contre les
dix-sept moteurs de calcul, les symboles contre la bibliothèque, le schéma de
propriétés contre les schémas déclarés. Une famille qui nomme quelque chose qui
n'existe pas est refusée par les tests, pas découverte des mois plus tard devant
un utilisateur.

## Les ports

Un port n'est pas un trou : c'est un endroit où quelque chose de précis arrive
ou part. Un départ et un retour de chauffage transportent la même eau et ne sont
pas interchangeables ; une arrivée d'eau froide et une évacuation ne sont même
pas le même fluide. Chaque type de port déclare son fluide et son sens, et
`portsConnect()` refuse ce qui ne peut pas exister.

La liste est fermée. Une chaîne libre voudrait dire que `HEATING_FLOW`,
`heating-flow` et `FLOW_HEATING` existent tous les trois et qu'aucun ne se
raccorde aux autres.

## Les propriétés : d'où vient la valeur

Chaque propriété déclare sa source :

- `DEFINITION` — appartient à la fiche catalogue, identique pour tous les
  exemplaires de ce modèle ;
- `INSTANCE` — appartient à celui qui est posé dans cette maison ;
- `DERIVED` — se déduit des deux et **ne se stocke jamais**.

Une propriété dérivée trouvée parmi les valeurs enregistrées est une erreur et
non un avertissement : c'est une deuxième réponse à une question à laquelle le
modèle répond déjà, et les deux se contrediront au premier changement.

## La provenance

Chaque entrée dit d'où viennent ses valeurs, sans exception : `GENERIC`,
`STANDARD`, `MANUFACTURER`, `DATABASE`, `USER`, `CALCULATED`, `OTHER`. Une
valeur générique et un chiffre déclaré par un fabricant se ressemblent une fois
devenus des nombres dans un fichier, et un projet dimensionné sur le premier
alors que son auteur croyait au second est un projet indéfendable.

`GENERIC` n'est pas un moindre statut — la première base est presque entièrement
générique — c'est une déclaration. Un chiffre fabricant sans référence datée est
refusé : c'est un nombre anonyme portant l'autorité d'un fabricant.

## Les dégagements

Treize zones, parce que ce ne sont pas les mêmes contraintes. Un espace
d'entretien se partage avec un couloir et pas avec un mur ; une prise d'air ne
se partage pas avec un rejet ; une distance aux matériaux combustibles est une
règle de sécurité et non un confort. Une seule liste de « dégagement en
millimètres » ne peut rien dire de tout cela.
