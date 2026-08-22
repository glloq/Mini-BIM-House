# CONTRACT_GAP — ce que les contrats de données ne savent pas encore dire

Le [Catalog Format v1](DATA_REGISTRIES.md#catalog-format-v1--la-règle-de-remplissage)
est gelé. La règle est courte : une PR de remplissage n'ajoute que des `.json`.
Sa contrepartie l'est aussi — quand une fiche ne peut pas être représentée avec
les contrats existants, **on ne rallonge pas le format en passant** : on écrit
ici quelle famille, quel registre, quel champ manque, et pourquoi ce qui existe
ne suffit pas. Le format évolue alors délibérément, avec sa version, plutôt que
par accrétion sous la pression d'une fiche pressée.

Un écart écrit ici n'est pas une dette oubliée : les familles concernées se
mesurent `MISSING` sur l'axe `GENERIC_DATA`, l'interface le dit, et ce document
explique ce que le chiffre veut dire.

## CG-01 — les éléments de structure ne sont pas des empilements

**Registre** `ASSEMBLY` · **13 familles** · vague 1

`STRUCTURAL_COLUMN`, `STRUCTURAL_BEAM`, `LINTEL`, `POST`, `JOIST`, `RAFTER`,
`PURLIN`, `TRUSS`, `STRIP_FOOTING`, `PAD_FOOTING`, `RAFT`, `PILE`,
`GROUND_BEAM`.

Une fiche d'assemblage v1 est faite de `layers` : une suite de matériaux, chacun
avec une épaisseur en mètres, de l'extérieur vers l'intérieur. C'est la bonne
description d'un mur, d'un plancher, d'une toiture — d'une paroi, c'est-à-dire
de tout ce qui a deux faces et une épaisseur entre les deux.

Un poteau n'a pas d'épaisseur, il a une **section**. Le schéma de propriétés
`STRUCTURAL_MEMBER` que ces familles déclarent le dit déjà : `material`,
`section`, `widthMm`, `heightMm`, `diameterMm`, `structuralRole`, `fireRating`.
Aucun de ces champs n'existe dans le fichier d'assemblage, qui n'a pas de
`properties` du tout.

Ce qu'il ne faut surtout pas faire : écrire un poteau comme une couche unique de
béton de 0,20 m. Ce serait accepté par la porte, dessiné par l'interface, et lu
par le calcul thermique comme une paroi de 0,20 m de béton — un mur qui n'existe
pas, avec une surface qui n'existe pas.

**Ce qui manque** : soit un `properties` dans la fiche d'assemblage, avec le
même mécanisme de schéma et d'unités que les autres registres, soit un registre
propre aux éléments linéaires. La première option est plus petite et réutilise
tout ce qui existe ; la seconde dit plus honnêtement qu'un poteau et un mur ne
sont pas la même sorte d'objet. C'est une décision de format, pas de fiche.

## CG-02 — les points singuliers de toiture ne sont pas des parois

**Registre** `ASSEMBLY` · **10 familles** · vague 2

`RIDGE`, `HIP`, `VALLEY`, `EAVE`, `VERGE`, `FLASHING`, `ROOF_WINDOW`,
`SKYLIGHT`, `CHIMNEY_OPENING`, `VENT_OUTLET`.

Même cause, autre géométrie. Le schéma `ROOF_PART` déclare `lengthMm` (dérivé du
contour de la toiture), `material` et `costPerM` : ce sont des **linéaires**, pas
des empilements. Un faîtage se compte en mètres et se chiffre au mètre ; il n'a
ni face intérieure, ni face extérieure, ni résistance thermique de paroi.

Les familles portent déjà l'indication : « déduit du contour de la toiture pour
les lignes ; les accessoires restent à modéliser ». Ce qui reste à modéliser,
c'est exactement ce que ce format ne sait pas porter.

**Ce qui manque** : la même chose que CG-01 — un porteur de propriétés dans la
fiche — plus une décision sur `ROOF_WINDOW` et `SKYLIGHT`, qui sont
vraisemblablement des **ouvertures** rangées dans le registre des assemblages :
une fenêtre de toit a un Uw, un facteur solaire et un vantail, c'est-à-dire le
contrat `OPENING`, pas celui d'une paroi.

## CG-04 — le vocabulaire des catégories d'équipement est trop court

**Registre** `EQUIPMENT` · **plus de deux cents familles** · toutes vagues

Le mobilier d'abord — `BED`, `SOFA`, `CHAIR`, `TABLE`, `DESK`, `WARDROBE`,
`CABINET`, `KITCHEN_CABINET`, `WORKTOP`, `SHELF` — puis, en vague 2, presque
toute la plomberie de distribution et l'évacuation : robinetterie, raccords,
filtration, regards, chutes, gouttières, bassins.

Les fiches existent, passent la porte et se posent. Ce qui manque est plus
petit : `EQUIPMENT_CATEGORIES` est une liste fermée de vingt valeurs — pompe à
chaleur, radiateur, ballon, luminaire, prise, appareil sanitaire… — et aucune ne
dit « mobilier », « robinetterie », « raccord » ni « ouvrage d'assainissement ».
Ces familles portent donc `OTHER`, ce qui est exact et peu utile : l'index par
catégorie ne sait pas répondre « montre-moi le mobilier », ni « montre-moi les
vannes ».

Les vagues 3 à 6 l'ont confirmé et chiffré : 58 des 79 familles de fumée, de
données, de sécurité et de site n'ont aucune valeur honnête à prendre, ni 32
des 68 familles électriques — il manque un **dispositif de mise à la terre**
(9 familles), un **appareillage de commande mural** (7 interrupteurs), un
**cheminement de câbles** (6), un **appareil électroménager** (9), un
**conduit de fumée**, un **réseau de données**, un **équipement de sécurité**,
un **aménagement extérieur**. Aucun agent n'a inventé de valeur. Deux choix
faits faute de mieux sont à retrancher le jour où la liste s'allonge :
contacteur, télérupteur, minuterie et délesteur sont rangés en
`PROTECTION_DEVICE` alors que ce sont des appareils de **commande** ; les
compteurs sont en `SENSOR`.

Cette liste est une énumération TypeScript, pas une donnée. L'allonger est une
modification du format, ce qu'une PR de remplissage ne fait pas — d'où cette
ligne plutôt qu'une valeur ajoutée en passant. Le jour où le format bouge,
`FURNITURE`, `VALVE`, `FITTING`, `DRAINAGE` et `RAINWATER_DEVICE` sont les
valeurs à ajouter, et ces familles les prendront.

Le mobilier n'a pas non plus de symbole de plan, et cela n'est pas un écart de
contrat : l'axe `PLAN_SYMBOL` le mesure déjà à `NONE`, ce qui est la bonne
réponse tant que personne n'a dessiné de symbole de lit.

## CG-05 — le vocabulaire des ports ignore trois médias entiers

**Registres** `EQUIPMENT` · vagues 4 et 5

Trois choses qu'une maison contient ne peuvent pas être dites :

- **un combustible.** Ni gaz, ni fioul, ni granulés : les trois chaudières
  génériques ne peuvent pas déclarer par où arrive ce qu'elles brûlent. Elles
  disent leurs fumées, leur air comburant, leur électricité, leurs condensats —
  et pas le combustible, qui est pourtant la raison d'être de l'appareil ;
- **l'eau glacée.** Une batterie froide à eau est inexprimable ; celle du
  catalogue est en détente directe, ce qui est un choix de produit imposé par
  le format et non par le concepteur ;
- **le sens du courant, hors photovoltaïque.** `PV_DC` a son `PV_DC_INPUT` ;
  `ELECTRICAL_AC` et `BATTERY_DC` n'ont pas d'équivalent et sont
  `BIDIRECTIONAL`. Un appareil en ligne côté alternatif ou batterie — un
  sectionneur, un compteur, une coupure d'urgence — ne peut donc se décrire
  que par « deux fois le même port », avec un compte, là où l'évacuation et la
  ventilation disent proprement une entrée et une sortie.

## CG-06 — des schémas de propriétés qui ne décrivent pas leurs familles

**Registre** `EQUIPMENT` · **une quarantaine de familles** · vagues 3 à 6

Chaque famille nomme un schéma de propriétés, et la porte vérifie qu'une fiche
ne déclare que ce que ce schéma connaît. Quand le schéma ne connaît rien
d'applicable, la fiche est **vide et honnête** plutôt que fausse — ce qui est le
bon comportement, et un mauvais résultat :

- **`BATTERY_DEVICE`** : `BMS`, `ATS`, `BACKUP_GATEWAY`, `BATTERY_BREAKER`,
  `BATTERY_ISOLATOR`, `BATTERY_FUSE` ont `properties: {}`. Le schéma n'a ni
  tension nominale ni capacité en ampères-heures, donc une cellule ne peut même
  pas dire « 3,2 V / 100 Ah » ;
- **`ELECTRICAL_ACCESSORY`** : hors dimensions, coût et carbone, le schéma est
  vide. Pas de charge admissible pour un chemin de câbles, pas d'indice de
  protection ni de nombre d'entrées pour une boîte ;
- **`PV_DEVICE`** sert d'appareillage et de quincaillerie : ni courant assigné,
  ni pouvoir de coupure, ni niveau de protection pour un parafoudre ; ni charge
  admissible, ni matériau, ni longueur pour un rail ou un crochet ;
- **`HEATING_DEVICE`** ne sait dire ni un volume ni une pression : un ballon
  tampon ne peut pas déclarer ses 200 L, une soupape son tarage à 3 bar. Les
  propriétés existent au registre (`tankVolumeL`, `capacityL`,
  `maxPressureBar`), elles ne sont simplement pas listées dans ce schéma ;
- **`ELECTRICAL_BOARD`** n'a pas de calibre : l'AGCP et le disjoncteur de
  branchement ne peuvent pas dire 30, 45 ou 60 A, qui est _la_ donnée de
  dimensionnement d'un branchement ;
- **`FLUE_COMPONENT`** ne sait pas dire la longueur d'un élément de conduit ;
  elle a été rangée dans `dimensions.heightMm`, faute de propriété ;
- **`LUMINAIRE` imposé à ce qui n'éclaire pas** : le capteur de présence, le
  capteur de luminosité et le contrôleur d'éclairage nomment ce schéma, qui
  exige un flux lumineux. La fiche déclare `luminousFluxLm: 0` — vrai, et
  dénué de sens ;
- **`UNDERFLOOR_HEATING` pour quatre familles qu'il ne décrit pas** :
  `UFH_ACTUATOR`, `ROOM_THERMOSTAT` et `HEATING_ZONE` héritent d'un schéma qui
  parle d'un circuit de tubes.

Le remède n'est pas d'élargir un schéma pour y faire entrer ce qui n'en relève
pas : c'est d'en déclarer d'autres. Un schéma est une donnée, l'opération est
donc data-only — mais elle demande d'être décidée, pas faite en passant.

## CG-07 — `PHYSICAL` est une déclaration morte

**Nomenclature** · **396 familles sur 527**

396 familles déclarent la zone de dégagement `PHYSICAL`, et la porte refuse
systématiquement qu'une fiche la renseigne : « le volume qu'une chose occupe,
ce sont ses dimensions, et elle les a déjà dites ». Les deux règles sont
défendables ; ensemble, elles font que 396 familles annoncent une zone que rien
ne peut remplir. Trois agents sur quatre l'ont signalée indépendamment.

Il faut trancher dans un sens ou dans l'autre : soit la nomenclature cesse de
nommer `PHYSICAL`, soit la porte l'accepte comme la déclaration explicite d'un
encombrement distinct des dimensions hors-tout. Tant que les deux coexistent,
un lecteur de la nomenclature croit lire une information.

Corollaire relevé au passage : plusieurs familles n'ont **que** `PHYSICAL` et
ne peuvent donc déclarer aucun dégagement. Une trappe de ramonage, dont la
fonction unique est d'être ouverte, n'a pas le droit de dire l'accès qu'elle
demande ; une barrette de coupure de terre non plus.

## CG-08 — vingt familles décrivent le même objet depuis deux métiers

**Nomenclature** · **une vingtaine de paires**

`SAFETY_CO2_DETECTOR` et `CO2_SENSOR`, `SAFETY_MOTION_DETECTOR` et
`MOTION_SENSOR`, `DOOR_CONTACT` et `WINDOW_SENSOR`, `SITE_EXTERIOR_LIGHT` et
`EXTERIOR_LIGHT`, `SITE_EXTERIOR_SOCKET` et `EXTERIOR_SOCKET`,
`SAFETY_EMERGENCY_LIGHT` et `EMERGENCY_LIGHT`, `SITE_EARTH_ROD` et `EARTH_ROD`,
`UTILITY_METER` et `SERVICE_METER`, la fosse toutes eaux du site et celle de
l'assainissement, la pompe à chaleur extérieure du site et celle du chauffage…

C'était invisible tant que personne n'avait écrit de fiche : deux familles
vides ne se ressemblent pas. Maintenant chacune en a une, et elles se
retrouvent côte à côte dans la même liste — trois paires portaient jusqu'au
même nom, ce qui donnait au projet deux objets d'identifiant identique. Les
noms ont été distingués et un test refuse la paire suivante ; la fusion des
familles reste à décider.

Un cas plus lourd du même genre : **le conduit de fumée existe dans deux
registres**. Les sections de conduit sont des équipements d'un mètre, alors que
`FLUE_PIPE` est déjà une famille `NETWORK_PRODUCT` avec ses entrées. Un métré
compterait deux fois le même mètre linéaire. Un tronçon devrait être un produit
de réseau ; un coude, un té, une souche restent des équipements.

## CG-03 — la nomenclature des matériaux n'avait pas de couverture

**Registre** `MATERIAL` · **résolu**

Les vagues 1 et 2 demandent des toitures, et aucune famille de matériau ne
décrivait une tuile, une ardoise, un bac métallique, un bardeau, une chape ou un
substrat de végétalisation : les compositions de toiture s'arrêtaient à
l'isolant.

Ce n'était pas un écart de format mais un trou de nomenclature, et une
nomenclature est une donnée : sept familles ont été déclarées et remplies —
`TILE_CLAY`, `TILE_CONCRETE`, `SLATE`, `METAL_ROOFING`, `BITUMEN_SHINGLE`,
`SCREED`, `GREEN_ROOF_SUBSTRATE`. Écrit ici pour que la distinction reste
visible : ajouter une famille est une opération de données, étendre le format
n'en est pas une.
