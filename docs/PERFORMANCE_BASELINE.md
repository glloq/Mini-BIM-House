# Baseline de performance — PR-070

## Périmètre

La baseline couvre les cinq charges définies par la spécification 40 :

- validation géométrique de 100 chemins de murs ;
- rendu SVG de 1 000 primitives sémantiques ;
- recherche des composantes d'un réseau de 500 segments ;
- simulation annuelle horaire d'une batterie (8 760 pas) ;
- agrégation thermique complète de 100 éléments.

Lancer la mesure avec `npm run benchmark`. Vitest effectue l'échauffement et
publie latence, dispersion et débit. Les résultats dépendent de la machine : ils
servent de point de comparaison, pas de seuil CI absolu. Un seuil ne devra être
ajouté qu'après collecte sur l'environnement CI afin d'éviter les tests instables.

## Garanties de la fixture

Les entrées sont construites une fois hors de la boucle mesurée. Chaque benchmark
appelle une API publique de production, sans I/O, réseau HTTP ni valeur aléatoire.
La baseline ne persiste aucun résultat dérivé dans un projet.

## Mesure de référence

Première mesure consignée, obtenue avec `npm run benchmark` sur un conteneur
d'intégration. Elle est reproductible mais pas portable : une machine différente
donnera d'autres chiffres, et c'est l'ordre de grandeur — et surtout son
évolution d'une version à l'autre — qui fait foi.

### Environnement

| Élément    | Valeur                               |
| ---------- | ------------------------------------ |
| Commit     | `0393a53`                            |
| Date       | 2026-08-19                           |
| Processeur | Intel(R) Xeon(R) @ 2.10 GHz, 4 cœurs |
| Mémoire    | 15 Gio                               |
| Système    | Linux 6.18.5-fc-v20                  |
| Node.js    | v22.22.2                             |
| Vitest     | 3.2.7                                |

### Résultats

| Benchmark                                 | Latence moyenne |        Débit | Dispersion (rme) | Échantillons |
| ----------------------------------------- | --------------: | -----------: | ---------------: | -----------: |
| Validation de 100 chemins de murs         |       0,0031 ms | 318 523 op/s |          ±0,59 % |       31 853 |
| Rendu SVG de 1 000 primitives sémantiques |        1,897 ms |     527 op/s |          ±5,40 % |           53 |
| Composantes d'un réseau de 500 segments   |        0,465 ms |   2 149 op/s |          ±5,52 % |          215 |
| Batterie, une année au pas horaire        |        8,399 ms |     119 op/s |         ±22,60 % |           12 |
| Agrégation thermique de 100 éléments      |       0,0494 ms |  20 227 op/s |          ±2,86 % |        2 023 |

### Le catalogue à l'échelle

Tout ce dépôt se mesure contre dix-neuf fiches, seize matériaux et
soixante-six tubes. Les décisions qui comptent — un résumé plutôt qu'une fiche,
un index plutôt qu'un parcours, un dépôt capable d'aller chercher plus tard —
sont des décisions sur dix mille, et une conception défendue seulement à cent
est une conception dont personne n'a éprouvé l'argument.

`syntheticSummaries` fabrique un catalogue de la taille visée, déterministe :
le même nombre donne le même catalogue, pour qu'une mesure compare deux
versions du code et non deux tirages.

| Benchmark                                  | Latence moyenne |           Débit |
| ------------------------------------------ | --------------: | --------------: |
| Indexer 1 000 résumés                      |         3,66 ms |        273 op/s |
| Indexer 10 000 résumés                     |        44,48 ms |       22,5 op/s |
| Rechercher un mot parmi 10 000             |         1,34 ms |        748 op/s |
| Filtrer 10 000 par métier et capability    |         0,35 ms |      2 895 op/s |
| Retrouver une référence parmi 10 000       |      0,00009 ms | 11 649 404 op/s |
| Valider 1 000 fiches contre leurs familles |         2,57 ms |        389 op/s |

Dix mille fiches s'arrangent en quarante-cinq millisecondes, une fois, au
chargement ; une frappe dans la recherche coûte ensuite 1,3 ms et un filtre
0,35 ms. La porte lit mille fiches en 2,6 ms, donc les dix mille du jour où le
catalogue sera plein en vingt-six. Rien de tout cela n'est un seuil
d'intégration — les machines diffèrent — mais le banc tourne à chaque
intégration, et il tombera bruyamment le jour où indexer dix mille fiches
cessera de finir.

### Lecture

Les quatre charges liées à une interaction — validation géométrique, rendu,
parcours de réseau, agrégation thermique — restent sous les 2 ms. Un plan
complet peut donc être revalidé et redessiné entre deux images sans travail
d'arrière-plan : le rendu de 1 000 primitives, la charge la plus lourde des
quatre, tient dans un cadre à 60 Hz avec de la marge.

La simulation annuelle de batterie est d'un autre ordre : 8,4 ms pour 8 760 pas,
soit environ 1 µs par pas. Elle reste acceptable pour un calcul déclenché
explicitement, mais c'est la seule charge qu'il faudra sortir du fil principal si
elle devient continue — et sa dispersion (±22,6 %, 12 échantillons) montre
qu'elle est assez longue pour subir le ramasse-miettes. Les chiffres des autres
lignes, mesurés sur des milliers d'échantillons, sont nettement plus stables.

Aucun seuil n'est appliqué en intégration continue : ces valeurs sont un point de
comparaison, et un seuil calibré sur cette machine produirait des échecs
instables ailleurs.

## La maison qu'on ne peut plus appeler petite

La baseline ci-dessus mesure des charges synthétiques : cent chemins, mille
primitives, cinq cents segments. Ce qu'elle ne mesurait pas, c'est un bâtiment.
La maison de référence a six murs et trois pièces, et ce que coûte la vue en
plan sur six murs ne dit rien de ce qu'elle coûte sur six cents — or la vue en
plan est reconstruite à chaque mouvement du curseur.

`largeHouse(3, 40)` produit trois niveaux de quarante pièces, soit 240 murs et
120 pièces : la taille d'un grand logement ou d'un petit collectif. Elle est
dérivée et non stockée, donc elle ne peut pas dériver du domaine qu'elle est
censée éprouver, et un test vérifie qu'elle reste un projet que le lecteur
accepte.

| Benchmark                                   | Latence moyenne |      Débit | Dispersion (rme) | Échantillons |
| ------------------------------------------- | --------------: | ---------: | ---------------: | -----------: |
| Vue en plan d'un niveau de la grande maison |        2,114 ms |   473 op/s |          ±3,27 % |          237 |
| Vue en plan de la maison de référence       |        0,204 ms | 4 906 op/s |          ±3,49 % |        2 453 |
| Vérifications sur toute la grande maison    |        7,649 ms |   131 op/s |          ±5,34 % |           66 |

### Lecture

Un niveau de quarante pièces se redessine en 2,1 ms : dix fois la maison de
référence pour quarante fois les objets, ce qui veut dire que le coût suit le
nombre d'objets et non pire. Le budget d'une image à 60 Hz est de 16,7 ms, donc
le plan se reconstruit entre deux images avec de la marge, sans travail
d'arrière-plan et sans cache.

Les vérifications sur les trois niveaux tiennent en 7,6 ms. Elles ne sont pas
sur le chemin du dessin — elles s'exécutent quand on ouvre l'onglet — mais elles
reconstruisent une vue en plan par niveau, ce qui est ce qu'elles coûtent.
