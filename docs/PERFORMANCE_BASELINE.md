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
