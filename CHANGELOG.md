# Journal des versions

Les versions suivent [SemVer](https://semver.org/lang/fr/). Le format de
fichier `.houseproj` porte sa propre version, indépendante de celle de
l'application : `schemaVersion` dit ce qu'un fichier contient, la version de
l'application dit ce qui l'a écrit.

## 0.3.0-beta.7 — non publiée

La passe sur la **propagation des inconnues** dans les calculs. Le projet
affirme depuis le début qu'une donnée inconnue reste inconnue ; la règle tenait
partout où une valeur était lue, et cédait partout où des valeurs étaient
additionnées.

### Corrigé

- **un total ne dit plus la somme de ce qu'il connaît.** Un tube alimenté par
  une douche à 0,15 L/s et un lavabo que personne n'a décrit sortait à
  0,15 L/s — le total, sans marque, et faux. `ResolvedNumber` et `sumResolved`
  rendent le tronçon indéterminé, en gardant la borne basse et le nom du nœud
  qui manque. Même chose pour les gaines, les pertes de charge cumulées, les
  unités de décharge, le débit de dimensionnement d'un caisson et le
  coefficient de ventilation d'un bâtiment.
- **une pièce servie par deux bouches dont une se tait** avait le débit de
  l'autre. Elle n'a plus de débit, et le chauffage comme la qualité de l'air le
  disent.
- **trois panneaux dont un ne déclare pas sa puissance** ne font plus une
  installation de la somme des deux autres.
- **la charge additionnelle des pièces** était injectée à 0 W par l'adaptateur,
  à un moteur qui savait pourtant dire « je ne sais pas ». Zéro reste la
  réponse, mais elle est déclarée comme hypothèse, voyage avec le résultat et
  se remplace par un chiffre choisi.
- **le volume initial d'une cuve** était supposé nul. Une cuve vide fait
  paraître les premières semaines pires qu'elles ne sont, une cuve pleine
  meilleures ; aucune des deux n'est un défaut.
- **le coefficient d'un bâtiment** se calculait avec la transmission seule
  quand la ventilation manquait.

### Ajouté

- `ResolvedNumber` dans `calculation-core` : `sumResolved`, `minResolved`,
  `maxResolved`, `averageResolved`, `mapResolved`, et de quoi dire à voix haute
  ce qui manque.
- un test d'architecture qui refuse tout `?? 0` inexpliqué dans les
  adaptateurs de calcul. Un zéro délibéré reste permis ; il doit dire pourquoi.

### Documentation

- le README annonçait « 18 résultats » puis « dix analyses » dans la même
  version, et la page de préparation à la bêta nommait encore `beta.5`. Le test
  documentaire compte désormais aussi les nombres écrits en lettres, qui
  échappaient au contrôle des chiffres.

## 0.3.0-beta.6 — non publiée

La refonte de l'**interface**. Onze destinations en une colonne répondaient à
« où puis-je aller », question que personne ne pose. Cinq espaces répondent à
« où je travaille », et les dix étapes de chantier répondent à « que reste-t-il
à faire » — sans jamais devenir dix onglets de plus.

### Ajouté

- **cinq espaces au lieu de onze destinations.** `PROJECT | BUILD | SYSTEMS |
ANALYZE | DOCUMENTS`, dans un rail qui ne bouge jamais : quelqu'un qui a
  appris que Systèmes est la troisième entrée a appris une position. Chacune
  des onze anciennes destinations reste atteignable par l'espace dont elle
  relève, et la navigation retient ce qui était ouvert dans chaque espace.
- **une page de création à la place d'une modale.** Elle ne demande plus dix
  réponses avant le premier mur : une pile de niveaux qui sait dire deux
  sous-sols, mezzanine et combles ; une localisation dont « à déterminer » est
  une réponse ; une emprise facultative dont le défaut est « je dessinerai
  moi-même » et qui produit de vrais murs par les commandes ordinaires.
- **un périmètre de conception qui voyage dans le fichier.** Ce qu'on décide de
  concevoir, pas ce que le fichier peut contenir : décocher le photovoltaïque
  n'encombre plus l'interface et ne supprime rien. Un domaine hors périmètre
  dont le projet tient déjà des objets ne peut pas être mis de côté, et
  l'interface le dit.
- **un guide de progression dérivé du modèle.** Trente-trois étapes, dix
  phases, et aucun état persisté : ce qui compte est de savoir si la maison a
  ses murs, pas si quelqu'un a coché une case. Il recommande et ne bloque
  jamais.
- **un compteur de vérifications permanent**, dans la barre d'état, qui mène à
  chaque remarque en un clic.
- **une seule navigation transversale.** `navigateTo(UiTarget)` ouvre le
  niveau, active la discipline, rétablit la visibilité, sélectionne l'objet, le
  cadre, ouvre l'inspecteur et déplie la propriété concernée.

### Modifié

- **les outils passent dans le panneau contextuel**, groupés par métier, et la
  barre au-dessus du plan ne porte plus que ce que la situation permet — rien
  au repos.
- **plus de modes « simple » et « expert ».** Deux modes, ce sont deux
  produits, et celui qui avait choisi le simple n'apprenait jamais que l'autre
  outil existait. Les outils courants sont visibles, les autres à un dépliage,
  pour tout le monde.
- **la visibilité se choisit par préréglage**, dans un popover sur le plan ; les
  vingt calques restent le moteur, un dépliage plus bas.
- **Analyser et Systèmes ouvrent sur le plan.** Un résultat se lit contre le
  bâtiment dont il parle, et une variante est un mode du dessin plutôt qu'une
  destination.
- **une seule façon de demander « lequel »** à un catalogue : recherche sans
  accents ni casse, mots dans n'importe quel ordre, mêmes filtres partout. Les
  assemblages et les équipements du projet n'avaient aucune recherche.
- **l'inspecteur replie ce qui relève de la comptabilité du fichier** et garde
  ouvert ce que l'objet est.

### Documentation

- `docs/UX_ARCHITECTURE.md` : le contrat de l'interface et ses dix-huit
  critères d'acceptation, dont dix-huit tests dans
  `apps/web/src/ux/acceptance.test.ts` — un contrat que chaque PR est « relue
  contre » est un contrat que personne ne relit.

## 0.3.0-beta.5 — non publiée

La passe de consolidation du **modèle dérivé** : la façon dont le BIM devient de
la géométrie physique, puis des données de calcul.

### Corrigé

- **une maison avait plusieurs réponses aux mêmes questions de géométrie, et
  pour l'une d'elles aucune.** « Quelle est la surface de cette pièce ? » était
  répondue trois fois — le plan lisait le contour saisi, le contexte de calcul
  avait sa formule de Gauss, le tableau de bord une troisième écrite à la main —
  et une pièce décrite par les murs qui l'entourent, ce que le modèle autorise
  depuis le début, arrivait au calcul sans surface, sans périmètre et sans
  volume. « Jusqu'où monte ce mur ? » ne connaissait que la hauteur explicite :
  un mur bâti jusqu'au niveau du dessus était purement sauté, et la maison
  calculée avait moins de murs que la maison à l'écran. `resolved-geometry`
  répond une fois pour toutes, et les trois formules locales ont disparu ;
- **l'enveloppe thermique n'était pas l'enveloppe.** Une fenêtre était retirée
  de son mur et jamais remise en tant que fenêtre : vingt-cinq mètres carrés de
  mur portant quatre mètres carrés de vitrage arrivaient au moteur comme vingt
  et un mètres carrés de maçonnerie et quatre mètres carrés de rien. La toiture
  et les planchers n'y entraient pas du tout. Toute déperdition d'enveloppe
  calculée jusqu'ici était donc fausse, et silencieusement. `resolveEnvelope()`
  énumère chaque paroi avec son genre et sa condition de bord, et le moteur
  accepte une transmission déclarée — une fenêtre s'achète entière ;
- **le climat pouvait être choisi à la place du projet.** Le jeu demandé, sinon
  n'importe lequel non horaire, sinon le premier : un projet demandant Bordeaux
  et recevant Paris et Nantes était calculé avec l'un des deux. Le jeu demandé
  ou aucun, désormais, et les six modules qui en dépendent nomment celui qui
  manque ;
- **deux ports ne déclarant rien étaient jugés compatibles.** Le commentaire
  disait le contraire de ce que le code faisait. La réponse est à trois états :
  ce qu'un fichier contient déjà est jugé par le refus seul, ce qu'on dessine
  maintenant exige un accord réel, et l'indéterminé remonte comme indéterminé ;
- l'écran des réglages appelait un module « Thermique » là où le tableau de bord
  l'appelait « Enveloppe thermique » : quatre listes des mêmes dix-sept modules
  avaient commencé à diverger.

### Ajouté

- un **registre unique des dix-sept modules**, sans code ni dépendance, et une
  table de constructeurs d'entrées que le compilateur refuse si elle en oublie
  un ;
- un **contexte réglementaire typé**, dont les référentiels activés portent leur
  version : un projet rouvert après qu'un texte a bougé le dit, au lieu de
  changer d'avis en silence ;
- un test qui **compte dans le code les nombres que la documentation affirme** —
  modules, familles, analyses, sortes de vue, paquets — et nomme chaque document
  qui porte encore l'ancien chiffre ; un rapport de validation **engendré** à
  partir des contrôles réels du dépôt ; une couverture plancherisée sur les huit
  paquets qui décident de ce qu'est un projet.

## 0.3.0-beta.4 — non publiée

Le dossier de plans, la maison de référence, et la mise côte à côte de ce qu'il
faut avec ce qui est posé.

### Ajouté

- **les coupes, les façades, le plan de toiture et le plan de masse sont
  dessinés.** Une coupe est une projection : chaque mur que le trait traverse
  devient une bande à l'endroit du passage, aussi haute que le mur, posée sur
  son niveau et aussi épaisse que ce dont il est fait ; une fenêtre que la scie
  a traversée devient le vide qu'elle est ; ce qui se tient derrière le trait,
  dans la profondeur demandée, est dessiné en arrière-plan et non en
  maçonnerie. Une façade est la même projection posée dehors, et laisse de côté
  ce qui est plus profond que ce qu'on a demandé de voir. Le plan de toiture
  nomme les arêtes où deux pans se rencontrent et dit de quel côté chacun
  tombe. Le plan de masse montre le terrain, ce qui s'y tient et l'empreinte de
  la maison ;
- une coupe porte sa **ligne de coupe**, une façade sa **direction**, et l'une
  et l'autre leur profondeur et leur tranche de hauteur : une vue qui ne les
  portait pas était une vue que personne ne pouvait rouvrir. L'éditeur refuse
  d'en enregistrer une sans, et l'importeur refuse d'en relire une sans ;
- un **registre des chartes graphiques** : quatre profils existaient, un seul
  était trouvable, et les trois autres revenaient comme « une charte que cette
  version ne connaît pas ». Une feuille imprimée prend le pendant imprimé de la
  charte de l'écran ;
- **la maison de référence est devenue exhaustive.** Elle avait un niveau, aucun
  objet posé, aucune vue et aucun produit réseau : toutes les suites qui
  s'appuyaient dessus réussissaient en n'ayant rien à vérifier. Elle a
  maintenant deux niveaux reliés par un escalier, une toiture posée sur le
  niveau qu'elle couvre, un terrain avec ses limites et deux masques, dix objets
  posés, quatre réseaux qui montent à l'étage dont chaque tronçon nomme son
  produit, la copie de ces produits dans le projet, et un dossier de plans
  portant les cinq sortes de vue sur une feuille A1. Un test exige qu'elle
  continue de tenir un objet de chaque famille ;
- **le module de coût chiffre au mètre et à l'unité**, plus seulement au mètre
  cube de matériau. Toute la plomberie, l'électricité, la ventilation et les
  équipements d'une maison étaient « comptés et non chiffrés » : un tronçon se
  chiffre par le produit dont il est fait, un objet posé par son modèle, et le
  lot suit le domaine du produit plutôt que d'être « enveloppe » pour tout le
  monde ;
- un câble du catalogue nomme son conducteur sous `conductor` et le résolveur ne
  lisait que `material` : chaque câble ne disait rien de son cuivre ;
- **les vérifications comparent ce qu'il faut à ce qui est posé.** La charge de
  chauffage était calculée, les générateurs étaient comptés, et personne ne
  mettait les deux nombres côte à côte. Huit rapprochements le font maintenant :
  générateur contre demande, émetteur contre charge de la pièce, groupe de
  ventilation contre ses bouches, courant foisonné contre calibre de protection,
  onduleur contre champ photovoltaïque, batterie sans onduleur, ballon contre
  stockage calculé, cuve contre besoins en eau de pluie. Chaque constat porte
  les deux nombres qu'il a comparés — un verdict dont on ne voit pas les chiffres
  est un verdict qu'on ne peut que croire — et aucun ne dit « conforme » : c'est
  l'affaire d'un référentiel, qui sait de quel pays et de quelle année ;
- **le plan dit où les coupes passent et d'où les façades sont vues.** Un dossier
  pouvait tenir une coupe sans que le plan le laisse voir : un lecteur tenant
  les deux feuilles devait deviner, et un lecteur ne tenant que le plan ignorait
  que la coupe existait. Le repère est dérivé de la vue — ce n'est pas un second
  endroit où la ligne de coupe est décidée — donc déplacer la coupe déplace le
  repère, et une coupe qui ne dit pas où elle passe n'est marquée nulle part ;
- **huit analyses de plus sur le plan.** Ce qu'une pièce demande en chauffage,
  au total et au mètre carré ; ce qu'elle reçoit en éclairement et en puissance
  d'éclairage ; le CO₂ qu'elle atteint ; son temps de réverbération à 1 kHz ; le
  risque de condensation d'une paroi ; les unités de décharge cumulées d'un
  collecteur. Tous ces chiffres étaient calculés et ne se lisaient qu'en
  tableau. Une analyse reste une ligne de description — où sont ses nombres —
  et non une fonction de plus : deux mécanismes nouveaux y suffisent, choisir
  une bande d'octave et montrer un oui/non comme un et zéro ;
- **tout réglage qu'un module peut réclamer se saisit maintenant à l'écran**, et
  un test le prouve : il vide les réglages de la maison de référence, ramasse
  tout ce que les dix-sept modules déclarent alors manquant, et exige que
  l'écran sache prendre chacun. Trois trous s'y voyaient. Une ligne d'un tableau
  — « prix du matériau _maçonnerie_ » — n'était pas reconnue comme éditable,
  donc aucun « Corriger » n'était proposé pour la seule sorte d'entrée
  manquante à laquelle cet écran sert entièrement. Les prix au mètre de produit
  et à l'unité de modèle, tout juste ajoutés au module de coût, n'avaient aucun
  champ. Et l'occupation d'une pièce était nommée par la pièce — huit pièces,
  huit constats — au lieu de l'être par la catégorie qui la remplit, dont
  l'écran offre une ligne ; la catégorie d'une pièce étant un texte libre dans
  le modèle, l'écran ajoute désormais les catégories que le projet emploie à
  celles qu'il connaît d'avance ;
- un champ photovoltaïque posé sur un pan de toiture dit sur lequel ; le module
  demandait de le redire dans un réglage, et les deux réponses auraient divergé
  au premier déplacement ;
- **la maison de démonstration se charge à la demande.** Cent kilooctets de JSON
  derrière un bouton étaient chargés avec l'application : ouvrir son propre
  projet passait par une démonstration. Le chargement initial descend de 245,3 à
  239,3 kio.

## 0.3.0-beta.3 — non publiée

Les quatre verrous que l'audit jugeait bloquants avant le remplissage massif
des catalogues, et deux dettes qu'ils ont mises à nu.

### Compatibilité

- Format de projet : `schemaVersion` **1.2.0**. Un fichier `1.1.0` s'ouvre et
  est migré : l'identifiant et la version de la fiche catalogue, qu'une version
  antérieure de l'interface rangeait **dans** `properties` sous des noms que
  rien ne lisait, reviennent aux champs qui les nomment. Les ports de réseau
  reçoivent leur genre là où l'ancien fichier le déterminait — et nulle part
  ailleurs.

### Corrigé

- un niveau **vide** pouvait encore être supprimé alors qu'un mur y montait,
  qu'un escalier y arrivait, qu'un nœud le déclarait ou qu'une vue le
  dessinait : quatre références pendantes, et un fichier que l'application
  écrivait sans savoir le relire ;
- supprimer un modèle d'équipement vérifiait les nœuds de réseau et pas les
  composants posés ;
- les calculs lisaient les fiches du projet et non les objets posés : une
  maison avec trois radiateurs et une maison avec un seul étaient la même
  maison ;
- l'alésage d'un tronçon venait du catalogue installé aujourd'hui : corriger un
  tube six mois plus tard redimensionnait tous les réseaux déjà dessinés ;
- trois règles de compatibilité de ports pour une seule question, et deux ports
  ne disant rien étaient déclarés compatibles ;
- la comparaison de variantes énumérait neuf familles : déplacer un poteau,
  planter un arbre ou ajouter une note ne montrait rien.

### Ajouté

- `projectReferences()` : ce qui désigne quoi, énuméré une fois, avec un test
  qui parcourt le projet et refuse de laisser un pointeur non revendiqué ;
- l'invariant écrit noir sur blanc — après chaque commande publique et après
  son annulation, l'importeur relit le projet sans erreur ;
- une bibliothèque de produits réseau **dans le projet**, et des mises à jour
  du catalogue proposées plutôt qu'appliquées ;
- le métré compte ce que la maison tient et les mètres de chaque produit
  qu'elle fait courir ; le module de coût dit ce qu'il ne chiffre pas.

## 0.3.0-beta.2 — non publiée

La chaîne complète : **catalogue → objet posé → réseau → calcul →
vérifications**. Un audit avait constaté que le moteur était solide et que ce
qui manquait était le raccordement de ses deux bouts.

### Corrigé

- **un niveau ne peut plus emporter ce qu'il contient.** Un étage tenant une
  toiture, trois poteaux et une PAC comptait pour vide : le supprimer les
  emportait sans un mot, le déplacer laissait la toiture à l'ancienne hauteur,
  le dupliquer les perdait. Trois commandes tenaient trois listes écrites à la
  main, et deux familles ajoutées au modèle n'en avaient atteint qu'une ;
- l'importeur gardait sa propre liste de supports alors que l'éditeur en
  acceptait davantage : une commande pouvait produire un projet que l'importeur
  refusait — un fichier que l'application écrit et ne sait pas relire ;
- le placement demandait « cet objet est-il un support ? » sans demander « ce
  modèle-ci accepte-t-il ce genre de support ? » ;
- l'épinglage de version existait des deux côtés sans se rencontrer : un
  équipement ajouté depuis l'interface devenait un composant sans épingle ;
- le chargeur du catalogue fabriquait `version: 1.0.0` par-dessus toutes les
  fiches, et le contrôle inspectait ses propres réparations ;
- un port en satisfaisait deux : le rapprochement se faisait par _service_, si
  bien qu'une machine avec un seul raccordement d'eau passait pour une machine
  qui en a deux. Trois familles fausses trouvées du premier coup ;
- onze clés de propriété voulaient dire deux choses ou plus — `cost` en valait
  quatre — et une perte de charge était dérivée ici, enregistrée là.

### Ajouté

- `ResolvedPlacedEquipment` : la fiche et la pose vues ensemble, dérivées et
  jamais enregistrées. Les calculs lisaient le catalogue seul, si bien qu'un
  projet avec trois radiateurs et un projet avec un seul étaient le même ;
- un tronçon nomme son produit au lieu d'en recopier l'alésage et la rugosité
  à la main, quarante fois par projet ;
- une empreinte de contenu par fiche : corriger une fiche sans lever sa version
  est refusé ;
- les dégagements se voient sur le plan, par groupes, et leurs conflits
  arrivent dans les vérifications ; une zone que personne n'a mesurée est
  signalée plutôt que dessinée à zéro ;
- un navigateur des 518 familles remplace la liste des 19 fiches ;
- les limites d'import couvrent les vingt-six familles du modèle, le nombre
  total d'objets et le nombre de points de géométrie.

### Modifié

- les types techniques descendent dans `technical-types` et les produits réseau
  dans `network-products`, pour que nommer un port ne demande plus de dépendre
  de cinq cents familles ;
- six axes de statut se mesurent au lieu de se déclarer.

## 0.3.0-beta.1 — non publiée

Quatre passes d'audit depuis la `0.2.0-beta.2`. L'application est passée d'une
page qui dessine des murs à un poste de travail : on y trouve un objet, on lit
ce que son métier en dit, on le fait varier, on l'imprime. Et la couche de
données qui va la remplir est en place — avec les contrôles qui empêchent de
la remplir de travers.

### Ajouté

- un poste de travail plutôt qu'une page : palette de commandes, arbre du
  projet, sélection par bande, modification de plusieurs objets à la fois,
  saisie au curseur, cotes posées sur le dessin ;
- les primitives de CAO qu'un dessinateur attend : pivoter, retourner, copier,
  décaler, joindre, ajuster, aligner, scinder où l'on désigne ;
- la maison plutôt que ses segments : escaliers, toitures décrites par ce qui
  les enferme, éléments de structure, terrain et obstacles de parcelle, et ce
  qui est **posé** dans la maison et non seulement catalogué ;
- les réseaux dessinés là où ils passent, et les résultats des moteurs
  projetés sur le plan en surcouches ;
- un dossier de plans reproductible : vues enregistrées, feuilles, cartouches ;
- une variante construite en pointant le plan ;
- sept registres de données et une nomenclature de **518 familles**, en
  données et non en TypeScript, avec les catalogues qui vont avec : 19 fiches
  génériques et 66 produits de réseau ;
- les dégagements réels — la famille dit quelles zones une chose possède, la
  fiche dit jusqu'où chacune porte — et les conflits de volume entre deux
  machines ;
- `npm run validate:catalog`, qui vérifie toute la couche de données en une
  seconde et qui est une étape de l'intégration continue.

### Modifié

- un composant posé enregistre `definitionId` **et** `definitionVersion` :
  corriger une fiche ne change plus une maison que personne n'a touchée ;
- les ports disent leur fluide, leur service, leur sens et leur mode de
  raccordement ; ce qui ne peut pas exister est refusé en disant pourquoi ;
- les supports sont une liste fermée dont l'éditeur dérive ses réponses, ce qui
  a fait réapparaître les toitures complètes ;
- six axes de statut ne se déclarent plus : ils se mesurent sur les registres.
  Mille cent une déclarations écrites à la main ont été retirées.

### Corrigé

- un identifiant ne peut plus désigner deux objets de familles différentes :
  l'index des entités du projet est unique et un test parcourt le fichier
  entier pour prouver qu'aucune famille ne lui échappe ;
- huit familles étaient raccordées par des choses que l'objet n'a pas — une VMC
  simple flux n'a pas de côté soufflage, un module photovoltaïque ne produit
  pas d'alternatif — et huit fiches taisaient des raccordements réels ;
- une fiche déclarait le schéma `BATTERY_DEVICE` et portait un nom de
  propriété que ce schéma ne connaît pas ; les deux fichiers étaient valides
  séparément et rien ne les comparait ;
- l'état de charge d'une batterie et le remplissage d'une cuve ont quitté le
  catalogue : ce n'est pas ce qu'un produit est, c'est où il en est ;
- le chargeur du catalogue réécrivait `STANDARD` par-dessus toute provenance,
  ce qui transformait une valeur générique en chiffre normatif.

### Documentation

- `docs/DATA_REGISTRIES.md` décrit les registres, les ports, les dégagements,
  les supports, la version posée et les axes mesurés ;
- le `README` ne promet plus une publication qui n'a pas lieu.

## 0.2.0-beta.2 — non publiée

Quatre cas d'intégrité relevés par un septième audit, chacun accompagné de son
test de non-régression. Rien de fonctionnel n'a été ajouté : cette version rend
sûr ce que la précédente proposait déjà.

### Corrigé

- la sauvegarde locale n'annonce « sauvegardé » que si l'instantané écrit est
  celui du projet à l'écran. Une édition faite pendant l'écriture laissait
  jusqu'ici le disque en retard d'une révision tout en annulant le minuteur de
  l'instantané suivant, si bien que la modification n'était jamais écrite sous
  une étiquette rassurante ;
- supprimer l'instantané passe par la file d'écriture : une écriture déjà
  engagée ne peut plus le faire réapparaître juste après la suppression, et un
  instantané confié pendant celle-ci est refusé ;
- un conteneur `.houseproj` qui désigne un profil climatique sans le
  transporter est refusé même lorsqu'il ne transporte aucun climat — le cas qui
  passait. La même vérification a lieu à l'écriture : l'export est refusé, en
  disant quel jeu de données charger, plutôt que de produire un fichier
  inutilisable ailleurs ;
- un manifeste dont le champ `climate` n'est pas une liste de noms est refusé
  au lieu d'être lu comme un conteneur sans climat ;
- les références d'un nœud de réseau sont vérifiées ensemble et plus seulement
  une à une : niveau déclaré, pièce desservie et objet support doivent
  appartenir au même niveau. L'import le refuse, et les commandes d'édition
  aussi.

### Documentation

- le `README` décrit l'application telle qu'elle est : l'assistant de création
  et le remaniement géométrique n'y figurent plus comme absents, et les limites
  connues sont datées de cette version ;
- `docs/IMPLEMENTATION_STATUS.md` dit en tête qu'il est un journal, dont les
  sections anciennes décrivent l'état de leur date.

## 0.2.0-beta.1 — non publiée

Première version proposée à des utilisateurs. Elle permet le parcours complet :
créer un projet, choisir un climat, dessiner et corriger des murs, poser portes
et fenêtres, décrire niveaux, pièces, dalles et toiture, choisir matériaux et
assemblages, poser des équipements, créer des réseaux et les dimensionner,
lancer les calculs, voir ce qui manque, comparer un scénario, exporter un plan,
enregistrer et retrouver le projet après fermeture du navigateur.

### Compatibilité

- Format de projet : `schemaVersion` 1.0.0. Un fichier écrit par une version
  antérieure du schéma est migré à l'ouverture, et l'application dit qu'elle
  l'a fait ; un fichier annonçant une version future est refusé plutôt
  qu'ouvert à moitié.
- Conteneur `.houseproj` : version 1.x. Le manifeste est strict — ce qu'il
  annonce doit être présent et valide — et l'archive est bornée en taille, en
  nombre d'entrées et en facteur d'expansion.
- Sauvegarde locale : les instantanés laissés en `localStorage` par une version
  antérieure sont déplacés vers IndexedDB à la première ouverture.
- Réglages : `battery.offGrid` se saisit désormais comme une case à cocher ; la
  forme ancienne (`1` ou `0`) reste lue.

### Ajouté

- assistant de création de projet : nom, auteur, pays, niveaux, hauteur
  d'étage, sous-sol, orientation et localisation, ce qui reste vide restant
  inconnu ;
- zones : création, renommage, type, appartenance des pièces, suppression ;
- provenance saisissable pour chaque propriété de matériau ;
- espaces de travail regroupés en cinq familles ;
- gaines rectangulaires, charges électriques fixes, racines de réseau propres à
  chaque discipline ;
- transport du projet et de son climat dans un seul fichier `.houseproj` ;
- vérification d'accessibilité automatisée sur les onze espaces de travail ;
- budget de taille du chargement initial vérifié en intégration continue ;
- vérification du déploiement GitHub Pages après publication ;
- tests navigateur sur Chromium, Firefox et WebKit.

### Corrigé

- la sauvegarde locale n'annonce plus « sauvegardé » pour une révision qui
  n'est pas celle affichée, et elle enregistre le climat avec le projet ;
- l'export ne peut plus être annoncé pour une révision modifiée depuis ;
- les résultats de calcul ne peuvent plus être présentés comme ceux d'un autre
  projet ;
- les hypothèses silencieuses (cuivre implicite, pertes locales nulles) sont
  devenues des hypothèses déclarées ou des entrées manquantes ;
- les références mortes — pièce d'une zone, mur d'une cote, objet hôte d'un
  nœud — sont refusées à l'import, comme les identifiants dupliqués ;
- contrastes de texte insuffisants dans la barre de projet et les métriques.

### Connu, assumé

Feuilles et export PDF, orchestrateur de calcul persistant, invalidation
sélective par `ChangeSet`, régression visuelle pixel par pixel, réglages encore
invisibles alors que les moteurs les lisent. Le détail est dans
`docs/BETA_READINESS.md`.

## 0.1.0

Développement initial, sans publication. L'historique des passes d'audit et de
leurs correctifs est dans `docs/IMPLEMENTATION_STATUS.md`.
