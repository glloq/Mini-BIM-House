# 33 — Catalogue d'équipements

> **Paquet cible :** `packages/equipment-catalog`

## 1. Objectif

Créer un format extensible pour les équipements techniques :

- PAC ;
- chaudière ;
- radiateur ;
- ballon ECS ;
- VMC ;
- ventilateur ;
- pompe ;
- panneau PV ;
- onduleur ;
- batterie ;
- luminaire ;
- appareil sanitaire ;
- protection électrique ;
- capteur.

## 2. Base commune

```ts
interface EquipmentDefinition {
  id: string;
  kind: string;
  manufacturer?: string;
  model?: string;
  version?: string;
  dimensions?: EquipmentDimensions;
  ports?: EquipmentPortDefinition[];
  symbols?: EquipmentSymbolBinding[];
  properties: Record<string, unknown>;
  sources: PropertySource[];
}
```

## 3. Produit vs générique

```text
GENERIC
PRODUCT
CUSTOM
```

Comme les matériaux.

Un équipement générique peut servir à l'étude préliminaire.

Un produit peut porter des courbes fabricant.

## 4. Dimensions

```ts
interface EquipmentDimensions {
  widthMm?: number;
  depthMm?: number;
  heightMm?: number;
  clearance?: ClearanceEnvelope;
}
```

Les dégagements peuvent dépendre d'un Rule Pack.

## 5. Ports

```ts
interface EquipmentPortDefinition {
  id: string;
  discipline: string;
  role: string;
  position: Point3D;
  direction?: Vector3D;
  connectionType?: string;
  nominalSize?: number;
}
```

Ils servent au réseau générique.

## 6. Courbes de performance

Structure :

```ts
interface PerformanceCurve {
  id: string;
  inputAxes: PerformanceAxis[];
  output: string;
  points: PerformancePoint[];
  interpolation: "LINEAR" | "BILINEAR" | "TABLE" | "CUSTOM";
}
```

Exemples :

- PAC : température ext. × départ eau → COP/puissance ;
- ventilateur : débit → pression ;
- pompe : débit → HMT ;
- luminaire : photométrie ;
- batterie : SOC/température → limites.

## 7. Données inconnues

Ne pas extrapoler automatiquement hors du domaine d'une courbe sans méthode explicite.

Diagnostic :

```text
EQUIPMENT_PERFORMANCE_OUT_OF_RANGE
```

## 8. Liaison au dessin

Une instance :

```ts
interface EquipmentInstance {
  id: string;
  definitionId: string;
  position: Point3D;
  rotationDeg: number;
  spaceId?: string;
  overrides?: Record<string, unknown>;
}
```

L'instance ne duplique pas tout le catalogue.

## 9. Liaison coût/environnement

Références optionnelles :

```text
costEntryId
environmentalDeclarationId
```

## 10. Import

Formats initiaux :

- JSON interne ;
- CSV simple pour catalogues ;
- ajout manuel.

Imports fabricants/API futurs via adapters.

## 11. Versionnement

Un projet doit savoir quelle version de définition a été utilisée.

Un catalogue mis à jour ne doit pas modifier silencieusement un projet existant.

Options :

```text
PINNED_SNAPSHOT
CATALOG_REFERENCE
USER_OVERRIDE
```

## 12. Schéma JSON

Créer :

```text
schemas/equipment.schema.json
```

## 13. Tests

- définition générique ;
- instance ;
- port ;
- courbe ;
- domaine de courbe ;
- snapshot/version ;
- matériau/catalogue manquant.

## 14. Critère MVP

Pouvoir ajouter au plan une VMC, un ballon ECS et une PAC, connecter leurs ports aux réseaux et utiliser leurs propriétés dans les calculs.
