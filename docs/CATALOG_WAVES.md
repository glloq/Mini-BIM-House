# Les vagues de remplissage

La nomenclature range ses 527 familles en six vagues. Une vague n'est pas une
priorité de confort : c'est l'ordre dans lequel une maison se décrit. On ne
dessine pas un réseau avant d'avoir des murs, et on ne calcule pas un
dimensionnement avant d'avoir des appareils.

| Vague | Ce qu'elle contient                                           |
| ----- | ------------------------------------------------------------- |
| 1     | matériaux, compositions, menuiseries, mobilier                |
| 2     | eau, évacuation, eaux pluviales, points singuliers de toiture |
| 3     | chauffage et production                                       |
| 4     | électricité                                                   |
| 5     | ventilation, solaire, stockage                                |
| 6     | conduits de fumée, données, sécurité                          |

L'état réel se lit, il ne s'écrit pas :

```
npm run catalog:status          # toutes les vagues, une ligne chacune
npm run catalog:status -- 3     # une seule vague, famille par famille
```

## Ce que les vagues 1 et 2 ont montré

Les deux premières vagues sont faites. 238 familles sur 261 ont au moins une
fiche générique ; les 23 restantes sont les écarts de contrat `CG-01` et `CG-02`
de [`CONTRACT_GAPS.md`](CONTRACT_GAPS.md), qu'on n'a pas voulu remplir de force.

L'arrivée massive de données n'a rien cassé — 1 896 tests unitaires, 96 tests
navigateur, six registres validés, deux cent trois fiches nouvelles — mais elle
a rendu visibles six choses qu'aucune relecture n'aurait trouvées, parce
qu'elles étaient toutes vraies tant que les catalogues étaient petits.

**1. Les comptages littéraux.** Une quinzaine de tests écrivaient un nombre —
`19 + 16 + 12 + 7 + 66 + 27`, `520`, `toHaveLength(7)` — à l'endroit précis
qu'une PR de remplissage ne doit pas avoir à toucher. La propriété à vérifier
n'était jamais le nombre : c'est « une ligne par fiche, et aucune fiche sans
ligne ». Tous sont maintenant lus dans les données. Sans cela, le gel du format
v1 aurait été faux dès la première vague.

**2. Les exigences de port écrites par lot.** Vingt-trois familles d'évacuation
déclaraient la même liste, vingt familles pluviales aussi, et un coude d'eau
exigeait le froid _et_ le chaud. Un port déclaré par son seul nom vaut
« exactement un, obligatoire » : aucune fiche honnête ne pouvait satisfaire
cela. Les familles distinguent maintenant ce qu'un objet a toujours
(`ports`), ce que certaines variantes ont (`optionalPorts`) et ce dont il a
l'un d'un ensemble (`{ anyOf, minCount, maxCount }`). Les arrivées et les
départs se distinguent enfin : `WASTEWATER_INLET` en face de `WASTEWATER`
existait depuis le début et rien ne s'en servait.

**3. Une porte qui se trompait de forme.** `CatalogSummary.valid` porte la
réponse de la porte pour que le navigateur n'ait jamais à tenir une fiche pour
en compter une. Elle interrogeait la porte sur la fiche _résolue_, qui porte la
catégorie de sa famille — or une fiche qui redit la catégorie de sa famille est
exactement ce que la porte refuse. Les 122 fiches d'équipement se déclaraient
donc invalides, et chaque famille d'équipement s'affichait `PARTIAL` pendant que
`validate:catalog` disait le catalogue propre. Un test le refuse maintenant.

**4. Un état mesuré sur un registre au lieu de six.** `catalog:status`
mesurait `GENERIC_DATA` à partir du seul catalogue d'équipement : cinquante-neuf
matériaux, trente-quatre menuiseries et trente-cinq compositions existaient et
leurs familles lisaient toutes « personne n'a écrit de fiche ».

**5. Des suppositions vraies par accident.** « Toute fiche a au moins un port »
— un lit n'en a aucun. « Toute famille pourvue a un symbole de plan » — non,
chaque axe mesure une chose. « `assemblies[0]` est un mur » — vrai seulement
parce que le catalogue commençait par un ; le moteur, lui, a eu raison tout du
long en refusant un mur qui porte une composition de plafond. « Chercher
_pompe_ rend la pompe à chaleur » — à dix-neuf fiches, oui.

**6. Le poids.** Le chargement initial a pris six kio : pas les fiches, qui
sont dans le navigateur de catalogue chargé à la demande, mais la nomenclature,
que l'éditeur tient parce que l'inspecteur, les parcours et les contrôles lui
demandent tous ce qu'est une famille. La nomenclature est complète ; les vagues
suivantes ajoutent des fiches, et les fiches ne pèsent pas là.

Aucun de ces six points n'est un défaut d'architecture. Ce sont des contrats
qui n'avaient jamais été exercés — ce qui est précisément ce qu'une première
vague de données sert à découvrir.

## Ce que les vagues 3 à 6 ont montré

Les six vagues sont faites. **504 familles sur 527 ont une fiche générique** ;
les 23 restantes sont `CG-01` et `CG-02`. Quatre agents ont travaillé en
parallèle, chacun sur ses propres fichiers de données, et déposé leurs
corrections de nomenclature dans des fichiers de correctifs fusionnés en série
— la nomenclature est le fichier partagé, et quatre écritures concurrentes
dessus se seraient écrasées.

**Le constat de la vague 2 s'est répété, partout.** Les listes de ports avaient
été écrites par lot, un lot par schéma de propriétés, et tout y était
obligatoire :

| Domaine     | Familles corrigées |
| ----------- | ------------------ |
| ventilation | 21 sur 21          |
| fumée       | 22 sur 22          |
| données     | 26 sur 26          |
| sécurité    | 13 sur 13          |
| solaire     | 17 sur 17          |
| électricité | 52 sur 68          |
| chauffage   | 35 sur 45          |

Ce que cela donnait : un coude de ventilation devait être à la fois soufflage,
extraction, air neuf et rejet ; les 22 familles de fumée avaient deux sorties
et aucune entrée, donc **rien ne pouvait se chaîner** — un conduit de cheminée
était indescriptible ; un crochet de toiture était raccordé au réseau ; un
extincteur demandait du 230 V ; une prise avait un bus de commande et pas de
terre ; un capteur exigeait le bus **et** la radio ; un convecteur électrique
réclamait un départ et un retour d'eau. Toutes ces familles disent maintenant
ce qu'un tel objet a toujours, ce que certaines variantes ont, et ce dont il a
l'un d'un ensemble.

**Un objet dont personne ne pouvait se servir.** La bouche d'extraction
déclarait `AIR_EXTRACT`, de sens _entrant_, comme le caisson auquel elle est
censée se raccorder : deux ports entrants ne s'apparient pas. Elle passe en
`AIR_EXTRACT_OUTLET`, version 1.2.0 — le contenu change, la version aussi.

**Trois fiches portaient le même nom qu'une autre**, et l'identifiant d'un
objet posé se déduit de son nom : le projet refusait le second. C'est `CG-08`,
vu de près. Les noms sont distingués, un test refuse la paire suivante.

**Le poids, encore, et la bonne nouvelle.** 240 fiches et 17 produits de réseau
de plus : le total produit prend 24 kio, et le chargement initial **moins d'un
kio**. C'est exactement ce que la séparation devait donner, et la raison pour
laquelle ce budget se compte en deux nombres et non en un.

Huit écarts de contrat sont écrits dans [`CONTRACT_GAPS.md`](CONTRACT_GAPS.md)
plutôt que contournés — dont trois nouveaux qui pèsent : le vocabulaire des
ports ignore le combustible et l'eau glacée (`CG-05`), une quarantaine de
familles ont un schéma de propriétés qui ne les décrit pas (`CG-06`), et
`PHYSICAL` est déclaré par 396 familles alors que la porte le refuse
systématiquement (`CG-07`).

## Remplir une vague

1. lister ce qui manque : `npm run catalog:status -- <vague>` ;
2. écrire les `.json`, un fichier par famille de fiches, sous le `data/` du
   registre concerné ;
3. `npm run validate:schemas` puis `npm run validate:catalog` ;
4. `npm run catalog:fingerprints` puis `npm run catalog:manifest` ;
5. `npx vitest run`.

Aucune de ces cinq étapes ne demande de toucher au code de l'application. Si une
fiche ne peut pas être représentée, l'étape à faire n'est pas d'étendre le
format : c'est d'écrire un `CONTRACT_GAP`.
