# 16 — Module hygrothermique

> **Module cible :** `modules/hygrothermal`  
> **Niveau initial :** `ENGINEERING` simplifié  
> **Objectif :** analyser condensation superficielle et interstitielle avec une méthode explicitement identifiée.

## 1. Principe

Le logiciel doit distinguer :

```text
méthode simplifiée stationnaire/mensuelle
≠
simulation dynamique hygrothermique
```

Une absence de condensation détectée avec une méthode simplifiée n'est pas une garantie générale d'absence de risque.

## 2. Dépendances

```text
materials
assemblies
thermal
climate
rooms
  │
  ▼
hygrothermal
```

## 3. Propriétés matériaux

```ts
interface HygrothermalMaterialProperties {
  mu?: number;
  sdM?: number;
  vaporPermeability?: number;
  source: PropertySource;
}
```

Pour une couche :

```text
Sd = μ × d
```

Si `Sd` est documenté directement, il peut être utilisé.

## 4. Conditions

Entrées :

- température intérieure ;
- humidité relative intérieure ;
- température extérieure ;
- humidité relative extérieure.

Préférer des séries mensuelles.

## 5. Pression vapeur

```text
p_v = RH × p_sat(T)
```

La fonction `p_sat(T)` doit exister dans un seul composant scientifique testé.

## 6. Profil de température

À partir des résistances thermiques cumulées :

- température à chaque interface ;
- prise en compte des résistances superficielles selon méthode.

```ts
interface HygrothermalInterfaceState {
  interfaceIndex: number;
  temperatureC: number;
  vaporPressurePa: number;
  saturationPressurePa: number;
  relativeHumidity: number;
}
```

## 7. Diffusion vapeur

Le profil de pression vapeur est calculé selon les résistances à la diffusion cumulées.

Comparer à chaque interface :

```text
p_v
p_sat(T)
```

## 8. Condensation interstitielle

Indicateur de base :

```text
p_v > p_sat(T)
```

Le résultat doit préciser :

- interface ;
- période ;
- niveau de risque ;
- quantité estimée si la méthode le permet ;
- séchage éventuel ;
- limites de la méthode.

## 9. Risque superficiel

Entrées :

- température de surface intérieure ;
- température intérieure ;
- humidité intérieure.

Sorties possibles :

```text
LOW_RISK
WATCH
HIGH_RISK
UNKNOWN
METHOD_NOT_APPLICABLE
```

## 10. Limites d'applicabilité

Avertissement obligatoire pour :

- matériaux fortement hygroscopiques ;
- transferts liquides ;
- parois enterrées ;
- infiltrations d'eau ;
- toitures complexes ;
- parois ventilées ;
- séchage de chantier ;
- cas nécessitant une simulation dynamique.

## 11. Vue graphique

Coupe de paroi :

- courbe température ;
- courbe pression vapeur ;
- courbe pression de saturation ;
- limites de couches.

Vue plan :

- faible risque ;
- surveillance ;
- risque ;
- données insuffisantes.

La couleur doit être accompagnée d'une icône/valeur.

## 12. Interaction matériaux

Si `μ` / `Sd` manque :

```text
calcul thermique possible
calcul hygrothermique incomplet
```

L'utilisateur peut compléter la donnée ou conserver l'état inconnu.

## 13. Variantes pédagogiques

Permettre de déplacer :

- pare-vapeur ;
- frein-vapeur ;
- isolant ;
- lame d'air.

Les graphes se recalculent immédiatement.

## 14. Sortie

```ts
interface HygrothermalResult {
  methodId: string;
  applicability: 'VALID' | 'LIMITED' | 'NOT_APPLICABLE';
  assemblies: HygrothermalAssemblyResult[];
  warnings: CalculationWarning[];
  assumptions: CalculationAssumption[];
  references: CalculationReference[];
}
```

## 15. Tests

### HYG-001

`Sd = μ × d`.

### HYG-002

`RH = 0` ⇒ `p_v = 0`.

### HYG-003

`RH = 1` ⇒ `p_v = p_sat`.

### HYG-004

Changer l'ordre des couches modifie le profil sans modifier la somme de `Sd`.

### HYG-005

Absence de propriété vapeur ⇒ `METHOD_NOT_APPLICABLE`.

### HYG-006

Cas documentaire comparé à une implémentation indépendante.

## 16. Référence principale

- ISO 13788:2012 — température superficielle critique et condensation interstitielle.

Source officielle :

- https://www.iso.org/standard/51615.html

Une simulation dynamique future doit être spécifiée comme moteur distinct.
