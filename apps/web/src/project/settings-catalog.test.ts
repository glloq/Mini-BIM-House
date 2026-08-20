import { describe, expect, it } from 'vitest';
import {
  MODULE_SETTINGS,
  canEditSetting,
  chosenNumbers,
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
