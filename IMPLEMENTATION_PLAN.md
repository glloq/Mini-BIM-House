# Plan d'implémentation — PR par PR

> **Objectif :** guider le développement sans dérive architecturale.  
> Chaque PR doit rester petite, testable et réversible.

## Règles générales

Chaque PR doit :

- respecter `ARCHITECTURE.md` ;
- citer les documents de spécification concernés ;
- ajouter les tests avant ou avec l'implémentation ;
- ne pas introduire de règle réglementaire dans un calculateur physique ;
- ne pas stocker de donnée dérivée comme source de vérité ;
- ne pas ajouter de dépendance lourde sans justification ;
- conserver GitHub Pages comme cible possible.

---

# Phase 0 — Bootstrap

## PR-001 — Monorepo TypeScript

Créer :

```text
apps/web
packages/core-domain
packages/geometry
packages/units
packages/project-io
packages/editor-core
packages/drawing-engine
packages/calculation-core
packages/rule-engine
packages/materials
packages/equipment-catalog
modules/*
```

Configurer :

- TypeScript strict ;
- Vite ;
- React ;
- Vitest ;
- ESLint ;
- Prettier ;
- workspace package manager.

**Acceptation :**

- build vide ;
- test vide ;
- app GitHub Pages affichable.

## PR-002 — CI

Créer workflow :

- lint ;
- typecheck ;
- tests ;
- build.

Ajouter validation des JSON Schemas.

**Acceptation :**

- CI verte ;
- exemple projet validé.

---

# Phase 1 — Unités et domaine

## PR-003 — Units

Implémenter :

- longueurs ;
- surfaces ;
- volumes ;
- puissance ;
- énergie ;
- pression ;
- débit ;
- température ;
- conversions UI.

**Tests :**

- mm↔m ;
- L↔m³ ;
- kWh↔Wh ;
- l/min↔m³/s.

## PR-004 — IDs et base domain

Implémenter :

- branded IDs ;
- Entity base ;
- Project metadata ;
- Site ;
- Building ;
- Level.

**Acceptation :**

- sérialisation ;
- aucun ID basé sur index.

## PR-005 — Materials

Implémenter :

- Generic/Product/Custom ;
- propriétés ;
- provenance ;
- JSON Schema.

**Acceptation :**

- créer matériau custom ;
- exporter/importer ;
- propriété inconnue conservée inconnue.

## PR-006 — Assemblies

Implémenter :

- couches ordonnées ;
- épaisseurs ;
- références matériaux ;
- calcul épaisseur totale.

**Tests :**

- ordre ;
- matériau absent ;
- épaisseur invalide.

---

# Phase 2 — Géométrie

## PR-007 — Geometry primitives

Implémenter :

- Point2D/3D ;
- segment ;
- polyligne ;
- polygone ;
- distance ;
- aire ;
- bbox.

**Tests GEO-001..003.**

## PR-008 — Intersections et offsets

Implémenter :

- intersection segments ;
- offset simple ;
- tolérances ;
- normalisation.

**Acceptation :**

- cas orthogonaux fiables ;
- diagnostics dégénérés.

## PR-009 — Wall domain

Implémenter `Wall` :

- reference path ;
- assembly ;
- faces dérivées ;
- épaisseur.

**Acceptation :**

- mur 2D affichable depuis modèle.

## PR-010 — Wall joins

Implémenter jonctions :

- L ;
- T ;
- croisement ;
- coins.

Ne viser d'abord que segments droits.

**Golden fixtures obligatoires.**

## PR-011 — Openings

Implémenter :

- host ;
- position relative ;
- porte ;
- fenêtre ;
- déduction surface nette.

## PR-012 — Spaces

Implémenter détection des faces fermées et `Space AUTO`.

**Acceptation :**

- maison simple divisée en 4 pièces.

---

# Phase 3 — Editeur et rendu

## PR-013 — Semantic scene

Créer :

- DrawingView ;
- ScenePrimitive ;
- SemanticRole ;
- GraphicProfile.

Aucun outil de dessin utilisateur encore.

## PR-014 — SVG renderer

Rendre :

- murs ;
- ouvertures ;
- espaces ;
- sélection.

Séparer modèle/scène/SVG.

## PR-015 — Camera / zoom / pan / snap

Implémenter :

- caméra ;
- grille ;
- zoom ;
- pan ;
- snap point/midpoint/intersection.

## PR-016 — Command system

Implémenter :

- dispatcher ;
- transactions ;
- Undo/Redo ;
- ChangeSet.

Ajouter :

- AddWall ;
- MoveWall ;
- DeleteWall.

## PR-017 — Wall drawing tool

UI :

- clic points ;
- orthogonal ;
- longueur ;
- escape ;
- preview transient.

## PR-018 — Openings tool

Insertion porte/fenêtre sur host.

## PR-019 — Dimensions

Cotes :

- alignées ;
- horizontales/verticales ;
- liées à la géométrie.

---

# Phase 4 — Projet / persistance

## PR-020 — Project I/O

Implémenter :

- current schema ;
- load ;
- validate ;
- save ;
- download/upload JSON.

## PR-021 — Migrations

Créer une ancienne fixture artificielle et première migration.

**Acceptation :**

- pipeline démontré avant que des migrations réelles deviennent nécessaires.

## PR-022 — Autosave local

Optionnel :

- IndexedDB/local storage ;
- récupération après crash.

Le fichier exporté reste la référence portable.

---

# Phase 5 — Matériaux et métrés

## PR-023 — Material editor

UI :

- recherche ;
- filtre ;
- création custom ;
- provenance ;
- propriétés manquantes.

## PR-024 — Assembly editor

UI coupe multicouche :

- ordre ;
- épaisseur ;
- matériau ;
- hatch.

## PR-025 — Quantities

Calculer :

- longueurs ;
- surfaces ;
- volumes ;
- masse si densité ;
- ouvertures déduites.

Exporter CSV.

---

# Phase 6 — Premier module scientifique complet

## PR-026 — Calculation core

Implémenter :

- registry ;
- dependencies ;
- fingerprints ;
- results ;
- warnings ;
- assumptions.

## PR-027 — Thermal R/U

Implémenter `thermal` :

- couches ;
- R ;
- U ;
- H.

Tests T-001..T-004.

## PR-028 — Thermal building aggregation

Ajouter :

- pièces ;
- zones ;
- bâtiment ;
- ponts manuels.

Test T-005.

## PR-029 — Thermal overlay

Vue :

- U ;
- pertes ;
- missing data ;
- légende.

Cette PR valide la chaîne complète :

```text
geometry → material → calculation → graphic analysis
```

---

# Phase 7 — Rule engine

## PR-030 — Rule core

Implémenter :

- RulePack ;
- RuleResult ;
- registry ;
- dates ;
- references ;
- UNKNOWN.

## PR-031 — Rule evaluators

Implémenter :

- declarative ;
- function registry.

Pas d'`eval`.

## PR-032 — Rule UI

Afficher :

- résultat ;
- objet ;
- référence ;
- preuve ;
- suggestion.

---

# Phase 8 — Réseaux génériques

## PR-033 — Generic network graph

Implémenter :

- network ;
- nodes ;
- ports ;
- edges ;
- connectivity.

## PR-034 — Network drawing tool

UI :

- placer équipements ;
- tracer edge ;
- snap ports ;
- modifier chemin.

## PR-035 — Network analysis overlay

Infrastructure générique pour :

- diamètre ;
- débit ;
- erreur ;
- pression ;
- vitesse.

---

# Phase 9 — Eau

## PR-036 — Water domain

Ajouter types EF/ECS/non potable.

## PR-037 — Hydraulic calculations

Implémenter :

- continuité ;
- vitesse ;
- Darcy-Weisbach ;
- pertes singulières ;
- hauteur.

Tests WATER-001..006.

## PR-038 — Water sizing

Catalogue diamètres + proposition simple.

## PR-039 — Plumbing view

Plan plomberie complet avec inspecteur.

---

# Phase 10 — Eau de pluie

## PR-040 — Climate basic

Dataset mensuel/journalier :

- température ;
- pluie ;
- irradiation.

## PR-041 — Rainwater simulation

Implémenter RAIN-001..005.

## PR-042 — Rainwater solver

Tester plusieurs tailles de cuve + graphique.

## PR-043 — Rainwater rule integration

Créer premier pack démonstrateur versionné sans recopier de contenu protégé.

---

# Phase 11 — Ventilation

## PR-044 — Ventilation graph extensions

Gaines, terminaux, équipements.

## PR-045 — Airflow/losses

Débits, vitesses, pertes.

## PR-046 — Ventilation view

Overlay débit/vitesse/pression.

## PR-047 — IAQ CO2 simple

Bilan temporel CO₂ par pièce.

---

# Phase 12 — Electricité / éclairage

## PR-048 — Electrical domain

Tableaux, circuits, charges, câbles.

## PR-049 — Electrical calculations

Courant, puissance, chute de tension.

## PR-050 — Electrical plan

Symboles + circuits.

## PR-051 — Lighting

Méthode lumen + placement + intégration charge électrique.

---

# Phase 13 — Energie / solaire

## PR-052 — Roof solar surfaces

Orientation, inclinaison, obstacles.

## PR-053 — PV layout solver

Portrait/paysage, exclusion.

## PR-054 — PV energy adapter

Backend offline simple + interface PVGIS.

## PR-055 — Battery simulation

Série horaire + conservation.

## PR-056 — Energy balance

Agrégation usages/PV/batterie/réseau.

---

# Phase 14 — Autres modules

## PR-057 — Hygrothermal simplified
## PR-058 — Heating loads
## PR-059 — DHW
## PR-060 — Wastewater
## PR-061 — Acoustics room
## PR-062 — Cost
## PR-063 — Environmental links

Chaque module suit sa spécification dédiée.

---

# Phase 15 — Conventions et exports

## PR-064 — Symbol library v1

Architecture + eau + ventilation + électricité.

## PR-065 — Graphic profiles

Profil technique générique + profil FR initial.

## PR-066 — Sheets/title blocks

Formats, échelle, cartouche.

## PR-067 — SVG export

Export vectoriel propre.

## PR-068 — PDF print pipeline

Feuilles et légendes.

---

# Phase 16 — Qualité / release

## PR-069 — End-to-end reference house

Créer :

```text
examples/reference-house/
```

Maison suffisamment complète pour tester tous les modules.

## PR-070 — Performance baseline

Mesurer les benchmarks définis dans `40_CI_AND_VALIDATION.md`.

## PR-071 — Documentation utilisateur MVP

Créer :

- quick start ;
- concepts ;
- limitations ;
- niveaux de précision.

## PR-072 — Release 0.1

Conditions :

- architecture stable ;
- sauvegarde/rechargement ;
- architecture 2D ;
- matériaux ;
- métrés ;
- thermique ;
- un réseau calculable ;
- Rule Engine ;
- exports SVG ;
- CI complète.

---

# Dépendances critiques

Chemin à ne pas contourner :

```text
Units
 ↓
Domain
 ↓
Geometry
 ↓
Building elements
 ↓
Editor commands
 ↓
Drawing engine
 ↓
Project I/O
 ↓
Calculation core
 ↓
Modules
```

Ne pas commencer les modules complexes avant la stabilisation de cette chaîne.

# Definition of Done par PR

Une PR est terminée si :

- tests passent ;
- types stricts ;
- documentation mise à jour ;
- aucune TODO critique cachée ;
- diagnostics utilisateurs structurés ;
- pas de données métier dupliquées ;
- pas de formule dans un composant React ;
- exemples/schema ajustés si format modifié.
