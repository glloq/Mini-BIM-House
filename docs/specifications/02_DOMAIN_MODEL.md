# 02 — Domain Model

> **Objectif :** définir les objets métier centraux et leurs relations.  
> **Principe :** le modèle de domaine est la source de vérité. L’interface, les dessins et les calculs sont des projections de ce modèle.

---

## 1. Principes

Le modèle doit être :

- sérialisable en JSON ;
- indépendant de React ;
- indépendant du SVG ;
- indépendant d’un module de calcul particulier ;
- versionné ;
- extensible ;
- validable.

Les identifiants sont stables et uniques **dans tout le projet**, et non
seulement dans la collection qui les porte. Ce contrat est vérifié à
l'import : la sélection sur le plan, les superpositions d'analyse, les cotes et
les chemins de scénario désignent un objet par son seul identifiant, si bien que
deux objets partageant le même rendraient un clic ambigu et un scénario
applicable à l'un comme à l'autre.

Sont concernés : niveaux, murs, ouvertures, dalles, pans de toiture, pièces,
annotations, zones, assemblages, matériaux, équipements, réseaux, nœuds, ports,
tronçons et scénarios.

```ts
export type EntityId = string;
```

Toutes les longueurs géométriques internes sont stockées dans une unité unique définie par le package `units`.

Recommandation :

- édition géométrique : millimètre ;
- calcul physique : unités SI ;
- conversion uniquement aux frontières des modules.

---

## 2. Project

```ts
interface Project {
  schemaVersion: string;
  id: EntityId;
  metadata: ProjectMetadata;

  site: Site;
  building: Building;

  materialLibrary: ProjectMaterialLibrary;
  assemblies: AssemblyDefinition[];
  equipment: EquipmentInstance[];
  systems: TechnicalSystem[];

  scenarios: Scenario[];
  drawingViews: DrawingViewDefinition[];

  calculationSettings: CalculationSettings;
  regulatoryContext: RegulatoryContext;
}
```

---

## 3. ProjectMetadata

```ts
interface ProjectMetadata {
  name: string;
  description?: string;
  author?: string;
  createdAt: string;
  updatedAt: string;
  projectRevision?: string;
  notes?: string;
}
```

---

## 4. Site

```ts
interface Site {
  location?: GeoLocation;
  altitudeM?: number;
  northAngleDeg: number;
  climateProfileId?: string;
  parcelBoundary?: Polygon2D;
  obstacles?: SiteObstacle[];
}
```

Le site sert notamment à :

- orientation ;
- solaire ;
- climat ;
- pluie ;
- vent ;
- implantation.

---

## 5. Building

```ts
interface Building {
  levels: Level[];
  zones: Zone[];
}
```

Les éléments architecturaux sont rattachés à un niveau mais peuvent être indexés globalement pour accélérer les recherches.

---

## 6. Level

```ts
interface Level {
  id: EntityId;
  name: string;
  elevationMm: number;
  defaultStoreyHeightMm: number;

  walls: Wall[];
  slabs: Slab[];
  roofs: Roof[];
  openings: Opening[];
  stairs: Stair[];
  spaces: Space[];
  annotations: Annotation[];
}
```

---

## 7. Wall

Un mur est défini par son axe géométrique et une référence d’assemblage.

```ts
interface Wall {
  id: EntityId;
  levelId: EntityId;

  path: Polyline2D;
  heightMm: number;
  baseOffsetMm: number;

  assemblyId: EntityId;
  referenceMode: WallReferenceMode;

  joinStart: WallJoinPolicy;
  joinEnd: WallJoinPolicy;

  tags?: string[];
  properties?: Record<string, unknown>;
}
```

`WallReferenceMode` :

- `CENTERLINE` ;
- `EXTERIOR_FACE` ;
- `INTERIOR_FACE` ;
- `CORE_CENTERLINE` ;
- `CORE_EXTERIOR` ;
- `CORE_INTERIOR`.

Ce choix est crucial pour préserver la géométrie lors d’un changement d’épaisseur.

---

## 8. Opening

```ts
interface Opening {
  id: EntityId;
  hostWallId: EntityId;

  type: 'DOOR' | 'WINDOW' | 'VOID';
  offsetAlongHostMm: number;
  widthMm: number;
  heightMm: number;
  sillHeightMm: number;

  catalogRef?: string;
  properties?: Record<string, unknown>;
}
```

L’ouverture reste attachée au mur lorsque celui-ci est déplacé ou redimensionné.

---

## 9. Slab

```ts
interface Slab {
  id: EntityId;
  levelId: EntityId;
  boundary: Polygon2D;
  assemblyId: EntityId;
  elevationOffsetMm: number;
}
```

---

## 10. Roof

Le premier modèle peut gérer :

- toiture plane ;
- pan simple ;
- toiture à plusieurs pans définis explicitement.

```ts
interface RoofFace {
  id: EntityId;
  boundary: Polygon2D;
  slopeDeg: number;
  azimuthDeg: number;
  assemblyId: EntityId;
  elevationMm: number;
}
```

Une modélisation automatique avancée des toitures peut venir plus tard.

---

## 11. Space

```ts
interface Space {
  id: EntityId;
  levelId: EntityId;
  name: string;
  type: SpaceType;

  boundary: Polygon2D;
  boundaryMode: 'AUTO' | 'MANUAL';

  clearHeightMm?: number;

  occupancyProfileId?: string;
  thermalZoneId?: EntityId;
  ventilationZoneId?: EntityId;
  acousticZoneId?: EntityId;

  targets?: SpaceTargets;
}
```

`SpaceTargets` peut contenir :

- température ;
- humidité ;
- lux ;
- ventilation ;
- bruit ;
- occupation.

---

## 12. Zone

Une zone regroupe des espaces pour un calcul métier.

```ts
interface Zone {
  id: EntityId;
  type: 'THERMAL' | 'VENTILATION' | 'ELECTRICAL' | 'ACOUSTIC' | 'CUSTOM';
  name: string;
  spaceIds: EntityId[];
  properties: Record<string, unknown>;
}
```

Un même espace peut appartenir à plusieurs types de zones.

---

## 13. MaterialDefinition

```ts
interface MaterialDefinition {
  id: EntityId;
  kind: 'GENERIC' | 'PRODUCT' | 'CUSTOM';

  identity: MaterialIdentity;
  physical?: PhysicalProperties;
  thermal?: ThermalProperties;
  hygrothermal?: HygrothermalProperties;
  acoustic?: AcousticProperties;
  fire?: FireProperties;
  environmental?: EnvironmentalProperties;
  economic?: EconomicProperties;
  appearance?: MaterialAppearance;

  provenance: PropertyProvenanceMap;
}
```

Aucune propriété technique ne doit être rendue obligatoire si le matériau peut malgré tout être utilisé dans un autre domaine.

---

## 14. Assemblies

Une paroi ne duplique pas ses matériaux.

```ts
interface AssemblyDefinition {
  id: EntityId;
  name: string;
  category: 'WALL' | 'ROOF' | 'SLAB' | 'CEILING' | 'PARTITION' | 'CUSTOM';

  layers: AssemblyLayer[];
  referenceLayerIndex?: number;
  tags?: string[];
}

interface AssemblyLayer {
  id: EntityId;
  materialId: EntityId;
  thicknessMm: number;
  role?: LayerRole;
  cavityFraction?: number;
}
```

`LayerRole` :

- finish ;
- structural ;
- insulation ;
- membrane ;
- service cavity ;
- air gap ;
- cladding ;
- other.

---

## 15. Technical systems

Tous les réseaux suivent une structure commune.

```ts
interface TechnicalSystem {
  id: EntityId;
  type: TechnicalSystemType;
  name: string;

  nodes: NetworkNode[];
  segments: NetworkSegment[];
  equipmentIds: EntityId[];

  properties: Record<string, unknown>;
}
```

`TechnicalSystemType` :

- cold water ;
- hot water ;
- wastewater ;
- rainwater ;
- heating ;
- ventilation supply ;
- ventilation exhaust ;
- electrical power ;
- lighting ;
- data ;
- photovoltaic DC ;
- photovoltaic AC ;
- custom.

---

## 16. NetworkNode

```ts
interface NetworkNode {
  id: EntityId;
  kind: string;
  position: Point3D;
  levelId?: EntityId;
  hostEntityId?: EntityId;
  ports: NetworkPort[];
  properties: Record<string, unknown>;
}
```

Un nœud peut représenter :

- appareil ;
- raccord ;
- bouche ;
- collecteur ;
- tableau ;
- boîte ;
- terminal.

---

## 17. NetworkSegment

```ts
interface NetworkSegment {
  id: EntityId;
  systemId: EntityId;

  fromPortId: EntityId;
  toPortId: EntityId;

  path: Polyline3D;

  size?: NetworkSize;
  materialId?: EntityId;
  properties: Record<string, unknown>;
}
```

Le tracé graphique et la topologie logique doivent rester cohérents.

---

## 18. Equipment

```ts
interface EquipmentInstance {
  id: EntityId;
  catalogId?: string;
  type: string;
  name: string;

  placement: EquipmentPlacement;
  ports: EquipmentPort[];

  ratedProperties: Record<string, QuantityValue>;
  customProperties: Record<string, unknown>;
}
```

Exemples :

- PAC ;
- ballon ECS ;
- radiateur ;
- VMC ;
- ventilateur ;
- pompe ;
- tableau électrique ;
- batterie ;
- onduleur ;
- panneau photovoltaïque ;
- luminaire.

---

## 19. DrawingViewDefinition

```ts
interface DrawingViewDefinition {
  id: EntityId;
  name: string;
  type: DrawingViewType;
  levelId?: EntityId;

  scale: number;
  visibilityProfileId: string;
  graphicProfileId: string;

  viewport?: BoundingBox2D;
  overrides?: GraphicOverride[];
}
```

Une vue ne modifie jamais la géométrie réelle.

---

## 20. Scenario

```ts
interface Scenario {
  id: EntityId;
  name: string;
  baseScenarioId?: EntityId;
  overrides: ScenarioOverride[];
}
```

Les scénarios servent à comparer des variantes sans dupliquer le projet.

---

## 21. Calculated properties

Les propriétés calculées ne doivent pas être stockées indistinctement dans les objets métier.

Utiliser un cache dérivé :

```ts
interface DerivedDataStore {
  geometry: Map<string, unknown>;
  quantities: Map<string, unknown>;
  calculations: Map<string, CalculationResult>;
}
```

Exemples de données dérivées :

- surface mur ;
- surface nette ;
- volume pièce ;
- R d’assemblage ;
- U ;
- débit ;
- chute de tension.

---

## 22. Validation

Trois niveaux :

### Schema validation

Le JSON respecte le schéma attendu.

### Domain validation

Exemple :

- épaisseur > 0 ;
- mur rattaché à un niveau existant ;
- matériau référencé existant.

### Cross-domain validation

Exemple :

- réseau ventilation connecté ;
- ouverture contenue dans le mur ;
- panneau PV réellement positionné sur une surface compatible.

---

## 23. Suppression et références

Toute suppression d’objet référencé doit passer par une politique explicite :

- interdire ;
- remplacer ;
- supprimer les dépendances ;
- convertir en référence manquante avec avertissement.

Ne jamais laisser silencieusement un identifiant orphelin.

---

## 24. Événements métier

Prévoir une couche d’événements internes :

```text
WallGeometryChanged
AssemblyChanged
MaterialPropertyChanged
SpaceBoundaryChanged
NetworkTopologyChanged
EquipmentChanged
```

Ces événements alimentent l’invalidation du cache et le recalcul des modules concernés.

---

## 25. Identité et duplication

Lors de la duplication :

- générer de nouveaux `EntityId` ;
- conserver les références de catalogue ;
- réécrire toutes les références internes nécessaires.

---

## 26. Extensions

Prévoir un champ d’extension contrôlé :

```ts
extensions?: Record<string, unknown>;
```

Il permet à un module d’ajouter temporairement des données sans casser le schéma central.

Les données importantes et stabilisées doivent ensuite migrer vers un type explicite.

---

## 27. Règle fondamentale

Aucun module ne doit définir sa propre version d’un mur, d’une pièce, d’un matériau ou d’un équipement si l’entité existe déjà dans le domaine central.

Le domaine central décrit **ce qui existe** ; les modules décrivent **ce qu’on en déduit**.
