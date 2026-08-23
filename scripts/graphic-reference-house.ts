/**
 * Builds the house the drawing engine is judged against.
 *
 * The main fixture is a rectangle of ten metres by eight with four rooms: it
 * proves a plan can be produced and says nothing about whether the plan is
 * readable. A graphic engine is judged on the things a rectangle has none of —
 * three bedrooms told apart at a glance, a corridor whose name fits in it, a
 * cupboard whose name does not, doors that open somewhere in particular, a bay
 * and a garage door that are not the same drawing as a casement, wet rooms
 * with something in them, and eleven wall junctions of five different kinds.
 *
 * It is a fixture and not a design: nobody has to want to live here. What it
 * has to be is a plan that shows what the charter is supposed to do.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { isHostType } from '@house-technical-designer/core-domain';
import { equipmentSnapshot } from '@house-technical-designer/equipment-catalog/snapshot';
import {
  projectOpeningFromCatalog,
  rawGenericOpeningEntries,
} from '@house-technical-designer/opening-catalog';
import {
  family,
  familyCapabilities,
  genericCatalog,
} from '../packages/catalog-registry/src/registry.js';

const BASE = 'examples/reference-house/reference.houseproj.json';
const FILE = 'examples/graphic-reference-house/reference.houseproj.json';

const EXTERIOR = 'generic-wall-block-external-insulation';
const PARTITION = 'generic-partition-stud';
/** Half the thickness of each build-up, in millimetres. */
const EXT = 176.5;
const PAR = 35.5;
const STOREY_MM = 2600;

interface Point {
  readonly x: number;
  readonly y: number;
}

const WALLS: readonly {
  readonly id: string;
  readonly from: Point;
  readonly to: Point;
  readonly assemblyId: string;
  readonly role: 'EXTERIOR' | 'INTERIOR' | 'PARTITION';
}[] = [
  {
    id: 'wall-south',
    from: { x: 0, y: 0 },
    to: { x: 13000, y: 0 },
    assemblyId: EXTERIOR,
    role: 'EXTERIOR',
  },
  {
    id: 'wall-east',
    from: { x: 13000, y: 0 },
    to: { x: 13000, y: 10000 },
    assemblyId: EXTERIOR,
    role: 'EXTERIOR',
  },
  {
    id: 'wall-north',
    from: { x: 13000, y: 10000 },
    to: { x: 0, y: 10000 },
    assemblyId: EXTERIOR,
    role: 'EXTERIOR',
  },
  {
    id: 'wall-west',
    from: { x: 0, y: 10000 },
    to: { x: 0, y: 0 },
    assemblyId: EXTERIOR,
    role: 'EXTERIOR',
  },
  {
    id: 'wall-garage',
    from: { x: 10000, y: 0 },
    to: { x: 10000, y: 10000 },
    assemblyId: PARTITION,
    role: 'INTERIOR',
  },
  {
    id: 'wall-corridor-south',
    from: { x: 0, y: 4600 },
    to: { x: 10000, y: 4600 },
    assemblyId: PARTITION,
    role: 'INTERIOR',
  },
  {
    id: 'wall-corridor-north',
    from: { x: 0, y: 5800 },
    to: { x: 10000, y: 5800 },
    assemblyId: PARTITION,
    role: 'INTERIOR',
  },
  {
    id: 'wall-living-east',
    from: { x: 6000, y: 0 },
    to: { x: 6000, y: 4600 },
    assemblyId: PARTITION,
    role: 'INTERIOR',
  },
  {
    id: 'wall-hall-east',
    from: { x: 7000, y: 0 },
    to: { x: 7000, y: 4600 },
    assemblyId: PARTITION,
    role: 'INTERIOR',
  },
  {
    id: 'wall-office-west',
    from: { x: 8400, y: 0 },
    to: { x: 8400, y: 4600 },
    assemblyId: PARTITION,
    role: 'INTERIOR',
  },
  {
    id: 'wall-bed-1-2',
    from: { x: 3000, y: 5800 },
    to: { x: 3000, y: 10000 },
    assemblyId: PARTITION,
    role: 'PARTITION',
  },
  {
    id: 'wall-bed-2-3',
    from: { x: 6000, y: 5800 },
    to: { x: 6000, y: 10000 },
    assemblyId: PARTITION,
    role: 'PARTITION',
  },
  {
    id: 'wall-bed-3-bath',
    from: { x: 8000, y: 5800 },
    to: { x: 8000, y: 10000 },
    assemblyId: PARTITION,
    role: 'PARTITION',
  },
  {
    id: 'wall-wc-cellier',
    from: { x: 7000, y: 1500 },
    to: { x: 8400, y: 1500 },
    assemblyId: PARTITION,
    role: 'PARTITION',
  },
];

interface OpeningSpec {
  readonly id: string;
  readonly host: string;
  readonly openingType: 'DOOR' | 'WINDOW';
  readonly offsetAlongHostMm: number;
  readonly widthMm: number;
  readonly heightMm: number;
  readonly sillHeightMm: number;
  readonly definitionId: string;
  readonly swing?: {
    readonly hinge: 'START' | 'END';
    readonly opensTo: 'LEFT_OF_HOST' | 'RIGHT_OF_HOST';
  };
}

const DOOR = 'generic-internal-door';
const OPENINGS: readonly OpeningSpec[] = [
  // Sud : la baie du séjour, la porte-fenêtre, l'entrée, le bureau, le garage.
  {
    id: 'opening-bay-living',
    host: 'wall-south',
    openingType: 'WINDOW',
    offsetAlongHostMm: 1200,
    widthMm: 2400,
    heightMm: 2200,
    sillHeightMm: 0,
    definitionId: 'generic-window-bay-triple',
  },
  {
    id: 'opening-french-door',
    host: 'wall-south',
    openingType: 'DOOR',
    offsetAlongHostMm: 4200,
    widthMm: 1600,
    heightMm: 2150,
    sillHeightMm: 0,
    definitionId: 'generic-french-door-double',
  },
  {
    id: 'opening-entry',
    host: 'wall-south',
    openingType: 'DOOR',
    offsetAlongHostMm: 6050,
    widthMm: 830,
    heightMm: 2100,
    sillHeightMm: 0,
    definitionId: 'generic-entrance-door',
    swing: { hinge: 'START', opensTo: 'LEFT_OF_HOST' },
  },
  {
    id: 'opening-window-office',
    host: 'wall-south',
    openingType: 'WINDOW',
    offsetAlongHostMm: 8700,
    widthMm: 1200,
    heightMm: 1300,
    sillHeightMm: 900,
    definitionId: 'generic-window-casement-double',
  },
  {
    id: 'opening-garage-door',
    host: 'wall-south',
    openingType: 'DOOR',
    offsetAlongHostMm: 10400,
    widthMm: 2400,
    heightMm: 2100,
    sillHeightMm: 0,
    definitionId: 'generic-garage-door-sectional',
  },
  // Ouest : le séjour et la chambre 1.
  {
    id: 'opening-window-living-west',
    host: 'wall-west',
    openingType: 'WINDOW',
    offsetAlongHostMm: 6500,
    widthMm: 1400,
    heightMm: 1300,
    sillHeightMm: 900,
    definitionId: 'generic-window-casement-double',
  },
  {
    id: 'opening-window-bed-1-west',
    host: 'wall-west',
    openingType: 'WINDOW',
    offsetAlongHostMm: 400,
    widthMm: 1200,
    heightMm: 1300,
    sillHeightMm: 900,
    definitionId: 'generic-window-tilt-turn-triple',
  },
  // Nord : les trois chambres, la salle de bains, le garage.
  {
    id: 'opening-window-bed-1',
    host: 'wall-north',
    openingType: 'WINDOW',
    offsetAlongHostMm: 10800,
    widthMm: 1200,
    heightMm: 1300,
    sillHeightMm: 900,
    definitionId: 'generic-window-tilt-turn-triple',
  },
  {
    id: 'opening-window-bed-2',
    host: 'wall-north',
    openingType: 'WINDOW',
    offsetAlongHostMm: 8000,
    widthMm: 1400,
    heightMm: 1300,
    sillHeightMm: 900,
    definitionId: 'generic-window-casement-double',
  },
  {
    id: 'opening-window-bed-3',
    host: 'wall-north',
    openingType: 'WINDOW',
    offsetAlongHostMm: 5900,
    widthMm: 1000,
    heightMm: 1300,
    sillHeightMm: 900,
    definitionId: 'generic-window-casement-double',
  },
  {
    id: 'opening-window-bath',
    host: 'wall-north',
    openingType: 'WINDOW',
    offsetAlongHostMm: 3800,
    widthMm: 800,
    heightMm: 800,
    sillHeightMm: 1400,
    definitionId: 'generic-window-fixed-double',
  },
  {
    id: 'opening-window-garage',
    host: 'wall-north',
    openingType: 'WINDOW',
    offsetAlongHostMm: 1500,
    widthMm: 1000,
    heightMm: 800,
    sillHeightMm: 1400,
    definitionId: 'generic-window-fixed-double',
  },
  // Les portes intérieures, chacune ouvrant quelque part en particulier.
  {
    id: 'door-living',
    host: 'wall-corridor-south',
    openingType: 'DOOR',
    offsetAlongHostMm: 1800,
    widthMm: 830,
    heightMm: 2040,
    sillHeightMm: 0,
    definitionId: DOOR,
    swing: { hinge: 'START', opensTo: 'RIGHT_OF_HOST' },
  },
  {
    id: 'door-hall',
    host: 'wall-corridor-south',
    openingType: 'DOOR',
    offsetAlongHostMm: 6100,
    widthMm: 830,
    heightMm: 2040,
    sillHeightMm: 0,
    definitionId: DOOR,
    swing: { hinge: 'END', opensTo: 'RIGHT_OF_HOST' },
  },
  {
    id: 'door-office',
    host: 'wall-corridor-south',
    openingType: 'DOOR',
    offsetAlongHostMm: 8800,
    widthMm: 830,
    heightMm: 2040,
    sillHeightMm: 0,
    definitionId: DOOR,
    swing: { hinge: 'START', opensTo: 'RIGHT_OF_HOST' },
  },
  {
    id: 'door-bed-1',
    host: 'wall-corridor-north',
    openingType: 'DOOR',
    offsetAlongHostMm: 1200,
    widthMm: 830,
    heightMm: 2040,
    sillHeightMm: 0,
    definitionId: DOOR,
    swing: { hinge: 'START', opensTo: 'LEFT_OF_HOST' },
  },
  {
    id: 'door-bed-2',
    host: 'wall-corridor-north',
    openingType: 'DOOR',
    offsetAlongHostMm: 4200,
    widthMm: 830,
    heightMm: 2040,
    sillHeightMm: 0,
    definitionId: DOOR,
    swing: { hinge: 'END', opensTo: 'LEFT_OF_HOST' },
  },
  {
    id: 'door-bed-3',
    host: 'wall-corridor-north',
    openingType: 'DOOR',
    offsetAlongHostMm: 6700,
    widthMm: 830,
    heightMm: 2040,
    sillHeightMm: 0,
    definitionId: DOOR,
    swing: { hinge: 'START', opensTo: 'LEFT_OF_HOST' },
  },
  {
    id: 'door-bath',
    host: 'wall-corridor-north',
    openingType: 'DOOR',
    offsetAlongHostMm: 8600,
    widthMm: 830,
    heightMm: 2040,
    sillHeightMm: 0,
    definitionId: DOOR,
    swing: { hinge: 'END', opensTo: 'LEFT_OF_HOST' },
  },
  {
    id: 'door-wc',
    host: 'wall-hall-east',
    openingType: 'DOOR',
    offsetAlongHostMm: 300,
    widthMm: 730,
    heightMm: 2040,
    sillHeightMm: 0,
    definitionId: DOOR,
    swing: { hinge: 'END', opensTo: 'RIGHT_OF_HOST' },
  },
  {
    id: 'door-cellier',
    host: 'wall-hall-east',
    openingType: 'DOOR',
    offsetAlongHostMm: 2400,
    widthMm: 730,
    heightMm: 2040,
    sillHeightMm: 0,
    definitionId: DOOR,
    swing: { hinge: 'START', opensTo: 'RIGHT_OF_HOST' },
  },
  // Et une coulissante, qui ne balaie rien.
  {
    id: 'door-garage-service',
    host: 'wall-garage',
    openingType: 'DOOR',
    offsetAlongHostMm: 4800,
    widthMm: 900,
    heightMm: 2040,
    sillHeightMm: 0,
    definitionId: 'generic-door-sliding',
  },
];

interface SpaceSpec {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly box: readonly [number, number, number, number];
}

const SPACES: readonly SpaceSpec[] = [
  {
    id: 'space-living',
    name: 'Séjour / cuisine',
    category: 'LIVING_KITCHEN',
    box: [EXT, EXT, 6000 - PAR, 4600 - PAR],
  },
  {
    id: 'space-hall',
    name: 'Entrée',
    category: 'HALL',
    box: [6000 + PAR, EXT, 7000 - PAR, 4600 - PAR],
  },
  {
    id: 'space-wc',
    name: 'WC',
    category: 'WC',
    box: [7000 + PAR, EXT, 8400 - PAR, 1500 - PAR],
  },
  {
    id: 'space-cellier',
    name: 'Cellier',
    category: 'STORAGE',
    box: [7000 + PAR, 1500 + PAR, 8400 - PAR, 4600 - PAR],
  },
  {
    id: 'space-office',
    name: 'Bureau',
    category: 'OFFICE',
    box: [8400 + PAR, EXT, 10000 - PAR, 4600 - PAR],
  },
  {
    id: 'space-corridor',
    name: 'Dégagement',
    category: 'CORRIDOR',
    box: [EXT, 4600 + PAR, 10000 - PAR, 5800 - PAR],
  },
  {
    id: 'space-bed-1',
    name: 'Chambre 1',
    category: 'BEDROOM',
    box: [EXT, 5800 + PAR, 3000 - PAR, 10000 - EXT],
  },
  {
    id: 'space-bed-2',
    name: 'Chambre 2',
    category: 'BEDROOM',
    box: [3000 + PAR, 5800 + PAR, 6000 - PAR, 10000 - EXT],
  },
  {
    id: 'space-bed-3',
    name: 'Chambre 3',
    category: 'BEDROOM',
    box: [6000 + PAR, 5800 + PAR, 8000 - PAR, 10000 - EXT],
  },
  {
    id: 'space-bath',
    name: 'Salle de bains',
    category: 'BATHROOM',
    box: [8000 + PAR, 5800 + PAR, 10000 - PAR, 10000 - EXT],
  },
  {
    id: 'space-garage',
    name: 'Garage',
    category: 'GARAGE',
    box: [10000 + PAR, EXT, 13000 - EXT, 10000 - EXT],
  },
];

interface ComponentSpec {
  readonly id: string;
  readonly category: string;
  readonly definitionId: string;
  readonly name: string;
  readonly at: Point;
  readonly rotationDeg?: number;
  readonly elevationMm?: number;
  readonly spaceId?: string;
}

const COMPONENTS: readonly ComponentSpec[] = [
  // Salle de bains : ce qui rend une pièce humide lisible comme telle.
  {
    id: 'fixture-bathtub',
    category: 'SANITARY',
    definitionId: 'generic-bathtub',
    name: 'Baignoire',
    at: { x: 8890, y: 9450 },
    spaceId: 'space-bath',
  },
  {
    id: 'fixture-basin-bath',
    category: 'SANITARY',
    definitionId: 'generic-washbasin',
    name: 'Lavabo',
    at: { x: 8330, y: 6100 },
    spaceId: 'space-bath',
  },
  {
    id: 'fixture-shower',
    category: 'SANITARY',
    definitionId: 'generic-walk-in-shower',
    name: 'Douche',
    at: { x: 9350, y: 7300 },
    spaceId: 'space-bath',
  },
  {
    id: 'emitter-towel-rail',
    category: 'HEATING',
    definitionId: 'generic-towel-radiator',
    name: 'Sèche-serviettes',
    at: { x: 8100, y: 8200 },
    rotationDeg: 90,
    spaceId: 'space-bath',
  },
  // WC.
  {
    id: 'fixture-wc',
    category: 'SANITARY',
    definitionId: 'generic-wc',
    name: 'WC',
    at: { x: 7420, y: 460 },
    rotationDeg: 90,
    spaceId: 'space-wc',
  },
  // Cuisine, dans le séjour.
  {
    id: 'fixture-sink',
    category: 'SANITARY',
    definitionId: 'generic-double-sink',
    name: 'Évier deux bacs',
    at: { x: 5100, y: 4260 },
    spaceId: 'space-living',
  },
  {
    id: 'appliance-hob',
    category: 'APPLIANCE',
    definitionId: 'generic-hob',
    name: 'Plaque de cuisson',
    at: { x: 4100, y: 4300 },
    spaceId: 'space-living',
  },
  {
    id: 'appliance-dishwasher',
    category: 'APPLIANCE',
    definitionId: 'generic-dishwasher',
    name: 'Lave-vaisselle',
    at: { x: 3400, y: 4260 },
    spaceId: 'space-living',
  },
  {
    id: 'heater-wood-stove',
    category: 'HEATING',
    definitionId: 'generic-wood-stove-8kw',
    name: 'Poêle à bois',
    at: { x: 800, y: 800 },
    spaceId: 'space-living',
  },
  // Cellier : la machinerie de la maison.
  {
    id: 'appliance-washing-machine',
    category: 'APPLIANCE',
    definitionId: 'generic-washing-machine',
    name: 'Lave-linge',
    at: { x: 7700, y: 1950 },
    spaceId: 'space-cellier',
  },
  {
    id: 'store-dhw-tank',
    category: 'SANITARY',
    definitionId: 'generic-dhw-tank',
    name: 'Ballon ECS',
    at: { x: 7700, y: 2600 },
    spaceId: 'space-cellier',
  },
  {
    id: 'unit-ventilation',
    category: 'VENTILATION',
    definitionId: 'generic-balanced-ventilation-unit',
    name: 'Centrale VMC',
    at: { x: 7700, y: 3650 },
    spaceId: 'space-cellier',
  },
  {
    id: 'board-main',
    category: 'ELECTRICAL',
    definitionId: 'generic-distribution-board',
    name: 'Tableau électrique',
    at: { x: 7700, y: 4400 },
    spaceId: 'space-cellier',
  },
  // Les émetteurs, sous les fenêtres.
  {
    id: 'emitter-living',
    category: 'HEATING',
    definitionId: 'generic-radiator',
    name: 'Radiateur séjour',
    at: { x: 300, y: 2800 },
    rotationDeg: 90,
    spaceId: 'space-living',
  },
  {
    id: 'emitter-bed-1',
    category: 'HEATING',
    definitionId: 'generic-radiator',
    name: 'Radiateur chambre 1',
    at: { x: 1600, y: 9700 },
    spaceId: 'space-bed-1',
  },
  {
    id: 'emitter-bed-2',
    category: 'HEATING',
    definitionId: 'generic-radiator',
    name: 'Radiateur chambre 2',
    at: { x: 4300, y: 9700 },
    spaceId: 'space-bed-2',
  },
  {
    id: 'emitter-bed-3',
    category: 'HEATING',
    definitionId: 'generic-radiator',
    name: 'Radiateur chambre 3',
    at: { x: 6600, y: 9700 },
    spaceId: 'space-bed-3',
  },
  {
    id: 'emitter-office',
    category: 'HEATING',
    definitionId: 'generic-radiator',
    name: 'Radiateur bureau',
    at: { x: 9200, y: 400 },
    spaceId: 'space-office',
  },
];

const EQUIPMENT_HELD = [
  ...new Set(COMPONENTS.map(({ definitionId }) => definitionId)),
];
const OPENINGS_HELD = [
  ...new Set(OPENINGS.map(({ definitionId }) => definitionId)),
];

const catalogue = new Map(genericCatalog().map((entry) => [entry.id, entry]));
const missing = EQUIPMENT_HELD.filter((id) => !catalogue.has(id));
if (missing.length > 0) {
  console.error(`Fiches absentes du catalogue : ${missing.join(', ')}`);
  process.exit(1);
}

const equipment = EQUIPMENT_HELD.map((id) => {
  const entry = catalogue.get(id)!;
  return equipmentSnapshot(entry, {
    id,
    allowedHosts: (
      family(entry.familyId)?.placement?.allowedHosts ?? []
    ).filter(isHostType),
    requiredClearances: family(entry.familyId)?.clearances ?? [],
    capabilities: familyCapabilities(entry.familyId),
  });
});

const openingTypes = OPENINGS_HELD.map((id) => {
  const entry = rawGenericOpeningEntries().find((held) => held.id === id);
  if (entry === undefined) {
    console.error(`Menuiserie absente du catalogue : ${id}`);
    process.exit(1);
  }
  return projectOpeningFromCatalog(entry);
});

const base = JSON.parse(readFileSync(BASE, 'utf8')) as Record<string, unknown>;
const baseProject = base.project as Record<string, unknown>;

const level = {
  id: 'ground',
  name: 'Rez-de-chaussée',
  elevationMm: 0,
  defaultStoreyHeightMm: STOREY_MM,
  walls: WALLS.map((wall) => ({
    id: wall.id,
    type: 'WALL',
    levelId: 'ground',
    path: { points: [wall.from, wall.to] },
    referenceSide: 'CENTER',
    assemblyId: wall.assemblyId,
    baseOffsetMm: 0,
    heightMode: 'EXPLICIT',
    heightMm: STOREY_MM,
    role: wall.role,
  })),
  openings: OPENINGS.map((opening) => ({
    id: opening.id,
    type: 'OPENING',
    openingType: opening.openingType,
    hostElementId: opening.host,
    offsetAlongHostMm: opening.offsetAlongHostMm,
    sillHeightMm: opening.sillHeightMm,
    widthMm: opening.widthMm,
    heightMm: opening.heightMm,
    definitionId: opening.definitionId,
    ...(opening.swing === undefined ? {} : { swing: opening.swing }),
  })),
  slabs: [
    {
      id: 'slab-ground',
      type: 'SLAB',
      levelId: 'ground',
      polygon: {
        outer: [
          { x: 0, y: 0 },
          { x: 13000, y: 0 },
          { x: 13000, y: 10000 },
          { x: 0, y: 10000 },
        ],
      },
      assemblyId: 'generic-floor-slab-on-ground',
      elevationOffsetMm: 0,
      role: 'FLOOR',
    },
  ],
  roofs: [],
  spaces: SPACES.map(({ id, name, category, box }) => ({
    id,
    type: 'SPACE',
    levelId: 'ground',
    name,
    category,
    boundaryMode: 'MANUAL',
    manualPolygon: {
      outer: [
        { x: box[0], y: box[1] },
        { x: box[2], y: box[1] },
        { x: box[2], y: box[3] },
        { x: box[0], y: box[3] },
      ],
    },
  })),
  stairs: [],
  annotations: [],
  components: COMPONENTS.map((component) => ({
    id: component.id,
    type: 'COMPONENT_INSTANCE',
    levelId: 'ground',
    category: component.category,
    definitionId: component.definitionId,
    name: component.name,
    position: component.at,
    elevationMm: component.elevationMm ?? 0,
    rotationDeg: component.rotationDeg ?? 0,
    ...(component.spaceId === undefined ? {} : { spaceId: component.spaceId }),
  })),
};

const project = {
  ...baseProject,
  id: 'graphic-reference-house',
  metadata: {
    name: 'Maison de référence graphique',
    description:
      'Fixture de non-régression du moteur graphique : trois chambres, pièces humides, garage, baie, porte de garage et onze jonctions de murs. Valeurs techniques de démonstration.',
    createdAt: '2026-08-19T00:00:00Z',
    updatedAt: '2026-08-19T00:00:00Z',
    projectRevision: 'graphic-reference-1',
  },
  building: { levels: [level], zones: [] },
  equipment,
  openingTypes,
  systems: [],
  scenarios: [],
  drawingViews: [],
  sheets: [],
  networkProducts: [],
};

const file = { ...base, project };
writeFileSync(FILE, `${JSON.stringify(file, undefined, 2)}\n`, 'utf8');
console.log(
  `${FILE} : ${WALLS.length} murs, ${OPENINGS.length} ouvertures, ${SPACES.length} pièces, ${COMPONENTS.length} équipements.`,
);
