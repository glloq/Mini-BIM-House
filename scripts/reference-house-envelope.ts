/**
 * Rebuilds the reference house's envelope from the catalogue.
 *
 * Its equipment came from the catalogue; what the house is *made of* did not.
 * Two materials called « Fixture PR-069 — valeur de démonstration » and three
 * build-ups invented for this file alone carried every wall, every slab and
 * both roof planes — so the thermal calculation, the quantities and the layer
 * drawing all ran on figures the application does not ship and nobody can
 * choose. A reference house built out of things no user can pick is a
 * reference for nothing.
 *
 * The build-ups are the six of the starter basket, taken through
 * `assemblySnapshot`, and the materials are exactly the ones those build-ups
 * are made of — never a list of its own: a material is not chosen, it is what
 * a composition is made of, and the project carries what it uses.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { assemblySnapshot } from '@house-technical-designer/assemblies/catalog';
import { rawGenericAssemblyEntries } from '@house-technical-designer/assemblies/catalog';
import {
  materialSnapshot,
  rawGenericMaterialEntries,
} from '@house-technical-designer/materials/catalog';

const FILE = 'examples/reference-house/reference.houseproj.json';

/**
 * Which build-up carries what, by the role the object already declares.
 *
 * The house said `assembly-horizontal` for its ground slab, its intermediate
 * floor and both roof planes — one build-up for three different things,
 * because there was only ever one to say. The roles were right all along; what
 * was missing was something to point them at.
 */
const WALL_OF_ROLE: Readonly<Record<string, string>> = {
  EXTERIOR: 'generic-wall-block-external-insulation',
  INTERIOR: 'generic-partition-stud',
};
const SLAB_OF_ID: Readonly<Record<string, string>> = {
  'slab-ground': 'generic-floor-slab-on-ground',
  'slab-first': 'generic-floor-intermediate-timber',
};
const ROOF_BUILD_UP = 'generic-roof-timber-insulated';

/**
 * What the démonstration says a cubic metre of each of these costs and emits.
 *
 * Sourced as demonstration data, like everything else in this file: not a
 * quotation, not an environmental declaration. What matters here is that every
 * material the house is made of has a figure — a takeoff that silently drops
 * the materials nobody priced is a total that reads as complete and is not.
 *
 * The air cavity is the one deliberate zero. A layer of nothing is bought from
 * nobody and emits nothing; that is a statement about air, not a figure
 * missing from a table.
 */
const MATERIAL_FIGURES: Readonly<
  Record<
    string,
    {
      readonly price: number;
      readonly labour: number;
      readonly waste: number;
      readonly gwp: number;
    }
  >
> = {
  'generic-concrete': { price: 180, labour: 120, waste: 0.03, gwp: 300 },
  'generic-concrete-block': { price: 185, labour: 95, waste: 0.05, gwp: 255 },
  'generic-softwood': { price: 620, labour: 260, waste: 0.1, gwp: 60 },
  'generic-osb': { price: 480, labour: 180, waste: 0.08, gwp: 90 },
  'generic-gypsum-board': { price: 320, labour: 210, waste: 0.08, gwp: 180 },
  'generic-glass-wool': { price: 95, labour: 45, waste: 0.1, gwp: 140 },
  'generic-rock-wool': { price: 130, labour: 45, waste: 0.1, gwp: 160 },
  'generic-wood-fibre': { price: 210, labour: 55, waste: 0.1, gwp: 40 },
  'generic-eps': { price: 110, labour: 40, waste: 0.1, gwp: 190 },
  'generic-xps': { price: 165, labour: 40, waste: 0.1, gwp: 240 },
  'generic-air-cavity': { price: 0, labour: 0, waste: 0, gwp: 0 },
};

interface Held {
  project: {
    materialLibrary: { materials: unknown };
    assemblies: unknown;
    calculationSettings: Record<string, { settings: Record<string, unknown> }>;
    building: {
      levels: readonly {
        readonly walls?: { role?: string; assemblyId?: string }[];
        readonly slabs?: { id: string; assemblyId?: string }[];
        readonly roofs?: { assemblyId?: string }[];
      }[];
    };
  };
}

const held = JSON.parse(readFileSync(FILE, 'utf8')) as Held;

const wanted = new Set([
  ...Object.values(WALL_OF_ROLE),
  ...Object.values(SLAB_OF_ID),
  ROOF_BUILD_UP,
]);
const entries = rawGenericAssemblyEntries().filter(({ id }) => wanted.has(id));
const absent = [...wanted].filter(
  (id) => !entries.some((entry) => entry.id === id),
);
if (absent.length > 0) {
  console.error(`Compositions absentes du catalogue : ${absent.join(', ')}`);
  process.exit(1);
}

// What those build-ups are made of, and nothing more.
const used = new Set(
  entries.flatMap(({ layers }) =>
    (layers ?? []).map(({ materialId }) => materialId),
  ),
);
const materials = rawGenericMaterialEntries().filter(({ id }) => used.has(id));
const missing = [...used].filter(
  (id) => !materials.some((entry) => entry.id === id),
);
if (missing.length > 0) {
  console.error(`Matériaux absents du catalogue : ${missing.join(', ')}`);
  process.exit(1);
}

held.project.materialLibrary.materials = materials.map(materialSnapshot);
held.project.assemblies = entries.map(assemblySnapshot);

let repointed = 0;
for (const level of held.project.building.levels) {
  for (const wall of level.walls ?? []) {
    const build = WALL_OF_ROLE[wall.role ?? ''];
    if (build === undefined) {
      console.error(`Mur sans rôle connu : ${JSON.stringify(wall.role)}`);
      process.exit(1);
    }
    wall.assemblyId = build;
    repointed += 1;
  }
  for (const slab of level.slabs ?? []) {
    const build = SLAB_OF_ID[slab.id];
    if (build === undefined) {
      console.error(`Dalle sans composition décidée : ${slab.id}`);
      process.exit(1);
    }
    slab.assemblyId = build;
    repointed += 1;
  }
  for (const roof of level.roofs ?? []) {
    roof.assemblyId = ROOF_BUILD_UP;
    repointed += 1;
  }
}

const figures = materials.map(({ id }) => {
  const held = MATERIAL_FIGURES[id];
  if (held === undefined) {
    console.error(`Aucune figure de démonstration pour ${id}`);
    process.exit(1);
  }
  return [id, held] as const;
});
const settings = held.project.calculationSettings;
settings['cost']!.settings['unitPriceByMaterial'] = Object.fromEntries(
  figures.map(([id, { price }]) => [id, price]),
);
settings['cost']!.settings['labourPriceByMaterial'] = Object.fromEntries(
  figures.map(([id, { labour }]) => [id, labour]),
);
settings['cost']!.settings['wasteFactorByMaterial'] = Object.fromEntries(
  figures.map(([id, { waste }]) => [id, waste]),
);
settings['environmental']!.settings['gwpPerUnitByMaterial'] =
  Object.fromEntries(figures.map(([id, { gwp }]) => [id, gwp]));

writeFileSync(FILE, `${JSON.stringify(held, undefined, 2)}\n`, 'utf8');
console.log(
  `${entries.length} compositions, ${materials.length} matériaux, ${repointed} objets repointés.`,
);
for (const entry of entries)
  console.log(
    `  ${entry.id.padEnd(40)} ${(entry.layers ?? [])
      .reduce((total, { thicknessM }) => total + thicknessM, 0)
      .toFixed(3)} m`,
  );
