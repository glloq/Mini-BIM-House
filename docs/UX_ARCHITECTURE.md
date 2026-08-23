# Architecture de l'interface

Ce document est le contrat d'interface de Mini-BIM-House. Il ne décrit pas une
maquette : il décrit ce que l'interface a le droit d'être. Toute PR qui touche
à l'interface est relue contre les dix-huit critères de la dernière section.

> **Ce contrat décrit la coque telle qu'elle est aujourd'hui.**
> [`UX_REDESIGN_V2.md`](UX_REDESIGN_V2.md) spécifie celle qu'elle devient, en
> dix PR. UX-1 (coque verrouillée sur la fenêtre) et UX-2 (navigation par
> étapes de création) sont livrées ; restent la boîte à outils filtrée par
> l'étape, le navigateur de bâtiment permanent et le système d'affichage
> unique. Chaque PR de ce plan met à jour ici la section qu'elle change, en
> même temps que le code et les tests : les deux documents ne doivent jamais
> dire deux choses différentes en même temps.

## 1. Trois niveaux qu'on ne mélange jamais

| Niveau          | Ce que c'est                                                            | Où ça vit       |
| --------------- | ----------------------------------------------------------------------- | --------------- |
| **Création**    | Une page plein écran, environ quatre étapes, avant que le projet existe | `/project/new`  |
| **Navigation**  | Neuf étapes de création, toujours là                                    | `StageBar`      |
| **Progression** | Un guide contextuel, facultatif, qui recommande                         | `WorkflowGuide` |

Les confondre est ce qui a produit treize destinations : une phase de chantier
devenue un onglet, un outil devenu une destination, un résultat devenu un lieu.
Une **étape de création** n'est aucun des trois : c'est ce qu'on est en train
de faire, et elle ne fait que filtrer ce qui est proposé.

## 2. Neuf étapes de création, pas treize destinations

```
PROJECT | SITE | BUILDING | STRUCTURE | FITTING | SYSTEMS | ENERGY | CHECKS | DOCUMENTS
   P       T        B          R          A         S         E        V         D
```

`apps/web/src/ux/creation-stages.ts` les gèle. Cinq espaces répondaient à « où
je travaille » ; ils demandaient à quelqu'un qui pose une prise de savoir
d'avance qu'une prise se pose dans « Systèmes ». Les neuf étapes répondent à la
question qu'on se pose vraiment en dessinant — je suis en train de faire le
bâtiment, la structure, les réseaux — et se lisent dans l'ordre d'un chantier,
ce qui n'oblige personne à le suivre.

**Une étape filtre ce qui est proposé. Elle ne restreint jamais ce qui est
possible.** On revient en arrière, on saute une étape, on pose l'électricité
avant la toiture. La recherche et la palette donnent accès à tout, depuis
n'importe où. Rien ne se valide, rien ne se verrouille, et l'étape active est
un état d'écran : elle n'entre jamais dans le fichier projet.

La barre d'étapes ne contient jamais **Matériaux**, **Assemblages**,
**Quantités** ni **Scénarios** : ce sont des outils et des résultats, et un
outil n'est pas une chose qu'on est en train de faire. Ils réapparaissent
comme destinations de l'étape à laquelle ils appartiennent — le registre dit
laquelle, et un test refuse qu'une des treize destinations devienne
inatteignable.

Une **sous-étape** est ce qu'on fait à l'intérieur de l'étape. Dans Systèmes
elle **est** une discipline : la choisir change le métier par lequel le plan se
lit. Ailleurs c'est un groupe d'outils. La distinction est portée par le
registre, jamais par un composant.

## 3. Les dix phases sont un moteur, pas dix onglets

Projet, Terrain, Bâtiment, Architecture, Construction, Aménagement, Technique, Énergie, Vérifications, Documents
sont les dix groupes de
`apps/web/src/ux/workflow-steps.ts`. Ils alimentent le guide et **n'apparaissent
jamais comme navigation** : chaque phase est portée par exactement une étape,
et un test le vérifie — sinon « il reste des murs à tracer » se lirait à deux
endroits.

> Les étapes = ce que je suis en train de faire. Les phases = ce qu'il reste
> éventuellement à faire.

L'état d'une étape est **dérivé du modèle**, à chaque lecture.
`stepCompleted = true` n'est jamais écrit dans le projet : un drapeau dit que
quelqu'un a cliqué, et ce qui compte est de savoir si la maison a vraiment ses
murs. Un projet qui perd ses murs doit perdre l'étape avec eux.

Le guide **recommande** ; il ne bloque rien. `NOT_APPLICABLE` n'est ni un échec
ni une réussite : un projet sans solaire dans son périmètre n'a rien à dire sur
la pose de panneaux.

## 4. Le périmètre de conception

`ProjectScope` (`packages/core-domain/src/design-scope.ts`) porte deux choses :
l'intention du projet (`NEW_BUILD`, `RENOVATION`, `EXISTING_SURVEY`, `STUDY`) et
les domaines activés.

`enabledDomains` est un **périmètre de travail, pas une capacité du fichier**.
Désactiver le photovoltaïque veut dire « ne m'encombre pas l'interface avec
ça » ; jamais « ce projet ne peut pas contenir de photovoltaïque ». Rien n'est
supprimé, refusé ni caché : `domainsOutsideScope()` existe précisément pour que
l'interface puisse dire « ce domaine est hors périmètre mais contient déjà 14
objets » au lieu de faire disparaître quatorze objets.

Les seize domaines sont ceux du catalogue (`DATA_DOMAINS`) : une seconde liste
de métiers dériverait de la première, et la dérive se verrait comme une famille
que personne ne peut atteindre. `DESIGN_DOMAINS` est un registre —
`satisfies Record<DesignDomainId, …>` fait de « chaque domaine a un descripteur »
un fait vérifié par le compilateur. On ne code pas vingt cases à cocher
directement dans le JSX.

Les préréglages (`SCOPE_PRESETS`) n'écrivent que dans la sélection, puis
s'effacent : les cases restent visibles et modifiables, pour que personne n'ait
à deviner ce que « Maison complète » a décidé à sa place.

**ARCHITECTURE ne se désactive jamais.** Un projet sans architecture n'est pas
un projet plus petit : c'est un projet sans murs, et tous les autres métiers
pendent aux murs.

Un projet qui n'a jamais énoncé de périmètre s'ouvre, et tout lui est offert :
un fichier ancien n'a fait aucun choix, et lui en lire un rétrécirait le projet
de quelqu'un à sa place.

## 5. Trois catégories d'état, jamais mélangées

| Catégorie               | Exemple                          | Où                             |
| ----------------------- | -------------------------------- | ------------------------------ |
| Modèle BIM persisté     | un mur, une pièce, un circuit    | `.houseproj`                   |
| Périmètre transportable | `intent`, `enabledDomains`       | `.houseproj` (`project.scope`) |
| Préférences locales     | `leftPanelWidth`, panneau replié | `localStorage`                 |

`leftPanelWidth` ne va pas dans `.houseproj`. `enabled photovoltaics` ne vit pas
seulement dans `localStorage` : le périmètre de conception voyage avec le
projet, parce que le même fichier ouvert sur une autre machine doit retrouver le
même périmètre.

## 6. Une seule navigation transversale

`UiTarget` (`apps/web/src/ux/ui-target.ts`) exprime **un** endroit :

```ts
interface UiTarget {
  workspace?;
  domain?;
  levelId?;
  objectId?;
  propertyPath?;
  overlayId?;
}
```

Six fonctionnalités devaient déjà dire « va là-bas » — une vérification, un
calcul, une recherche, l'arbre du projet, une quantité, un scénario — et chacune
le disait autrement, donc chacune atteignait une profondeur différente. Une
vérification pouvait ouvrir une étape ; elle ne pouvait pas ouvrir le niveau,
sélectionner l'objet et déplier la propriété dont elle parlait.

Tout ce qui n'est pas énoncé reste non énoncé : une cible qui ne porte qu'une
étape demande une étape, pas une étape plus une sélection devinée.

`Afficher`, depuis l'Issue Center, doit faire sept choses : ouvrir le bon
niveau, activer la bonne discipline, rétablir la visibilité, sélectionner
l'objet, zoomer dessus, ouvrir l'inspecteur, déplier la propriété concernée.
Une étape n'est pas une réponse ; un champ en est une.

## 7. La création de projet

La modale disparaît au profit d'une page `/project/new`. Elle ne demande que des
décisions structurantes — ce qu'est ce projet, comment il commence, de quoi il
est fait verticalement, à peu près où il se trouve, quels métiers seront
travaillés — et chacune reste modifiable ensuite.

- `LevelStackEditor` remplace « nombre de niveaux + une hauteur + une case
  sous-sol », qui ne sait dire ni deux sous-sols, ni mezzanine, ni demi-niveau,
  ni combles, ni local technique.
- La forme initiale est facultative et le défaut est **« Je dessinerai
  moi-même »**. Ce qu'elle produit passe par les commandes ordinaires
  (`AddWallCommand`, `AddSlabCommand`) : le résultat est un bâtiment comme un
  autre, pas une géométrie que seule la page de création sait fabriquer.
- L'adresse d'abord, « Coordonnées à déterminer » est une réponse légitime, la
  saisie technique (lat/long/alt) est repliée. Une latitude inconnue reste
  inconnue plutôt que de devenir zéro degré, qui est un endroit réel dans
  l'Atlantique.
- Le nord démarre à « ↑ écran » et se règle graphiquement plus tard, dans
  `Projet > Site`.

## 8. Panneaux, dimensions, densité

| Zone           | Hauteur / largeur |
| -------------- | ----------------- |
| `TopBar`       | 44 px             |
| `StageBar`     | 34 px             |
| `ContextPanel` | 280–320 px        |
| `Inspector`    | 320–360 px        |
| `StatusBar`    | 30–34 px          |
| `CanvasRegion` | tout le reste     |

Les panneaux sont redimensionnables et repliables ; un double-clic sur un
séparateur rétablit la largeur par défaut.

**La coque tient dans la fenêtre.** `.workspace` fait `100dvh` et ne défile
pas : ce sont les panneaux qui défilent chez eux. La page mesurait 2 101 px
pour une fenêtre de 900, et le plan ne se voyait pas en entier sans faire
défiler le document. `scripts/measure-shell.mjs` mesure ce que la coque coûte à
l'écran et `npm run measure:shell -- --check` refuse qu'elle regrossisse ; les
budgets sont dans `SHELL_BUDGETS`, et chaque resserrement dit pourquoi.

**Ce qu'on fait au fichier est un menu, pas six boutons.** Nouveau, ouvrir, la
maison de démonstration, sauvegarder et les deux exports vivent sous
« Fichier ▾ » (`shell/ProjectMenu.tsx`). Ils restent atteignables à la souris
seule ; la barre supérieure tient sur une rangée, jamais deux.

**Aucune zone ne réserve de place pour rien.** L'inspecteur ne prend ses
280 px qu'à partir du moment où quelque chose est désigné ; tant que rien ne
l'a jamais été, il vaut zéro pixel et le dessin a la largeur. Le repli est
collant : il vaut jusqu'à la première sélection et plus jamais après, sinon la
fenêtre respirerait à chaque Échap. Ensuite c'est le bouton « Inspecteur » qui
décide, et lui seul.

Les sept réglages d'accrochage de la barre d'état (cinq cases, le pas de
grille, le pas angulaire) sont repliés sous « Réglages » : on les règle une
fois, et ils faisaient passer la barre à deux rangées.

Trois niveaux de densité seulement — Navigation, Groupe, Action. Pas
d'imbrication plus profonde. Une recherche apparaît dès qu'une catégorie dépasse
une dizaine d'entrées.

**Divulgation progressive obligatoire, et pas de modes « simple / expert »
distincts** : l'essentiel est visible, l'avancé est dans des accordéons, et
c'est le même écran pour tout le monde. Le sélecteur « Niveau d'interface »
a disparu pour cette raison : deux modes, ce sont deux produits, et celui qui
avait choisi le mode simple n'apprenait jamais que l'autre outil existait.

Ce qu'un outil laisse décider avant de dessiner se trouve **sous l'outil**,
dans le panneau contextuel : choisir un assemblage fait partie du choix de
l'outil mur, ce n'est pas une course séparée en haut de la fenêtre.

**Un outil dit ce qu'il attend.** La barre au-dessus du dessin écrit la
prochaine action — « Cliquez le second point », « Entrée termine, Échap
annule » — et offre d'abandonner le tracé dès qu'il y a quelque chose à
abandonner. La phrase est **dérivée** du registre et de l'état par
`editor/tool-instruction.ts` : aucun outil ne l'écrit, donc aucun ne peut
oublier de la mettre à jour, et un test la réclame pour les vingt-cinq.

**La boîte à outils propose ce que l'étape demande.**
`apps/web/src/editor/toolbox.ts` déclare, par étape et par sous-étape, des
**entrées** : un outil du registre plus ce qu'on aurait choisi juste après.
« Porte » est l'outil ouverture avec le type déjà mis ; « WC » est l'outil
composant avec la fiche déjà désignée. Le registre reste à vingt-cinq outils et
continue de parler la langue du modèle ; la boîte parle celle de la personne.

Une entrée nomme une **famille** de la nomenclature, jamais une fiche : la
fiche est celle que le catalogue du projet tient, et une entrée dont la famille
n'est pas installée n'est pas offerte. Une entrée qui ne change rien à son
outil porte le nom de l'outil — deux noms pour une même chose sur un même écran
font croire qu'il y en a deux. Ce que l'étape ne propose pas est sous « Tous
les outils », sur le même écran : un test refuse qu'un outil du registre
devienne inatteignable.

## 8 bis. Systèmes, la visibilité et le navigateur

**Systèmes** n'est pas une autre application : c'est le même dessin, le même
inspecteur et les mêmes outils, avec une discipline activée. Le plan y est donc
la destination par défaut, et le navigateur de réseaux une seconde destination
de la même étape. Une étape qui vous sortirait du modèle pour vous montrer ses
réseaux serait la disposition à treize destinations, sous neuf noms.

Une discipline hors périmètre n'est pas proposée — sauf si le projet en tient
déjà des objets. Le compte de réseaux est affiché à côté de chaque discipline :
c'est la différence entre « rien à voir » et « rien de tracé ».

**Ce que le plan montre se lit et se change contre le plan**, dans la barre de
vue : le niveau dessiné, le métier, la variante, l'affichage. Ce sont quatre
notions distinctes qu'on a longtemps confondues sous le mot « vue », et elles
décrivent toutes le dessin — elles sont donc à côté de lui, sur une rangée. On
change d'étage dans l'arborescence, jamais ici : la barre le nomme.

**L'affichage** a un seul écran, `DisplayPanel` : le rendu (comment c'est
dessiné), le préréglage (quoi afficher), puis les vingt-huit calques sous un
dépliage. `LayersPanel` a été supprimé, pas déplacé — deux interfaces pour une
question sont deux réponses qui finissent par diverger. Neuf fois sur dix la
question est « montre-moi l'électricité », et un préréglage y répond en un
clic ; les calques sont le moteur, et le moteur n'a pas à être l'interface.

Le rendu et les calques restent **deux axes indépendants** : les mélanger
interdirait un plan d'architecte des réseaux. Le compte de calques masqués est
sur le bouton d'affichage lui-même, pour que personne n'imprime un plan amputé
sans l'avoir su.

**Le navigateur de bâtiment** est en tête du panneau gauche, en permanence.
« Où je suis et ce qu'il y a dedans » est une question qu'on se pose sans
arrêt ; elle a longtemps été rangée derrière un dépliage nommé `☰ Modèle`,
c'est-à-dire cachée à qui ne savait pas déjà.

Les niveaux y sont une rangée de boutons, et c'est **le seul** endroit où l'on
change d'étage : une liste déroulante « Niveau » faisait la même chose ailleurs,
sans dire ce que l'étage contient. Seul le niveau dessiné est déplié, et **une
famille vide n'est pas une rangée** — un arbre dit ce que le bâtiment a, pas ce
qu'il n'a pas. Les vues enregistrées et les feuilles y ont leur section : ce que
le projet produit se trouve là où l'on cherche le reste.

Au-delà de quarante objets par famille, un bouton ouvre la recherche avec le nom
de la famille déjà écrit. La phrase qui renvoyait à `Ctrl+K` supposait qu'on
connaisse le raccourci, qu'on ait un clavier et qu'on ait lu la ligne :
**`Ctrl+K` est un accélérateur, jamais le seul chemin** — critère 18.

## 8 ter. Le compteur de vérifications

Il vit dans la barre d'état, en permanence, et nulle part ailleurs. Les constats
avaient un écran, et un écran, il faut y aller : ils étaient donc lus quand
quelqu'un pensait à les lire.

Il ne prétend jamais qu'un contrôle est passé. Tout ce que l'application produit
est un constat — ce qui n'a pas pu être résolu — donc le compteur dit combien de
remarques il y a, pas combien de contrôles ont réussi. Un « ✓ 42 » serait un
nombre que personne ne pourrait étayer.

Il ne bloque rien : un compteur rouge est une information sur le modèle, pas un
refus de laisser le modèle être ce qu'il est.

## 8 quater. Les catalogues et Vérifier

Matériaux, assemblages, équipements et les cinq cents familles avaient chacun
leur champ de recherche, leurs filtres et leur idée de ce qu'une recherche
trouve. Quatre dialectes de la même question, c'est quatre choses à apprendre,
et trois d'entre elles se tromperont le jour où l'on en corrige une.

`CatalogQuery` et `CatalogSearch` posent la question une fois : recherche libre
sans accents ni casse, mots dans n'importe quel ordre, filtre par métier, filtre
par famille, et « il manque quelque chose » quand le catalogue sait le dire.

**Vérifier** ouvre sur le plan, comme Systèmes. Un résultat se lit contre le
bâtiment dont il parle ; une étape qui vous sortirait du modèle pour vous
montrer un nombre rendrait le nombre plus difficile à croire, pas plus facile.

Une **variante** est un mode du dessin, choisi au-dessus du plan, et non une
destination : elle change ce que le plan montre et ce qu'une modification veut
dire, et rien n'en est jamais écrit dans le bâtiment.

## 9. Règles de présentation

- La couleur vient des variables CSS et des jetons, jamais des composants
  métier. L'interface est neutre ; la couleur de discipline vit dans le canvas
  et dans les icônes.
- Typographie : 18–20 (titre d'étape), 12–13 (étiquette de groupe), 13–14
  (contenu), 12 (barre d'état).
- Trois catégories de boutons — Primary, Secondary, Ghost — avec **un seul**
  bouton primaire dominant par panneau.
- Sémantique des icônes fixe : une icône veut dire la même chose partout.
- Panneau latéral pour ce qui est permanent, popover pour un réglage court,
  modale pour une décision qui bloque, page pour ce qui précède le projet. La
  création n'est plus une modale.
- `ContextToolBar` remplace la barre universelle : quand aucun outil n'est
  actif et que rien n'est sélectionné, elle n'affiche rien. Elle garde sa
  place et sa hauteur — une bande qui apparaît et disparaît déplace le dessin
  sous le pointeur, et un plan qui saute est un plan qu'on ne peut pas viser.
  Ce qui ne tient pas défile.
- `ViewModeDescriptor.available(project)` décide de l'affichage d'un mode de
  vue. **Ne pas afficher un bouton 3D non fonctionnel uniquement parce que le
  design futur l'a prévu.**

## 10. Responsive

| Largeur      | Comportement         |
| ------------ | -------------------- |
| ≥ 1400 px    | Disposition complète |
| 1000–1400 px | Inspecteur réduit    |
| 800–1000 px  | Panneaux en tiroirs  |
| < 800 px     | Consultation seule   |

Ne pas détruire le desktop BIM pour un téléphone qui ne dessinera jamais de
plan.

## 11. Clavier

`⌘/Ctrl+K` ouvre la palette, `Esc` annule, `Delete` supprime, `Ctrl+Z/Y`
défont et refont, `F` cadre, `V` sélectionne, `M` déplace. Chaque outil du
`ContextPanel` est également joignable depuis la palette de commandes.

## 12. Les dix-huit critères d'acceptation

Chaque PR d'interface est relue contre cette liste. Dix-huit d'entre eux sont
aussi des tests — `apps/web/src/ux/acceptance.test.ts` — parce qu'un contrat que
chaque PR est « relue contre » est un contrat que personne ne relit.

1. La navigation primaire compte exactement neuf entrées.
2. Aucune bibliothèque, quantité, scénario ni vérification n'est une
   destination primaire.
3. Une étape ne verrouille rien, ne remplace jamais le plan et n'est jamais
   persistée. Chaque phase de chantier est portée par exactement une étape.
4. L'état d'une étape est dérivé du projet ; aucun `stepCompleted` n'est
   persisté.
5. Le guide recommande et ne bloque jamais une action.
6. Désactiver un domaine ne supprime, ne refuse et ne cache aucune donnée
   existante ; l'interface peut dire ce qui est hors périmètre.
7. `ARCHITECTURE` est toujours disponible.
8. Un projet enregistré sans `scope` s'ouvre et se modifie normalement.
9. Le périmètre de conception voyage dans le fichier ; les largeurs de panneaux
   restent dans le navigateur.
10. Toute navigation transversale passe par `navigateTo(UiTarget)` — une seule
    profondeur de navigation pour tout le monde.
11. « Afficher » depuis une anomalie fait les sept gestes du § 6.
12. La création de projet est une page, jamais une modale.
13. La forme initiale est facultative et son défaut est « Je dessinerai
    moi-même » ; elle passe par les commandes BIM ordinaires.
14. Une valeur inconnue reste inconnue : aucun repli silencieux sur une
    constante.
15. Divulgation progressive partout ; aucun mode « expert » séparé.
16. Aucun composant métier ne code une couleur en dur.
17. Aucun contrôle n'est affiché pour une capacité qui n'existe pas encore.
18. Chaque outil du panneau contextuel est atteignable au clavier via la
    palette.

## 13. Le plan

Les quatorze PR ci-dessous ont construit la coque à cinq espaces. Elles sont
faites, et gardées ici parce qu'un plan qu'on efface une fois exécuté fait
croire que l'interface est arrivée là toute seule. Le plan en cours est celui
de [`UX_REDESIGN_V2.md`](UX_REDESIGN_V2.md) §12 : UX-1 et UX-2 sont livrées.

| PR    | Objet                                                                | Risque |
| ----- | -------------------------------------------------------------------- | ------ |
| UI-01 | Contrats + registre des domaines                                     | faible |
| UI-02 | `AppShell` et les cinq espaces, sans supprimer les anciens panneaux  | moyen  |
| UI-03 | `ProjectCreationPage` et `NewProjectDraft`                           | moyen  |
| UI-04 | `LevelStackEditor`                                                   | moyen  |
| UI-05 | Domaines, préréglages, périmètre                                     | moyen  |
| UI-06 | `ContextPanel` Construire et `ContextToolBar`                        | élevé  |
| UI-07 | Inspecteur universel                                                 | élevé  |
| UI-08 | `CatalogBrowser`                                                     | élevé  |
| UI-09 | Espace Systèmes                                                      | moyen  |
| UI-10 | `WorkflowRegistry` et guide                                          | moyen  |
| UI-11 | `VisibilityPopover` et navigateur                                    | faible |
| UI-12 | Issue Center et navigation                                           | moyen  |
| UI-13 | Analyser unifié                                                      | moyen  |
| UI-14 | Responsive, accessibilité, clavier, E2E, retrait des anciens espaces | moyen  |

UI-01 ne commence pas par le CSS : il gèle les contrats. UI-02 est un
**remapping, pas une réécriture** — toutes les anciennes fonctions restent
atteignables.
