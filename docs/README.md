# Documentation — House Technical Designer

## Où se trouve quoi

Chaque sujet n'a qu'un seul document, et il se trouve ici :

| Sujet                                    | Document                                                         |
| ---------------------------------------- | ---------------------------------------------------------------- |
| Présentation, démo, prise en main        | [`README.md`](../README.md)                                      |
| Architecture logicielle                  | [`ARCHITECTURE.md`](../ARCHITECTURE.md)                          |
| État réel de l'implémentation            | [`IMPLEMENTATION_STATUS.md`](IMPLEMENTATION_STATUS.md)           |
| Plan d'implémentation, PR par PR         | [`IMPLEMENTATION_PLAN.md`](../IMPLEMENTATION_PLAN.md)            |
| Spécifications et normes                 | [`specifications/`](specifications/), [`standards/`](standards/) |
| Décisions structurantes                  | [`adr/`](adr/)                                                   |
| Contrats machine-lisibles                | [`schemas/`](../schemas/)                                        |
| Ce que le format ne sait pas dire        | [`CONTRACT_GAPS.md`](CONTRACT_GAPS.md)                           |
| Les vagues de remplissage                | [`CATALOG_WAVES.md`](CATALOG_WAVES.md)                           |
| Ce que chaque moteur a répondu           | [`ENGINE_AUDIT.md`](ENGINE_AUDIT.md)                             |
| Contrat d'interface en vigueur           | [`UX_ARCHITECTURE.md`](UX_ARCHITECTURE.md)                       |
| Refonte de l'interface, PR par PR        | [`UX_REDESIGN_V2.md`](UX_REDESIGN_V2.md)                         |
| Ce que l'interface doit savoir du projet | [`UX_REDESIGN_V3.md`](UX_REDESIGN_V3.md)                         |

Les copies de `specifications/` et `standards/` qui existaient à la racine du
dépôt ont été supprimées : elles étaient identiques à celles-ci, et deux
exemplaires d'une même spécification finissent toujours par diverger. Le
document `architecture logicielle.md`, première version de l'architecture, a
été supprimé pour la même raison : `ARCHITECTURE.md` le remplace. L'historique
Git conserve les deux.

## Utilisation

- [Guide utilisateur MVP](USER_GUIDE_MVP.md)
- [État de l'implémentation](IMPLEMENTATION_STATUS.md)
- [Baseline de performance](PERFORMANCE_BASELINE.md)

## Fondation

1. [Vision and Scope](specifications/01_VISION_AND_SCOPE.md)
2. [Domain Model](specifications/02_DOMAIN_MODEL.md)
3. [Geometry Engine](specifications/03_GEOMETRY_ENGINE.md)
4. [Drawing Conventions](standards/04_DRAWING_CONVENTIONS.md)
5. [Materials Catalog](specifications/05_MATERIALS_CATALOG.md)
6. [Assemblies and Quantities](specifications/06_ASSEMBLIES_AND_QUANTITIES.md)
7. [Standards and Rules](standards/07_STANDARDS_AND_RULES.md)
8. [Calculation Engine](specifications/08_CALCULATION_ENGINE.md)
9. [Module Specifications](specifications/09_MODULE_SPECIFICATIONS.md)
10. [UI / UX Specification](specifications/10_UI_UX_SPECIFICATION.md)
11. [Project File Format](specifications/11_PROJECT_FILE_FORMAT.md)
12. [Test Strategy](specifications/12_TEST_STRATEGY.md)
13. [Roadmap](specifications/13_ROADMAP.md)
14. [Contributing](specifications/14_CONTRIBUTING.md)

## Spécifications des modules

15. [Thermal / Envelope](specifications/15_THERMAL_ENVELOPE_MODULE.md)
16. [Hygrothermal](specifications/16_HYGROTHERMAL_MODULE.md)
17. [Heating / DHW](specifications/17_HEATING_DHW_MODULE.md)
18. [Photovoltaic / Battery](specifications/18_PHOTOVOLTAIC_BATTERY_MODULE.md)
19. [Water Supply](specifications/19_WATER_SUPPLY_MODULE.md)
20. [Rainwater](specifications/20_RAINWATER_MODULE.md)
21. [Wastewater](specifications/21_WASTEWATER_MODULE.md)
22. [Ventilation / IAQ](specifications/22_VENTILATION_IAQ_MODULE.md)
23. [Electrical](specifications/23_ELECTRICAL_MODULE.md)
24. [Lighting](specifications/24_LIGHTING_MODULE.md)
25. [Acoustics](specifications/25_ACOUSTICS_MODULE.md)
26. [Energy Balance](specifications/26_ENERGY_BALANCE_MODULE.md)
27. [Cost / Environment](specifications/27_COST_ENVIRONMENT_MODULE.md)
28. [Machine-readable Contracts](specifications/28_MACHINE_READABLE_CONTRACTS.md)

## Contrats d'implémentation

29. [Geometry Schema](specifications/29_GEOMETRY_SCHEMA.md)
30. [Building Elements Schema](specifications/30_BUILDING_ELEMENTS_SCHEMA.md)
31. [Network Schema](specifications/31_NETWORK_SCHEMA.md)
32. [Climate Data Model](specifications/32_CLIMATE_DATA_MODEL.md)
33. [Equipment Catalog](specifications/33_EQUIPMENT_CATALOG.md)
34. [Symbol Library](specifications/34_SYMBOL_LIBRARY_SPEC.md)
35. [Rule Pack Format](specifications/35_RULE_PACK_FORMAT.md)
36. [Calculation API](specifications/36_CALCULATION_API.md)
37. [Rendering Pipeline](specifications/37_RENDERING_PIPELINE.md)
38. [Command / Undo / Redo](specifications/38_COMMAND_UNDO_REDO.md)
39. [Project Migrations](specifications/39_PROJECT_MIGRATIONS.md)
40. [CI and Validation](specifications/40_CI_AND_VALIDATION.md)
41. [Future Evolutions and Modules](specifications/41_FUTURE_EVOLUTIONS_AND_MODULES.md)

## Plan d'implémentation

- [Implementation Plan — PR par PR](../IMPLEMENTATION_PLAN.md)

## Architecture Decision Records

- [ADR index](adr/README.md)
- [ADR-0001 — Building model as single source of truth](adr/ADR-0001-source-of-truth.md)
- [ADR-0002 — SVG as primary 2D rendering engine](adr/ADR-0002-svg-rendering.md)
- [ADR-0003 — Geometry units and physical units](adr/ADR-0003-geometry-units.md)
- [ADR-0004 — Stable calculation module API](adr/ADR-0004-module-api.md)
- [ADR-0005 — Regulations implemented as versioned rule packs](adr/ADR-0005-rule-packs.md)
- [ADR-0006 — Versioned project file and explicit migrations](adr/ADR-0006-project-file-versioning.md)
- [ADR-0007 — Derived values are not authoritative persisted state](adr/ADR-0007-derived-data.md)
- [ADR-0008 — Technical networks represented as graphs](adr/ADR-0008-networks-as-graphs.md)

## Contrats machine-lisibles

Voir [`schemas/README.md`](../schemas/README.md).

Le principe est : **documentation humaine + JSON Schema + fixture validée + tests**.

## Règle d'unité importante

Conformément à `ADR-0003` :

- géométrie d'édition persistée : **millimètres** ;
- moteurs physiques : **unités SI** ;
- conversions : package `units`, aux frontières des modules.

Cette convention ne doit pas être contournée dans les composants UI.
