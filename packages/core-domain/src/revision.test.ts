import { describe, expect, it } from 'vitest';
import { nextRevision } from './revision.js';

describe('project revision', () => {
  it('starts at 1 when the project carries none', () => {
    expect(nextRevision(undefined)).toBe('1');
  });

  it('counts up', () => {
    expect(nextRevision('1')).toBe('2');
    expect(nextRevision('9')).toBe('10');
    expect(nextRevision(' 41 ')).toBe('42');
  });

  it('restarts at 1 on a label no counter can read', () => {
    expect(nextRevision('reference-1')).toBe('1');
    expect(nextRevision('v2.1')).toBe('1');
    expect(nextRevision('')).toBe('1');
  });

  it('keeps counting past what a double can hold exactly', () => {
    expect(nextRevision('9007199254740993')).toBe('9007199254740994');
  });
});
