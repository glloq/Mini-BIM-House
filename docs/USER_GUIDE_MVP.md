# Guide utilisateur MVP

## Démarrage rapide

1. Installer Node.js 22 ou ultérieur puis exécuter `npm install`.
2. Démarrer l'application avec `npm run dev` et ouvrir l'adresse indiquée par Vite.
3. Examiner `examples/reference-house/reference.houseproj.json` comme projet complet de référence.
4. Avant de partager une modification, exécuter les contrôles indiqués dans `AGENTS.md`.

L'application crée un projet local vide, importe et valide un fichier projet, affiche son plan et sa synthèse, permet d'ajouter des murs par coordonnées ou par deux clics sur le plan lorsqu'un assemblage existe, avec annulation et rétablissement, puis sauvegarde le JSON canonique ou exporte le plan SVG. Ouvrir la maison de référence permet de parcourir immédiatement un modèle renseigné.

## Concepts essentiels

### Projet et source de vérité

Le fichier projet versionné est la source portable. Il contient les données saisies — géométrie, matériaux, assemblages, équipements et réseaux — mais pas les résultats dérivés. Une sauvegarde locale éventuelle reste un confort et ne remplace pas le fichier exporté.

### Géométrie et unités

La géométrie éditoriale est exprimée en millimètres. Les calculs physiques emploient le SI et les conversions passent explicitement par le package `units`. Une valeur absente reste inconnue : elle n'est jamais remplacée par zéro ou par une valeur dite typique.

### Assemblages et réseaux

Un mur, un plancher ou un toit référence un assemblage ordonné de matériaux. Les réseaux techniques sont des graphes de nœuds, ports et segments ; leur tracé graphique n'est qu'une projection du graphe métier.

### Calculs, règles et vues

Les calculateurs produisent des résultats traçables depuis le modèle. Les règles techniques proviennent de Rule Packs versionnés et sont séparées des formules physiques. Les plans SVG sont reconstruits depuis une scène sémantique et ne deviennent jamais une seconde source de vérité.

## Niveaux de précision

Chaque résultat de calcul annonce l'un des niveaux suivants :

- `ESTIMATE` : estimation basée sur des entrées simplifiées ;
- `ENGINEERING` : méthode technique déterministe avec entrées explicites ;
- `STANDARD` : méthode alignée sur une norme identifiée, avec sa référence et sa version ;
- `REGULATORY` : méthode réglementaire identifiée, uniquement lorsqu'elle a été validée pour le contexte déclaré.

Le niveau décrit la méthode, pas la qualité des entrées et ne constitue pas à lui
seul une preuve de conformité. Les diagnostics, hypothèses, versions, références
et données inconnues doivent être consultés avant toute interprétation.

## Limitations du MVP

- L'interface web propose une première édition de murs, mais pas encore l'ensemble
  des outils du moteur d'édition, des éditeurs de bibliothèques, des contrôles de
  calcul et des overlays techniques.
- Le déploiement GitHub Pages est configuré mais dépend d'une CI réussie sur la branche principale et de l'activation de Pages dans le dépôt.
- Les escaliers et le modeleur détaillé de toiture sont différés.
- Aucun résultat ne revendique une conformité réglementaire implicite ; seuls des Rule Packs identifiés peuvent porter des règles externes.
- Les données de la maison de référence sont démonstratives et ne constituent ni un dimensionnement de chantier, ni une prescription de produit.
- Les exports PDF reposent sur un backend injecté ; le navigateur ne fournit pas encore à lui seul toute la chaîne documentaire finale.

L'architecture détaillée se trouve dans `ARCHITECTURE.md` et l'état précis des fonctionnalités dans `docs/IMPLEMENTATION_STATUS.md`.
