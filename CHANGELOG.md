# Journal des versions

Les versions suivent [SemVer](https://semver.org/lang/fr/). Le format de
fichier `.houseproj` porte sa propre version, indépendante de celle de
l'application : `schemaVersion` dit ce qu'un fichier contient, la version de
l'application dit ce qui l'a écrit.

## 0.4.0-beta.1 — non publiée

**La maison de référence est faite de fiches, les quatre derniers écarts de
contrat sont refermés, et les moteurs ont été interrogés un par un.** Les 527
familles de la nomenclature portent toutes une fiche générique ; le métré
compte enfin les planchers et la toiture. Format de fiche d'assemblage en
1.1.0 — la première évolution délibérée depuis le gel.

### Ajouté

- **la maison de référence est faite du catalogue**, enveloppe comprise : vingt
  fiches d'équipement, trois menuiseries, cinq compositions et les onze
  matériaux dont elles sont faites, tous passés par les constructeurs que
  l'interface appelle. Trente-trois objets posés au lieu de neuf.
- **le cycle complet est un test de bout en bout** : créer un projet sur la page
  de création, tracer, sauvegarder, fermer, rouvrir, modifier, recalculer,
  exporter. Chaque étape était couverte seule ; aucune ne disait que ce qui
  ressort du fichier est ce qui y est entré.
- **vingt et une fiches** pour les familles que le registre des assemblages ne
  savait pas décrire : treize éléments de structure et huit points singuliers de
  toiture. Avec elles, **les 527 familles ont toutes une référence générique**.
- **vingt et un mots** au vocabulaire des catégories d'équipement, pour les 201
  familles qui répondaient `OTHER` — mobilier, vanne, raccord, prise de terre,
  cheminement de câbles, compteur, électroménager, réseau de données…
- **douze produits de conduit de fumée** — simple paroi et tubage flexible en
  six diamètres — pour que le tronçon droit n'existe plus dans deux registres.
- **`docs/ENGINE_AUDIT.md`** : ce que chaque moteur a été interrogé sur, et ce
  qu'il a répondu, y compris ce qui n'est toujours pas compté et pourquoi.

### Corrigé

- **le métré comptait les murs et rien d'autre.** La dalle sur terre-plein, le
  plancher intermédiaire et les deux pans de toiture n'atteignaient ni la
  nomenclature, ni le coût, ni le carbone : le total ne disait pas qu'il lui
  manquait la moitié du bâtiment, il donnait un chiffre.
- **deux vocabulaires pour une idée.** Les adaptateurs demandent
  `PHOTOVOLTAIC`, une fiche répond `PV_MODULE` : le jour où la maison a été
  refaite depuis le catalogue, trois modules n'ont plus rien trouvé. Même chose
  pour `installedPowerWp`/`peakPowerWp` et `ratedAcPowerW`/`nominalAcPowerW`.
- **un groupe de ventilation double flux au-dessus d'un réseau simple flux.**
  Les deux le disaient dans leur `systemType`, et personne ne les comparait.
- **un lavabo se tenait deux mètres en dehors de la pièce qu'il déclarait.**
  Rien ne le refusait : le comptage, la demande d'eau et le dessin lisent tous
  `spaceId`, et seul le dessin aurait montré le désaccord.
- **la zone chauffée ne rassemblait que le rez-de-chaussée**, alors que l'étage
  a ses radiateurs.
- **`labourPriceByEquipment` nommait des équipements disparus** : une table que
  plus personne ne lisait, et que le module lisait toujours.
- **les outils sortaient de leur colonne.** Un `<select>` listant ce que le
  projet contient élargissait son groupe, et « Sèche-serviettes eau chaude » a
  glissé la palette sous le dessin, où plus rien n'était cliquable.
- **un scénario proposait « épaisseur de material-insulation ».** Le projet
  connaît le nom du matériau.

### Modifié

- **Catalog Format 1.1.0 pour les assemblages.** Une fiche peut déclarer une
  `form` — `LAYERED`, `PROFILED`, `LINEAR` — et les `properties` qui vont avec :
  un poteau a une section, un faîtage une longueur. La forme est déduite de la
  catégorie de la famille, jamais choisie par la fiche, et **un mur, une dalle
  ou une toiture ne peuvent être faits que d'une fiche en couches** — sans quoi
  un poteau écrit comme « une couche de béton de 0,20 m » serait lu par le
  calcul thermique comme une paroi qui n'existe pas.
- **dix-huit familles ont quitté le service** au lieu d'être supprimées, chacune
  en disant ce qui la remplace et pourquoi. Le cycle de vie existait depuis
  CAT-01 et rien ne le consultait ; le sélecteur et le navigateur le lisent
  maintenant.
- **trente familles renommées** parce qu'un mot de métier était partagé par deux
  métiers : té d'eau et té de gaine, purgeur de distribution et purgeur de
  chauffage, clapet anti-retour d'eau, d'évacuation et d'air.
- **`ROOF_WINDOW` et `SKYLIGHT` quittent le registre des assemblages** pour
  celui des menuiseries : leur contrat est celui d'une ouverture — Uw, facteur
  solaire, vantail — et jamais celui d'une paroi.

### Écarts de contrat

**Les huit écrits dans [`docs/CONTRACT_GAPS.md`](docs/CONTRACT_GAPS.md) sont
refermés.** Un neuvième est ouvert et assumé : `CG-09` — une ouverture n'a pour
hôte qu'un mur, dans quarante-six endroits du code, si bien qu'une fenêtre de
toit a sa fiche et ne peut pas être posée. C'est une extension du modèle
géométrique, pas du format.

## 0.3.0-beta.13 — non publiée

**Les six vagues de remplissage, et le catalogue branché sur le projet.** Le
catalogue passe de 122 à 601 fiches ; 504 familles sur 527 ont une référence
générique. Un projet neuf ne reçoit plus le catalogue : il reçoit un panier, et
on y ajoute ce qu'on choisit.

### Ajouté

- **443 fiches génériques** sur les six vagues : matériaux, compositions,
  menuiseries, mobilier, eau, évacuation, eaux pluviales, chauffage,
  ventilation, électricité, éclairage, solaire, stockage, fumée, données,
  sécurité, aménagements extérieurs. Aucun fichier moteur modifié pour les
  écrire — c'est la propriété que le gel du format v1 devait rendre vraie, et
  c'est la première fois qu'elle est exercée à cette échelle.
- **un panier de départ** généré depuis le catalogue et comparé à lui par une
  porte : une composition par sorte de surface, les matériaux que ces
  compositions nomment, trois menuiseries. Vingt-deux fiches au lieu de
  cent vingt-huit.
- **un sélecteur de catalogue commun** aux matériaux, aux compositions et aux
  menuiseries. Il tient des lignes, jamais des fiches, et ne cherche un corps
  qu'au moment d'un choix. Choisir une composition amène les matériaux dont
  elle est faite, en une seule transaction.
- **un panneau Menuiseries**, qui n'existait pas : les modèles de fenêtre
  venaient avec le projet et n'avaient aucun endroit où être choisis.
- **dix types de port** pour trois médias que le registre ignorait — le
  combustible, l'eau glacée, et le sens du courant hors photovoltaïque — et
  **dix-huit propriétés**, dont l'ampère-heure d'un accumulateur et la tension
  à vide d'un module.
- **trois schémas de propriétés** — `SENSOR_DEVICE`, `HEATING_CONTROL`,
  `SURGE_PROTECTOR_DEVICE` — pour des natures d'objet décrites jusque-là par le
  schéma d'autre chose.

### Corrigé

- **les exigences de port étaient écrites par lot.** 186 familles sur 240
  déclaraient une liste par schéma de propriétés, tout obligatoire : les 22
  familles de conduit de fumée avaient deux sorties et aucune entrée, si bien
  qu'un conduit de cheminée était indescriptible ; un coude de ventilation
  devait être à la fois soufflage, extraction, air neuf et rejet ; une prise
  avait un bus de commande et pas de terre. Elles distinguent maintenant ce
  qu'un objet a toujours, ce que certaines variantes ont, et ce dont il a l'un
  d'un ensemble.
- **une bouche d'extraction que rien ne pouvait raccorder.** Elle déclarait un
  port entrant, comme le caisson auquel elle doit se raccorder ; deux ports
  entrants ne s'apparient jamais.
- **la porte des empreintes interrogeait la mauvaise forme.** Elle demandait au
  gardien la fiche _résolue_, qui porte la catégorie de sa famille — ce que le
  gardien refuse. Les 122 fiches d'équipement se déclaraient invalides et
  chaque famille s'affichait `PARTIAL` pendant que la validation disait le
  catalogue propre.
- **`PHYSICAL` était déclaré par 396 familles** et refusé systématiquement sur
  une fiche : une zone que rien ne pouvait remplir, annoncée comme une
  information.
- **`ip` et `ipRating` étaient deux orthographes d'une seule propriété**, même
  libellé, même type, chacune dans ses propres schémas.
- **quarante-huit fiches étaient muettes** faute de champ applicable dans leur
  schéma. Il en reste quatre, et chacune pour une raison qui tient.
- **un projet vide pesait 92 ko** et mettait les trois catalogues dans le
  premier chargement. Il pèse 17 ko, et le premier chargement n'en porte plus
  aucun : les six vagues lui ont coûté quatre cents octets.

### Écarts de contrat

Huit sont écrits dans [`docs/CONTRACT_GAPS.md`](docs/CONTRACT_GAPS.md) plutôt
que contournés. Trois sont refermés (`CG-05`, `CG-06`, `CG-07`) ; les cinq
autres attendent une décision de format ou de nomenclature.

## 0.3.0-beta.12

La **dernière porte avant le remplissage massif**. Rien de neuf dans le moteur :
quatre corrections d'industrialisation, et le format catalogue est figé.

### Corrigé

- **ajouter des fiches demandait encore de modifier du TypeScript.** Huit
  fichiers d'équipement étaient importés à la main dans le chargeur et
  énumérés un par un dans le validateur de schémas : deux cents excellentes
  fiches déposées dans un neuvième fichier n'arrivaient nulle part. Les six
  registres découvrent maintenant leurs fichiers ; l'arborescence est la liste.
- **le chemin réel de l'utilisateur ne passait pas par l'architecture qui
  passe à l'échelle.** Le panneau gardait chaque fiche entière — ports,
  dégagements, cartes de performance — pour dessiner une liste de noms. Il tient
  des résumés et demande un corps au dépôt quand quelqu'un pose quelque chose.
- **cinq registres sur six n'étaient pas versionnés.** Corriger la laine de
  roche aurait changé silencieusement chaque mur déjà dessiné avec elle. Les
  empreintes couvrent les six, sous `REGISTRE:identifiant@version`.
- **les matériaux et les assemblages perdaient leur origine dans le projet.**
  Les chiffres restaient, donc le calcul aussi ; ce qui manquait était de
  pouvoir dire `MATERIAL:generic-rock-wool@1.0.0`. `catalogRef` le porte.

### Modifié

- **un seul chemin d'une fiche à un projet.** La maison de qualification
  construisait ses copies à la main ; elle passe par le même constructeur que
  l'interface, et exerce donc les courbes, les sources, le rendu et les
  capabilities.
- **Catalog Format v1 est figé**, avec sa règle : une PR de remplissage ne
  modifie aucun fichier moteur ; une fiche que les contrats ne savent pas
  représenter ouvre un `CONTRACT_GAP` au lieu d'étendre le format en passant.

## 0.3.0-beta.11 — non publiée

L'**architecture du catalogue**, figée avant que quiconque le remplisse.

Le moteur BIM et les calculs ne bloquaient plus ; les contrats de données, leur
versionnement, leur chargement et l'uniformité des sept registres, si. Neuf
passes les ont fermés.

### Ajouté

- **un catalogue d'ouvertures.** Le modèle portait `Opening.definitionId`, la
  nomenclature déclarait trente-quatre familles, et rien n'était livré : le Uw
  de chaque fenêtre devait être saisi à la main, ou l'ouverture était comptée
  comme une inconnue. Douze fiches arrivent, et l'inspecteur laisse enfin
  choisir la menuiserie d'une ouverture.
- **un catalogue d'assemblages.** Les sept registres en annonçaient un, la
  nomenclature déclarait cinquante-six familles, rien n'était livré — les
  compositions de départ étaient écrites couche par couche dans l'application.
- **un manifeste, un dépôt et un index.** « Le catalogue » voulait dire « ce
  qui se trouve importé ». Le manifeste dit ce qui est installé et porte deux
  niveaux de version, le dépôt pose la question une fois, l'index porte des
  résumés plutôt que des fiches entières.
- **une maison de qualification** : une de chaque fiche livrée, portée par un
  projet que l'importateur accepte — et un catalogue de mesure de dix mille
  fiches, mesuré à chaque intégration.

### Modifié

- **les matériaux et les symboles quittent le TypeScript.** Les sept registres
  sont en données ; les deux derniers étaient des listes écrites en code, que
  personne ne lisait, que deux personnes ne pouvaient pas éditer et qu'aucune
  porte ne vérifiait.
- **une fiche ne redit plus ce que sa famille dit.** Elle portait un `kind` et
  une `category` à côté de son `familyId` : à dix-neuf fiches, deux avaient
  déjà divergé. La famille est la seule phrase, et les fiches passent en
  1.1.0.
- **une carte de performance se lit sur un ou deux axes, et rien n'est
  extrapolé.** Le type acceptait quatre modes d'interpolation et un nombre
  d'axes quelconque ; le lecteur n'en acceptait qu'un.
- **`TESTS` cesse de dire « prouvé » pour dire « écrit ».** L'axe passait à
  `VALIDATED` dès qu'une fiche franchissait la porte, ce que `GENERIC_DATA` dit
  déjà. Une famille est testée quand une pièce de ce dépôt est faite d'elle.

### Corrigé

- **la copie du catalogue dans le projet n'était pas une copie.** Elle laissait
  derrière elle les courbes de performance — le COP d'une pompe à chaleur vaut
  2,0 à −15 °C et 5,0 à +15 °C —, le rendu, et la source de chaque chiffre.
- **poser un équipement produisait un projet que l'importateur refusait.** La
  forme des ports exigeait `discipline` et `role`, que la copie n'écrivait
  jamais.
- **les empreintes ne couvraient que ce que quelqu'un avait pensé à
  enregistrer.** Une fiche sans empreinte passait en silence, donc dix mille
  nouvelles fiches auraient été dix mille fiches hors du dispositif.
- **deux courbes écrivaient `m3/h` là où le registre dit `m³/h`** : la même
  grandeur écrite deux fois, donc deux unités pour qui compare des chaînes.

## 0.3.0-beta.10 — non publiée

L'**intégrité des références**, demandée une seule fois.

### Corrigé

- **une ouverture nommant un modèle que le fichier ne porte pas entrait sans
  un mot.** L'importeur vérifiait ses références boucle par boucle : les
  ouvertures contre leur mur porteur, les nœuds contre leur niveau, les cartons
  contre leur vue. Chaque boucle était juste et l'ensemble n'a jamais été
  complet. `projectReferences()` est la liste unique de ce qui pointe vers
  quoi, et la question générique — cet objet existe-t-il — s'y pose désormais
  une fois, pour tout. Les règles spécifiques restent : elles disent _quel_
  objet un pointeur a le droit de nommer, ce qui est une autre question.
- **le projet de test des commandes pointait vers des composants qu'il avait
  lui-même retirés.** Le nouveau contrôle l'a trouvé du premier coup : le
  gabarit remplaçait la liste des composants du rez-de-chaussée au lieu de s'y
  ajouter, et les nœuds de ventilation et d'éclairage de la maison de référence
  se retrouvaient sans objet.

### Ajouté

- `danglingReferences()` dans `core-domain`. Un défaut qu'une règle spécifique
  nomme déjà n'est pas nommé deux fois : le message le plus précis survit.

## 0.3.0-beta.9 — non publiée

La passe sur l'**intégrité de la création de projet** : cinq endroits où la
page demandait quelque chose et n'en faisait rien, ou faisait autre chose.

### Corrigé

- **l'adresse saisie était perdue.** La page la demandait, le constructeur ne
  gardait que latitude, longitude, altitude et pays. `Site.locationLabel` la
  conserve — « Quimper, France » est ce qu'une personne sait de son terrain, et
  aucun géocodeur n'est nécessaire pour que ce soit utile. Elle ne remplace
  jamais des coordonnées : un projet avec une adresse et sans position reste un
  projet dont le soleil ne se calcule pas, et les modules le disent toujours.
- **le champ pays affichait « FR » en filigrane et appliquait FR quand même**,
  donc un champ visuellement vide produisait un projet français. Le brouillon
  énonce maintenant le pays qu'il va écrire.
- **une emprise en U pouvait se croiser avec elle-même.** Seul le signe de
  l'aile était vérifié ; deux bras de 6 m dans 10 m de largeur passaient l'un
  à travers l'autre et produisaient un contour que personne n'aurait dessiné à
  la main. Les relations entre l'aile et la boîte sont vérifiées avant que quoi
  que ce soit ne soit tracé.
- **l'emprise arrivait mur par mur.** Six murs et une dalle arrivent maintenant
  ensemble ou pas du tout, et « annuler l'emprise » est une seule pression au
  lieu de sept.
- **`startMode` ne servait à rien.** « Être guidé » arrive dans Projet avec le
  guide ouvert, « page blanche » arrive sur le plan sans rien devant. Le projet
  BIM est le même dans les deux cas — un mode qui changerait le modèle serait
  une deuxième sorte de projet.

## 0.3.0-beta.8 — non publiée

La passe sur les **limites thermiques** : où la maison chauffée s'arrête, et
ce que chaque pièce perd réellement.

### Corrigé

- **une maison à toiture moderne et plafond perdait sa chaleur deux fois.** La
  règle du plafond regardait `level.roofs` pendant que la boucle des toitures
  lisait `allRoofPlanes()`, qui tient aussi les toitures décrites par leur
  contour. Le modèle dit maintenant lequel des deux est la limite : un plafond
  sous une toiture donne sur des combles que personne ne chauffe — le plafond
  est la limite, la toiture est dehors ; sans plafond, ce sont les pans qui
  ferment la maison.
- **un plafond sous combles n'était pas exposé au vent** et recevait pourtant
  la résistance superficielle extérieure. Il donne sur un local non chauffé, ce
  que `boundaryCondition` disait déjà sans que le calcul s'en serve.
- **un plancher, un plafond et une façade avaient les mêmes films d'air.**
  Rsi 0,13 et Rse 0,04 sont le cas horizontal ; ISO 6946 en donne trois selon
  le sens du flux, et une dalle sur terre-plein n'a pas de film extérieur du
  tout — la terre n'est pas une brise.
- **deux pièces de 15 m², l'une à trois façades et grande baie nord, l'autre à
  une façade et petite fenêtre sud, recevaient presque la même charge.** Les
  murs qui entourent une pièce et les ouvertures qui les percent lui sont
  maintenant attribués en propre ; la toiture et le plancher, qui sont
  réellement partagés, entrent au prorata de sa surface. Le prorata global
  reste pour une pièce dont les murs ne l'enferment pas, et la pièce est
  nommée dans le journal des hypothèses.

### Ajouté

- `envelopeByRoom()` dans `core-domain` : quelle part de l'enveloppe appartient
  à quelle pièce.
- `surfaceResistances()` dans le module thermique : les films d'air selon le
  sens du flux et selon ce qu'il y a de l'autre côté, avec leur référence.

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
