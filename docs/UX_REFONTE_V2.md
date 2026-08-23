# Refonte de l'interface — spécification d'exécution v2

Ce document transforme l'audit UX en trois choses exécutables :

1. une **spécification écran par écran** de la coque cible ;
2. l'**architecture React exacte** — fichiers, composants, props, propriétaire
   de chaque état ;
3. un **plan de migration PR par PR**, dans un ordre où l'application reste
   utilisable après chacune.

Il ne remplace pas `docs/UX_ARCHITECTURE.md`, qui reste le contrat d'interface
en vigueur : chaque PR de ce plan met à jour la section du contrat qu'elle
change, dans la même PR que le code et les tests. Les deux documents ne doivent
jamais dire deux choses différentes en même temps.

**Périmètre.** Aucune ligne de `packages/*` n'est touchée, à l'exception
explicitement nommée en §7.3. Le moteur BIM, le moteur graphique, `view-query`,
`editor-core`, les catalogues et les calculs sont hors sujet. Ce chantier
recompose `apps/web/src` — et rien d'autre.

---

## 1. Le diagnostic, réduit à une règle

L'écran doit répondre en permanence, sans clic, à trois questions :

| Question                      | Réponse à l'écran                  |
| ----------------------------- | ---------------------------------- |
| **Où suis-je ?**              | `RDC · Architecture · 1:50`        |
| **Que puis-je faire ici ?**   | La boîte à outils de la discipline |
| **Qu'est-ce que j'ai pris ?** | La sélection, dans l'inspecteur    |

Corollaire, et c'est la règle de tri de toute la refonte :

> **Ce qui ne répond à aucune des trois questions quitte la navigation
> permanente.**

Un matériau, un assemblage, une quantité, un scénario, une vérification ne
répondent à aucune. Ce sont des données et des résultats ; ils reviennent là où
on les demande — dans les propriétés d'un objet, dans un panneau de résultats,
dans un compteur.

---

## 2. Quatre axes, et leur nom dans le code

L'audit en distingue trois. Il en existe **quatre** depuis que le profil
graphique est devenu choisissable (PR43), et les confondre est exactement le
défaut que le chantier corrige. Ils sont indépendants et se combinent librement.

| Axe            | Question                    | État aujourd'hui                                | Où il ira                 |
| -------------- | --------------------------- | ----------------------------------------------- | ------------------------- |
| **Lieu**       | Quel niveau, quelle vue ?   | `EditorState.levelId`                           | Barre de vue + navigateur |
| **Métier**     | Sur quoi je travaille ?     | `activeDomain: DesignDomainId` (état de `main`) | Barre de vue              |
| **Rendu**      | Comment c'est dessiné ?     | `PLAN_RENDERINGS` / `graphicProfileId`          | Barre de vue → Affichage  |
| **Visibilité** | Qu'est-ce qui est dessiné ? | `EditorState.presetId` + `EditorState.layers`   | Affichage                 |

Deux pièges nommés une fois pour toutes :

- le « **PROFIL** » du panneau Affichage de l'audit est un **preset de calques**
  (`LAYER_PRESETS`, 8 entrées) : _quoi afficher_. Ce n'est pas la charte
  graphique (`PLAN_RENDERINGS`) : _comment dessiner_. Les deux vivent dans le
  même panneau, sur deux lignes distinctes et étiquetées comme telles ;
- une **discipline** (`DesignDomainId`, 16 entrées) n'est pas un **groupe
  d'outils** (`ToolGroup`, 8 entrées) ni un **calque** (`PLAN_LAYERS`, 28
  entrées). Le mapping des trois est spécifié en §7.

---

## 3. Navigation principale : trois modes

### 3.1 Ce qui remplace quoi

```text
avant   PROJET · CONSTRUIRE · SYSTÈMES · ANALYSER · DOCUMENTS      (rail, 5)
après   MODÉLISER · ANALYSER · DOCUMENTS                           (barre haute, 3)
        + menu « Projet » dans la barre haute
        + discipline dans la barre de vue
```

`PrimaryRail` (colonne de lettres P/B/S/A/D) disparaît. Les trois modes
deviennent un segmenté dans `TopBar` : trois entrées ne méritent pas une
colonne, et la colonne rendue est celle dont le navigateur a besoin.

### 3.2 Le type

`apps/web/src/ux/work-modes.ts` (nouveau) :

```ts
export const WORK_MODES = ['MODEL', 'ANALYZE', 'DOCUMENT'] as const;
export type WorkMode = (typeof WORK_MODES)[number];

export interface WorkModeDescriptor {
  readonly id: WorkMode;
  readonly label: string; // Modéliser | Analyser | Documents
  readonly shortcut: string; // M | A | D
  readonly description: string;
}
```

`PrimaryWorkspace` **n'est pas supprimé au premier jour** : il est réduit à un
alias de compatibilité pendant la migration (§9, PR45), puis retiré en PR56.
`UiTarget.workspace`, la palette, `checks-model`, `WorkflowGuide` et
`workspaceOfDomain()` le lisent tous ; les casser en même temps que la coque
serait une refonte fonctionnelle déguisée.

### 3.3 Où vont les treize destinations

`LEGACY_WORKSPACE_TABS` en compte treize (le contrat en dit « onze » : la prose
a vieilli, le tableau ci-dessous fait foi).

| Destination    | Aujourd'hui | Demain                                                       |
| -------------- | ----------- | ------------------------------------------------------------ |
| `project`      | PROJECT     | **Menu Projet** (barre haute) — plus une destination         |
| `plan`         | BUILD/…     | **MODEL** — l'unique destination du mode                     |
| `building`     | BUILD       | **Navigateur** (niveaux) + inspecteur du niveau              |
| `materials`    | BUILD       | **Bibliothèque**, ouverte depuis une propriété (§6.8)        |
| `assemblies`   | BUILD       | idem                                                         |
| `openings`     | BUILD       | idem                                                         |
| `equipment`    | BUILD       | idem                                                         |
| `networks`     | SYSTEMS     | **MODEL**, discipline technique active (§6.5)                |
| `calculations` | ANALYZE     | **ANALYZE**                                                  |
| `quantities`   | ANALYZE     | **ANALYZE**                                                  |
| `scenarios`    | ANALYZE     | **ANALYZE**                                                  |
| `checks`       | ANALYZE     | **ANALYZE** (+ compteur permanent en barre d'état, inchangé) |
| `documents`    | DOCUMENTS   | **DOCUMENT**                                                 |

Règle inchangée et vérifiée par test : **aucune destination ne devient
inatteignable**. Ce qui quitte la navigation devient joignable par `UiTarget`,
par la palette, ou par le bouton qui l'ouvre là où elle sert.

### 3.4 Ce que chaque mode contient

| Mode          | Colonne gauche                                                        | Centre               | Colonne droite |
| ------------- | --------------------------------------------------------------------- | -------------------- | -------------- |
| **MODÉLISER** | Navigateur + Boîte à outils                                           | Plan                 | Propriétés     |
| **ANALYSER**  | Navigateur + Résultats (calculs, quantités, scénarios, vérifications) | Plan + superposition | Propriétés     |
| **DOCUMENTS** | Navigateur + Vues et feuilles                                         | Aperçu/plan          | Propriétés     |

Le navigateur et l'inspecteur ne bougent jamais. Seul le tiers bas de la colonne
gauche change avec le mode — c'est ce qui fait qu'on ne se perd pas.

---

## 4. La coque cible

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ Mini-BIM │ Projet ▾ │ ↶ ↷ │  MODÉLISER · Analyser · Documents  │ 🔍 ⌘K    │ TopBar
├────────────────────────────────────────────────────────────────────────────┤
│ NAVIGATEUR    │ RDC ▾ │ Architecture ▾ │ Affichage ▾ │ 1:50 ▾ │ ⊙ │ ⛶    │ ViewBar
│ ─────────     ├──────────────────────────────────────────┬─────────────────┤
│ ▸ Site        │ Mur │ Extérieur ▾ │ Mur 300 ▾ │ H 2.50 m │ PROPRIÉTÉS      │ ContextToolBar
│ ▾ Bâtiment    ├──────────────────────────────────────────┤                 │
│   • RDC   ●   │                                          │ Mur extérieur   │
│   • Étage     │                                          │ ─────────────   │
│   • Toiture   │                                          │ Géométrie       │
│ ▸ Vues        │              PLAN                        │ Construction    │
│ ▸ Documents   │                                          │ Identification  │
│ ─────────     │                                          │                 │
│ OUTILS        │                                          │                 │
│ ▱ Mur  🚪 Porte│      « Cliquez le point de départ »      │                 │
│ ▤ Fen. ▣ Pièce│                                          │                 │
│ ▰ Dalle ⌂ Toit│                                          │                 │
│ + Autres      │                                          │                 │
├───────────────┴──────────────────────────────────────────┴─────────────────┤
│ RDC · 4 250 ; 1 800 mm │ ⊞ Grille ⌁ Extrémités │ 1 objet │ ⚑ 12 constats  │ StatusBar
└────────────────────────────────────────────────────────────────────────────┘
```

Trois zones à apprendre : **gauche = où / quoi créer**, **centre = le
bâtiment**, **droite = propriétés**. Tout le reste est contextuel.

---

## 5. Grille et dimensions

`AppShell` garde ses fentes, moins le rail. La grille passe de cinq à quatre
colonnes.

| Zone             | Largeur / hauteur | Repliable | Redimensionnable |
| ---------------- | ----------------- | --------- | ---------------- |
| `TopBar`         | 48–52 px          | non       | non              |
| `ViewBar`        | 36–40 px          | non       | non              |
| Colonne gauche   | 240–320 px (240)  | oui       | oui              |
| `ContextToolBar` | 34–38 px          | non¹      | non              |
| Canvas           | le reste          | —         | —                |
| Inspecteur       | 280–360 px (300)  | oui       | oui              |
| `StatusBar`      | 30–34 px          | non       | non              |

¹ La barre contextuelle garde sa place même vide (`is-empty`, déjà implémenté) :
une barre qui apparaît déplace le dessin sous le pointeur.

`shell/workspace-layout.ts` (`WorkspaceLayout`, `gridColumns`, `boundedWidth`,
`loadLayout`/`saveLayout`) est conservé tel quel — il ne connaît que des largeurs
et ne sait rien du nombre d'espaces. `DEFAULT_LAYOUT.sidebarPx` passe de 220 à
240 (le navigateur et la boîte à outils partagent la colonne).

---

## 6. Écran par écran

Chaque section dit : **rôle**, **contenu exact**, **états**, **composant**.

### 6.1 `TopBar` — identité, projet, modes, recherche

**Rôle.** Ce qui ne dépend ni du niveau, ni de la discipline, ni de la sélection.

**Contenu, de gauche à droite :**

1. `Mini-BIM` (titre, non cliquable) ;
2. **`Projet ▾`** — menu (nouveau) : Nouveau, Ouvrir, Enregistrer, Exporter le
   JSON, Exporter le SVG, Informations du projet, Périmètre de conception,
   Localisation et climat, Maison de démonstration ;
3. `↶ ↷` annuler / rétablir ;
4. **segmenté des trois modes**, avec `aria-current="page"` sur l'actif ;
5. `🔍` — ouvre la palette (le même `Ctrl+K`), **visible** ;
6. bascules de panneaux : navigateur, inspecteur.

**Ce qui change.** `TopBarProps` passe de `{eyebrow, title, actions}` à une
forme nommée : les boutons ne sont plus un `ReactNode` opaque, sinon rien
n'empêche la barre de regrossir.

```ts
export interface TopBarProps {
  readonly title: string;
  readonly projectMenu: ReactNode; // <ProjectMenu/>
  readonly history: ReactNode; // annuler / rétablir
  readonly mode: WorkMode;
  readonly onSelectMode: (mode: WorkMode) => void;
  readonly onOpenPalette: () => void;
  readonly panels: ReactNode; // bascules navigateur / inspecteur
}
```

**Nouveau composant.** `shell/ProjectMenu.tsx` — un `<details>`/`<dialog>` sans
état global, qui reçoit des `onX` et rien d'autre.

### 6.2 Colonne gauche — navigateur en haut, outils en bas

**Rôle.** Où je suis dans le bâtiment ; ce que je peux créer ici.

Deux sections empilées dans une colonne unique, séparées par un séparateur
horizontal redimensionnable (le navigateur prend la hauteur qu'on lui donne, la
boîte à outils le reste, minimum 30 % chacun).

`shell/ContextPanel.tsx` disparaît sous sa forme actuelle : il ne servait qu'à
lister les destinations de l'espace, et il n'y a plus de destinations à lister.
Il est remplacé par `shell/LeftColumn.tsx`, qui compose :

```tsx
<LeftColumn
  navigator={<ProjectNavigator … />}
  tools={mode === 'MODEL' ? <Toolbox … /> : <ModePanel … />}
  splitPx={layout.navigatorPx}
  onResize={(navigatorPx) => changeLayout({ navigatorPx })}
/>
```

### 6.3 `ProjectNavigator` — l'arborescence, promue

**Rôle.** La table des matières du projet. Permanente, jamais derrière
`☰ Modèle`.

**Contenu :**

```text
PROJET
├─ Site                       → sélectionne le terrain
├─ Bâtiment
│   ├─ Sous-sol
│   ├─ RDC              ●     → change de niveau
│   ├─ Étage
│   └─ Toiture
│   └─ (niveau actif) Murs (24) · Pièces (8) · Ouvertures (12) · …
├─ Vues
│   ├─ Plan architectural     → rendu + preset de calques
│   ├─ Structure
│   ├─ Électricité
│   └─ Plomberie
└─ Documents
    ├─ Plan RDC 1:50          → mode DOCUMENT + vue enregistrée
    └─ …
```

**Ce qui existe déjà.** `shell/ProjectTree.tsx` fait Site + Bâtiment + familles
du niveau actif, avec `LISTED_PER_FAMILY = 40` et un repli par famille. Il est
conservé et **étendu** de deux sections : `Vues` et `Documents`.

**Props (étendues) :**

```ts
export interface ProjectNavigatorProps {
  readonly project: Project;
  readonly levelId?: string;
  readonly selection: readonly string[];
  readonly view: ViewState; // niveau + discipline + rendu
  readonly onSelectLevel: (levelId: string) => void;
  readonly onSelectObject: (objectId: string) => void;
  readonly onFrameObject: (objectId: string) => void;
  readonly onSelectView: (view: SavedViewRef) => void; // nouveau
  readonly onNavigate: (target: UiTarget) => void; // nouveau
}
```

**Règle.** Un clic sur un niveau change le niveau **et rien d'autre**. Un clic
sur une vue applique un rendu **et** un preset de calques, jamais un niveau : une
vue qui déplacerait l'étage sous les pieds serait une destination déguisée.

### 6.4 `Toolbox` — outils par discipline, icône + libellé

**Rôle.** Ce que je peux créer, ici, maintenant.

**Forme.** Grille de deux colonnes, bouton = icône 24 px + mot court, l'actif en
`aria-pressed`. Jamais d'icône seule pour un outil courant.

```text
ARCHITECTURE
▱ Mur        🚪 Porte
▤ Fenêtre    ▣ Pièce
▰ Dalle      ⌂ Toiture
▸ Autres outils (7)

COMMUNS
↖ Sélection  ✥ Déplacer
⟲ Pivoter    ⇄ Miroir
```

**Ce qui change par rapport à `ToolsPanel` :**

| Aujourd'hui                                  | Demain                                                |
| -------------------------------------------- | ----------------------------------------------------- |
| Colonne de libellés, groupés par `ToolGroup` | Grille icône + libellé, groupés par **discipline**    |
| Tous les groupes peuplés, tout le temps      | La discipline active + les communs                    |
| `ToolOptions` sous l'outil, dans le panneau  | Les options montent dans la `ContextToolBar` (§6.7)   |
| `isCommon = toolAtLevel(tool, 'DESIGN')`     | inchangé : `QUICK`+`DESIGN` visibles, `EXPERT` replié |

**Ce qui ne change pas.** Pas de mode simple / mode expert. Les outils avancés
sont à un dépliage, sur le même écran, pour tout le monde (critère 15).

### 6.5 `ViewBar` — la barre de vue, permanente

**Rôle.** Les quatre axes, toujours à la même place, toujours lisibles sans
clic.

```text
RDC ▾ │ Architecture ▾ │ Affichage ▾ │ 1:50 ▾ │ ⊙ Isoler │ ⛶ Ajuster │ Variante ▾
```

| Contrôle   | Lit / écrit                                         | Notes                                                                                                   |
| ---------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Niveau     | `EditorState.levelId`                               | `SET_LEVEL`, déjà existant                                                                              |
| Discipline | `activeDomain: DesignDomainId`                      | remplace `DisciplinePicker` ; liste = `technicalDomains()` + Architecture, Structure, Terrain, Mobilier |
| Affichage  | ouvre `DisplayPanel` (§6.6)                         | libellé secondaire : « 3 calques masqués »                                                              |
| Échelle    | dérivée de `editor.camera.pixelsPerMm`              | choisir une échelle fixe la caméra ; `scaleDenominatorForZoom()` existe                                 |
| Isoler     | `layers` — n'affiche que la sélection et son calque | bascule ; un second clic rétablit                                                                       |
| Ajuster    | `view.zoomFit` (raccourci `f`, déjà existant)       | bouton visible pour le raccourci qui existe déjà                                                        |
| Variante   | `scenarioMode`                                      | déplacée depuis l'en-tête du canvas, inchangée par ailleurs                                             |

**Nouveau composant.** `shell/ViewBar.tsx`. Il ne détient aucun état : il reçoit
`ViewState` et des `onX`.

```ts
export interface ViewState {
  readonly levelId?: string;
  readonly domain: DesignDomainId;
  readonly renderingId: string; // PLAN_RENDERINGS
  readonly presetId: string; // LAYER_PRESETS
  readonly scaleDenominator: number;
  readonly isolated: boolean;
}
```

L'en-tête `panel-heading` du canvas (« Vue active / Plan · Rez-de-chaussée »)
**disparaît** : la barre de vue le dit mieux et en une ligne. Le canvas récupère
la hauteur.

### 6.6 `DisplayPanel` — un seul système de visibilité

**Rôle.** Ce qui est dessiné, et comment. Remplace `LayersPanel`
**et** `VisibilityPopover`.

```text
AFFICHAGE
──────────────────────────────
RENDU                          ← charte graphique, PLAN_RENDERINGS
 ● Plan architectural
 ○ Plan technique
 ○ Plan technique — FR

QUOI AFFICHER                  ← preset de calques, LAYER_PRESETS
 ● Architecture   ○ Matériaux
 ○ Plomberie      ○ Ventilation
 ○ Électricité    ○ Thermique
 ○ Synthèse       ○ Impression

3 calques masqués sur 28
──────────────────────────────
▸ Calque par calque            ← les 28 cases, inchangées
[ Tout afficher ]  [ Réinitialiser ]
```

**Suppressions.** `editor/LayersPanel.tsx` est supprimé. `visibility/
VisibilityPopover.tsx` devient `visibility/DisplayPanel.tsx` et gagne la ligne
« Rendu » et les deux boutons du bas.

**Pourquoi un seul.** Deux interfaces pour une question, c'est une question à
laquelle l'application répond deux fois — et un jour, différemment.

### 6.7 `ContextToolBar` — l'outil actif, puis la sélection

**Rôle.** Ce que l'outil ou la sélection rendent possible. Position : juste
au-dessus du canvas, sous la barre de vue.

**Outil actif** (nouveau — c'est ce qui descend de `ToolOptions`) :

```text
MUR │ Rôle: Extérieur ▾ │ Assemblage: Mur 300 mm ▾ │ Axe: centre ▾ │ H 2.50 m │ ↵ Terminer
```

**Sélection** (existe déjà, à étendre) :

```text
MUR SÉLECTIONNÉ │ ✥ Déplacer │ ⧉ Copier │ ⇥ Décaler │ ✂ Scinder │ ⇄ Miroir │ 🗑
3 OBJETS        │ ✥ Déplacer │ ⧉ Copier │ ⊨ Aligner ▾ │ ⇹ Distribuer │ ⇄ Miroir │ 🗑
```

**Règle de partage avec l'inspecteur, à ne jamais franchir :**

> **barre = actions rapides. inspecteur = propriétés.**

Une action modifie ; une propriété se lit et s'édite. `selectionCapabilities()`
(déjà existant) dit ce qui est possible ; ce qui ne l'est pas est grisé avec son
motif en `title`, jamais masqué.

**Invites de dessin.** Le texte « Cliquez le point de départ », puis
« Longueur / Angle », s'affiche **dans le canvas**, près du curseur — pas dans
la barre. `editor/DynamicInput.tsx` et `TemporaryDimensions.tsx` font déjà la
saisie ; il manque la phrase, qui se dérive de `toolDefinition(activeTool)` et
de `pendingPoints.length`.

### 6.8 `InspectorPanel` — les propriétés, et les bibliothèques

**Rôle.** Ce que l'objet sélectionné est. Conservé tel quel, avec deux ajouts.

**Rien de sélectionné** — il affiche aujourd'hui un texte d'attente. Il doit
afficher **les propriétés de la vue** :

```text
VUE : RDC — Architecture
Échelle 1:50   Grille 100 mm   Nord 0°   Rendu: Plan architectural
```

**Objet sélectionné** — inchangé, avec les groupes existants.

**Bibliothèques.** Un champ qui désigne une fiche de catalogue gagne un bouton
`Bibliothèque…` qui ouvre `CatalogPicker` **en surcouche**, filtré sur la
famille du champ. Matériaux, assemblages, menuiseries et équipements cessent
d'être des destinations ; leurs panneaux (`library/*Panel.tsx`) restent, ouverts
depuis là et depuis la palette.

### 6.9 `StatusBar` / `ShellStatusBar`

Inchangées. Le compteur de constats reste permanent en barre d'état, et nulle
part ailleurs (§8 ter du contrat).

### 6.10 Palette de commandes

Conservée intégralement. Elle change de rôle, pas de forme :

```text
débutant   clic → outil
régulier   clic ou raccourci
expert     Ctrl+K
```

Deux règles :

- un bouton `🔍` visible dans la barre haute, pour que la palette soit
  découvrable sans la connaître ;
- **plus aucun texte de l'interface ne renvoie à `Ctrl+K` comme moyen d'accès
  normal.** `ProjectTree` termine aujourd'hui ses longues listes par
  « cherchez-les avec Ctrl+K » : la liste tronquée gagne un bouton
  « Voir les 124 murs » qui ouvre la palette pré-filtrée.

---

## 7. Les trois mappings à écrire

C'est la partie du chantier qui contient une vraie décision, et non un
déplacement de composant.

### 7.1 Discipline → outils

`ToolGroup` (8) n'est pas `DesignDomainId` (16). La boîte à outils affiche la
discipline active ; il faut donc dire ce qu'une discipline offre.

`apps/web/src/editor/toolbox.ts` (nouveau) :

```ts
/** Les outils qu'une discipline propose, et dans quel ordre. */
export function toolboxOf(
  project: Project,
  domain: DesignDomainId,
): readonly ToolboxEntry[];

export interface ToolboxEntry {
  readonly id: string; // identifiant du bouton, unique
  readonly toolId: string; // EDITOR_TOOLS
  readonly label: string; // « Porte », pas « Ouverture »
  readonly icon: ToolIconId;
  readonly level: EditorLevel; // reprise du registre
  /** Options pré-remplies, pour un outil dérivé (§7.2). */
  readonly options?: Readonly<Record<string, string>>;
}
```

Correspondance de départ :

| Discipline                                                                                                                              | Source des outils                                |
| --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `ARCHITECTURE`                                                                                                                          | `ToolGroup.ARCHITECTURE`                         |
| `STRUCTURE`                                                                                                                             | `ToolGroup.STRUCTURE`                            |
| `SITE`                                                                                                                                  | `ToolGroup.SITE`                                 |
| `FURNITURE`                                                                                                                             | `COMPONENT` + catégories mobilier                |
| `PLUMBING`, `WASTEWATER`, `HEATING`, `VENTILATION`, `ELECTRICAL`, `LIGHTING`, `SOLAR`, `STORAGE`, `FLUE`, `DATA`, `SAFETY`, `RAINWATER` | `ToolGroup.NETWORKS` + `COMPONENT` dérivé (§7.2) |
| **Communs, toujours affichés**                                                                                                          | `SELECTION`, `MODIFICATION`, `ANNOTATION`        |

### 7.2 Les outils dérivés

L'audit demande que la plomberie propose `Lavabo`, `Douche`, `WC`,
`Chauffe-eau` — et l'électricité `Prise`, `Interrupteur`, `Luminaire`,
`Tableau`. Ce sont **le même outil** `COMPONENT` avec une catégorie et un modèle
pré-choisis.

> Décision : ne pas ajouter trente outils au registre. Un `ToolboxEntry` porte
> des `options`, et sélectionner l'entrée fait un `SET_TOOL` **plus** un
> pré-remplissage de `toolDrafts`.

C'est ce qui permet à la boîte à outils de parler la langue de l'utilisateur
(« WC ») sans que le registre cesse de parler celle du modèle (« composant
sanitaire »). Les fiches proposées viennent du catalogue installé, filtrées par
famille : la liste suit le catalogue et n'est pas écrite en dur.

### 7.3 Icônes

25 outils + les entrées dérivées. Contrainte du dépôt : pas de dépendance lourde
(`AGENTS.md`).

> Décision : `apps/web/src/editor/tool-icons.tsx`, un composant `<ToolIcon
id=… />` rendant un SVG en ligne de 24 px, `stroke="currentColor"`,
> `fill="none"`. Aucun paquet ajouté. Un identifiant inconnu rend l'initiale du
> libellé dans un carré — un outil sans icône reste cliquable.

C'est la seule addition d'actif graphique du chantier.

---

## 8. Architecture React cible

### 8.1 Arbre des composants

```text
App (main.tsx)
└─ AppShell
   ├─ topBar        TopBar
   │                ├─ ProjectMenu            ← nouveau
   │                ├─ HistoryButtons
   │                ├─ ModeSwitch             ← nouveau (remplace PrimaryRail)
   │                └─ PanelToggles
   ├─ viewBar       ViewBar                   ← nouveau (fente nouvelle)
   │                └─ DisplayPanel           ← visibility/ (fusion)
   ├─ left          LeftColumn                ← nouveau (remplace ContextPanel)
   │                ├─ ProjectNavigator       ← shell/ProjectTree étendu
   │                └─ Toolbox (MODEL)        ← editor/ToolsPanel refondu
   │                   ou ResultsPanel (ANALYZE)
   │                   ou DocumentsPanel (DOCUMENT)
   ├─ canvas        ContextToolBar + PlanCanvas + StatusBar
   ├─ inspector     InspectorPanel
   │                └─ CatalogPicker (surcouche, à la demande)
   ├─ statusBar     ShellStatusBar
   └─ overlays      CommandPalette · ObjectMenu · IssueCenter · modales
```

### 8.2 Fichiers

| Fichier                                 | Décision                                              |
| --------------------------------------- | ----------------------------------------------------- |
| `shell/AppShell.tsx`                    | **modifié** — fente `viewBar`, fente `rail` retirée   |
| `shell/PrimaryRail.tsx`                 | **supprimé** → `shell/ModeSwitch.tsx`                 |
| `shell/ContextPanel.tsx`                | **supprimé** → `shell/LeftColumn.tsx`                 |
| `shell/ProjectTree.tsx`                 | **étendu** → sections Vues et Documents               |
| `shell/TopBar.tsx`                      | **modifié** — props nommées                           |
| `shell/ProjectMenu.tsx`                 | **nouveau**                                           |
| `shell/ModeSwitch.tsx`                  | **nouveau**                                           |
| `shell/LeftColumn.tsx`                  | **nouveau**                                           |
| `shell/ViewBar.tsx`                     | **nouveau**                                           |
| `shell/workspace-layout.ts`             | **modifié** — `navigatorPx` ajouté                    |
| `shell/StatusBar.tsx`, `ShellStatusBar` | **inchangés**                                         |
| `editor/ToolsPanel.tsx`                 | **refondu** → `editor/Toolbox.tsx`                    |
| `editor/toolbox.ts`                     | **nouveau** — discipline → outils                     |
| `editor/tool-icons.tsx`                 | **nouveau**                                           |
| `editor/ToolOptions.tsx`                | **déplacé** — rendu par `ContextToolBar`              |
| `editor/ContextToolBar.tsx`             | **étendu** — options d'outil + actions de sélection   |
| `editor/LayersPanel.tsx`                | **supprimé**                                          |
| `visibility/VisibilityPopover.tsx`      | **renommé** `DisplayPanel.tsx`, étendu                |
| `editor/InspectorPanel.tsx`             | **étendu** — propriétés de vue, bouton Bibliothèque   |
| `systems/DisciplinePicker.tsx`          | **déplacé** dans `ViewBar` (menu déroulant)           |
| `ux/workspaces.ts`                      | **réduit** — compat pendant la migration, puis retiré |
| `ux/work-modes.ts`                      | **nouveau**                                           |
| `ux/navigation-state.ts`                | **modifié** — `ShellNavigation` v2                    |
| `ux/view-state.ts`                      | **nouveau** — les quatre axes en un objet             |
| `ux/view-profiles.ts`                   | **modifié** — `defaultPlanRendering(mode)`            |
| `ux/ui-target.ts`                       | **modifié** — `workspace` → `mode`, `domain` conservé |
| `main.tsx`                              | **allégé** — la composition change, la logique non    |

### 8.3 Qui détient quoi

| État                                                            | Propriétaire                      | Persisté ?                 |
| --------------------------------------------------------------- | --------------------------------- | -------------------------- |
| `WorkMode`                                                      | `main.tsx` (`ShellNavigation`)    | non                        |
| `ViewState` (niveau, discipline, rendu, preset, échelle, isolé) | `main.tsx` + `EditorState`        | non (sauf vue enregistrée) |
| `layers`, `presetId`, `activeTool`, `selection`, `camera`       | `EditorState` (`editor-state.ts`) | non                        |
| Largeurs et replis de panneaux                                  | `WorkspaceLayout` (localStorage)  | oui, hors fichier projet   |
| Périmètre de conception                                         | `Project.scope`                   | oui, dans le fichier       |

Règle inchangée (critère 9) : **les largeurs de panneaux ne voyagent jamais dans
le fichier projet**, le périmètre si.

### 8.4 Deux règles de composant

1. **Aucun composant ne navigue tout seul.** Tout passe par `navigateTo(target:
UiTarget)`, une seule fonction dans `main.tsx` (critère 10). Un composant qui
   appellerait `setLevel` _et_ `setMode` serait une seconde navigation.
2. **Aucun composant métier n'écrit une couleur** (critère 16). La liste des
   fichiers vérifiés s'allonge des nouveaux : `ModeSwitch`, `ViewBar`,
   `LeftColumn`, `Toolbox`, `DisplayPanel`. `tool-icons.tsx` est l'exception
   nommée : `currentColor` uniquement, jamais d'hexadécimal.

---

## 9. Plan de migration

Douze PR. Après chacune, l'application se construit, les tests passent, et
quelqu'un peut dessiner une maison. Aucune PR ne laisse deux interfaces pour la
même chose plus longtemps qu'elle-même.

| PR   | Objet                                          | Priorité |
| ---- | ---------------------------------------------- | -------- |
| PR45 | `WorkMode` et la navigation à trois modes      | P0       |
| PR46 | Le projet quitte la navigation                 | P0       |
| PR47 | Systèmes devient une discipline                | P0       |
| PR48 | La barre de vue                                | P0       |
| PR49 | Un seul panneau Affichage                      | P0       |
| PR50 | Le navigateur permanent                        | P0       |
| PR51 | La boîte à outils graphique                    | P0       |
| PR52 | Les options d'outil dans la barre contextuelle | P1       |
| PR53 | La sélection rend la barre contextuelle        | P1       |
| PR54 | Les bibliothèques rejoignent les propriétés    | P1       |
| PR55 | Recherche visible, niveaux d'outil clarifiés   | P2       |
| PR56 | Tests E2E par tâche, contrat mis à jour        | P0 final |

### PR45 — `WorkMode` et la navigation à trois modes

**Fait.** `ux/work-modes.ts` ; `ShellNavigation` v2 ; `PrimaryRail` remplacé par
`ModeSwitch` dans `TopBar` ; les treize destinations re-domiciliées selon §3.3.

**Ne fait pas.** Ne touche ni au panneau gauche, ni au canvas, ni à la
visibilité. `ContextPanel` survit à l'identique, avec une liste de destinations
plus courte.

**Contrats à mettre à jour dans la même PR :**
`ux/acceptance.test.ts` critères 1 et 2 (« exactement cinq entrées » → trois) ;
`ux/ux-contracts.test.ts` `describe('the five spaces')` → trois ;
`docs/UX_ARCHITECTURE.md` §2.

**Acceptation.** Les treize destinations restent atteignables (test existant,
inchangé) ; `M`/`A`/`D` atteignent les trois modes ; revenir dans un mode revient
où on l'avait laissé.

**Risque.** Faible. `PrimaryWorkspace` reste exporté en alias, donc `UiTarget`,
la palette et `checks-model` compilent sans être touchés.

### PR46 — Le projet quitte la navigation

**Fait.** `shell/ProjectMenu.tsx` ; `TopBarProps` nommées ; `ProjectPanel`
s'ouvre depuis le menu, en surcouche plein écran (pas une modale : c'est une
page, critère 12) ; le mode `PROJECT` disparaît.

**Acceptation.** Créer, ouvrir, enregistrer, exporter et régler le périmètre
sans jamais quitter le plan. `WorkflowGuide` reste joignable depuis le menu.

**Risque.** Moyen — `main.tsx` concentre les actions fichier. La PR déplace des
appels, n'en réécrit aucun.

### PR47 — Systèmes devient une discipline

**Fait.** `activeDomain` monte dans `ShellNavigation` ; `workspaceOfDomain()`
devient `modeOfDomain()` et rend toujours `MODEL` ; `DisciplinePicker` devient un
menu déroulant, provisoirement dans le panneau gauche ; `networks` cesse d'être
une destination.

**Acceptation.** Tracer un réseau d'eau sans changer d'espace. Le compte de
réseaux par discipline reste affiché (contrat §8 bis).

**Risque.** Moyen. `technicalDomains()` filtre sur `workspaceOfDomain(id) ===
'SYSTEMS'` : la fonction doit changer de critère (« discipline technique »), pas
disparaître.

### PR48 — La barre de vue

**Fait.** `shell/ViewBar.tsx` ; fente `viewBar` dans `AppShell` ; niveau,
discipline, échelle, Ajuster, Isoler, Variante ; l'en-tête du canvas est
supprimé ; le sélecteur de niveau quitte le panneau gauche.

**Acceptation.** À tout instant, l'écran affiche `RDC · Architecture · 1:50`
sans qu'on ait cliqué. `⛶` fait ce que `f` fait déjà.

**Risque.** Faible ; c'est un déplacement de contrôles existants.

### PR49 — Un seul panneau Affichage

**Fait.** `visibility/DisplayPanel.tsx` = `VisibilityPopover` + la ligne Rendu +
« Tout afficher » / « Réinitialiser » ; `editor/LayersPanel.tsx` supprimé ;
`Affichage` ouvre le panneau depuis la barre de vue.

**Contrats.** `docs/UX_ARCHITECTURE.md` §8 bis (la visibilité) ;
`e2e/support/panels.ts` — `openLayerEditor()` cible `Calques (avancé)` et
`hidePlacedComponents()` en dépend : les deux helpers changent de chemin.

**Acceptation.** Une seule façon de masquer un calque. Le compte de calques
masqués reste affiché.

**Risque.** Moyen — deux specs e2e passent par ces helpers.

### PR50 — Le navigateur permanent

**Fait.** `ProjectTree` sort du `<details>` `☰ Modèle` ; sections `Vues` et
`Documents` ; `shell/LeftColumn.tsx` avec séparateur horizontal ;
`WorkspaceLayout.navigatorPx`.

**Contrats.** `docs/UX_ARCHITECTURE.md` §8 bis (le navigateur) ;
`e2e/support/panels.ts` — `openModelTree()` devient sans effet, puis supprimé.

**Acceptation.** Changer de niveau depuis l'arbre, sans dépliage préalable.

### PR51 — La boîte à outils graphique

**Fait.** `editor/toolbox.ts`, `editor/tool-icons.tsx`, `editor/Toolbox.tsx` ;
outils dérivés (§7.2) ; filtrage par discipline active.

**Acceptation.** En discipline Électricité, `Prise` et `Interrupteur` sont des
boutons. Le registre n'a pas grossi. Aucun outil du registre n'est devenu
inatteignable — test : chaque `EDITOR_TOOLS[i]` apparaît dans au moins une
`toolboxOf(domain)` ou dans les communs.

**Risque.** Le plus élevé du plan. À découper si nécessaire : (a) grille et
icônes à contenu constant, (b) filtrage par discipline, (c) outils dérivés.

### PR52 — Les options d'outil dans la barre contextuelle

**Fait.** `ToolOptions` rendu par `ContextToolBar` ; invite de dessin dans le
canvas, dérivée de `toolDefinition()` et `pendingPoints.length`.

**Acceptation.** Choisir un assemblage de mur sans quitter des yeux le point
qu'on s'apprête à cliquer.

### PR53 — La sélection rend la barre contextuelle

**Fait.** Déplacer, Copier, Décaler, Scinder, Miroir, Aligner, Distribuer,
Supprimer, selon `selectionCapabilities()`. Les commandes existent déjà dans
`editing-commands.ts` ; la PR ne fait que les exposer.

**Acceptation.** Un mur sélectionné propose Scinder ; trois objets proposent
Aligner ; ce qui n'est pas possible est grisé avec son motif.

### PR54 — Les bibliothèques rejoignent les propriétés

**Fait.** Bouton `Bibliothèque…` dans les champs de l'inspecteur qui désignent
une fiche ; `materials`, `assemblies`, `openings`, `equipment` cessent d'être
des destinations.

**Acceptation.** Changer l'assemblage d'un mur sans quitter le plan. Les quatre
panneaux restent atteignables par la palette.

### PR55 — Recherche visible, niveaux d'outil clarifiés

**Fait.** Bouton `🔍` ; suppression des renvois à `Ctrl+K` dans les textes ;
`EditorLevel` documenté comme une **priorité d'affichage** et non un mode
utilisateur — il ne pilote que le repli « Autres outils ».

### PR56 — Tests E2E par tâche, et le contrat

**Fait.** `e2e/tasks.spec.ts` : _créer une maison RDC_, _placer une prise_,
_masquer le mobilier_, _changer de niveau_, _modifier un mur_, _exporter un
plan_. Chaque test est une tâche, pas un composant.

**Fait aussi.** `docs/UX_ARCHITECTURE.md` réécrit en v2 ; `PrimaryWorkspace`
retiré ; ce document devient un historique.

---

## 10. Ce que la refonte ne doit pas casser

Contrats existants qui **ne changent pas**, et qui échouent si la refonte
dérape :

- critère 3 — les dix phases restent hors navigation ;
- critère 4 — aucun état d'étape n'est persisté ;
- critère 9 — les largeurs de panneaux ne voyagent pas dans le fichier ;
- critère 10 — une seule navigation transversale, `UiTarget` ;
- critère 11 — un constat peut nommer le champ dont il parle ;
- critère 15 — divulgation progressive, pas de mode expert séparé ;
- critère 16 — aucun composant métier n'écrit une couleur ;
- critère 18 — tout outil du panneau est atteignable depuis la palette ;
- `plan-regression` et `graphic-reference-plan` — la refonte est une coque, le
  dessin ne bouge pas d'un pixel.

Contrats qui **changent, et dans quelle PR** :

| Contrat                                           | PR               |
| ------------------------------------------------- | ---------------- |
| critère 1 — cinq entrées de navigation            | PR45             |
| critère 2 — ce qui n'est pas une destination      | PR45             |
| `ux-contracts` — « the five spaces »              | PR45             |
| contrat §2 — cinq espaces                         | PR45             |
| contrat §8 — dimensions des panneaux              | PR48             |
| contrat §8 bis — Systèmes, visibilité, navigateur | PR47, PR49, PR50 |
| `e2e/support/panels.ts`                           | PR49, PR50       |

---

## 11. Décisions prises, et hypothèses à confirmer

**Prises** (elles sont dans la spec ci-dessus) :

1. Les trois modes vivent dans la barre haute, pas dans une colonne : trois
   entrées ne méritent pas un rail, et la colonne revient au navigateur.
2. Les outils dérivés (« Prise », « WC ») sont des entrées de boîte à outils,
   pas des outils du registre.
3. Les icônes sont des SVG en ligne dans le dépôt, sans dépendance.
4. `PrimaryWorkspace` survit en alias jusqu'à PR56.

**À confirmer avant PR48 et PR51** :

1. **Échelle.** La barre de vue propose-t-elle une liste fixe (1:20, 1:50,
   1:100, 1:200) qui contraint le zoom, ou affiche-t-elle l'échelle courante en
   lecture seule ? La première est plus proche d'un logiciel de dessin ; la
   seconde ne casse pas la molette. Les deux fonctions nécessaires existent déjà
   (`scaleDenominatorForZoom`, `pixelsPerMmForScale`) : c'est une décision de
   comportement, pas de faisabilité.
2. **Isoler.** Isoler la sélection, ou isoler la discipline ? Les deux existent
   dans les logiciels de référence ; la spec suppose la sélection.
3. **Discipline par défaut.** Ouvrir en `ARCHITECTURE` toujours, ou reprendre la
   dernière discipline du projet ? La spec suppose `ARCHITECTURE`.
