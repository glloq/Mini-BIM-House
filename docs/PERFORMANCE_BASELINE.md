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
