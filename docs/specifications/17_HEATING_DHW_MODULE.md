# 17 — Modules chauffage et ECS

> **Modules cibles :** `modules/heating`, `modules/dhw`

## Partie A — Chauffage

## 1. Dépendances

```text
thermal
ventilation
rooms
climate
equipment
   │
   ▼
heating
```

## 2. Grandeurs à ne jamais confondre

```text
charge thermique        W
énergie utile           kWh
puissance générateur    W
énergie consommée       kWh
puissance électrique    W
```

## 3. Charge de chauffage

Structure :

```text
Φ_design =
  Φ_transmission
+ Φ_ventilation
+ Φ_other
```

Chaque terme reste accessible séparément.

## 4. Terme air simplifié

Lorsque la méthode active l'autorise :

```text
Φ_air = ρ_air × c_p_air × q_v × ΔT
```

Les constantes viennent d'un service commun.

## 5. Résultat par pièce

```ts
interface RoomHeatingLoad {
  roomId: string;
  transmissionW: number;
  ventilationW: number;
  otherW: number;
  totalW: number;
  wattsPerM2?: number;
}
```

## 6. Émetteurs

Types initiaux :

```text
radiator
underfloor
fan-coil
air-heating
stove
other
```

Données :

- puissance nominale ;
- régime ;
- pièce ;
- modèle fabricant ;
- contrôle.

## 7. Régime hydraulique

```text
T_flow
T_return
T_room
```

La puissance d'un émetteur ne doit pas rester fixe lorsque le régime change si une loi fabricant est disponible.

## 8. Générateurs

```ts
interface HeatGenerator {
  type:
    | "heat-pump"
    | "boiler"
    | "electric"
    | "wood"
    | "district"
    | "other";
  nominalThermalPowerW: number;
  performanceModelId: string;
}
```

## 9. Pompe à chaleur

Séparer :

- COP ponctuel ;
- performance saisonnière ;
- puissance thermique disponible ;
- température extérieure ;
- température de départ.

Mode simple :

```text
E_electric ≈ Q_heat / COP_assumed
```

uniquement en `ESTIMATE`.

## 10. Ratio de puissance

```text
oversizingRatio =
generatorNominalPower / designHeatLoad
```

Le ratio est un indicateur ; les seuils viennent de méthodes/règles explicites.

## 11. Vue chauffage

Plan :

- besoin par pièce ;
- émetteurs ;
- circuits ;
- température aller/retour ;
- alertes.

Exemple :

```text
Salon      1.80 kW requis     2.00 kW installé
Cuisine    0.65 kW requis     0.80 kW installé
Chambre    0.52 kW requis     0.50 kW installé  WARNING
```

---

# Partie B — Eau chaude sanitaire

## 12. Entrées ECS

- occupants ;
- profil d'usage ;
- volume journalier ;
- température eau froide ;
- température stockage ;
- température usage ;
- pertes ballon ;
- générateur.

## 13. Énergie sensible

```text
Q = m × c_p × ΔT
```

Toutes les hypothèses sont enregistrées.

## 14. Mélange

Le module convertit :

```text
volume à température d'usage
↔
volume équivalent stocké à température supérieure
```

par bilan énergétique.

## 15. Temps de chauffe

Idéal :

```text
t = Q / P
```

Réaliste :

```text
t = Q / P_useful
```

## 16. Ballon

```ts
interface DwhTank {
  volumeL: number;
  setpointC: number;
  standbyLossW?: number;
  lossKWhPer24h?: number;
}
```

Les données constructeur priment lorsqu'elles sont disponibles.

## 17. Chaîne de calcul

```text
DHW demand
   ↓
generator
   ↓
energy-balance
```

## 18. Sorties

```ts
interface HeatingResult {
  designLoadW: number;
  roomLoads: RoomHeatingLoad[];
  installedEmittersW: number;
  generatorAssessment: GeneratorAssessment[];
}

interface DwhResult {
  dailyUsefulEnergyKWh: number;
  annualUsefulEnergyKWh?: number;
  requiredStorageL?: number;
  reheatingTimeH?: number;
}
```

## 19. Tests chauffage

### HEAT-001
`H = 100 W/K`, `ΔT = 20 K` ⇒ `Φ = 2000 W`.

### HEAT-002
Somme des pièces = bâtiment à tolérance près.

### HEAT-003
La récupération de chaleur n'affecte que le terme auquel elle s'applique.

## 20. Tests ECS

### DHW-001
Vérifier `Q = m × cp × ΔT`.

### DHW-002
Puissance utile doublée ⇒ temps idéal divisé par deux.

### DHW-003
Vérifier le bilan de mélange.

## 21. Références candidates

- ISO 52016-1 ;
- EN 12831-1 pour charges de chauffage ;
- règles françaises dans des Rule Packs ;
- données fabricant pour performances.

Le statut `REGULATORY` exige une validation spécifique.
