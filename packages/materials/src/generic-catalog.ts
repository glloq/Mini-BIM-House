import { createMaterial, materialId } from './materials.js';
import type { Material, MaterialProperties, MaterialSource } from './types.js';

/**
 * A small library of generic construction materials, so a new project can draw a
 * wall without the user having to key in physical properties first.
 *
 * Every entry is `GENERIC`: the values are order-of-magnitude figures taken from
 * the ranges published in the referenced standards, never a manufacturer's
 * declared performance. Each property carries its own source so the interface can
 * show where a number came from, and a product-specific study must replace these
 * entries with `PRODUCT` materials backed by a declaration.
 */
export const GENERIC_MATERIAL_REFERENCE =
  'ISO 10456 typical design values for building materials';

const ACOUSTIC_REFERENCE =
  'Typical published absorption coefficients for this family of surfaces';

interface CatalogEntry {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly properties: MaterialProperties;
  /** Properties whose value comes from the acoustic literature rather than ISO 10456. */
  readonly acousticProperties?: readonly string[];
}

const ENTRIES: readonly CatalogEntry[] = [
  {
    id: 'generic-concrete',
    name: 'Béton armé',
    category: 'STRUCTURE',
    properties: {
      densityKgM3: 2400,
      specificHeatJKgK: 1000,
      lambdaWmK: 2.3,
      mu: 130,
      acousticAbsorption: {
        '125': 0.01,
        '250': 0.01,
        '500': 0.02,
        '1000': 0.02,
        '2000': 0.02,
        '4000': 0.03,
      },
    },
  },
  {
    id: 'generic-brick',
    name: 'Brique de terre cuite',
    category: 'MASONRY',
    properties: {
      densityKgM3: 1700,
      specificHeatJKgK: 1000,
      lambdaWmK: 0.68,
      mu: 10,
      acousticAbsorption: {
        '125': 0.02,
        '250': 0.02,
        '500': 0.03,
        '1000': 0.04,
        '2000': 0.05,
        '4000': 0.05,
      },
    },
  },
  {
    id: 'generic-concrete-block',
    name: 'Parpaing de béton',
    category: 'MASONRY',
    properties: {
      densityKgM3: 1300,
      specificHeatJKgK: 1000,
      lambdaWmK: 1.05,
      mu: 60,
      acousticAbsorption: {
        '125': 0.02,
        '250': 0.03,
        '500': 0.04,
        '1000': 0.05,
        '2000': 0.05,
        '4000': 0.06,
      },
    },
  },
  {
    id: 'generic-softwood',
    name: 'Bois résineux',
    category: 'WOOD',
    properties: {
      densityKgM3: 500,
      specificHeatJKgK: 1600,
      lambdaWmK: 0.13,
      mu: 50,
      acousticAbsorption: {
        '125': 0.15,
        '250': 0.11,
        '500': 0.1,
        '1000': 0.07,
        '2000': 0.06,
        '4000': 0.07,
      },
    },
  },
  {
    id: 'generic-osb',
    name: 'Panneau OSB',
    category: 'WOOD',
    properties: {
      densityKgM3: 650,
      specificHeatJKgK: 1700,
      lambdaWmK: 0.13,
      mu: 200,
      acousticAbsorption: {
        '125': 0.1,
        '250': 0.1,
        '500': 0.08,
        '1000': 0.08,
        '2000': 0.08,
        '4000': 0.08,
      },
    },
  },
  {
    id: 'generic-gypsum-board',
    name: 'Plaque de plâtre',
    category: 'FINISH',
    properties: {
      densityKgM3: 900,
      specificHeatJKgK: 1000,
      lambdaWmK: 0.25,
      mu: 10,
      acousticAbsorption: {
        '125': 0.15,
        '250': 0.1,
        '500': 0.06,
        '1000': 0.04,
        '2000': 0.04,
        '4000': 0.05,
      },
    },
  },
  {
    id: 'generic-glass-wool',
    name: 'Laine de verre',
    category: 'INSULATION',
    properties: {
      densityKgM3: 20,
      specificHeatJKgK: 1030,
      lambdaWmK: 0.035,
      mu: 1,
      acousticAbsorption: {
        '125': 0.2,
        '250': 0.45,
        '500': 0.7,
        '1000': 0.85,
        '2000': 0.9,
        '4000': 0.9,
      },
    },
  },
  {
    id: 'generic-rock-wool',
    name: 'Laine de roche',
    category: 'INSULATION',
    properties: {
      densityKgM3: 40,
      specificHeatJKgK: 1030,
      lambdaWmK: 0.037,
      mu: 1,
      acousticAbsorption: {
        '125': 0.25,
        '250': 0.5,
        '500': 0.75,
        '1000': 0.9,
        '2000': 0.95,
        '4000': 0.95,
      },
    },
  },
  {
    id: 'generic-wood-fibre',
    name: 'Fibre de bois',
    category: 'INSULATION',
    properties: {
      densityKgM3: 160,
      specificHeatJKgK: 2100,
      lambdaWmK: 0.042,
      mu: 5,
      acousticAbsorption: {
        '125': 0.15,
        '250': 0.35,
        '500': 0.6,
        '1000': 0.75,
        '2000': 0.8,
        '4000': 0.8,
      },
    },
  },
  {
    id: 'generic-pir',
    name: 'Polyuréthane PIR',
    category: 'INSULATION',
    properties: {
      densityKgM3: 35,
      specificHeatJKgK: 1400,
      lambdaWmK: 0.024,
      mu: 60,
      acousticAbsorption: {
        '125': 0.05,
        '250': 0.07,
        '500': 0.1,
        '1000': 0.12,
        '2000': 0.12,
        '4000': 0.12,
      },
    },
  },
  {
    id: 'generic-eps',
    name: 'Polystyrène expansé PSE',
    category: 'INSULATION',
    properties: {
      densityKgM3: 20,
      specificHeatJKgK: 1450,
      lambdaWmK: 0.038,
      mu: 60,
      acousticAbsorption: {
        '125': 0.05,
        '250': 0.07,
        '500': 0.1,
        '1000': 0.12,
        '2000': 0.12,
        '4000': 0.12,
      },
    },
  },
  {
    id: 'generic-xps',
    name: 'Polystyrène extrudé XPS',
    category: 'INSULATION',
    properties: {
      densityKgM3: 33,
      specificHeatJKgK: 1450,
      lambdaWmK: 0.034,
      mu: 150,
      acousticAbsorption: {
        '125': 0.04,
        '250': 0.05,
        '500': 0.06,
        '1000': 0.08,
        '2000': 0.08,
        '4000': 0.08,
      },
    },
  },
  {
    id: 'generic-air-cavity',
    name: 'Lame d’air non ventilée',
    category: 'AIR',
    properties: {
      densityKgM3: 1.2,
      specificHeatJKgK: 1005,
      lambdaWmK: 0.025,
      mu: 1,
    },
  },
  {
    id: 'generic-glass',
    name: 'Verre',
    category: 'GLAZING',
    properties: {
      densityKgM3: 2500,
      specificHeatJKgK: 750,
      lambdaWmK: 1,
      emissivity: 0.89,
      mu: 100_000,
      acousticAbsorption: {
        '125': 0.18,
        '250': 0.06,
        '500': 0.04,
        '1000': 0.03,
        '2000': 0.02,
        '4000': 0.02,
      },
    },
  },
  {
    id: 'generic-steel',
    name: 'Acier',
    category: 'METAL',
    properties: {
      densityKgM3: 7800,
      specificHeatJKgK: 450,
      lambdaWmK: 50,
      emissivity: 0.2,
      mu: 100_000,
      acousticAbsorption: {
        '125': 0.05,
        '250': 0.04,
        '500': 0.03,
        '1000': 0.03,
        '2000': 0.02,
        '4000': 0.02,
      },
    },
  },
  {
    id: 'generic-aluminium',
    name: 'Aluminium',
    category: 'METAL',
    properties: {
      densityKgM3: 2700,
      specificHeatJKgK: 880,
      lambdaWmK: 160,
      emissivity: 0.1,
      mu: 100_000,
      acousticAbsorption: {
        '125': 0.05,
        '250': 0.04,
        '500': 0.03,
        '1000': 0.03,
        '2000': 0.02,
        '4000': 0.02,
      },
    },
  },
];

function sourcesFor(entry: CatalogEntry): readonly MaterialSource[] {
  return Object.keys(entry.properties).map((property) => ({
    property,
    sourceType: 'STANDARD' as const,
    reference:
      property === 'acousticAbsorption'
        ? ACOUSTIC_REFERENCE
        : GENERIC_MATERIAL_REFERENCE,
  }));
}

/**
 * Builds the generic catalogue. A fresh array is returned each time so callers
 * can copy entries into a project without sharing mutable references.
 */
export function genericMaterialCatalog(): readonly Material[] {
  return ENTRIES.map((entry) =>
    createMaterial({
      id: materialId(entry.id),
      name: entry.name,
      kind: 'GENERIC',
      category: entry.category,
      properties: entry.properties,
      sources: sourcesFor(entry),
    }),
  );
}

/** Looks a catalogue entry up by identifier. */
export function genericMaterial(id: string): Material | undefined {
  return genericMaterialCatalog().find((material) => material.id === id);
}

/** Categories present in the generic catalogue, for filter menus. */
export function genericMaterialCategories(): readonly string[] {
  return [...new Set(ENTRIES.map(({ category }) => category))].sort();
}
