# Maison de référence

`reference.houseproj.json` est le projet complet sur lequel s'appuie tout le
reste : la maison de démonstration de l'application, le scénario d'intégration
des calculs, et la référence de dessin du plan.

Elle est volontairement exhaustive, parce qu'une fixture qui ne couvre pas une
famille laisse passer toutes les suites qui s'appuient dessus — elles
continuent de réussir en n'ayant rien à vérifier. Elle décrit donc :

- **deux niveaux** de 80 m² reliés par un escalier, une enveloppe isolée, des
  ouvertures, des dalles et une toiture posée sur le niveau qu'elle couvre ;
- **cinq compositions et onze matériaux venus du catalogue** — mur de parpaing
  isolé par l'extérieur, cloison sur ossature, dalle sur terre-plein, plancher
  intermédiaire bois, rampant isolé — et non plus deux matériaux et trois
  compositions écrits pour ce fichier seul : la thermique, les métrés et le
  dessin des couches tournent sur ce que l'application livre ;
- **un terrain** avec ses limites, un arbre et une maison voisine, tous deux de
  hauteur connue, donc capables de porter une ombre ;
- **trente et un objets posés** tirés du catalogue — pompe à chaleur, ballon
  tampon, circulateur, cinq radiateurs, groupe de ventilation double flux,
  ballon d'eau chaude, cinq appareils sanitaires, tableau, disjoncteur, prises,
  luminaires, champ photovoltaïque, onduleur, batterie — chacun posé quelque
  part et non seulement catalogué : trois radiateurs et un seul ne sont pas la
  même maison ;
- **dix-neuf fiches d'équipement et trois fiches de menuiserie** venues du
  catalogue installé, avec leur `familyId`, leur version, leurs ports, leurs
  dégagements et leur provenance : la maison de référence est faite de ce que
  l'utilisateur peut choisir, et non de valeurs écrites pour elle seule — un
  test l'exige, fiche par fiche ;
- **quatre réseaux** qui montent à l'étage : eau, évacuation, ventilation,
  électricité, chacun connecté port à port, et **chaque tronçon nomme le
  produit dont il est fait** ;
- **une copie des produits réseau dans le projet** (`networkProducts`) : le
  fichier doit s'ouvrir de la même façon dans deux ans, et relire le catalogue
  installé redimensionnerait tous les réseaux déjà dessinés le jour où
  quelqu'un corrige un tube ;
- **un dossier de plans** portant les cinq sortes de vue — plan de niveau,
  coupe avec sa ligne, façade avec sa direction, plan de toiture, plan de masse
  — et une feuille A1 qui en dispose quatre ;
- **les réglages des dix-sept modules de calcul**, complets : aucune entrée
  manquante n'est rapportée sur cette maison, et un test l'exige.

Les valeurs techniques sont des données de démonstration sourcées comme telles.
Elles ne constituent ni des valeurs réglementaires, ni un dimensionnement de
chantier, et les prix ne proviennent d'aucun fournisseur. Les résultats calculés
ne sont jamais enregistrés dans le projet.

Le test d'intégration charge et valide le fichier, vérifie qu'il tient toujours
un exemplaire de chaque chose dont une maison est faite — deux niveaux, un
escalier, une toiture, un terrain, des objets posés sur les deux niveaux, quatre
réseaux qui montent à l'étage, les cinq sortes de vue — et que chaque
équipement vient bien du catalogue. Il exécute ensuite les dix-sept adaptateurs
de calcul, contrôle la conservation énergétique, sauvegarde puis recharge le
projet, et exporte un plan SVG sémantique.
