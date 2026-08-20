import { describe, expect, it } from 'vitest';
import type { Project } from '@house-technical-designer/core-domain';
import {
  ProjectCommandDispatcher,
  UpdateModuleSettingsCommand,
  UpdateProjectMetadataCommand,
  UpdateRegulatoryContextCommand,
  UpdateSiteCommand,
} from './index.js';

function project(): Project {
  return {
    metadata: {
      name: 'Maison',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      description: 'Première version',
    },
    site: { northAngleDeg: 0 },
    building: { levels: [], zones: [] },
    calculationSettings: {},
  } as unknown as Project;
}

describe('project settings commands', () => {
  it('renames the project and clears a description without inventing one', () => {
    const dispatcher = new ProjectCommandDispatcher(project());
    expect(
      dispatcher.dispatch(
        new UpdateProjectMetadataCommand({
          name: 'Maison Dupont',
          description: null,
        }),
      ).status,
    ).toBe('APPLIED');
    expect(dispatcher.project.metadata.name).toBe('Maison Dupont');
    expect(dispatcher.project.metadata).not.toHaveProperty('description');
    expect(dispatcher.undo().status).toBe('APPLIED');
    expect(dispatcher.project.metadata.description).toBe('Première version');
  });

  it('refuses an empty project name', () => {
    const dispatcher = new ProjectCommandDispatcher(project());
    expect(
      dispatcher.dispatch(new UpdateProjectMetadataCommand({ name: '  ' }))
        .status,
    ).toBe('REJECTED');
  });

  it('stores a location only when both coordinates are given', () => {
    const dispatcher = new ProjectCommandDispatcher(project());
    expect(
      dispatcher.dispatch(new UpdateSiteCommand({ latitudeDeg: 48.1 })).status,
    ).toBe('REJECTED');
    expect(
      dispatcher.dispatch(
        new UpdateSiteCommand({ latitudeDeg: 48.1, longitudeDeg: -4.1 }),
      ).status,
    ).toBe('APPLIED');
    expect(dispatcher.project.site.location).toEqual({
      latitudeDeg: 48.1,
      longitudeDeg: -4.1,
    });
  });

  it('refuses an orientation outside a full turn', () => {
    const dispatcher = new ProjectCommandDispatcher(project());
    expect(
      dispatcher.dispatch(new UpdateSiteCommand({ northAngleDeg: 400 })).status,
    ).toBe('REJECTED');
    expect(
      dispatcher.dispatch(new UpdateSiteCommand({ northAngleDeg: 15 })).status,
    ).toBe('APPLIED');
    expect(dispatcher.project.site.northAngleDeg).toBe(15);
  });

  it('records and clears the climate dataset the project expects', () => {
    const dispatcher = new ProjectCommandDispatcher(project());
    dispatcher.dispatch(new UpdateSiteCommand({ climateProfileId: 'quimper' }));
    expect(dispatcher.project.site.climateProfileId).toBe('quimper');
    dispatcher.dispatch(new UpdateSiteCommand({ climateProfileId: null }));
    expect(dispatcher.project.site).not.toHaveProperty('climateProfileId');
  });

  it('refuses a reference date that is not a date', () => {
    const dispatcher = new ProjectCommandDispatcher(project());
    expect(
      dispatcher.dispatch(
        new UpdateRegulatoryContextCommand({ referenceDate: 'bientôt' }),
      ).status,
    ).toBe('REJECTED');
    expect(
      dispatcher.dispatch(
        new UpdateRegulatoryContextCommand({
          country: 'FR',
          referenceDate: '2026-01-01',
        }),
      ).status,
    ).toBe('APPLIED');
    expect(dispatcher.project.regulatoryContext?.referenceDate).toBe(
      '2026-01-01',
    );
  });

  it('writes one module settings entry without touching the others', () => {
    const dispatcher = new ProjectCommandDispatcher(project());
    dispatcher.dispatch(
      new UpdateModuleSettingsCommand('thermal', '2.0.0', 'simplified', {
        indoorTemperatureC: 19,
      }),
    );
    dispatcher.dispatch(
      new UpdateModuleSettingsCommand('cost', '2.0.0', 'unit-price', {
        currency: 'EUR',
      }),
    );
    expect(Object.keys(dispatcher.project.calculationSettings ?? {})).toEqual([
      'thermal',
      'cost',
    ]);
    expect(dispatcher.project.calculationSettings?.thermal?.settings).toEqual({
      indoorTemperatureC: 19,
    });
    expect(dispatcher.undo().status).toBe('APPLIED');
    expect(Object.keys(dispatcher.project.calculationSettings ?? {})).toEqual([
      'thermal',
    ]);
  });

  it('refuses a module settings entry with no method', () => {
    const dispatcher = new ProjectCommandDispatcher(project());
    expect(
      dispatcher.dispatch(
        new UpdateModuleSettingsCommand('thermal', '2.0.0', '', {}),
      ).status,
    ).toBe('REJECTED');
  });
});
