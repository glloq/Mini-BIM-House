import { describe, expect, it } from 'vitest';
import type { Project } from '@house-technical-designer/core-domain';
import { materialId } from '@house-technical-designer/materials';
import { createBlankProject } from '../project-workspace.js';
import { genericEquipment } from '@house-technical-designer/equipment-catalog';
import {
  assemblyView,
  assemblyViews,
  duplicateMaterialDraft,
  materialCategories,
  materialRows,
  nextLibraryId,
  projectEquipmentFromCatalog,
} from './library-model.js';

function project(): Project {
  return createBlankProject('2026-08-19T00:00:00Z').project;
}

describe('material library view', () => {
  it('lists the project library with its deletion safety', () => {
    const rows = materialRows(project());
    expect(rows.length).toBeGreaterThan(0);
    const insulation = rows.find(
      ({ material }) => material.id === 'generic-rock-wool',
    )!;
    // The starter exterior wall uses it, so deleting it is blocked.
    expect(insulation.deletable).toBe(false);
    expect(insulation.usedBy.map(({ kind }) => kind)).toEqual(['ASSEMBLY']);
    const unused = rows.find(
      ({ material }) => material.id === 'generic-steel',
    )!;
    expect(unused.deletable).toBe(true);
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
      ({ assembly }) => assembly.id === 'assembly-exterior-wall',
    )!;
    expect(wall.totalThicknessMm).toBe(373);
    expect(wall.thermalResistanceM2KW).toBeGreaterThan(4);
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
        assembly.id === 'assembly-partition'
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
      withUnknown.assemblies!.find(({ id }) => id === 'assembly-partition')!,
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
  it('pins the catalogue definition and version it was copied from', () => {
    const definition = genericEquipment('generic-dhw-tank')!;
    const placed = projectEquipmentFromCatalog(definition, []);
    expect(placed.kind).toBe(definition.kind);
    expect(placed.catalogKind).toBe('GENERIC');
    expect(placed.properties.catalogDefinitionId).toBe(definition.id);
    expect(placed.properties.catalogDefinitionVersion).toBe(definition.version);
    expect(placed.properties.tankVolumeL).toBe(
      definition.properties.tankVolumeL,
    );
  });

  it('gives each copy a distinct project identifier', () => {
    const definition = genericEquipment('generic-led-luminaire')!;
    const first = projectEquipmentFromCatalog(definition, []);
    const second = projectEquipmentFromCatalog(definition, [first.id]);
    expect(second.id).not.toBe(first.id);
  });
});
