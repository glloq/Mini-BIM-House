# État de préparation à la bêta

Ce fichier ne raconte pas l'histoire du projet : il dit où en est la version
`0.2.0-beta.1` aujourd'hui. L'historique des passes d'audit et de leurs
correctifs reste dans `IMPLEMENTATION_STATUS.md`.

Statuts employés : **FAIT**, **PARTIEL** (ce qui manque est nommé),
**BLOQUANT** (la bêta ne sort pas sans), **REQUIS** (attendu dans la bêta),
**RECOMMANDÉ**, **REPORTÉ** (hors bêta, assumé).

Un sixième audit a rouvert plusieurs portes que la passe précédente donnait pour
closes : course d'écriture de la sauvegarde locale, climat absent de
l'instantané, racine de réseau imposée à toutes les disciplines, gaine
rectangulaire inutilisable, hypothèses silencieuses, conteneur trop permissif,
altitude des nœuds de réseau. Les lots A, B, C, D et E les referment ; ne reste
ouvert que le lot F, celui de la publication. Ce tableau dit où en est chaque
porte aujourd'hui.

## Les portes de la bêta

| Porte   | Ce qu'elle exige                                                    | État    |
| ------- | ------------------------------------------------------------------- | ------- |
| BETA-01 | aucun résultat de calcul périmé présenté comme actuel               | FAIT    |
| BETA-02 | plusieurs réseaux d'une même discipline correctement pris en compte | FAIT    |
| BETA-03 | scénarios fondés sur des identités stables                          | FAIT    |
| BETA-04 | impossible de promouvoir un scénario structurellement invalide      | FAIT    |
| BETA-05 | références inter-niveaux et import strictement validés              | PARTIEL |
| BETA-06 | réseaux dotés de propriétés physiques éditables                     | FAIT    |
| BETA-07 | module électrique existant intégré au pipeline projet               | FAIT    |
| BETA-08 | duplication et déplacement de niveau sans incohérence d'altitude    | FAIT    |
| BETA-09 | aucune perte silencieuse d'objets que l'éditeur ne sait pas éditer  | FAIT    |
| BETA-10 | projet et climat transportables ensemble                            | FAIT    |
| BETA-11 | sauvegarde automatique dimensionnée pour de vrais projets           | FAIT    |
| BETA-12 | export impossible à casser silencieusement                          | FAIT    |
| BETA-13 | mur modifiable après création (extrémités, déplacement, longueur)   | FAIT    |
| BETA-14 | ouverture déplaçable et redimensionnable                            | FAIT    |
| BETA-15 | dalles et toitures éditables géométriquement                        | FAIT    |
| BETA-16 | intégration continue Chromium, Firefox et WebKit                    | REQUIS  |
| BETA-17 | GitHub Pages réellement accessible et vérifié après déploiement     | REQUIS  |
| BETA-18 | migrations et versions figées pour les premiers utilisateurs        | REQUIS  |

**BETA-05** : seize familles d'objets sont recensées à l'import et toutes les
références y sont confrontées — appartenance de niveau, assemblage, matériau,
pièce, équipement, port, `spaceIds` des zones, `wallId` des cotes,
`hostObjectId` et `levelId` des nœuds de réseau. L'unicité des identifiants est
tranchée et écrite : elle vaut pour tout le projet, pas seulement pour la
collection qui les porte, et une collision entre deux familles est refusée.

## Attendu dans la bêta, hors portes

- feuilles et export PDF, dont le moteur existe déjà dans `drawing-engine` ;
- découpage du bundle et budget de taille en intégration continue ;
- version applicative issue d'une seule source.

## Recommandé

- orchestrateur de calcul persistant et cache réutilisé entre exécutions ;
- invalidation sélective fondée sur les `ChangeSet` des commandes ;
- vérification d'accessibilité automatisée (axe-core) et régression visuelle ;
- benchmark d'un projet réaliste de plusieurs centaines de murs ;
- réglages encore invisibles alors que les moteurs les lisent
  (`heatRecoveryEfficiency`, températures extérieures de repli).

## Fait depuis le sixième audit

Saisie différée sur les panneaux matériaux, assemblages, niveaux et pièces ;
commandes de zones et renommage de niveau depuis l'interface ; provenance d'une
propriété de matériau saisissable, qui bascule en « saisie » quand la valeur
d'une norme est écrasée ; `battery.offGrid` en case à cocher, l'ancien `1`
restant lu ; bornes hautes et invariants croisés des propriétés d'équipement ;
navigation regroupée en cinq familles ; assistant de création de projet.

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
