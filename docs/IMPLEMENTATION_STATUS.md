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
- tests unitaires et d'intégration : 722 tests sur 110 fichiers
- tests navigateur : 45 tests Playwright, dont trois sur un écran de téléphone
- build : pass sur tous les espaces de travail
- benchmarks : consignés dans `PERFORMANCE_BASELINE.md`
