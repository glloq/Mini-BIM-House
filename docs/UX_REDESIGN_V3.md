# Ce que l'interface doit savoir du projet

> La V2 a répondu à « comment ranger toutes les fonctionnalités ». Elle laisse
> ouverte la question suivante : **de quoi la personne a-t-elle besoin
> maintenant pour passer de son idée à une maison complète ?**

La V2 pilote l'interface avec deux variables — l'étape et le métier :

```text
étape → discipline → liste d'outils
```

Ce qui manque n'est pas une variable de plus, c'est une **couche** : l'état
réel de la maison. Une porte n'a pas de sens sans mur, un escalier n'en a pas
avec un seul niveau, une pièce n'en a pas sans contour fermé. L'interface
devrait raisonner ainsi :

```text
étape + sous-étape
  + état géométrique
  + ce qui existe déjà
  + prérequis
  + sélection
  + anomalies détectées
        ↓
  outils réellement utiles maintenant
        ↓
  prochaine action recommandée
```

---

## 1. Ce que le dépôt fait déjà — vérifié avant d'écrire ce plan

Une spécification qui redemande ce qui existe fait refaire du travail, et une
qui l'ignore fait construire un doublon. Chaque ligne ci-dessous a été
vérifiée dans le code, pas supposée.

| Demandé par l'audit                      | État réel                                                                                                                                                                                          |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Surface des pièces affichée sur le plan  | **Déjà fait.** `plan-view.ts` calcule `areaM2` et pose `areaText` sous le nom de la pièce.                                                                                                         |
| Détection des contours fermés            | **Déjà fait.** `detectRooms()` rend les boucles de murs, leur aire et celles qui ne portent pas encore de pièce.                                                                                   |
| Cotations temporaires sur le dessin      | **Partiel.** `TemporaryDimensions.tsx` existe et cote ce qu'on trace.                                                                                                                              |
| Référence de face du mur                 | **Partiel, et c'est le pire cas.** Le modèle porte la face de référence et l'inspecteur la modifie — mais **l'outil mur ne l'offre pas au moment de tracer.** On dessine à l'axe, puis on corrige. |
| Niveaux : sous-sol, mezzanine, combles…  | **Déjà fait** comme briques (`LEVEL_DRAFT_KINDS`), **pas** comme configurations de maison.                                                                                                         |
| Formes initiales rectangle / L / T / U   | **Déjà fait** (`INITIAL_SHAPE_KINDS`).                                                                                                                                                             |
| Grille liée aux coordonnées du modèle    | **Absente.** Il n'y a qu'un fond CSS de 24 px et un pas d'accrochage. Rien ne dessine une grille en millimètres.                                                                                   |
| Détection des contours ouverts           | **Absente.** Rien ne dit « il manque 12 mm ».                                                                                                                                                      |
| Outil de mesure                          | **Absent.**                                                                                                                                                                                        |
| Disponibilité des outils selon le modèle | **Absente.** `toolboxFor()` ne lit que l'étape, le métier et le catalogue.                                                                                                                         |

Deux conséquences pour ce plan : la surface des pièces et la détection des
boucles ne sont pas à écrire, elles sont à **rendre visibles au bon moment** ;
et la face de référence n'est pas à inventer, elle est à **remonter dans
l'outil**, ce qui est un travail plus petit et plus utile.

---

## 2. La couche manquante : `DesignState`

Un module unique répond à toutes les questions que l'interface se pose sur
l'état de la maison. **Dérivé du modèle à chaque lecture, jamais persisté** —
comme les étapes de `workflow-steps.ts`, et pour la même raison : un drapeau
dit que quelqu'un a cliqué, et ce qui compte est ce que la maison a.

```ts
// apps/web/src/ux/design-state.ts
export interface DesignState {
  readonly levelCount: number;
  readonly wallCount: number;
  readonly exteriorWallCount: number;
  /** Boucles de murs fermées, avec leur aire. */
  readonly closedContours: readonly { readonly areaM2: number }[];
  /** Celles qui ne portent pas encore de pièce : c'est là qu'est le travail. */
  readonly contoursWithoutSpace: number;
  readonly spaceCount: number;
  readonly unnamedSpaceCount: number;
  readonly openingCount: number;
  readonly slabCount: number;
  readonly stairCount: number;
  readonly roofSurfaceCount: number;
  readonly structuralMemberCount: number;
  readonly sanitaryFixtureCount: number;
  readonly distributionBoardCount: number;
  readonly networkCount: number;
  readonly pvModuleCount: number;
  /** Ce que la géométrie a de cassé, nommé et situé. */
  readonly findings: readonly GeometryFinding[];
}
```

Une seule fonction le construit, `designStateOf(project, levelId)`, et une
seule chose la mémoïse : le composant racine, sur `[project, levelId]`.

**Ce que `DesignState` n'est pas** : un second modèle. Il ne contient aucune
donnée que le projet ne porte pas, il ne s'écrit nulle part, et un projet qui
perd ses murs perd ses contours avec eux.

---

## 3. La disponibilité d'un outil est une question, pas une constante

`ToolboxEntry` gagne trois prédicats. Aucun n'est obligatoire : un outil qui ne
dit rien est visible, actif, et jamais recommandé — c'est le comportement
d'aujourd'hui, et rien ne casse.

```ts
export type DesignPredicate = (state: DesignState) => boolean;

export interface ToolboxEntry {
  // …
  /** Absente de la liste tant que c'est faux. */
  readonly visibleWhen?: DesignPredicate;
  /** Présente mais inerte, avec sa raison écrite. */
  readonly enabledWhen?: DesignPredicate;
  /** Mise en avant : c'est ce qu'il y a de plus utile à faire maintenant. */
  readonly recommendedWhen?: DesignPredicate;
  /** Pourquoi elle est inerte, et ce qu'il faut faire d'abord. */
  readonly requires?: { readonly reason: string; readonly entryId?: string };
}
```

Trois degrés, et pas un de plus :

| Degré          | Effet                                     | Quand                                                      |
| -------------- | ----------------------------------------- | ---------------------------------------------------------- |
| **recommandé** | En tête, avec un point                    | C'est la suite normale du travail                          |
| **actif**      | Normal                                    | Le projet permet de s'en servir                            |
| **inerte**     | Grisé + la raison + le geste qui débloque | Le projet ne le permet pas encore                          |
| **absent**     | Pas rendu                                 | La question ne se pose pas dans ce projet (hors périmètre) |

Quelques exemples, écrits dans le registre et non dans un composant :

```text
Porte        enabled     wallCount > 0
             requires    « Tracez d'abord un mur. »   → outil Mur

Pièce        recommended contoursWithoutSpace > 0

Escalier     enabled     levelCount >= 2
             requires    « Ajoutez un étage. »        → Projet › Niveaux

Toiture      recommended closedContours.length > 0 && roofSurfaceCount === 0

Dalle        enabled     closedContours.length > 0

Circuit      enabled     distributionBoardCount > 0
             requires    « Posez le tableau. »        → entrée Tableau

Canalisation recommended sanitaryFixtureCount > 0

Solaire      enabled     roofSurfaceCount > 0
             requires    « Dessinez la toiture. »     → étape Bâtiment › Toiture
```

**Un bouton inerte explique toujours pourquoi**, et propose le geste qui le
débloque. Un outil grisé en silence est une panne ; un outil grisé qui dit
« ajoutez un étage » et offre le bouton pour le faire est une leçon.

En pratique, le geste est la tuile elle-même : quand `entryId` nomme une entrée,
cliquer « Porte » sans mur tracé prend l'outil Mur, et l'infobulle le dit avant
le clic. Une tuile qui agit n'est donc jamais annoncée désactivée — un bouton
qu'on dit inerte et qui répond ment à qui l'écoute. Là où rien ne débloque dans
la boîte — un étage se pose dans le menu du projet — le bouton est réellement
`disabled`, et il garde sa raison, écrite sous son nom et lue par
`aria-description`. La raison reste hors du nom accessible : « Porte » doit
rester « Porte » pour qui la cherche.

> **Ce que cette règle ne fait jamais** : empêcher. `visibleWhen` ne retire
> jamais un outil de « Tous les outils », ni de la recherche, ni de la palette.
> L'invariant de UX-3 tient — un test refuse qu'un outil du registre devienne
> inatteignable — et il devient plus fort, pas plus faible.

---

## 4. La prochaine action, en tête du panneau

```text
CONSTRUIRE › ENVELOPPE
✓ Niveaux            2
✓ Murs extérieurs   14
✓ Contour fermé     87,4 m²
○ Définir les pièces
○ Poser les ouvertures

Suivant : [ Définir les pièces ]
```

Dérivé de `DesignState` et de la sous-étape, jamais d'un drapeau. Ce n'est pas
un assistant : rien n'est bloqué, chaque ligne est cliquable, et on peut
sauter à la toiture avant les pièces si on veut.

---

## 5. Cinq phases, et des sous-étapes

Neuf étapes au même niveau font croire à neuf mondes. Il y en a cinq, et ce
qui était étape devient sous-étape :

```text
PROJET │ CONSTRUIRE │ ÉQUIPER │ VÉRIFIER │ DOCUMENTS
```

| Phase          | Sous-étapes                                                                                                                               |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **PROJET**     | Identité · Niveaux · Terrain · Périmètre                                                                                                  |
| **CONSTRUIRE** | Enveloppe · Distribution · Ouvertures · Circulation · Ouvrages · Toiture · Structure                                                      |
| **ÉQUIPER**    | Aménagement · Sanitaires · Eau · Évacuation · Chauffage · Ventilation · Électricité · Éclairage · Faibles · Sécurité · Solaire · Stockage |
| **VÉRIFIER**   | Anomalies · Calculs · Quantités · Scénarios                                                                                               |
| **DOCUMENTS**  | Vues · Feuilles · Export                                                                                                                  |

`CreationStage` ne disparaît pas : les neuf étapes deviennent les sous-étapes,
et une `DesignPhase` les regroupe. Le registre garde une seule source, et la
correspondance est un champ de plus, pas une seconde table.

**On ne voit qu'une sous-étape à la fois** — c'est elle qui décide des trois à
huit outils affichés.

---

## 6. La grille, en millimètres

Un fond CSS de 24 px ne dit rien de la maison. La grille doit être dessinée
par le moteur, dans les coordonnées du modèle, et suivre le zoom :

```text
zoom arrière   gros carreaux 1 m,  super-grille 5 m
zoom normal    petits 10 cm,       gros 1 m
zoom avant     petits 5 cm,        gros 50 cm
```

Le pas se choisit **à partir du zoom**, en prenant dans une suite 1-2-5 le plus
petit pas dont l'espacement à l'écran dépasse un seuil lisible. Un pas qui
donnerait des traits à trois pixels d'intervalle n'est pas dessiné : une grille
illisible est un aplat gris.

Elle vit dans `packages/drawing-engine` comme une primitive de scène, pas dans
un `<div>` : elle doit suivre le pan, le zoom et l'origine du projet, et se
retrouver à l'identique dans un export.

En bas à droite du plan, ce que la grille fait, lisible sans ouvrir un panneau :

```text
Grille ● 10 cm   Accrochage ●   Ortho ●
```

---

## 7. La référence de face, au moment de tracer

C'est le manque le plus coûteux, et le plus proche d'être comblé : le modèle
sait déjà, l'inspecteur sait déjà, **l'outil ne demande pas**.

```text
Épaisseur 300 mm
       extérieur
┌──────────────────────┐
│         MUR          │
└──────────────────────┘
       ↑ intérieur
Référence : FACE INTÉRIEURE
```

Une pièce saisie à 4,00 m avec la référence intérieure doit faire **4,00 m à
l'intérieur**, quelle que soit l'épaisseur. Et changer l'assemblage d'un mur
tracé à la face intérieure doit épaissir vers l'extérieur : une chambre prévue
à 4 × 5 m ne doit pas devenir 3,85 × 4,85 m parce qu'on a ajouté de
l'isolation.

---

## 8. Ce que le plan montre de ses propres mesures

Une barre de vue de plus dans la barre de vue :

```text
Cotes : [ Auto ▾ ]
```

| Mode          | Ce qui est coté                             |
| ------------- | ------------------------------------------- |
| **Aucune**    | Rien. Le plan est propre.                   |
| **Sélection** | Ce qui est sélectionné, et rien d'autre.    |
| **Auto**      | Les dimensions principales de chaque pièce. |
| **Toutes**    | Tout ce que le modèle sait coter.           |

Et un outil **Mesurer** dans les communs : distance, distance orthogonale,
angle, surface, périmètre. Une mesure ne crée aucun objet BIM ; elle propose
`[Conserver comme cote]` si on veut qu'elle reste.

---

## 9. Nommer les surfaces

« Surface » seul deviendra ambigu le jour où deux modules n'en parleront pas de
la même. Le vocabulaire est fixé une fois :

```text
surface intérieure de pièce     surface de dalle
surface brute du niveau         surface de toiture
emprise au sol                  surface des murs
                                surface vitrée
```

et, selon les modules réglementaires : habitable, chauffée, utile, thermique.
Aucune n'est l'abréviation d'une autre.

---

## 10. Ce que la géométrie a de cassé, dit sans bloquer

`DesignState.findings` porte ce que la géométrie a de douteux, nommé et situé :

```text
mur presque joint          contour ouvert de 12 mm
murs croisés sans jonction pièce sans nom
mur double                 surface nulle
mur de longueur nulle      dalle qui ne suit plus le contour
auto-intersection          toiture incohérente après modification
pièces superposées         ouverture hors du mur
                           ouvertures qui se chevauchent
                           escalier sans niveau d'arrivée
```

Rendu ainsi, jamais comme un refus :

```text
Enveloppe
✓ 14 murs
✓ contour fermé
⚠ 1 jonction à vérifier   [Voir]
```

Et sur le dessin, l'écart montré à l'endroit où il est, avec le geste qui le
répare :

```text
─────────────●   ●────────────
             ↑ 12 mm
        [Fermer automatiquement]
```

Trois couleurs, trois sens, et rien d'autre : **vert** le contour porte une
pièce nommée ; **orange** la géométrie est juste et le sens manque ; **rouge**
la géométrie est fausse.

---

## 11. Quelle maison construisez-vous ?

La page de création demande aujourd'hui une table de niveaux. C'est le mode
avancé d'une question plus simple :

```text
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│  Plain-pied │ │     R+1     │ │     R+2     │
└─────────────┘ └─────────────┘ └─────────────┘
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ Sous-sol+RDC│ │ RDC+combles │ │ Personnalisé│
└─────────────┘ └─────────────┘ └─────────────┘
```

Les briques existent (`LEVEL_DRAFT_KINDS`) : un preset n'est qu'une pile
nommée, et « Personnalisé » ouvre `LevelStackEditor`, qui devient le mode
avancé au lieu d'être la porte d'entrée.

Et une **dimension de référence** dès la création : 10 × 8 m _intérieurs_ ou
_extérieurs_, avec un aperçu immédiat de la forme choisie.

---

## 12. Plan de migration

Une PR par ligne. Après chacune : l'application se construit, les tests
passent, une maison se dessine.

| PR       | Objet                                                         | Corrige       |
| -------- | ------------------------------------------------------------- | ------------- |
| **V3-1** | `design-state.ts` — l'état dérivé, et ses tests               | la couche     |
| **V3-2** | Prédicats de disponibilité, raison écrite, geste qui débloque | P0 toolbox    |
| **V3-3** | Grille en millimètres, liée au zoom, dans le moteur           | P0 grille     |
| **V3-4** | Référence de face dans l'outil mur, et cotes intérieures      | P0 cotation   |
| **V3-5** | Contours ouverts : détection, écart chiffré, réparation       | P0 validation |
| **V3-6** | Cinq phases, sous-étapes, prochaine action                    | P1 workflow   |
| **V3-7** | Presets de maison, dimensions de référence à la création      | P0 presets    |
| **V3-8** | Pièce rectangulaire par dimensions intérieures                | P1            |
| **V3-9** | Modes de cotation, outil Mesurer, vocabulaire des surfaces    | P2            |

V3-1 d'abord, et seule : tout le reste la lit, et une couche qu'on construit
en même temps que ses trois premiers usages est une couche qui prend la forme
de ses usages plutôt que celle du problème.

---

## 13. Critères mesurables

| Grandeur                                                | Seuil      |
| ------------------------------------------------------- | ---------- |
| Outils proposés dans une sous-étape                     | **3 à 8**  |
| Outils inertes sans raison écrite                       | **0**      |
| Outils du registre devenus inatteignables               | **0**      |
| Contour fermé sans pièce, non signalé                   | **0**      |
| Écart d'un contour ouvert, non chiffré                  | **0**      |
| Pièce saisie à 4,00 m intérieurs, mesurée à l'intérieur | **4,00 m** |
| Traits de grille à moins de 4 px d'intervalle           | **0**      |

Chacun se vérifie par un test, sinon ce n'est pas un seuil.
