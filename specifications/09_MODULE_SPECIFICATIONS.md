# 09 — Module Specifications

> **Objectif :** définir le périmètre et les dépendances des modules fonctionnels.

## 1. Convention

Chaque module possède :

```text
README métier
inputs
outputs
dependencies
calculations
rules
views
tests
references
```

## 2. Architecture

```text
modules/<module>/
├── src/
│   ├── domain/
│   ├── calculations/
│   ├── adapters/
│   ├── views/
│   └── index.ts
├── tests/
├── references/
└── README.md
```

## 3. `architecture`

Entrées : modèle bâtiment.

Sorties :

- surfaces ;
- volumes ;
- orientations ;
- enveloppe ;
- relations pièce/paroi.

Dépendance : geometry.

## 4. `quantities`

Sorties :

- matériaux ;
- longueurs ;
- volumes ;
- masses ;
- nombres d’éléments.

Dépendances : architecture, materials, assemblies.

## 5. `thermal`

MVP :

- R des couches ;
- R d’assemblage ;
- U ;
- déperditions par transmission ;
- synthèse par pièce/zone.

Plus tard :

- ponts thermiques ;
- dynamique ;
- confort d’été détaillé.

## 6. `hygrothermal`

MVP avancé :

- diffusion vapeur simplifiée ;
- risque de condensation ;
- températures interstitielles.

Ne pas prétendre à une simulation dynamique complexe sans moteur adapté.

## 7. `heating`

- charge de chauffage ;
- puissance par pièce ;
- émetteurs ;
- génération ;
- température de régime ;
- énergie estimée.

## 8. `dhw`

- consommation ECS ;
- énergie ;
- stockage ;
- puissance de chauffe ;
- pertes.

## 9. `water`

- points de puisage ;
- débits ;
- simultanéité ;
- diamètres ;
- vitesse ;
- pertes de charge ;
- pression disponible.

## 10. `rainwater`

- surfaces collectées ;
- pluviométrie ;
- rendement ;
- stockage ;
- consommation ;
- autonomie ;
- trop-plein ;
- appoint.

## 11. `wastewater`

- appareils ;
- réseau ;
- pentes ;
- diamètre ;
- ventilation du réseau ;
- points de raccordement.

## 12. `ventilation`

- pièces ;
- débits cibles ;
- bouches ;
- gaines ;
- sections ;
- vitesse ;
- pertes de charge ;
- ventilateur ;
- équilibrage.

## 13. `iaq`

- occupation ;
- génération CO₂ ;
- renouvellement ;
- humidité ;
- indicateurs de qualité d’air.

## 14. `electrical`

- équipements ;
- circuits ;
- puissance ;
- intensité ;
- sections ;
- chute de tension ;
- protections ;
- tableau.

Les contrôles réglementaires restent dans les Rule Packs.

## 15. `lighting`

MVP : méthode lumen simplifiée.

Entrées :

- pièce ;
- hauteur ;
- luminaire ;
- flux ;
- facteur d’utilisation/pertes.

Sorties : lux moyen, nombre de luminaires.

Plus tard : carte de lux géométrique.

## 16. `photovoltaic`

- faces de toiture ;
- obstacles ;
- modules ;
- orientation ;
- inclinaison ;
- puissance ;
- productible ;
- strings ;
- onduleur.

## 17. `battery`

- capacité ;
- puissance ;
- SOC ;
- rendement ;
- autonomie ;
- cycles simplifiés.

## 18. `energy-balance`

Agrège :

- chauffage ;
- ECS ;
- ventilation ;
- éclairage ;
- équipements ;
- PV ;
- batterie.

Produit la vision énergétique globale.

## 19. `acoustics`

MVP :

- volume pièce ;
- surfaces absorbantes ;
- RT estimé ;
- comparaison de variantes.

Plus tard : isolation entre locaux, bandes de fréquence, bruit équipements.

## 20. `cost`

- prix matériaux ;
- conditionnement ;
- équipements ;
- marges ;
- lots ;
- comparaison scénarios.

## 21. `environmental`

- quantités ;
- FDES/PEP/EPD disponibles ;
- unité fonctionnelle ;
- agrégation ;
- comparaison.

Ne pas appeler le résultat « RE2020 réglementaire » sans méthode complète.

## 22. `compliance`

Ce module ne contient pas les règles : il exécute `rule-engine` et agrège les résultats par domaine.

## 23. Matrice de dépendances

```text
architecture ─────────────┐
materials ──┐             │
assemblies ─┼→ quantities │
            └→ thermal ─→ heating ─┐
                                   ├→ energy-balance ← photovoltaic ← battery
water ─→ dhw ──────────────────────┘
rooms ─→ ventilation ─→ iaq
rooms ─→ lighting
rooms/materials ─→ acoustics
quantities/materials ─→ cost
quantities/materials ─→ environmental
```

## 24. Règle de modularité

Un module doit pouvoir être désactivé sans empêcher l’ouverture du projet.

Un projet peut contenir des données d’un module non chargé ; elles doivent être conservées lors d’une sauvegarde si le format le permet.
