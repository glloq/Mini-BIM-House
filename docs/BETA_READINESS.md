# État de préparation à la bêta

Ce fichier ne raconte pas l'histoire du projet : il dit où en est la version
`0.2.0-beta.1` aujourd'hui. L'historique des passes d'audit et de leurs
correctifs reste dans `IMPLEMENTATION_STATUS.md`.

Statuts employés : **FAIT**, **BLOQUANT** (la bêta ne sort pas sans),
**REQUIS** (attendu dans la bêta), **RECOMMANDÉ**, **REPORTÉ** (hors bêta,
assumé).

## Les portes de la bêta

| Porte   | Ce qu'elle exige                                                    | État     |
| ------- | ------------------------------------------------------------------- | -------- |
| BETA-01 | aucun résultat de calcul périmé présenté comme actuel               | FAIT     |
| BETA-02 | plusieurs réseaux d'une même discipline correctement pris en compte | FAIT     |
| BETA-03 | scénarios fondés sur des identités stables                          | FAIT     |
| BETA-04 | impossible de promouvoir un scénario structurellement invalide      | FAIT     |
| BETA-05 | références inter-niveaux et import strictement validés              | FAIT     |
| BETA-06 | réseaux dotés de propriétés physiques éditables                     | BLOQUANT |
| BETA-07 | module électrique existant intégré au pipeline projet               | BLOQUANT |
| BETA-08 | duplication et déplacement de niveau sans incohérence d'altitude    | FAIT     |
| BETA-09 | aucune perte silencieuse d'objets que l'éditeur ne sait pas éditer  | FAIT     |
| BETA-10 | projet et climat transportables ensemble                            | BLOQUANT |
| BETA-11 | sauvegarde automatique dimensionnée pour de vrais projets           | BLOQUANT |
| BETA-12 | export impossible à casser silencieusement                          | FAIT     |
| BETA-13 | mur modifiable après création (extrémités, déplacement, longueur)   | BLOQUANT |
| BETA-14 | ouverture déplaçable et redimensionnable                            | BLOQUANT |
| BETA-15 | dalles et toitures éditables géométriquement                        | BLOQUANT |
| BETA-16 | intégration continue Chromium, Firefox et WebKit                    | REQUIS   |
| BETA-17 | GitHub Pages réellement accessible et vérifié après déploiement     | REQUIS   |
| BETA-18 | migrations et versions figées pour les premiers utilisateurs        | REQUIS   |

## Attendu dans la bêta, hors portes

- champ de saisie différée généralisé aux panneaux matériaux, assemblages,
  niveaux et pièces ;
- commandes de zones, renommage de niveau depuis l'interface ;
- saisie de la provenance d'une propriété de matériau ;
- navigation regroupée et assistant de création de projet ;
- feuilles et export PDF, dont le moteur existe déjà dans `drawing-engine` ;
- découpage du bundle et budget de taille en intégration continue ;
- version applicative issue d'une seule source.

## Recommandé

- orchestrateur de calcul persistant et cache réutilisé entre exécutions ;
- invalidation sélective fondée sur les `ChangeSet` des commandes ;
- vérification d'accessibilité automatisée (axe-core) et régression visuelle ;
- benchmark d'un projet réaliste de plusieurs centaines de murs ;
- réglages encore invisibles alors que les moteurs les lisent
  (`heatRecoveryEfficiency`, températures extérieures de repli) ;
- `battery.offGrid` saisi comme une case à cocher ;
- bornes hautes et invariants croisés des propriétés d'équipement.

## Reporté, assumé hors bêta

Nouveau moteur thermique, simulation dynamique, confort d'été avancé, calcul de
structure, géotechnique, IFC, DXF, escalier complet, réglementation française
complète, CAO complète (trim, fillet, chanfrein), contraintes paramétriques
avancées, collaboration en ligne, édition tactile complète sur téléphone. Les
Web Workers ne seront ajoutés que si les mesures de performance l'exigent.

## Contrat fonctionnel de la bêta

La bêta doit permettre ce parcours sans jamais éditer le JSON : créer un projet,
choisir une localisation et un climat, dessiner et corriger des murs, poser
portes et fenêtres, décrire niveaux, pièces, dalles et toiture, choisir
matériaux et assemblages, poser des équipements, créer des réseaux guidés et
saisir leurs débits et diamètres, lancer les calculs applicables, voir ce qui
manque, être conduit au bon champ par « Corriger », comparer un scénario,
consulter vérifications et quantités, exporter un plan, enregistrer, fermer le
navigateur et retrouver exactement le même projet.
