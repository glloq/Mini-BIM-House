# 22 — Modules ventilation et qualité d'air intérieur

> **Modules cibles :** `modules/ventilation`, `modules/iaq`

# Partie A — Ventilation

## 1. Objectif

Concevoir graphiquement un réseau de ventilation et calculer :

- débits cibles ;
- débits par branche ;
- diamètres/sections ;
- vitesses ;
- pertes de charge ;
- point de fonctionnement ;
- équilibrage ;
- récupération de chaleur.

## 2. Modèle réseau

```text
VentilationNetwork
├── terminals
├── junctions
├── ducts
├── dampers
├── filters
├── fans
├── heat-recovery
└── intake/exhaust
```

## 3. Terminaux

```ts
interface AirTerminal {
  roomId: string;
  role: 'SUPPLY' | 'EXTRACT' | 'TRANSFER';
  targetFlowM3h?: number;
  pressureDropPa?: number;
}
```

Le débit réglementaire cible vient d'un Rule Pack.

## 4. Gaine

```ts
interface DuctSegment {
  id: string;
  lengthM: number;
  shape: 'ROUND' | 'RECTANGULAR';
  diameterM?: number;
  widthM?: number;
  heightM?: number;
  roughnessM?: number;
  localLossCoefficient?: number;
}
```

## 5. Continuité

```text
v = Q / A
```

À chaque nœud :

```text
ΣQ_in = ΣQ_out
```

à tolérance numérique près.

## 6. Pertes de charge

Structure générique :

```text
Δp_total =
Δp_linear
+ Δp_local
+ Δp_terminal
+ Δp_filter
+ Δp_equipment
```

Les modèles de pertes restent interchangeables.

## 7. Dimensionnement automatique

Chercher une section catalogue respectant :

- débit ;
- limite de vitesse de la méthode ;
- perte de charge ;
- encombrement ;
- bruit si données disponibles.

## 8. Ventilateur

```ts
interface FanDefinition {
  curve?: Array<{ flowM3h: number; pressurePa: number }>;
  nominalPowerW?: number;
  efficiency?: number;
}
```

La sélection doit comparer réseau et courbe ventilateur lorsque disponible.

## 9. Récupération de chaleur

```text
η_HR
```

Le calcul thermique reçoit le débit et l'efficacité utile selon la méthode active.

Ne pas appliquer la récupération deux fois dans `thermal` et `ventilation`.

## 10. Équilibrage

Calculer :

- branche critique ;
- pertes par chemin ;
- besoin d'étranglement ;
- positions théoriques si un modèle de registre est disponible.

## 11. Graphique

Plan :

- soufflage ;
- extraction ;
- transfert ;
- diamètre ;
- débit ;
- sens ;
- vitesse.

Mode pression :

- pression cumulée ;
- branche critique ;
- pertes majeures.

## 12. Réglementation France

Le Rule Pack résidentiel français doit pouvoir exploiter l'arrêté du 24 mars 1982 relatif à l'aération des logements et ses versions applicables.

Le texte en vigueur prévoit notamment une circulation générale de l'air des pièces principales vers les pièces de service et des exigences de débits extraits.

Source officielle :

- https://www.legifrance.gouv.fr/loda/id/JORFTEXT000000862344

Ne pas recopier les tableaux dans le noyau métier.

---

# Partie B — Qualité d'air intérieur

## 13. CO₂ simplifié

Modèle de bilan massique :

```text
dC/dt =
(G / V)
+ (Q/V) × (C_out - C)
```

où :

- `G` : génération ;
- `V` : volume ;
- `Q` : débit de ventilation.

Le profil d'occupation alimente `G`.

## 14. Humidité

Prévoir un bilan simplifié :

- génération par occupants/usages ;
- extraction ;
- humidité extérieure ;
- volume.

Le moteur hygrothermique peut utiliser ces résultats.

## 15. Contaminants

Architecture extensible :

```text
CO2
HUMIDITY
VOC
PM2_5
RADON
CUSTOM
```

Le MVP ne calcule que les grandeurs pour lesquelles un modèle explicite existe.

## 16. Résultats IAQ

- concentration moyenne ;
- concentration max ;
- temps au-dessus de seuils configurés ;
- humidité ;
- débit requis selon objectif ;
- pièce critique.

Les seuils doivent indiquer leur source.

## 17. Tests ventilation

### VENT-001

Conservation des débits aux nœuds.

### VENT-002

À débit constant, réduction de section ⇒ vitesse supérieure.

### VENT-003

Longueur supplémentaire ⇒ pertes supplémentaires avec méthode cohérente.

### VENT-004

La branche critique est le chemin ayant la perte totale maximale pertinente.

## 18. Tests IAQ

### IAQ-001

Sans génération et avec `C=C_out`, concentration stable.

### IAQ-002

Avec génération positive et sans ventilation, concentration croissante.

### IAQ-003

Augmenter `Q` doit réduire la concentration d'équilibre dans le modèle simple.

## 19. Critères MVP

- réseau graphique ;
- débits ;
- sections ;
- pertes ;
- ventilateur simple ;
- vue débit/vitesse/pression ;
- Rule Pack France externe ;
- CO₂ simplifié par pièce.
