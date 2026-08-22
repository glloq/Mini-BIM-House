import { describe, expect, it } from 'vitest';
import type { Project } from '@house-technical-designer/core-domain';
import { materialId } from '@house-technical-designer/materials';
import { rawGenericAssemblyEntries } from '@house-technical-designer/assemblies/catalog';
import { createBlankProject } from '../project-workspace.js';
import { genericCatalog } from '@house-technical-designer/catalog-registry';
import { genericEquipment } from '@house-technical-designer/equipment-catalog';
import {
  assemblyView,
  assemblyViews,
  duplicateMaterialDraft,
  materialCategories,
  materialsAnAssemblyNeeds,
  materialRows,
  nextLibraryId,
  projectEquipmentFromCatalog,
  propertySource,
  withEditedProperty,
  withPropertySource,
} from './library-model.js';

function project(): Project {
  return createBlankProject('2026-08-19T00:00:00Z').project;
}

describe('taking a build-up out of the catalogue', () => {
  it('names the materials the project would be missing', () => {
    // A composition is made of materials. Taking it without them leaves layers
    // pointing at nothing — a wall that draws, costs nothing and insulates
    // nothing. The panel used to work only because the project had been handed
    // every material there is.
    const held = new Set(
      (project().materialLibrary?.materials ?? []).map(({ id }) => String(id)),
    );
    const wall = rawGenericAssemblyEntries().find(
      ({ id }) => id === 'generic-wall-double-brick-veneer',
    )!;
    const wanted = materialsAnAssemblyNeeds(wall.layers, held);
    expect(wanted.length).toBeGreaterThan(0);
    for (const id of wanted) expect(held.has(id)).toBe(false);
    // And what the project already holds is not asked for twice, however many
    // layers name it.
    expect(new Set(wanted).size).toBe(wanted.length);
    expect(
      materialsAnAssemblyNeeds(
        wall.layers,
        new Set(wall.layers.map((l) => l.materialId)),
      ),
    ).toEqual([]);
  });

  it('asks for nothing when the project already holds every layer', () => {
    const starter = rawGenericAssemblyEntries().find(
      ({ id }) => id === 'generic-partition-stud',
    )!;
    const held = new Set(
      (project().materialLibrary?.materials ?? []).map(({ id }) => String(id)),
    );
    expect(materialsAnAssemblyNeeds(starter.layers, held)).toEqual([]);
  });
});

describe('material library view', () => {
  it('lists the project library with its deletion safety', () => {
    const rows = materialRows(project());
    expect(rows.length).toBeGreaterThan(0);
    const insulation = rows.find(
      ({ material }) => material.id === 'generic-rock-wool',
    )!;
    // A starter build-up uses it, so deleting it is blocked.
    expect(insulation.deletable).toBe(false);
    expect(new Set(insulation.usedBy.map(({ kind }) => kind))).toEqual(
      new Set(['ASSEMBLY']),
    );
    // Every material a new project holds is used by one of its build-ups: the
    // basket is what the build-ups are made of, not a shelf somebody might
    // pick from one day. So the deletable case has to be a material the user
    // added, which is the only kind there is.
    expect(rows.every(({ deletable }) => !deletable)).toBe(true);
    const added = materialRows({
      ...project(),
      materialLibrary: {
        materials: [
          ...(project().materialLibrary?.materials ?? []),
          { ...insulation.material, id: materialId('mine'), name: 'Le mien' },
        ],
      },
    }).find(({ material }) => material.id === 'mine')!;
    expect(added.deletable).toBe(true);
  });

  it('reports the properties a material does not declare', () => {
    const rows = materialRows(project());
    const concrete = rows.find(
      ({ material }) => material.id === 'generic-concrete',
    )!;
    expect(concrete.missingProperties).toContain('sdM');
    expect(concrete.missingProperties).not.toContain('lambdaWmK');
  });

  it('filters by search and category', () => {
    expect(
      materialRows(project(), { search: 'laine de roche' }).map(
        ({ material }) => material.id,
      ),
    ).toEqual(['generic-rock-wool']);
    expect(materialCategories(project())).toContain('INSULATION');
  });
});

describe('assembly library view', () => {
  it('derives thickness, R and U from the project library', () => {
    const views = assemblyViews(project());
    const wall = views.find(
      ({ assembly }) =>
        assembly.id === 'generic-wall-block-external-insulation',
    )!;
    expect(wall.totalThicknessMm).toBe(353);
    expect(wall.thermalResistanceM2KW).toBeGreaterThan(2.5);
    expect(wall.uValueWm2K).toBeCloseTo(1 / wall.thermalResistanceM2KW!, 9);
    expect(wall.missingConductivityLayerIds).toEqual([]);
    expect(
      wall.layers.reduce((total, layer) => total + layer.thicknessRatio, 0),
    ).toBeCloseTo(1, 9);
  });

  it('leaves R and U unknown when a layer material declares no conductivity', () => {
    const base = project();
    const opaque = {
      id: materialId('mystery'),
      name: 'Matériau sans λ',
      kind: 'CUSTOM' as const,
      properties: {},
    };
    const withUnknown: Project = {
      ...base,
      materialLibrary: {
        materials: [...base.materialLibrary!.materials, opaque],
      },
      assemblies: base.assemblies!.map((assembly) =>
        assembly.id === 'generic-partition-stud'
          ? {
              ...assembly,
              layers: assembly.layers.map((layer, index) =>
                index === 0 ? { ...layer, materialId: opaque.id } : layer,
              ),
            }
          : assembly,
      ),
    };
    const view = assemblyView(
      withUnknown,
      withUnknown.assemblies!.find(
        ({ id }) => id === 'generic-partition-stud',
      )!,
    );
    expect(view.thermalResistanceM2KW).toBeUndefined();
    expect(view.uValueWm2K).toBeUndefined();
    expect(view.missingConductivityLayerIds).toHaveLength(1);
  });

  it('marks an assembly a wall uses as not deletable', () => {
    const views = assemblyViews(project());
    // A blank project has no wall yet, so every starter assembly is free.
    expect(views.every(({ deletable }) => deletable)).toBe(true);
  });
});

describe('library identifiers', () => {
  it('derives a readable identifier and avoids collisions', () => {
    expect(nextLibraryId('material', 'Laine de roche', [])).toBe(
      'material-laine-de-roche',
    );
    expect(
      nextLibraryId('material', 'Laine de roche', ['material-laine-de-roche']),
    ).toBe('material-laine-de-roche-2');
    expect(nextLibraryId('material', '   ', [])).toBe('material-sans-nom');
  });

  it('duplicates a material as a custom entry that keeps its provenance trail', () => {
    const source = project().materialLibrary!.materials.find(
      ({ id }) => id === 'generic-rock-wool',
    )!;
    const copy = duplicateMaterialDraft(source, [source.id]);
    expect(copy.id).not.toBe(source.id);
    expect(copy.kind).toBe('CUSTOM');
    expect(copy.name).toContain('copie');
    expect(copy.sources?.[0]?.reference).toContain(source.id);
  });
});

describe('equipment placed from the catalogue', () => {
  it('pins the version it was copied from where the pin is looked for', () => {
    // The version used to be hidden inside `properties` as
    // `catalogDefinitionVersion`, while the placement pin looked for `version`
    // at the top and found nothing. A component placed from this panel
    // therefore recorded no pin at all: the whole point of pinning was lost
    // between two panels.
    const definition = genericEquipment('generic-dhw-tank')!;
    const placed = projectEquipmentFromCatalog(definition, []);
    expect(placed.catalogKind).toBe('GENERIC');
    expect(placed.version).toBe(definition.version);
    expect(placed.familyId).toBe(definition.familyId);
    expect(placed.properties.tankVolumeL).toBe(
      definition.properties.tankVolumeL,
    );
  });

  it('takes its bucket from the family, and says the family when nothing resolved it', () => {
    // The entry states no category of its own any more. What the interface
    // hands over has been through `genericCatalog`, which stamps the family's;
    // an entry read straight from its file has not, and the copy then names
    // the family rather than inventing a bucket for it.
    const resolved = genericCatalog().find(
      ({ id }) => id === 'generic-dhw-tank',
    )!;
    expect(projectEquipmentFromCatalog(resolved, []).kind).toBe('DHW_TANK');
    expect(
      projectEquipmentFromCatalog(genericEquipment('generic-dhw-tank')!, [])
        .kind,
    ).toBe('ELECTRIC_DHW_TANK');
  });

  it('copies what makes the entry more than a bag of numbers', () => {
    const definition = genericEquipment('generic-air-water-heat-pump')!;
    const placed = projectEquipmentFromCatalog(
      definition,
      [],
      ['SLAB', 'SITE'],
    );
    expect(placed.ports?.map(({ portTypeId }) => portTypeId)).toEqual(
      definition.ports.map(({ portTypeId }) => portTypeId),
    );
    expect(placed.clearances?.map(({ zone }) => zone)).toEqual(
      definition.clearances?.map(({ zone }) => zone),
    );
    expect(placed.allowedHosts).toEqual(['SLAB', 'SITE']);
    expect(placed.provenance?.type).toBe('GENERIC');
    expect(placed.dimensions).toEqual(definition.dimensions);
  });

  it('carries no catalogue metadata smuggled inside the properties', () => {
    const definition = genericEquipment('generic-dhw-tank')!;
    const placed = projectEquipmentFromCatalog(definition, []);
    expect(
      Object.keys(placed.properties).filter((key) =>
        key.startsWith('catalogDefinition'),
      ),
    ).toEqual([]);
  });

  it('gives each copy a distinct project identifier', () => {
    const definition = genericEquipment('generic-led-luminaire')!;
    const first = projectEquipmentFromCatalog(definition, []);
    const second = projectEquipmentFromCatalog(definition, [first.id]);
    expect(second.id).not.toBe(first.id);
  });
});

describe('material property provenance', () => {
  function rockWool() {
    return (project().materialLibrary?.materials ?? []).find(
      ({ id }) => id === 'generic-rock-wool',
    )!;
  }

  it('declares where a value comes from and lets the reference be written', () => {
    const material = withPropertySource(rockWool(), 'lambdaWmK', {
      sourceType: 'MANUFACTURER',
      reference: 'Fiche technique 2026',
    });
    expect(propertySource(material, 'lambdaWmK')).toEqual({
      property: 'lambdaWmK',
      sourceType: 'MANUFACTURER',
      reference: 'Fiche technique 2026',
    });
    // Other properties keep the provenance they had.
    expect(propertySource(material, 'densityKgM3')?.sourceType).toBe(
      'STANDARD',
    );
  });

  it('drops the entry when the provenance is cleared, reference included', () => {
    const material = withPropertySource(rockWool(), 'lambdaWmK', {
      sourceType: '',
    });
    expect(propertySource(material, 'lambdaWmK')).toBeUndefined();
  });

  it('never leaves a standard reference attached to a value the user changed', () => {
    const before = rockWool();
    expect(propertySource(before, 'lambdaWmK')?.sourceType).toBe('STANDARD');
    const material = withEditedProperty(before, 'lambdaWmK', 0.031);
    expect(material.properties.lambdaWmK).toBe(0.031);
    expect(propertySource(material, 'lambdaWmK')).toEqual({
      property: 'lambdaWmK',
      sourceType: 'USER',
    });
  });

  it('leaves the provenance alone when the value is retyped unchanged', () => {
    const before = rockWool();
    const same = before.properties.lambdaWmK as number;
    expect(
      propertySource(withEditedProperty(before, 'lambdaWmK', same), 'lambdaWmK')
        ?.sourceType,
    ).toBe('STANDARD');
  });

  it('takes the provenance away with the property it described', () => {
    const material = withEditedProperty(rockWool(), 'lambdaWmK', undefined);
    expect(material.properties.lambdaWmK).toBeUndefined();
    expect(propertySource(material, 'lambdaWmK')).toBeUndefined();
  });

  it('invents no provenance for a material that declared none', () => {
    const custom = withEditedProperty(
      { ...rockWool(), sources: [] },
      'lambdaWmK',
      0.04,
    );
    expect(custom.sources).toEqual([]);
  });
});
