import type {
  Project,
  ProjectFile,
} from '@house-technical-designer/core-domain';
import { entityId, isHostType } from '@house-technical-designer/core-domain';
import { genericMaterialCatalog } from '@house-technical-designer/materials/catalog';
import { genericAssemblyCatalog } from '@house-technical-designer/assemblies/catalog';
import { genericOpeningTypes } from '@house-technical-designer/opening-catalog';
import { equipmentSnapshot } from '@house-technical-designer/equipment-catalog';
import { NETWORK_PRODUCT_REGISTRY } from '@house-technical-designer/network-products';
import { family, familyCapabilities, genericCatalog } from './registry.js';

/**
 * A project made of one of everything the catalogues ship.
 *
 * `TESTS` is measured from « a fixture in this repository is made of this
 * family », and until now the only fixture was the reference house, which is a
 * house: it holds four families because that is what a house holds. Every
 * other entry in the catalogue was carried by nothing, and « nobody has ever
 * put one of these in a project » was invisible.
 *
 * This is the other fixture, and it is not a house — it is one of each. What
 * it proves is narrow and worth proving: that every entry the application
 * ships can be carried by a project the importer accepts. A catalogue entry
 * that cannot be is an entry whose only failure mode is discovered by a user,
 * on reopening, months later.
 */
export function qualificationHouse(): Project {
  return {
    id: entityId('project-catalog-qualification'),
    metadata: {
      name: 'Maison de qualification du catalogue',
      description:
        'Une de chaque fiche livrée, pour que « personne n’a jamais posé cela » se voie.',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    site: { northAngleDeg: 0 },
    building: {
      levels: [
        {
          id: entityId('level-ground'),
          name: 'Rez-de-chaussée',
          elevationMm: 0,
          defaultStoreyHeightMm: 2500,
          walls: [],
          openings: [],
          slabs: [],
          roofs: [],
          spaces: [],
          stairs: [],
          annotations: [],
        },
      ],
      zones: [],
    },
    materialLibrary: { materials: genericMaterialCatalog() },
    assemblies: genericAssemblyCatalog(),
    // The same constructor the interface uses, so there is one path from a
    // fiche to a project rather than two — and this fixture then exercises the
    // performance curves, the sources, the rendering and the capabilities that
    // its own hand-written copies used to leave out.
    equipment: genericCatalog().map((entry) =>
      equipmentSnapshot(entry, {
        id: entry.id,
        allowedHosts: (
          family(entry.familyId)?.placement?.allowedHosts ?? []
        ).filter(isHostType),
        requiredClearances: family(entry.familyId)?.clearances ?? [],
        capabilities: familyCapabilities(entry.familyId),
      }),
    ),
    openingTypes: genericOpeningTypes(),
    networkProducts: NETWORK_PRODUCT_REGISTRY.map((product) => ({
      id: product.id,
      family: product.family,
      domain: product.domain,
      label: product.label,
      ...(product.version === undefined ? {} : { version: product.version }),
      properties: { ...product.properties },
      provenance: product.provenance,
    })),
    systems: [],
    scenarios: [],
    drawingViews: [],
    calculationSettings: {},
    regulatoryContext: { country: 'FR', enabledRulePacks: [] },
  };
}

/** The same, as a file, so the importer can be asked to accept it. */
export function qualificationHouseFile(schemaVersion: string): ProjectFile {
  return {
    format: 'house-technical-designer-project',
    schemaVersion,
    project: qualificationHouse(),
  };
}
