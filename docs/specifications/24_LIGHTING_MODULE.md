# 24 — Module éclairage

> **Module cible :** `modules/lighting`

## 1. Objectif

Relier les luminaires à la géométrie des pièces pour calculer et visualiser :

- flux installé ;
- éclairement moyen ;
- densité de puissance ;
- implantation ;
- carte d'éclairement simplifiée puis détaillée.

## 2. Luminaire

```ts
interface LuminaireDefinition {
  manufacturer?: string;
  model?: string;
  luminousFluxLm: number;
  electricalPowerW: number;
  distribution?: PhotometricDistribution;
  colorTemperatureK?: number;
  cri?: number;
  source: PropertySource;
}
```

## 3. MVP — méthode lumen

Forme conceptuelle :

```text
E_avg =
(N × Φ × UF × MF) / A
```

où :

- `N` : nombre de luminaires ;
- `Φ` : flux par luminaire ;
- `UF` : facteur d'utilisation ;
- `MF` : facteur de maintenance ;
- `A` : surface.

Le moteur doit identifier les facteurs utilisés.

## 4. Données pièce

- dimensions ;
- hauteur plan utile ;
- réflectances si méthode utilisée ;
- type d'usage ;
- cible d'éclairement venant d'un profil/référentiel.

## 5. Implantation

Modes :

```text
GRID
ROWS
MANUAL
OPTIMIZED
```

Le solveur peut chercher le nombre minimal atteignant une cible avec contraintes d'espacement.

## 6. Carte de lux

Niveau futur :

- distribution photométrique ;
- position XYZ ;
- orientation ;
- contributions superposées.

Chaque point de grille reçoit :

```text
E_total = ΣE_luminaire
```

## 7. Lumière naturelle

Sous-module futur :

- fenêtres ;
- orientation ;
- ciel ;
- masques ;
- contribution daylight.

Il reste séparé de la méthode lumen électrique.

## 8. Vue graphique

Plan :

- symbole luminaire ;
- zone couverte ;
- valeur calculée ;
- carte de lux ;
- iso-lux éventuellement.

## 9. Résultats

- lux moyen ;
- lux min/max si carte ;
- uniformité si calculable ;
- puissance installée ;
- W/m² ;
- consommation via profils horaires.

## 10. Électricité

Chaque luminaire crée/alimente une charge électrique.

```text
lighting → electrical → energy-balance
```

## 11. Références

La référence ISO/CIE actuelle identifiée pour l'éclairage des lieux de travail intérieurs est :

- ISO/CIE 8995-1:2025.

Source officielle :

- https://www.iso.org/standard/76342.html

Pour l'habitation, les cibles doivent être définies par profils métier et référentiels pertinents, sans appliquer automatiquement une norme de lieu de travail à toutes les pièces.

## 12. Tests

### LIGHT-001
Doubler `N` double `E_avg` dans la méthode lumen.

### LIGHT-002
Doubler `A` divise `E_avg` par deux à paramètres constants.

### LIGHT-003
`MF` ou `UF` hors domaine autorisé ⇒ erreur.

### LIGHT-004
La puissance totale = somme des puissances luminaires.

## 13. MVP

- catalogue luminaires ;
- placement ;
- méthode lumen ;
- lux moyen ;
- proposition de quantité ;
- vue graphique ;
- intégration électrique.
