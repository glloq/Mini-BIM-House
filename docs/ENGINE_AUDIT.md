# Audit moteur par moteur

Ce que chaque moteur a été _interrogé_ sur, et ce qu'il a répondu. Une question
posée une fois est une anecdote ; les questions écrites ici sont des tests, et
elles se reposent à chaque exécution.

La méthode est celle du reste du projet : on ne cherche pas ce qui plante — les
suites le disent déjà — on cherche **ce que personne ne compare**. Un moteur
qui rend un nombre pour une maison à laquelle il manque la moitié de sa matière
ne plante pas ; il répond.

Le sujet est la maison de référence, parce qu'elle est faite de fiches du
catalogue : un moteur exercé par une fixture écrite pour lui seul n'est pas
exercé.

## Géométrie BIM

**Question** — chaque objet du modèle est-il dessiné, et une seule fois ?

Le plan d'un niveau dessine ses murs, ses dalles, ses toitures, ses ouvertures,
ses pièces, son escalier et ses trente-trois objets posés. Ce qui n'y figure pas
appartient à l'autre niveau, ce qui est la définition d'un plan de niveau.

**Trouvé en chemin, corrigé** : un lavabo déclarait la salle de bain de l'étage
en se tenant deux mètres en dehors. Rien ne le refusait — le comptage des
appareils de la pièce, sa demande d'eau et son dessin lisent tous `spaceId`, et
seul le dessin aurait montré le désaccord. Le test d'intégration vérifie
désormais que chaque objet posé est dans le polygone de la pièce qu'il nomme.

## Enveloppe et thermique

**Question** — la somme des parties fait-elle le tout ?

Oui, exactement. Les dix-sept éléments d'enveloppe — quatre murs par niveau, six
baies, la dalle sur terre-plein, les deux pans de toiture — somment leur `UA` au
coefficient de déperdition de la maison au chiffre près. La charge de chauffage
fait de même : la somme des huit pièces est la charge de la maison.

Le plancher intermédiaire n'y est pas, et c'est juste : il sépare deux volumes
chauffés. Les cloisons non plus.

**Trouvé en chemin, corrigé** : la zone chauffée ne rassemblait que le
rez-de-chaussée alors que l'étage a ses radiateurs.

## Réseaux

**Question** — un réseau dessiné est-il un réseau entier ?

Trois invariants que rien ne vérifiait :

- **un port qu'aucun tronçon ne joint** est une longueur de tuyau que quelqu'un
  a voulu dessiner ;
- **un port joint deux fois** est un té que personne n'a modélisé ;
- **un réseau en deux morceaux** calcule ses deux moitiés et rapporte un total.

Les quatre réseaux de la maison de référence sont propres sur les trois. Un
nœud sans aucun port n'est pas un défaut : une entrée d'air en menuiserie et un
détalonnage de porte sont dessinés et raccordés à rien, ce qui est exactement ce
qu'ils sont.

**Trouvé, corrigé** : la maison portait un **groupe de ventilation double flux
au-dessus d'un réseau simple flux**. Les deux le disaient — la fiche dans
`systemType`, le réseau dans le sien — et personne ne les comparait. Un groupe
double flux souffle son air par des gaines que cette maison n'a pas. Le groupe
posé est maintenant celui du réseau dessiné, et une vérification compare les
deux : c'est le principe du projet appliqué à un écho de plus — _un écho qu'une
porte compare est un instantané, un écho que rien ne compare est une dérive_.

## Métrés

**Question** — le métré compte-t-il ce dont la maison est faite ?

**Non.** Il comptait **les murs et rien d'autre**.

La dalle sur terre-plein, le plancher intermédiaire et les deux pans de
toiture — le béton, le polystyrène extrudé, les solives, le panneau, les trois
cents millimètres de laine de verre du rampant — n'atteignaient ni la
nomenclature, ni le coût, ni le carbone. Le total ne disait pas qu'il lui
manquait la moitié du bâtiment : il donnait un chiffre.

C'était invisible parce que rien ne demandait la couverture. La question
« combien coûte cette maison » a toujours eu une réponse ; la question « cette
réponse porte-t-elle sur toute la maison » n'était posée nulle part.

Corrigé : `calculateSurfaceQuantities` compte les dalles et les toitures comme
`calculateWallQuantities` compte les murs — aire, volume par couche, masse par
couche, avec la même traçabilité. Deux tests le tiennent : l'un nomme les
matériaux qui manquaient, l'autre demande au modèle la liste de ce qu'il porte
et échoue en nommant le premier objet non compté.

Ce que le métré ne compte toujours pas, et qui est écrit plutôt que comblé : les
éléments de structure et les points singuliers de toiture ont leurs fiches
depuis CG-01 et CG-02, mais aucun objet du modèle ne les porte encore — un
poteau se pose, un faîtage se déduit du contour, et ni l'un ni l'autre n'a de
métré. Leur axe `QUANTITIES` le mesure à `PARTIAL`.

## Interface

**Question** — le cycle complet tient-il de bout en bout ?

Créer un projet sur la page de création, tracer une enceinte, sauvegarder,
recharger en jetant l'instantané local, rouvrir le fichier, vérifier que la
maison et son nom sont revenus, modifier, constater que la nomenclature n'est
plus celle d'avant, exporter. Chacune de ces étapes était couverte seule ;
aucune ne disait que ce qui ressort du fichier est ce qui y est entré. C'est
désormais un test de bout en bout.

**Trouvé en chemin, corrigé** : les outils sortaient de leur colonne. Un
`<select>` listant ce que le projet contient élargissait le groupe qui le porte,
et le jour où la maison de référence a été meublée depuis le catalogue,
« Sèche-serviettes eau chaude » a glissé la palette sous le dessin, où plus rien
n'était cliquable.

## Persistance

**Question** — un aller-retour rend-il le projet identique, et deux
sauvegardes le même octet ?

Oui aux deux. Le projet rechargé est structurellement identique à celui qui a
été écrit, et la sérialisation est idempotente : sauvegarder ce qu'on vient de
charger redonne exactement le même fichier. C'est ce qui rend un `git diff` de
projet lisible, et ce qui permet de comparer deux versions sans que l'ordre des
clés fasse du bruit.

## Ce qui reste ouvert

Un seul écart de contrat, écrit et assumé : **CG-09** — une ouverture n'a pour
hôte qu'un mur, dans quarante-six endroits du code, si bien qu'une fenêtre de
toit a sa fiche et ne peut pas être posée. C'est une extension du modèle
géométrique, pas du format, et elle se décide comme telle.
