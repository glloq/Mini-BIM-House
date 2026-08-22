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

## CG-04 — le mobilier n'a pas de catégorie d'équipement

**Registre** `EQUIPMENT` · **10 familles** · vague 1

`BED`, `SOFA`, `CHAIR`, `TABLE`, `DESK`, `WARDROBE`, `CABINET`,
`KITCHEN_CABINET`, `WORKTOP`, `SHELF`.

Les dix fiches existent, passent la porte et se posent. Ce qui manque est plus
petit : `EQUIPMENT_CATEGORIES` est une liste fermée de vingt valeurs — pompe à
chaleur, radiateur, ballon, luminaire, prise, appareil sanitaire… — et aucune ne
dit « mobilier ». Les dix familles portent donc `OTHER`, ce qui est exact et peu
utile : l'index par catégorie ne sait pas répondre « montre-moi le mobilier ».

Cette liste est une énumération TypeScript, pas une donnée. L'allonger est une
modification du format, ce qu'une PR de remplissage ne fait pas — d'où cette
ligne plutôt qu'une valeur ajoutée en passant. Le jour où le format bouge,
`FURNITURE` est la valeur à ajouter, et les dix familles la prendront.

Le mobilier n'a pas non plus de symbole de plan, et cela n'est pas un écart de
contrat : l'axe `PLAN_SYMBOL` le mesure déjà à `NONE`, ce qui est la bonne
réponse tant que personne n'a dessiné de symbole de lit.

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
