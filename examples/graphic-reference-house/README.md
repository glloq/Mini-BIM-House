# Maison de référence graphique

La fixture sur laquelle le moteur graphique est jugé.

La maison de référence principale (`examples/reference-house/`) est un
rectangle de dix mètres sur huit avec quatre pièces : elle prouve qu'un plan
peut être produit, et elle ne dit rien de sa lisibilité. Un moteur graphique se
juge sur ce qu'un rectangle n'a pas.

Celle-ci a donc :

| Ce qu'elle porte                     | Ce que cela met à l'épreuve                          |
| ------------------------------------ | ---------------------------------------------------- |
| Trois chambres, séjour/cuisine        | des aplats de pièce distincts selon l'usage           |
| WC de 1,7 m², dégagement de 11 m²     | un texte qui tient dans sa pièce, ou qui ne s'écrit pas |
| Cellier, bureau, garage               | des catégories que le BIM nomme librement             |
| Quatorze murs, cinq sortes de jonction | L, T, croix, angles, deux épaisseurs                  |
| Baie, porte-fenêtre, porte de garage  | une famille de menuiserie, un dessin                  |
| Coulissante de service                | une porte qui ne balaie rien                          |
| Portes intérieures à sens choisi      | le gond et le côté, énoncés par rapport au mur        |
| Baignoire, douche, lavabo, WC, évier  | des emprises réelles, pas des carrés identiques       |
| Lave-linge, lave-vaisselle, plaque    | l'électroménager d'une maison habitée                 |
| Ballon ECS, VMC, tableau, poêle       | la machinerie, au trait secondaire                    |

C'est une fixture et non un projet d'architecte : personne n'a à vouloir y
habiter. Ce qu'elle doit être, c'est un plan qui montre ce que la charte est
censée faire.

## Régénérer

```sh
npm run reference:graphic
```

Le fichier est construit à partir de la maison de référence principale — dont
il reprend le terrain, les matériaux, les assemblages et les réglages de
calcul — et de fiches prises dans les catalogues par leurs constructeurs
habituels (`equipmentSnapshot`, `projectOpeningFromCatalog`). Aucune valeur
technique n'est réécrite à la main.

## Captures

`apps/web/src/graphic-reference-plan.test.ts` produit cinq feuilles sous
`apps/web/src/__snapshots__/` :

```text
graphic-reference-architectural-1-50.svg
graphic-reference-architectural-1-100.svg
graphic-reference-technical-1-50.svg
graphic-reference-materials-1-50.svg
graphic-reference-architectural-print-1-50.svg
```

Des SVG et non des PNG, pour la raison déjà énoncée dans
`apps/web/src/plan-regression.test.ts` : une comparaison de pixels sur trois
moteurs de rendu répond à une autre question, et y répond différemment sur
chaque machine. La différence se lit ici comme un diff — une porte qui perd son
arc, une étiquette qui se déplace, un mur redevenu noir se voient à la ligne
près. Le même fichier vérifie en plus, critère par critère, ce que ces captures
sont censées satisfaire.
