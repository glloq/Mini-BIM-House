# 25 — Module acoustique

> **Module cible :** `modules/acoustics`  
> **Objectif :** fournir une première analyse acoustique directement liée aux matériaux, pièces et parois.

## 1. Sous-domaines

```text
ROOM_ACOUSTICS
AIRBORNE_INSULATION
IMPACT_INSULATION
FACADE_INSULATION
EQUIPMENT_NOISE
```

Le MVP commence par `ROOM_ACOUSTICS`.

## 2. Absorption

Par surface :

```ts
interface AcousticSurface {
  surfaceId: string;
  areaM2: number;
  absorptionCoefficientByBand?: Record<string, number>;
}
```

Surface d'absorption équivalente :

```text
A_eq = Σ(α_i × S_i)
```

## 3. Temps de réverbération

Pour un mode simplifié de type Sabine :

```text
T ≈ K × V / A_eq
```

La constante dépend du système d'unités/méthode.

Le résultat doit indiquer :

- méthode ;
- bande ou valeur globale ;
- hypothèses.

## 4. Bandes de fréquence

Architecture prévue :

```text
125
250
500
1000
2000
4000 Hz
```

Le MVP peut commencer par une valeur simplifiée, mais le modèle de données doit permettre les bandes.

## 5. Matériaux

Le catalogue matériau peut contenir :

- coefficient d'absorption ;
- indice d'affaiblissement ;
- données par bande ;
- source.

Aucune donnée manquante ne doit être remplacée par un « matériau typique » sans action utilisateur.

## 6. Vue pièce

Afficher :

- volume ;
- surfaces ;
- absorption ;
- RT estimé ;
- surfaces dominantes ;
- variantes de traitement.

## 7. Optimisation

Exemple :

```text
Objectif RT
   ↓
surface absorbante supplémentaire requise
   ↓
solutions compatibles
```

Le module peut comparer plusieurs matériaux absorbants.

## 8. Isolation entre pièces

Phase suivante :

```text
source room
  → separating elements
  → flanking paths
  → receiving room
```

Le modèle bâtiment doit conserver les adjacences nécessaires.

## 9. Façades

Prévoir l'analyse :

- parois opaques ;
- fenêtres ;
- entrées d'air ;
- ouvertures ;
- bruit extérieur.

## 10. Références

- ISO 3382-2:2008 — mesure du temps de réverbération dans les locaux ordinaires ;
- ISO 12354-1:2017 — estimation de l'isolement aérien entre locaux ;
- ISO 12354-2:2017 — bruits de choc ;
- ISO 12354-3:2017 — façades.

Sources officielles :

- https://www.iso.org/standard/36201.html
- https://www.iso.org/standard/70242.html
- https://www.iso.org/standard/70243.html
- https://www.iso.org/standard/70244.html

Les calculs prédictifs doivent respecter les domaines d'application des méthodes choisies.

## 11. Tests

### ACO-001
`A_eq = ΣαS`.

### ACO-002
À volume constant, augmenter l'absorption réduit le RT dans le modèle Sabine.

### ACO-003
Une donnée par bande absente reste inconnue.

### ACO-004
Le résultat indique toujours la méthode.

## 12. MVP

- absorption par surface ;
- RT simplifié ;
- vue par pièce ;
- comparaison de traitements ;
- catalogue acoustique extensible.
