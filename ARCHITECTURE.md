# Architecture logicielle — Mini-BIM-House

> **Unités internes :** SI pour les calculs ; millimètre pour l'édition
> géométrique 2D.
> **Principe fondamental :** un modèle unique du bâtiment alimente toutes les
> vues graphiques, tous les métrés et tous les modules de calcul.

## L'architecture d'aujourd'hui

Ce que le dépôt fait réellement, en une page. Ce qui suit cette section est le
**document de conception initiale**, gardé pour ce qu'il explique des
intentions ; il ne décrit pas l'état du code.

Le projet est la source de vérité, et rien d'autre. Il est validé et migré à
l'ouverture. À partir de lui, et jamais en le réinterprétant chacun de son
côté, les moteurs reçoivent un **modèle résolu** :

```text
              Project 1.2.0  (le fichier, seule vérité)
                     │
        validation / migration (project-io)
                     │
              Modèle résolu  (core-domain)
     resolveWallGeometry · resolveSpaceGeometry · resolveOpeningGeometry
     resolveRoofGeometry · placedEquipment · resolveEnvelope
                     │
   ┌─────────────────┼──────────────────┐
   │                 │                  │
Dessin            Métrés            Calculs
(view-query)     (quantities)   (calculation-adapters
   │                 │            → dix-sept moteurs)
   │                 ▼                  │
   │            Coût / Carbone          │
   └─────────────────┬──────────────────┘
                     ▼
            Vérifications / Rule Packs
                     │
                     ▼
              Interface / Documents
```

Ce que cela veut dire, concrètement :

- **une seule réponse par question de géométrie.** « Jusqu'où monte ce mur ? »,
  « quelle est la surface de cette pièce ? », « quelle est la surface nette de
  cette paroi ? » sont répondues une fois, dans `core-domain`, et le plan, les
  métrés et les calculs lisent la même réponse ;
- **l'enveloppe est un objet.** `resolveEnvelope()` énumère ce qui sépare la
  maison chauffée de l'extérieur, du sol et du non chauffé, avec pour chaque
  paroi son genre et sa condition de bord. Le moteur thermique reçoit cette
  liste, pas une liste de murs ;
- **rien de dérivé n'est enregistré.** Le fichier ne contient ni surface, ni
  hauteur résolue, ni résultat de calcul ;
- **une inconnue reste une inconnue.** Aucune valeur n'est inventée pour
  combler un trou : le module déclare l'entrée manquante et l'interface conduit
  au champ qui la remplit ;
- **une commande ne produit jamais un projet que l'importeur refuserait.** Un
  test l'exige après chaque commande publique et après son annulation.

### Les paquets

| Paquet                                  | Ce qu'il tient                                                                  |
| --------------------------------------- | ------------------------------------------------------------------------------- |
| `geometry`                              | primitives 2D : polygones, segments, tolérances                                 |
| `units`                                 | grandeurs typées et conversions                                                 |
| `climate`                               | jeux climatiques, regroupement par lieu et empreintes                           |
| `technical-types`                       | genres de raccordement, dégagements, registres, sans dépendance                 |
| `core-domain`                           | le modèle, ses identités, ses références, sa géométrie résolue et son enveloppe |
| `materials`, `assemblies`               | matériaux et compositions multicouches                                          |
| `catalog-registry`                      | nomenclature des familles, schémas de propriétés, empreintes                    |
| `equipment-catalog`, `network-products` | fiches génériques et produits de réseau                                         |
| `opening-catalog`                       | menuiseries et protections solaires, en JSON                                    |
| `project-io`                            | lecture, écriture, validation, migrations                                       |
| `editor-core`                           | commandes, annulation, outils de dessin                                         |
| `view-query`                            | plans, coupes, façades, toiture, masse, calques, désignation                    |
| `drawing-engine`                        | scène sémantique, chartes graphiques, SVG, feuilles, PDF                        |
| `quantities`                            | métrés depuis le modèle résolu                                                  |
| `calculation-core`                      | orchestrateur, provenance, superpositions                                       |
| `calculation-adapters`                  | le pont BIM → moteurs, et le registre des modules                               |
| `rule-engine`                           | moteur de règles et Rule Packs                                                  |
| `modules/*`                             | les dix-sept moteurs physiques, sans dépendance au projet                       |

### L'interface

L'application web est organisée autour de cinq espaces et non de onze
destinations. Le contrat que toute PR d'interface respecte — les espaces, le
périmètre de conception, la navigation transversale, le guide de progression et
les dix-huit critères d'acceptation — est écrit dans
[`docs/UX_ARCHITECTURE.md`](docs/UX_ARCHITECTURE.md) et vérifié par
`apps/web/src/ux/acceptance.test.ts`.

| Dossier             | Ce qu'il tient                                                  |
| ------------------- | --------------------------------------------------------------- |
| `ux/`               | les contrats : espaces, périmètre, cible de navigation, étapes  |
| `shell/`            | l'agencement seul : rail, panneaux, barre d'état                |
| `project-creation/` | la page `/project/new`, la pile de niveaux, l'emprise de départ |
| `catalog/`          | une seule façon de demander « lequel » à un catalogue           |
| `systems/`          | les disciplines par lesquelles le plan se lit                   |
| `visibility/`       | les préréglages de ce qui est dessiné                           |
| `workflow/`         | le registre des étapes et le guide qui les lit                  |

---

# Document de conception initiale

> Ce qui suit est le document d'architecture rédigé au départ du projet. Il est
> conservé pour les intentions qu'il explique et **ne décrit pas l'état actuel
> du code** : pour cela, voir la section ci-dessus.

---

## 1. Objectif du projet

Le projet doit permettre de concevoir et d’étudier tout ou partie d’une habitation dans une interface graphique intuitive, en conservant un niveau technique suffisant pour produire des résultats vérifiables.

Le logiciel combine quatre fonctions principales :

1. **dessin architectural paramétrique 2D** ;
2. **modèle technique du bâtiment de type BIM léger** ;
3. **modules de calcul indépendants mais interconnectés** ;
4. **génération automatique des quantités, matériaux, équipements, schémas et résultats globaux**.

L’utilisateur doit pouvoir utiliser le logiciel de deux manières :

- comme un ensemble de calculateurs indépendants ;
- comme un projet complet où toutes les données d’une maison sont partagées entre les modules.

Le logiciel ne cherche pas à reproduire un logiciel BIM professionnel complet. Il vise un périmètre résidentiel clair, compréhensible et extensible.

---

## 2. Principes d’architecture

### 2.1 Source de vérité unique

La géométrie, les matériaux, les systèmes techniques et les paramètres de projet ne doivent exister qu’une seule fois dans le modèle central.

Une vue plomberie, thermique ou électrique ne possède pas sa propre copie du bâtiment : elle affiche une projection différente du même modèle.

### 2.2 Séparation stricte modèle / calcul / affichage

Trois couches doivent rester indépendantes :

- **Domain Model** : ce qui existe dans la maison ;
- **Calculation Engine** : ce qui est calculé ;
- **Rendering Engine** : comment les données sont affichées.

Aucune formule physique ne doit être contenue dans un composant graphique.

### 2.3 Modularité

Chaque domaine fonctionnel est un module activable indépendamment :

- thermique ;
- chauffage ;
- photovoltaïque ;
- batterie ;
- eau potable ;
- eau de pluie ;
- eau chaude sanitaire ;
- évacuation ;
- ventilation ;
- qualité de l’air ;
- électricité ;
- éclairage ;
- acoustique ;
- coût ;
- impact environnemental ;
- métrés.

### 2.4 Local-first

Le MVP ne nécessite aucun serveur applicatif.

Le projet doit pouvoir fonctionner depuis un navigateur et être déployé comme site statique, notamment sur GitHub Pages.

Les projets sont sauvegardés sous forme de fichiers versionnés exportables/importables. Un stockage local navigateur peut être ajouté pour le confort, mais il ne doit jamais être l’unique moyen de récupérer un projet.

### 2.5 Référentiels versionnés

Les conventions graphiques, données matériaux, règles techniques et règles réglementaires doivent être versionnées indépendamment du code applicatif.

Aucune valeur réglementaire importante ne doit être dispersée sous forme de constantes anonymes dans le code.

### 2.6 Résultats traçables

Chaque résultat important doit pouvoir indiquer :

- les entrées utilisées ;
- la méthode ;
- le module ;
- la version de l’algorithme ;
- le référentiel associé ;
- les hypothèses ;
- les avertissements ;
- le niveau de confiance ou de simplification.

---

## 3. Architecture générale

```text
┌──────────────────────────────────────────────────────────────────┐
│                           WEB APPLICATION                         │
├──────────────────────────────────────────────────────────────────┤
│ UI / Workspace / Inspectors / Dashboards / Reports               │
├──────────────────────────────────────────────────────────────────┤
│ 2D Drawing Engine │ View Layers │ Symbols │ Dimensions │ Sheets  │
├──────────────────────────────────────────────────────────────────┤
│ Commands / Undo-Redo / Selection / Snapping / Project Store      │
├──────────────────────────────────────────────────────────────────┤
│                    BUILDING DOMAIN MODEL                         │
│ Site │ Levels │ Spaces │ Walls │ Roofs │ Systems │ Equipment     │
├──────────────────────────────────────────────────────────────────┤
│ Materials │ Assemblies │ Catalogs │ Standards │ Rule Packs       │
├──────────────────────────────────────────────────────────────────┤
│                  CALCULATION ORCHESTRATOR                        │
│ dependency graph │ validation │ cache │ scenarios │ reports      │
├──────────────────────────────────────────────────────────────────┤
│ Calculation Modules                                              │
│ thermal │ water │ HVAC │ electrical │ lighting │ acoustics │ PV  │
├──────────────────────────────────────────────────────────────────┤
│ Import / Export / Migrations / JSON / SVG / PDF / DXF* / IFC*   │
└──────────────────────────────────────────────────────────────────┘

* évolutions ultérieures
```

---

## 4. Pile technique recommandée

### 4.1 Langage

- **TypeScript** pour tout le code applicatif et les moteurs de calcul ;
- HTML/CSS pour la présentation ;
- JSON pour les catalogues, règles et fichiers projet.

### 4.2 Application web

Architecture recommandée :

- React + TypeScript pour l’interface ;
- Vite pour compilation et développement ;
- application statique compatible GitHub Pages ;
- Web Workers pour les calculs lourds ;
- IndexedDB uniquement comme cache/sauvegarde locale optionnelle.

Le domaine, la géométrie et les calculs doivent rester sous forme de packages TypeScript indépendants de React afin de pouvoir être testés sans navigateur.

### 4.3 Rendu graphique

**SVG doit être le moteur 2D principal.**

Avantages :

- vectoriel ;
- sélection facile des objets ;
- qualité indépendante du zoom ;
- styles de traits et hachures ;
- export direct ;
- textes/cotations propres ;
- correspondance naturelle avec un plan technique.

Canvas peut être utilisé pour des overlays lourds : cartes thermiques, champs de lux, visualisations continues, previews temporaires.

Une vue 3D peut être ajoutée ultérieurement avec Three.js, mais elle doit être générée depuis le modèle 2D/paramétrique et ne jamais devenir une seconde source de vérité.

---

## 5. Modèle de domaine central

### 5.1 Projet

```text
Project
├── metadata
├── site
├── climate
├── building
├── materials
├── assemblies
├── systems
├── scenarios
├── drawingViews
├── calculationSettings
└── regulatoryContext
```

### 5.2 Site

Le site contient :

- position géographique ;
- altitude ;
- orientation Nord ;
- limites de parcelle optionnelles ;
- masque solaire / obstacles optionnels ;
- données climatiques de référence ;
- pluviométrie ;
- température extérieure de calcul ;
- irradiance solaire ;
- vent si utilisé par certains modules.

### 5.3 Bâtiment

```text
Building
├── levels[]
├── spaces[]
├── walls[]
├── slabs[]
├── roofs[]
├── openings[]
├── stairs[]
├── columns[]        // optionnel au MVP
├── beams[]          // optionnel au MVP
└── zones[]
```

### 5.4 Niveau

Chaque niveau possède :

- altitude de référence ;
- hauteur d’étage ;
- hauteur sous plafond ;
- éléments associés ;
- vues de plan associées.

### 5.5 Espaces / pièces

Une pièce est un objet calculé à partir d’un contour fermé ou explicitement défini.

Propriétés :

- nom ;
- type ;
- surface ;
- volume ;
- hauteur ;
- occupation ;
- température de consigne ;
- humidité cible ;
- besoins d’éclairage ;
- exigences de ventilation ;
- zone thermique ;
- zone acoustique.

Les pièces ne doivent pas être de simples textes dessinés sur le plan.

---

## 6. Géométrie architecturale

### 6.1 Système de coordonnées

- coordonnées cartésiennes 2D par niveau ;
- origine stable par projet ;
- édition de préférence en millimètres ;
- conversions SI centralisées pour les calculs ;
- angles exprimés en radians dans le moteur, degrés dans l’interface si nécessaire.

### 6.2 Mur

Le mur doit être défini par une ligne de référence et non par un simple polygone dessiné.

```text
Wall
├── id
├── levelId
├── path
├── height
├── baseOffset
├── assemblyId
├── referenceSide
├── joins
├── openings[]
└── metadata
```

Le moteur calcule automatiquement :

- faces intérieures/extérieures ;
- épaisseur ;
- angles ;
- raccords ;
- intersections ;
- longueurs ;
- surfaces brutes/nettes ;
- volume de chaque couche.

### 6.3 Ouvertures

```text
Opening
├── hostWallId
├── type: door | window | void
├── position
├── width
├── height
├── sillHeight
├── orientation
├── productRef?
└── thermal/acoustic properties
```

### 6.4 Toitures et planchers

Ils sont des surfaces paramétriques avec composition multicouche.

Un toit doit pouvoir contenir :

- pente ;
- orientation ;
- débords ;
- assemblage ;
- surface utile photovoltaïque ;
- collecte des eaux de pluie.

### 6.5 Détection automatique des pièces

Le moteur géométrique doit construire un graphe topologique des murs et détecter les cycles fermés.

Toute modification d’un mur doit pouvoir recalculer les pièces concernées sans recalculer tout le bâtiment.

---

## 7. Assemblages constructifs

Un élément du bâtiment ne référence pas directement un seul matériau. Il référence un **Assembly**.

Exemples :

- mur extérieur ;
- cloison ;
- toiture ;
- plancher bas ;
- plancher intermédiaire.

```text
Assembly
├── id
├── name
├── category
├── layers[]
├── totalThickness
├── rendering
├── metadata
└── calculatedProperties
```

Chaque couche :

```text
AssemblyLayer
├── materialId
├── thickness
├── role
├── airGapProperties?
├── installationFactor?
└── notes?
```

Le système doit permettre des compositions telles que :

```text
Enduit extérieur             15 mm
Brique                      200 mm
Isolation laine de bois     145 mm
Frein vapeur                  1 mm
Vide technique               45 mm
Plaque de plâtre             13 mm
```

Les propriétés calculées de la paroi sont dérivées des couches et ne doivent pas être saisies en double.

---

## 8. Bibliothèque générale de matériaux

La bibliothèque matériaux est un composant de premier niveau du projet.

### 8.1 Catégories initiales

- béton ;
- mortiers/enduits ;
- briques/terre cuite ;
- blocs béton ;
- pierre ;
- terre crue ;
- bois ;
- panneaux bois ;
- isolants minéraux ;
- isolants biosourcés ;
- isolants synthétiques ;
- plaques de parement ;
- métaux ;
- verre ;
- membranes ;
- revêtements ;
- sols ;
- matériaux acoustiques ;
- plastiques ;
- matériaux personnalisés.

### 8.2 Schéma matériau

Toutes les propriétés sont optionnelles sauf l’identité et la catégorie.

```text
Material
├── id
├── name
├── category
├── subtype?
├── manufacturer?
├── productReference?
├── source
├── physical
│   ├── density
│   ├── specificHeat
│   └── porosity?
├── thermal
│   ├── conductivityLambda
│   ├── emissivity?
│   └── solarAbsorptance?
├── hygrothermal
│   ├── vaporResistanceMu?
│   ├── moistureCapacity?
│   └── waterAbsorption?
├── acoustic
│   ├── absorptionByFrequency?
│   ├── Rw?
│   └── surfaceProperties?
├── fire
│   └── classification?
├── environmental
│   ├── embodiedCarbon?
│   ├── declaredUnit?
│   ├── serviceLife?
│   └── declarationReference?
├── economic
│   ├── unitCost?
│   └── costUnit?
├── appearance
│   ├── hatchId
│   ├── textureId?
│   └── defaultRenderStyle
└── provenance
    ├── sourceType
    ├── sourceReference
    ├── sourceDate
    ├── validity
    └── notes
```

### 8.3 Trois niveaux de matériaux

Le catalogue distingue :

1. **GenericMaterial** : valeur générique de conception ;
2. **ProductMaterial** : produit commercial documenté ;
3. **CustomMaterial** : matériau ajouté ou modifié par l’utilisateur.

Une donnée utilisateur ne doit jamais écraser silencieusement une donnée du catalogue de référence.

### 8.4 Ajout de matériaux utilisateur

L’interface doit permettre :

- création ;
- duplication ;
- modification locale ;
- import/export JSON ;
- choix des propriétés connues ;
- indication explicite des valeurs inconnues ;
- ajout de source et commentaire ;
- création d’un matériau depuis un produit existant.

### 8.5 Provenance

Chaque valeur technique importante doit pouvoir porter sa propre provenance, car plusieurs propriétés d’un même matériau peuvent provenir de sources différentes.

Le modèle doit donc permettre une provenance au niveau propriété, pas uniquement au niveau matériau.

---

## 9. Moteur de métré et liste globale des matériaux

Le métré est calculé automatiquement depuis la géométrie et les assemblages.

### 9.1 Quantités géométriques

Pour chaque matériau :

- surface ;
- volume ;
- longueur ;
- masse estimée ;
- nombre d’unités si défini ;
- quantité par niveau ;
- quantité par pièce ;
- quantité par système ;
- quantité globale.

### 9.2 Distinction obligatoire

Le logiciel distingue :

- **quantité géométrique nette** ;
- **quantité commandée estimée**.

Exemple :

```text
Plaque de plâtre
Surface nette :        183.4 m²
Marge chantier :         8 %
Surface à prévoir :    198.1 m²
Plaques 1.20 × 2.50 :     67 unités
```

La marge est configurable par matériau ou catégorie.

### 9.3 Équipements et réseaux

La nomenclature globale inclut également :

- fenêtres ;
- portes ;
- sanitaires ;
- luminaires ;
- prises ;
- protections électriques ;
- gaines ;
- tuyaux ;
- raccords quantifiables ;
- bouches VMC ;
- équipements HVAC ;
- panneaux PV ;
- batteries ;
- pompes ;
- cuves.

---

## 10. Systèmes techniques sous forme de graphes

Les réseaux doivent être représentés comme des graphes et non comme de simples lignes graphiques.

```text
TechnicalNetwork
├── nodes[]
├── segments[]
├── equipment[]
├── terminals[]
└── systemProperties
```

### 10.1 Réseau eau

Types :

- eau froide ;
- eau chaude ;
- bouclage ECS ;
- eau de pluie ;
- eaux grises ;
- eaux usées ;
- eaux vannes ;
- eaux pluviales.

Chaque segment possède notamment :

- matériau ;
- diamètre ;
- longueur ;
- pente si nécessaire ;
- débit ;
- pression ;
- pertes de charge ;
- température.

### 10.2 Ventilation

Chaque gaine possède :

- type ;
- section ;
- diamètre hydraulique ;
- longueur ;
- débit ;
- vitesse ;
- pertes de charge ;
- bruit estimé ;
- isolation éventuelle.

### 10.3 Électricité

Le réseau électrique contient :

- tableaux ;
- protections ;
- circuits ;
- conducteurs ;
- prises ;
- points lumineux ;
- interrupteurs ;
- équipements fixes ;
- production ;
- stockage.

Le schéma logique et le cheminement physique doivent être séparables.

---

## 11. Moteur de dessin technique

### 11.1 Principe

Le moteur de dessin ne stocke pas un plan final. Il produit un plan à partir du modèle et d’un **ViewDefinition**.

```text
ViewDefinition
├── type
├── levelId?
├── scale
├── cutPlane
├── visibleLayers[]
├── discipline
├── detailLevel
├── styleProfile
├── annotations
└── sheetSettings?
```

### 11.2 Types de vues

- plan architectural ;
- plan matériaux ;
- plan thermique ;
- plan plomberie ;
- plan évacuation ;
- plan ventilation ;
- plan chauffage ;
- plan électrique ;
- plan éclairage ;
- plan acoustique ;
- plan photovoltaïque ;
- coupe ;
- façade ;
- schéma de principe ;
- vue synthétique multi-système.

### 11.3 Pipeline de rendu

```text
Domain Model
   ↓
View Query
   ↓
Semantic Scene Graph
   ↓
Graphic Convention Resolver
   ↓
SVG Renderer
   ↓
Screen / SVG export / Print / PDF
```

### 11.4 Styles sémantiques

Ne pas définir directement « trait noir 2 px » dans les objets.

Utiliser :

```text
WALL_CUT_MAJOR
WALL_VISIBLE
WALL_OVERHEAD
INSULATION_HATCH
WATER_COLD
WATER_HOT
WASTE_WATER
VENT_SUPPLY
VENT_EXHAUST
ELECTRICAL_POWER
ELECTRICAL_LIGHTING
DIMENSION
ANNOTATION
```

Le profil graphique transforme ensuite ces rôles en :

- type de ligne ;
- épaisseur ;
- couleur écran ;
- couleur impression ;
- motif ;
- hachure.

### 11.5 Résolution du style : rôle, calque et métadonnées

Le rôle sémantique seul ne suffit pas : toutes les pièces sont `SPACE_FILL` et
tous les murs `WALL_CUT`, alors que la scène porte déjà `category` sur la pièce
et `role` sur le mur. Une charte peut donc énoncer des règles :

```ts
{
  match: {
    semanticRole: 'WALL_CUT',
    layer: 'architecture.walls',
    metadata: { role: ['INTERIOR', 'PARTITION'] },
  },
  token: 'wall-interior',
}
```

`resolveGraphicToken(profile, primitive)` choisit dans l'ordre :

```text
règle la plus spécifique → jeton du rôle → rien (le renderer le signale)
```

Le poids d'une règle est, à défaut de `priority`, le nombre de critères
qu'elle énonce ; à poids égal, la règle écrite en premier l'emporte.

Deux interdits :

- ne jamais écrire une couleur dans le modèle BIM (`space.color`, `wall.color`) ;
- ne jamais brancher sur une catégorie métier dans `plan-view.ts`.

Le BIM décrit ce qu'est l'objet ; la charte décide de son apparence.

### 11.6 Chartes et calques : deux questions distinctes

Une charte répond à « comment dessiner ? », un preset de calques à « quoi
afficher ? ». Les deux axes se combinent librement :

```text
Plan architectural + calques Architecture
Plan architectural + calques Électricité
Plan technique     + calques Matériaux
```

Chartes livrées :

| Charte              | Pour                                       |
| ------------------- | ------------------------------------------ |
| Technique générique | lire un réseau, une coupe, un détail       |
| Technique FR        | idem, conventions françaises               |
| Plan architectural  | lire une maison : murs, pièces, ouvertures |

`architecture.wall-layers` n'est plus visible par défaut : la composition d'un
mur est le sujet du preset « Matériaux », pas celui du plan architectural.

La vue reçoit sa charte, elle ne la choisit pas : `PlanCanvas` prend un
`graphicProfileId`, l'espace de travail décide du défaut (« Construire » lit une
maison, « Systèmes » lit un réseau), et une vue enregistrée garde la sienne.

---

## 12. Conventions graphiques et normalisation

L’objectif est d’approcher au maximum les conventions professionnelles sans déclarer une conformité réglementaire automatique tant que chaque règle n’a pas été validée.

### 12.1 Référentiel graphique de base

Le projet doit prévoir des profils compatibles avec les principes des familles suivantes :

- ISO 128 — principes de représentation et types de lignes ;
- ISO 128-3 — vues, sections et coupes ;
- ISO 128-23 — lignes utilisées dans la documentation de construction ;
- ISO 129-1 — présentation des dimensions ;
- ISO 5455 — échelles ;
- ISO 5457 — formats et mise en page des feuilles ;
- ISO 7200 — champs de cartouche ;
- ISO 13567-1/-2 — organisation et nommage des calques CAD ;
- ISO 19650 — principes de gestion de l’information BIM.

### 12.2 Gestion des calques

Chaque objet possède :

- discipline ;
- fonction ;
- système ;
- état ;
- phase ;
- niveau ;
- classe graphique.

Le nom de calque exporté est généré par un `LayerNamingProfile`.

### 12.3 Hachures matériaux

Les hachures doivent être centralisées dans une bibliothèque versionnée.

Chaque matériau ou famille de matériaux possède :

- hachure plan ;
- hachure coupe ;
- représentation simplifiée ;
- représentation détaillée.

### 12.4 Symboles

Les symboles techniques ne sont pas des SVG libres placés arbitrairement. Ils sont des objets versionnés :

```text
SymbolDefinition
├── id
├── discipline
├── semanticType
├── geometry
├── anchors
├── orientationRules
├── textAnchors
├── allowedScales
└── sourceReference
```

---

## 13. Registre réglementaire et normatif

Créer un sous-système indépendant : **Standards & Rules Registry**.

### 13.1 Types de références

```text
REFERENCE_TYPE =
- LAW
- REGULATION
- STANDARD
- DTU
- TECHNICAL_METHOD
- ENGINEERING_GUIDELINE
- DATA_SOURCE
- USER_RULE
```

### 13.2 Contexte réglementaire

```text
RegulatoryContext
├── country
├── region?
├── municipality?
├── buildingType
├── newOrRenovation
├── permitDate?
├── referenceDate
└── enabledRulePacks[]
```

### 13.3 Rule Pack

```text
RulePack
├── id
├── jurisdiction
├── discipline
├── title
├── reference
├── effectiveFrom
├── effectiveTo?
├── version
├── sourceMetadata
├── rules[]
└── disclaimer
```

### 13.4 Une règle

```text
Rule
├── id
├── scope
├── condition
├── inputs
├── evaluation
├── severity
├── message
├── reference
└── applicability
```

Niveaux :

- `ERROR` : non-respect manifeste d’une règle activée ;
- `WARNING` : vérification nécessaire ;
- `INFO` : recommandation ;
- `UNKNOWN` : données insuffisantes.

### 13.5 Principe juridique

Le dépôt ne doit pas recopier intégralement des textes normatifs protégés.

Il doit stocker :

- identifiants ;
- métadonnées ;
- liens/références externes ;
- paramètres explicitement documentés et légalement réutilisables ;
- règles créées à partir de sources publiques ou de paramètres saisis par l’utilisateur.

---

## 14. Moteur de calcul modulaire

### 14.1 Contrat d’un module

Chaque calculateur implémente une interface commune.

```ts
interface CalculationModule<I, O> {
  id: string;
  version: string;
  dependencies: string[];
  requiredInputs: string[];
  validate(context: CalculationContext): ValidationResult;
  calculate(context: CalculationContext): CalculationResult<O>;
}
```

### 14.2 Résultat standard

```text
CalculationResult
├── moduleId
├── moduleVersion
├── timestamp
├── inputsHash
├── outputs
├── warnings[]
├── assumptions[]
├── references[]
├── qualityLevel
└── diagnostics
```

### 14.3 Graphe de dépendances

Exemple :

```text
Geometry
   ├── Areas/Volumes
   │      ├── Thermal Envelope
   │      │       ├── Heating Load
   │      │       │       └── Energy Consumption
   │      │       │                └── PV/Battery sizing
   │      │       └── Summer Comfort
   │      └── Material Quantities
   │              └── Cost / Environmental impact
   └── Rooms
          ├── Ventilation
          ├── Lighting
          └── Acoustics
```

Le moteur invalide uniquement les résultats dépendant d’une donnée modifiée.

### 14.4 Scénarios

Le moteur doit pouvoir comparer plusieurs variantes sans dupliquer complètement le projet.

Exemples :

- isolation 120 mm / 160 mm / 200 mm ;
- PAC / poêle / chauffage électrique ;
- PV 3 / 6 / 9 kWp ;
- VMC simple flux / double flux.

Un scénario contient un ensemble de `overrides` sur le modèle de base.

---

## 15. Modules de calcul prévus

### 15.1 Géométrie et métrés — CORE

- surfaces ;
- volumes ;
- longueurs ;
- surfaces vitrées ;
- surfaces par orientation ;
- matériaux ;
- équipements ;
- quantités.

### 15.2 Thermique enveloppe

- résistances thermiques ;
- U des parois ;
- transmission ;
- pertes par éléments ;
- ponts thermiques simplifiés ;
- bilan par pièce ;
- bilan bâtiment.

Référentiels de calcul à documenter notamment autour d’ISO 6946, ISO 10456 et de la méthode réglementaire française appropriée.

### 15.3 Hygrothermie

- résistance à la diffusion ;
- risque de condensation interstitielle simplifié ;
- température de surface ;
- humidité critique.

### 15.4 Dynamique / confort d’été

- capacité thermique ;
- déphasage simplifié ;
- apports solaires ;
- protections ;
- ventilation nocturne ;
- indicateurs de surchauffe.

### 15.5 Chauffage / refroidissement

- puissance pièce ;
- puissance bâtiment ;
- émetteurs ;
- génération ;
- rendement ;
- COP ;
- consommation.

### 15.6 Photovoltaïque

- toiture exploitable ;
- orientation ;
- inclinaison ;
- ombrage simplifié ;
- puissance installable ;
- production ;
- autoconsommation ;
- couverture des usages.

### 15.7 Batterie

- capacité utile ;
- SOC ;
- puissance ;
- autonomie ;
- cycles simplifiés ;
- stratégie d’autoconsommation.

### 15.8 Eau potable

- consommations ;
- simultanéité ;
- débits ;
- diamètres ;
- pertes de charge ;
- HMT ;
- pompes.

### 15.9 Eau de pluie

- surface de collecte ;
- rendement ;
- pluviométrie ;
- stockage ;
- usages admissibles selon Rule Pack ;
- autonomie ;
- trop-plein ;
- appoint eau potable.

### 15.10 Eau chaude sanitaire

- profil de demande ;
- volume ;
- énergie ;
- temps de chauffe ;
- pertes ;
- stockage.

### 15.11 Évacuation

- appareils ;
- unités de raccordement si méthode activée ;
- diamètres ;
- pentes ;
- ventilation des réseaux ;
- contrôle de cheminement.

### 15.12 Ventilation

- débits réglementaires/techniques ;
- renouvellement d’air ;
- dimensionnement des gaines ;
- vitesse ;
- pertes de charge ;
- équilibrage ;
- récupération de chaleur ;
- puissance ventilateurs.

### 15.13 Qualité de l’air

- production CO₂ simplifiée ;
- concentration d’équilibre ;
- humidité ;
- occupation ;
- alertes de renouvellement insuffisant.

### 15.14 Électricité

- bilan de puissance ;
- circuits ;
- intensités ;
- sections ;
- chutes de tension ;
- protections ;
- production/stockage ;
- contrôles réglementaires selon Rule Pack.

### 15.15 Éclairage

- lux cible ;
- flux lumineux ;
- disposition ;
- puissance ;
- consommation ;
- carte de niveau simplifiée.

### 15.16 Acoustique

- réverbération ;
- absorption ;
- transmission entre pièces ;
- façade ;
- performances des assemblages ;
- modes de pièce en option.

Une montée en précision pourra suivre la famille ISO 12354.

### 15.17 Coût

- coût matériaux ;
- coût équipements ;
- coût par lot ;
- coût par m² ;
- variantes ;
- marge ;
- prix utilisateur.

### 15.18 Environnement

- masses ;
- données environnementales disponibles ;
- carbone incorporé simplifié ;
- comparaison d’assemblages ;
- compatibilité future avec données INIES/FDES lorsque les conditions d’utilisation des données sont respectées.

---

## 16. Vues graphiques analytiques

Le projet doit être prioritairement visuel.

### 16.1 Thermique

- parois colorées selon U ;
- flux de pertes ;
- pertes par pièce ;
- surbrillance des éléments dominants.

### 16.2 Eau

- couleurs/symboles distincts par réseau ;
- diamètres visibles au zoom ;
- flèches de sens ;
- pression/perte de charge à la demande.

### 16.3 Ventilation

- soufflage ;
- extraction ;
- transfert ;
- débit sur chaque bouche ;
- taille de gaine ;
- zones à vitesse élevée.

### 16.4 Électricité

- circuits ;
- tableau ;
- protections ;
- cheminements ;
- prises ;
- éclairage ;
- PV/batterie.

### 16.5 Éclairage

- luminaires ;
- zones couvertes ;
- carte de lux approximative ;
- lux moyen/minimum selon modèle choisi.

### 16.6 Acoustique

- séparation des zones ;
- parois faibles ;
- chemins de transmission ;
- RT estimé par pièce.

### 16.7 Vue globale

La vue synthétique ne doit pas superposer tous les réseaux en permanence.

Elle présente :

- indicateurs principaux ;
- alertes ;
- zones problématiques ;
- accès direct aux vues spécialisées.

---

## 17. Architecture de l’éditeur

### 17.1 Command Pattern

Toutes les modifications du modèle passent par des commandes :

```text
AddWall
MoveWallVertex
SetWallAssembly
InsertWindow
DeleteElement
ConnectPipe
SetMaterialProperty
```

Une commande doit pouvoir :

- valider l’opération ;
- modifier le modèle ;
- produire son inverse ;
- déclencher les invalidations nécessaires.

Ce mécanisme fournit l’Undo/Redo.

### 17.2 Transaction

Une action utilisateur peut regrouper plusieurs commandes en une seule transaction.

Exemple : déplacer un mur peut modifier :

- le mur ;
- les raccords ;
- les pièces ;
- les cotes associées.

Undo doit annuler l’ensemble en une seule étape.

### 17.3 Snapping

Le moteur de snap prévoit :

- grille ;
- sommet ;
- extrémité ;
- milieu ;
- perpendiculaire ;
- parallèle ;
- intersection ;
- alignement ;
- angle configuré.

---

## 18. Gestion de l’état

Séparer :

### Project State

Données persistantes du projet.

### Editor State

Sélection, outil actif, zoom, panneaux ouverts, hover.

### Derived State

Pièces détectées, métrés, résultats calculés, caches géométriques.

### User Preferences

Unités d’affichage, thème, préférences UI.

Le `Project State` doit rester sérialisable en JSON et indépendant de l’interface.

---

## 19. Format de fichier projet

Extension proposée :

```text
.houseproj.json
```

Structure :

```json
{
  "schemaVersion": "1.0.0",
  "application": "house-technical-designer",
  "project": {},
  "customMaterials": [],
  "customAssemblies": [],
  "enabledModules": [],
  "regulatoryContext": {},
  "viewDefinitions": []
}
```

### 19.1 Versionnement

`schemaVersion` est obligatoire.

Chaque changement cassant doit disposer d’une migration :

```text
v1.0 → v1.1 → v2.0
```

Le fichier original ne doit jamais être modifié silencieusement sans possibilité d’export après migration.

---

## 20. Import / export

### MVP

- projet JSON ;
- catalogue matériau JSON ;
- assemblage JSON ;
- plan SVG ;
- nomenclature CSV ;
- résultats CSV/JSON ;
- impression navigateur/PDF.

### Évolutions

- DXF 2D ;
- IFC partiel ;
- import de fond de plan ;
- GeoJSON/parcelle ;
- catalogues externes.

L’interopérabilité doit être implémentée par adaptateurs afin de ne pas contaminer le modèle central avec les contraintes d’un format externe.

---

## 21. Architecture des modules

Chaque module doit pouvoir fournir quatre types d’extensions :

```text
Module
├── domain extensions
├── calculations
├── drawing layers
├── UI panels
└── rule providers
```

Exemple : `ventilation` peut ajouter :

- objets `AirTerminal`, `Duct`, `Fan`, `HeatRecoveryUnit` ;
- calculs débits/pertes ;
- calque graphique ;
- inspecteur spécialisé ;
- règles de validation.

Le noyau ne doit pas connaître les détails internes des modules.

---

## 22. API interne de module

Concept cible :

```ts
interface AppModule {
  manifest: ModuleManifest;
  registerDomain?(registry: DomainRegistry): void;
  registerCalculations?(registry: CalculationRegistry): void;
  registerDrawingLayers?(registry: DrawingLayerRegistry): void;
  registerRules?(registry: RuleRegistry): void;
  registerUI?(registry: UIExtensionRegistry): void;
}
```

Cela évite un gigantesque fichier central contenant toutes les fonctionnalités.

---

## 23. Arborescence recommandée du dépôt

```text
/
├── README.md
├── ARCHITECTURE.md
├── LICENSE
├── package.json
├── tsconfig.json
├── vite.config.ts
│
├── apps/
│   └── web/
│       ├── src/
│       └── public/
│
├── packages/
│   ├── core-domain/
│   ├── geometry/
│   ├── editor-core/
│   ├── drawing-engine/
│   ├── materials/
│   ├── assemblies/
│   ├── quantities/
│   ├── calculation-core/
│   ├── rule-engine/
│   ├── standards-registry/
│   ├── project-io/
│   ├── units/
│   └── ui-components/
│
├── modules/
│   ├── thermal/
│   ├── hygrothermal/
│   ├── heating/
│   ├── cooling/
│   ├── photovoltaic/
│   ├── battery/
│   ├── water-supply/
│   ├── rainwater/
│   ├── hot-water/
│   ├── drainage/
│   ├── ventilation/
│   ├── air-quality/
│   ├── electrical/
│   ├── lighting/
│   ├── acoustics/
│   ├── cost/
│   └── environmental/
│
├── catalogs/
│   ├── materials/
│   ├── assemblies/
│   ├── symbols/
│   ├── equipment/
│   └── rules/
│
├── docs/
│   ├── specifications/
│   ├── standards/
│   ├── calculations/
│   ├── ui/
│   └── adr/
│
├── tests/
│   ├── fixtures/
│   ├── reference-projects/
│   └── integration/
│
└── scripts/
    ├── validate-catalogs/
    ├── generate-schemas/
    └── check-references/
```

---

## 24. Schémas et validation des données

Chaque format JSON doit posséder un JSON Schema ou équivalent généré depuis les types TypeScript.

Validation obligatoire à l’import pour :

- projets ;
- matériaux ;
- assemblages ;
- symboles ;
- règles ;
- équipements.

Les erreurs doivent préciser le chemin exact :

```text
materials[14].thermal.conductivityLambda
Valeur attendue : > 0 W/(m·K)
Valeur reçue : -0.04
```

---

## 25. Gestion des unités

Aucune formule importante ne doit dépendre d’une chaîne telle que `"mm"` ou `"kWh"` saisie arbitrairement.

Créer un package `units` central.

Principes :

- SI canonique dans le moteur physique ;
- unité explicite dans les données externes ;
- conversion à l’entrée/sortie ;
- formatage séparé ;
- tolérances numériques documentées.

Grandeurs :

- longueur ;
- surface ;
- volume ;
- masse ;
- temps ;
- température ;
- énergie ;
- puissance ;
- pression ;
- débit ;
- conductivité ;
- résistance thermique ;
- transmittance ;
- éclairement ;
- niveau acoustique.

---

## 26. Qualité et niveaux de calcul

Tous les modules n’auront pas immédiatement la précision d’un logiciel réglementaire certifié.

Chaque résultat doit donc être classé :

```text
ESTIMATE      estimation rapide
ENGINEERING   calcul technique documenté
STANDARD      calcul suivant une méthode normative identifiée
REGULATORY    calcul réglementaire validé pour un contexte précis
```

Le niveau `REGULATORY` ne doit être utilisé que lorsqu’une méthode complète a été implémentée, testée et documentée.

---

## 27. Tests

### 27.1 Tests unitaires

Pour :

- géométrie ;
- intersections ;
- surfaces ;
- volumes ;
- conversions unités ;
- formules ;
- règles ;
- migrations.

### 27.2 Golden tests graphiques

Créer des projets de référence dont les SVG générés sont comparés automatiquement.

Ils vérifient :

- traits ;
- hachures ;
- symboles ;
- cotations ;
- plans de discipline.

### 27.3 Cas de référence calcul

Chaque module possède des cas simples calculables manuellement.

Exemple thermique : mur monocouche connu.

Exemple hydraulique : tube droit et débit connu.

### 27.4 Tests d’intégration

Projet test : petite maison avec :

- 1 niveau ;
- 5 pièces ;
- fenêtres ;
- toiture ;
- eau ;
- VMC ;
- circuits électriques ;
- chauffage ;
- PV.

Les résultats servent de référence de non-régression.

---

## 28. Performances

### 28.1 Calculs incrémentaux

Une modification de matériau sur un mur ne doit pas recalculer :

- toute la plomberie ;
- toute l’électricité ;
- tous les dessins indépendants.

Utiliser des dépendances explicites et des hashes d’entrées.

### 28.2 Web Workers

Déporter :

- simulation temporelle ;
- optimisation ;
- calcul solaire détaillé ;
- calcul acoustique complexe ;
- grands métrés.

### 28.3 Géométrie

Utiliser des caches pour :

- contours ;
- intersections ;
- triangulation ;
- bounding boxes ;
- hit-testing.

---

## 29. Sécurité et confidentialité

MVP : aucune donnée projet n’est envoyée par défaut vers un serveur.

Toute intégration externe future doit être explicite.

Les fichiers importés doivent être considérés comme non fiables :

- validation stricte ;
- pas d’exécution de scripts ;
- SVG importés nettoyés ;
- limites de taille ;
- catalogues validés.

---

## 30. Ergonomie générale

Disposition recommandée :

```text
┌─────────────────────────────────────────────────────────────┐
│ Barre projet / vue / échelle / outils                       │
├──────────────┬────────────────────────────┬─────────────────┤
│ Outils       │                            │ Inspecteur       │
│              │        PLAN / VUE          │ objet sélectionné│
│ Architecture │                            │ propriétés       │
│ Technique    │                            │ calculs          │
│ Analyse      │                            │ alertes          │
├──────────────┴────────────────────────────┴─────────────────┤
│ Résultats / messages / calculs / scénarios                  │
└─────────────────────────────────────────────────────────────┘
```

### 30.1 Modes de complexité

Prévoir :

- **Simple** : paramètres essentiels ;
- **Advanced** : propriétés techniques ;
- **Expert** : méthodes, coefficients, règles, diagnostics.

Ne jamais dupliquer le moteur entre ces modes : seule la quantité de paramètres exposés change.

---

## 31. MVP recommandé

Le premier MVP ne doit pas tenter tous les systèmes techniques.

### Phase A — Fondation

- monorepo TypeScript ;
- modèle projet ;
- unités ;
- matériaux ;
- assemblages ;
- sauvegarde/import JSON ;
- tests.

### Phase B — Éditeur architectural

- niveaux ;
- murs ;
- jonctions ;
- portes ;
- fenêtres ;
- pièces ;
- cotations ;
- SVG ;
- snap ;
- Undo/Redo.

### Phase C — Matériaux + métrés

- parois multicouches ;
- hachures ;
- bibliothèque matériaux ;
- matériaux utilisateur ;
- quantités ;
- liste globale matériaux.

### Phase D — Thermique

Premier vrai module interconnecté :

- R/U ;
- surfaces ;
- pertes ;
- vue thermique ;
- bilan par pièce/bâtiment.

### Phase E — Eau + pluie

- équipements sanitaires ;
- eau froide/chaude ;
- réseau ;
- diamètres ;
- pertes ;
- collecte pluie ;
- cuve.

### Phase F — Ventilation

- bouches ;
- gaines ;
- débits ;
- pertes ;
- vue ventilation.

### Phase G — Électricité + éclairage

- symboles ;
- circuits ;
- puissance ;
- sections ;
- protections ;
- luminaires ;
- lux.

### Phase H — Énergie globale

- chauffage ;
- ECS ;
- PV ;
- batterie ;
- synthèse annuelle.

### Phase I — Acoustique / environnement / coût

- acoustique ;
- coûts ;
- carbone ;
- comparateur de scénarios.

---

## 32. Décisions structurantes à ne pas remettre en cause sans ADR

1. Le modèle bâtiment est la source unique de vérité.
2. La 2D paramétrique est prioritaire sur la 3D.
3. SVG est le rendu technique principal.
4. Le dessin graphique ne contient pas les formules.
5. Les réseaux sont des graphes métier, pas des polylignes décoratives.
6. Les parois utilisent des assemblages multicouches.
7. Les matériaux sont extensibles et portent leur provenance.
8. Les règles et normes sont versionnées hors du code métier.
9. Les calculs déclarent leurs dépendances.
10. Les projets sont sérialisables et migrables.
11. Le MVP reste utilisable sans serveur.
12. Un résultat réglementaire ne peut pas être annoncé sans méthode validée.

---

## 33. Référentiels techniques initiaux à documenter

Cette liste est un **registre de travail**, pas une déclaration de conformité globale.

### Dessin / documentation

- ISO 128-1
- ISO 128-3
- ISO 128-23
- ISO 129-1
- ISO 5455
- ISO 5457
- ISO 7200
- ISO 13567-1
- ISO 13567-2
- ISO 19650-1/-2

### Thermique / énergie

- ISO 10456
- ISO 6946
- ISO 13786
- ISO 13788
- ISO 52000-1 et famille EPB pertinente
- RE2020 et textes consolidés applicables en France

### Eau

- NF EN 806, parties pertinentes
- NF DTU 60.11
- textes sanitaires français applicables à l’eau potable et aux eaux impropres à la consommation humaine

### Ventilation

- arrêté français relatif à l’aération des logements et modifications applicables
- famille EN/NF EN 16798 lorsque pertinente à la méthode utilisée

### Électricité

- série NF C 15-100 applicable, version de référence explicitement enregistrée

### Acoustique

- série ISO 12354 selon le niveau de calcul implémenté

### Données environnementales

- base INIES / FDES / PEP selon droits et modalités d’utilisation
- données RE2020 applicables

---

## 34. Documents à créer ensuite dans le dépôt

Ordre recommandé :

```text
01_VISION_AND_SCOPE.md
02_DOMAIN_MODEL.md
03_GEOMETRY_ENGINE.md
04_DRAWING_CONVENTIONS.md
05_MATERIALS_CATALOG.md
06_ASSEMBLIES_AND_QUANTITIES.md
07_STANDARDS_AND_RULES.md
08_CALCULATION_ENGINE.md
09_MODULE_SPECIFICATIONS.md
10_UI_UX_SPECIFICATION.md
11_PROJECT_FILE_FORMAT.md
12_TEST_STRATEGY.md
13_ROADMAP.md
14_CONTRIBUTING.md
```

Puis un dossier ADR :

```text
docs/adr/
├── ADR-0001-source-of-truth.md
├── ADR-0002-svg-rendering.md
├── ADR-0003-geometry-units.md
├── ADR-0004-module-api.md
├── ADR-0005-rule-packs.md
└── ADR-0006-project-file-versioning.md
```

---

## 35. Critère de réussite de l’architecture

L’architecture est considérée correcte si le scénario suivant est possible sans duplication majeure :

1. l’utilisateur dessine une maison ;
2. il affecte un mur multicouche ;
3. le plan affiche les bonnes épaisseurs et hachures ;
4. le métré ajoute automatiquement chaque matériau ;
5. le calcul thermique met à jour le U et les pertes ;
6. le bilan chauffage change ;
7. la consommation énergétique change ;
8. le dimensionnement PV change ;
9. le tableau global se met à jour ;
10. aucune autre géométrie du bâtiment n’a été recréée pour effectuer ces calculs.

Le même principe doit fonctionner pour l’eau, la ventilation, l’électricité, l’éclairage et l’acoustique.

---

## 36. Résumé de l’architecture cible

Le produit final est un **mini-BIM technique résidentiel local-first** composé de :

```text
PARAMETRIC BUILDING MODEL
          │
          ├── MATERIAL / ASSEMBLY CATALOG
          │
          ├── TECHNICAL NETWORK GRAPHS
          │
          ├── STANDARDS & RULE PACKS
          │
          ├── CALCULATION GRAPH
          │
          ├── QUANTITY TAKEOFF / BOM
          │
          └── DRAWING VIEW ENGINE
                   │
                   ├── Architecture
                   ├── Materials
                   ├── Thermal
                   ├── Water
                   ├── Ventilation
                   ├── Electrical
                   ├── Lighting
                   ├── Acoustics
                   └── Global analysis
```

Le projet doit rester utilisable progressivement : un utilisateur peut faire uniquement un calcul solaire, uniquement un plan thermique, uniquement un réseau de ventilation, ou construire un modèle complet dont toutes les disciplines sont reliées.

La priorité de développement doit rester : **cohérence du modèle → qualité graphique → traçabilité des calculs → richesse fonctionnelle**.
