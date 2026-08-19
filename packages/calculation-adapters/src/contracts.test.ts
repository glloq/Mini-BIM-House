import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { beforeAll, describe, expect, it } from 'vitest';
import { CalculationOrchestrator } from '@house-technical-designer/calculation-core';
import type { RulePack } from '@house-technical-designer/rule-engine';
import { createPreReferenceProject } from './pre-reference-fixture.js';
import { thermalAdapter } from './modules.js';

const ajv = new Ajv2020({ allErrors: true, strict: true });
const schemaDirectory = fileURLToPath(
  new URL('../../../schemas/', import.meta.url),
);
beforeAll(async () => {
  for (const file of (await readdir(schemaDirectory)).filter((name) =>
    name.endsWith('.schema.json'),
  )) {
    const parsed: unknown = JSON.parse(
      await readFile(join(schemaDirectory, file), 'utf8'),
    );
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
      throw new TypeError(`${file} must contain a JSON Schema object.`);
    ajv.addSchema(parsed);
  }
});
function satisfies(schema: string, value: unknown): void {
  const validate = ajv.getSchema(
    `https://house-technical-designer.local/schemas/${schema}`,
  )!;
  expect(validate(value), ajv.errorsText(validate.errors)).toBe(true);
}

describe('TypeScript/runtime schema contracts', () => {
  it('keeps ProjectFile, material, assembly, building elements, network and module settings aligned', () => {
    const file = createPreReferenceProject();
    const project = file.project;
    const level = project.building.levels[0]!;
    satisfies('project.schema.json', file);
    satisfies('material.schema.json', project.materialLibrary!.materials[0]);
    satisfies('assembly.schema.json', project.assemblies![0]);
    for (const element of [
      ...level.walls,
      ...level.openings,
      ...level.slabs,
      ...level.roofs,
      ...level.spaces,
    ])
      satisfies('building-element.schema.json', element);
    satisfies('network.schema.json', project.systems![0]);
    satisfies('module-settings.schema.json', {
      moduleId: 'thermal',
      moduleVersion: '1.0.0',
      methodId: 'assembly-u-value-v1',
      precisionTarget: 'ENGINEERING',
      settings: {},
    });
  });

  it('keeps RulePack and real CalculationResult aligned', async () => {
    const pack: RulePack = {
      id: 'fixture',
      version: '1.0.0',
      jurisdiction: { country: 'FR' },
      validity: {},
      references: [],
      rules: [
        {
          id: 'wall',
          severity: 'ERROR',
          appliesTo: 'Wall',
          referenceIds: [],
          evaluator: { type: 'DECLARATIVE', expression: true },
        },
      ],
    };
    satisfies('rule-pack.schema.json', pack);
    const engine = new CalculationOrchestrator();
    engine.register(thermalAdapter);
    const run = await engine.calculateModule(
      'thermal',
      { thermal: { areaM2: 100, thicknessM: 0.2, lambdaWmK: 0.04 } },
      {},
    );
    expect(run.status).toBe('OK');
    if (run.status === 'OK')
      satisfies('calculation-result.schema.json', run.result);
  });
});
