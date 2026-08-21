# Implementation Status

Ce fichier est un journal : chaque section décrit l'état du projet **au moment
de la passe qu'elle raconte**, et n'est pas corrigée après coup. Une section
ancienne qui parle de seize modules de calcul ou d'une géométrie qu'on ne peut
pas remanier dit vrai de sa date, pas d'aujourd'hui — le dix-septième moteur a
été branché plus tard, et l'édition géométrique aussi.

Ce que l'application fait **aujourd'hui** se lit dans
[`../README.md`](../README.md) ; où en est la bêta, dans
[`BETA_READINESS.md`](BETA_READINESS.md) ; ce qui a changé d'une version à
l'autre, dans [`../CHANGELOG.md`](../CHANGELOG.md).

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

## Correctifs d'audit — passe suivante

Un troisième audit a relevé deux P0 et une série de P1. Les points ci-dessous
sont traités.

| Point                         | Constat                                                                                                                    | État    |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------- |
| `referenceSide`               | l'inspecteur proposait INTERIOR/EXTERIOR pour un champ qui n'accepte que CENTER/LEFT/RIGHT                                 | corrigé |
| Rôle de dalle                 | le même défaut : un rôle CEILING que le domaine ne définit pas                                                             | corrigé |
| CI navigateur                 | le serveur de prévisualisation n'était jamais joint, deux minutes puis un timeout nu                                       | corrigé |
| Sauvegarde restaurée          | affichée « Enregistré » alors qu'aucun fichier n'avait été exporté                                                         | corrigé |
| Vérifications multi-niveaux   | seul le premier niveau était examiné                                                                                       | corrigé |
| Niveaux et cotes              | un niveau ne contenant que des cotes passait pour vide ; une duplication les perdait                                       | corrigé |
| Scénario supprimé             | le panneau et la comparaison ne désignaient plus le même scénario                                                          | corrigé |
| Coordonnées du projet         | conservées d'un projet à l'autre tant que l'écran restait monté                                                            | corrigé |
| Complétude climat             | un seul pourcentage, calculé sur deux grandeurs, déclarait « complet » un jeu inutilisable pour la pluie ou l'hygrothermie | corrigé |
| « Corriger » sans destination | des constats renvoyaient vers un écran incapable de saisir la valeur                                                       | corrigé |
| Rule Engine absent du produit | `RuleReportPanel` existait sans être branché                                                                               | corrigé |

Le défaut de fond derrière les deux premiers : une liste d'énumération
réécrite à la main dans l'interface, puis castée à la sortie. TypeScript ne
pouvait rien voir. Les valeurs autorisées sont désormais des constantes du
domaine dont les types dérivent, les menus se construisent à partir d'elles
via une table de libellés indexée par le type, et les commandes revalident la
valeur — parce que l'interface qui l'a produite n'est pas celle qui doit avoir
raison.

### Ce que cette passe n'a pas traité

- réseaux : création guidée par type de système, inspecteur de tronçon,
  diamètre, section, matériau, rugosité, débit terminal — le plus gros lot
  fonctionnel restant ;
- schéma de propriétés des équipements (libellés et unités au lieu des clés) ;
- saisie de la provenance d'une propriété de matériau ;
- champ de saisie différée généralisé aux anciens panneaux ;
- portabilité du climat dans un projet unique ;
- édition géométrique des murs, empreintes des dalles et toitures, zones ;
- modes QUICK / DESIGN / EXPERT, assistant, palette, navigation regroupée ;
- Firefox, WebKit, axe-core, régression visuelle, budget de bundle ;
- feuilles, cartouches et PDF.

## Applicabilité, objets et révisions — lot A

Un quatrième audit a confirmé les correctifs précédents et relevé un P0 :
les référentiels étaient exécutés sans vérifier qu'ils s'appliquent. Les
points ci-dessous sont traités.

| Point                       | Constat                                                                                | État    |
| --------------------------- | -------------------------------------------------------------------------------------- | ------- |
| Applicabilité d'un pack     | pays, région et date de validité n'étaient pas vérifiés avant l'exécution              | corrigé |
| Verdict par objet           | seul le premier réseau d'eau de pluie était examiné, son verdict valant pour tous      | corrigé |
| Localiser un objet          | un constat nommait un objet sans permettre d'y aller                                   | corrigé |
| `id` du rapport de règles   | un identifiant fixe, dupliqué dès qu'un second référentiel était affiché               | corrigé |
| Équipements et `NaN`        | un champ numérique vidé produisait `NaN`, écrit `null` à la sauvegarde                 | corrigé |
| Clés brutes des équipements | le panneau affichait `usefulHeatingPowerW` sans libellé ni unité                       | corrigé |
| `acoustics.bandsHz`         | réglage non éditable : le module réclamait une entrée que l'écran ne savait pas saisir | corrigé |
| `projectRevision`           | jamais incrémentée, donc `SCENARIO_REVISION_MISMATCH` ne se déclenchait jamais         | corrigé |

Trois décisions valent d'être écrites.

**Un référentiel qui ne s'applique pas ne dit jamais « Validé ».** Le pipeline
est désormais : contexte réglementaire du projet → pays, région, date de
référence → registre → applicabilité → version valide → évaluation. Chaque
sortie porte sa raison : mauvais pays, texte pas encore en vigueur, deux
versions qui se chevauchent, identifiant inconnu. Une date de référence absente
n'est pas remplacée par celle du jour : choisir la date reviendrait à choisir le
texte.

**Une règle est jugée par objet.** Trois cuves de récupération donnent trois
verdicts, chacun nommant l'objet et pouvant être localisé sur le plan. Le
rapport accepte donc plusieurs résultats pour une même règle tant qu'ils
portent sur des objets différents ; ce qu'il refuse toujours, c'est la même
règle jugée deux fois sur le même objet.

**La révision identifie une édition, pas un état.** Elle est monotone : elle
avance à chaque commande appliquée, y compris une annulation ou un rétablissement
— annuler est une édition de plus, pas un retour en arrière du fichier. Le
dispatcher en est seul propriétaire, avec `updatedAt` ; ni l'un ni l'autre ne se
saisit à la main, et une commande qui tenterait de les écrire est réécrite. Un
scénario est enregistré sur la révision que produit la commande qui le crée, et
un scénario en retard peut être rattaché explicitement à la révision courante
plutôt que d'attendre que l'avertissement disparaisse tout seul.

### Ce que ce lot n'a pas traité

- moteur électrique absent du pipeline, alors que le README annonce 17 moteurs ;
- réseaux : type de système en texte libre, aucune propriété de tronçon
  (diamètre, section, matériau, rugosité, débit terminal) ;
- champ de saisie différée généralisé aux panneaux matériaux, niveaux et pièces ;
- portabilité du climat dans un projet unique ;
- édition géométrique des murs, empreintes des dalles et toitures, zones ;
- modes QUICK / DESIGN / EXPERT, assistant, palette, navigation regroupée ;
- Firefox, WebKit, axe-core, régression visuelle, découpage du bundle ;
- feuilles, cartouches et PDF.

## Intégrité des données — lot A de la préparation bêta

Un cinquième audit a fixé dix-huit portes à franchir avant une bêta utilisable.
Ce lot traite celles qui portent sur la justesse de ce que l'application montre
et enregistre.

| Porte   | Constat                                                                                                         | État    |
| ------- | --------------------------------------------------------------------------------------------------------------- | ------- |
| BETA-01 | les Vérifications pouvaient présenter des résultats calculés sur une révision antérieure                        | corrigé |
| BETA-02 | plusieurs réseaux d'une même discipline : seul le premier était calculé                                         | corrigé |
| BETA-03 | les scénarios visaient des positions dans des tableaux, pas des objets                                          | corrigé |
| BETA-04 | un scénario pouvait promouvoir un projet dont une référence ne désignait plus rien                              | corrigé |
| BETA-05 | un objet rangé sous un niveau pouvait en déclarer un autre, une ouverture pouvait citer un mur d'un autre étage | corrigé |
| BETA-08 | une duplication de niveau conservait l'altitude absolue des toitures                                            | corrigé |
| BETA-09 | un escalier importé disparaissait à la duplication et ne comptait pas à la suppression                          | corrigé |
| BETA-12 | l'export pouvait échouer sans que rien ne le dise, l'état restant « Enregistré »                                | corrigé |

Quatre décisions valent d'être écrites.

**Un résultat de calcul appartient à une révision.** Chaque exécution porte la
révision du projet, l'empreinte des jeux climatiques utilisés et ses heures de
début et de fin. L'application ne montre plus un résultat dont la révision n'est
pas celle du projet affiché : ouvrir les Vérifications relance le calcul au lieu
de réutiliser le dernier connu, et les deux écrans disent sur quelle révision
leurs chiffres ont été établis.

**Chaque réseau compte une fois.** Les adaptateurs lisaient le premier réseau de
la discipline ; ils lisent maintenant tous les réseaux, chaque tronçon portant
l'identifiant du système auquel il appartient. Les débits s'accumulent à
l'intérieur d'un système : une canalisation de la maison ne transporte pas les
appareils du garage. Un test dédié double chaque réseau de la maison de
référence et vérifie que rien n'est compté deux fois ni oublié.

**Un scénario vise un objet, pas une position.** Les chemins nomment désormais
`assemblies/mur-ossature/layers/isolant/thicknessM`. Supprimer un autre
assemblage ne déplace plus la cible sur son voisin ; un chemin numérique
enregistré auparavant continue d'être lu, et s'il ne désigne plus rien il est
signalé au lieu d'être appliqué ailleurs. Une référence se choisit dans une
liste des objets que le projet déclare, et un scénario qui rendrait une
référence invalide est refusé — sans qu'on lui reproche ce que le projet cassait
déjà.

**Ce que l'application ne sait pas éditer est conservé.** Un niveau contenant un
escalier ne se duplique pas et ne se supprime pas silencieusement : l'opération
est refusée en nommant ce qui la bloque. Et parce que l'altitude d'un pan de
toiture est absolue dans le projet, elle est translatée quand le niveau est
copié plus haut ou déplacé.

### Ce que ce lot n'a pas traité

- réseaux : propriétés physiques éditables, gabarits de systèmes, inspecteur de
  tronçon (BETA-06) ;
- moteur électrique présent mais absent du pipeline (BETA-07) ;
- édition géométrique des murs, ouvertures, dalles et toitures
  (BETA-13 à BETA-15) ;
- climat portable avec le projet et autosave IndexedDB (BETA-10, BETA-11) ;
- Firefox et WebKit en intégration continue (BETA-16) ;
- publication GitHub Pages vérifiée et migrations figées (BETA-17, BETA-18).

## Réseaux physiques et module électrique — lots B et C

| Porte   | Constat                                                            | État    |
| ------- | ------------------------------------------------------------------ | ------- |
| BETA-06 | les réseaux ne portaient aucune propriété physique éditable        | corrigé |
| BETA-07 | le moteur électrique existait sans être branché au pipeline projet | corrigé |

**Un nœud et un tronçon disent ce qu'ils sont.** `NetworkNode` possède désormais
un enregistrement `properties` et un `equipmentId`, tous deux déclarés au schéma
JSON ; les tronçons avaient déjà le leur. Un catalogue par discipline dit ce que
chaque objet peut porter — débit, pression, unités de vidange, puissance active,
facteur de puissance d'un côté ; diamètre, matériau, rugosité, pertes
singulières, pente, section et âme des conducteurs de l'autre — avec libellé,
unité et bornes. Le panneau Réseaux ouvre l'inspecteur correspondant sur un nœud
ou un tronçon, en saisie différée : un champ vidé retire la propriété, une
valeur hors bornes est refusée en le disant, et rien n'est supposé. Le type de
système se choisit enfin dans une liste de gabarits par discipline au lieu d'être
épelé.

Les adaptateurs lisent la propriété dans l'enregistrement puis, à défaut, sur le
nœud lui-même : un fichier écrit avant cet enregistrement continue de calculer
ce qu'il calculait. La maison de référence a été migrée vers la forme
canonique ; le fixture d'intégration garde l'ancienne, pour que le chemin de
compatibilité reste couvert par les tests.

**Le dix-septième moteur est branché.** Aucun nouveau moteur n'a été écrit :
`modules/electrical` existait, il manquait l'adaptateur projet. Les circuits sont
lus depuis le réseau électrique — un nœud CIRCUIT, le tableau qui l'alimente, les
charges qu'il atteint et les câbles qui y mènent, trouvés en parcourant le
graphe. La puissance d'une charge vient du nœud ou de l'équipement qu'il
représente ; la résistance linéique vient de la section et de la résistivité du
cuivre ou de l'aluminium, déclarées comme constantes de méthode avec leur source.
Une tension, un nombre de phases, une puissance ou une section que personne n'a
énoncés sont signalés comme entrées manquantes, et un circuit ramifié est
rapporté comme tel par le moteur plutôt que totalisé comme s'il n'était qu'une
seule antenne.

Dans la même veine que la porte BETA-02, trois choix silencieux ont été retirés :
le premier ballon d'eau chaude, la première cuve de pluie et le premier pan de
toiture ne sont plus pris par défaut quand le projet en déclare plusieurs —
l'ambiguïté est signalée, avec les candidats nommés.

### Ce que ces lots n'ont pas traité

- édition géométrique des murs, ouvertures, dalles et toitures
  (BETA-13 à BETA-15) ;
- climat portable avec le projet et autosave IndexedDB (BETA-10, BETA-11) ;
- Firefox et WebKit en intégration continue (BETA-16) ;
- publication GitHub Pages vérifiée et migrations figées (BETA-17, BETA-18) ;
- superpositions graphiques par discipline, qui attendaient ces données ;
- champ de saisie différée généralisé aux panneaux historiques.

## Portabilité et sauvegarde locale — lot E

| Porte   | Constat                                              | État    |
| ------- | ---------------------------------------------------- | ------- |
| BETA-10 | le climat vivait dans la session, pas dans le projet | corrigé |
| BETA-11 | la sauvegarde de secours tenait dans `localStorage`  | corrigé |

**Le projet voyage avec son climat.** « Sauvegarder » écrit désormais un
`.houseproj` : une archive ZIP contenant `manifest.json`, `project.json` et un
`climate/<jeu>.json` par jeu de données associé. Le format ZIP est écrit et relu
par le dépôt lui-même — en-têtes locaux, répertoire central, `deflate-raw` via
l'API de compression du navigateur quand elle existe, stockage simple sinon —
sans dépendance ajoutée, et avec des horodatages fixes pour que le même contenu
produise les mêmes octets. Chaque entrée est vérifiée contre son CRC à la
lecture. Le JSON reste exporté à part, pour l'inspection et l'outillage, et
l'ouverture accepte les deux : les octets disent lequel c'est.

**La sauvegarde de secours a la taille des projets admis.** Les bornes d'import
acceptent vingt mille murs et cinquante mille nœuds de réseau ; rien de tel ne
tient dans `localStorage`. L'instantané va dans IndexedDB, `localStorage` restant
le recours d'un navigateur sans base. Deux instantanés sont conservés — le
courant et celui qu'il a remplacé — et la relecture bascule sur le précédent
quand le dernier est illisible, au lieu de ne rien retrouver.

**Le message de crash ne promet plus ce qu'il ignore.** Il affichait « une
sauvegarde locale est conservée » même lorsqu'aucune n'avait encore été écrite.
Il indique désormais l'heure de la dernière sauvegarde locale de la session,
ou dit qu'aucune n'a pu être confirmée.

### Ce que ce lot n'a pas traité

- édition géométrique des murs, ouvertures, dalles et toitures
  (BETA-13 à BETA-15) ;
- Firefox et WebKit en intégration continue (BETA-16) ;
- publication GitHub Pages vérifiée et migrations figées (BETA-17, BETA-18).

## Édition géométrique — lot D

| Porte   | Constat                                                        | État    |
| ------- | -------------------------------------------------------------- | ------- |
| BETA-13 | un mur se dessinait et se supprimait, mais ne se reprenait pas | corrigé |
| BETA-14 | une ouverture ne se déplaçait qu'en tapant un nombre           | corrigé |
| BETA-15 | une dalle ou une toiture se recréait au lieu de se corriger    | corrigé |

**Un objet sélectionné montre ses poignées.** Elles sont dérivées de la
sélection, jamais stockées : le modèle porte la géométrie, les poignées n'en
sont qu'une lecture. Un mur en expose ses deux extrémités et une poignée pour le
déplacer entier ; une ouverture, une poignée qui glisse sur son mur ; une dalle
ou un pan de toiture, une poignée par sommet et une au milieu de chaque côté,
qui en insère un — alt-clic sur un sommet le retire. Le tracé se cale sur les
accroches existantes, si bien qu'un coin déposé sur un mur y atterrit
exactement.

**Une extrémité déplacée reste vérifiée.** Le mur garde son identité, son
assemblage et ses ouvertures ; ce que le déplacement ne peut pas faire, c'est
laisser une ouverture hors du mur qui l'héberge, et un raccourcissement qui le
ferait est refusé plutôt que de rogner la fenêtre en silence. La longueur et
l'angle se saisissent aussi comme des nombres dans l'inspecteur, en passant par
la même commande et donc la même validation.

**Scinder un mur donne deux murs.** Chaque morceau garde l'assemblage, la
hauteur et le rôle de celui dont il vient, et chaque ouverture suit le morceau
qui la contient vraiment, son décalage recalculé depuis le nouveau départ. Une
coupe qui tomberait dans une ouverture est refusée : une demi-fenêtre n'est pas
une fenêtre, et choisir de quel côté la garder n'est pas à l'application de le
décider. L'annulation recolle les deux morceaux, ouvertures comprises.

**Un contour reste une surface.** Un polygone qui se croiserait ou s'effondrerait
sur une ligne est refusé pendant que le geste est encore dans la main de
l'utilisateur, et il ne reste jamais moins de trois sommets.

### Ce que ce lot n'a pas traité

- copier-coller, joindre deux murs, trim et extend ;
- édition tactile complète sur téléphone ;
- Firefox et WebKit en intégration continue (BETA-16) ;
- publication GitHub Pages vérifiée et migrations figées (BETA-17, BETA-18).

## Sécurité des données — lot A du sixième audit

| Point                  | Constat                                                                        | État    |
| ---------------------- | ------------------------------------------------------------------------------ | ------- |
| Course d'autosave      | une écriture ancienne pouvait faire dire « sauvegardé » d'une révision récente | corrigé |
| Climat non sauvegardé  | l'instantané portait le projet sans les jeux climatiques de la session         | corrigé |
| Migration localStorage | un instantané écrit par la version précédente n'était plus proposé             | corrigé |
| Repli IndexedDB        | le stockage était choisi sur l'existence de l'API, pas sur ce qu'elle accepte  | corrigé |
| Course d'export        | le fichier pouvait porter une révision plus ancienne que l'état affiché        | corrigé |
| Identité du projet     | un résultat de calcul pouvait passer pour frais après changement de projet     | corrigé |

**Une écriture ne parle que de ce qu'elle a écrit.** Les instantanés passent par
une file : une seule écriture à la fois, et une demande arrivée pendant une
écriture remplace celle qui attendait — les états intermédiaires n'ont pas de
valeur, seul le dernier en a. La file rend la révision réellement posée sur le
disque, et l'application ne se dit « sauvegardé localement » que si c'est celle
qui est à l'écran.

**L'instantané porte l'atelier, pas seulement le projet.** Les jeux climatiques
y sont sérialisés et reviennent avec la restauration ; un instantané écrit avant
ce champ se relit sans, et n'en réclame pas.

**Le stockage se choisit sur ce qu'il accepte.** IndexedDB existe ne veut pas
dire qu'IndexedDB écrit : navigation privée, quota épuisé, base corrompue
échouent à la première transaction. Le magasin bascule alors sur `localStorage`,
et l'échec des deux est signalé au lieu d'être avalé. Un instantané laissé par
la version précédente est déplacé vers le nouveau magasin — copié, relu pour
vérification, et seulement ensuite retiré de l'ancien.

**Un export dit quelle révision il contient.** La compression est asynchrone ;
si le projet a bougé pendant, le fichier écrit reste valide mais l'état
redevient « modifié » et le message nomme la révision exportée.

### Ce que ce lot n'a pas traité

- cohérence des réseaux : racine par discipline, gaine rectangulaire, cuivre
  implicite, pertes singulières supposées nulles, `equipmentId` canonique,
  charges fixes, altitude des nœuds ;
- durcissement du conteneur `.houseproj` et limites d'archive ;
- Firefox, WebKit, Pages, migrations et version unique.

## Cohérence des réseaux — lot B du sixième audit

| Point                    | Constat                                                                               | État    |
| ------------------------ | ------------------------------------------------------------------------------------- | ------- |
| Racine de réseau         | toute discipline devait porter un nœud SOURCE, que ses propres gabarits ne créent pas | corrigé |
| Gaine rectangulaire      | l'option existait sans largeur ni hauteur, et le calcul réclamait un diamètre         | corrigé |
| Cuivre implicite         | un câble sans matériau était calculé en cuivre                                        | corrigé |
| Pertes singulières       | un tronçon sans donnée était calculé sans raccord, sans le dire                       | corrigé |
| Liaison luminaire        | la référence d'équipement restait un texte libre dans les propriétés                  | corrigé |
| Charges fixes            | ni appareil fixe ni borne de recharge ne pouvaient être posés                         | corrigé |
| Altitude des nœuds       | déplacer un niveau laissait ses nœuds de réseau à l'ancienne hauteur                  | corrigé |
| « Corriger » d'un réseau | un diamètre manquant renvoyait au plan, incapable de le saisir                        | corrigé |

**Chaque discipline a sa racine.** Une eau usée ne commence pas à une source :
elle finit à un exutoire. Un réseau de ventilation est ancré par son groupe,
l'électricité par le tableau qui l'alimente. La validation nomme désormais les
ancrages qu'elle attendait, au lieu de signaler un défaut sur un réseau que les
gabarits de l'éditeur venaient de produire.

**Une gaine rectangulaire se décrit par ses deux côtés.** L'inspecteur propose
largeur et hauteur, l'adaptateur réclame ce que la forme choisie exige — et non
un diamètre qu'elle ne peut pas avoir — et le moteur calcule le diamètre
hydraulique lui-même. Changer de forme retire les dimensions que la nouvelle ne
porte pas ; une contradiction saisie malgré tout est refusée en le disant.

**Deux hypothèses silencieuses en moins.** Un câble sans matériau de conducteur
est signalé comme donnée manquante : le cuivre est le cas courant, ce qui est
précisément pourquoi le supposer ne se verrait pas. Un tronçon sans perte
singulière est toujours calculé sans raccord, mais l'hypothèse est enregistrée
dans les résultats au lieu de disparaître dans le nombre.

**Ce qu'un nœud représente est une référence, pas un nom.** `equipmentId` est
lu en premier par l'éclairage, la propriété texte historique restant lue pour
les fichiers antérieurs. Les gabarits électriques offrent enfin l'appareil fixe
et la borne de recharge, sans lesquels une installation réelle ne pouvait pas
être dessinée.

**Un nœud sait sur quel niveau il est posé.** Déplacer ce niveau le déplace ;
un nœud écrit avant ce champ est repéré par la pièce qu'il dessert, seule chose
qu'un fichier ancien dise de l'endroit où il se trouve. Et un constat qui nomme
un tronçon ouvre ce tronçon, dans l'espace Réseaux, propriétés ouvertes.

### Ce que ce lot n'a pas traité

- durcissement du conteneur `.houseproj` et limites d'archive (lot C) ;
- références de zones, d'annotations et d'objets hôtes (lot D) ;
- Firefox, WebKit, Pages, migrations et version unique (lot F).

## Durcissement du conteneur — lot C du sixième audit

| Point                      | Constat                                                                    | État    |
| -------------------------- | -------------------------------------------------------------------------- | ------- |
| Manifeste permissif        | un jeu climatique annoncé et absent était simplement ignoré                | corrigé |
| Version du conteneur       | aucune vérification : une archive plus récente s'ouvrait à moitié          | corrigé |
| Jeux climatiques invalides | l'import filtrait en silence ce qui ne respectait pas le contrat           | corrigé |
| Profil référencé absent    | le projet pouvait nommer un climat que l'archive ne transportait pas       | corrigé |
| Archive sans limites       | taille, nombre d'entrées, taille décompressée et taux n'étaient pas bornés | corrigé |
| Méthodes de compression    | toute méthode non nulle était traitée comme du deflate                     | corrigé |

**Ce que le manifeste annonce doit être là.** Une entrée déclarée et manquante,
un JSON illisible, un jeu de données qui ne satisfait pas le contrat climatique,
ou un projet nommant un profil que l'archive ne porte pas : chacun rend le
conteneur invalide, avec le fichier nommé. Un « chargé et validé » sur un projet
dont la météo a disparu en route est exactement ce qu'il fallait rendre
impossible.

**Une archive a des bornes.** 128 Mo d'archive, 128 entrées, 32 Mo par entrée
décompressée, 256 Mo au total et un facteur d'expansion plafonné : tout cela
s'exécute dans le navigateur du lecteur, où un fichier démesuré ne menace aucun
serveur — il fige l'onglet. L'interface regarde la taille du fichier avant d'en
lire les octets, et le lecteur refuse les méthodes de compression autres que
« stocké » et « deflate » au lieu de traiter tout le reste comme du deflate.

### Ce que ce lot n'a pas traité

- Firefox, WebKit, Pages, migrations et version unique (lot F).

## Intégrité du projet — lot D du sixième audit

| Point                     | Constat                                                              | État    |
| ------------------------- | -------------------------------------------------------------------- | ------- |
| `spaceIds` des zones      | une zone pouvait grouper une pièce que le projet ne contenait plus   | corrigé |
| `wallId` des cotes        | une cote pouvait mesurer un mur absent, ou d'un autre niveau         | corrigé |
| `hostObjectId` des nœuds  | un nœud pouvait être fixé à un objet inexistant                      | corrigé |
| `levelId` des nœuds       | l'altitude d'un nœud pouvait renvoyer à un niveau supprimé           | corrigé |
| Identifiants dupliqués    | seules quelques familles étaient vérifiées, et jamais entre familles | corrigé |
| Unicité : quelle portée ? | le contrat n'était écrit nulle part                                  | tranché |

**Une référence qui ne mène à rien est refusée à l'import.** Seize familles
d'objets sont recensées à la lecture d'un fichier ; chaque référence est
confrontée à ce recensement. Une zone qui nomme une pièce disparue la protège
d'une suppression qu'elle ne pourra jamais lever ; une cote dont le mur a été
effacé affiche une longueur que le modèle ne sait plus justifier ; un nœud fixé
à rien reste sur place quand l'objet qui le portait bouge. Chacun de ces cas
nomme désormais le chemin exact dans le fichier.

**L'unicité est celle du projet entier, et c'est écrit.** La question était
ouverte : un identifiant unique par collection, ou unique partout ? La sélection
sur le plan, les superpositions, les cotes et les chemins de scénario désignent
un objet par son seul identifiant — deux objets qui le partagent rendent un clic
ambigu et un scénario applicable à l'un comme à l'autre. Le contrat retenu est
donc l'unicité dans tout le projet ; il figure dans `02_DOMAIN_MODEL.md` avec la
liste des familles concernées, et l'import refuse une collision, y compris entre
deux familles différentes.

## Ergonomie de la bêta — lot E du sixième audit

| Point                          | Constat                                                              | État    |
| ------------------------------ | -------------------------------------------------------------------- | ------- |
| Saisie caractère par caractère | matériaux, assemblages, niveaux et pièces validaient à chaque touche | corrigé |
| Renommage de niveau            | impossible depuis l'interface                                        | corrigé |
| Zones                          | le modèle les portait, rien ne permettait d'en créer                 | corrigé |
| Provenance d'une propriété     | affichée, jamais saisissable                                         | corrigé |
| `battery.offGrid`              | saisi comme « 0 ou 1 »                                               | corrigé |
| Bornes hautes des équipements  | un rendement de 1,4 était accepté                                    | corrigé |
| Navigation                     | onze espaces de travail en liste plate                               | corrigé |
| Création d'un projet           | apparaissait sans nom, sans lieu et avec un seul niveau              | corrigé |

**Une frappe n'est pas une décision.** `DraftField` couvre maintenant les
panneaux matériaux, assemblages, niveaux et pièces : la commande part au blur ou
sur Entrée, Échap remet ce que le modèle porte. L'historique d'annulation cesse
de se remplir de lettres et les calculs de s'invalider à chaque caractère.

**Les zones se créent, se nomment, se peuplent et se suppriment.** Une zone
groupe des pièces pour un domaine — thermique, ventilation, acoustique — et le
panneau « Niveaux et pièces » la traite comme un objet du projet : commandes
inversibles, appartenance par case à cocher, refus d'un type inconnu.

**Une valeur dit d'où elle vient.** Chaque propriété de matériau porte sa
provenance et sa référence, saisissables. Écraser un nombre tiré d'une norme
bascule la provenance en « saisie » plutôt que de laisser la référence décrire
une valeur qui n'est plus là ; une propriété effacée emporte sa provenance ; un
matériau qui n'en déclarait aucune n'en reçoit pas d'office.

**Ce qui est physiquement impossible est refusé, avec la borne dite.** Les
rendements et les états de charge sont bornés à 1, et quatre invariants croisés
sont vérifiés — état de charge minimal sous le maximal, état initial dans ces
bornes, volume initial sous le volume nominal, pertes à l'arrêt sous la
puissance nominale. Une règle ne parle que si les deux valeurs qu'elle compare
sont présentes : une donnée inconnue reste inconnue, elle ne devient pas une
violation. Une saisie n'est tenue pour responsable que de la règle qu'elle
casse, jamais d'une incohérence qui existait déjà.

**Un projet commence par ce qu'on ne peut pas deviner.** L'assistant demande le
nom, l'auteur, le pays, le nombre de niveaux hors sol, la hauteur d'étage, le
sous-sol, l'orientation du nord et, s'ils sont connus, la latitude, la longitude
et l'altitude. Ce qui est laissé vide reste vide : une latitude sans longitude
ne situe rien et n'est pas écrite, et les modules qui ont besoin d'un lieu le
signaleront plutôt que d'en supposer un. Les onze espaces de travail sont
regroupés en cinq familles — projet, conception, bibliothèques, technique,
résultats — pour dire dans quel ordre un projet se décrit.

## Publication de la bêta — lot F du sixième audit

| Point                 | Constat                                                       | État    |
| --------------------- | ------------------------------------------------------------- | ------- |
| Un seul moteur testé  | l'intégration continue ne connaissait que Chromium            | corrigé |
| Pages jamais vérifié  | un déploiement réussi pouvait servir une page blanche         | corrigé |
| Version applicative   | écrite en dur dans le code, à côté de celle de `package.json` | corrigé |
| Migration silencieuse | un fichier ancien était mis à jour sans que rien ne le dise   | corrigé |
| Taille du chargement  | 861 kio d'un bloc, sans budget                                | corrigé |
| Accessibilité         | aucune vérification automatisée                               | corrigé |
| Régression du dessin  | rien ne signalait un calque qui cesse d'être dessiné          | corrigé |
| Version publiable     | le dépôt était encore en 0.1.0, sans journal des versions     | corrigé |

**Trois moteurs, et ce qui les distingue.** Chromium exécute toute la suite ;
Firefox et WebKit exécutent le parcours qui dépend réellement du moteur —
géométrie du pointeur sur le canevas, IndexedDB, téléchargement, champ fichier,
compression du conteneur. Le reste est le même code partout, et les tests
unitaires le couvrent déjà.

**Un déploiement réussi n'est pas une page qui s'ouvre.** Un chemin de base
erroné publie un `index.html` dont le script répond 404 : la page reste blanche
derrière une pipeline verte. Après publication, la page est chargée, ses
fichiers sont demandés, et leur type est vérifié — un hébergeur qui répond
`index.html` à tout renvoie 200 pour un script absent.

**La version vient d'un seul endroit.** Le `package.json` du dépôt, injecté à
la construction et aux tests. Une constante recopiée dans le code aurait été
une seconde source, et le jour où les deux divergent, un fichier de projet
porte une version qui n'a jamais existé. Un test compare les deux.

**Une mise à jour de format se dit.** Un projet écrit dans un schéma antérieur
est migré à l'ouverture, y compris à l'intérieur d'un conteneur ; l'application
nomme la version d'origine, celle d'arrivée, et prévient que c'est cette
dernière qui sera enregistrée.

**Ce que la première visite télécharge est décidé.** Les dix espaces de travail
et les dix-sept modules de calcul arrivent à la demande : le chargement initial
passe de 861 kio à 151 kio compressés, pour un budget de 200 kio vérifié en
intégration continue. Dépasser le budget est permis ; le dépasser sans s'en
apercevoir ne l'est pas.

**Ce qu'une machine peut vérifier de l'accessibilité l'est.** axe-core passe sur
les onze espaces de travail, aux règles WCAG 2.1 AA, et un manquement est un
échec. Il a immédiatement trouvé deux textes illisibles, dont l'étiquette d'état
de sauvegarde qui perdait sa couleur au profit du gris du texte voisin.

**Le dessin a une référence.** Le plan de la maison de démonstration est comparé
à un fichier SVG de référence : un calque qui cesse d'être dessiné, une hachure
qui change, un cadrage qui bouge se lisent comme une différence de texte. Une
comparaison pixel par pixel sur trois moteurs répondrait à une autre question,
et différemment sur chaque machine ; elle reste hors bêta.

### Ce que ce lot n'a pas traité

- feuilles et export PDF ; orchestrateur de calcul persistant et invalidation
  sélective ; régression visuelle pixel par pixel ; réglages encore invisibles
  alors que les moteurs les lisent.

## Intégrité de la bêta — lot 1 du septième audit

Un septième audit a repris le dépôt après la publication de la
`0.2.0-beta.1`. Il n'a rouvert aucune porte fonctionnelle : les moteurs, les
réseaux, les scénarios, l'éditeur et les tests navigateur sont là. Il a relevé
quatre cas d'intégrité, tous du même genre — une vérification qui répond juste
à une question trop étroite.

| Point                    | Constat                                                                     | État    |
| ------------------------ | --------------------------------------------------------------------------- | ------- |
| Course de révision       | l'état « sauvegardé » pouvait décrire un instantané en retard d'une édition | corrigé |
| Suppression d'instantané | une écriture engagée pouvait le faire réapparaître après la suppression     | corrigé |
| Climat désigné, absent   | un conteneur sans aucun climat échappait à la vérification                  | corrigé |
| Références d'un nœud     | vérifiées une à une, jamais ensemble                                        | corrigé |

**Un instantané ne peut plus parler pour un autre état.** Un instantané est
identifié par le projet et sa révision, et l'interface n'annonce « sauvegardé
localement » que si cette identité est à la fois celle qui a atteint le
stockage et celle du projet à l'écran. La séquence en cause était discrète :
l'écriture de la révision 50 commence, l'utilisateur édite, la révision 51
programme son minuteur, l'écriture de 50 se termine, l'ancienne comparaison
reconnaît sa propre révision et sort l'atelier de l'état « modifié » — ce qui
détruisait l'effet qui devait écrire 51. Le disque restait en retard d'une
édition sous une étiquette rassurante.

**Supprimer l'instantané le supprime vraiment.** La suppression passe par la
file d'écriture au lieu de s'exécuter à côté : une écriture déjà engagée se
termine d'abord, tout ce qui attendait est abandonné, et un instantané confié
pendant la suppression est refusé — il appartient à l'état que l'utilisateur
vient de jeter. Sans cela, « ignorer et supprimer » pouvait rendre la
sauvegarde une seconde plus tard.

**Un conteneur qui désigne un climat le transporte.** La vérification ne
s'appliquait qu'aux archives portant au moins un jeu de données : un projet
annonçant Brest et n'emportant rien passait, ce qui est précisément la
situation que le format existe pour empêcher. Elle s'applique maintenant dans
tous les cas, et aussi à l'écriture — mieux vaut un export refusé qui dit quel
jeu charger qu'un fichier découvert inutilisable sur une autre machine. Un
manifeste dont le champ `climate` n'est pas une liste de noms est refusé au
lieu d'être lu comme « pas de climat ».

**Trois références réelles peuvent décrire un lieu qui ne l'est pas.** Un nœud
déclaré au rez-de-chaussée, desservant une chambre à l'étage et fixé à un mur
d'un troisième niveau nomme trois objets existants et aucun endroit existant.
La validation structurelle compare désormais les niveaux de la pièce et de
l'objet support à celui du nœud, et entre eux quand le nœud ne déclare pas de
niveau. Les commandes d'ajout et de modification refusent la même chose, pour
que l'éditeur n'écrive jamais un projet que le lecteur rejette ; un équipement,
qui appartient au projet et non à un niveau, ne dit rien et ne prouve rien.

**Le déploiement échouait avant même de publier.** Le workflow Pages est
correct, mais chacune de ses exécutions s'arrêtait à `configure-pages` sur un
« Get Pages site failed… Not Found » : GitHub Pages n'est pas activé sur le
dépôt, et une page jamais publiée ne pouvait pas être vérifiée. Le workflow
demande maintenant l'activation lui-même. Si le réglage de l'organisation
l'interdit, il reste à l'activer à la main dans Réglages → Pages, source
« GitHub Actions » — c'est un réglage du dépôt, pas du code.

### Ce que ce lot n'a pas traité

- feuilles et export PDF ; projection des résultats des réseaux, de la
  ventilation et de l'électricité sur le plan ; orchestrateur de calcul
  persistant ; protection de `main`, qui est un réglage du dépôt.

## Fondations de l'éditeur — UI-01 et UI-03 du huitième audit

Un audit consacré à l'interface a constaté que le moteur du projet était
désormais plus mûr que l'éditeur, et que la structure de celui-ci empêchait de
le faire grandir : cinq outils inscrits dans six endroits différents, trois
chaînes de conditions parallèles pour décrire, éditer et manipuler un objet.
Sa première recommandation était de rendre cette structure extensible **avant**
d'ajouter les dizaines de familles d'objets qui manquent.

### UI-01 — registres

- Un outil se déclare une fois : famille, libellé, raccourci, nombre de clics
  attendus, respect des axes du bâtiment, commande produite. Le type des outils
  est dérivé du registre, donc un outil non déclaré ne peut pas être désigné.
- La barre d'outils lit les familles au lieu de tenir sa propre liste ; un
  nouvel outil apparaît auprès de ceux auxquels il appartient.
- La poignée de clics de l'application ne connaît plus les outils un par un :
  elle porte les points à l'outil actif, qui dit ce qu'ils veulent dire.
- Une famille d'objets déclare au même endroit ce que l'inspecteur montre, ce
  que le panneau des propriétés modifie et les poignées que le plan dessine. Ce
  qu'elle ne sait pas dire, elle le laisse indéfini et la famille suivante
  répond.

### UI-04 — premières transformations

- Scinder est un outil et non plus un bouton : le mur est coupé là où
  l'utilisateur clique, au lieu de l'être toujours en son milieu. Le clic est
  reporté à l'outil avec ce qu'il a touché, la désignation étant faite par le
  canevas, seul à savoir ce qui est assez proche à ce zoom sur cet écran.
- Déplacer une sélection : appuyer sur un objet déjà sélectionné le porte, avec
  un fantôme montrant où l'ensemble atterrirait avant qu'on le lâche. Murs,
  dalles, pans de toiture et nœuds de réseau voyagent ensemble en une seule
  entrée d'historique.
- Ce qui ne se déplace pas seul est refusé en le disant : une ouverture glisse
  le long de son mur, une pièce est l'espace que ses murs enferment.

- Dupliquer une sélection (`Ctrl+D`) copie murs, ouvertures, dalles et pans de
  toiture un peu à côté, puis sélectionne les copies : ce sont elles que
  l'utilisateur travaille ensuite. Une ouverture ne se duplique qu'avec le mur
  qui la porte, faute de quoi sa copie se poserait exactement sur l'originale.

- Pivoter d'un quart de tour et retourner de gauche à droite, autour du centre
  de la sélection. Un mur est remanié en une seule étape : déplacer ses points
  l'un après l'autre passerait par des longueurs que le mur n'a jamais, et une
  ouverture qui tient avant et après serait refusée entre les deux. Une
  commande de domaine remplace donc le tracé entier, ouvertures vérifiées d'un
  coup.

- Outils Pivoter et Miroir : le premier prend un centre, la direction actuelle
  et la direction voulue — trois clics, aucun nombre à taper ; le second prend
  les deux points d'un axe. Les boutons « Pivoter 90° » et « Miroir
  gauche-droite » restent pour les cas où ni le centre ni l'axe ne comptent.
- Copier et coller (`Ctrl+C`, `Ctrl+V`) : ce sont les objets qui sont retenus,
  pas leurs identifiants, si bien qu'un copié-collé survit à la suppression de
  l'original et se pose sur un autre niveau que celui d'où il vient.
- Décaler : un mur parallèle, du côté et à la distance montrés par le clic
  plutôt qu'un nombre à inventer.
- Joindre et Ajuster : deux murs amenés à l'intersection de leurs axes, ou un
  seul amené jusqu'à l'autre — allonger et raccourcir sont le même geste, et
  deux murs parallèles sont refusés en le disant.
- Aligner à gauche, à droite, en haut, en bas : chaque objet parcourt la
  distance qui amène son propre bord sur le plus extérieur, sans être remanié.

- Cotes temporaires : la longueur d'un mur, la position et la largeur d'une
  ouverture s'écrivent sur le dessin, là où elles se mesurent, et se modifient
  en tapant par-dessus. Ce sont les modifications de l'inspecteur elles-mêmes,
  pas une seconde façon d'écrire la même chose : commande, validation et place
  dans l'historique sont identiques.

### UI-05 — saisie dynamique

La longueur et l'angle du tracé se saisissaient en haut de la fenêtre alors que
l'utilisateur regarde l'extrémité de son mur. Les deux champs suivent désormais
le point en cours de placement : taper une longueur, Tab pour l'angle, Entrée
pour poser le point, Échap pour abandonner. Un champ laissé libre mesure ce qui
est dessiné ; un champ rempli verrouille sa valeur et le tracé suit ce qui a été
tapé plutôt que le pointeur.

L'unité est celle à laquelle la personne pense : `4200`, `4.2 m`, `420 cm` et
`4,2m` désignent le même mur. Ce qui ne se lit pas est refusé plutôt que deviné.

Une longueur tapée sans avoir bougé le pointeur pose maintenant le point : la
contrainte refusait de dessiner quand le pointeur n'avait pas quitté le premier
point, ce qui rendait le clavier inutilisable.

### UI-02 — arbre du projet

Les espaces de travail disent ce que l'on fait ; l'arbre dit ce qu'il y a dans
le bâtiment. Site, niveaux, familles d'objets du niveau dessiné, réseaux et
leurs nœuds : un clic sélectionne, un double-clic cadre. Seul le niveau dessiné
est déplié — un objet d'un autre niveau ne peut pas être montré sans changer le
plan d'abord — et au-delà de quarante objets par famille, l'arbre renvoie à la
palette plutôt que d'aligner mille murs.

### UI-15 — palette de commandes

`Ctrl+K` affichait la liste des raccourcis dans la barre de message. C'est
maintenant un champ unique qui cherche les outils, les espaces de travail, les
niveaux, les commandes du clavier et les objets du niveau dessiné, insensible
aux accents et à la casse, et qui classe d'abord ce qui commence par ce qui est
tapé. Une commande n'a plus qu'une définition, appelée aussi bien par le clavier
que par la palette.

### UI-02 — poste de travail

- L'espace de travail s'arrêtait à 1480 pixels : sur un écran large, la moitié
  de la fenêtre montrait le fond au lieu du plan. Ce qui limite le dessin est
  désormais la largeur des panneaux, et cette largeur appartient à
  l'utilisateur.
- Les panneaux se redimensionnent en tirant leur bord — un vrai séparateur, que
  les flèches du clavier déplacent aussi — et se masquent depuis l'en-tête. Les
  deux décisions sont gardées dans le navigateur et retrouvées à la session
  suivante ; elles ne voyagent jamais avec le projet.
- Une barre d'état longe le bas du dessin : niveau, position du curseur,
  accroches en service, pas de grille, pas angulaire, échelle et taille de la
  sélection. Ces réglages occupaient la barre d'outils, qui doit rester la
  place des outils.

### UI-03 — sélection et modification multiple

- Bande de sélection : vers la droite, une fenêtre qui ne prend que les objets
  entièrement compris ; vers la gauche, une capture qui prend tout ce qu'elle
  touche. La barre d'état dit laquelle est en cours.
- Un appui décide de son sens au relâchement : sur place c'est un clic, traîné
  c'est une bande. Ctrl ou Cmd ajoute à la sélection.
- Tolérance de désignation exprimée en pixels — huit au pointeur, dix-huit au
  doigt — puis convertie par la caméra, au lieu de 120 mm quel que soit le zoom.
- Échap défait une chose à la fois, la plus récente d'abord : action en cours,
  puis outil actif, puis sélection.
- Modification multiple : les propriétés communes à toute la sélection sont
  offertes une fois, avec la valeur partagée quand elle existe et « valeurs
  différentes » sinon — jamais la valeur du premier objet présentée comme celle
  de tous. Appliquer écrit une seule entrée d'historique : une décision, une
  annulation.

Restent ouverts, dans l'ordre recommandé par l'audit : le poste de travail
redimensionnable et l'arbre du projet (UI-02), les transformations CAO —
déplacer, copier, pivoter, miroir, décaler, scinder en un point choisi, joindre
(UI-04), la saisie dynamique près du curseur (UI-05), puis l'architecture
complète, la toiture, l'escalier, les composants placés et l'édition graphique
des réseaux.

## Stabilisation de l'éditeur — lot A du neuvième audit

Un audit consacré aux nouvelles primitives CAO a relevé neuf défauts nés de la
passe précédente. Les corriger avant d'ajouter des familles d'objets était sa
recommandation ; c'est ce lot.

- **Une seule lecture d'un point.** Le clic, l'aperçu et la valeur tapée
  interprétaient le même geste de trois façons : le clic n'appliquait les
  contraintes qu'aux outils qui les demandent, l'aperçu les appliquait à tous.
  Un fantôme qui n'est pas ce qui se pose est un dessin auquel on ne peut pas
  se fier ; les trois passent désormais par la même fonction.
- **Saisie dynamique selon le contrat de l'outil.** Un outil déclare s'il lit
  une longueur et un angle. Pivoter demande trois clics et aucun nombre : lui
  offrir des champs invitait à taper dans quelque chose que personne ne lit. Un
  test refuse qu'un outil accepte une valeur qu'il ignorerait ensuite.
- **Déplacement sans retard d'une image.** Le glissement lisait l'accrochage du
  rendu précédent et le lâcher relisait l'état ; les deux prennent maintenant
  l'accroche de l'événement en cours, et le point final est recalculé au
  relâchement.
- **Azimut de toiture transformé.** Un pan de toiture ne se contente pas d'une
  empreinte : il regarde quelque part, et c'est cette direction que lisent les
  calculs solaires. Faire pivoter le bâtiment sans faire pivoter l'azimut
  laissait un toit dessiné à l'est et calculé au sud.
- **Coller garde un sens vertical.** Le presse-papiers retient le niveau
  d'origine et son altitude ; un pan de toiture collé un étage plus haut monte
  d'autant, et un mur monté « jusqu'au niveau » vise le niveau qui veut dire la
  même chose au-dessus de celui où il atterrit — ou reprend une hauteur
  explicite lorsqu'aucun niveau n'est assez haut, plutôt qu'une référence que
  personne ne peut résoudre.
- **Suppression universelle.** Sélectionner, inspecter, modifier et supprimer
  sont quatre questions sur le même objet ; la quatrième n'était répondue que
  pour trois familles sur sept. Chaque famille dit maintenant comment elle se
  supprime, à côté de la façon dont elle se dessine et s'édite — et le domaine
  reste libre de refuser un mur qui porte encore une ouverture.
- **Modification multiple sémantique.** Un mur et une dalle ont tous deux un
  « rôle », et ce n'est pas le même : l'un accepte EXTÉRIEUR, l'autre PLANCHER.
  Les propriétés se comparent désormais par leur sens et par les choix qu'elles
  offrent, pas par leur nom ni par le nombre d'options.
- **Fantôme et résultat indissociables.** Le déplacement d'un contour à trous
  passe par la fonction même qu'emploie la commande : une trémie oubliée par
  l'aperçu et emportée par la modification ne peut plus arriver.
- **npm épinglé en intégration continue.** Le dépôt annonce `npm@11.4.2` ;
  sans Corepack, le runner employait l'npm qu'il embarque et cette promesse ne
  voulait rien dire.

Le déploiement Pages du `main` de la PR #20 a de nouveau échoué, et la cause
est maintenant nommée dans `BETA_READINESS.md` : l'application se construit,
puis `configure-pages` reçoit « Resource not accessible by integration ». C'est
un réglage du dépôt, pas un défaut du code.

## Architecture de l'éditeur — lot B du neuvième audit

Le neuvième audit demandait de terminer l'architecture de l'éditeur avant
d'ajouter des familles d'objets : « à la fin de ce lot, l'ajout de nouvelles
familles sera réellement bon marché ».

- **Une barre d'outils qui ne connaît plus les murs.** Un outil déclare ce
  qu'il demande — assemblage et rôle du mur, type et dimensions de l'ouverture,
  réseau et nœud — et la barre affiche ce qui est déclaré. Une option calcule
  ses choix et sa valeur par défaut à partir du projet : le premier assemblage
  de ce projet, le premier réseau qu'il porte, jamais une constante écrite dans
  le code. Une valeur retenue qui n'existe plus n'est pas employée.
- **Étendue d'un objet sans construire une vue.** Cadrer un objet, poser un
  menu à côté de lui et dire ce qu'une bande a pris posent la même question ;
  la poser au moteur de dessin revenait à construire une vue entière pour
  mesurer un mur. Chaque famille répond pour elle-même, et une ouverture — qui
  ne porte qu'une distance le long de son mur — se lit sur le mur qui la porte.
- **Objets semblables.** Ce que « semblable » veut dire appartient à la
  famille : deux murs du même assemblage jouant le même rôle, deux ouvertures
  du même type et de la même taille. Une famille qui ne le dit pas ne répond
  rien, plutôt que de proposer tout l'étage.
- **Liens entre objets.** Le domaine refuse déjà de supprimer un mur qui porte
  encore une ouverture ; le refus nommait une règle, et les ouvertures
  restaient à chercher à l'œil. Un mur nomme ce qu'il porte, une ouverture son
  mur hôte, un nœud de réseau ceux auxquels il est raccordé — en suivant les
  segments et les ports, ce que rien d'autre ne faisait.
- **Menu contextuel.** Traverser la fenêtre pour supprimer le mur qu'on
  regarde est un trajet que le dessin n'a pas besoin d'imposer. Les entrées
  communes à tous les objets viennent de l'application ; celles qu'un mur seul
  offre — basculer sa face de référence — viennent de sa famille, si bien
  qu'une famille nouvelle arrive avec ses actions.
- **Objets superposés.** Une cloison, les deux pièces qu'elle sépare et la
  dalle sous les trois se rencontrent en un point : quatre objets, un pixel.
  Cliquer de nouveau au même endroit propose le suivant, puis revient au
  premier, de sorte que rien sous le curseur ne reste hors d'atteinte.
- **Filtre de sélection.** Le filtre est une option de l'outil Sélection,
  construite à partir du registre des familles : une famille ajoutée demain y
  paraît sans que personne ait à y penser. Rien n'est filtré tant que
  l'utilisateur ne le demande pas — un éditeur qui ignorerait la moitié du plan
  en silence serait un éditeur auquel personne ne pourrait se fier.

Les lots C à H de cet audit ont été traités depuis ; ce qui reste ouvert est
récapitulé à la fin de ce document.

## Architecture de la maison — lot C du neuvième audit

L'audit relevait que « le domaine permet encore plus que l'interface » et que
plusieurs familles d'objets n'existaient pas du tout.

- **Tracés sans compte de clics.** Une chaîne de murs, un contour de dalle, une
  trémie, une ligne de foulée, une toiture n'ont pas de nombre de sommets connu
  d'avance. Un outil peut désormais prendre des points jusqu'à ce que
  l'utilisateur dise que c'est fini : Entrée termine, Échap annule, et la barre
  d'état dit lequel des deux est attendu.
- **Mur continu, mur polyligne, murs rectangle.** Deux lectures du même tracé
  sont légitimes — un mur par côté, ou un seul mur polyligne — et aucune n'est
  devinable ; l'utilisateur choisit. Le rectangle ferme le contour d'équerre en
  deux clics.
- **Hauteur de mur « jusqu'au niveau ».** Le domaine l'acceptait depuis le
  début et aucun écran ne pouvait en produire. Hauteur saisie et niveau
  supérieur sont deux formes du même mur, écrites par une commande dédiée qui
  efface ce que l'autre portait.
- **Pièce et dalle depuis le plan.** Un contour fermé par les murs est un
  contour que le modèle sait déjà décrire ; le redessiner à la main revient à
  le redessiner à quelques millimètres près. Un clic suffit, ou un seul geste
  pour tous les contours encore libres. La trémie perce la dalle qui passe
  dessous et refuse d'en sortir.
- **`ComponentInstance`.** Le catalogue décrivait un modèle de pompe à chaleur
  et rien ne pouvait décrire la pompe à chaleur posée à cet endroit, sur cet
  étage, dans cette pièce. Le composant posé porte où il est et ce qu'il
  représente, jamais ce que son modèle dit déjà. La pièce où il se trouve est
  lue sur le plan.
- **`Stair` typé.** Le niveau portait `stairs: readonly JsonValue[]` : un
  escalier était une forme de JSON que l'application transportait sans savoir
  la lire. Il dit maintenant ce qu'il joint et comment. La hauteur de marche ne
  s'y trouve pas : elle est la montée divisée par le nombre de contremarches,
  et l'écrire serait une seconde réponse à une question que les niveaux
  répondent déjà. L'inspecteur rapporte la formule de Blondel sans corriger
  l'escalier.
- **Plafond.** Aucun type nouveau : un faux plafond est un élément horizontal
  avec son propre complexe, et les assemblages portaient déjà une catégorie
  PLAFOND. C'est un rôle de dalle qui manquait.
- **Toiture v2.** Le contrat précédent l'annonçait lui-même : « MVP planar roof
  contract. Connected roof topology is deliberately deferred. » Chaque pan
  était dessiné à la main et rien ne les reliait : deux pans pouvaient ne se
  rencontrer nulle part et le modèle n'avait pas d'avis. Une toiture tient
  désormais le contour qu'elle couvre et ce que fait chacun de ses côtés — pan
  ou pignon, pente, débord. Les pans en découlent, déduits et jamais
  enregistrés, si bien qu'un contour qui bouge les déplace et qu'un côté devenu
  pignon en retire un. Un contour rectangulaire est résolu exactement, quel que
  soit le mélange de pans et de pignons et quelles que soient les pentes : deux
  côtés opposés se rencontrent là où leurs deux montées atteignent la même
  hauteur, ce qui est une division et non une estimation. Tout autre contour
  demande un squelette droit, que cette version ne calcule pas : elle le dit et
  ne rend que les pans dont elle est sûre, plutôt que d'inventer un faîtage que
  personne n'a dessiné.

Restent ouverts pour cette famille : le mur courbe, le raccord visuel L/T/X, et
la résolution des toitures sur contour quelconque.

## Éditeur MEP graphique — lot D du neuvième audit

L'audit résumait l'écart en une phrase : « les données sont mûres, l'UX reste le
gros manque ». Un réseau se construisait en posant des nœuds sur le plan, puis
en changeant d'espace de travail pour choisir un port de départ et un port
d'arrivée dans deux menus.

- **Ports visibles.** Un port est un endroit sur un appareil et non un endroit
  dans la maison : le modèle ne lui donne pas de position, et il a raison. Le
  dessin doit pourtant le poser quelque part pour qu'on puisse le désigner ;
  sa place est donc déduite de celle de son nœud — assez près pour se lire
  comme lui appartenant, assez loin pour être cliqué seul — et jamais
  enregistrée.
- **Tracé port → port sur le plan.** Chaque coude que l'utilisateur pose est
  conservé : un éditeur qui re-routerait autour serait un éditeur qui jette ce
  qu'on vient de dessiner.
- **Colonnes.** Un tracé dont les deux extrémités ne sont pas à la même hauteur
  monte à la verticale au dernier coude : une colonne se voit, au lieu d'être
  une pente cachée dans une diagonale.
- **Pente d'évacuation.** Une évacuation horizontale est une évacuation qui ne
  s'écoule pas. La hauteur de chaque coude découle de la distance parcourue et
  de la pente demandée, si bien que la chute est une conséquence du tracé et
  non un nombre saisi deux fois. La pente par défaut suit la discipline du
  réseau choisi juste à côté plutôt qu'une constante écrite dans le code, et
  l'inspecteur rapporte la pente qu'un tronçon a réellement.
- **Dérivation.** Un té n'est pas une forme dessinée sur un tuyau : c'est une
  pièce avec une entrée et deux sorties. Quelle pièce, cela appartient à la
  discipline — nourrice pour l'eau, regard pour les eaux usées, piquage pour
  l'air — et les gabarits le disaient déjà. Le tronçon est coupé à cette pièce
  et refait en deux ; la sortie libre reste ouverte, ce qui est exactement à
  quoi ressemble une branche inachevée.
- **Poignées de réseau.** Un tronçon offre une poignée par coude et aucune à ses
  extrémités : celles-ci appartiennent à leurs ports, et les traîner
  dessinerait un tuyau qui n'atteint rien.
- **Réseau actif partagé.** Le réseau sur lequel on travaille n'est pas une
  propriété d'un outil : poser un nœud, tracer un tronçon et l'espace Réseaux
  doivent parler du même. Une option peut désormais se déclarer partagée, et
  tout outil qui la demande lit et écrit la même valeur. Tout outil qui demande
  un réseau révèle aussi le calque de sa discipline, au lieu que la liste des
  outils concernés soit écrite à la main.
- **Navigateur de systèmes.** L'arbre du projet montre les tronçons à côté des
  nœuds, et les ports qu'aucun tronçon n'atteint — ce à quoi ressemble un
  réseau inachevé.

## Superpositions techniques — lot E du neuvième audit

L'audit décrivait ce lot comme « à rendement extrêmement élevé » : les moteurs
existaient déjà, l'interface ne projetait que trois chiffres thermiques sur le
dessin et le reste se lisait dans des tableaux.

- **Une analyse dit où sont ses chiffres.** Une superposition nomme le module
  qu'elle lit, la sortie d'où viennent ses lignes et la colonne qu'elle
  colore ; en ajouter une revient à décrire où les nombres se trouvent déjà,
  plutôt qu'à écrire une quatrième façon de les extraire. Sept analyses
  s'ajoutent ainsi aux trois existantes : vitesse et pertes de charge de l'eau
  et des gaines, pente des collecteurs, chute de tension et puissance foisonnée
  par circuit.
- **Une ligne se colore comme une surface.** Un mur est une forme pleine, un
  tuyau est une ligne : une superposition qui ne savait colorer que des formes
  pouvait rendre compte de l'enveloppe et jamais des réseaux. C'est exactement
  là qu'elle s'arrêtait.
- **Une ligne sans valeur reste inconnue.** Elle n'est pas comptée pour zéro,
  elle ne tire pas l'échelle vers le bas, et la légende la compte comme
  inconnue.
- **Le calque suit l'analyse.** Colorer un objet que personne ne dessine ne
  colore rien : choisir une analyse des canalisations révèle le calque des
  canalisations, comme le fait déjà un outil de réseau.
- **Les avertissements deviennent des corrections.** Une couleur dit où une
  valeur est élevée ; elle ne peut pas dire qu'une valeur manque parce qu'un
  tuyau n'a pas de diamètre. Ce que le module n'a pas pu faire est affiché sous
  la légende, avec les objets qu'il nomme, et « Corriger » les sélectionne et
  les cadre sur le plan.

## Dossier de plans — lot F du neuvième audit

Le projet portait `drawingViews?: readonly JsonValue[]` : une liste que le
fichier transportait et que rien ne savait lire. Un projet exportait donc ce que
l'écran montrait à cet instant, et un plan produit deux fois était deux plans
différents.

- **Vue typée.** Une vue retient les décisions qui font un dessin — quel
  niveau, à quelle échelle, avec quels calques, sous quel profil graphique — et
  aucune géométrie : le dessin est refait à partir du modèle à chaque fois. Une
  vue rouverte après qu'un mur a bougé montre le mur où il est.
- **Feuilles.** Une feuille porte des vues, un numéro, un format et une
  orientation. Le moteur de dessin construit la mise en page à partir de ces
  choix et d'un gabarit de cartouche fourni par l'application. Ce que dit le
  cartouche est déduit du projet — son nom, le numéro de feuille, la révision —
  et jamais recopié : un projet renommé est un cartouche renommé, et une case
  que le projet ne peut pas remplir est dessinée « inconnu » plutôt qu'avec une
  valeur plausible.
- **La feuille montre ce que le plan montre.** Chaque vue arrive telle que le
  moteur de dessin l'a produite et est imbriquée dans son cadre. Une feuille qui
  redessinerait le modèle d'une seconde façon serait un second moteur de dessin,
  et les deux finiraient par ne plus dire la même chose.
- **Références vérifiées.** Une vue qui nomme un niveau absent et une feuille
  qui nomme une vue absente sont relevées à la lecture du fichier ; une vue
  encore posée sur une feuille ne peut pas être supprimée, et le refus nomme les
  feuilles concernées.
- **Export PDF multipage.** Le moteur construisait déjà le travail
  d'impression, validait les pages et vérifiait les octets rendus ; il manquait
  de quoi produire ces octets. Un backend navigateur les produit, sans
  bibliothèque. Ses pages sont des images : le format PDF ne connaît pas le
  SVG, et le convertir en tracés PDF reviendrait à écrire un second moteur de
  dessin. Le tirage est à l'échelle ; le texte n'y est ni sélectionnable ni
  recherchable, et l'interface le dit à côté du bouton.

## Scénarios visuels — lot G du neuvième audit

L'audit décrivait le chemin à parcourir en deux blocs : de « scénario →
sélectionner une clé JSON → saisir une valeur » à « mode scénario → cliquer un
mur → changer l'assemblage → override créé automatiquement ».

- **Mode scénario.** Le plan dessine la variante plutôt que le projet. Rien de
  la variante n'est écrit dans le bâtiment : une variante est une liste de
  différences, et elle le reste.
- **Modifier, c'est décrire une différence.** L'inspecteur ne sait pas dans
  quel mode il se trouve ; il demande, et ce qui lui revient décide. En mode
  scénario, changer une propriété écrit un changement du scénario, et le chemin
  est déduit de ce qui a été désigné — non plus choisi dans une liste de toutes
  les valeurs du projet.
- **Changer d'avis.** Une variante construite en pointant le plan se construit
  en changeant d'avis ; devoir retirer le changement précédent avant d'en poser
  un autre aurait été une arithmétique que personne n'a demandée.
- **Ce que la variante fait est refusé à voix haute.** Une propriété qu'aucun
  chemin de scénario ne nomme ne peut pas encore varier, et l'application le
  dit au lieu de l'écrire silencieusement dans le bâtiment.
- **La différence se voit.** Ajouts, retraits et modifications sont colorés sur
  le plan par les mêmes bandes que les analyses. La comparaison porte sur les
  deux projets et non sur la liste des changements : un changement d'assemblage
  modifie tous les murs qui en sont faits, et une liste de chemins montrerait un
  changement là où le dessin en montre douze.

## Terrain et structure — lot H du neuvième audit

L'audit relevait deux absences : un site « quasi absent » côté dessin, et
aucune famille structurelle dans le niveau.

- **Le terrain se dessine.** Le site portait une parcelle et une liste
  d'obstacles depuis le début, et rien ne les dessinait : les distances aux
  limites et l'ombre d'un voisin étaient des faits que personne ne pouvait
  voir. Un outil trace la parcelle ou ce qui l'entoure.
- **Ce qui entoure la maison a une nature.** Un bâtiment voisin, un arbre et
  une zone à laisser libre ne portent pas la même ombre et ne se traitent pas de
  la même façon ; la nature appartient à l'obstacle. Sans hauteur, l'ombre reste
  incalculable, et l'inspecteur le dit plutôt que le modèle n'invente un nombre.
- **Poteaux, poutres, fondations.** Ce sont des objets du bâtiment et rien ne
  les calcule encore. Attendre le moteur de structure avant d'autoriser les
  objets aurait été attendre de pouvoir vérifier une maison avant de pouvoir la
  décrire. Un poteau se tient en un point, une poutre court entre deux : la
  différence est ce que l'élément est, et c'est ce que les deux outils disent.
- **Aucun matériau supposé.** Un élément dont le matériau n'est pas désigné le
  reste, et l'inspecteur dit que rien ne pourra être vérifié tant qu'il le
  reste. Un matériau que le projet ne contient plus est refusé à l'écriture et
  relevé à la lecture du fichier.

## Trois défauts d'intégrité — lot A du dixième audit

Un audit du `main` après la PR #21 a relevé trois défauts capables de produire
un résultat faux sans que rien ne le signale. Ce sont les seuls de cette nature,
et ils passent avant toute nouvelle fonctionnalité.

### Toiture quatre pans : des mètres carrés comptés deux fois

Les pans étaient déduits rive par rive : chaque rive inclinée produisait un
quadrilatère occupant toute sa longueur jusqu'à la rencontre avec la rive
opposée. Sur un deux-pans, c'est exact. Sur une croupe, les quatre pans se
recouvraient au milieu : une maison de 10 × 8 m produisait 160 m² de projection
pour 80 m² d'emprise. Et comme `allRoofPlanes()` alimente les métrés,
l'enveloppe thermique et les apports solaires, ces mètres carrés en trop
sortaient du dessin pour entrer dans les calculs. Le pire est que l'outil crée
toutes les rives en pente par défaut : le cas faux était le cas ordinaire.

La déduction repose maintenant sur ce qu'est une toiture : la plus basse des
surfaces qui montent depuis ses rives. En tout point sous le toit, le pan qui
couvre est celui qui atteint ce point le plus bas, et la face d'un pan est
exactement l'endroit où il est ce plus bas. Construits ainsi, les pans sont une
partition — ils couvrent le toit une fois et une seule — au lieu de
quadrilatères indépendants. La construction est exacte pour **tout contour
convexe**, quel que soit le mélange de pans et de pignons et quelles que soient
les pentes ; un pignon ne fait monter aucune surface, donc les rives en pente se
partagent tout le toit. Un contour non convexe demande un squelette droit, que
cette version ne calcule pas.

Ce qu'elle ne sait pas partitionner ne compte plus dans aucune surface du
projet : ni métrés, ni thermique, ni solaire. Ce silence est le comportement
sûr, mais c'est un silence — l'utilisateur a dessiné une toiture et les
quantités n'en parlent pas. L'espace Vérifications le dit donc à voix haute, et
« Voir sur le plan » mène à la toiture concernée.

Les tests qui manquaient sont ceux d'invariants : compter les pans ne dit rien
de leur recouvrement. Six configurations — deux pans, deux pans dissymétriques,
monopente, quatre pans, quatre pentes différentes, trois pans et un pignon —
vérifient désormais que la somme des projections vaut l'emprise sous égouts et
qu'aucun pan n'en recouvre un autre.

### Le contrat de fichier `1.0.0` resserré sans version

Sous `1.0.0`, le schéma acceptait `stairs` et `drawingViews` comme des tableaux
de n'importe quoi : le fichier les transportait et rien ne les lisait. La PR #21
leur a donné un contrat — sans changer de version. Un fichier accepté hier
pouvait donc être refusé aujourd'hui, ce qu'une version de schéma existe
précisément pour empêcher.

Le schéma courant passe à `1.1.0`, avec une migration `1.0.0 → 1.1.0`. Ce qui
correspond au nouveau contrat est conservé et devient lisible ; ce qui n'y
correspond pas est rangé sous une extension `legacy.1-0-0`, nommée et
retrouvable. Le jeter en silence perdrait des données que personne n'a accepté
de perdre ; refuser le fichier enfermerait l'utilisateur dehors de son propre
projet. Deux jeux d'essai `1.0.0` — l'un déjà conforme, l'autre opaque — sont
conservés et vérifiés à chaque exécution.

### L'échelle des feuilles n'en était pas une

Une vue était rendue avec le cadrage automatique de son contenu, puis imbriquée
dans le rectangle papier avec `preserveAspectRatio="xMidYMid meet"`. Autrement
dit : le dessin s'adaptait au cadre. Le dénominateur d'échelle ne servait qu'au
texte du cartouche, si bien qu'une feuille pouvait annoncer 1:50 et imprimer au
1:30.

La fenêtre modèle est maintenant calculée depuis le cadre et l'échelle : un
cadre de 300 mm au 1:50 montre exactement 15 000 mm de bâtiment, centrés là où
la vue le dit. Le cadre ne décide plus rien — un cadre deux fois plus étroit
montre deux fois moins de bâtiment, il ne dézoome pas. L'échelle employée est
celle du viewport et non celle de la vue, puisqu'une même vue peut figurer sur
deux feuilles à deux échelles.

Le test physique demandé existe : dix mètres de mur mesurent 200 mm au 1:50,
100 mm au 1:100 et 50 mm au 1:200, mesurés sur le SVG de feuille réellement
produit — et la feuille se déclare en millimètres avec un `viewBox` un pour un,
ce qui est ce qui porte l'échelle jusque dans le PDF.

## Cohérence des objets récents — lot B du dixième audit

Les familles ajoutées par les lots C à H sont arrivées avec des incohérences
qui n'étaient visibles qu'en s'en servant. Elles ne rendaient rien faux dans
les calculs ; elles rendaient l'application impossible à utiliser sur les
objets concernés, ce qui revient au même pour la personne qui dessine.

### L'arborescence renvoyait un libellé là où un identifiant était attendu

Chaque famille de l'arbre produisait une chaîne unique où l'identifiant et le
nom voyageaient collés, à charge pour l'affichage de les séparer. Les pièces
utilisaient un `\0` comme séparateur ; la structure et les composants avaient
utilisé une espace. Un clic sur « Poteau member-1 » ou sur « Radiateur séjour »
envoyait donc `member-1 Poteau` — libellé compris — là où l'application
attendait `member-1`, et ne sélectionnait rien. Deux familles sur neuf, et
précisément les deux dernières ajoutées.

Le format n'a pas été corrigé, il a été supprimé : une entrée de l'arbre est
maintenant `{ objectId, label }`, deux champs qu'aucune famille ne peut coller
l'un à l'autre. Un test navigateur fait le trajet complet pour les deux
familles fautives — arbre → Structure → clic sur le poteau → inspecteur du
poteau, arbre → Composants → clic sur le radiateur → inspecteur du radiateur.

### Un tronçon de réseau ne pouvait ni être modifié ni être supprimé

Le tronçon était sélectionnable, mesurable, encadrable et déplaçable, mais
`edits` et `remove` de sa famille ne connaissaient que les nœuds. Ce qu'un tuyau
est fait de ne pouvait donc se dire que dans l'espace de travail des réseaux,
et la touche Suppr ne faisait rien sur lui.

L'édition vient maintenant du schéma de la discipline — `edgePropertySchema`,
le même que celui du panneau réseaux — de sorte qu'une discipline nouvelle
apporte ses champs sans que l'inspecteur ait à les connaître. Un champ vidé
efface la propriété au lieu d'y écrire zéro, et le pas des flèches suit l'unité
du champ : un diamètre en mètres ne se règle pas par pas de un.

### Les réseaux se dessinaient en entier sur tous les niveaux

Un nœud déclare le niveau où il se trouve ; le plan les dessinait tous, quel
que soit l'étage affiché. La vue filtre désormais nœuds, ports et tronçons par
le niveau demandé — un tronçon appartient aux niveaux de ses deux extrémités —
et un objet qui ne déclare aucun niveau reste visible partout, parce qu'il n'y
a rien à filtrer dessus. Un tronçon qui relie deux étages est marqué comme
colonne montante plutôt que masqué.

### Un composant pouvait être fixé à autre chose qu'une surface

`hostObjectId` était vérifié contre la liste des cibles d'un nœud de réseau,
qui contient les pièces et les équipements du catalogue. Un radiateur pouvait
donc être « fixé » au modèle de radiateur qui le décrit. Un composant se fixe à
un mur, une dalle ou une toiture ; le support et la pièce doivent de plus se
trouver sur le niveau du composant, faute de quoi le dessin le pose à un étage
et son support à un autre. La lecture de fichier et les commandes le refusent
toutes les deux.

### Un escalier décrivait deux escaliers différents

La ligne de foulée était tracée à la main et les marches choisies dans les
options de l'outil : rien ne forçait la longueur tracée à correspondre au
nombre de marches et au giron. Le plan répartissait les marches uniformément
sur la ligne, si bien que seize contremarches de 27 cm tenaient visuellement
sur trois mètres comme sur cinq. Le dessin et les métrés décrivaient deux
objets.

Trois changements. Les marches sont maintenant posées au giron déclaré, en
partant du bas et en s'arrêtant au bout de la ligne : une volée qui ne tient
pas dans la place qu'on lui a donnée se voit. La création ajuste la ligne
tracée à la longueur que la volée demande, en gardant le départ et chaque
angle : l'utilisateur dit où l'escalier va et comment il tourne, sa longueur
suit de ses marches. Enfin `stairDimensions` rend la longueur tracée, la
longueur demandée et leur écart, et les Vérifications signalent tout écart de
plus d'un centimètre en nommant les deux longueurs — ce qui reste possible
après une modification du nombre de marches depuis l'inspecteur.

Un escalier qui arrive à un niveau non supérieur au sien est refusé à la
lecture du fichier, et plus seulement par les commandes : sa montée serait
nulle ou négative, donc sa hauteur de marche, son Blondel et sa place dans les
métrés seraient des réponses à une question qui n'en a pas.

## Déplacer, pivoter, retourner, copier — lot C du dixième audit

Déplacer, transformer et dupliquer étaient trois chaînes de `if` portant chacune
sur quatre familles, écrites quand il y en avait quatre. Les dix familles
ajoutées depuis tombaient au bout des trois et recevaient « cet objet ne se
déplace pas depuis le plan » : vrai du code, faux de l'objet. Un escalier, une
toiture complète, un poteau, un composant posé, un obstacle de terrain ne
pouvaient être ni déplacés, ni pivotés, ni retournés, ni dupliqués.

### Ce que fait une famille, elle le déclare

Une famille du registre déclare maintenant ses `capabilities` —
`movable / rotatable / mirrorable / duplicable` — et fournit deux
implémentations : comment un de ses objets suit une transformation, et comment
il se copie de côté. Déplacer, pivoter et retourner sont une seule application
d'un point vers un point, donc une seule fonction par famille répond aux trois :
la famille qui suivait la rotation et oubliait le miroir n'existe plus.

Ce qu'une famille ne fait pas, elle le dit aussi, et en français : une ouverture
appartient à son mur, une pièce est l'espace que ses murs enferment, une cote
suit les murs qu'elle mesure, une parcelle est la limite du terrain. Le menu
contextuel et la barre d'outils grisent ce qui n'est pas offert au lieu de le
proposer puis de le refuser — une action proposée puis refusée se lit comme une
panne, une action visiblement indisponible se lit comme une propriété de
l'objet, ce qu'elle est.

Une sélection ne peut que ce que tous ses objets peuvent : une pièce dans la
sélection et rien ne pivote, parce que faire tourner les murs autour d'elle
démonterait le dessin.

### Deux cas qui ne sont pas des cas généraux

Un **tronçon de réseau** ne se déplace pas seul : ses extrémités appartiennent à
leurs ports. Il porte en revanche ses propres coudes quand ses deux nœuds
voyagent avec lui — sans quoi déplacer une branche entière déformait les
tronçons au lieu de les déplacer, les extrémités suivant les nœuds et les coudes
restant sur place. Sélectionné seul, il dit lequel des deux il attend.

Un **objet de réseau ne se duplique pas depuis le plan** : un nœud que rien ne
rejoint et un tronçon qui ne relie rien sont des fragments. La copie d'un réseau
appartient à l'espace Réseaux, et le refus le dit.

### Le presse-papiers connaît enfin tout l'étage

Copier un niveau sur celui du dessus est la raison d'être du presse-papiers, et
il copiait les murs en laissant derrière lui les escaliers, la toiture, les
poteaux et les radiateurs — sans le dire. Il transporte maintenant les huit
familles, et ce qui connaît sa propre altitude est relu contre le niveau où il
atterrit : les rives d'une toiture montent d'un étage, et un escalier collé un
étage plus haut arrive un étage plus haut. Quand rien ne se trouve au-dessus du
niveau d'arrivée, le collage est refusé en le disant, plutôt que d'écrire un
escalier qui descend.

Un `UpdateSiteObstacleCommand` est apparu au passage : un arbre pouvait être
planté et arraché, et rien entre les deux.

## Vues et documents — lot D du dixième audit

### Une vue rouverte n'était pas la vue enregistrée

`applySavedView` rétablissait le niveau, puis appelait `SHOW_LAYERS` avec les
calques allumés. Or `SHOW_LAYERS` n'éteint jamais — c'est le bon comportement
quand on révèle une discipline, et le mauvais quand on rétablit une vue. Une
vue enregistrée réseaux masqués revenait réseaux visibles, au zoom où
l'utilisateur se trouvait, avec l'analyse qui était affichée. C'était un autre
dessin portant le même nom.

Une vue rétablit maintenant tout ce qu'elle décrit : le niveau, chaque calque
tel qu'il était — masqués compris —, le centre, l'échelle et l'analyse. Et ce
qu'elle ne peut pas rétablir, elle le nomme : un niveau supprimé depuis, une
analyse que cette version n'affiche plus, une charte graphique inconnue, un type
de vue que le plan ne dessine pas encore. Une vue qui revient fausse en silence
est pire qu'une vue qui dit ce qu'elle a perdu.

Deux actions de l'éditeur sont apparues pour cela : `SET_LAYERS`, qui pose la
visibilité exacte au lieu de ne faire qu'allumer, et `SET_CAMERA`, qui pose un
centre et un zoom au lieu de cadrer ce qui se trouve dessiné. Le pont entre une
échelle et un zoom est une fonction unique, vérifiée dans les deux sens.

### Une feuille ne portait qu'une vue, en paysage

Un plan et sa coupe sur la même feuille est le cas ordinaire d'un dossier, et il
ne pouvait pas s'exprimer : le panneau créait une feuille paysage avec un seul
cadre, et la seule chose modifiable ensuite était quelle vue s'y trouvait.

Une feuille porte maintenant autant de vues qu'on lui en ajoute, chacune avec sa
propre échelle ; le format, l'orientation et l'indice se changent après coup.
Les cadres ne sont pas placés à la main : ils sont déduits du papier, de son
orientation et du nombre de vues, en une grille aussi carrée que le compte le
permet, la bande du cartouche laissée libre sur toute la largeur. C'est ce qui
garantit qu'aucun cadre ne sort de la zone imprimable ni ne passe sous le
cartouche — le moteur de dessin refuse les deux — et c'est pourquoi tourner le
papier redéduit les cadres au lieu de les laisser pendre hors de la feuille.

### Un A0 faisait tomber l'onglet

Les pages étaient tramées **toutes en même temps** — `Promise.all` sur les
feuilles — à huit pixels par millimètre quel que soit le format. Un A0 fait
alors 6 728 × 9 512 pixels, soit soixante-quatre mégapixels et un quart de
gigaoctet de canevas pour une page. Un dossier de dix A0 demandait deux
gigaoctets et demi à l'onglet et recevait un plantage : pas de fichier, pas
d'erreur, pas d'explication.

Les pages sont maintenant tramées **une par une**, et le canevas de chacune est
rendu avant de demander la suivante : la mémoire nécessaire à un dossier est
celle de sa plus grande feuille, pas celle de toutes ensemble. La densité vient
d'un budget de vingt-cinq mégapixels par page plutôt que d'une constante : les
petits formats gardent leurs 203 ppp, un A1 descend à 180, un A0 à 127.

Et cette densité est **annoncée**. L'interface affichait « pages tramées à
200 ppp », ce qui était faux dès qu'un grand format entrait dans le dossier. Le
panneau annonce désormais, avant l'export, la densité de la feuille la plus
réduite — celle qui borne la netteté de l'ensemble — et le message de fin dit la
même chose.

## Ce qui reste ouvert après les lots A à H

Les huit lots du neuvième audit sont traités. Ce qui n'a pas été fait, et
pourquoi :

- **Toitures sur contour quelconque.** Un contour rectangulaire est résolu
  exactement ; les autres demandent un squelette droit. La version le dit et ne
  rend que les pans dont elle est sûre.
- **Murs courbes, raccords visuels L/T/X, congés et chanfreins.** Hors
  périmètre de la bêta.
- **PDF vectoriel.** Les pages exportées sont des images de chaque feuille : le
  format PDF ne connaît pas le SVG, et le convertir en tracés reviendrait à
  écrire un second moteur de dessin.
- **Annotations typées** — notes de texte, étiquettes associatives, repères,
  trames, repères de coupe. La cotation existe ; le reste attend.
- **Modes QUICK / DESIGN / EXPERT.** L'interface a toujours une seule densité.
- **Calcul de structure et géotechnique.** Les poteaux, poutres et fondations
  se décrivent et se dessinent ; rien ne les vérifie encore, et le calcul, quand
  il viendra, lira ce modèle plutôt que d'en demander un autre.
- **Performance sur très grand projet.** `runProjectCalculations()` recrée
  toujours l'orchestrateur à chaque exécution, et le banc d'essai reste celui
  d'une maison de référence plutôt que d'une maison de mille murs.
- **Exports DXF et IFC, collaboration en ligne.** Hors périmètre.

## Budget de chargement

Le budget du premier chargement passe de 200 à 240 kio compressés. L'éditeur a
gagné les familles et les outils des lots C à H — murs tracés en chaîne, pièces,
dalles, trémies, escaliers, toitures décrites par leur contour, composants
posés, structure, terrain, éditeur graphique des réseaux, mode scénario — et
tout cela est l'éditeur, c'est-à-dire ce que la première visite charge. Les
espaces de travail restent chargés à la demande, et la chaîne PDF y a été
déplacée : elle ne sert qu'au bouton d'export, et la charger avec l'application
aurait mis une imprimante sur le chemin d'un mur à dessiner.

Un budget est une décision, pas une mesure. Celle-ci a été prise sciemment.

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
- tests unitaires et d’intégration : 897 tests sur 125 fichiers
- tests navigateur : 62 tests Playwright — 59 sur Chromium et trois sur un
  écran de téléphone — dont deux rejoués sur Firefox et WebKit
- accessibilité : axe-core, onze espaces de travail et la palette de
  commandes, WCAG 2.1 AA, aucun manquement
- chargement initial : 151 kio compressés pour un budget de 200 kio
- build : pass sur tous les espaces de travail
- benchmarks : consignés dans `PERFORMANCE_BASELINE.md`
