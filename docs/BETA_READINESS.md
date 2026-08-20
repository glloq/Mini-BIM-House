# État de préparation à la bêta

Ce fichier ne raconte pas l'histoire du projet : il dit où en est la version
`0.2.0-beta.2` aujourd'hui. L'historique des passes d'audit et de leurs
correctifs reste dans `IMPLEMENTATION_STATUS.md`, et ce qui a changé d'une
version à l'autre dans `../CHANGELOG.md`.

Statuts employés : **FAIT**, **PARTIEL** (ce qui manque est nommé),
**BLOQUANT** (la bêta ne sort pas sans), **REQUIS** (attendu dans la bêta),
**RECOMMANDÉ**, **REPORTÉ** (hors bêta, assumé).

Un septième audit a repris le dépôt après la publication de la
`0.2.0-beta.1`. Il n'a rouvert aucune porte fonctionnelle, mais quatre cas
d'intégrité : une course de révision subsistait dans la sauvegarde locale, la
suppression d'un instantané pouvait être défaite par une écriture déjà
engagée, un conteneur désignant un climat sans le transporter était accepté
lorsqu'il n'en transportait aucun, et les références d'un nœud de réseau
étaient vérifiées une à une sans l'être ensemble. Les quatre sont corrigées et
chacune a son test de non-régression ; c'est ce qui sépare la `beta.1` de la
`beta.2`.

## Les portes de la bêta

| Porte   | Ce qu'elle exige                                                    | État    |
| ------- | ------------------------------------------------------------------- | ------- |
| BETA-01 | aucun résultat de calcul périmé présenté comme actuel               | FAIT    |
| BETA-02 | plusieurs réseaux d'une même discipline correctement pris en compte | FAIT    |
| BETA-03 | scénarios fondés sur des identités stables                          | FAIT    |
| BETA-04 | impossible de promouvoir un scénario structurellement invalide      | FAIT    |
| BETA-05 | références inter-niveaux et import strictement validés              | FAIT    |
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
| BETA-16 | intégration continue Chromium, Firefox et WebKit                    | FAIT    |
| BETA-17 | GitHub Pages réellement accessible et vérifié après déploiement     | PARTIEL |
| BETA-18 | migrations et versions figées pour les premiers utilisateurs        | FAIT    |

**BETA-05** : seize familles d'objets sont recensées à l'import et toutes les
références y sont confrontées — appartenance de niveau, assemblage, matériau,
pièce, équipement, port, `spaceIds` des zones, `wallId` des cotes,
`hostObjectId` et `levelId` des nœuds de réseau. L'unicité des identifiants est
tranchée et écrite : elle vaut pour tout le projet, pas seulement pour la
collection qui les porte, et une collision entre deux familles est refusée.
Depuis le septième audit, les références d'un nœud sont aussi vérifiées
**ensemble** : un nœud déclaré au rez-de-chaussée, desservant une chambre à
l'étage et fixé à un mur d'un troisième niveau nomme trois objets réels et
aucun lieu réel. L'import le refuse, et les commandes d'ajout et de
modification de nœud le refusent aussi — l'éditeur n'écrit jamais un projet
que le lecteur rejette.

**BETA-10** : le conteneur transporte le projet et son climat, et refuse d'être
incohérent dans les deux sens. À l'ouverture, un projet désignant un profil que
l'archive ne porte pas est refusé — y compris, depuis le septième audit,
lorsque l'archive ne porte aucun climat, cas qui passait jusque-là. À
l'écriture, la même vérification a lieu avant que le fichier n'existe : mieux
vaut un export refusé, qui dit quel jeu de données charger, qu'un fichier
découvert inutilisable sur une autre machine. Un manifeste dont le champ
`climate` n'est pas une liste de noms est refusé plutôt que lu comme « pas de
climat ».

**BETA-11** : l'instantané vit dans IndexedDB, avec repli sur le stockage local
quand la base refuse réellement, migration de l'ancien emplacement, écritures
sérialisées et climat enregistré avec le projet. Le septième audit a fermé les
deux dernières courses : l'état « sauvegardé localement » n'est annoncé que si
l'instantané écrit est celui du projet à l'écran, et la suppression d'un
instantané passe par la file d'écriture, si bien qu'une écriture déjà engagée
ne peut plus le faire réapparaître après coup.

**BETA-17** : le déploiement est construit, publié puis vérifié sur l'URL que
GitHub Pages produit, et le workflow ne publie qu'après une intégration
continue verte sur `main`. Il reste PARTIEL parce qu'aucun déploiement réel
n'est encore passé : le dernier, sur le `main` de la `beta.1`, a échoué à
`configure-pages` avec « Get Pages site failed… Not Found », c'est-à-dire
GitHub Pages non activé sur le dépôt. Le workflow demande désormais
l'activation lui-même (`enablement: true`) ; si l'organisation ne l'autorise
pas, le propriétaire du dépôt doit l'activer dans Réglages → Pages, source
« GitHub Actions ». La porte se ferme le jour où un déploiement de `main`
passe, `smoke-deployment` compris.

## Attendu dans la bêta, hors portes

- feuilles et export PDF, dont le moteur existe déjà dans `drawing-engine` ;
- projection sur le plan des résultats des réseaux, de la ventilation et de
  l'électricité : les moteurs les calculent, seules les trois analyses
  thermiques sont branchées sur le dessin.

## Recommandé

- orchestrateur de calcul persistant et cache réutilisé entre exécutions ;
- invalidation sélective fondée sur les `ChangeSet` des commandes ;
- régression visuelle pixel par pixel sur les trois moteurs ;
- benchmark d'un projet réaliste de plusieurs centaines de murs ;
- réglages encore invisibles alors que les moteurs les lisent
  (`heatRecoveryEfficiency`, températures extérieures de repli).

## Avant d'annoncer la bêta publiquement

- constater qu'un déploiement réel de `main` passe avec le workflow Pages : le
  dernier a échoué faute de Pages activé sur le dépôt ;
- protéger `main` : intégration continue obligatoire et passage par une
  demande de fusion. C'est un réglage du dépôt, pas du code, et il reste à la
  main du propriétaire.

## Ce que la bêta ne fait pas

Les limites connues sont tenues à un seul endroit, la section « Ce que
l'application ne fait pas » du [`README`](../README.md) : escaliers, feuilles
et PDF, DXF et IFC, simulation dynamique, productivité CAO, dossier de plans
typé, conformité réglementaire, données fabricant, collaboration. Cette liste
décrit la version publiée et rien d'autre.

## Fait depuis le sixième audit

Trois moteurs en intégration continue ; vérification de la page déployée ;
version applicative issue du seul `package.json` ; migrations annoncées à
l'ouverture ; chargement à la demande des espaces de travail et des modules de
calcul, sous budget vérifié ; axe-core sur les onze espaces ; référence de
dessin du plan. Saisie différée sur les panneaux matériaux, assemblages, niveaux et pièces ;
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
