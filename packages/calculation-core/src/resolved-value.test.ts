import { describe, expect, it } from 'vitest';

import {
  averageResolved,
  describeUnknown,
  known,
  lowerBound,
  mapResolved,
  maxResolved,
  minResolved,
  resolvedNumber,
  sumResolved,
  unknown,
  valueOf,
  type UnknownValue,
} from './resolved-value.js';

describe('a number the project may or may not know', () => {
  it('is what the project stated, or names what it did not', () => {
    expect(resolvedNumber(0.15, 'shower')).toEqual({
      status: 'KNOWN',
      value: 0.15,
    });
    expect(resolvedNumber(undefined, 'basin')).toEqual({
      status: 'UNKNOWN',
      missingSourceIds: ['basin'],
    });
  });

  it('keeps zero as a number, because zero is an answer', () => {
    expect(valueOf(resolvedNumber(0, 'closed-valve'))).toBe(0);
    expect(valueOf(resolvedNumber(undefined, 'basin'))).toBeUndefined();
  });
});

describe('adding them up', () => {
  it('adds two known values', () => {
    expect(sumResolved([known(0.15), known(0.2)])).toEqual({
      status: 'KNOWN',
      value: 0.15 + 0.2,
    });
  });

  it('is unknown as soon as one term is, and says what is missing', () => {
    // A pipe fed by a shower at 0,15 L/s and a basin nobody described used to
    // come out at 0,15 L/s — the total, unmarked, and wrong.
    const pipe = sumResolved([
      known(0.15),
      resolvedNumber(undefined, 'node-basin'),
    ]);
    expect(pipe.status).toBe('UNKNOWN');
    expect(lowerBound(pipe)).toBeCloseTo(0.15);
    expect((pipe as UnknownValue).missingSourceIds).toEqual(['node-basin']);
  });

  it('names each missing source once, however many branches carry it', () => {
    const total = sumResolved([
      unknown(['node-basin']),
      unknown(['node-basin', 'node-sink']),
    ]);
    expect((total as UnknownValue).missingSourceIds).toEqual([
      'node-basin',
      'node-sink',
    ]);
  });

  it('adds nothing to nothing without inventing a number', () => {
    expect(sumResolved([])).toEqual({ status: 'KNOWN', value: 0 });
    expect(sumResolved([unknown(['a'])]).status).toBe('UNKNOWN');
  });
});

describe('the other aggregations', () => {
  it('takes the largest, and stays unknown when a bigger one may hide', () => {
    expect(maxResolved([known(3), known(7)])).toEqual({
      status: 'KNOWN',
      value: 7,
    });
    const guessed = maxResolved([known(7), unknown(['b'])]);
    expect(guessed.status).toBe('UNKNOWN');
    expect((guessed as UnknownValue).knownPartial).toBe(7);
  });

  it('takes the smallest, which is usually the one that sizes something', () => {
    expect(minResolved([known(3), known(7)])).toEqual({
      status: 'KNOWN',
      value: 3,
    });
    expect(minResolved([unknown(['b'])]).status).toBe('UNKNOWN');
  });

  it('averages what it has, and says so when it has not got all of it', () => {
    expect(averageResolved([known(2), known(4)])).toEqual({
      status: 'KNOWN',
      value: 3,
    });
    const partial = averageResolved([known(2), unknown(['b'])]);
    expect(partial.status).toBe('UNKNOWN');
    expect((partial as UnknownValue).knownPartial).toBe(1);
    expect(averageResolved([]).status).toBe('UNKNOWN');
  });

  it('carries an unknown through a conversion rather than losing it', () => {
    const litres = mapResolved(unknown(['b'], 0.15), (value) => value * 3600);
    expect(litres.status).toBe('UNKNOWN');
    expect((litres as UnknownValue).knownPartial).toBeCloseTo(540);
    expect(mapResolved(known(2), (value) => value * 3)).toEqual({
      status: 'KNOWN',
      value: 6,
    });
  });
});

describe('what an unknown says out loud', () => {
  it('names the objects to go and fix, not the calculation that stopped', () => {
    expect(describeUnknown(unknown(['node-basin']) as UnknownValue)).toContain(
      'node-basin',
    );
    expect(
      describeUnknown(unknown(['node-basin'], 0.15) as UnknownValue),
    ).toContain('au moins 0.15');
  });

  it('stops naming after a few, rather than printing a hundred', () => {
    const many = unknown(['a', 'b', 'c', 'd', 'e', 'f']) as UnknownValue;
    expect(describeUnknown(many)).toContain('2 autre(s)');
  });

  it('says something even when there was nothing to add', () => {
    expect(describeUnknown(unknown([]) as UnknownValue)).toContain(
      'rien à additionner',
    );
  });
});
