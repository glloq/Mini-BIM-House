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
continue verte sur `main`. Il reste PARTIEL, et la cause est maintenant
identifiée précisément.

Le déploiement du `main` de la PR #20 (exécution 13) construit l'application
sans erreur, puis s'arrête net à `configure-pages` :

```text
Get Pages site failed.   Not Found
Create Pages site failed. Resource not accessible by integration
```

Le jeton de l'action n'a donc pas le droit de créer le site : `enablement: true`
ne peut rien y faire. Ce n'est pas un défaut du dépôt de code, c'est un réglage
qui appartient au propriétaire — Réglages → Pages, source « GitHub Actions ».
Sur un compte gratuit, Pages n'est par ailleurs disponible que pour un dépôt
public : tant que celui-ci reste privé, la porte ne peut pas se fermer.

La porte se ferme le jour où un déploiement de `main` passe,
`smoke-deployment` compris. Rien d'autre ne manque côté dépôt.

## Attendu dans la bêta, hors portes

Les deux points qui figuraient ici sont faits.

- Feuilles et export PDF : une feuille porte plusieurs vues, chacune à son
  échelle, avec format, orientation et indice ; les pages sont tramées une par
  une sous un budget de mémoire, et la densité obtenue est annoncée avant
  l'export.
- Projection sur le plan des résultats des réseaux, de la ventilation et de
  l'électricité : les dix analyses sont branchées sur le dessin, et un test
  vérifie pour chacune qu'elle nomme des objets que le plan dessine et qu'elle
  en colore au moins un — une analyse dont les identifiants ne correspondent à
  rien se lit exactement comme « rien à signaler ».

## Recommandé

- invalidation sélective fondée sur les `ChangeSet` des commandes : un résultat
  déjà obtenu pour ce projet, cette révision et ce climat est désormais
  réutilisé, mais modifier un mur relance les dix-sept modules alors que le
  `ChangeSet` dit ce qui a bougé ;
- orchestrateur de calcul persistant, plutôt que recréé à chaque exécution ;
- régression visuelle pixel par pixel sur les trois moteurs ;
- réglages encore invisibles alors que les moteurs les lisent
  (`heatRecoveryEfficiency`, températures extérieures de repli).

Le banc d'essai d'un projet réaliste est fait : `largeHouse(3, 40)` — trois
niveaux, quarante pièces, 240 murs — sert de charge de mesure et de test, et
les chiffres sont consignés dans [`PERFORMANCE_BASELINE.md`](./PERFORMANCE_BASELINE.md).

## Avant d'annoncer la bêta publiquement

- constater qu'un déploiement réel de `main` passe avec le workflow Pages : le
  dernier a échoué faute de Pages activé sur le dépôt ;
- protéger `main` : intégration continue obligatoire et passage par une
  demande de fusion. C'est un réglage du dépôt, pas du code, et il reste à la
  main du propriétaire.

## Ce que la bêta ne fait pas

Les limites connues sont tenues à un seul endroit, la section « Ce que
l'application ne fait pas » du [`README`](../README.md) : toitures sur contour
quelconque, murs courbes, PDF vectoriel, DXF et IFC, simulation dynamique,
productivité CAO, annotations typées au-delà des cotes et des notes,
conformité réglementaire, données fabricant, collaboration. Cette liste décrit
la version publiée et rien d'autre.

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
structure, géotechnique, IFC, DXF, réglementation française
complète, congés et chanfreins, contraintes paramétriques avancées,
collaboration en ligne, édition tactile complète sur téléphone. Les Web Workers
ne seront ajoutés que si les mesures de performance l'exigent.

Le remaniement CAO courant, lui, n'est plus reporté : déplacer, dupliquer,
copier-coller entre niveaux, pivoter, retourner, décaler, joindre, ajuster,
aligner et scinder à l'endroit désigné existent, avec la saisie de la longueur
et de l'angle près du curseur et les cotes éditables sur le dessin.

## Contrat fonctionnel de la bêta

La bêta doit permettre ce parcours sans jamais éditer le JSON : créer un projet,
choisir une localisation et un climat, dessiner et corriger des murs, poser
portes et fenêtres, décrire niveaux, pièces, dalles et toiture, choisir
matériaux et assemblages, poser des équipements, créer des réseaux guidés et
saisir leurs débits et diamètres, lancer les calculs applicables, voir ce qui
manque, être conduit au bon champ par « Corriger », comparer un scénario,
consulter vérifications et quantités, exporter un plan, enregistrer, fermer le
navigateur et retrouver exactement le même projet.
