# JSON Schemas

Ces schémas constituent les contrats persistants/machine-lisibles du projet.

## Projet et domaine

- `project.schema.json` — enveloppe du fichier projet ;
- `geometry.schema.json` — primitives géométriques ;
- `building-element.schema.json` — murs, ouvertures, dalles, espaces ;
- `material.schema.json` — matériaux ;
- `assembly.schema.json` — assemblages multicouches ;
- `equipment.schema.json` — équipements techniques ;
- `network.schema.json` — réseaux génériques ;
- `climate.schema.json` — jeux de données climatiques ;
- `scenario.schema.json` — variantes/scénarios.

## Calcul et règles

- `module-settings.schema.json` — réglages d'un module ;
- `calculation-result.schema.json` — résultat traçable ;
- `rule-pack.schema.json` — règles versionnées ;
- `symbol.schema.json` — symboles techniques.

## Règles

1. tout schéma possède un `$id` stable ;
2. Draft 2020-12 ;
3. une modification incompatible nécessite une migration ;
4. les exemples associés doivent être validés en CI ;
5. les coordonnées géométriques sont en millimètres ;
6. les résultats physiques utilisent les unités explicitement indiquées ;
7. aucune valeur `NaN` ou `Infinity` n'est sérialisable ;
8. les propriétés inconnues ne sont pas remplacées silencieusement.

## Fixtures associées

Les fichiers `../examples/*.example.json` servent de fixtures minimales.

Le projet complet minimal reste :

- `../examples/minimal.houseproj.json`.
