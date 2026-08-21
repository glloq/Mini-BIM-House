import { bench, describe } from 'vitest';
import type { Project } from '@house-technical-designer/core-domain';
import { entityId } from '@house-technical-designer/core-domain';
import {
  buildPlanView,
  defaultVisibility,
} from '@house-technical-designer/view-query';
import { loadDemoProject } from './demo-project.js';
import { projectChecks } from './checks/checks-model.js';
import { largeHouse } from './large-house.js';

const HOUSE = largeHouse(3, 40);
const LAYERS = defaultVisibility();

function demo(): Project {
  const result = loadDemoProject();
  if (result.status !== 'OK') throw new Error(result.message);
  return result.file.project;
}

const REFERENCE = demo();
const groundId = entityId<'Level'>('level-0');

describe('a house nobody would call small', () => {
  bench('plan view of one storey of the large house', () => {
    buildPlanView(HOUSE, { levelId: groundId, layers: LAYERS });
  });

  bench('plan view of the reference house', () => {
    buildPlanView(REFERENCE, { levelId: 'ground', layers: LAYERS });
  });

  bench('checks over the whole large house', () => {
    projectChecks(HOUSE, undefined);
  });
});
