import { describe, expect, it } from 'vitest';
import type { Project } from '@house-technical-designer/core-domain';
import {
  PROJECT_CALCULATION_MODULE_IDS,
  buildProjectCalculationInputs,
  calculationModuleLabel,
  createProjectCalculationContext,
} from '@house-technical-designer/calculation-adapters';
import { demoClimateDatasets, loadDemoProject } from '../demo-project.js';
import {
  MODULE_SETTINGS,
  canEditSetting,
  chosenNumbers,
  keyedTableRows,
  withNumberChoice,
} from './settings-catalog.js';

const ACOUSTICS = MODULE_SETTINGS.find(
  ({ moduleId }) => moduleId === 'acoustics',
);

describe('acoustics octave bands', () => {
  it('offers the bands the module accepts', () => {
    expect(ACOUSTICS?.numberChoices?.[0]?.key).toBe('bandsHz');
    expect(ACOUSTICS?.numberChoices?.[0]?.options).toEqual([
      125, 250, 500, 1000, 2000, 4000,
    ]);
    expect(canEditSetting('acoustics', 'bandsHz')).toBe(true);
  });

  it('adds a band in ascending order and never twice', () => {
    let settings = withNumberChoice({}, 'bandsHz', 1000, true);
    settings = withNumberChoice(settings, 'bandsHz', 250, true);
    settings = withNumberChoice(settings, 'bandsHz', 1000, true);
    expect(settings.bandsHz).toEqual([250, 1000]);
    expect(chosenNumbers(settings, 'bandsHz')).toEqual([250, 1000]);
  });

  it('removes the setting when the last band is unticked', () => {
    const settings = withNumberChoice(
      { bandsHz: [500] },
      'bandsHz',
      500,
      false,
    );
    // An empty list would claim a study covering no band; the module has to
    // report the input as missing instead.
    expect(settings).not.toHaveProperty('bandsHz');
    expect(chosenNumbers(settings, 'bandsHz')).toEqual([]);
  });

  it('reads nothing from a value that is not a list of numbers', () => {
    expect(chosenNumbers({ bandsHz: '500' }, 'bandsHz')).toEqual([]);
    expect(chosenNumbers({ bandsHz: [500, 'mille'] }, 'bandsHz')).toEqual([
      500,
    ]);
  });
});

describe('every setting a module can ask for', () => {
  /**
   * The reference house with no calculation settings at all.
   *
   * Every module then reports what it cannot read, which is the complete list
   * of what the settings screen has to be able to take. A key on that list the
   * screen cannot edit is a « Corriger » that leads nowhere — or, worse, no
   * button at all, which makes the application look as though it lost the
   * input.
   */
  function stripped(): Project {
    const loaded = loadDemoProject();
    if (loaded.status !== 'OK') throw new Error(loaded.message);
    const { calculationSettings: _settings, ...rest } = loaded.file.project;
    return rest;
  }

  it('can be filled in from the settings screen', () => {
    const context = createProjectCalculationContext(stripped(), {
      climate: demoClimateDatasets(),
    });
    const asked = buildProjectCalculationInputs(context).missing.filter(
      ({ expectedOrigin }) => expectedOrigin === 'MODULE_SETTINGS',
    );
    // If the fixture stopped asking for anything, this suite would pass by
    // having nothing to check.
    expect(asked.length).toBeGreaterThan(20);
    const unreachable = asked
      .filter(({ moduleId, key }) => !canEditSetting(moduleId, key))
      .map(({ moduleId, key }) => `${moduleId}/${key}`);
    expect([...new Set(unreachable)].sort()).toEqual([]);
  });

  it('names a table row by its table, which is what the screen offers', () => {
    // A module says `unitPriceByMaterial/material-masonry`; the screen offers
    // the table and one line per material.
    expect(canEditSetting('cost', 'unitPriceByMaterial/material-masonry')).toBe(
      true,
    );
    expect(
      canEditSetting('cost', 'unitPriceByProduct/pipe-copper-16x1.0'),
    ).toBe(true);
    expect(canEditSetting('cost', 'unitPriceByEquipment/equipment-pv')).toBe(
      true,
    );
    // And still says no to a module setting it does not hold.
    expect(canEditSetting('cost', 'inventedByNobody')).toBe(false);
    expect(canEditSetting('cost', 'inventedByNobody/anything')).toBe(false);
  });

  it('offers a line for a room category the project invented', () => {
    // A room's category is a free string in the model; the conventional list
    // cannot be the whole of it, and a category with no line is an occupancy
    // nobody can declare.
    const table = MODULE_SETTINGS.find(
      ({ moduleId }) => moduleId === 'iaq',
    )!.keyedTables!.find(({ key }) => key === 'occupantsByCategory')!;
    const rows = keyedTableRows(table, stripped());
    expect(rows.map(({ key }) => key)).toContain('CIRCULATION');
    // And the conventional ones stay first, in the order they were written.
    expect(rows[0]?.key).toBe('LIVING');
  });

  it('names an occupancy by the setting that fills it, not by the room', () => {
    // Eight rooms of one category are one missing figure, and the screen that
    // takes it offers a line per category.
    const context = createProjectCalculationContext(stripped(), {
      climate: demoClimateDatasets(),
    });
    const keys = buildProjectCalculationInputs(context)
      .missing.filter(({ moduleId }) => moduleId === 'iaq')
      .map(({ key }) => key);
    expect(keys.some((key) => key.startsWith('occupantsByCategory/'))).toBe(
      true,
    );
    expect(keys.some((key) => key.endsWith('/occupants'))).toBe(false);
  });

  it('covers exactly the modules the registry declares', () => {
    // Three lists of the same seventeen things drift, and the drift shows as a
    // settings screen offering a module that no longer runs, or a module that
    // runs with nowhere to set it up.
    expect(MODULE_SETTINGS.map(({ moduleId }) => moduleId).sort()).toEqual(
      [...PROJECT_CALCULATION_MODULE_IDS].sort(),
    );
  });

  it('calls each module what the registry calls it', () => {
    for (const { moduleId, label } of MODULE_SETTINGS)
      expect(label, moduleId).toBe(calculationModuleLabel(moduleId));
  });
});
