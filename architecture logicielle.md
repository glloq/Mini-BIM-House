# Architecture logicielle — House Technical Designer

## 1. Vision

Le projet est un **mini-BIM technique résidentiel modulaire**, centré sur la conception graphique et l’étude technique d’une habitation.

Principe fondamental :

**un seul modèle de maison → plusieurs représentations graphiques → plusieurs moteurs de calcul → une nomenclature globale.**

Le logiciel doit pouvoir être utilisé :

- comme simple calculateur spécialisé ;
- pour étudier un sous-système ;
- pour concevoir une habitation complète ;
- pour comparer plusieurs variantes de conception.

---

## 2. Source unique de vérité

La maison n’est jamais redessinée indépendamment pour chaque module.

Le modèle central contient :

```text
PROJECT
├── Site
├── Climate
├── Building
│   ├── Levels
│   ├── Rooms
│   ├── Walls
│   ├── Slabs
│   ├── Roofs
│   └── Openings
│
├── Materials
├── Assemblies
├── Technical systems
├── Equipment
├── Scenarios
├── Regulatory context
└── Drawing views
```

Une modification du bâtiment doit automatiquement se propager aux modules concernés.

Exemple :

```text
épaisseur isolation
        ↓
composition mur
        ↓
U du mur
        ↓
pertes thermiques
        ↓
puissance chauffage
        ↓
consommation
        ↓
dimensionnement PV
```

---

# 3. Architecture générale

```text
┌───────────────────────────────────────────────┐
│                 INTERFACE WEB                 │
├───────────────────────────────────────────────┤
│ Plans │ Inspecteurs │ Résultats │ Dashboards │
├───────────────────────────────────────────────┤
│            DRAWING ENGINE / SVG               │
├───────────────────────────────────────────────┤
│ Editor │ Snap │ Commands │ Undo/Redo          │
├───────────────────────────────────────────────┤
│             BUILDING MODEL                    │
├───────────────────────────────────────────────┤
│ Materials │ Assemblies │ Equipment            │
├───────────────────────────────────────────────┤
│ Technical networks │ Rules │ Standards        │
├───────────────────────────────────────────────┤
│          CALCULATION ORCHESTRATOR             │
├───────────────────────────────────────────────┤
│ Thermal │ Water │ Air │ Electrical │ etc.     │
├───────────────────────────────────────────────┤
│ Import │ Export │ Migrations │ Reports        │
└───────────────────────────────────────────────┘
```

---

# 4. Technologies

Architecture recommandée :

- TypeScript ;
- React ;
- Vite ;
- SVG pour le dessin technique 2D ;
- Canvas pour certaines cartes analytiques ;
- Web Workers pour les calculs lourds ;
- JSON pour projets/catalogues/règles ;
- application statique compatible GitHub Pages.

Le moteur métier ne doit pas dépendre de React.

---

# 5. Géométrie paramétrique

Les plans ne doivent pas être des dessins libres.

Un mur est un objet :

```text
Wall
├── path
├── height
├── level
├── assembly
├── reference side
├── openings
└── joins
```

Le moteur déduit :

- épaisseur ;
- faces ;
- intersections ;
- surfaces ;
- volumes ;
- jonctions.

Même principe pour :

- toiture ;
- plancher ;
- porte ;
- fenêtre ;
- pièce ;
- escalier.

---

# 6. Pièces

Une pièce est une vraie entité métier.

```text
Room
├── name
├── type
├── area
├── volume
├── occupation
├── temperature setpoint
├── humidity target
├── ventilation requirements
├── lighting requirements
├── thermal zone
└── acoustic zone
```

Les pièces doivent idéalement être détectées automatiquement depuis les murs fermés.

---

# 7. Parois multicouches

Une paroi référence un `Assembly`.

Exemple :

```text
Mur extérieur
│
├── Enduit               15 mm
├── Brique               200 mm
├── Laine de bois        145 mm
├── Frein vapeur           1 mm
├── Vide technique        45 mm
└── Plaque de plâtre      13 mm
```

Cette seule définition sert :

- au dessin ;
- aux coupes ;
- aux hachures ;
- au métré ;
- au thermique ;
- à l'hygrothermie ;
- à l'acoustique ;
- au carbone ;
- au coût.

---

# 8. Bibliothèque de matériaux

Trois types :

```text
GenericMaterial
ProductMaterial
CustomMaterial
```

Propriétés possibles :

```text
Material
├── Identity
├── Category
├── Manufacturer
├── Physical
│   ├── density
│   └── specific heat
│
├── Thermal
│   ├── lambda
│   └── emissivity
│
├── Hygrothermal
│   ├── mu
│   └── water properties
│
├── Acoustic
│   ├── absorption
│   └── Rw
│
├── Fire
├── Environmental
├── Economic
├── Appearance
└── Provenance
```

Toutes les propriétés ne sont pas obligatoires.

Une valeur inconnue reste explicitement inconnue.

---

# 9. Matériaux utilisateur

L'utilisateur peut :

- créer ;
- modifier ;
- dupliquer ;
- importer ;
- exporter ;
- compléter ;

un matériau.

Une modification utilisateur ne doit jamais écraser silencieusement un matériau officiel ou générique.

---

# 10. Provenance des données

Chaque propriété technique importante doit pouvoir enregistrer :

```text
value
source
reference
date
method
validity
notes
```

Deux propriétés d'un même matériau peuvent provenir de sources différentes.

---

# 11. Métré automatique

Le moteur génère automatiquement une liste globale :

- matériaux ;
- surfaces ;
- volumes ;
- masses ;
- longueurs ;
- équipements ;
- réseaux.

Exemple :

```text
Laine de bois

Surface nette       183.4 m²
Épaisseur             0.145 m
Volume                26.59 m³
Marge chantier          8 %
Quantité à prévoir     28.72 m³
```

Il faut distinguer :

**quantité géométrique** et **quantité d'achat**.

---

# 12. Réseaux techniques

Les réseaux sont de vrais graphes métier.

```text
Network
├── Nodes
├── Segments
├── Equipment
└── Terminals
```

Cela concerne :

- plomberie ;
- évacuation ;
- eau de pluie ;
- chauffage ;
- ventilation ;
- électricité.

Une canalisation dessinée est donc également une canalisation calculable.

---

# 13. Moteur de dessin

Une vue est générée depuis le modèle :

```text
Model
 ↓
View Definition
 ↓
Semantic Scene
 ↓
Graphic Rules
 ↓
SVG
```

Types de vues :

- architecture ;
- matériaux ;
- thermique ;
- plomberie ;
- évacuation ;
- ventilation ;
- chauffage ;
- électricité ;
- éclairage ;
- acoustique ;
- photovoltaïque ;
- coupe ;
- façade ;
- synthèse.

---

# 14. Styles sémantiques

Le code ne doit pas dire :

```text
line = black 2px
```

mais :

```text
WALL_CUT
WALL_VISIBLE
INSULATION
DIMENSION
WATER_COLD
WATER_HOT
VENT_SUPPLY
VENT_EXHAUST
ELECTRICAL_POWER
LIGHTING
```

Un profil graphique transforme ensuite ces rôles en représentation réelle.

---

# 15. Calques

Chaque élément peut être classé par :

- discipline ;
- fonction ;
- système ;
- niveau ;
- phase ;
- état ;
- classe graphique.

Un moteur génère ensuite les noms de calques pour les exports CAD.

---

# 16. Symboles techniques

Créer une bibliothèque centrale :

```text
SymbolDefinition
├── semantic type
├── discipline
├── geometry
├── anchors
├── orientation
├── text anchors
├── scale rules
└── reference
```

Exemples :

- prises ;
- interrupteurs ;
- luminaires ;
- radiateurs ;
- sanitaires ;
- bouches VMC ;
- vannes ;
- pompes ;
- tableaux ;
- panneaux solaires.

---

# 17. Référentiels techniques

Créer un registre indépendant du code.

```text
StandardsRegistry
```

Types :

```text
LAW
REGULATION
STANDARD
DTU
TECHNICAL_METHOD
GUIDELINE
DATA_SOURCE
USER_RULE
```

Chaque référence possède :

- identifiant ;
- domaine ;
- pays ;
- version ;
- date d'entrée en vigueur ;
- date éventuelle de fin ;
- source ;
- statut.

---

# 18. Rule Packs

Exemple :

```text
France
├── Electrical
├── Ventilation
├── Water
├── Rainwater
├── Thermal
└── Environmental
```

Une règle possède :

```text
Rule
├── condition
├── inputs
├── evaluation
├── severity
├── message
└── reference
```

Résultats possibles :

```text
ERROR
WARNING
INFO
UNKNOWN
```

---

# 19. Niveaux de précision

Chaque calcul doit annoncer son niveau :

```text
ESTIMATE
ENGINEERING
STANDARD
REGULATORY
```

`REGULATORY` ne doit jamais être utilisé tant que la méthode complète n'est pas validée.

---

# 20. Moteur de calcul

Interface cible :

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

Chaque résultat contient :

- version ;
- entrées ;
- sorties ;
- hypothèses ;
- avertissements ;
- références ;
- diagnostic.

---

# 21. Dépendances entre calculs

Le moteur utilise un graphe.

```text
Geometry
├── Areas
│   ├── Thermal
│   │   ├── Heating
│   │   └── Energy
│   │       └── PV
│   │
│   └── Quantities
│       ├── Cost
│       └── Environmental
│
└── Rooms
    ├── Ventilation
    ├── Lighting
    └── Acoustics
```

Seuls les modules impactés sont recalculés.

---

# 22. Modules prévus

## Architecture

- géométrie ;
- surfaces ;
- volumes ;
- orientations ;
- métrés.

## Thermique

- R ;
- U ;
- pertes ;
- zones ;
- chauffage ;
- confort d'été.

## Hygrothermie

- vapeur ;
- condensation ;
- température de surface.

## Énergie

- consommations ;
- chauffage ;
- ECS ;
- refroidissement.

## Photovoltaïque

- surface disponible ;
- orientation ;
- puissance ;
- production ;
- autoconsommation.

## Batterie

- capacité ;
- autonomie ;
- SOC ;
- puissance.

## Eau

- consommation ;
- débit ;
- pression ;
- diamètre ;
- pertes de charge.

## Eau de pluie

- collecte ;
- pluviométrie ;
- cuve ;
- autonomie ;
- appoint.

## Évacuation

- diamètres ;
- pente ;
- réseaux.

## Ventilation

- débit ;
- gaines ;
- vitesse ;
- pertes de charge ;
- équilibrage.

## Air intérieur

- CO₂ ;
- humidité ;
- occupation.

## Électricité

- circuits ;
- puissance ;
- intensité ;
- sections ;
- protections ;
- chute de tension.

## Éclairage

- luminaires ;
- lux ;
- puissance ;
- carte d'éclairement.

## Acoustique

- RT ;
- absorption ;
- transmission ;
- façades ;
- séparation entre pièces.

## Coût

- matériaux ;
- équipements ;
- lots ;
- scénarios.

## Environnement

- masses ;
- données environnementales ;
- carbone ;
- comparaison de solutions.

---

# 23. Éditeur

Toutes les modifications passent par des commandes :

```text
AddWall
MoveWall
SetAssembly
InsertWindow
ConnectPipe
AddSocket
SetMaterial
```

Cela permet :

- Undo ;
- Redo ;
- historique cohérent ;
- recalcul contrôlé.

---

# 24. Snapping

Prévoir :

- grille ;
- point ;
- milieu ;
- intersection ;
- perpendiculaire ;
- parallèle ;
- alignement ;
- angle.

---

# 25. État applicatif

Séparer :

```text
ProjectState
EditorState
DerivedState
UserPreferences
```

`ProjectState` doit toujours être sérialisable.

---

# 26. Format projet

Format proposé :

```text
*.houseproj.json
```

Avec obligatoirement :

```text
schemaVersion
```

Les changements futurs doivent passer par des migrations.

---

# 27. Import / export

MVP :

- JSON projet ;
- JSON matériaux ;
- JSON assemblages ;
- SVG ;
- CSV métrés ;
- CSV résultats ;
- PDF via impression.

Plus tard :

- DXF ;
- IFC ;
- GeoJSON ;
- fonds de plans.

---

# 28. Structure du dépôt

```text
/
├── README.md
├── ARCHITECTURE.md
│
├── apps/
│   └── web/
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
│   └── units/
│
├── modules/
│   ├── thermal/
│   ├── ventilation/
│   ├── water/
│   ├── rainwater/
│   ├── electrical/
│   ├── photovoltaic/
│   ├── lighting/
│   ├── acoustics/
│   └── ...
│
├── catalogs/
│   ├── materials/
│   ├── assemblies/
│   ├── equipment/
│   ├── symbols/
│   └── rules/
│
├── docs/
│   ├── specifications/
│   ├── standards/
│   ├── calculations/
│   ├── ui/
│   └── adr/
│
└── tests/
```

---

# 29. Tests

Prévoir dès le début :

- tests géométriques ;
- tests des unités ;
- tests des formules ;
- tests des règles ;
- tests des migrations ;
- cas de référence ;
- golden tests SVG ;
- projets complets de non-régression.

---

# 30. MVP

Ordre recommandé :

### A — Core

- TypeScript ;
- modèle projet ;
- unités ;
- matériaux ;
- assemblages.

### B — Architecture

- murs ;
- ouvertures ;
- pièces ;
- SVG ;
- cotes ;
- snap ;
- Undo/Redo.

### C — Matériaux

- parois multicouches ;
- hachures ;
- catalogue ;
- ajout utilisateur ;
- métrés.

### D — Thermique

- premier calcul transversal complet.

### E — Eau

- plomberie ;
- pluie ;
- cuve.

### F — Ventilation

- réseaux ;
- débits ;
- dimensionnement.

### G — Électricité

- circuits ;
- protections ;
- éclairage.

### H — Énergie

- chauffage ;
- ECS ;
- PV ;
- batterie.

### I — Avancé

- acoustique ;
- coût ;
- environnement ;
- scénarios.

---

# 31. Documents de programmation à créer ensuite

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

Puis :

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

# 32. Règles architecturales fondamentales

1. Une seule géométrie du bâtiment.
2. Modèle paramétrique avant dessin libre.
3. SVG comme moteur 2D principal.
4. 3D dérivée du modèle, jamais indépendante.
5. Parois multicouches.
6. Matériaux extensibles.
7. Provenance des valeurs.
8. Réseaux sous forme de graphes.
9. Normes/règles hors du code métier.
10. Calculs modulaires avec dépendances.
11. Métrés générés automatiquement.
12. Fichiers projet versionnés.
13. Résultats techniques traçables.
14. Pas de mention « réglementaire » sans validation.
15. Interface simple au-dessus d'un moteur technique complet.

---

# 33. Architecture cible finale

```text
                BUILDING MODEL
                     │
       ┌─────────────┼──────────────┐
       │             │              │
 MATERIALS      ASSEMBLIES      EQUIPMENT
       │             │              │
       └─────────────┼──────────────┘
                     │
             TECHNICAL SYSTEMS
                     │
       ┌─────────────┼──────────────┐
       │             │              │
    RULES        CALCULATIONS    QUANTITIES
       │             │              │
       └─────────────┼──────────────┘
                     │
               DRAWING ENGINE
                     │
 ┌─────────┬─────────┼────────┬───────────┐
 │         │         │        │           │
ARCHI   THERMAL    WATER     AIR      ELECTRICAL
 │         │         │        │           │
 └─────────┴─────────┼────────┴───────────┘
                     │
              GLOBAL ANALYSIS
```

Le projet doit être développé dans cet ordre :

**cohérence du modèle → qualité graphique → qualité des calculs → couverture réglementaire → richesse fonctionnelle.**
