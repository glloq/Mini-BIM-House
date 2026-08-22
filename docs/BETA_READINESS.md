# État de préparation à la bêta

Ce fichier ne raconte pas l'histoire du projet : il dit où en est la version
`0.3.0-beta.10` aujourd'hui. L'historique des passes d'audit et de leurs
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

Quatre passes d'audit ont suivi. Les trois premières ont porté sur ce que
l'utilisateur fait — un poste de travail, les primitives de CAO, la maison
plutôt que ses segments, les réseaux, les surcouches, le dossier de plans, les
variantes, le terrain — et la quatrième sur la couche de données qui va
remplir tout cela : sept registres, 518 familles, les catalogues, et surtout
les contrôles qui empêchent de la remplir de travers. C'est ce qui sépare la
`0.2.0-beta.2` de la `0.3.0-beta.1`.

Une cinquième passe a suivi, celle de l'intégrité du modèle BIM : ce qu'un
niveau contient, ce qu'un composant posé apporte aux calculs, ce dont un
tronçon est fait, ce qu'une clé de propriété veut dire, et la place que les
machines demandent autour d'elles. Elle a fermé un défaut capable de faire
perdre du travail sans un mot — un niveau contenant une toiture, des poteaux
et une PAC comptait pour vide — et branché la chaîne
catalogue → objet posé → réseau → calcul → vérifications.

Une sixième passe a fermé les quatre verrous qu'un audit jugeait bloquants
avant tout remplissage massif : l'index de ce qui désigne quoi, le format
`1.2.0` et sa migration, la copie des produits réseau dans le projet, et le
passage de tous les calculs sur les objets réellement posés. Elle a aussi
supprimé la dernière liste de familles écrite à la main, dans la comparaison de
variantes, et ramené à une seule les trois règles de compatibilité de ports.

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

**BETA-05** : les vingt-six familles d'objets du modèle sont recensées par un
index unique — celui-là même que la validation, la sélection, l'arbre du
projet, la palette et la suppression interrogent — et toutes les références y
sont confrontées — appartenance de niveau, assemblage, matériau,
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
- Projection sur le plan des résultats des réseaux, de la ventilation, de
  l'électricité, puis de ce qu'une pièce demande, reçoit et respire : chaque
  analyse offerte est branchée sur le dessin, et un test vérifie pour chacune
  qu'elle nomme des objets que le plan dessine et qu'elle en colore au moins un
  — une analyse dont les identifiants ne correspondent à rien se lit exactement
  comme « rien à signaler ». Leur nombre n'est pas écrit ici : il est compté
  par `scripts/documented-metrics.test.mjs`.

## Recommandé

- invalidation sélective fondée sur les `ChangeSet` des commandes : un résultat
  déjà obtenu pour ce projet, cette révision et ce climat est désormais
  réutilisé, mais modifier un mur relance les dix-sept modules alors que le
  `ChangeSet` dit ce qui a bougé ;
- orchestrateur de calcul persistant, plutôt que recréé à chaque exécution ;
- régression visuelle pixel par pixel sur les trois moteurs ;
- **durcissement des JSON Schema.** `additionalProperties: true` court encore
  sur `Project`, `Building`, `Level`, `ComponentInstance` et le schéma réseau :
  une faute de frappe — `definitonId` — passe donc sans qu'aucune couche ne dise
  « ce champ n'existe pas ». Le contrat central doit passer en
  `additionalProperties: false`, avec une zone d'extensions explicitement libre
  et versionnée à côté.

  Ce n'est volontairement pas fait ici. Fermer le contrat rejette des fichiers
  que l'application accepte aujourd'hui : cela demande un changement de version
  de format et une migration qui dise ce qu'elle écarte, et cela doit se faire
  une seule fois, proprement, plutôt qu'un champ à la fois. Ce qui est fait,
  c'est le premier morceau qui ne coûtait pas de migration : le contexte
  réglementaire est typé — pays, juridiction, type de projet, date de référence
  et référentiels activés avec leur version — et l'importeur le vérifie ;

- toitures sur contour quelconque : le squelette droit reste à écrire, et un
  contour non résolu doit continuer de se dire non résolu.

La couverture des paquets qui décident de ce qu'_est_ un projet — géométrie,
modèle, entrées/sorties, commandes, adaptateurs de calcul, registres, types
techniques, climat — est mesurée et plancherisée dans l'intégration continue.
Le plancher est réglé juste sous ce que la suite atteint aujourd'hui : un seuil
au-dessus de la vérité est un seuil que quelqu'un finit par désactiver.

Le banc d'essai d'un projet réaliste est fait : `largeHouse(3, 40)` — trois
niveaux, quarante pièces, 240 murs — sert de charge de mesure et de test, et
les chiffres sont consignés dans [`PERFORMANCE_BASELINE.md`](./PERFORMANCE_BASELINE.md).

## Avant d'annoncer la bêta publiquement

- constater qu'un déploiement réel de `main` passe avec le workflow Pages : le
  dernier a échoué faute de Pages activé sur le dépôt ;
- **protéger `main`.** C'est un réglage du dépôt, pas du code : il reste à la
  main du propriétaire, et c'est aujourd'hui le seul point de l'audit qu'aucune
  ligne de code ne peut fermer. La PR #28 a été fusionnée à 00:32 alors que son
  intégration continue s'est terminée à 00:37 — elle est passée, mais rien
  n'empêchait de fusionner du rouge.

  Dans _Settings → Branches → Add branch protection rule_, sur `main` :

  - _Require a pull request before merging_ ;
  - _Require status checks to pass before merging_, puis cocher les deux
    contrôles que ce dépôt exécute — `validate` et `browser` ;
  - _Require branches to be up to date before merging_ ;
  - _Do not allow bypassing the above settings_ ;
  - décocher _Allow force pushes_ et _Allow deletions_.

  Rapport bénéfice/effort maximal : cinq minutes de réglage, et plus aucune
  fusion ne peut devancer ses tests.

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

Le dossier de plans non plus n'est plus reporté : la coupe, la façade, le plan
de toiture et le plan de masse sont dessinés à partir du modèle, et une coupe
porte la ligne où elle coupe.

Le remaniement CAO courant, lui, n'est plus reporté : déplacer, dupliquer,
copier-coller entre niveaux, pivoter, retourner, décaler, joindre, ajuster,
aligner et scinder à l'endroit désigné existent, avec la saisie de la longueur
et de l'angle près du curseur et les cotes éditables sur le dessin.

## Périmètre de la 1.0, arrêté

Une liste de ce qui est hors périmètre n'a de valeur que si elle est arrêtée :
tant qu'elle peut s'allonger, elle ne dit pas ce que la 1.0 sera, elle dit ce
qu'elle n'est pas encore. Voici donc ce que la 1.0 **ne fera pas**, décidé et
non reporté d'une passe à l'autre :

- **PDF vectoriel** — les feuilles s'exportent en PDF multipage, chaque page
  étant une image à l'échelle. Convertir le SVG en tracés PDF reviendrait à
  écrire un second moteur de dessin ;
- **DXF et IFC** — ni import ni export. Un IFC partiel est pire qu'aucun IFC :
  il se donne pour un échange et n'en est pas un ;
- **murs courbes et raccords visuels L/T/X** ;
- **simulation thermique dynamique** — les modules sont en régime permanent et
  le disent ; un moteur horaire est un autre produit ;
- **calcul de structure et géotechnique** — les poteaux et les poutres sont
  dessinés, décrits et métrés ; rien n'est dimensionné ;
- **collaboration en ligne** — l'application est locale, le fichier est le
  document, et il n'y a pas de serveur ;
- **conformité réglementaire affirmée** — le moteur de règles et les Rule Packs
  existent, et aucun référentiel national n'est livré. L'application rapporte
  des constats ; elle ne délivre pas de conformité.

Ce qui reste à faire pour la 1.0 est donc borné : remplir les catalogues,
finir les Rule Packs, les toitures sur contour quelconque, un service de calcul
persistant avec invalidation sélective, et le format d'import de données
fabricant.

## Contrat fonctionnel de la bêta

La bêta doit permettre ce parcours sans jamais éditer le JSON : créer un projet,
choisir une localisation et un climat, dessiner et corriger des murs, poser
portes et fenêtres, décrire niveaux, pièces, dalles et toiture, choisir
matériaux et assemblages, poser des équipements, créer des réseaux guidés et
saisir leurs débits et diamètres, lancer les calculs applicables, voir ce qui
manque, être conduit au bon champ par « Corriger », comparer un scénario,
consulter vérifications et quantités, exporter un plan, enregistrer, fermer le
navigateur et retrouver exactement le même projet.
