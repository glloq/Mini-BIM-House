import { describe, expect, it } from 'vitest';
import type { Project } from '@house-technical-designer/core-domain';
import { entityId } from '@house-technical-designer/core-domain';
import {
  genericMaterial,
  genericMaterialCatalog,
  materialId,
} from '@house-technical-designer/materials';
import { serializedTotalThicknessM } from '@house-technical-designer/assemblies';
import { ProjectCommandDispatcher } from './project-commands.js';
import {
  addAssemblyLayerCommand,
  AddAssemblyCommand,
  AddEquipmentCommand,
  AddMaterialCommand,
  assembliesUsingMaterial,
  draftAssembly,
  draftAssemblyLayer,
  elementsUsingAssembly,
  ImportMaterialsCommand,
  moveAssemblyLayerCommand,
  nodesUsingEquipment,
  RemoveAssemblyCommand,
  RemoveEquipmentCommand,
  RemoveMaterialCommand,
  removeAssemblyLayerCommand,
  setAssemblyLayerMaterialCommand,
  setAssemblyLayerThicknessCommand,
  UpdateMaterialCommand,
} from './library-commands.js';

const INSULATION = materialId('generic-glass-wool');
const MASONRY = materialId('generic-brick');

function project(): Project {
  const levelId = entityId<'Level'>('ground');
  return {
    id: entityId<'Project'>('library-fixture'),
    metadata: {
      name: 'Library fixture',
      createdAt: '2026-08-19T00:00:00Z',
      updatedAt: '2026-08-19T00:00:00Z',
    },
    site: { northAngleDeg: 0 },
    materialLibrary: {
      materials: [genericMaterial(INSULATION)!, genericMaterial(MASONRY)!],
    },
    assemblies: [
      draftAssembly('wall-assembly', 'Mur', 'WALL', [
        draftAssemblyLayer('layer-masonry', MASONRY, 200, 'STRUCTURAL'),
        draftAssemblyLayer('layer-insulation', INSULATION, 200, 'INSULATION'),
      ]),
    ],
    building: {
      levels: [
        {
          id: levelId,
          name: 'RDC',
          elevationMm: 0,
          defaultStoreyHeightMm: 2500,
          walls: [
            {
              id: entityId<'Wall'>('wall'),
              type: 'WALL',
              levelId,
              path: {
                points: [
                  { x: 0, y: 0 },
                  { x: 5000, y: 0 },
                ],
              },
              referenceSide: 'CENTER',
              assemblyId: 'wall-assembly' as never,
              baseOffsetMm: 0,
              heightMode: 'EXPLICIT',
              heightMm: 2500,
              role: 'EXTERIOR',
            },
          ],
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
    equipment: [
      {
        id: 'vmc',
        kind: 'FAN',
        catalogKind: 'GENERIC',
        properties: { designFlowM3h: 150 },
      },
    ],
    systems: [
      {
        id: 'ventilation',
        discipline: 'VENTILATION',
        systemType: 'EXTRACT',
        nodes: [
          {
            id: 'unit',
            kind: 'FAN',
            position: { x: 0, y: 0, z: 0 },
            equipmentId: 'vmc',
          } as never,
        ],
        ports: [],
        edges: [],
      },
    ],
  };
}

function dispatcher(): ProjectCommandDispatcher {
  return new ProjectCommandDispatcher(project());
}

describe('material library commands', () => {
  it('adds, updates and undoes a material through the dispatcher', () => {
    const commands = dispatcher();
    const wood = genericMaterial('generic-softwood')!;
    expect(commands.dispatch(new AddMaterialCommand(wood)).status).toBe(
      'APPLIED',
    );
    expect(commands.project.materialLibrary?.materials).toHaveLength(3);

    const renamed = { ...wood, name: 'Bois massif' };
    expect(commands.dispatch(new UpdateMaterialCommand(renamed)).status).toBe(
      'APPLIED',
    );
    expect(
      commands.project.materialLibrary?.materials.find(
        ({ id }) => id === wood.id,
      )?.name,
    ).toBe('Bois massif');

    expect(commands.undo().status).toBe('APPLIED');
    expect(
      commands.project.materialLibrary?.materials.find(
        ({ id }) => id === wood.id,
      )?.name,
    ).toBe(wood.name);
    expect(commands.undo().status).toBe('APPLIED');
    expect(commands.project.materialLibrary?.materials).toHaveLength(2);
  });

  it('refuses to add a material twice or to update an unknown one', () => {
    const commands = dispatcher();
    expect(
      commands.dispatch(new AddMaterialCommand(genericMaterial(MASONRY)!))
        .status,
    ).toBe('REJECTED');
    expect(
      commands.dispatch(
        new UpdateMaterialCommand(genericMaterial('generic-steel')!),
      ).status,
    ).toBe('REJECTED');
  });

  it('refuses to delete a material an assembly still uses, and names the users', () => {
    const commands = dispatcher();
    const result = commands.dispatch(new RemoveMaterialCommand(INSULATION));
    expect(result.status).toBe('REJECTED');
    if (result.status === 'REJECTED') expect(result.errors[0]).toContain('Mur');
    expect(assembliesUsingMaterial(commands.project, INSULATION)).toHaveLength(
      1,
    );
  });

  it('deletes a material nothing references', () => {
    const commands = dispatcher();
    const wood = genericMaterial('generic-softwood')!;
    commands.dispatch(new AddMaterialCommand(wood));
    expect(commands.dispatch(new RemoveMaterialCommand(wood.id)).status).toBe(
      'APPLIED',
    );
  });

  it('imports the generic catalogue while skipping what is already present', () => {
    const commands = dispatcher();
    const result = commands.dispatch(
      new ImportMaterialsCommand(genericMaterialCatalog()),
    );
    expect(result.status).toBe('APPLIED');
    const ids = commands.project.materialLibrary!.materials.map(({ id }) => id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(genericMaterialCatalog().length);
    expect(
      commands.dispatch(new ImportMaterialsCommand(genericMaterialCatalog()))
        .status,
    ).toBe('REJECTED');
  });
});

describe('assembly library commands', () => {
  it('creates an assembly and rejects one whose material is unknown', () => {
    const commands = dispatcher();
    expect(
      commands.dispatch(
        new AddAssemblyCommand(
          draftAssembly('roof-assembly', 'Toiture', 'ROOF', [
            draftAssemblyLayer(
              'roof-insulation',
              INSULATION,
              300,
              'INSULATION',
            ),
          ]),
        ),
      ).status,
    ).toBe('APPLIED');
    expect(
      commands.dispatch(
        new AddAssemblyCommand(
          draftAssembly('bad-assembly', 'Inconnu', 'WALL', [
            draftAssemblyLayer('x', materialId('not-in-project'), 100),
          ]),
        ),
      ).status,
    ).toBe('REJECTED');
  });

  it('refuses to delete an assembly a wall still uses', () => {
    const commands = dispatcher();
    const result = commands.dispatch(
      new RemoveAssemblyCommand('wall-assembly'),
    );
    expect(result.status).toBe('REJECTED');
    expect(elementsUsingAssembly(commands.project, 'wall-assembly')).toEqual([
      { kind: 'WALL', id: 'wall', name: 'wall' },
    ]);
  });

  it('adds, moves, retypes and removes layers, keeping the total thickness right', () => {
    const commands = dispatcher();
    const assembly = () => commands.project.assemblies![0]!;
    expect(serializedTotalThicknessM(assembly())).toBeCloseTo(0.4, 9);

    expect(
      commands.dispatch(
        addAssemblyLayerCommand(
          'wall-assembly',
          draftAssemblyLayer('layer-board', MASONRY, 13, 'FINISH'),
        ),
      ).status,
    ).toBe('APPLIED');
    expect(serializedTotalThicknessM(assembly())).toBeCloseTo(0.413, 9);
    expect(assembly().layers.at(-1)?.id).toBe('layer-board');

    expect(
      commands.dispatch(
        moveAssemblyLayerCommand('wall-assembly', 'layer-board', -2),
      ).status,
    ).toBe('APPLIED');
    expect(assembly().layers[0]?.id).toBe('layer-board');

    expect(
      commands.dispatch(
        setAssemblyLayerThicknessCommand('wall-assembly', 'layer-board', 25),
      ).status,
    ).toBe('APPLIED');
    expect(assembly().layers[0]?.thicknessM).toBeCloseTo(0.025, 9);

    expect(
      commands.dispatch(
        setAssemblyLayerMaterialCommand(
          'wall-assembly',
          'layer-board',
          INSULATION,
        ),
      ).status,
    ).toBe('APPLIED');
    expect(assembly().layers[0]?.materialId).toBe(INSULATION);

    expect(
      commands.dispatch(
        removeAssemblyLayerCommand('wall-assembly', 'layer-board'),
      ).status,
    ).toBe('APPLIED');
    expect(serializedTotalThicknessM(assembly())).toBeCloseTo(0.4, 9);
  });

  it('rejects a layer edit that would leave the assembly invalid', () => {
    const commands = dispatcher();
    expect(
      commands.dispatch(
        setAssemblyLayerThicknessCommand('wall-assembly', 'layer-masonry', 0),
      ).status,
    ).toBe('REJECTED');
    expect(
      commands.dispatch(
        setAssemblyLayerMaterialCommand(
          'wall-assembly',
          'layer-masonry',
          materialId('unknown'),
        ),
      ).status,
    ).toBe('REJECTED');
    expect(
      commands.dispatch(
        moveAssemblyLayerCommand('wall-assembly', 'layer-missing', 1),
      ).status,
    ).toBe('REJECTED');
    // The rejected edits left the assembly untouched.
    expect(
      serializedTotalThicknessM(commands.project.assemblies![0]!),
    ).toBeCloseTo(0.4, 9);
  });
});

describe('equipment library commands', () => {
  it('refuses to delete equipment a network node still places', () => {
    const commands = dispatcher();
    const result = commands.dispatch(new RemoveEquipmentCommand('vmc'));
    expect(result.status).toBe('REJECTED');
    expect(nodesUsingEquipment(commands.project, 'vmc')).toHaveLength(1);
  });

  it('adds equipment and deletes it once nothing references it', () => {
    const commands = dispatcher();
    expect(
      commands.dispatch(
        new AddEquipmentCommand({
          id: 'battery',
          kind: 'BATTERY',
          catalogKind: 'GENERIC',
          properties: { usableCapacityKWh: 5 },
        }),
      ).status,
    ).toBe('APPLIED');
    expect(
      commands.dispatch(new RemoveEquipmentCommand('battery')).status,
    ).toBe('APPLIED');
    expect(commands.project.equipment).toHaveLength(1);
  });
});
