import { describe, expect, it } from 'vitest';
import { entityId, type Project } from '@house-technical-designer/core-domain';
import {
  AddZoneCommand,
  ProjectCommandDispatcher,
  RemoveSpaceCommand,
  RemoveZoneCommand,
  SetZoneMembershipCommand,
  UpdateZoneCommand,
  projectZones,
} from './index.js';

function project(): Project {
  return {
    id: entityId<'Project'>('project'),
    metadata: {
      name: 'Zones',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
    site: { northAngleDeg: 0 },
    building: {
      levels: [
        {
          id: entityId<'Level'>('ground'),
          name: 'Rez-de-chaussée',
          elevationMm: 0,
          defaultStoreyHeightMm: 2500,
          walls: [],
          openings: [],
          slabs: [],
          roofs: [],
          stairs: [],
          annotations: [],
          spaces: [
            {
              id: entityId<'Space'>('kitchen'),
              type: 'SPACE',
              levelId: entityId<'Level'>('ground'),
              name: 'Cuisine',
              category: 'KITCHEN',
              boundaryMode: 'AUTOMATIC',
            },
          ],
        },
      ],
      zones: [],
    },
  } as unknown as Project;
}

function withZone(): ProjectCommandDispatcher {
  const commands = new ProjectCommandDispatcher(project());
  commands.dispatch(
    new AddZoneCommand({
      id: 'zone-thermique',
      name: 'Volume chauffé',
      type: 'THERMAL',
    }),
  );
  return commands;
}

describe('grouping rooms into zones', () => {
  it('creates a zone that groups nothing yet', () => {
    const commands = withZone();
    expect(projectZones(commands.project)).toEqual([
      {
        id: 'zone-thermique',
        type: 'THERMAL',
        name: 'Volume chauffé',
        spaceIds: [],
        properties: {},
      },
    ]);
  });

  it('refuses a zone with no name and an unknown type', () => {
    const commands = new ProjectCommandDispatcher(project());
    expect(
      commands.dispatch(
        new AddZoneCommand({ id: 'z', name: '  ', type: 'THERMAL' }),
      ).status,
    ).toBe('REJECTED');
    expect(
      commands.dispatch(
        new AddZoneCommand({
          id: 'z',
          name: 'Zone',
          type: 'INVENTED' as never,
        }),
      ).status,
    ).toBe('REJECTED');
  });

  it('puts a room in and takes it back out', () => {
    const commands = withZone();
    commands.dispatch(
      new SetZoneMembershipCommand('zone-thermique', 'kitchen', true),
    );
    expect(projectZones(commands.project)[0]?.spaceIds).toEqual(['kitchen']);
    commands.dispatch(
      new SetZoneMembershipCommand('zone-thermique', 'kitchen', false),
    );
    expect(projectZones(commands.project)[0]?.spaceIds).toEqual([]);
  });

  it('never names a room the project does not hold', () => {
    const commands = withZone();
    expect(
      commands.dispatch(
        new SetZoneMembershipCommand('zone-thermique', 'attic', true),
      ).status,
    ).toBe('REJECTED');
  });

  it('lets a room be deleted once no zone holds it', () => {
    const commands = withZone();
    commands.dispatch(
      new SetZoneMembershipCommand('zone-thermique', 'kitchen', true),
    );
    // The room is protected while it belongs to a zone; the panel is where the
    // user takes it out, and then deletion goes through.
    expect(
      commands.dispatch(new RemoveSpaceCommand('ground', 'kitchen')).status,
    ).toBe('REJECTED');
    commands.dispatch(
      new SetZoneMembershipCommand('zone-thermique', 'kitchen', false),
    );
    expect(
      commands.dispatch(new RemoveSpaceCommand('ground', 'kitchen')).status,
    ).toBe('APPLIED');
  });

  it('renames, retypes and removes a zone, undoing each step', () => {
    const commands = withZone();
    commands.dispatch(
      new UpdateZoneCommand('zone-thermique', {
        name: 'Volume chauffé principal',
        type: 'VENTILATION',
      }),
    );
    expect(projectZones(commands.project)[0]).toMatchObject({
      name: 'Volume chauffé principal',
      type: 'VENTILATION',
    });
    commands.dispatch(new RemoveZoneCommand('zone-thermique'));
    expect(projectZones(commands.project)).toEqual([]);
    commands.undo();
    expect(projectZones(commands.project)).toHaveLength(1);
  });
});
