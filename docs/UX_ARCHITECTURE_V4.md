# Architecture UX V4 — sept espaces, et le plan au milieu

> **Statut** : architecture de référence. Remplace la navigation décidée en V2
> (`UX_REDESIGN_V2.md`) et la couche de guidage prévue en V3
> (`UX_REDESIGN_V3.md` §4 à §7). Les deux documents restent lisibles comme
> journal de décision ; celui-ci est celui qu'on applique.

## 0. Ce que V4 décide, et ce qu'elle abandonne

V2 répondait à « comment ranger toutes les fonctionnalités ». V3 a commencé à
répondre à « de quoi la personne a-t-elle besoin maintenant », et s'est mise à
construire une **couche de navigation** pour le dire : macro-phases,
sous-étapes, prochaine action recommandée. C'est cette couche-là que V4
abandonne.

Pas l'intelligence : **le raisonnement**. Une interface n'a pas à raconter à
quelqu'un où il en est dans son projet. Elle a à mettre sous sa main les
quelques outils qui servent là où il est, et à se taire.

| Décidé en V3                             | Devient en V4                                          |
| ---------------------------------------- | ------------------------------------------------------ |
| 9 étapes de création                     | **7 onglets**, fixes, jamais renégociés                |
| 5 macro-phases regroupant les étapes     | supprimé                                               |
| sous-étapes comme niveau de navigation   | **sous-parties** de l'onglet courant, une seule rangée |
| « prochaine action recommandée » en tête | supprimé — reste le point `●` sur un bouton du header  |
| `DesignState` + prédicats (V3-1, V3-2)   | **conservés tels quels**, et rendus invisibles         |

Ce que V3 avait mis au programme et qui **survit intégralement**, déplacé mais
pas perdu :

| Item V3 | Ce qu'il devient en V4                                                 |
| ------- | ---------------------------------------------------------------------- |
| V3-3    | grille en millimètres → **barre d'état**, en bas                       |
| V3-4    | face de référence du mur → **paramètre immédiat** de `BÂTIMENT › Murs` |
| V3-5    | contours ouverts détectés → **dessiné dans le plan**, pas listé        |
| V3-6    | phases et prochaine action → **abandonné**                             |
| V3-7    | types de maison → **`PROJET › Maison`**                                |
| V3-8    | pièce rectangulaire cotée → **`BÂTIMENT › Pièces`**                    |
| V3-9    | modes de cotation, outil Mesurer → **barre d'état** et header          |

Et l'acquis technique de V3 devient le moteur silencieux de V4 : `DesignState`
dit ce que la maison **est**, les prédicats disent quels boutons servent, et
personne ne voit ni l'un ni l'autre. Un escalier ne s'affiche pas sur une
maison de plain-pied — non pas parce qu'une étape est verrouillée, mais parce
que le modèle n'a qu'un niveau.

---

## 1. Les sept espaces

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ PROJET │ TERRAIN │ BÂTIMENT │ AMÉNAGEMENT │ SYSTÈMES │ ÉTUDES │ DOCUMENTS │  │
├──────────────────────────────────────────────────────────────────────────────┤
│ sous-parties de l'onglet courant                                             │
├──────────────────────────────────────────────────────────────────────────────┤
│ outils de la sous-partie          ·         paramètres de l'outil actif      │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│                              PLAN DE TRAVAIL                                 │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│ RDC │ grille 10 cm │ snap ● │ ortho ● │ cotes Auto │ 1:50 │ x 4,20 y 2,80 m  │
└──────────────────────────────────────────────────────────────────────────────┘
```

Sept, parce que sept est le nombre de parties qu'une maison a quand on la
décrit à quelqu'un : le projet, le terrain, le bâti, ce qu'on met dedans, ce
qui circule dans les murs, ce qu'on vérifie, ce qu'on sort. Aucun autre onglet
principal ne sera ajouté ; une fonction nouvelle trouve sa sous-partie.

### 1.1 Où va ce qui disparaît de la navigation

Rien n'est supprimé. Neuf étapes deviennent sept onglets, et treize
destinations trouvent chacune un domicile.

| Étape V3    | Devient                                    |
| ----------- | ------------------------------------------ |
| `PROJECT`   | **Projet**                                 |
| `SITE`      | **Terrain**                                |
| `BUILDING`  | **Bâtiment**                               |
| `STRUCTURE` | **Bâtiment › Structure** — une sous-partie |
| `FITTING`   | **Aménagement**                            |
| `SYSTEMS`   | **Systèmes**                               |
| `ENERGY`    | **Systèmes › Solaire** et **› Stockage**   |
| `CHECKS`    | **Études**                                 |
| `DOCUMENTS` | **Documents**                              |

| Destination    | Devient                                                        |
| -------------- | -------------------------------------------------------------- |
| `project`      | Projet › Général                                               |
| `plan`         | le plan de travail — il est toujours là, ce n'est pas un lieu  |
| `building`     | Projet › Niveaux (édition) et Bâtiment › Niveaux (dessin)      |
| `materials`    | ouvert depuis une propriété, et depuis « Autres modèles… »     |
| `assemblies`   | idem                                                           |
| `openings`     | idem, depuis le header Ouvertures                              |
| `equipment`    | idem, depuis le header Aménagement et Systèmes                 |
| `networks`     | Systèmes — la liste des réseaux est l'en-tête de la spécialité |
| `calculations` | Études › la spécialité concernée                               |
| `quantities`   | Études › Quantités                                             |
| `scenarios`    | Études › Comparer                                              |
| `checks`       | Études › Vue d'ensemble                                        |
| `documents`    | Documents                                                      |

L'invariant tient et se renforce : **aucune destination ne devient
inatteignable**, et un test le refuse.

---

## 2. Le header du plan

Trois zones, deux lignes, et la seconde n'existe que si quelque chose l'occupe.

```text
BÂTIMENT › MURS     [↖] [Mur] [Continu] [Rectangle] [Cloison] [+]     300 mm · Extérieur
────────────────────────────────────────────────────────────────────────────────────────
Assemblage [Ossature bois ▼]   Référence [Face intérieure ▼]   Hauteur [2500 mm]
```

- **À gauche** : où l'on est. `ONGLET › SOUS-PARTIE`, et rien d'autre.
- **Au centre** : de trois à huit boutons. Le premier est toujours `↖`
  (Sélection). Le dernier est toujours `+`, qui contient le reste.
- **À droite** : le résumé des paramètres de l'outil actif, en lecture seule.
  Vide quand aucun outil n'est actif.
- **Seconde ligne** : les paramètres eux-mêmes, éditables. **Elle n'apparaît
  que si un outil est actif et qu'il a des options.** Elle disparaît avec lui.

Le compte de trois à huit n'est pas une préférence : c'est ce qu'on balaie d'un
regard sans lire. Un header qui en demande neuf a une sous-partie de trop.

### 2.1 Le `+` n'est pas une poubelle

Ce qui va dans `+` : les outils de la même sous-partie dont on se sert une fois
par projet, les variantes rares d'un outil déjà présent, et les opérations de
retouche (`Décaler`, `Joindre`, `Ajuster`, `Scinder`) qui appartiennent à
plusieurs sous-parties à la fois.

Ce qui n'y va **jamais** : un outil qu'aucun autre header ne propose. Le `+`
range, il ne cache pas. La recherche et la palette continuent d'atteindre les
vingt-cinq outils du registre depuis n'importe où.

### 2.2 L'inspecteur n'est pas un panneau

Il n'y a pas de colonne de propriétés permanente. L'inspecteur apparaît à
droite **quand un objet est sélectionné**, et disparaît au clic dans le vide.
Le plan récupère toute la largeur, ce qui est la seule chose qu'il demande.

Le bouton « Inspecteur » de la barre supérieure est une **épingle**, pas un
interrupteur : enfoncé, le panneau reste ouvert même sans rien de désigné, et
montre alors les propriétés de la vue — un objet a des propriétés, une vue
aussi. Au repos il n'est pas enfoncé.

---

## 3. Comment lire les tableaux qui suivent

Une ligne = un bouton du header. Les colonnes :

| Colonne                  | Ce qu'elle dit                                                         |
| ------------------------ | ---------------------------------------------------------------------- |
| **Bouton**               | le libellé, tel qu'on le lit                                           |
| **Outil · pré-rempli**   | l'outil du registre, et les options que l'entrée choisit d'avance      |
| **Paramètres immédiats** | ce que la seconde ligne montre quand cet outil est actif               |
| **Prérequis**            | le prédicat `enabledWhen`, et la raison écrite quand il n'est pas tenu |
| **État**                 | ce qu'il reste à faire pour l'avoir                                    |

État :

- ✅ **l'outil et la fiche existent** — c'est une entrée à écrire, rien de plus.
- ◐ **l'outil existe, il lui manque quelque chose** — une option, une commande,
  une famille de catalogue. Le travail est nommé en §11.
- ✗ **le modèle ne sait pas encore** — à ouvrir avant, et §11 dit quoi.

Les prédicats sont ceux de `apps/web/src/editor/toolbox.ts`, lus contre le
`DesignState` de `apps/web/src/ux/design-state.ts`. Les familles de catalogue
sont celles de `packages/equipment-catalog/data/equipment` : aucune fiche n'est
écrite en dur, une entrée nomme une famille et le catalogue installé répond.

---

## 4. PROJET

Le seul onglet qui ne dessine pas. Le plan de travail y cède la place à un
formulaire, et le header ne porte que les sous-parties.

```text
Général │ Maison │ Niveaux │ Localisation │ Modules
```

### 4.1 Général

| Champ       | État |
| ----------- | ---- |
| Nom         | ✅   |
| Description | ✅   |
| Auteur      | ✅   |
| Unité       | ✅   |

### 4.2 Maison

C'est la réponse à « qu'est-ce que je construis », et c'est ce qui manquait le
plus : aujourd'hui un projet neuf est un plan vide et un seul niveau.

| Champ            | Valeurs                                                                 | État |
| ---------------- | ----------------------------------------------------------------------- | ---- |
| Type de bâtiment | Plain-pied · R+1 · R+2 · Sous-sol + RDC · Sous-sol + R+1 · Personnalisé | ◐    |
| Forme initiale   | Libre · Rectangle · L · T · U                                           | ◐    |
| Largeur          | mètres                                                                  | ◐    |
| Profondeur       | mètres                                                                  | ◐    |
| Dimensions       | ● intérieures ○ extérieures                                             | ◐    |

Choisir un type **crée les niveaux**, avec leurs hauteurs sous plafond par
défaut. Choisir une forme **trace les murs extérieurs** du contour demandé, à
l'aide de `WALL_RUN` avec `closed: YES`, aux dimensions données et à la face de
référence choisie.

> **Ce que ça ne fait jamais** : verrouiller. Un R+1 dont on supprime l'étage
> redevient un plain-pied, et rien ne proteste. Le type de bâtiment n'est pas
> stocké comme une vérité du projet : c'est un geste de création, et ce qui
> compte ensuite est ce que la maison a.

Une petite vue schématique montre la forme choisie et ses deux cotes. Elle est
dessinée, pas photographiée — le même moteur que le plan, à petite échelle.

### 4.3 Niveaux

Après `R+1`, la liste est déjà écrite :

```text
Étage       2,50 m
RDC         2,50 m
+ Ajouter un niveau
```

Trois colonnes, pas davantage : le nom, la hauteur sous plafond, et le geste de
suppression. L'éditeur de pile actuel (`LevelStackEditor`) reste accessible
sous **« Édition avancée »** : le modèle sait déjà tenir sous-sol, RDC, étage,
mezzanine, combles et niveau technique, et cette richesse-là a sa place — mais
pas devant quelqu'un qui veut deux étages de 2,50 m. ✅ pour la liste simple,
l'éditeur existe déjà.

### 4.4 Localisation

| Champ                | État          |
| -------------------- | ------------- |
| Adresse              | ✅            |
| Pays                 | ✅            |
| Orientation Nord     | ✅            |
| Altitude             | ✅            |
| Coordonnées avancées | ✅ (repliées) |

### 4.5 Modules

Les seize métiers de `DESIGN_DOMAINS`, en cases à cocher. Le mécanisme existe
déjà et il est correct : `domainsInPlay()` ajoute d'office tout métier dont le
projet tient des objets, si bien qu'**une case décochée ne fait jamais
disparaître le travail de quelqu'un**. Ces cases ne désactivent rien : elles
décident de ce que `Systèmes` et `Études` proposent. ✅

---

## 5. TERRAIN

```text
Parcelle │ Implantation │ Accès │ Éléments │ Réseaux extérieurs
```

### 5.1 Parcelle

| Bouton      | Outil · pré-rempli        | Paramètres immédiats | Prérequis | État |
| ----------- | ------------------------- | -------------------- | --------- | ---- |
| ↖ Sélection | `SELECT`                  | —                    | —         | ✅   |
| Parcelle    | `SITE` · `target=PARCEL`  | Nom                  | —         | ✅   |
| Zone exclue | `SITE` · `kind=EXCLUSION` | Nom                  | —         | ✅   |
| Coter       | `DIMENSION`               | Type de cote         | —         | ✅   |
| Mesurer     | `MEASURE`                 | —                    | —         | ✗    |

**`+`** — Retrait réglementaire, Servitude, Zone constructible. ✗ : le modèle
tient un contour de parcelle et des obstacles, il ne tient pas encore de
prescription réglementaire géométrique.

La surface du terrain et le périmètre s'affichent dans le plan dès que le
contour est fermé, comme les surfaces de pièces. ◐

### 5.2 Implantation

| Bouton          | Outil · pré-rempli      | Paramètres immédiats | Prérequis                                      | État |
| --------------- | ----------------------- | -------------------- | ---------------------------------------------- | ---- |
| ↖ Sélection     | `SELECT`                | —                    | —                                              | ✅   |
| Pivoter         | `ROTATE`                | Angle                | `wallCount > 0` — « Tracez d'abord les murs. » | ✅   |
| Miroir          | `MIRROR`                | Axe                  | `wallCount > 0`                                | ✅   |
| Distance limite | `MEASURE` · `to=PARCEL` | —                    | contour de parcelle                            | ✗    |

**`+`** — Aligner sur une limite, Recentrer sur la parcelle. ✗

Sélectionner la maison entière et lui donner une orientation et deux distances
aux limites est le geste que cette sous-partie doit rendre trivial ; il demande
une notion de « bâtiment » comme objet déplaçable, que le modèle n'a pas encore
(§11).

### 5.3 Accès

| Bouton      | Outil · pré-rempli                    | Paramètres immédiats | Prérequis | État |
| ----------- | ------------------------------------- | -------------------- | --------- | ---- |
| ↖ Sélection | `SELECT`                              | —                    | —         | ✅   |
| Terrasse    | `SLAB` · `role=TERRACE`               | Assemblage · Contour | —         | ✅   |
| Allée       | `SITE` · `kind=OTHER`, `name=Allée`   | Nom                  | —         | ◐    |
| Parking     | `SITE` · `kind=OTHER`, `name=Parking` | Nom                  | —         | ◐    |
| Route       | `SITE` · `kind=OTHER`, `name=Voirie`  | Nom                  | —         | ◐    |

**`+`** — Chemin, Rampe.

◐ franc : ces quatre-là sont aujourd'hui des « obstacles de nature Autre » avec
un nom. Ils se dessinent et se calculent en surface, mais le modèle ne sait pas
qu'une allée est une allée. §11 propose d'étendre `SiteObstacleKind`, ce qui est
une ligne de domaine et une étiquette.

### 5.4 Éléments

| Bouton          | Outil · pré-rempli                             | Paramètres immédiats | Prérequis | État |
| --------------- | ---------------------------------------------- | -------------------- | --------- | ---- |
| ↖ Sélection     | `SELECT`                                       | —                    | —         | ✅   |
| Arbre           | `SITE` · `kind=TREE`                           | Hauteur · Nom        | —         | ✅   |
| Bâtiment voisin | `SITE` · `kind=BUILDING`                       | Hauteur · Nom        | —         | ✅   |
| Puits           | `COMPONENT` · `category=OTHER`, famille `WELL` | Nom · Altitude       | —         | ✅   |
| Cuve            | `COMPONENT` · famille `SITE_RAINWATER_TANK`    | Nom · Altitude       | —         | ✅   |
| Forage          | `COMPONENT` · famille `BOREHOLE`               | Nom · Altitude       | —         | ✅   |

**`+`** — Clôture, Haie, Mur de clôture, Portail, Piscine. ✗ pour les cinq : ni
famille de catalogue, ni type d'obstacle. §11.

### 5.5 Réseaux extérieurs

| Bouton         | Outil · pré-rempli                              | Paramètres immédiats | Prérequis | État |
| -------------- | ----------------------------------------------- | -------------------- | --------- | ---- |
| ↖ Sélection    | `SELECT`                                        | —                    | —         | ✅   |
| Arrivée eau    | `COMPONENT` · famille `WATER_PUBLIC_CONNECTION` | Nom                  | —         | ✅   |
| Électricité    | `COMPONENT` · famille `ELECTRICAL_SERVICE_BOX`  | Nom                  | —         | ✅   |
| Égout          | `COMPONENT` · famille `PUBLIC_SEWER_CONNECTION` | Nom                  | —         | ✅   |
| Assainissement | `COMPONENT` · famille `SITE_SEPTIC_TANK`        | Nom                  | —         | ✅   |
| Eaux pluviales | `COMPONENT` · famille `SITE_RAINWATER_CHAMBER`  | Nom                  | —         | ✅   |
| Télécom        | `COMPONENT` · famille `FIBER_TERMINATION`       | Nom                  | —         | ✅   |

**`+`** — Compteur, Regard d'eau, Regard d'égout, Micro-station, Drain
périphérique, Piquet de terre. Familles `UTILITY_METER`, `WATER_CHAMBER`,
`SEWER_CHAMBER`, `SITE_MICRO_TREATMENT_PLANT`, `SITE_DRAIN`, `SITE_EARTH_ROD` —
toutes ✅, simplement rares.

---

## 6. BÂTIMENT

L'onglet central. Huit sous-parties, et c'est le seul qui en a autant.

```text
Niveaux │ Murs │ Pièces │ Ouvertures │ Dalles │ Escalier │ Toiture │ Structure
```

### 6.1 Niveaux

Pas d'outil : la sous-partie **change de niveau actif** et rien d'autre. Une
rangée de boutons, un par niveau, du haut vers le bas, avec le niveau courant
enfoncé. `+ Ajouter` renvoie à `PROJET › Niveaux`. ✅

### 6.2 Murs

| Bouton      | Outil · pré-rempli                 | Paramètres immédiats                                | Prérequis       | État |
| ----------- | ---------------------------------- | --------------------------------------------------- | --------------- | ---- |
| ↖ Sélection | `SELECT` · `family=WALL`           | —                                                   | —               | ✅   |
| Mur         | `WALL` · `role=EXTERIOR`           | Assemblage · Rôle · **Référence** · Épaisseur (lue) | —               | ◐    |
| Continu     | `WALL_RUN` · `role=EXTERIOR`       | idem + Fermer le contour                            | —               | ◐    |
| Rectangle   | `WALL_RECTANGLE` · `role=EXTERIOR` | idem + Dimensions intérieures                       | —               | ◐    |
| Cloison     | `WALL` · `role=PARTITION`          | Assemblage · **Référence**                          | —               | ◐    |
| Coter       | `DIMENSION`                        | Type de cote                                        | `wallCount > 0` | ✅   |

**`+`** — Décaler, Joindre, Ajuster, Scinder, Mesurer. Les quatre premiers ✅,
Mesurer ✗.

Le ◐ des quatre premiers est **la face de référence**. Le modèle la porte
(`Wall.referenceSide` : `CENTER`, `LEFT`, `RIGHT`) et l'inspecteur la modifie ;
les outils de tracé ne l'offrent pas, si bien qu'on dessine à l'axe et qu'on
corrige après — ce qui est exactement l'inverse de la façon dont on lit un plan
d'architecte.

> **Une honnêteté à ne pas perdre en route.** Le modèle dit gauche et droite,
> **relatives au sens du tracé**, et refuse de dire lequel des deux côtés est
> l'intérieur : ça n'appartient pas à un mur, ça appartient à l'enceinte. Le
> header peut donc offrir « Axe · Face intérieure · Face extérieure » **là où le
> sens de parcours est connu** — un contour fermé, un rectangle — et retombe sur
> « Axe · Gauche · Droite » sur un mur isolé. Écrire « intérieur » là où le
> modèle ne peut pas le savoir serait une promesse qu'un mur en L trahirait.

### 6.3 Pièces

| Bouton      | Outil · pré-rempli             | Paramètres immédiats       | Prérequis                                       | État |
| ----------- | ------------------------------ | -------------------------- | ----------------------------------------------- | ---- |
| ↖ Sélection | `SELECT` · `family=SPACE`      | —                          | —                                               | ✅   |
| Pièce       | `SPACE`                        | Nom · Catégorie · Étendue  | ● si `contoursWithoutSpace > 0`                 | ✅   |
| Rectangle   | `SPACE` · saisie de deux cotes | Largeur · Profondeur · Nom | —                                               | ◐    |
| Séparer     | `WALL` · `role=PARTITION`      | Assemblage                 | `spaceCount > 0` — « Créez d'abord une pièce. » | ✅   |
| Coter       | `DIMENSION`                    | Type de cote               | `wallCount > 0`                                 | ✅   |

**`+`** — Fusionner, Mesurer. ✗ tous les deux : fusionner deux pièces demande
une commande que le modèle n'a pas (§11), et se fait aujourd'hui en supprimant
la cloison qui les sépare.

Deux choses se dessinent **dans le plan**, pas dans un panneau :

```text
┌─────────────────────────┐        ┌─────────────────────────┐
│                         │        │                         │
│       Chambre           │        │       14,72 m²          │
│       12,42 m²          │        │     + Créer pièce       │
│                         │        │                         │
└─────────────────────────┘        └─────────────────────────┘
       une pièce                   un contour fermé sans pièce
```

La détection des contours et le calcul des surfaces existent déjà
(`detectRooms`) ; `DesignState.contoursWithoutSpace` les compte depuis V3-1. Ce
qui manque est l'affichage de l'étiquette flottante et son bouton. ◐

### 6.4 Ouvertures

| Bouton      | Outil · pré-rempli                                     | Paramètres immédiats       | Prérequis                                                | État |
| ----------- | ------------------------------------------------------ | -------------------------- | -------------------------------------------------------- | ---- |
| ↖ Sélection | `SELECT` · `family=OPENING`                            | —                          | —                                                        | ✅   |
| Porte       | `OPENING` · `openingType=DOOR`                         | Largeur · Hauteur          | `wallCount > 0` — « Tracez d'abord un mur. » → outil Mur | ✅   |
| Fenêtre     | `OPENING` · `openingType=WINDOW`                       | Largeur · Hauteur · Allège | `wallCount > 0`                                          | ✅   |
| Baie        | `OPENING` · `WINDOW`, `widthMm=2400`, `sillHeightMm=0` | Largeur · Hauteur          | `wallCount > 0`                                          | ✅   |
| Trémie      | `OPENING` · `openingType=VOID`                         | Largeur · Hauteur          | `wallCount > 0`                                          | ✅   |

**`+`** — Ouverture libre (`OTHER`), Autres modèles… (ouvre la bibliothèque de
menuiseries). ✅

Le bouton **Autres modèles…** est la seule porte vers `openings`, et il suffit :
personne ne « va dans les menuiseries », on y va parce qu'une fenêtre en
demande une.

### 6.5 Dalles

| Bouton      | Outil · pré-rempli                      | Paramètres immédiats | Prérequis                                                          | État |
| ----------- | --------------------------------------- | -------------------- | ------------------------------------------------------------------ | ---- |
| ↖ Sélection | `SELECT` · `family=SLAB`                | —                    | —                                                                  | ✅   |
| Dalle auto  | `SLAB` · `role=FLOOR`, `outline=ROOM`   | Assemblage           | `closedContours.length > 0` — « Fermez d'abord un contour. » → Mur | ✅   |
| Dalle libre | `SLAB` · `role=FLOOR`, `outline=POINTS` | Assemblage           | —                                                                  | ✅   |
| Terrasse    | `SLAB` · `role=TERRACE`                 | Assemblage           | —                                                                  | ✅   |
| Trémie      | `SLAB_HOLE`                             | —                    | `slabCount > 0` — « Posez une dalle. » → Dalle auto                | ✅   |

**`+`** — Plafond (`role=CEILING`), Fondation (`role=FOUNDATION`). ✅

### 6.6 Escalier

**La sous-partie entière disparaît du header quand `levelCount < 2`.** C'est
exactement l'usage que V4 fait des prédicats de V3-2 : pas un bouton grisé qui
explique, mais une sous-partie qui ne se pose pas. Sur une maison de plain-pied
il n'y a pas d'escalier à dessiner, et il n'y a rien à expliquer.

L'outil reste atteignable par la recherche et la palette, comme les
vingt-quatre autres.

| Bouton                | Outil · pré-rempli             | Paramètres immédiats      | Prérequis        | État |
| --------------------- | ------------------------------ | ------------------------- | ---------------- | ---- |
| ↖ Sélection           | `SELECT`                       | —                         | —                | ✅   |
| Droit                 | `STAIR` · `stairType=STRAIGHT` | Marches · Giron · Largeur | `levelCount ≥ 2` | ✅   |
| Quart tournant        | `STAIR` · `stairType=L_SHAPED` | idem                      | `levelCount ≥ 2` | ✅   |
| Deux quarts tournants | `STAIR` · `stairType=U_SHAPED` | idem                      | `levelCount ≥ 2` | ✅   |
| Hélicoïdal            | `STAIR` · `stairType=SPIRAL`   | idem                      | `levelCount ≥ 2` | ✅   |

**`+`** — Trémie d'escalier (`SLAB_HOLE`). ✅

### 6.7 Toiture

| Bouton      | Outil · pré-rempli                             | Paramètres immédiats        | Prérequis                                                   | État |
| ----------- | ---------------------------------------------- | --------------------------- | ----------------------------------------------------------- | ---- |
| ↖ Sélection | `SELECT`                                       | —                           | —                                                           | ✅   |
| Toit auto   | `ROOF` · `outline=WALLS`                       | Pente · Débord · Assemblage | `closedContours.length > 0` ; ● si `roofSurfaceCount === 0` | ✅   |
| 2 pans      | `ROOF` · `outline=WALLS`, deux pignons opposés | idem                        | idem                                                        | ◐    |
| 1 pan       | `ROOF` · `outline=WALLS`, trois pignons        | idem                        | idem                                                        | ◐    |
| 4 pans      | `ROOF` · `outline=WALLS`, aucun pignon         | idem                        | idem                                                        | ✅   |
| Pan libre   | `ROOF` · `outline=POINTS`                      | idem                        | —                                                           | ✅   |

**`+`** — Ouverture de toit (`OPENING` · `VOID` sur une toiture), Débord
personnalisé. ◐

Le ◐ de « 2 pans » et « 1 pan » : le nombre de pans n'est pas un paramètre de
la toiture, c'est la nature de chacun de ses côtés (`RoofEdgeKind` :
`SLOPED` ou `GABLE`). L'inspecteur les change déjà un par un ; ces deux boutons
demandent une commande qui les pose d'un coup à partir du contour tracé.

### 6.8 Structure

| Bouton      | Outil · pré-rempli        | Paramètres immédiats           | Prérequis       | État |
| ----------- | ------------------------- | ------------------------------ | --------------- | ---- |
| ↖ Sélection | `SELECT`                  | —                              | —               | ✅   |
| Mur porteur | `WALL` · `role=EXTERIOR`  | Assemblage · Référence         | —               | ✅   |
| Poteau      | `COLUMN` · `kind=COLUMN`  | Largeur · Profondeur · Hauteur | —               | ✅   |
| Poutre      | `BEAM`                    | Largeur · Hauteur              | —               | ✅   |
| Fondation   | `COLUMN` · `kind=FOOTING` | Largeur · Profondeur · Hauteur | —               | ✅   |
| Trémie      | `SLAB_HOLE`               | —                              | `slabCount > 0` | ✅   |

**`+`** — Dalle porteuse (`SLAB` · `role=FOUNDATION`). ✅

---

## 7. AMÉNAGEMENT

Le plus visuel des sept. Chaque bouton pose une fiche : on clique, on place,
c'est fini.

```text
Mobilier │ Cuisine │ Salle de bain │ Électroménager │ Extérieur
```

Tous les boutons de cet onglet utilisent `COMPONENT`, avec la catégorie et la
famille pré-remplies. Les paramètres immédiats sont partout les mêmes — **Nom ·
Altitude sur le niveau · Modèle catalogue** — et ne sont donc pas répétés
ligne à ligne.

### 7.1 Mobilier

| Bouton  | Famille    | État |
| ------- | ---------- | ---- |
| Lit     | `BED`      | ✅   |
| Canapé  | `SOFA`     | ✅   |
| Table   | `TABLE`    | ✅   |
| Chaise  | `CHAIR`    | ✅   |
| Armoire | `WARDROBE` | ✅   |
| Bureau  | `DESK`     | ✅   |

**`+`** — Étagère (`SHELF`), Meuble (`CABINET`). ✅

### 7.2 Cuisine

| Bouton          | Famille           | État |
| --------------- | ----------------- | ---- |
| Meuble bas      | `KITCHEN_CABINET` | ✅   |
| Plan de travail | `WORKTOP`         | ✅   |
| Évier           | `KITCHEN_SINK`    | ✅   |
| Plaque          | `HOB`             | ✅   |
| Four            | `OVEN`            | ✅   |
| Réfrigérateur   | `REFRIGERATOR`    | ✅   |

**`+`** — Meuble haut, Évier double (`DOUBLE_SINK`), Micro-ondes (`MICROWAVE`),
Hotte. Meuble haut et Hotte : ✗, pas de famille. Les deux autres ✅.

### 7.3 Salle de bain

| Bouton    | Famille       | État |
| --------- | ------------- | ---- |
| WC        | `WC`          | ✅   |
| Douche    | `SHOWER_TRAY` | ✅   |
| Baignoire | `BATHTUB`     | ✅   |
| Lavabo    | `WASHBASIN`   | ✅   |
| Meuble    | `CABINET`     | ✅   |

**`+`** — WC suspendu (`WALL_HUNG_WC`), Douche à l'italienne (`WALK_IN_SHOWER`),
Double vasque (`DOUBLE_WASHBASIN`), Bidet (`BIDET`). ✅

### 7.4 Électroménager

| Bouton         | Famille           | État |
| -------------- | ----------------- | ---- |
| Réfrigérateur  | `REFRIGERATOR`    | ✅   |
| Four           | `OVEN`            | ✅   |
| Plaque         | `HOB`             | ✅   |
| Lave-vaisselle | `DISHWASHER`      | ✅   |
| Lave-linge     | `WASHING_MACHINE` | ✅   |
| Sèche-linge    | `DRYER`           | ✅   |

**`+`** — Congélateur (`FREEZER`), Micro-ondes (`MICROWAVE`). ✅

### 7.5 Extérieur

| Bouton              | Famille                | État |
| ------------------- | ---------------------- | ---- |
| Table de jardin     | `TABLE`                | ✅   |
| Éclairage extérieur | `SITE_EXTERIOR_LIGHT`  | ✅   |
| Prise extérieure    | `SITE_EXTERIOR_SOCKET` | ✅   |
| Borne de recharge   | `SITE_EV_CHARGER`      | ✅   |
| Robinet extérieur   | `OUTDOOR_TAP`          | ✅   |

**`+`** — Pompe à chaleur extérieure (`OUTDOOR_HEAT_PUMP`). ✅

---

## 8. SYSTÈMES

Une spécialité à la fois, et **elle change tout le header**. C'est le seul
onglet dont la sous-partie est un menu déroulant plutôt qu'une rangée : douze
métiers ne tiennent pas sur une ligne, et on n'en lit qu'un.

```text
Spécialité : [ Eau ▼ ]
```

Les douze : Eau · Évacuation · Eaux pluviales · Chauffage · Ventilation ·
Électricité · Éclairage · Courants faibles · Sécurité · Conduits de fumée ·
Solaire · Stockage. **Seules celles que `PROJET › Modules` laisse en jeu sont
proposées** — le mécanisme existe (`domainsOfStage`), y compris la règle qui
rend une spécialité que le projet fait déjà vivre.

Trois choses sont communes aux douze et ne sont donc pas répétées :

- **Prérequis des tronçons** : `networkCount > 0`, raison « Créez d'abord un
  réseau. » Le geste qui débloque est le bouton **Réseau** du même header.
- **Paramètres de `NETWORK_ROUTE`** : Réseau · Pente · Montée en fin de tracé.
- **`+` commun** : Dériver (`NETWORK_BRANCH`), Nœud libre (`NETWORK`), Coter.

Rappel du modèle : `NetworkDiscipline` en tient sept — `WATER`, `WASTEWATER`,
`RAINWATER`, `VENTILATION`, `HEATING`, `ELECTRICAL`, `OTHER`. Éclairage,
courants faibles, sécurité et conduits tracent donc sur `ELECTRICAL` ou `OTHER`
selon le cas. Ce n'est pas une lacune à combler à la légère : les nœuds
disponibles découlent de la discipline, et en ajouter demande d'écrire leurs
ports.

### 8.1 Eau (`PLUMBING` → réseau `WATER`)

| Bouton       | Outil · pré-rempli                             | Paramètres immédiats | État |
| ------------ | ---------------------------------------------- | -------------------- | ---- |
| ↖ Sélection  | `SELECT`                                       | —                    | ✅   |
| Arrivée      | `NETWORK` · `nodeKind=SOURCE`                  | Réseau               | ✅   |
| Nourrice     | `NETWORK` · `nodeKind=JUNCTION`                | Réseau               | ✅   |
| Canalisation | `NETWORK_ROUTE`                                | Réseau · Pente       | ✅   |
| Puisage      | `NETWORK` · `nodeKind=FIXTURE`                 | Réseau               | ✅   |
| Chauffe-eau  | `COMPONENT` · `SANITARY` / `ELECTRIC_DHW_TANK` | Nom · Altitude       | ✅   |

**`+`** — Vanne (`ISOLATION_VALVE`), Réducteur de pression (`PRESSURE_REDUCER`),
Compteur (`WATER_METER`), Adoucisseur (`WATER_SOFTENER`), Mitigeur thermostatique
(`THERMOSTATIC_MIXER`), Groupe de sécurité (`SAFETY_GROUP`). ✅

### 8.2 Évacuation (`WASTEWATER`)

| Bouton               | Outil · pré-rempli                        | Paramètres immédiats | État |
| -------------------- | ----------------------------------------- | -------------------- | ---- |
| ↖ Sélection          | `SELECT`                                  | —                    | ✅   |
| Appareil             | `NETWORK` · `nodeKind=FIXTURE`            | Réseau               | ✅   |
| Évacuation           | `NETWORK_ROUTE` · `slopePercent=2`        | Réseau · **Pente**   | ✅   |
| Chute                | `NETWORK_ROUTE` · `riseMm` renseigné      | Réseau · Montée      | ✅   |
| Regard               | `NETWORK` · `nodeKind=INSPECTION_CHAMBER` | Réseau               | ✅   |
| Exutoire             | `NETWORK` · `nodeKind=OUTLET`             | Réseau               | ✅   |
| Ventilation primaire | `COMPONENT` · famille `VENT_STACK`        | Nom                  | ✅   |

**`+`** — Siphon (`TRAP`), Culotte (`WYE`), Tampon (`CLEANOUT`), Clapet
(`BACKWATER_VALVE`), Bac à graisse (`GREASE_TRAP`), Pompe de relevage
(`LIFTING_STATION`). ✅

La pente est déjà le défaut du modèle sur cette discipline — 2 % — et elle doit
**se voir sur le plan** : une évacuation horizontale est une évacuation qui ne
s'écoule pas, et personne ne devrait avoir à ouvrir un inspecteur pour le
découvrir. ◐

### 8.3 Eaux pluviales (`RAINWATER`)

| Bouton      | Outil · pré-rempli                 | Paramètres immédiats | État |
| ----------- | ---------------------------------- | -------------------- | ---- |
| ↖ Sélection | `SELECT`                           | —                    | ✅   |
| Descente    | `NETWORK` · `nodeKind=SOURCE`      | Réseau               | ✅   |
| Gouttière   | `COMPONENT` · famille `GUTTER`     | Nom                  | ✅   |
| Collecteur  | `NETWORK_ROUTE` · `slopePercent=2` | Réseau · Pente       | ✅   |
| Cuve        | `NETWORK` · `nodeKind=TANK`        | Réseau               | ✅   |
| Exutoire    | `NETWORK` · `nodeKind=OUTLET`      | Réseau               | ✅   |

**`+`** — Filtre (`RAIN_FILTER`), Trop-plein (`OVERFLOW`), Puisard (`SOAKAWAY`),
Noue (`SWALE`), Bassin de rétention (`RETENTION_BASIN`). ✅

### 8.4 Chauffage (`HEATING`)

| Bouton             | Outil · pré-rempli                             | Paramètres immédiats | État |
| ------------------ | ---------------------------------------------- | -------------------- | ---- |
| ↖ Sélection        | `SELECT`                                       | —                    | ✅   |
| Générateur         | `NETWORK` · `nodeKind=SOURCE`                  | Réseau               | ✅   |
| Radiateur          | `COMPONENT` · `HEATING` / `RADIATOR`           | Nom · Altitude       | ✅   |
| Plancher chauffant | `COMPONENT` · `HEATING` / `UNDERFLOOR_HEATING` | Nom                  | ✅   |
| Collecteur         | `NETWORK` · `nodeKind=JUNCTION`                | Réseau               | ✅   |
| Tuyau              | `NETWORK_ROUTE`                                | Réseau               | ✅   |
| Thermostat         | `COMPONENT` · `HEATING` / `ROOM_THERMOSTAT`    | Nom                  | ✅   |

**`+`** — Pompe à chaleur (`HEAT_PUMP_AIR_WATER_MONOBLOC`), Chaudière
(`BOILER_GAS`), Sèche-serviettes (`TOWEL_RADIATOR`), Ballon tampon
(`BUFFER_TANK`), Vanne trois voies (`THREE_WAY_VALVE`), Circulateur
(`CIRCULATOR`). ✅

### 8.5 Ventilation (`VENTILATION`)

| Bouton            | Outil · pré-rempli                              | Paramètres immédiats | État |
| ----------------- | ----------------------------------------------- | -------------------- | ---- |
| ↖ Sélection       | `SELECT`                                        | —                    | ✅   |
| VMC               | `NETWORK` · `nodeKind=FAN`                      | Réseau               | ✅   |
| Bouche extraction | `NETWORK` · `nodeKind=TERMINAL`                 | Réseau               | ✅   |
| Bouche soufflage  | `COMPONENT` · `VENTILATION` / `SUPPLY_TERMINAL` | Nom · Altitude       | ✅   |
| Entrée d'air      | `NETWORK` · `nodeKind=INTAKE`                   | Réseau               | ✅   |
| Gaine             | `NETWORK_ROUTE`                                 | Réseau               | ✅   |
| Piquage           | `NETWORK` · `nodeKind=JUNCTION`                 | Réseau               | ✅   |

**`+`** — Té (`VENTILATION_TEE`), Coude (`VENTILATION_ELBOW`), Réduction
(`VENTILATION_REDUCER`), Silencieux (`SILENCER`), Sortie de toiture
(`EXHAUST_TERMINAL`), Registre (`DAMPER`). ✅

### 8.6 Électricité (`ELECTRICAL`)

| Bouton       | Outil · pré-rempli                                     | Paramètres immédiats | État |
| ------------ | ------------------------------------------------------ | -------------------- | ---- |
| ↖ Sélection  | `SELECT`                                               | —                    | ✅   |
| Tableau      | `COMPONENT` · `ELECTRICAL` / `MAIN_DISTRIBUTION_BOARD` | Nom · Altitude       | ✅   |
| Prise        | `COMPONENT` · `ELECTRICAL` / `SOCKET_16A`              | Nom · Altitude       | ✅   |
| Interrupteur | `COMPONENT` · `ELECTRICAL` / `SWITCH`                  | Nom · Altitude       | ✅   |
| Circuit      | `NETWORK` · `nodeKind=CIRCUIT`                         | Réseau               | ✅   |
| Câble        | `NETWORK_ROUTE`                                        | Réseau               | ✅   |
| Boîte        | `COMPONENT` · `ELECTRICAL` / `JUNCTION_BOX`            | Nom                  | ✅   |

**`+`** — Prise double (`DOUBLE_SOCKET`), Va-et-vient (`TWO_WAY_SWITCH`), Sortie
de câble (`CABLE_OUTLET`), Borne de recharge (`EV_CHARGER`), Tableau divisionnaire
(`SUB_DISTRIBUTION_BOARD`), Prise de terre (`EARTH_ROD`), Goulotte
(`CABLE_TRAY`). ✅

### 8.7 Éclairage (`LIGHTING`)

| Bouton      | Outil · pré-rempli                         | Paramètres immédiats | État |
| ----------- | ------------------------------------------ | -------------------- | ---- |
| ↖ Sélection | `SELECT`                                   | —                    | ✅   |
| Luminaire   | `COMPONENT` · `LIGHTING` / `CEILING_LIGHT` | Nom · Altitude       | ✅   |
| Spot        | `COMPONENT` · `LIGHTING` / `DOWNLIGHT`     | Nom · Altitude       | ✅   |
| Applique    | `COMPONENT` · `LIGHTING` / `WALL_LIGHT`    | Nom · Altitude       | ✅   |
| Suspension  | `COMPONENT` · `LIGHTING` / `PENDANT`       | Nom · Altitude       | ✅   |
| Circuit     | `NETWORK_ROUTE`                            | Réseau               | ✅   |

**`+`** — Ruban LED (`LED_STRIP`), Détecteur de présence (`PRESENCE_SENSOR`),
Éclairage de sécurité (`EMERGENCY_LIGHT`), Extérieur (`EXTERIOR_LIGHT`). ✅

### 8.8 Courants faibles (`DATA`)

| Bouton      | Outil · pré-rempli                          | Paramètres immédiats | État |
| ----------- | ------------------------------------------- | -------------------- | ---- |
| ↖ Sélection | `SELECT`                                    | —                    | ✅   |
| Baie        | `COMPONENT` · `OTHER` / `NETWORK_RACK`      | Nom                  | ✅   |
| Prise RJ45  | `COMPONENT` · `OTHER` / `RJ45_SOCKET`       | Nom · Altitude       | ✅   |
| Box         | `COMPONENT` · `OTHER` / `ROUTER`            | Nom                  | ✅   |
| Borne Wi-Fi | `COMPONENT` · `OTHER` / `WIFI_ACCESS_POINT` | Nom · Altitude       | ✅   |
| Câble       | `NETWORK_ROUTE`                             | Réseau               | ✅   |

**`+`** — Fibre (`FIBER_TERMINATION`), Switch (`NETWORK_SWITCH`), Panneau de
brassage (`PATCH_PANEL`), Caméra (`CAMERA`), Interphone (`INTERCOM`), Capteur
(`MOTION_SENSOR`, `CO2_SENSOR`, `LEAK_SENSOR`). ✅

### 8.9 Sécurité (`SAFETY`)

| Bouton             | Outil · pré-rempli                                    | Paramètres immédiats | État |
| ------------------ | ----------------------------------------------------- | -------------------- | ---- |
| ↖ Sélection        | `SELECT`                                              | —                    | ✅   |
| Détecteur de fumée | `COMPONENT` · `OTHER` / `SMOKE_DETECTOR`              | Nom · Altitude       | ✅   |
| Détecteur CO       | `COMPONENT` · `OTHER` / `CO_DETECTOR`                 | Nom · Altitude       | ✅   |
| Centrale d'alarme  | `COMPONENT` · `OTHER` / `ALARM_PANEL`                 | Nom                  | ✅   |
| Extincteur         | `COMPONENT` · `OTHER` / `EXTINGUISHER`                | Nom                  | ✅   |
| Coupure d'urgence  | `COMPONENT` · `OTHER` / `ELECTRICAL_EMERGENCY_CUTOFF` | Nom                  | ✅   |

**`+`** — Sirène (`SIREN`), Contact de porte (`DOOR_CONTACT`), Détecteur
d'intrusion (`SAFETY_MOTION_DETECTOR`), Bloc de secours
(`SAFETY_EMERGENCY_LIGHT`), Couverture anti-feu (`FIRE_BLANKET`). ✅

### 8.10 Conduits de fumée (`FLUE`)

| Bouton           | Outil · pré-rempli                         | Paramètres immédiats | État |
| ---------------- | ------------------------------------------ | -------------------- | ---- |
| ↖ Sélection      | `SELECT`                                   | —                    | ✅   |
| Poêle à bois     | `COMPONENT` · `HEATING` / `WOOD_STOVE`     | Nom · Altitude       | ✅   |
| Poêle à granulés | `COMPONENT` · `HEATING` / `PELLET_STOVE`   | Nom · Altitude       | ✅   |
| Insert           | `COMPONENT` · `HEATING` / `WOOD_INSERT`    | Nom · Altitude       | ✅   |
| Conduit          | `NETWORK_ROUTE` · `riseMm` renseigné       | Réseau · Montée      | ✅   |
| Sortie de toit   | `COMPONENT` · `OTHER` / `CHIMNEY_TERMINAL` | Nom                  | ✅   |

**`+`** — Cheminée ouverte (`FIREPLACE`), Tubage (`FLEXIBLE_LINER`), Té
(`FLUE_TEE`), Coude (`FLUE_ELBOW`), Traversée de plancher (`FLOOR_PASSAGE`),
Amenée d'air (`COMBUSTION_AIR_INTAKE`). ✅

### 8.11 Solaire (`SOLAR`)

| Bouton      | Outil · pré-rempli                               | Paramètres immédiats | Prérequis                                                     | État |
| ----------- | ------------------------------------------------ | -------------------- | ------------------------------------------------------------- | ---- |
| ↖ Sélection | `SELECT`                                         | —                    | —                                                             | ✅   |
| Panneaux    | `COMPONENT` · `PHOTOVOLTAIC` / `PV_ARRAY`        | Nom · Altitude       | `roofSurfaceCount > 0` — « Dessinez la toiture. » → Toit auto | ✅   |
| Onduleur    | `COMPONENT` · `PHOTOVOLTAIC` / `STRING_INVERTER` | Nom                  | —                                                             | ✅   |
| Câble DC    | `NETWORK_ROUTE`                                  | Réseau               | —                                                             | ✅   |
| Coffret DC  | `COMPONENT` · `PHOTOVOLTAIC` / `DC_COMBINER`     | Nom                  | —                                                             | ✅   |

**`+`** — Micro-onduleur (`MICROINVERTER`), Optimiseur (`OPTIMIZER`), Sectionneur
(`DC_ISOLATOR`), Compteur de production (`PRODUCTION_METER`), Champ au sol
(`GROUND_PV_ARRAY`). ✅

### 8.12 Stockage (`STORAGE`)

| Bouton      | Outil · pré-rempli                              | Paramètres immédiats | État |
| ----------- | ----------------------------------------------- | -------------------- | ---- |
| ↖ Sélection | `SELECT`                                        | —                    | ✅   |
| Batterie    | `COMPONENT` · `ELECTRICAL` / `BATTERY_RACK`     | Nom                  | ✅   |
| Onduleur    | `COMPONENT` · `ELECTRICAL` / `BATTERY_INVERTER` | Nom                  | ✅   |
| Coupure     | `COMPONENT` · `ELECTRICAL` / `BATTERY_ISOLATOR` | Nom                  | ✅   |
| Liaison     | `NETWORK_ROUTE`                                 | Réseau               | ✅   |

**`+`** — Module (`BATTERY_MODULE`), BMS (`BMS`), Passerelle de secours
(`BACKUP_GATEWAY`), Inverseur (`ATS`). ✅

---

## 9. ÉTUDES

Un seul onglet pour tout ce qui **lit** le bâtiment au lieu de le dessiner :
vérifications, calculs, quantités, comparaisons. Aucun outil de dessin, donc
aucun header d'outils — le header porte les sous-parties, et le plan de travail
laisse la place à une page.

```text
Vue d'ensemble │ Architecture │ Structure │ Thermique │ … │ Quantités │ Comparer
```

**Seules les spécialités que le projet fait vivre apparaissent.** Le mécanisme
existe et se lit dans `moduleInScope()` : un module qu'aucun métier en jeu ne
réclame n'est pas proposé, et il tourne quand même si on le lui demande. Un
projet sans photovoltaïque n'affiche donc pas une ligne « Photovoltaïque —
vide » : il n'affiche pas de ligne du tout. ✅

### 9.1 Vue d'ensemble

Une page, et une seule information par ligne :

```text
Architecture        ✓
Structure           ⚠ 2 points
Thermique           ✓
Eau                 ✓
Évacuation          ⚠ pente insuffisante sur 1 tronçon
Électricité         ✓
Ventilation         ● calcul disponible

Surface habitable   112,4 m²
Emprise au sol       78,3 m²

[ Voir les 3 points à vérifier ]
```

Trois états et pas un de plus : **✓** tenu, **⚠** un écart nommé, **●** un
calcul qu'on peut lancer et qui ne l'a pas été. Cliquer une ligne ouvre son
détail ; cliquer un écart ouvre l'objet dans le plan — ce dernier geste existe
déjà. ◐ pour la page elle-même.

---

## 10. DOCUMENTS

Inchangé. C'est la partie qui marche.

```text
Vues │ Feuilles │ Nomenclatures │ Exports
```

| Sous-partie   | Ce qu'elle porte                                               | État |
| ------------- | -------------------------------------------------------------- | ---- |
| Vues          | plans par niveau et par métier, coupes, façades, plan de masse | ✅   |
| Feuilles      | mise en page, cartouche, échelles                              | ✅   |
| Nomenclatures | tableaux d'objets, filtrés par métier                          | ✅   |
| Exports       | PDF, DXF, IFC, JSON                                            | ✅   |

Le header d'outils de `Vues` porte les annotations, qui sont les seuls outils de
dessin de cet onglet :

| Bouton      | Outil       | Paramètres immédiats | État |
| ----------- | ----------- | -------------------- | ---- |
| ↖ Sélection | `SELECT`    | —                    | ✅   |
| Coter       | `DIMENSION` | Type de cote         | ✅   |
| Annoter     | `NOTE`      | Texte · Hauteur      | ✅   |

---

## 11. Ce qui manque, nommé

Rien dans les tableaux ci-dessus n'est laissé en « à voir ». Voici les onze
manques, avec ce que chacun coûte.

| #   | Manque                                                                | Ce qu'il demande                                                                                                                                | Poids |
| --- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| 1   | ~~Outil **Mesurer**~~ — _livré_                                       | un vingt-sixième outil qui lit et n'écrit rien : il rend une phrase et rend la main                                                             | petit |
| 2   | ~~**Face de référence** au tracé~~ — _livré_                          | les trois outils l'offrent ; le parcours d'un rectangle est normalisé, pour que « faces intérieures » ne dépende pas du sens du glissement      | petit |
| 3   | **Cotes intérieures** et modes de cotation                            | le mode est dans la barre d'état depuis V4-6 ; restent ce qu'il fait dessiner et `detectRooms`, qui mesure encore les axes plutôt que les faces | moyen |
| 4   | ~~**Étiquette de surface** flottante et « + Créer pièce »~~ — _livré_ | `detectRooms` fournissait déjà le contour et l'aire ; restait à les écrire là où on les cherche                                                 | moyen |
| 5   | ~~**Types de maison** et **formes initiales**~~ — _livré_             | les formes existaient ; les types créent la pile d'un clic, et l'emprise est cotée à l'intérieur                                                | moyen |
| 6   | ~~**Pans de toiture** posés d'un coup~~ — _livré_                     | les pignons vont sur les côtés les plus courts ; l'inspecteur garde le dernier mot côté par côté                                                | petit |
| 7   | **Pente visible** sur une évacuation                                  | du dessin, et une lecture de `slopePercent` déjà stocké                                                                                         | petit |
| 8   | **Natures d'aménagement extérieur**                                   | étendre `SiteObstacleKind` : allée, parking, voirie, terrasse, piscine                                                                          | petit |
| 9   | **Clôture, haie, portail**                                            | soit des natures d'obstacle linéaires, soit des familles de catalogue — à décider avant d'écrire                                                | moyen |
| 10  | **Fusionner deux pièces**                                             | une commande de domaine ; aujourd'hui on supprime la cloison                                                                                    | moyen |
| 11  | **La maison comme objet déplaçable**                                  | une sélection « tout le bâti » et une transformation qui la porte, pour `TERRAIN › Implantation`                                                | gros  |

Aucun de ces onze n'est un préalable à la navigation : les sept onglets et les
headers peuvent être construits sur ce qui existe, et chaque manque se comble
ensuite sans rien déplacer.

---

## 12. Les invariants que V4 ne touche pas

Ils viennent de V2 et de V3, ils ont tenu, et ils tiennent encore :

1. **Aucun outil du registre ne devient inatteignable.** Sept onglets filtrent
   ce qui est proposé ; la recherche et la palette atteignent les vingt-cinq
   outils depuis n'importe où. Un test le refuse.
2. **Aucune destination ne devient inatteignable.** Les treize ont un domicile
   en §1.1. Un test le refuse.
3. **Rien ne se valide, rien ne se verrouille.** Un onglet est un état d'écran,
   jamais un état du projet. On peut poser l'électricité avant la toiture.
4. **Un bouton absent n'est jamais une punition.** Une sous-partie qui ne se
   pose pas — l'escalier sur un plain-pied — disparaît parce que la question ne
   se pose pas, et son outil reste atteignable.
5. **L'état est dérivé, jamais stocké.** Aucun drapeau ne dit qu'on a fini
   quelque chose. Ce qui compte est ce que la maison a.
6. **Une entrée nomme une famille, jamais une fiche.** Le catalogue installé
   répond ; une famille absente retire l'entrée plutôt que de promettre.

---

## 13. Plan d'implémentation

| Lot       | Ce qu'il fait                                                            | Dépend de |
| --------- | ------------------------------------------------------------------------ | --------- |
| **V4-1**  | _Livré._ Sept onglets ; Structure et Énergie fondues, Vérifier → Études  | —         |
| **V4-2**  | _Livré._ Sous-parties : une rangée, une seule ouverte, le métier suit    | V4-1      |
| **V4-3**  | _Livré._ Header du plan : outils contre le dessin, `+`, bandeau flottant | V4-2      |
| **V4-4**  | _Livré._ Le registre des headers — §5 à §10 écrits en données            | V4-3      |
| **V4-5**  | _Livré._ Inspecteur à la sélection, bouton devenu épingle                | V4-3      |
| **V4-6**  | _Livré._ Barre d'état : grille en cm, ortho, cotes, échelle, curseur     | V4-1      |
| **V4-7**  | _Partiel._ Face de référence au tracé ; les cotes intérieures suivent    | V4-4      |
| **V4-8**  | _Livré._ Surfaces écrites sur le plan, et « + Créer pièce » au contour   | V4-4      |
| **V4-9**  | _Livré._ Types de maison, et l'emprise cotée à l'intérieur               | V4-2      |
| **V4-10** | _Partiel._ Outil Mesurer et pans de toiture ; la pente reste à dessiner  | V4-4      |
| **V4-11** | _Livré._ `ÉTUDES › Vue d'ensemble` : une ligne par métier, deux surfaces | V4-2      |
| **V4-12** | Natures d'extérieur et fusion de pièces (manques 8, 9, 10)               | V4-4      |

Le manque 11 — la maison comme objet — n'est dans aucun lot : il se décide à
part, parce qu'il touche le modèle et pas l'écran.

---

## 14. Ce qu'on mesure

Un seuil qu'on ne mesure pas n'est pas un seuil. `scripts/measure-shell.mjs`
vérifie déjà les quatre premiers ; les deux derniers demandent un compteur
nouveau.

| Seuil                                              | Cible        | Aujourd'hui              |
| -------------------------------------------------- | ------------ | ------------------------ |
| Chrome vertical hors plan, au repos, en 1024 × 768 | **≤ 146 px** | **116 px**               |
| Chrome vertical avec la seconde ligne d'outils     | **≤ 182 px** | **116 px** — elle flotte |
| Plan visible, en 1024 × 768                        | **≥ 60 %**   | 58 %                     |
| Boutons visibles dans le header d'outils           | **3 à 8**    | 5 à 8 ; 2 en colonne     |
| Clics pour le premier mur d'un projet neuf         | **≤ 3**      | 3                        |
| Clics pour changer de sous-partie                  | **1**        | 1                        |

Les 146 px se décomposaient : navigation 42, sous-parties 34, outils 42, barre
d'état 28. Ce qui les a financés n'est pas ce qu'on croyait : ce sont les deux
rangées supérieures fondues en une — le nom de l'application partage la sienne
avec les sept espaces — et la barre de vue dissoute, son niveau déjà écrit dans
la barre d'état et son métier devenu la rangée des sous-parties. Quatre rangées
sont devenues trois : **116 px**, contre 153 avant la V4 et 306 avant la
refonte.

La seconde ligne d'options ne pousse rien : elle **flotte** sur la marge haute
du dessin, et seuls ses contrôles répondent au pointeur. Une rangée qui pousse
le plan en apparaissant le fait changer de taille, la caméra se remet à
l'échelle, et le point qu'on visait n'est plus là. Trente-quatre pixels de
bandeau translucide coûtent infiniment moins qu'un plan qui bouge sous la
main.
