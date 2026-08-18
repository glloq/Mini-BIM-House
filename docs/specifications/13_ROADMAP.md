# 13 — Roadmap

> **Objectif :** organiser le développement par capacités verticales utilisables, sans construire tous les modules en parallèle.

---

## Principe de progression

Chaque milestone doit produire une application utilisable et testable.

Ordre de priorité :

```text
Domain model
→ Geometry
→ Drawing
→ Materials
→ Quantities
→ First calculation
→ Technical networks
→ Cross-module analysis
→ Regulatory depth
```

---

# M0 — Repository foundation

## Livrables

- monorepo TypeScript ;
- Vite + React ;
- packages de base ;
- tests ;
- lint ;
- CI ;
- GitHub Pages ;
- documentation racine.

## Critère de sortie

Une application vide se compile, se teste et se déploie automatiquement.

---

# M1 — Project core

## Fonctionnalités

- `Project` ;
- `Site` ;
- `Building` ;
- `Level` ;
- identifiants ;
- unités ;
- import/export ;
- JSON Schema ;
- migrations initiales.

## Critère de sortie

Créer, sauvegarder, fermer et rouvrir un projet minimal sans perte.

---

# M2 — Geometry editor

## Fonctionnalités

- viewport SVG ;
- pan/zoom ;
- grille ;
- snap ;
- murs paramétriques ;
- sélection ;
- déplacement ;
- suppression ;
- Undo/Redo ;
- jonctions de murs.

## Critère de sortie

Dessiner proprement le contour d’une habitation simple et modifier ses dimensions.

---

# M3 — Architectural model

## Fonctionnalités

- portes ;
- fenêtres ;
- détection de pièces ;
- surfaces ;
- cotes ;
- annotations ;
- plusieurs niveaux ;
- premières coupes simplifiées.

## Critère de sortie

Produire un plan architectural lisible avec surfaces et ouvertures.

---

# M4 — Materials and assemblies

## Fonctionnalités

- catalogue matériaux ;
- matériaux utilisateur ;
- provenance ;
- assemblages multicouches ;
- hachures ;
- compositions de murs/planchers/toitures ;
- inspecteur de paroi.

## Critère de sortie

Une maison peut être entièrement renseignée en matériaux et compositions.

---

# M5 — Quantities / BOM

## Fonctionnalités

- surfaces nettes/brutes ;
- volumes ;
- longueurs ;
- masses ;
- regroupement par matériau ;
- marges ;
- export CSV.

## Critère de sortie

Produire une liste de matériaux cohérente depuis le plan.

---

# M6 — Thermal MVP

## Fonctionnalités

- R ;
- U ;
- surfaces d’échange ;
- pertes par transmission ;
- premières zones thermiques ;
- visualisation des pertes ;
- hypothèses clairement affichées.

## Critère de sortie

Modifier l’isolation d’une paroi met à jour les résultats thermiques et le métré.

---

# M7 — Water and rainwater

## Fonctionnalités

- équipements consommateurs ;
- réseau EF/ECS ;
- réseau eaux pluviales ;
- tuyaux paramétriques ;
- débits ;
- pertes de charge simples ;
- récupération toiture ;
- cuve.

## Critère de sortie

Tracer le réseau et dimensionner un cas résidentiel simple.

---

# M8 — Ventilation / indoor air

## Fonctionnalités

- bouches ;
- gaines ;
- débits par pièce ;
- réseaux soufflage/extraction ;
- pertes de charge ;
- ventilation résidentielle ;
- premières estimations CO₂/humidité.

## Critère de sortie

Une vue ventilation exploitable peut être calculée depuis les pièces.

---

# M9 — Electrical and lighting

## Fonctionnalités

- tableau ;
- circuits ;
- prises ;
- éclairage ;
- sections ;
- chutes de tension ;
- protections ;
- carte de lux simplifiée.

## Critère de sortie

Créer un plan électrique résidentiel et détecter les principales incohérences prises en charge.

---

# M10 — Heating / DHW / energy

## Fonctionnalités

- besoin chauffage ;
- systèmes de génération ;
- ECS ;
- consommations ;
- scénarios énergétiques.

## Critère de sortie

Comparer plusieurs solutions de chauffage sur le même bâtiment.

---

# M11 — Photovoltaic / storage

## Fonctionnalités

- pans de toiture ;
- orientation/inclinaison ;
- surface exploitable ;
- production estimée ;
- autoconsommation ;
- batterie ;
- flux énergétiques.

## Critère de sortie

Comparer plusieurs tailles de système PV/batterie.

---

# M12 — Acoustics / comfort

## Fonctionnalités

- absorption ;
- RT simplifié ;
- isolement par paroi ;
- modes de pièces simples ;
- cartes et alertes de confort.

---

# M13 — Cost and environmental analysis

## Fonctionnalités

- coûts matériaux ;
- coûts équipements ;
- scénarios ;
- données environnementales ;
- comparaison multicritère.

---

# M14 — Advanced drawings

## Fonctionnalités

- coupes avancées ;
- façades ;
- feuilles ;
- cartouches ;
- détails ;
- export DXF expérimental ;
- impression PDF robuste.

---

# M15 — Regulatory packs

Le moteur de règles existe avant ce milestone. Ce milestone concerne la profondeur de couverture.

Objectifs :

- rule packs France versionnés ;
- références explicites ;
- date d’application ;
- rapports de vérification ;
- niveau de confiance ;
- distinction entre aide à la conception et conformité réglementaire.

---

# M16 — Optimization

## Fonctionnalités

Comparer automatiquement des variantes sur :

- coût ;
- énergie ;
- carbone ;
- eau ;
- confort ;
- autonomie.

Le moteur ne doit modifier le projet principal qu’après validation utilisateur.

---

## Priorité MVP recommandée

Le premier MVP utile correspond à **M0 → M6**.

Il permet déjà :

- de dessiner une maison ;
- de définir ses matériaux ;
- d’obtenir une nomenclature ;
- de réaliser une première analyse thermique graphique.

C’est la première verticale réellement démontrable.
