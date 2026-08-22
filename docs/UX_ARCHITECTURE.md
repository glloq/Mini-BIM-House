# Architecture de l'interface

Ce document est le contrat d'interface de Mini-BIM-House. Il ne décrit pas une
maquette : il décrit ce que l'interface a le droit d'être. Toute PR qui touche
à l'interface est relue contre les dix-huit critères de la dernière section.

## 1. Trois niveaux qu'on ne mélange jamais

| Niveau          | Ce que c'est                                                            | Où ça vit        |
| --------------- | ----------------------------------------------------------------------- | ---------------- |
| **Création**    | Une page plein écran, environ quatre étapes, avant que le projet existe | `/project/new`   |
| **Navigation**  | Cinq espaces permanents, toujours là                                    | Le rail primaire |
| **Progression** | Un guide contextuel, facultatif, qui recommande                         | `WorkflowGuide`  |

Les confondre est ce qui a produit onze destinations : une étape de chantier
devenue un onglet, un outil devenu une destination, un résultat devenu un lieu.

## 2. Cinq espaces, pas onze

```
PROJECT | BUILD | SYSTEMS | ANALYZE | DOCUMENTS
   P        B        S         A         D
```

`apps/web/src/ux/workspaces.ts` les gèle. Le rail primaire ne contient jamais
**Matériaux**, **Assemblages**, **Quantités**, **Scénarios** ni
**Vérifications** : ce sont des outils et des résultats, et un outil n'est pas
un lieu. Ils réapparaissent comme contextes dans l'espace auquel ils
appartiennent — `LEGACY_WORKSPACE_HOME` dit lequel, et un test refuse qu'une
des onze anciennes destinations devienne inatteignable.

## 3. Les dix étapes sont un moteur, pas dix onglets

Projet, Terrain, Bâtiment, Architecture, Construction, Aménagement, Technique, Énergie, Vérifications, Documents
sont les dix groupes de
`apps/web/src/ux/workflow-steps.ts`. Ils alimentent le guide et **n'apparaissent
jamais dans la navigation**.

> Cinq espaces = où je travaille. Les étapes = ce qu'il reste éventuellement à
> faire.

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
vérification pouvait ouvrir un espace ; elle ne pouvait pas ouvrir le niveau,
sélectionner l'objet et déplier la propriété dont elle parlait.

Tout ce qui n'est pas énoncé reste non énoncé : une cible qui ne porte qu'un
espace demande un espace, pas un espace plus une sélection devinée.

`Afficher`, depuis l'Issue Center, doit faire sept choses : ouvrir le bon
niveau, activer la bonne discipline, rétablir la visibilité, sélectionner
l'objet, zoomer dessus, ouvrir l'inspecteur, déplier la propriété concernée.
Un espace n'est pas une réponse ; un champ en est une.

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
| `TopBar`       | 48–52 px          |
| `PrimaryRail`  | 52–60 px          |
| `ContextPanel` | 280–320 px        |
| `Inspector`    | 320–360 px        |
| `StatusBar`    | 30–34 px          |
| `CanvasRegion` | tout le reste     |

Les panneaux sont redimensionnables et repliables ; un double-clic sur un
séparateur rétablit la largeur par défaut.

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

## 9. Règles de présentation

- La couleur vient des variables CSS et des jetons, jamais des composants
  métier. L'interface est neutre ; la couleur de discipline vit dans le canvas
  et dans les icônes.
- Typographie : 18–20 (titre d'espace), 12–13 (étiquette de groupe), 13–14
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

Chaque PR d'interface est relue contre cette liste.

1. La navigation primaire compte exactement cinq entrées.
2. Aucune bibliothèque, quantité, scénario ni vérification n'est une
   destination primaire.
3. Les dix phases de chantier n'apparaissent nulle part comme onglets.
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
