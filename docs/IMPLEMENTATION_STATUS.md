# Implementation Status

## Last completed PR

PR-072 — audit de reprise, chantiers R-001 à R-014 (voir plus bas).

## Completed

- PR-001 — npm TypeScript workspace and minimal React/Vite web application.
- PR-002 — CI workflow and validation of every schema/example pair.
- PR-003 — explicit branded engineering unit conversions.
- PR-004 — branded IDs and core project domain.
- PR-005 — material catalog domain, provenance, validation, and tests.
- PR-006 — ordered assemblies, material-reference diagnostics, and explicit thickness aggregation.
- PR-007 — millimetre geometry primitives, operations, validation, and tests.
- PR-008 — tolerant segment intersections, polyline normalization, and simple offsets.
- PR-009 — schema-aligned wall domain and assembly-derived wall faces.
- PR-010 — explicit straight-wall join topology with golden L/T/X/collinear fixtures.
- PR-011 — hosted openings, host-bound validation, and deterministic net wall area.
- PR-012 — planar-graph room boundary detection and manual/automatic spaces.
- PR-013 — typed semantic scene, view filtering, and graphic-profile tokens.
- PR-014 — deterministic, escaped SVG rendering from semantic scenes.
- PR-015 — camera transforms, cursor-anchored zoom, pan, grid and geometry snapping.
- PR-016 — immutable commands, atomic transactions, ChangeSets, and undo/redo.
- PR-017 — transient wall drawing, orthogonal/length constraints, preview, and cancel.
- PR-018 — host-projected opening insertion with reversible commands.
- PR-019 — associative wall-endpoint dimensions with derived values and undo/redo.
- PR-020 — current-schema project loading, validation, canonical save, and future-version rejection.
- PR-021 — pure sequential project migrations with before/after fixtures and journals.
- PR-022 — validated local autosave adapters and explicit crash recovery.
- PR-023 — searchable material editor model, missing-property/provenance diagnostics, and safe JSON parsing.
- PR-024 — ordered assembly cross-section editor with explicit units, materials, and hatches.
- PR-025 — traceable SI wall quantities, opening deductions, unknown-property warnings, and CSV export.
- PR-026 — deterministic calculation registry, dependency DAG, fingerprints, cache, and traceable results.
- PR-027 — traceable thermal layer R/U/H calculations with explicit surface-method inputs and unknown-value diagnostics.
- PR-028 — deterministic room, zone, level, and building thermal aggregation with manual bridge contributions.
- PR-029 — semantic U-value and design heat-loss overlays with explicit units, scales, and missing-data values.
- PR-030 — validated Rule Pack contracts, date-aware version registry, explicit overlap conflicts, and UNKNOWN results.
- PR-031 — safe declarative evaluation, protected property paths, and versioned registered rule functions without dynamic code execution.
- PR-032 — traceable rule report view models and responsive evidence UI without implicit compliance claims.
- PR-033 — schema-aligned technical network graphs with port validation, connectivity, paths, components, and cycle detection.
- PR-034 — transient network routing with compatible-port snapping, node placement, path editing, and reversible snapshots.
- PR-035 — unit-bearing network analysis overlays with explicit unknown/error states and semantic scene projection.
- PR-036 — typed potable, hot-water, recirculation, non-potable, and rainwater network extensions with cross-connection diagnostics.
- PR-037 — SI hydraulic area, velocity, Darcy-Weisbach losses, elevation pressure, and node continuity with unknown propagation.
- PR-038 — deterministic catalog pipe sizing with externally supplied limits and uncertainty-safe smallest-diameter selection.
- PR-039 — semantic plumbing plan primitives and SI pipe inspector models with explicit missing-data warnings.
- PR-040 — validated hourly, daily, monthly, and design climate datasets with completeness, explicit gaps, and deterministic fingerprints.
- PR-041 — uncertainty-safe rainwater time-step simulation with explicit top-up, overflow, indicators, and mass-conservation tests.
- PR-042 — deterministic tank-capacity comparison with explicit initial-fill policy, marginal gains, and a unit-bearing chart model.
- PR-043 — external Rule Pack integration for rainwater prefilter evidence with explicit UNKNOWN results and hydraulic isolation.
- PR-044 — typed ventilation networks with terminals, ducts, fans, filters, dampers, heat recovery, and uncertainty-safe validation.
- PR-045 — SI duct area, velocity, Darcy-Weisbach losses, airflow continuity, and critical-branch analysis with unknown propagation.
- PR-046 — semantic ventilation plans, unit-bearing duct inspectors, and flow, velocity, and pressure overlays with explicit unknown states.
- PR-047 — analytical well-mixed room CO2 time-step balance with explicit SI inputs, summaries, and unknown propagation.
- PR-048 — graph-backed electrical boards, circuits, loads, protections, and cables with explicit reference validation.
- PR-049 — installed/design power, voltage-reference-aware current, and resistive path voltage-drop calculations with catalog-supplied resistance.
- PR-050 — semantic electrical cable and symbol plans with circuit, current, and voltage-drop overlays and explicit unknown states.
- PR-051 — traceable lumen-method lighting, target quantity proposals, deterministic grid placement, and electrical load adapters.
- PR-052 — roof-linked solar surfaces with derived inclined area, orientation, obstacles, exclusions, and explicit unknown heights.
- PR-053 — deterministic roof-plane photovoltaic layout with portrait/landscape comparison, margins, gaps, and obstacle/exclusion avoidance.
- PR-054 — traceable offline photovoltaic energy estimates and an HTTP-free, injected PVGIS transport contract with boundary validation.
- PR-055 — hourly battery dispatch with SOC/power limits, charge/discharge losses, off-grid unmet energy, and conservation tests.
- PR-056 — aligned whole-building energy aggregation across uses, vectors, PV, battery, and grid with external primary-energy factors.
- PR-057 — steady-state hygrothermal interface profiles and surface-condensation screening with explicit method limits and unknown propagation.
- PR-058 — traceable room and building heating loads with explicit transmission, ventilation, heat-recovery, and additional-load terms.
- PR-059 — traceable domestic-hot-water useful energy, ideal mixing, storage equivalence, and reheating time with explicit water properties.
- PR-060 — graph-backed gravity wastewater slopes, connectivity, level diagnostics, and externally supplied design-flow aggregation.
- PR-061 — per-band room equivalent absorption, simplified traceable reverberation time, and external treatment comparisons.
- PR-062 — immutable physical quantities, packaging and waste allowances, material/labor pricing, lot totals, currency diagnostics, and scenario comparison.
- PR-063 — explicit environmental declaration links, functional-unit conversion, life-cycle impacts, validity warnings, and traceable item/lot/level/building totals.
- PR-064 — versioned, safe semantic symbol library v1 with paper/model scaling, profile overrides, and architecture, water, ventilation, and electrical symbols.
- PR-065 — validated generic and initial French graphic profiles with paper line weights, screen colors, monochrome print variants, and complete semantic-role coverage.
- PR-066 — millimetre-based standard/custom sheets, printable-area and viewport validation, reusable title-block templates, and explicit unknown fields.
- PR-067 — deterministic clean SVG export with canonical metadata, semantic groups, stable fingerprints, safe filenames, and interaction-free technical output.
- PR-068 — ordered vector PDF print jobs with sheet sizes, explicit metadata, injected traceable conversion backends, and validated PDF artifacts.
- PR-069 — deterministic four-room reference house exercising canonical persistence, integrated energy calculations, technical networks, and semantic SVG export.
- PR-070 — reproducible microbenchmark baseline for 100 walls, 1,000 SVG primitives, a 500-segment network, annual hourly battery dispatch, and complete thermal aggregation.
- PR-071 — MVP user guide covering quick start, core concepts, precision levels, and explicit product limitations.

## Audit de reprise — chantiers R-001 à R-014

Un audit produit sur cent points a constaté que les moteurs étaient mûrs mais
que l'application ne l'était pas : interface architecturale à environ 35 %,
interface des modules techniques à 10-20 %, tests navigateur à 0 %. Sa
directive : cesser d'ajouter des moteurs isolés et transformer ceux qui
existent en application intégrée. Les chantiers ci-dessous répondent à cette
directive.

| Chantier | Objet                                        | État |
| -------- | -------------------------------------------- | ---- |
| R-001    | Réparation de l'installation et de la CI     | fait |
| R-002    | Contexte de calcul complet issu du projet    | fait |
| R-003    | Interface matériaux et assemblages           | fait |
| R-004    | Catalogue d'équipements                      | fait |
| R-005    | Rendu BIM réel du plan                       | fait |
| R-006    | Caméra, accrochage, sélection, ouvertures    | fait |
| R-007    | Multi-niveaux, pièces, dalles, toitures      | fait |
| R-008    | Tableau de bord des calculs                  | fait |
| R-009    | Superpositions d'analyse sur le plan         | fait |
| R-010    | Interface des réseaux techniques             | fait |
| R-011    | Quantités, coût, environnement               | fait |
| R-012    | Scénarios et comparaison                     | fait |
| R-013    | Tests navigateur, performance, accessibilité | fait |
| R-014    | Audit de publication                         | fait |

### Ce que fait l'application aujourd'hui

- un projet neuf s'ouvre utilisable, bibliothèque générique de seize matériaux
  et quatre assemblages incluse ;
- le plan dessine des murs en couches, des ouvertures percées avec leur
  débattement, des pièces remplies et étiquetées, les dalles et les toitures ;
- les outils mur, ouverture, cotation et réseau dessinent avec accrochage,
  contraintes de longueur et d'angle, annulation et rétablissement ;
- les seize modules de calcul s'exécutent depuis l'interface, chaque entrée
  portant son origine, chaque entrée manquante étant nommée plutôt que
  remplacée ;
- les résultats se projettent sur le plan sous forme de bandes légendées ;
- la nomenclature s'exporte en CSV, les scénarios se comparent au projet de
  base ;
- les réseaux techniques se créent, se peuplent et se relient depuis
  l'application, et non plus seulement depuis un fichier importé ;
- le projet s'exporte en JSON et en SVG, se sauvegarde localement toutes les
  1,5 s après une modification et se restaure après un rechargement, sur
  demande explicite.

### Ce que l'application ne fait pas

- escaliers : délibérément reportés ;
- export PDF, DXF, IFC : hors périmètre v0.1 ;
- simulation thermique dynamique, confort d'été, structure, géotechnique,
  éclairage naturel : hors périmètre v0.1 ;
- modes QUICK / DESIGN / EXPERT, assistant de création de projet, palette de
  commandes : non implémentés ;
- module de conformité réglementaire : le moteur de règles existe, l'interface
  de conformité n'est pas branchée sur les résultats de calcul.

## Product Completion Pass 1

Un second audit a confirmé le diagnostic : moteurs mûrs, produit inachevé. Sa
priorité n'était plus d'ajouter des calculateurs mais de raccorder ceux qui
existent, de terminer l'édition interactive et de simplifier le parcours. Cette
passe traite son lot A en entier, puis les chantiers qu'il désignait comme le
meilleur jalon suivant.

### Défauts corrigés

| Point                  | Ce qui n'allait pas                                    | État    |
| ---------------------- | ------------------------------------------------------ | ------- |
| Cotation               | l'outil était proposé et ne créait rien                | corrigé |
| Export SVG             | exportait une redite simplifiée du plan                | corrigé |
| Mobile                 | la navigation disparaissait sous 720 px                | corrigé |
| Rôle des murs          | toute création forçait `EXTERIOR`                      | corrigé |
| Dalles et toitures     | construites sur `rooms[0]` en silence                  | corrigé |
| Erreurs de rendu       | affichées comme « plan vide »                          | corrigé |
| Remplacement de projet | écrasait le travail non exporté sans un mot            | corrigé |
| Calculs                | deux exécutions concurrentes du même calcul            | corrigé |
| Suppression multiple   | une commande par objet, suppression partielle possible | corrigé |

### Ce que l'application sait faire de plus

- **Cotation** — deux angles de murs et un point de décalage ; la cote est une
  annotation du niveau, typée au schéma, résolue depuis les murs qu'elle
  mesure, et elle survit à un enregistrement.
- **Export** — le fichier SVG est le plan affiché, avec ses couches de
  matériaux, ses ouvertures percées, ses pièces, ses réseaux et ses cotes, au
  profil d'impression, en nommant son niveau et son échelle.
- **Inspecteur** — la barre d'outils crée, l'inspecteur modifie : assemblage,
  rôle, hauteur d'un mur ; type et dimensions d'une ouverture ; nom et usage
  d'une pièce ; pente et azimut d'un pan de toiture ; position et pièce
  desservie d'un nœud de réseau. Les valeurs saisies sont validées à
  l'application et refusées plutôt que rabotées.
- **Projet** — identité, site, localisation, contexte réglementaire, jeux
  climatiques et réglages de calcul des seize modules, y compris les prix, la
  main-d'œuvre, les déchets et les facteurs carbone par matériau.
- **Scénarios** — création, duplication, renommage, suppression, ajout de
  changements choisis par ce qu'ils signifient, et promotion d'une variante en
  projet.
- **Vérifications** — tout ce que le modèle, les réseaux, les calculs et le
  métré ne résolvent pas, rassemblé, avec le bouton qui mène là où corriger.
- **Mobile** — la barre latérale devient un tiroir ; les tableaux larges
  défilent dans leur cadre ; les cibles tactiles sont dimensionnées pour un
  doigt. Un projet Playwright dédié le vérifie sur un écran de téléphone.

### Ce que cette passe n'a pas traité

- édition géométrique d'un mur : déplacer une extrémité, scinder, raccorder,
  copier-coller ;
- modification de l'empreinte d'une dalle ou d'une toiture existante ;
- renommage des niveaux et gestion des zones ;
- libellés et unités des propriétés d'équipement, encore affichées par leur
  clé interne ;
- saisie de la provenance d'une propriété de matériau ;
- création guidée d'un réseau par type de système, et propriétés de tronçon
  (diamètre, matériau, débit, section) ;
- modes QUICK / DESIGN / EXPERT, assistant de création, palette de commandes ;
- Firefox et WebKit en intégration continue, axe-core, régression visuelle,
  seuils de couverture et budget de taille de bundle ;
- feuilles, cartouches et export PDF.

## Publication

- Licence : AGPL-3.0-only, texte complet dans `LICENSE`, déclarée dans
  `package.json`.
- Déploiement : GitHub Pages après une CI verte sur `main`. La construction a
  été vérifiée servie depuis un sous-chemin de projet : aucun 404, aucune
  erreur console, la maison de référence se dessine.
- Licences des dépendances : `npm run audit:licenses` vérifie les 221 paquets
  installés à chaque CI. Aucune licence incompatible avec l'AGPL, aucune
  licence non déclarée.
- Import : un fichier projet est refusé au-delà de bornes explicites — taille
  du texte, nombre de niveaux, murs, ouvertures, pièces, matériaux, nœuds et
  tronçons de réseau — avec le compte hors bornes nommé.
- Documentation : une seule copie de chaque spécification, sous `docs/`. Les
  doublons racine et la première version de l'architecture ont été supprimés.

## Décisions d'architecture tenues

- Les paquets utilisent l'espace de noms `@house-technical-designer/*`.
- La géométrie est en millimètres ; des conversions marquées isolent les
  frontières SI.
- Les constructeurs refusent les valeurs numériques non finies plutôt que
  d'inventer des valeurs par défaut.
- Aucune constante silencieuse : toute entrée de calcul vient du projet, d'un
  scénario, d'un réglage de module ou d'une source identifiée.
- Les valeurs inconnues restent inconnues ; elles ne sont jamais remplacées par
  zéro ni par une valeur typique.
- Les données dérivées ne sont jamais persistées comme source de vérité.
- L'état de l'éditeur — sélection, caméra, outil, calques — ne vit pas dans le
  projet.

## Dernier état de validation complet

Mesuré sur la branche courante :

- format : pass
- lint : pass
- typecheck : pass sur tous les espaces de travail
- schémas : 16 paires schéma/exemple validées
- licences : pass, 221 paquets audités
- tests unitaires et d'intégration : 578 tests sur 88 fichiers
- tests navigateur : 31 tests Playwright, dont trois sur un écran de téléphone
- build : pass sur tous les espaces de travail
- benchmarks : consignés dans `PERFORMANCE_BASELINE.md`
