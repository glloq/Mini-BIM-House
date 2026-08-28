import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PROJECT_MIGRATIONS,
  migration110To120,
  runMigrationChain,
} from './index.js';
import { loadProjectJson } from './file-io.js';

const oldSource = readFileSync(
  new URL('../test/fixtures/v0.9.0/project.json', import.meta.url),
  'utf8',
);
const expected = JSON.parse(
  readFileSync(
    new URL('../test/fixtures/v1.0.0/project.json', import.meta.url),
    'utf8',
  ),
) as unknown;
/** What loading an old file now produces: the whole chain, not one step. */
const current = JSON.parse(
  readFileSync(
    new URL('../test/fixtures/v1.3.0/project.json', import.meta.url),
    'utf8',
  ),
) as unknown;

describe('project migrations', () => {
  it('migrates the old fixture to the exact current snapshot', () => {
    const original = JSON.parse(oldSource) as unknown;
    const before = structuredClone(original);
    const result = runMigrationChain(
      original,
      '1.0.0',
      DEFAULT_PROJECT_MIGRATIONS,
    );
    expect(result).toMatchObject({
      status: 'OK',
      value: expected,
      journal: [
        { migrationId: 'project-0.9.0-to-1.0.0', from: '0.9.0', to: '1.0.0' },
      ],
    });
    expect(original).toEqual(before);
  });
  it('automatically migrates during load and reports its journal', () => {
    expect(loadProjectJson(oldSource)).toMatchObject({
      status: 'OK',
      file: current,
      migrationJournal: [
        { from: '0.9.0', to: '1.0.0' },
        { from: '1.0.0', to: '1.1.0' },
        { from: '1.1.0', to: '1.2.0' },
        { from: '1.2.0', to: '1.3.0' },
      ],
    });
  });
  it('lifts the catalogue metadata a 1.1.0 file hid inside its properties', () => {
    // The interface used to copy a catalogue entry by writing its identifier
    // and version *inside* `properties`, under names nothing read — so the
    // placement pin looked for `version` at the top and found nothing.
    const before = {
      format: 'house-technical-designer-project',
      schemaVersion: '1.1.0',
      project: {
        equipment: [
          {
            id: 'equipment-tank',
            kind: 'DHW_TANK',
            catalogKind: 'GENERIC',
            properties: {
              name: 'Ballon générique',
              tankVolumeL: 200,
              catalogDefinitionId: 'generic-dhw-tank',
              catalogDefinitionVersion: '1.0.0',
            },
          },
        ],
      },
    };
    const result = migration110To120.migrate(before) as {
      readonly project: {
        readonly equipment: readonly {
          readonly version?: string;
          readonly name?: string;
          readonly properties: Readonly<Record<string, unknown>>;
        }[];
      };
    };
    const [entry] = result.project.equipment;
    expect(entry?.version).toBe('1.0.0');
    expect(entry?.name).toBe('Ballon générique');
    expect(entry?.properties.tankVolumeL).toBe(200);
    // Moved, not copied: two answers to one question is how they disagree.
    expect(entry?.properties.catalogDefinitionId).toBeUndefined();
    expect(entry?.properties.catalogDefinitionVersion).toBeUndefined();
  });

  it('names the kind of a port only where the old file settled it', () => {
    // The cold water leaving a manifold is the cold water arriving at a tap,
    // so that pair is certain. In an extract system a terminal sends extract
    // air out into the duct while the fan sends exhaust air out to the sky:
    // the direction settles nothing, and guessing would make the network
    // claim a fluid nobody chose.
    const before = {
      format: 'house-technical-designer-project',
      schemaVersion: '1.1.0',
      project: {
        systems: [
          {
            id: 'water',
            discipline: 'WATER',
            systemType: 'POTABLE_COLD',
            nodes: [],
            edges: [],
            ports: [
              { id: 'p1', nodeId: 'n1', role: 'FLOW', direction: 'OUT' },
              { id: 'p2', nodeId: 'n2', role: 'FLOW', direction: 'IN' },
            ],
          },
          {
            id: 'vent',
            discipline: 'VENTILATION',
            systemType: 'EXTRACT',
            nodes: [],
            edges: [],
            ports: [{ id: 'p3', nodeId: 'n3', role: 'AIR', direction: 'OUT' }],
          },
        ],
      },
    };
    const result = migration110To120.migrate(before) as {
      readonly project: {
        readonly systems: readonly {
          readonly ports: readonly { readonly portTypeId?: string }[];
        }[];
      };
    };
    expect(
      result.project.systems[0]?.ports.map(({ portTypeId }) => portTypeId),
    ).toEqual(['WATER_COLD', 'WATER_COLD']);
    expect(result.project.systems[1]?.ports[0]?.portTypeId).toBeUndefined();
  });

  it('leaves a port that already names its kind exactly as it is', () => {
    const before = {
      format: 'house-technical-designer-project',
      schemaVersion: '1.1.0',
      project: {
        systems: [
          {
            id: 'water',
            discipline: 'WATER',
            systemType: 'POTABLE_COLD',
            nodes: [],
            edges: [],
            ports: [
              {
                id: 'p1',
                nodeId: 'n1',
                role: 'FLOW',
                direction: 'IN',
                portTypeId: 'WATER_HOT',
              },
            ],
          },
        ],
      },
    };
    const result = migration110To120.migrate(before) as {
      readonly project: {
        readonly systems: readonly {
          readonly ports: readonly { readonly portTypeId?: string }[];
        }[];
      };
    };
    expect(result.project.systems[0]?.ports[0]?.portTypeId).toBe('WATER_HOT');
  });

  it('is deterministic across repeated runs', () => {
    expect(loadProjectJson(oldSource)).toEqual(loadProjectJson(oldSource));
  });
  it('fails explicitly when no sequential path exists', () => {
    const source = oldSource.replace('"0.9.0"', '"0.8.0"');
    expect(loadProjectJson(source, [])).toMatchObject({
      status: 'MIGRATION_ERROR',
      message: expect.stringContaining('No migration path'),
    });
  });
});
