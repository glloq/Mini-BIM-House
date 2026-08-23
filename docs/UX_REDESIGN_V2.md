# Refonte de l'interface — audit, cible et plan

Ce document précède l'implémentation. Il contient l'audit chiffré de
l'interface actuelle, la coque cible, le registre des étapes de conception,
l'architecture React proposée, le plan de migration en dix PR et des critères
mesurables — c'est-à-dire vérifiables par une commande, pas par une opinion.

Il remplace `docs/UX_REFONTE_V2.md`, écrit quelques heures plus tôt sur une
cible différente (trois modes de travail). La cible retenue est celle-ci : la
navigation suit les **étapes de conception d'une maison**, pas les modes d'un
logiciel. Deux spécifications pour un même chantier finissent toujours par
diverger ; il n'en reste qu'une.

Il complète `docs/UX_ARCHITECTURE.md`, le contrat d'interface en vigueur, dont
il modifie plusieurs sections. §12 dit lesquelles et dans quelle PR.

**Périmètre.** `apps/web/src` uniquement. Aucune ligne de `packages/*`, aucun
changement de modèle BIM, aucun changement de dessin. Aucune fonction n'est
retirée : la simplification vient de la contextualisation, de la hiérarchie, du
regroupement et de l'affichage progressif — jamais de la suppression.

---

## 1. Audit de l'interface actuelle

### 1.1 Méthode

Mesures prises sur l'application construite (`apps/web/dist`), maison de
démonstration chargée, Chromium, deux formats. La page publiée
(`glloq.github.io/Mini-BIM-House`) sert actuellement le README et non
l'application : le workflow de publication n'a jamais abouti — trente
exécutions, zéro succès — faute d'une CI verte. Les mesures portent donc sur le
même code, servi localement.

### 1.2 Ce que mesure la coque actuelle

| Grandeur                                       | 1600 × 900   | 1280 × 800   | Cible            |
| ---------------------------------------------- | ------------ | ------------ | ---------------- |
| Hauteur totale de la page                      | **2 101 px** | **2 144 px** | = hauteur écran  |
| Débordement sous la ligne de flottaison        | **1 201 px** | **1 344 px** | **0**            |
| Barre supérieure                               | 102 px       | **144 px**   | 40–48 px         |
| En-tête du canvas                              | **140 px**   | **140 px**   | supprimé         |
| Barre d'état du plan                           | 64 px        | **81 px**    | 28–32 px         |
| Chrome vertical avant le premier pixel de plan | **306 px**   | **348 px**   | ≤ 120 px         |
| Panneau gauche                                 | 220 px       | 220 px       | 200–240 / 44 / 0 |
| Inspecteur                                     | 280 px       | 280 px       | 240–300 / 0      |
| Hauteur du panneau gauche                      | **1 891 px** | **1 891 px** | = hauteur écran  |
| Boutons dans le panneau gauche                 | **143**      | **143**      | ≤ 20 visibles    |
| Boutons dans la page                           | 161          | 161          | —                |

> **Correction apportée par UX-3.** Les 143 comptaient le DOM : tout ce qui
> dormait dans un dépliage fermé — les cent onze entrées de l'arborescence, les
> « Plus d'outils » de chaque groupe. Offerts d'un coup, ils étaient
> **vingt-cinq**. Le défaut n'était donc pas leur nombre mais leur nature :
> vingt-cinq outils génériques qui ne changeaient jamais, quelle que soit
> l'activité. Le seuil de « ≤ 20 visibles » et le tableau du §13.1 se lisent
> avec ce compte-là.

### 1.3 Le défaut structurel

`.workspace` n'est pas verrouillé sur la fenêtre :

```css
.workspace {
  width: calc(100% - 2rem);
  margin: auto;
  padding: 1.25rem 0 2rem;
}
.workspace-grid {
  min-height: 680px;
}
.plan-canvas {
  min-height: 460px;
}
```

Aucune règle ne dit `height: 100dvh` ni `overflow: hidden`. Chaque panneau prend
donc la hauteur de son contenu — 1 891 px pour le panneau gauche — et **la page
défile**. Le plan mesure 1 356 px de haut dans une fenêtre de 900 : on ne peut
pas voir le dessin entier sans faire défiler le _document_, ce qu'aucun
logiciel de dessin ne demande.

Tout le reste de l'audit découle de là ou s'y ajoute.

### 1.4 Composant par composant

| Composant           | Constat                                                                                                                                                  |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AppShell`          | Bonnes fentes, aucune contrainte de hauteur. La grille s'étire au lieu de contenir.                                                                      |
| `PrimaryRail`       | 56 px de large, cinq entrées, jamais contextuel. Coûte une colonne pour cinq mots.                                                                       |
| `ContextPanel`      | Liste des destinations de l'espace ; sur `plan`, elle ne sert plus qu'à titrer le panneau.                                                               |
| `ProjectTree`       | Bonne structure (Site, Bâtiment, familles du niveau) mais **repliée derrière `☰ Modèle`**, et elle termine ses listes par « cherchez-les avec Ctrl+K ». |
| `ToolsPanel`        | 25 boutons texte, huit groupes, **tous les groupes affichés en permanence** quelle que soit l'activité. Les options de l'outil s'empilent dessous.       |
| `ContextToolBar`    | Excellente idée, sous-employée : elle ne porte que Terminer, Pivoter, Miroir et quatre alignements. Aucune option d'outil, aucune instruction.           |
| `InspectorPanel`    | Correct sur sélection ; **vide de sens quand rien n'est sélectionné** (un texte d'attente occupe 280 px).                                                |
| `PlanCanvas`        | Sain. Il subit la mise en page, il ne la cause pas.                                                                                                      |
| `VisibilityPopover` | Presets + compte de calques masqués + 28 cases sous un dépliage.                                                                                         |
| `LayersPanel`       | **Les mêmes 28 cases**, plus un sélecteur de vue disciplinaire, dans le panneau gauche.                                                                  |
| `CommandPalette`    | Bien conçue. Devenue le moyen d'accès à ce que la navigation ne montre pas.                                                                              |
| `tool-registry`     | 25 outils déclaratifs, groupes, niveaux, options, raccourcis. **La meilleure brique du lot.**                                                            |
| `workflow-steps.ts` | 10 groupes, 28 étapes, domaines, dépendances, état dérivé. **Le registre d'étapes existe déjà.**                                                         |
| Niveaux             | Un `<select>` dans le panneau gauche, sous les destinations.                                                                                             |
| Disciplines         | `DisciplinePicker`, visible **uniquement dans l'espace Systèmes**.                                                                                       |
| Vues                | Trois notions distinctes portent le même mot : charte graphique, preset de calques, vue enregistrée.                                                     |

---

## 2. Problèmes identifiés

Numérotés pour être cités par les PR.

**P1 — La coque n'est pas une coque.** La page défile de 1 200 à 1 350 px. Le
plan ne tient pas dans la fenêtre. _→ UX-1._

**P2 — 306 à 348 px de chrome vertical avant le plan.** Barre supérieure qui
passe à la ligne, en-tête de canvas de 140 px répétant ce que la barre de vue
dira en une ligne, barre d'état de plan sur deux rangées. _→ UX-1, UX-5._

**P3 — Le panneau gauche montre tout, tout le temps.** Vingt-cinq outils
offerts d'un coup, huit groupes, quelle que soit l'activité — et cent
quarante-trois boutons dans le DOM si l'on compte ce qui dort replié. Poser
une prise électrique et tracer un mur offrent exactement le même écran, et
aucun des vingt-cinq ne dit ce qu'on pose : « Composant » ne se lit pas
« prise ». _→ UX-2, UX-3._

**P4 — Deux interfaces de visibilité.** `LayersPanel` et `VisibilityPopover`
répondent à la même question, avec deux présentations. _→ UX-5._

**P5 — Quatre notions confondues sous « vue ».** Niveau, discipline, charte
graphique, preset de calques. _→ UX-5._

**P6 — L'arborescence du bâtiment est cachée.** Derrière `☰ Modèle`, alors
qu'elle répond à « où suis-je ». _→ UX-4._

**P7 — La discipline n'existe que dans un espace.** Passer de l'architecture à
l'électricité impose de changer d'espace, donc de contexte. _→ UX-2, UX-5._

**P8 — `Ctrl+K` est un moyen d'accès, pas un accélérateur.** L'arborescence y
renvoie explicitement quand ses listes dépassent quarante objets. _→ UX-4, UX-9._

**P9 — Les bibliothèques sont des destinations.** Changer l'assemblage d'un mur
demande de quitter le plan pour « Matériaux », puis d'y revenir. _→ UX-8._

**P10 — L'outil actif ne dit ni ce qu'il fait ni ce qu'il attend.** Aucune
instruction, aucune option à portée du regard, le paramétrage est dans le
panneau gauche. _→ UX-6._

**P11 — L'inspecteur réserve 280 px pour un texte d'attente.** _→ UX-7._

**P12 — Les actions de sélection sont incomplètes.** Déplacer, copier, scinder,
décaler existent comme outils ou comme commandes ; la barre contextuelle n'en
propose aucune. _→ UX-6._

**P13 — Aucun repère de progression.** Rien ne dit à quelle étape on en est ni
ce qui vient ensuite. Le moteur existe pourtant (`workflow-steps.ts`). _→ UX-2._

**P14 — Le responsive s'arrête au rétrécissement.** Sous 900 px, les trois
colonnes deviennent une pile ; le plan y garde `min-height: 60vh` sous des
panneaux qui prennent le reste. _→ UX-9._

---

## 3. Wireframe du nouveau shell

```text
┌──────────────────────────────────────────────────────────────────────────┐ 44px
│ ☰ │ Maison Dupont │ ↶ ↷ │ Projet ▾ │              │ 🔍 Rechercher │ ⚙ │  │
├──────────────────────────────────────────────────────────────────────────┤ 34px
│ Projet › Terrain › ▸BÂTIMENT◂ › Structure › Aménagement › Systèmes › …   │ étapes
├──────────┬───────────────────────────────────────────────┬───────────────┤ 34px
│          │ RDC ▾ │ Architecture ▾ │ 1:50 ▾ │ 👁 │ ⊙ │ ⛶ │               │ vue
│ Bâtiment ├───────────────────────────────────────────────┤ PROPRIÉTÉS    │
│  RDC   ● │                                               │               │
│  Étage   │                                               │ Mur extérieur │
│  Toiture │                                               │ ───────────── │
│ ─────────│                                               │ Construction  │
│ MURS     │                    PLAN                       │ Dimensions    │
│ ▱ Mur    │                                               │ Position      │
│ ▱▱ Continu                                               │               │
│ ▭ Rect.  │                                               │ ▸ Avancé      │
│ ─────────│                                               │               │
│ OUVERTURES                                               │               │
│ 🚪 Porte │                                               │               │
│ ▤ Fenêtre│                                               │               │
│ + Autres │                                               │               │
├──────────┴───────────────────────────────────────────────┴───────────────┤ 40px
│ MUR │ Extérieur ▾ │ Mur 300 ▾ │ H 2,50 m │ Axe ▾ │ Cliquez le départ │ ✕ │
└──────────────────────────────────────────────────────────────────────────┘ 28px
│ RDC · 4 250 ; 1 800 mm │ ⊞ Grille ⌁ Extrémités │ 1 objet │ ⚑ 12 constats │
└──────────────────────────────────────────────────────────────────────────┘
```

Quatre barres horizontales de 44 + 34 + 34 + 40 + 28 = **180 px de chrome**,
contre 306 à 348 px aujourd'hui, et le tout **verrouillé sur la fenêtre**.

Le panneau gauche a trois états : ouvert (200–240 px), compact (44 px, icônes
seules), fermé (0 px). L'inspecteur en a deux : ouvert (240–300 px), fermé.
Quand rien n'est sélectionné et qu'aucune propriété de vue n'est demandée,
l'inspecteur se réduit **de lui-même** et rend sa largeur au plan.

---

## 4. Les étapes de création

### 4.1 Deux notions, une correspondance

- **`WorkflowGroup`** (existant, 10 entrées, `ux/workflow-steps.ts`) : ce qu'il
  reste à faire. Dérivé du modèle, jamais persisté. Alimente le guide.
- **`CreationStage`** (nouveau) : ce que je suis en train de faire. Filtre les
  outils proposés et rien d'autre.

Les deux sont liés par une table ; ils ne fusionnent pas. Une étape ne bloque
rien, ne verrouille rien, ne se « valide » pas.

### 4.2 Les neuf étapes

| Étape       | id          | Groupes de progression | Disciplines                                                                                     |
| ----------- | ----------- | ---------------------- | ----------------------------------------------------------------------------------------------- |
| Projet      | `PROJECT`   | PROJECT                | —                                                                                               |
| Terrain     | `SITE`      | SITE                   | SITE                                                                                            |
| Bâtiment    | `BUILDING`  | BUILDING, ARCHITECTURE | ARCHITECTURE                                                                                    |
| Structure   | `STRUCTURE` | CONSTRUCTION           | STRUCTURE                                                                                       |
| Aménagement | `FITTING`   | FITTING                | FURNITURE                                                                                       |
| Systèmes    | `SYSTEMS`   | TECHNICAL              | PLUMBING, WASTEWATER, RAINWATER, HEATING, VENTILATION, ELECTRICAL, LIGHTING, FLUE, DATA, SAFETY |
| Énergie     | `ENERGY`    | ENERGY                 | SOLAR, STORAGE                                                                                  |
| Vérifier    | `CHECKS`    | CHECKS                 | —                                                                                               |
| Documents   | `DOCUMENTS` | DOCUMENTS              | —                                                                                               |

**Sous-étapes**, affichées en tête du panneau gauche quand l'étape en a :

```text
BÂTIMENT     Niveaux · Murs · Pièces · Ouvertures · Dalles · Escaliers · Toiture
STRUCTURE    Porteurs · Poteaux · Poutres · Trémies
SYSTÈMES     Eau · Évacuation · CVC · Électricité · Éclairage
ÉNERGIE      Solaire · Stockage · Bilan
```

Une sous-étape de Systèmes **est** une discipline : la choisir change la
discipline active. Une sous-étape de Bâtiment est un groupe d'outils. La
distinction est portée par le registre, pas par le composant.

### 4.3 Ce que l'étape n'est pas

Un utilisateur peut à tout moment revenir en arrière, sauter une étape, poser
l'électricité avant la toiture, modifier un mur après avoir tracé les réseaux.
L'étape **filtre ce qui est proposé**. Elle ne restreint jamais ce qui est
possible : la palette, la recherche et « Autres outils » donnent accès à tout,
depuis n'importe quelle étape.

> Cela modifie le critère d'acceptation n° 3 du contrat actuel — « les dix
> phases ne sont nulle part dans la navigation ». Il devient : _les phases ne
> sont jamais une contrainte, ne remplacent jamais le plan et ne sont jamais
> persistées._ La barre d'étapes reste au-dessus du même canvas ; elle ne mène
> nulle part.

---

## 5. Outils par étape

Construit à partir de `EDITOR_TOOLS` (25 outils réels) et d'**outils dérivés** —
un outil existant avec ses options pré-remplies (§5.3).

### 5.1 Outils principaux, visibles sans dépliage

| Étape       | Outils principaux                                                                                          |
| ----------- | ---------------------------------------------------------------------------------------------------------- |
| Projet      | _aucun outil de dessin_ — le panneau montre les informations du projet                                     |
| Terrain     | `SITE` (parcelle), `SITE`+obstacle, `DIMENSION`, `NOTE`                                                    |
| Bâtiment    | `WALL`, `WALL_RUN`, `WALL_RECTANGLE`, `OPENING`+porte, `OPENING`+fenêtre, `SPACE`, `SLAB`, `STAIR`, `ROOF` |
| Structure   | `COLUMN`, `BEAM`, `WALL`+porteur, `SLAB`+structurel, `SLAB_HOLE`                                           |
| Aménagement | `COMPONENT`+mobilier, `COMPONENT`+électroménager                                                           |
| Systèmes    | selon la discipline active — voir §5.2                                                                     |
| Énergie     | `COMPONENT`+PV, `COMPONENT`+onduleur, `COMPONENT`+batterie, `NETWORK_ROUTE`                                |
| Vérifier    | `SELECT` seul ; le panneau montre les constats                                                             |
| Documents   | `DIMENSION`, `NOTE` ; le panneau montre les vues et les feuilles                                           |

**Toujours présents, dans un groupe « Communs » en bas :** `SELECT`, `OFFSET`,
`JOIN`, `TRIM`, `SPLIT`, `ROTATE`, `MIRROR`, `DIMENSION`, `NOTE`.

### 5.2 Systèmes, par discipline

| Discipline  | Outils principaux                                                                             |
| ----------- | --------------------------------------------------------------------------------------------- |
| Eau         | Arrivée, Point de puisage, WC, Lavabo, Douche, Chauffe-eau, Canalisation EF, Canalisation ECS |
| Évacuation  | Appareil sanitaire, Chute, Collecteur, Regard, Ventilation primaire                           |
| CVC         | PAC, Radiateur, Plancher chauffant, VMC, Bouche, Gaine, Thermostat                            |
| Électricité | Prise, Interrupteur, Luminaire, Tableau, Circuit, Gaine                                       |
| Éclairage   | Luminaire, Point lumineux, Commande                                                           |

Chacun de ces libellés est un `ToolboxEntry` — pas un outil du registre.

### 5.3 Les outils dérivés

> **Décision.** « Prise », « WC », « Radiateur » ne deviennent pas trente outils
> de plus dans `tool-registry`. Ce sont des entrées de boîte à outils qui
> portent un outil existant et des options pré-remplies.

```ts
export interface ToolboxEntry {
  readonly id: string; // 'water.wc'
  readonly toolId: string; // 'COMPONENT'
  readonly label: string; // 'WC'
  readonly icon: ToolIconId;
  readonly hint: string; // tooltip
  readonly level: EditorLevel; // repris du registre
  readonly options?: Readonly<Record<string, string>>; // catégorie, famille…
}
```

Choisir l'entrée fait un `SET_TOOL` **et** un pré-remplissage de `toolDrafts`.
La boîte à outils parle la langue de l'utilisateur ; le registre continue de
parler celle du modèle ; les fiches proposées viennent du catalogue installé et
ne sont jamais écrites en dur.

**Invariant vérifié par test :** tout outil de `EDITOR_TOOLS` apparaît dans au
moins une étape ou dans les communs. Aucun outil ne devient inatteignable.

### 5.4 Trois degrés d'exposition

```text
principaux   visibles, grille icône + libellé      ≤ 10 par étape
secondaires  « + Autres outils », même écran        le reste de l'étape
avancés      recherche, palette, autres étapes      tout le registre
```

`EditorLevel` (`QUICK` / `DESIGN` / `EXPERT`) sert de **priorité d'affichage**,
et non de mode utilisateur : `QUICK`+`DESIGN` sont principaux, `EXPERT` est
secondaire. Il n'existe toujours pas deux interfaces.

---

## 6. Comportement des panneaux

| Panneau        | Ouvert    | Compact             | Fermé | Se réduit tout seul quand…                                          |
| -------------- | --------- | ------------------- | ----- | ------------------------------------------------------------------- |
| Gauche         | 200–240px | 44 px (icônes)      | 0     | l'étape n'offre aucun outil (Vérifier au repos)                     |
| Inspecteur     | 240–300px | —                   | 0     | rien n'est sélectionné **et** aucune propriété de vue n'est ouverte |
| Barre d'étapes | 34 px     | libellé courant + ▾ | —     | largeur < 1100 px                                                   |
| Barre de vue   | 34 px     | —                   | —     | jamais                                                              |
| Barre d'outil  | 40 px     | —                   | 0     | aucun outil actif **et** aucune sélection                           |

Règles :

1. **Aucune zone n'est réservée pour rien.** Un panneau sans contenu prend zéro
   pixel — pas une bande vide, pas un titre seul.
2. **Une réduction automatique est toujours réversible en un clic**, et la
   position est mémorisée : rouvrir revient à la largeur qu'on avait choisie.
3. **Rien ne saute sous le pointeur.** La barre d'outil garde sa place tant
   qu'un outil est actif, même si ses options changent.
4. Les largeurs et les replis vivent dans `WorkspaceLayout` (localStorage) et
   **ne voyagent jamais dans le fichier projet** — critère 9, inchangé.

---

## 7. Modèle de navigation

### 7.1 Ce qui disparaît

`PrimaryRail` et les cinq espaces. `PROJECT`, `BUILD`, `SYSTEMS`, `ANALYZE`,
`DOCUMENTS` cessent d'être des lieux. Les treize destinations de
`LEGACY_WORKSPACE_TABS` se redistribuent :

| Destination                                         | Devient                                              |
| --------------------------------------------------- | ---------------------------------------------------- |
| `project`                                           | Menu **Projet** (barre supérieure)                   |
| `plan`                                              | Le canvas, permanent — il n'est plus une destination |
| `building`                                          | Étape Projet › Niveaux, et l'arborescence            |
| `materials`, `assemblies`, `openings`, `equipment`  | Bibliothèques, ouvertes depuis une propriété         |
| `networks`                                          | Étape Systèmes                                       |
| `calculations`, `quantities`, `scenarios`, `checks` | Étape Vérifier                                       |
| `documents`                                         | Étape Documents                                      |

Aucune ne devient inatteignable : le test existant qui l'exige est conservé, en
lisant désormais les étapes au lieu des espaces.

### 7.2 Ce qui navigue

Une seule fonction, comme aujourd'hui : `navigateTo(target: UiTarget)`.
`UiTarget.workspace` devient `UiTarget.stage`. Les cinq autres champs — domaine,
niveau, objet, propriété, superposition — ne changent pas.

### 7.3 Ce que voit l'utilisateur

```text
étape       ce que je fais           barre d'étapes, 34 px
discipline  sur quel métier          barre de vue
niveau      à quel étage             barre de vue + arborescence
sélection   sur quel objet           inspecteur
```

Quatre réponses, quatre endroits fixes, jamais un de plus.

---

## 8. Niveau, vue, discipline, visibilité

Quatre axes indépendants, longtemps confondus sous le mot « vue ».

| Axe            | Question                    | État                                   | Contrôle                     |
| -------------- | --------------------------- | -------------------------------------- | ---------------------------- |
| **Niveau**     | À quel étage ?              | `EditorState.levelId`                  | `RDC ▾` + arborescence       |
| **Discipline** | Sur quel métier ?           | `DesignDomainId`                       | `Architecture ▾`             |
| **Rendu**      | Comment c'est dessiné ?     | `PLAN_RENDERINGS` → `graphicProfileId` | 👁 Affichage, ligne « Rendu » |
| **Visibilité** | Qu'est-ce qui est dessiné ? | `presetId` + `layers` (28)             | 👁 Affichage, le reste        |

### 8.1 Le panneau Affichage, unique

```text
AFFICHAGE                                    3 calques masqués sur 28

RENDU        ● Plan architectural  ○ Plan technique  ○ Technique FR
AFFICHER     ● Architecture  ○ Structure  ○ Technique  ○ Matériaux  ○ Tout

  ☑ Architecture     ☐ Électricité     ☐ Mobilier
  ☐ Structure        ☐ Eau             ☐ Annotations
                     ☐ CVC

▸ Calque par calque (28)
[ Tout afficher ]  [ Réinitialiser ]
```

Trois degrés : la charte, le preset, les familles ; les 28 calques individuels
restent, sous un dépliage. `LayersPanel` est supprimé — pas déplacé, supprimé :
c'est la seconde interface de la même question.

### 8.2 Où le contrôle vit

La barre de vue est **attachée au canvas** et non au panneau gauche : elle
décrit ce que le plan montre, elle doit être à côté du plan.

---

## 9. Desktop

Cible sur 1600 × 900, inspecteur ouvert, panneau gauche ouvert :

```text
chrome vertical    44 + 34 + 34 + 40 + 28 = 180 px      (aujourd'hui : 306)
colonnes           232 + 8 + reste + 8 + 280
plan visible       1 072 × 720 = 772 000 px²
part de l'écran    54 %                                  (avec les deux panneaux)
                   72 %                                  (inspecteur replié)
                   84 %                                  (les deux repliés)
```

La cible « 70 à 85 % » de l'énoncé est atteinte **lorsque les propriétés ne sont
pas nécessaires**, ce qui est le cas pendant le tracé — c'est exactement ce que
la réduction automatique de l'inspecteur produit.

Aucune barre ne passe à la ligne : les actions qui ne tiennent pas vont dans le
menu Projet, jamais sur une seconde rangée.

---

## 10. Responsive

| Format                | Coque                                                                                                                                              |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| ≥ 1440 px             | Trois colonnes, tout ouvert.                                                                                                                       |
| 1100–1440 px          | Panneau gauche en compact au chargement ; inspecteur ouvert à la sélection.                                                                        |
| 900–1100 px           | Panneau gauche compact ; inspecteur en surcouche à droite.                                                                                         |
| 600–900 px (tablette) | Canvas plein cadre ; panneaux en tiroirs latéraux ; barre d'étapes réduite au libellé courant.                                                     |
| < 600 px (mobile)     | Canvas plein écran. Une barre basse : `[Étape] [Outils] [Vue] [Objet]`, chacune ouvrant une feuille montante (bottom sheet) de 40–60 % de hauteur. |

Le mobile n'est pas le desktop rétréci : les trois colonnes ne sont jamais
empilées. Le plan garde l'écran ; tout le reste est temporaire.

---

## 11. Architecture React proposée

### 11.1 Registres déclaratifs, pas de `switch` JSX

```ts
// ux/creation-stages.ts
export interface CreationStage {
  readonly id: CreationStageId;
  readonly label: string;
  readonly icon: StageIconId;
  /** Les groupes de progression que cette étape fait avancer. */
  readonly groups: readonly WorkflowGroup[];
  /** Les métiers qu'elle propose ; le premier est la discipline par défaut. */
  readonly domains: readonly DesignDomainId[];
  /** Les sous-étapes, quand elle en a. */
  readonly sections: readonly StageSection[];
  /** Ce que le panneau gauche montre en plus des outils. */
  readonly panel?: 'PROJECT' | 'CHECKS' | 'DOCUMENTS';
}

export interface StageSection {
  readonly id: string;
  readonly label: string;
  /** Une sous-étape de Systèmes est une discipline. */
  readonly domain?: DesignDomainId;
  readonly primary: readonly ToolboxEntry[];
  readonly secondary: readonly ToolboxEntry[];
}
```

Le panneau d'outils est **entièrement généré** depuis : étape active +
discipline active + registre + sélection. Aucun composant ne connaît le nom d'un
outil.

### 11.2 Arbre des composants

```text
App (main.tsx)
└─ AppShell                        hauteur verrouillée, 4 rangées
   ├─ TopBar                       44 px
   │  ├─ PanelToggles · ProjectMenu · HistoryButtons · SearchButton
   ├─ StageBar                     34 px   ← nouveau
   ├─ body
   │  ├─ LeftColumn                200–240 / 44 / 0   ← nouveau
   │  │  ├─ BuildingNavigator      ← ProjectTree promu et compacté
   │  │  ├─ StageSections          sous-étapes de l'étape active
   │  │  └─ Toolbox                ← ToolsPanel refondu
   │  ├─ CanvasRegion
   │  │  ├─ ViewBar                34 px   ← nouveau
   │  │  │  └─ DisplayPanel        ← VisibilityPopover + LayersPanel fusionnés
   │  │  ├─ PlanCanvas             inchangé
   │  │  └─ ToolBar                40 px   ← ContextToolBar étendu
   │  └─ InspectorPanel            240–300 / 0
   └─ ShellStatusBar               28 px
```

### 11.3 Fichiers

| Fichier                            | Décision                                                |
| ---------------------------------- | ------------------------------------------------------- |
| `ux/creation-stages.ts`            | **nouveau** — le registre des étapes                    |
| `ux/stage-state.ts`                | **nouveau** — étape + discipline actives, dérivations   |
| `editor/toolbox.ts`                | **nouveau** — étape + discipline → entrées              |
| `editor/tool-icons.tsx`            | **nouveau** — SVG en ligne, aucune dépendance           |
| `shell/StageBar.tsx`               | **nouveau**                                             |
| `shell/ViewBar.tsx`                | **nouveau**                                             |
| `shell/LeftColumn.tsx`             | **nouveau**                                             |
| `shell/ProjectMenu.tsx`            | **nouveau**                                             |
| `shell/AppShell.tsx`               | **modifié** — rangées, hauteur verrouillée              |
| `shell/ProjectTree.tsx`            | **modifié** — compact, permanent, plus de renvoi Ctrl+K |
| `shell/PrimaryRail.tsx`            | **supprimé**                                            |
| `shell/ContextPanel.tsx`           | **supprimé**                                            |
| `editor/ToolsPanel.tsx`            | **refondu** → `editor/Toolbox.tsx`                      |
| `editor/LayersPanel.tsx`           | **supprimé**                                            |
| `visibility/VisibilityPopover.tsx` | **renommé** `DisplayPanel.tsx`, étendu                  |
| `editor/ContextToolBar.tsx`        | **étendu** — options, instructions, actions             |
| `editor/InspectorPanel.tsx`        | **étendu** — propriétés de vue, bibliothèques           |
| `systems/DisciplinePicker.tsx`     | **déplacé** dans `ViewBar`                              |
| `ux/workspaces.ts`                 | **réduit** puis retiré (UX-10)                          |
| `styles.css`                       | **modifié** — verrouillage, densité                     |

### 11.4 Deux règles conservées

1. Aucun composant ne navigue seul : tout passe par `navigateTo(UiTarget)`.
2. Aucun composant métier n'écrit une couleur ; les jetons CSS décident.
   `tool-icons.tsx` n'utilise que `currentColor`.

---

## 12. Plan de migration

Dix PR. Après chacune : l'application se construit, les tests passent, une
maison se dessine. Aucune ne laisse deux interfaces concurrentes plus longtemps
qu'elle-même.

| PR    | Objet                                          | Corrige     | Contrats touchés            |
| ----- | ---------------------------------------------- | ----------- | --------------------------- |
| UX-1  | Coque compacte et verrouillée                  | P1, P2, P11 | contrat §8 (dimensions)     |
| UX-2  | Registre d'étapes, barre d'étapes              | P3, P7, P13 | critère 3, contrat §3       |
| UX-3  | Boîte à outils contextuelle                    | P3          | critère 18                  |
| UX-4  | Navigation du bâtiment                         | P6, P8      | contrat §8 bis              |
| UX-5  | Barre de vue et affichage unique               | P4, P5, P7  | contrat §8 bis, e2e helpers |
| UX-6  | Barre d'outil : options, instructions, actions | P10, P12    | —                           |
| UX-7  | Inspecteur hiérarchisé                         | P11         | —                           |
| UX-8  | Bibliothèques dans le contexte                 | P9          | critère 2                   |
| UX-9  | Responsive                                     | P14         | contrat §10                 |
| UX-10 | E2E par tâche, contrat v2                      | —           | critères 1, 2, 3, 18        |

**UX-1 — Coque compacte.** _Livré._ `height: 100dvh`, `overflow: hidden`, chaque
panneau défile chez lui ; barre supérieure sur une rangée, les six gestes de
fichier repliés sous « Fichier ▾ » ; en-tête de canvas d'une rangée ; barre
d'état d'une rangée, les sept réglages d'accrochage sous « Réglages » ;
inspecteur qui ne réserve rien tant que rien n'a été désigné. Aucun changement
fonctionnel : tout reste atteignable à la souris seule. Livre aussi
`scripts/measure-shell.mjs`, qui produit le tableau du §13 — les critères
deviennent une commande, branchée sur l'intégration continue.

Mesuré avant / après, la maison de démonstration chargée :

| Mesure                       | Avant     | Après    | Budget |
| ---------------------------- | --------- | -------- | ------ |
| Débordement sous la fenêtre  | 1 201 px  | **0**    | 0      |
| Barre supérieure             | 102 / 144 | **44**   | 48     |
| Chrome avant le premier plan | 292 / 335 | **131**  | 140    |
| Plan visible (1600 × 900)    | 31 %      | **60 %** | —      |
| Plan visible (1280 × 800)    | 26 %      | **54 %** | 50 %   |

Les 70 % du §13.1 demandent le panneau gauche contextuel : cent quarante-trois
boutons y attendent toujours, et c'est UX-3 qui les trie.

Deux décisions que la mise en œuvre a imposées et que la spécification n'avait
pas prévues :

- **Le repli de l'inspecteur est collant.** Le §6 le dit continu — replié dès
  que rien n'est sélectionné. Continu, il rouvrait à chaque sélection et
  refermait à chaque Échap : la colonne rendue au dessin, le dessin la rendait
  aussitôt, et le plan se rezoomait sous le pointeur qui venait de désigner un
  mur — précisément ce que la règle 3 du §6 interdit. Il vaut donc jusqu'à la
  première sélection, et plus jamais après. UX-7 met des propriétés de vue au
  repos, après quoi la question ne se pose plus : l'inspecteur aura toujours
  quelque chose à dire.
- **Le menu s'appelle « Fichier », pas « Projet ».** Le §7.1 dit « Menu
  **Projet** » ; mais `PrimaryRail` a déjà un espace « Projet », et deux choses
  du même nom sont une chose de trop. Quand le rail disparaîtra (UX-2), le nom
  restera juste : ce menu porte sur le fichier, pas sur le projet.

**UX-2 — Étapes.** _Livré._ `ux/creation-stages.ts` gèle les neuf étapes, leurs
sous-étapes, les métiers qu'elles proposent et les destinations qu'elles
offrent ; `ux/stage-state.ts` remplace `navigation-state.ts` ; `StageBar`
remplace `PrimaryRail`, qui est supprimé. `UiTarget.workspace` devient
`UiTarget.stage`. Le compte de ce qu'il reste à faire par étape est dérivé de
`workflow-steps.ts` et s'affiche dans la barre — un nombre, jamais un barrage.

Trois invariants deviennent des tests : chaque métier est revendiqué par
exactement une étape, chaque phase de chantier est portée par exactement une
étape, et chacune des treize destinations reste atteignable. Le rail coûtait
56 px de largeur en permanence ; la barre coûte 34 px de hauteur une fois, et
la part de fenêtre occupée par le plan n'a pas bougé — 60 % et 54 %.

Trois écarts à la spécification :

- **Les sous-étapes déclarent ce qu'elles sont, pas les outils qu'elles
  portent.** Le §11.1 met `primary` et `secondary` dans `StageSection` ; ils
  vivront dans `editor/toolbox.ts` (UX-3). Un registre d'étapes qui contient la
  liste des outils est un registre d'outils qui se fait passer pour autre
  chose. Le panneau n'affiche pour l'instant que les sous-étapes sur lesquelles
  il sait agir — celles qui portent un métier — parce qu'un bouton grisé qui
  promet pour plus tard est pire que pas de bouton.
- **Le plan reste une destination.** Le §7.1 le veut permanent. Il ne peut
  l'être qu'une fois les bibliothèques ouvertes depuis une propriété (UX-8) et
  les résultats rangés dans le panneau de l'étape : sinon « Matériaux » n'a
  nulle part où s'afficher. Les treize destinations restent donc, redistribuées
  par étape ; le test qui refuse qu'une devienne inatteignable est conservé.
- **Le critère d'acceptation n° 3 change d'énoncé**, comme le §4.3 l'annonçait.
  « Les dix phases ne sont nulle part dans la navigation » valait tant que la
  navigation était cinq lieux ; il devient « une étape ne verrouille rien, ne
  remplace jamais le plan et n'est jamais persistée », et le test le vérifie
  point par point.

**UX-3 — Boîte à outils.** _Livré._ `editor/toolbox.ts` déclare les entrées par
étape et par sous-étape, `editor/tool-icons.tsx` dessine cinquante-quatre
icônes en `<svg>` inline et `currentColor`, `editor/Toolbox.tsx` les rend en
grille. `ToolsPanel` est supprimé.

Une **entrée** est un outil du registre plus ce qu'on aurait choisi juste
après : « Porte » est l'outil ouverture avec le type déjà mis, « WC » l'outil
composant avec la fiche déjà désignée. Le registre reste à vingt-cinq outils ;
il en aurait fallu une cinquantaine pour offrir la même chose en outils.

**Aucune fiche n'est écrite en dur.** Une entrée nomme une _famille_ de la
nomenclature — `WC`, `SOCKET_16A`, `RADIATOR` — et la fiche est celle que le
catalogue du projet propose pour cette famille. Une entrée dont la famille
n'est pas installée n'est pas offerte, et l'étape dit alors d'où viennent les
fiches plutôt que de montrer une colonne vide.

Ce que l'étape ne propose pas est sous « Tous les outils », sur le même écran :
un test refuse qu'un outil du registre devienne inatteignable, et un autre
qu'une entrée qui ne change rien à son outil porte un autre nom que lui — deux
noms pour un même outil sur un même écran, et la personne croit en avoir trouvé
un second.

Mesuré : vingt-cinq boutons offerts d'un coup avant, vingt-quatre après. Le
gain n'est pas le nombre — voir la correction du §1.2 — c'est que onze d'entre
eux nomment ce qu'on pose et suivent l'étape.

**UX-4 — Bâtiment.** _Livré._ `ProjectTree` est sorti de `☰ Modèle` et vit en
tête du panneau gauche : « où je suis » est une question qu'on se pose sans
arrêt, et une question de ce genre ne se range pas derrière un dépliage.

Les niveaux sont une rangée de boutons, et c'est **le seul** endroit où l'on
change d'étage — la liste déroulante « Niveau » qui vivait juste au-dessus est
supprimée. Deux commandes pour une décision, c'est une commande de trop, et
c'est celle qui ne disait pas ce que l'étage contient.

L'arbre est compacté par ce qu'il ne montre plus : **une famille vide n'est pas
une rangée.** « Toitures (0) », « Cotes (0) », « Annotations (0) » et deux
autres prenaient cinq lignes pour dire que rien n'existe, et repoussaient les
outils sous la ligne de flottaison. Un arbre dit ce que le bâtiment a.

Une section **Vues et feuilles** s'ajoute, avec ce que le projet a enregistré
et un bouton qui y mène : une vue enregistrée n'était atteignable que par une
destination, donc seulement par qui savait qu'elle existait.

Le renvoi à `Ctrl+K` au-delà de quarante objets par famille — une phrase qui
supposait qu'on connaisse le raccourci, qu'on ait un clavier et qu'on ait lu la
ligne — devient un bouton qui ouvre la recherche avec le nom de la famille déjà
écrit. `Ctrl+K` redevient ce qu'il aurait toujours dû être : un accélérateur.

Vingt-six boutons offerts d'un coup, contre vingt-quatre avant l'arbre : deux
niveaux et trois sections repliées, pour une question qu'on se posait en
permanence.

**UX-5 — Vue et affichage.** _Livré._ `shell/ViewBar.tsx` remplace l'en-tête du
canvas et porte les quatre notions qui décrivent ce que le dessin montre : le
niveau dessiné, le métier, la variante, l'affichage. Elles vivaient à quatre
endroits — une liste déroulante du panneau gauche, une liste de boutons juste
en dessous, rien du tout pour la charte, et deux écrans concurrents pour les
calques.

`visibility/DisplayPanel.tsx` est l'écran unique : le rendu, le préréglage,
puis les vingt-huit calques sous un dépliage. `LayersPanel` est **supprimé**,
pas déplacé. Le rendu de plan, qui n'était atteignable que par la palette, y a
sa place ; il reste un axe indépendant des calques, sinon un plan d'architecte
des réseaux deviendrait impossible. Le compte de calques masqués s'affiche sur
le bouton lui-même : un plan amputé sans rien à l'écran pour le dire est un
plan que quelqu'un imprimera.

Le sélecteur de discipline quitte le panneau gauche pour la barre, avec le
compte de réseaux passé dans l'étiquette de chaque option — il ne perd rien et
libère la colonne.

Le chrome au-dessus du plan tombe de 165 à **153 px**, et le plan passe à 61 %
et 55 %. C'est exactement le compte du §9 : 44 + 34 + 34 + 40, plus un pixel de
bordure.

> **Un seuil du §13.1 est contredit par le §9.** « Chrome vertical avant le
> plan ≤ 120 px » a été écrit avant que ces quatre barres ne soient posées, et
> l'arithmétique du §9 en donne 152. Quatre rangées ne tiennent pas dans 120 px.
> Le budget de `measure-shell.mjs` est donc fixé à 155, et descendre plus bas
> demanderait de retirer une barre — ce que cette spécification ne demande
> nulle part.

**UX-6 — Barre d'outil.** _Livré._ `editor/tool-instruction.ts` dérive du
registre et de l'état ce que l'outil attend : combien de points il demande,
combien sont posés, s'il s'arrête de lui-même. La barre l'écrit à côté du nom
de l'outil — « Cliquez le second point », « Entrée termine, Échap annule » — et
offre « Annuler le tracé » dès qu'il y a quelque chose à abandonner.

Aucun outil n'écrit sa propre phrase, donc aucun ne peut oublier de la mettre
à jour ; un test la demande pour les vingt-cinq, à chaque étape de leur tracé.
« Mur » ne disait pas s'il faut cliquer une fois ou deux, ni comment on arrête
un tracé qui ne s'arrête pas tout seul : on le découvrait en essayant,
c'est-à-dire en se trompant.

Les actions de sélection selon `selectionCapabilities()` étaient déjà là ; les
options essentielles de l'outil restent sous l'outil, dans la boîte, où choisir
un assemblage fait partie du choix de l'outil mur.

**UX-7 — Inspecteur.** _Livré._ `editor/ViewProperties.tsx` occupe l'inspecteur
quand rien n'est désigné : le niveau, le métier, le rendu, le préréglage, les
calques masqués, l'échelle. Un objet a des propriétés ; une vue aussi, et
« Sélectionnez un objet du plan » réservait un panneau entier pour une phrase
qui n'apprend rien à qui vient de cliquer dans le vide.

Ces faits se **lisent** ici et se changent ailleurs — chacun dit où —, parce
qu'un même réglage à deux endroits finit par dire deux choses. C'est aussi ce
qu'on vérifie avant d'exporter, et cela se lisait jusqu'ici en ouvrant trois
panneaux.

Les sections hiérarchisées et le repli de l'avancé existaient déjà dans
`InspectorPanel` : ce que l'objet **est** reste ouvert, où il vit dans le
fichier se replie — sauf si une vérification a envoyé quelqu'un vers un champ
qui s'y trouve.

> Le repli automatique de UX-1 reste. L'inspecteur a maintenant quelque chose à
> dire au repos, mais la place appartient encore au dessin tant qu'on ne l'a pas
> demandée : les propriétés de vue sont ce qu'on trouve en l'ouvrant, pas une
> raison de l'ouvrir tout seul.

**UX-8 — Bibliothèques.** _Livré._ Un champ qui désigne une fiche sait laquelle
et sait donc l'ouvrir : `InspectorEdit` porte une `library`, et le champ affiche
`Bibliothèque…` à côté de lui. Changer l'assemblage d'un mur demandait de
quitter le plan pour « Matériaux », de trouver la fiche, puis de revenir.

Les quatre bibliothèques cessent d'être des **destinations** de l'étape : le
registre les déclare à part, et elles se rangent avec le reste de ce qu'on
cherche — dans l'arborescence, sous « Bibliothèques ». Elles prenaient quatre
rangées en tête du panneau à chaque séance ; la colonne passe de vingt-six
boutons offerts à vingt-deux.

Deux corrections que ce découpage a rendues nécessaires :

- **La liste montre où l'on peut aller _et_ où l'on est.** Une étape n'offrant
  qu'une destination n'affichait aucune liste ; une fois dans une bibliothèque,
  plus rien ne ramenait au plan.
- **`goToTab` ne quitte plus une étape qui offre déjà la destination.** Le plan
  est offert par sept étapes sur neuf, et cliquer « Plan » depuis Bâtiment
  renvoyait dans Terrain — simplement la première de la liste à le proposer.
  Le défaut datait de UX-2 et ne se voyait pas, les deux étapes montrant le
  même dessin.

**UX-9 — Responsive.** _Livré._ `measure-shell.mjs` mesure désormais les cinq
formats du §10 plutôt que deux, ce qui a suffi à montrer ce qui n'allait pas :
aucun débordement nulle part, mais sur un téléphone la barre supérieure passait
à deux rangées et « House Technical Designer » y prenait la moitié de l'écran,
poussant « Panneau » et « Inspecteur » — les deux boutons qui ouvrent tout le
reste — hors du bord.

Le nom de l'application cède donc la rangée aux commandes en dessous de 900 px
(le projet ouvert se lit dans la barre d'état, qui est faite pour cela), la
barre de vue défile en gardant « Affichage » collé au bord, et le panneau
**monte du bas** en dessous de 600 px au lieu de venir du côté : un tiroir
latéral de 20 rem sur un écran de 390 recouvre les deux tiers du dessin et se
ferme du mauvais pouce.

Le seuil des tiroirs passe de 720 à 900 px, comme le §10 le demande — le plan
sur une tablette passe de 59 % à **78 %** de l'écran.

Deux écarts :

- **Le budget de chrome devient un budget par format.** Un doigt n'est pas un
  pointeur : la feuille de style donne exprès plus de hauteur aux contrôles sur
  écran tactile, et la barre de vue y fait 48 px au lieu de 34. Le budget
  reprend cette décision (175 px sur téléphone) plutôt que de la contredire.
- **La barre basse `[Étape] [Outils] [Vue] [Objet]` n'est pas construite.** Ses
  quatre entrées désignent des choses qui existent déjà et sont déjà
  atteignables d'un geste : l'étape est la liste déroulante de la barre
  d'étapes, la vue est « Affichage », les outils et l'objet sont les deux
  bascules de la barre supérieure. La construire aurait ajouté un second jeu
  des mêmes commandes, ce que cette refonte passe son temps à retirer.

**UX-10 — Validation.** `e2e/tasks.spec.ts` (§13.2), contrat réécrit,
`workspaces.ts` retiré.

---

## 13. Critères mesurables

### 13.1 Densité — vérifiée par `npm run measure:shell`

| Grandeur                                | Aujourd'hui | Seuil exigé  |
| --------------------------------------- | ----------- | ------------ |
| Débordement de la page sous la fenêtre  | 1 201 px    | **0 px**     |
| Chrome vertical avant le plan           | 306 px      | **≤ 155 px** |
| Hauteur de la barre supérieure          | 102 px      | **≤ 48 px**  |
| Plan visible, deux panneaux ouverts     | —           | **≥ 50 %**   |
| Plan visible, inspecteur replié         | —           | **≥ 70 %**   |
| Boutons visibles dans le panneau gauche | 25          | **≤ 20**     |
| Panneaux vides réservant de la place    | 1           | **0**        |

Le script échoue si un seuil est dépassé : un critère qu'on ne peut pas mesurer
n'est pas un critère.

### 13.2 Parcours — vérifiés par Playwright, sans clavier

Chaque test s'exécute **à la souris seule**, sans `Ctrl+K`, sans raccourci.

```text
T1  nouveau projet → RDC → tracer 4 murs → porte → fenêtre → pièce
T2  architecture → électricité → placer une prise → tracer un circuit
T3  changer de niveau → changer de discipline → masquer une famille
T4  sélectionner un mur → changer son assemblage → supprimer → annuler
T5  vérifier → lire un constat → l'ouvrir sur l'objet concerné
T6  documents → composer une vue → exporter
```

### 13.3 Clics — mesurés dans les tests

| Tâche                           | Aujourd'hui | Seuil |
| ------------------------------- | ----------- | ----- |
| Changer de niveau               | 2           | **1** |
| Changer de discipline           | 3           | **2** |
| Masquer une famille d'objets    | 3           | **2** |
| Atteindre l'assemblage d'un mur | 4 + retour  | **2** |
| Premier mur d'un projet neuf    | 5           | **3** |

### 13.4 Ce qui ne doit pas bouger

- Aucune fonction retirée : tout outil du registre reste atteignable, test à
  l'appui.
- `plan-regression` et `graphic-reference-plan` inchangés au pixel près : c'est
  une refonte de coque, pas de dessin.
- Les largeurs de panneaux ne voyagent pas dans le fichier projet.
- Une seule navigation transversale, `UiTarget`.
- Aucun composant métier n'écrit une couleur.
