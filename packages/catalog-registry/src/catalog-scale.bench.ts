import { bench, describe } from 'vitest';
import {
  buildCatalogIndex,
  family,
  propertyDefinition,
  propertySchema,
  syntheticEntries,
  syntheticSummaries,
  validateCatalogEntry,
} from './index.js';

/**
 * The catalogue measured at the size it is meant to reach.
 *
 * Nineteen entries hide every decision that matters. These are the three
 * questions ten thousand asks: how long to arrange them, how long to answer a
 * search over them, and how long the gate takes to read them. Built once,
 * outside the measured loop, so what is timed is the work and not the fixture.
 */
const thousand = syntheticSummaries(1_000);
const tenThousand = syntheticSummaries(10_000);
const indexed = buildCatalogIndex(tenThousand);
const entries = syntheticEntries(1_000);
const known = {
  family,
  schema: propertySchema,
  symbols: new Set<string>(),
  property: propertyDefinition,
};

describe('catalogue at scale', () => {
  bench('index 1 000 summaries', () => {
    buildCatalogIndex(thousand);
  });

  bench('index 10 000 summaries', () => {
    buildCatalogIndex(tenThousand);
  });

  bench('search 10 000 summaries by word', () => {
    indexed.find({ text: 'compact' });
  });

  bench('filter 10 000 summaries by trade and capability', () => {
    indexed.find({ domains: ['HEATING'], capabilities: ['CONNECTABLE'] });
  });

  bench('look one reference up among 10 000', () => {
    indexed.byRef.get('EQUIPMENT:synthetic-radiator-4212@1.42.12');
  });

  bench('validate 1 000 entries against their families', () => {
    for (const entry of entries) validateCatalogEntry(entry, known);
  });
});
