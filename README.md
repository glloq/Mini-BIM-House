# House Technical Designer

**House Technical Designer** est une application web open source de **conception et d'étude technique d'une habitation**, pensée comme un **mini-BIM résidentiel modulaire**.

L'objectif est de réunir dans une seule interface :

- la conception architecturale 2D ;
- les matériaux et compositions de parois ;
- les calculs thermiques et énergétiques ;
- les réseaux d'eau, ventilation et électricité ;
- l'éclairage et l'acoustique ;
- le photovoltaïque et le stockage ;
- les métrés, coûts et impacts environnementaux ;
- les contrôles techniques et réglementaires via des règles versionnées.

> **Dessiner une seule fois le bâtiment, puis utiliser ce même modèle pour toutes les études techniques.**

---

## Objectif

Les logiciels de calcul du bâtiment sont souvent spécialisés : thermique, photovoltaïque, plomberie, ventilation, électricité, etc.

House Technical Designer cherche au contraire à créer un environnement commun où les différents systèmes peuvent interagir.

```text
Isolation
   ↓
Déperditions thermiques
   ↓
Besoin de chauffage
   ↓
Consommation électrique
   ↓
Dimensionnement photovoltaïque
   ↓
Dimensionnement batterie
```

Une modification du bâtiment doit pouvoir recalculer automatiquement les modules concernés.

---

## Principes du projet

### Un modèle unique du bâtiment

Les murs, ouvertures, pièces, toitures, matériaux et équipements ne sont jamais redessinés indépendamment pour chaque module.

```text
BUILDING MODEL
      │
      ├── Architecture
      ├── Thermal
      ├── Water
      ├── Ventilation
      ├── Electrical
      ├── Lighting
      ├── Acoustics
      ├── Photovoltaic
      └── Cost / Environment
```

### Une interface graphique technique

L'application doit privilégier la représentation visuelle :

- plans architecturaux ;
- coupes ;
- hachures de matériaux ;
- réseaux techniques ;
- symboles ;
- cotations ;
- cartes de pertes thermiques ;
- débits ;
- pressions ;
- tensions ;
- niveaux d'éclairement ;
- résultats acoustiques.

Les conventions graphiques doivent rester aussi proches que possible des standards du dessin technique et architectural.

### Des calculs traçables

Chaque résultat doit pouvoir indiquer :

- les données utilisées ;
- la méthode ;
- les hypothèses ;
- les unités ;
- les avertissements ;
- les références techniques ;
- la version du module.

Une donnée inconnue doit rester **inconnue** : le logiciel ne doit pas inventer silencieusement une valeur.

---

# Architecture générale

```text
┌───────────────────────────────────────────────┐
│                 INTERFACE WEB                 │
├───────────────────────────────────────────────┤
│ Plans │ Inspecteurs │ Résultats │ Dashboards │
├───────────────────────────────────────────────┤
│              DRAWING ENGINE                   │
├───────────────────────────────────────────────┤
│ Editor │ Snap │ Commands │ Undo / Redo        │
├───────────────────────────────────────────────┤
│              BUILDING MODEL                   │
├───────────────────────────────────────────────┤
│ Materials │ Assemblies │ Equipment            │
├───────────────────────────────────────────────┤
│ Networks │ Rules │ Standards │ Climate        │
├───────────────────────────────────────────────┤
│           CALCULATION ENGINE                  │
├───────────────────────────────────────────────┤
│ Thermal │ Water │ Air │ Electrical │ Energy   │
└───────────────────────────────────────────────┘
```

Le moteur métier reste indépendant de l'interface React.

---

# Modules prévus

## Architecture

- niveaux ;
- murs ;
- cloisons ;
- portes ;
- fenêtres ;
- pièces ;
- dalles ;
- toitures ;
- surfaces ;
- volumes ;
- cotations ;
- coupes et façades.

## Matériaux

- bibliothèque générale ;
- matériaux génériques ;
- produits fabricants ;
- matériaux personnalisés ;
- propriétés thermiques ;
- hygrométriques ;
- acoustiques ;
- physiques ;
- environnementales ;
- provenance des données.

Les utilisateurs pourront ajouter leurs propres matériaux sans modifier le code.

## Parois multicouches

```text
Extérieur
│
├── Enduit
├── Maçonnerie
├── Isolation
├── Frein-vapeur
├── Vide technique
└── Plaque de plâtre
│
Intérieur
```

Une composition sert simultanément au dessin, aux hachures, au thermique, à l'hygrothermie, à l'acoustique, aux métrés, au coût et à l'analyse environnementale.

## Thermique

- résistance thermique ;
- coefficient U ;
- déperditions ;
- ponts thermiques ;
- températures de surface ;
- analyse par pièce ;
- comparaison de variantes.

## Hygrothermie

- diffusion de vapeur ;
- point de rosée ;
- condensation interstitielle ;
- risque de condensation superficielle.

## Chauffage / ECS

- charge par pièce ;
- puissance nécessaire ;
- émetteurs ;
- PAC ;
- chaudière ;
- chauffage électrique ;
- besoins ECS ;
- ballon ;
- temps de chauffe ;
- énergie consommée.

## Photovoltaïque / batterie

- surfaces disponibles ;
- orientation ;
- inclinaison ;
- implantation automatique ;
- obstacles ;
- puissance installable ;
- productible ;
- strings ;
- onduleur ;
- capacité batterie ;
- SOC ;
- autoconsommation ;
- autosuffisance ;
- import/export réseau.

Une intégration optionnelle avec **PVGIS** est prévue.

## Eau / eau de pluie

- eau froide et chaude ;
- réseaux non potables ;
- diamètres ;
- débits ;
- pertes de charge ;
- pression disponible ;
- récupération de pluie ;
- filtration ;
- cuve ;
- appoint ;
- trop-plein.

## Évacuation

- eaux usées ;
- eaux-vannes ;
- pentes ;
- diamètres ;
- colonnes ;
- ventilations ;
- profils altimétriques.

## Ventilation / qualité de l'air

- soufflage ;
- extraction ;
- gaines ;
- débits ;
- vitesses ;
- pertes de charge ;
- récupération de chaleur ;
- équilibrage ;
- CO₂ ;
- humidité.

## Électricité

- tableaux ;
- circuits ;
- prises ;
- luminaires ;
- équipements ;
- puissance ;
- courant ;
- sections ;
- chute de tension ;
- protections.

## Éclairage

- implantation ;
- flux lumineux ;
- éclairement ;
- lux ;
- puissance ;
- carte d'éclairement.

## Acoustique

- absorption ;
- temps de réverbération ;
- comparaison de traitements ;
- isolation acoustique future.

## Métrés / coûts / environnement

Le modèle pourra générer automatiquement :

- surfaces ;
- longueurs ;
- volumes ;
- masses ;
- équipements ;
- réseaux ;
- quantités d'achat ;
- coûts par lot ;
- impacts environnementaux ;
- FDES / PEP / données INIES.

---

# Réseaux techniques

Les réseaux sont représentés comme des graphes.

```text
SOURCE
  │
  ├── segment
  │
JUNCTION
  ├── segment
  │
TERMINAL
```

Cette infrastructure commune est destinée à la plomberie, au chauffage, à l'évacuation, à la ventilation, à l'électricité et à la récupération d'eau.

Les propriétés physiques restent spécifiques à chaque discipline.

---

# Conventions graphiques

Le moteur de dessin est basé principalement sur **SVG**.

Le projet prévoit :

- traits techniques ;
- épaisseurs de ligne ;
- hachures ;
- symboles ;
- cotations ;
- échelles ;
- calques ;
- cartouches ;
- légendes ;
- plans thématiques.

Références structurantes prévues :

- ISO 128 ;
- ISO 129 ;
- ISO 5455 ;
- ISO 5457 ;
- ISO 7200 ;
- ISO 13567.

Les conventions nationales ou réglementaires seront intégrées via des profils graphiques et des Rule Packs dédiés.

---

# Réglementation et Rule Packs

La réglementation ne doit pas être codée directement dans les moteurs physiques.

```text
Physical calculation
        │
        ▼
Technical result
        │
        ▼
Versioned Rule Pack
        │
        ▼
PASS / FAIL / WARNING / UNKNOWN
```

Un Rule Pack contient :

- juridiction ;
- domaine ;
- période de validité ;
- références ;
- paramètres ;
- règles.

Exemples futurs :

```text
FR-ELECTRICAL
FR-VENTILATION
FR-RAINWATER
FR-THERMAL
```

---

# Niveaux de précision

Chaque calcul annonce son niveau :

```text
ESTIMATE
ENGINEERING
STANDARD
REGULATORY
```

Le niveau `REGULATORY` ne doit être utilisé qu'après validation complète de la méthode correspondante.

---

# Technologies prévues

```text
TypeScript
React
Vite
SVG
Web Workers
JSON / JSON Schema
Vitest
GitHub Actions
```

L'application doit pouvoir fonctionner comme une application web statique et rester compatible avec **GitHub Pages**.

---

# Structure cible du dépôt

```text
/
├── apps/
│   └── web/
│
├── packages/
│   ├── core-domain/
│   ├── geometry/
│   ├── units/
│   ├── materials/
│   ├── assemblies/
│   ├── equipment-catalog/
│   ├── editor-core/
│   ├── drawing-engine/
│   ├── calculation-core/
│   ├── rule-engine/
│   └── project-io/
│
├── modules/
│   ├── thermal/
│   ├── hygrothermal/
│   ├── heating/
│   ├── dhw/
│   ├── photovoltaic/
│   ├── battery/
│   ├── water/
│   ├── rainwater/
│   ├── wastewater/
│   ├── ventilation/
│   ├── iaq/
│   ├── electrical/
│   ├── lighting/
│   ├── acoustics/
│   ├── energy-balance/
│   ├── cost/
│   └── environmental/
│
├── catalogs/
├── schemas/
├── examples/
├── docs/
├── tests/
│
├── ARCHITECTURE.md
└── IMPLEMENTATION_PLAN.md
```

---

# Format projet

Format prévu :

```text
*.houseproj.json
```

Chaque fichier est versionné :

```json
{
  "schemaVersion": "1.0.0"
}
```

Les évolutions du format passent par des migrations explicites.

---

# Extensibilité

L'architecture prévoit dès le départ des évolutions importantes :

- simulation thermique dynamique ;
- confort d'été ;
- structure ;
- géotechnique ;
- lumière naturelle ;
- solaire thermique ;
- eaux grises ;
- assainissement ;
- triphasé ;
- recharge véhicule électrique ;
- domotique ;
- maintenance ;
- digital twin ;
- rénovation ;
- optimisation multicritère ;
- DXF ;
- IFC ;
- LiDAR ;
- plugins ;
- moteurs externes.

Une nouvelle discipline doit pouvoir être ajoutée principalement sous forme de :

```text
modules/new-domain/
catalogs/new-domain/
rules/new-domain/
symbols/new-domain/
views/new-domain/
```

sans casser le noyau.

---

# État du projet

Le projet est actuellement en **phase de spécification / architecture**.

Sont déjà définis :

- architecture logicielle ;
- modèle métier ;
- géométrie ;
- moteur de dessin ;
- matériaux ;
- assemblages ;
- métrés ;
- moteurs de calcul ;
- réseaux ;
- réglementation ;
- format projet ;
- JSON Schemas ;
- stratégie de tests ;
- roadmap ;
- plan d'implémentation PR par PR ;
- évolutions futures.

Le développement du noyau applicatif constitue l'étape suivante.

---

# Roadmap générale

```text
1. Core / Units
2. Geometry
3. Building Model
4. SVG Drawing Engine
5. Editor / Undo / Redo
6. Materials / Assemblies
7. Quantities
8. Calculation Core
9. Thermal
10. Rule Engine
11. Generic Networks
12. Water
13. Rainwater
14. Ventilation
15. Electrical
16. Lighting
17. Photovoltaic / Battery
18. Energy Balance
19. Remaining Modules
20. Technical Exports
```

Le plan détaillé est disponible dans :

[`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md)

---

# Documentation

La documentation technique est disponible dans :

[`docs/README.md`](docs/README.md)

Documents principaux :

- [`ARCHITECTURE.md`](ARCHITECTURE.md)
- [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md)
- [`docs/specifications/`](docs/specifications/)
- [`docs/standards/`](docs/standards/)
- [`docs/adr/`](docs/adr/)
- [`schemas/`](schemas/)
- [`examples/`](examples/)

---

# Philosophie

House Technical Designer cherche à conserver trois caractéristiques :

### Simple à utiliser

L'utilisateur doit pouvoir utiliser uniquement les modules qui l'intéressent.

### Technique

Les résultats doivent rester détaillés, vérifiables et traçables.

### Modulaire

Le logiciel doit pouvoir évoluer sans devenir un monolithe impossible à maintenir.

L'objectif final est de disposer d'un outil permettant de :

```text
DESSINER
   ↓
DÉCRIRE
   ↓
CALCULER
   ↓
VISUALISER
   ↓
COMPARER
   ↓
CONTRÔLER
```

les principaux systèmes techniques d'une habitation depuis un même modèle cohérent.

---

# Licence

La licence du projet sera définie avant la première publication stable.

Les normes, catalogues fabricants et bases externes peuvent avoir leurs propres conditions de licence et ne seront pas redistribués sans autorisation.
