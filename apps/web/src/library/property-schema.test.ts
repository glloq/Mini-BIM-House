import { describe, expect, it } from 'vitest';
import { entityId, type Project } from '@house-technical-designer/core-domain';
import {
  ProjectCommandDispatcher,
  UpdateEquipmentCommand,
} from '@house-technical-designer/editor-core';
import {
  loadProjectJson,
  serializeProjectFile,
} from '@house-technical-designer/project-io';
import {
  describeProperties,
  describeProperty,
  withProperty,
} from './property-schema.js';

const POWER = describeProperty('nominalPowerW', 0);

describe('equipment property editing', () => {
  it('removes the property when the field is emptied', () => {
    expect(withProperty({ nominalPowerW: 4200 }, POWER, '')).toEqual({});
    expect(withProperty({ nominalPowerW: 4200 }, POWER, '   ')).toEqual({});
  });

  it('never writes a value nobody typed', () => {
    // `Number('')` is 0 and `valueAsNumber` on an emptied field is NaN: both
    // would answer a question the user did not answer.
    const cleared = withProperty({ nominalPowerW: 4200 }, POWER, '');
    expect(cleared).not.toHaveProperty('nominalPowerW');
    expect(withProperty({}, POWER, 'quatre mille')).toBeUndefined();
  });

  it('accepts a decimal comma', () => {
    expect(withProperty({}, POWER, '4200,5')).toEqual({
      nominalPowerW: 4200.5,
    });
  });

  it('keeps a property the catalogue does not describe', () => {
    const groups = describeProperties({ soundPowerDbA: 42 });
    expect(groups).toHaveLength(1);
    expect(groups[0]?.group).toBe('Autres');
    expect(groups[0]?.entries[0]?.descriptor.label).toBe('soundPowerDbA');
    expect(groups[0]?.entries[0]?.descriptor.kind).toBe('NUMBER');
  });
});

function projectWithEquipment(): Project {
  return {
    id: entityId<'Project'>('project'),
    metadata: {
      name: 'Équipements',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
      projectRevision: '1',
    },
    site: { northAngleDeg: 0 },
    building: { levels: [], zones: [] },
    systems: [],
    equipment: [
      {
        id: entityId<'Equipment'>('heat-pump-1'),
        kind: 'HEAT_PUMP',
        catalogKind: 'GENERIC',
        properties: { name: 'PAC', nominalPowerW: 4200 },
      },
    ],
  };
}

describe('emptying a numeric field, then saving and reloading', () => {
  it('reloads without the property rather than with NaN', () => {
    const commands = new ProjectCommandDispatcher(projectWithEquipment());
    const equipment = commands.project.equipment![0]!;
    const properties = withProperty(equipment.properties, POWER, '');
    expect(properties).toBeDefined();
    expect(
      commands.dispatch(
        new UpdateEquipmentCommand({ ...equipment, properties: properties! }),
      ).status,
    ).toBe('APPLIED');

    const serialized = serializeProjectFile({
      format: 'house-technical-designer-project',
      schemaVersion: '1.0.0',
      applicationVersion: '0.1.0',
      project: commands.project,
    });
    // NaN has no JSON form: had it been stored, it would have been written as
    // null and read back as a value the project never held.
    expect(serialized).not.toContain('NaN');
    expect(serialized).not.toContain('nominalPowerW');

    const reloaded = loadProjectJson(serialized);
    expect(reloaded.status).toBe('OK');
    if (reloaded.status !== 'OK') return;
    const reloadedEquipment = reloaded.file.project.equipment![0]!;
    expect(reloadedEquipment.properties).not.toHaveProperty('nominalPowerW');
    expect(reloadedEquipment.properties.name).toBe('PAC');
  });

  it('refuses a property that is not a number at all', () => {
    const commands = new ProjectCommandDispatcher(projectWithEquipment());
    const equipment = commands.project.equipment![0]!;
    const rejected = commands.dispatch(
      new UpdateEquipmentCommand({
        ...equipment,
        properties: { ...equipment.properties, nominalPowerW: Number.NaN },
      }),
    );
    expect(rejected.status).toBe('REJECTED');
    if (rejected.status !== 'REJECTED') return;
    expect(rejected.errors[0]).toContain('nominalPowerW');
    expect(commands.project.equipment![0]?.properties.nominalPowerW).toBe(4200);
  });
});
