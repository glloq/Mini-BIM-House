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

La nomenclature vit dans `packages/catalog-registry/data/families/*.json` : 527
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

**Six axes ne se déclarent pas.** `PROPERTIES`, `PORTS`, `PLACEMENT`,
`PLAN_SYMBOL`, `GENERIC_DATA` et `TESTS` sont mesurés sur les registres à
chaque question, et les écrire à la main est refusé par la validation. La
raison est chiffrée : soixante-et-onze familles annonçaient
`PLAN_SYMBOL: READY` sans qu'une seule nomme un symbole, et deux cent
quatre-vingt-trois annonçaient `PORTS: READY` — dont huit étaient raccordées
par des choses que l'objet n'a pas. Un statut tapé à la main est une
intention, et une intention verte depuis des mois est pire que pas de statut
du tout : c'est la raison pour laquelle plus personne ne regarde.

Déclarer ne vaut pas connaître : une famille qui annonce des ports d'un type
connu monte à `PARTIAL`, et il faut une fiche catalogue — quelqu'un qui a
réellement modélisé une de ces choses — pour aller plus loin. `VALIDATED`
veut dire qu'une fiche de cette famille passe le contrôle, donc que la suite
de tests l'exécute.

Les dix autres axes — est-ce modélisé, chiffré, porté par une règle — sont des
jugements que rien ne sait encore mesurer, et restent déclarés. La repasse de
toutes les familles les a remis à leur place : trois cent dix-sept familles
d'équipement annonçaient `MODEL: READY` alors que le modèle contient un
composant posé, ce qui est vrai de toutes et ne dit rien d'aucune.

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
  "category": "HEAT_PUMP",
  "priority": 4,
  "capabilities": ["PERFORMANCE_MAPPED"],
  "ports": ["HEATING_FLOW", "HEATING_RETURN", "ELECTRICAL_AC"],
  "optionalPorts": ["CONDENSATE", "CONTROL"],
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

## Une seule taxonomie

Une fiche de catalogue déclarait autrefois trois choses pour dire la même : son
`familyId`, son `kind` et sa `category`. À dix-neuf fiches, deux d'entre elles
avaient déjà divergé — `generic-pv-module` annonçait `kind: PHOTOVOLTAIC` et
`category: PV_MODULE`, les deux fichiers étaient valides, et rien ne les
comparait.

La famille est désormais la seule phrase. Elle porte `category` ; la fiche n'en
porte aucune, et la porte de validation refuse celle qui essaierait. Ce que
l'interface trie et filtre lui est apposé à la sortie, par `categoryOfFamily`,
donc une seule fois et au même endroit pour tout le monde.

Même règle pour les ports d'une fiche : `discipline` et `role` étaient deux
chaînes libres à côté du `portTypeId`, qui dit déjà le domaine, le fluide, le
service et le sens. Elles ont disparu.

## Ce qu'une famille peut faire

Le moteur demandait `category === 'HEAT_PUMP'` et `registry === 'EQUIPMENT'` à
une douzaine d'endroits, ce qui veut dire qu'ajouter une famille d'un genre
imprévu — un filtre d'eaux pluviales, un dérivateur solaire — demandait de
modifier le moteur. La règle que cette application se donne est l'inverse :
_ajouter une famille ou dix mille références ne doit demander aucune
modification du moteur._

Une **capability** est la phrase qui rend cela possible. Elle dit ce qu'on peut
faire d'une famille — la poser, la raccorder, la dessiner, la compter — sans
dire ce qu'elle est. Onze en tout, liste fermée :

| Lue de ce que la famille déclare                                                                             | Déclarée, parce que rien ne l'implique                    |
| ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| `PLACEABLE`, `CONNECTABLE`, `CLEARANCE_ZONED`, `PLAN_DRAWN`, `SCHEMATIC_DRAWN`, `RUN_MATERIAL`, `CALCULATED` | `LAYERED`, `PIERCING`, `PERFORMANCE_MAPPED`, `QUANTIFIED` |

Les sept premières ne s'écrivent pas : une famille qui déclare des ports _est_
raccordable, et le dire une seconde fois est la façon dont les deux finissent
par se contredire. C'est la même règle que les axes de statut mesurés, et pour
la même raison. `capabilitiesOf` donne la réponse entière ; lire
`family.capabilities` n'en donne que la moitié tapée à la main.

## Le cycle de vie et les vagues

Un catalogue qui ne fait que grandir est un catalogue que personne ne peut
corriger : le jour où un chiffre générique se révèle faux, il faut choisir entre
le changer sous les pieds de tous les projets qui l'ont épinglé et le laisser là
pour toujours. Aucun des deux n'est acceptable, donc une fiche se **retire** :

`DRAFT` → `ACTIVE` → `DEPRECATED` → `WITHDRAWN`

Elle cesse d'être proposée, elle continue d'ouvrir les fichiers qui la
contiennent, et elle dit quoi employer à la place. Une fiche qui quitte le
service sans nommer son remplaçant ni dire pourquoi elle n'en a pas est refusée :
sinon le problème est déplacé sur celui qui la rencontre, qui reçoit « ne plus
employer » et pas de seconde phrase.

La vague (`priority`) est l'une des six, pas un entier libre. Une famille écrite
en vague 9 n'apparaîtrait dans aucun plan de travail, silencieusement, parce que
personne ne cherche une vague 9.

## Une référence, dite pareil partout

Les sept registres nommaient leurs entrées de sept façons. `CatalogRef` est la
phrase commune — `EQUIPMENT:generic-wc@1.1.0` — et `validateCatalogIdentity`
vérifie ce que toute fiche de tout registre doit dire d'elle-même : un
identifiant en minuscules, une version comparable, un cycle de vie connu, une
vague connue, une provenance.

## Les ports

Un port n'est pas un trou : c'est un endroit où quelque chose de précis arrive
ou part. Un départ et un retour de chauffage transportent la même eau et ne sont
pas interchangeables ; une arrivée d'eau froide et une évacuation ne sont même
pas le même fluide. Chaque type de port déclare son fluide et son sens, et
`portsConnect()` refuse ce qui ne peut pas exister.

La liste est fermée. Une chaîne libre voudrait dire que `HEATING_FLOW`,
`heating-flow` et `FLOW_HEATING` existent tous les trois et qu'aucun ne se
raccorde aux autres.

Une famille sépare ce par quoi une chose est **toujours** raccordée
(`ports`) de ce par quoi elle **peut** l'être (`optionalPorts`). La
distinction n'est pas cosmétique : c'est elle qui permet d'exiger les
premiers. Un radiateur sans départ ni retour n'est pas un radiateur simplifié,
c'est un radiateur qu'aucun réseau ne peut atteindre ; la ligne de commande
d'un luminaire, elle, existe ou non selon l'installation. Tant que les deux
étaient dans la même liste, aucune des deux ne pouvait être vérifiée.

## Le contrôle des données

```
npm run validate:catalog
```

Un seul passage sur toute la couche de données : chaque famille contre les
registres qu'elle nomme, chaque fiche du catalogue contre sa famille et son
schéma, chaque produit réseau contre le sien. Il s'exécute en une seconde et
il est une étape de l'intégration continue.

C'est le contrôle qui manquait, et l'audit a dit précisément pourquoi il
comptait : la batterie déclarait le schéma `BATTERY_DEVICE` et portait
`maxChargePowerKW` là où le schéma dit `maximumChargePowerW`. Les deux
fichiers étaient valides séparément, la famille annonçait
`GENERIC_DATA: READY`, et l'intégration était verte — parce que rien ne
comparait les deux. Six cents fiches ajoutées par-dessus auraient été six
cents fiches que personne n'avait comparées à quoi que ce soit.

## Les propriétés : d'où vient la valeur

Chaque propriété déclare sa source :

- `DEFINITION` — appartient à la fiche catalogue, identique pour tous les
  exemplaires de ce modèle ;
- `INSTANCE` — appartient à celui qui est posé dans cette maison ;
- `DERIVED` — se déduit des deux et **ne se stocke jamais**.

Une propriété dérivée trouvée parmi les valeurs enregistrées est une erreur et
non un avertissement : c'est une deuxième réponse à une question à laquelle le
modèle répond déjà, et les deux se contrediront au premier changement.

## Une propriété, une définition

`cost` voulait dire quatre choses — un coût, un coût au mètre carré, un coût
au mètre, un coût au mètre cube — et `pressureDrop` était une valeur
enregistrée dans un schéma et une valeur dérivée dans un autre, ce qui est
exactement la façon dont une valeur dérivée finit écrite dans un fichier et se
contredit elle-même. Deux cent quarante-six clés réparties sur quarante-quatre
schémas avaient déjà divergé onze fois ; à cinq cents familles ce serait
irrattrapable.

Une clé est donc définie **une fois**, dans
`data/property-schemas/properties.json` : ce qu'elle veut dire, son type, son
unité, ce que cette unité mesure, et les orthographes plus anciennes sous
lesquelles un fichier a pu l'écrire. Une famille dit ensuite **quelles** clés
elle emploie et ce qu'elle en accepte — une plage, une liste — et ne répète
rien du reste :

```json
{ "key": "maxChargePowerKW", "source": "DEFINITION", "minimum": 0 }
```

Les unités forment elles aussi une liste fermée, avec la grandeur que chacune
mesure. `KW`, `kw` et `kW` sont trois orthographes d'une seule unité et une
seule est le symbole ; à cinq cents familles, une unité tapée à la main est une
unité tapée de trois façons, et une valeur lue dans la mauvaise est fausse d'un
facteur mille. Une propriété dont l'unité et la grandeur se contredisent est
refusée.

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

La famille dit **quelles** zones une chose possède — toute PAC air/eau a une
prise d'air et un rejet. La fiche dit **jusqu'où** chacune porte, parce que
c'est la machine qui demande deux mètres devant son ventilateur et cent
millimètres derrière :

```json
"clearances": [
  { "zone": "AIR_EXHAUST", "frontMm": 2000, "reason": "Soufflage du ventilateur" },
  { "zone": "SERVICE", "frontMm": 1000, "aboveMm": 500, "reason": "Dépose du capot" }
]
```

Les côtés sont locaux à l'objet : une rotation les emporte avec lui.
`clearanceZones()` en déduit les volumes réels d'un objet posé — jamais
enregistrés, puisqu'ils sont la fiche et la pose vues ensemble — et
`clearanceConflicts()` dit lesquels se disputent le même volume, avec la
raison.

`PHYSICAL` ne se déclare jamais : un objet occupe ses propres dimensions, et
le lui faire écrire serait lui faire répéter ce qu'il dit déjà. À l'inverse,
une zone que la famille demande et que personne n'a mesurée revient
**inconnue** plutôt qu'absente — « personne ne l'a dit » n'est pas « il n'en
faut pas », et la dessiner à zéro mettrait une machine contre un mur en
déclarant le plan vérifié. Une zone inconnue n'est ni dessinée ni comparée à
quoi que ce soit ; elle est signalée dans les vérifications.

Le plan les montre par groupes — encombrement, entretien et usage, air,
chaleur et feu, travail électrique — parce que toutes les zones de tous les
appareils à la fois font un plan couvert de rectangles que personne ne lit.

**Ce que la géométrie dit et ce qu'elle ne dit pas.** « Ces volumes se
chevauchent, et ces deux natures de volume ne le peuvent pas » est une
constatation géométrique. « C'est interdit » dépend d'un pays et d'une année :
c'est l'affaire d'un Rule Pack, qui sait lesquels. Une géométrie qui trancherait
répondrait pour toutes les juridictions à la fois. Le mètre carré devant une chaudière et celui devant un lave-linge
peuvent être le même : une personne s'y tient, jamais dans les deux à la fois.
Le volume où une machine prend son air et celui où une autre rejette le sien ne
le peuvent pas, quelle que soit la distance entre les deux.

## Les supports

`allowedHosts` était une chaîne libre : `WALL`, `Wall` et `MUR` pouvaient tous
être écrits, et aucun ne correspondait à quoi que ce soit que l'éditeur sache
proposer. La liste est fermée — `WALL`, `SLAB`, `CEILING`, `ROOF`, `SITE`,
`OPENING`, `DISTRIBUTION_BOARD` — et l'éditeur en déduit les supports d'un
niveau plutôt que d'en tenir une seconde liste. Une dalle répond pour deux :
elle est un plancher vue de dessus et un plafond vue de dessous. Un plafond
n'est pas un objet, le terrain non plus — ce qui se pose dessus n'a pas d'hôte.

C'est ce qui a fait réapparaître les toitures complètes : elles étaient
absentes de la liste tenue à la main, si bien qu'une fenêtre de toit pouvait
être dessinée sur une toiture que l'éditeur refusait ensuite de reconnaître.

## La version posée

Une fiche corrigée ne doit pas changer une maison que personne n'a touchée. Un
composant posé enregistre donc `definitionId` **et** `definitionVersion` : ce
n'est pas l'utilisateur qui les saisit, c'est l'application qui note quelle
version il a choisie. `resolvePlacedEquipment()` compare les deux et signale
l'écart au lieu de l'absorber.

## Les matériaux et les assemblages

Le catalogue de matériaux était le dernier des sept registres écrit en
TypeScript : un `const ENTRIES = [...]` de seize entrées, avec un vocabulaire de
propriétés à lui que rien ne comparait au registre. Aucune porte ne l'avait
jamais lu — un coefficient d'absorption de 1,4 là où l'absorption s'arrête à 1,
une masse volumique dans la mauvaise unité, une famille inexistante : rien de
tout cela n'était signalable.

Il vit dans `packages/materials/data/generic.json`, chaque fiche disant sa
famille, sa version et sa provenance. Le fichier parle la langue du **registre
de propriétés** — `thermalConductivity`, `density`, `vaporResistanceFactor` — et
une seule table, dans le chargeur, dit comment chacune s'appelle dans le modèle
(`lambdaWmK`, `densityKgM3`, `mu`). Le modèle garde ses noms parce qu'ils sont
déjà dans tous les fichiers de projet écrits ; les réunir demande une migration
de format, qui est une décision en soi.

`GENERIC` manquait à la liste des provenances de matériau, si bien que le
catalogue générique devait appeler ses propres ordres de grandeur `STANDARD` —
une valeur de dimensionnement portant l'autorité d'une norme, ce que la règle de
traçabilité existe précisément pour empêcher.

Il n'y avait **aucun** catalogue d'assemblages : les sept registres en
annonçaient un, la nomenclature déclarait cinquante-six familles, et rien
n'était livré — les compositions de départ étaient écrites couche par couche
dans l'application, à côté du code qui les dessine. Elles sont dans
`packages/assemblies/data/generic.json`, et la porte vérifie que chaque couche
nomme un matériau qui existe et une épaisseur en mètres : une couche de 140
serait cent quarante mètres de polystyrène, et se lirait comme parfaitement
valide.

### L'absorption acoustique

Ce n'est pas un nombre. Une moquette avale 0,60 à 4 kHz et 0,03 à 125 Hz, et une
valeur unique est soit l'une des huit, soit une moyenne que personne ne peut
retracer. Le registre a donc un sixième type de propriété, `spectrum` : une
valeur par bande d'octave, les bandes prises dans une liste fermée — un
coefficient déposé à 300 Hz est un coefficient qu'aucune norme, aucun calcul et
aucune autre fiche ne pourra jamais aligner.

## Les symboles

Le septième registre était vingt-sept définitions écrites en TypeScript avec
quatre fonctions d'aide pour les tenir courtes. Cela marche à vingt-sept et
s'arrête à trois cents : personne ne lit le fichier, deux personnes ne peuvent
pas l'éditer en même temps, et aucune porte ne peut le lire non plus.

`packages/drawing-engine/data/symbols/generic.json` les porte, chacune avec sa
version et sa provenance : un plan tracé l'an dernier doit se retracer pareil
cette année, et un glyphe copié d'une planche publiée est le dessin de
quelqu'un d'autre. La bibliothèque, elle, porte sa licence — ce qu'on a le droit
de faire de ces dessins n'est la propriété d'aucun d'eux en particulier.

Le constructeur de bibliothèque lève toujours une exception, ce qui est juste
pour une erreur de programmation et inutile pour un fichier de données : un
glyphe à la boîte englobante inversée arrêtait l'application au chargement au
lieu d'apparaître dans le même rapport que tous les autres défauts de catalogue.
`symbolCatalogIssues` fait la seconde chose ; les deux posent les mêmes
questions.

## Les ouvertures

Le modèle portait `Opening.definitionId`, la nomenclature déclarait trente-quatre
familles d'ouverture, les sept registres en annonçaient un — et rien n'était
livré. Le pointeur ne pointait sur rien : le Uw de chaque fenêtre devait être
saisi à la main, ou l'ouverture était comptée comme une inconnue. Pire, il était
résolu contre la bibliothèque d'équipements, où une fenêtre n'est pas un
équipement.

`packages/opening-catalog/data/generic.json` en livre douze : fenêtres, portes,
volets et stores. Une ouverture n'est pas un assemblage et n'en sera jamais un :
sa fiche donne **un** Uw qui couvre le vitrage, le dormant et l'intercalaire
ensemble, et aucune pile de couches ne le reproduit. C'est précisément ce qui
lui vaut un registre à elle.

La porte demande ce Uw à toute famille qui **perce** une paroi, et ne le demande
pas à un volet — un volet est posé sur une ouverture, il n'en est pas une, et
c'est la capability `PIERCING` qui fait la différence plutôt que le nom du
registre.

Le projet porte `openingTypes`, copie des fiches choisies, comme il porte ses
fiches d'équipement et pour la même raison.

## Les cartes de performance

Une machine n'est pas un nombre. Le COP d'une pompe à chaleur vaut 2,0 à
−15 °C et 5,0 à +15 °C, la pression d'un ventilateur dépend du débit qu'on lui
demande, et la puissance d'un compresseur dépend de deux choses à la fois : la
température extérieure et celle du départ.

Une carte v1 tabule cela sur **un ou deux axes**, pas plus. Trois était accepté,
stocké, puis répondu « hors plage » pour toujours, parce que le seul lecteur
refusait tout ce qui n'avait pas exactement un axe : accepter des données que
rien ne sait lire est la façon dont un catalogue se remplit de fiches qui ont
l'air complètes. `CUSTOM` a disparu pour la même raison — rien ne
l'implémentait.

Ce que la porte refuse :

- deux points au même endroit — ce ne sont pas des doublons à tolérer, ce sont
  deux réponses à une question, et celle qui gagne dépend de l'ordre du
  fichier ;
- une grille à deux axes incomplète. Elle se lit comme un rectangle jusqu'au
  trou, puis répond avec un coin qui n'existe pas ;
- une interpolation que les axes ne portent pas — `BILINEAR` sur un seul axe ;
- un axe nommé deux fois, un point non fini, un seul point à interpoler.

Et rien n'est **extrapolé**, sur aucun des deux axes. Un compresseur interrogé
en dessous du dernier point mesuré par le fabricant n'a pas une droite là-bas :
il a une coupure. La réponse est alors `OUT_OF_RANGE`, avec la plage, pour que
l'interface montre la limite au lieu d'un nombre confiant et faux.

Enfin, un axe **nomme une propriété du registre et en porte l'unité**.
`outdoorTemperatureC` dans une fiche et `tempExtC` dans la suivante sont deux
axes différents pour tout ce qui les lit, et aucune tabulation bien formée ne
fera trouver le second à un calcul. Deux courbes écrivaient déjà `m3/h` là où le
registre dit `m³/h` : la même grandeur écrite deux fois, donc deux unités pour
qui compare des chaînes.

## La copie est une copie

Un projet ne pointe pas vers le catalogue : il en emporte une copie. Sinon il
n'ouvrirait pas de la même façon dans deux ans — le catalogue aura bougé, ou ne
sera pas installé du tout.

Et la copie doit être une copie entière. Elle gardait les dimensions, les ports
et les dégagements, et laissait derrière elle trois choses :

- les **courbes de performance**. Une pompe à chaleur n'est pas un nombre : son
  COP vaut 2,0 à −15 °C et 5,0 à +15 °C. Ne garder que la valeur nominale, c'est
  garder la seule valeur que la machine ne délivre presque jamais ;
- le **rendu** : quel symbole la dessine, sur quel dessin, sur quel calque ;
- la **source de chaque chiffre**, une par une. La provenance d'ensemble suffit
  pour une fiche dont les vingt nombres viennent de la même page ; une fiche
  fabricant n'est pas cela — la moitié de ses chiffres sont déclarés, l'autre
  moitié calculés, et c'est toute la différence.

S'y ajoutent les **capabilities** de la famille, pour la même raison que
`allowedHosts` : l'éditeur, les dessins et le quantitatif s'y branchent, et un
fichier qui doit s'ouvrir pareil dans deux ans ne peut pas aller le demander à
une nomenclature qui a bougé.

Un test énumère les champs d'une fiche résolue et échoue sur celui que la copie
laisse tomber, pour que le prochain champ ajouté au catalogue ne s'arrête pas
silencieusement au bord du projet.

## Les catalogues

Le catalogue générique n'est plus une liste TypeScript. Il vit dans
`packages/equipment-catalog/data/equipment/<métier>/*.json`, un dossier par
métier, et chaque fiche nomme la famille dont elle est une entrée :

```
equipment/heating/generic.json      → CIRCULATOR, RADIATOR, HEAT_PUMP_AIR_WATER_MONOBLOC
equipment/plumbing/generic.json     → WASHBASIN, SHOWER, WC, KITCHEN_SINK, ELECTRIC_DHW_TANK
equipment/electrical/generic.json   → SOCKET_16A, MAIN_DISTRIBUTION_BOARD, MCB
…
```

Les produits de réseau ont leur propre catalogue,
`packages/catalog-registry/data/network-products/generic.json` : tubes, câbles,
gaines, conduits de fumée. Ils ne sont pas des équipements — un PER 16×2 est un
produit avec un diamètre, une rugosité et une classe de pression, et il y en a
trois cents ; en faire des « définitions d'équipement » avec ports et
dégagements reviendrait à décrire un tube comme une pompe à chaleur. Et rien de
tout cela n'appartient à `NetworkEdge` : un tronçon est un tracé dans un
bâtiment, le produit est ce dont le tracé est fait, et un projet emploie le même
produit sur quarante tronçons.

Un invariant vérifié à chaque intégration : le diamètre intérieur d'un tube doit
s'accorder avec son diamètre extérieur et son épaisseur de paroi. Les trois
nombres en font un de trop, un catalogue de trois cents tubes contiendra une
faute de frappe, et refuser la fiche coûte moins cher que dimensionner un réseau
sur un tube dont l'alésage est faux de quatre millimètres.

## Ce que la validation refuse

- une famille qui nomme un port, un dégagement, un module, un symbole ou un
  schéma qui n'existe pas ;
- une famille posée dans le bâtiment qui ne dit pas sur quoi elle peut l'être ;
- un schéma de propriétés que personne n'emploie ;
- une propriété qui n'est pas déclarée, ou déclarée dans une autre source ;
- une valeur dérivée écrite parmi les valeurs stockées ;
- une entrée sans provenance, ou un chiffre fabricant sans date ;
- un tube dont l'alésage contredit ses parois ;
- une fiche qui redit le `kind` ou la `category` de sa famille ;
- une famille dont on a modélisé des fiches et qui ne dit pas sa catégorie ;
- une capability lue de ce que la famille déclare et réécrite à la main ;
- une vague hors des six, un cycle de vie inconnu, un remplaçant qui n'existe
  pas ou une famille qui se remplace elle-même ;
- une fiche sans empreinte enregistrée, ou une empreinte que plus aucune fiche
  ne réclame ;
- un fichier de catalogue portant un champ qu'aucun schéma ne déclare ;
- une ouverture qui perce une paroi et ne dit pas sa transmittance ;
- un matériau dont la catégorie contredit celle de sa famille, ou une couche
  d'assemblage nommant un matériau qui n'existe pas, ou une épaisseur écrite en
  millimètres ;
- une courbe de performance dans une famille qui n'en déclare aucune, sur plus
  de deux axes, à la grille trouée, ou dont un axe nomme une propriété
  inconnue ou en donne une autre unité.

Tout cela est vérifié par les tests, donc à chaque intégration continue.

## La porte fermée

Trois trous rendaient la porte moins ferme qu'elle n'en avait l'air.

**Les empreintes ne couvraient que ce que quelqu'un avait pensé à enregistrer.**
Une fiche sans empreinte passait en silence : le mécanisme ne protégeait donc
que les entrées déjà tamponnées, et un catalogue rempli de dix mille nouvelles
fiches aurait été dix mille fiches hors du dispositif. Une fiche non enregistrée
est maintenant refusée, et une empreinte que plus aucune fiche ne réclame aussi
— sinon la prochaine entrée à prendre cet identifiant en hériterait.

**La forme des fichiers n'était vérifiée par rien.** Les propriétés d'une fiche
sont comparées à sa famille depuis longtemps, mais le fichier lui-même
n'obéissait à aucun schéma : un nom de champ mal orthographié était ignoré sans
bruit, et la fiche avait l'air complète en ne portant rien sous ce nom. Les six
fichiers de catalogue ont chacun leur schéma JSON, en
`additionalProperties: false`.

**`TESTS` disait « prouvé » pour dire « écrit ».** L'axe était mis à `VALIDATED`
dès qu'une fiche de la famille passait la porte — ce que `GENERIC_DATA` dit
déjà, la même mesure portant un mot plus fort. Trois cents familles se
déclaraient testées parce que quelqu'un avait écrit une fiche, et rien nulle
part n'en exerçait une. Une famille est testée quand une pièce à conviction de
ce dépôt est faite d'elle : la maison de référence. Le compte est passé de
dix-neuf à quatre, ce qui est la vérité.

## Le manifeste, le dépôt et l'index

Trois choses manquaient pour que « le catalogue » cesse d'être « ce qui se
trouve importé ».

**Le manifeste** (`packages/catalog-registry/data/manifest.json`, engendré par
`npm run catalog:manifest`) dit quels fichiers existent, quel registre chacun
remplit, combien d'entrées il porte et ce qu'il disait à sa publication. Il
porte **deux** niveaux de version, parce qu'elles répondent à deux questions :
`catalogFormatVersion` dit si cette application sait lire les fichiers — elle
change quand la _forme_ change, ce qui est rare et cassant ; `releaseId` dit
quel lot de données c'est — il change dès qu'une fiche est ajoutée, ce qui est
constant et anodin. Les confondre revenait à monter une version cassante pour
une faute de frappe, ou à n'en monter aucune. Le `releaseId` est dérivé des
fichiers, jamais tapé : un numéro qu'il faut penser à monter est un numéro qui
finira par contredire les données qu'il nomme.

**Le dépôt** (`CatalogRepository`) est la question posée une fois : qu'est-ce
qui est installé, qu'est-ce que ça contient, donne-moi cette fiche-là.
Aujourd'hui les fichiers sont empaquetés avec l'application et la réponse coûte
un accès mémoire ; à dix mille fiches elle coûtera un aller-retour réseau. Ce
qui ne doit pas changer ce jour-là, c'est le code qui demande — d'où un `entry`
qui rend une promesse et des `summaries` qui n'en rendent pas : une liste se
dessine maintenant, un corps s'ouvre plus tard.

**L'index** (`CatalogIndex`) porte des **résumés**, pas des fiches. L'interface
demandait des entrées entières pour dessiner une ligne : le nom, la famille et
la version, tirés d'un objet qui porte ses ports, ses dégagements, ses courbes
et chacun de ses chiffres. À dix-neuf fiches cela ne se voit pas ; à dix mille,
c'est la raison pour laquelle le panneau met quatre secondes à s'ouvrir, à
chaque frappe dans la recherche. Cinq tables et un champ replié — accents
ôtés, casse tombée, pour que « fenêtre » trouve `Fenetre`.

## L'échelle, et la maison de qualification

Deux pièces à conviction, parce qu'elles prouvent deux choses différentes.

La **maison de référence** est une maison : elle porte quatre familles, parce
que c'est ce qu'une maison porte, et ce qu'elle prouve c'est qu'elles
fonctionnent ensemble.

La **maison de qualification** est une de chaque. Ce qu'elle prouve est plus
étroit et mérite de l'être : que chaque fiche livrée peut être portée par un
projet que l'importateur accepte. Une fiche qui ne le peut pas est une fiche
dont le seul mode de défaillance se découvre chez un utilisateur, au rouvrir,
des mois plus tard. Elle fait aussi apparaître ce que rien ne montrait :
« personne n'a jamais posé cela dans un projet ».

Enfin, un **catalogue de mesure** — `syntheticSummaries`, `syntheticEntries` —
fabrique mille ou dix mille fiches réparties sur les vraies familles, avec les
propriétés que ces familles déclarent et les ports qu'elles exigent : un
générateur dont la porte ignorerait les fiches mesurerait la vitesse de ne rien
faire. Les chiffres sont dans `docs/PERFORMANCE_BASELINE.md`.

## Catalog Format v1 — la règle de remplissage

L'architecture est figée. À partir d'ici, la règle est courte :

> **Une PR de remplissage de catalogue ne modifie aucun fichier moteur
> `.ts`/`.tsx`.** Elle ajoute des `.json`, elle relance
> `npm run catalog:fingerprints`, elle relance `npm run catalog:manifest`, et
> c'est tout.

Si une fiche ne peut pas être représentée avec les contrats existants, on
n'étend pas le format en passant : on ouvre un **`CONTRACT_GAP`** — un écart
écrit dans [`docs/CONTRACT_GAPS.md`](CONTRACT_GAPS.md), qui dit quelle fiche,
quel registre, quel champ manque et pourquoi les contrats actuels ne suffisent
pas. Le format évolue alors délibérément, avec sa version, plutôt que par
accrétion sous la pression d'une fiche pressée.

Ce qui rend cette règle tenable :

- **l'arborescence est la liste.** Les six registres découvrent leurs fichiers ;
  ajouter `data/equipment/heating/pac-2026.json` suffit à ce qu'il soit chargé,
  validé, manifesté, résumé, indexé et cherchable. Un test l'exige, en écrivant
  un tel fichier et en demandant à la chaîne réelle si elle le trouve ;
- **chaque fichier passe son schéma JSON strict**, en
  `additionalProperties: false` : un nom de champ mal orthographié est refusé,
  pas ignoré ;
- **chaque fiche passe la porte de sa famille** : propriétés, unités, ports,
  dégagements, provenance ;
- **chaque fiche est empreinte**, dans les six registres, sous
  `REGISTRE:identifiant@version` : rien ne change sans changer de version ;
- **le manifeste dit ce qui est installé**, et l'intégration refuse un manifeste
  qui ne décrit plus les données.

## Comment ajouter une famille

1. l'écrire dans `data/families/<domaine>.json` avec ses ports, ses modules, son
   placement, ses dégagements et son schéma de propriétés ;
2. ajouter le schéma dans `data/property-schemas/schemas.json` s'il n'existe pas
   encore ;
3. lancer les tests : ils refusent tout ce qui ne se raccorde à rien ;
4. remplir le catalogue correspondant, chaque fiche déclarant sa provenance ;
5. faire monter les axes de `status` à mesure que le modèle, le symbole, le
   calcul et les tests arrivent.

Rien de ces cinq étapes ne demande de toucher au code de l'application, et
c'est vérifié plutôt qu'espéré : `npm run test:discovery` écrit un fichier de
fiches que rien n'a jamais annoncé, puis demande au chargeur, aux schémas, au
manifeste, aux résumés, à l'index et à la recherche s'ils le trouvent.
