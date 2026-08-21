#!/usr/bin/env node
/**
 * What the data of this application still owes, family by family.
 *
 * Five hundred families is a size, not a plan. This turns the registry into
 * the one thing that makes such a size workable: a queue where each line says
 * what it is, what reads it, and how far it has got — so that two people, or
 * two agents, can pick up two different families without meeting.
 *
 * Nothing here computes a percentage of « done » for the project. Every axis
 * weighs the same on purpose: a family with a symbol and no model is not
 * further along than one with a model and no symbol.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const FAMILY_DIR = 'packages/catalog-registry/data/families';
const AXES = [
  'MODEL',
  'PROPERTIES',
  'PORTS',
  'PLACEMENT',
  'PLAN_SYMBOL',
  'ELEVATION_SYMBOL',
  'SCHEMATIC_SYMBOL',
  'NETWORK',
  'CALCULATION',
  'QUANTITIES',
  'COST',
  'CARBON',
  'RULES',
  'TESTS',
  'GENERIC_DATA',
  'PRODUCT_DATA',
];
const WEIGHT = { NONE: 0, PARTIAL: 1, READY: 2, VALIDATED: 3 };

const families = readdirSync(FAMILY_DIR)
  .filter((name) => name.endsWith('.json'))
  .flatMap(
    (name) => JSON.parse(readFileSync(join(FAMILY_DIR, name), 'utf8')).families,
  );

const completeness = (status = {}) =>
  AXES.reduce((sum, axis) => sum + WEIGHT[status[axis] ?? 'NONE'], 0) /
  (AXES.length * WEIGHT.VALIDATED);

const wave = Number(process.argv[2]);
const chosen = Number.isFinite(wave)
  ? families.filter((family) => family.priority === wave)
  : families;

const byDomain = new Map();
for (const family of chosen) {
  const entry = byDomain.get(family.domain) ?? { count: 0, total: 0 };
  entry.count += 1;
  entry.total += completeness(family.status);
  byDomain.set(family.domain, entry);
}

const percent = (value) => `${(value * 100).toFixed(0)} %`;
console.log(
  Number.isFinite(wave)
    ? `Vague ${wave} — ${chosen.length} familles`
    : `Nomenclature — ${families.length} familles`,
);
console.log('');
console.log('Domaine                Familles   Avancement');
for (const [domain, { count, total }] of [...byDomain].sort())
  console.log(
    `${domain.padEnd(22)} ${String(count).padStart(8)}   ${percent(total / count).padStart(10)}`,
  );

console.log('');
console.log('Axe                       NONE  PARTIAL   READY  VALIDATED');
for (const axis of AXES) {
  const counts = { NONE: 0, PARTIAL: 0, READY: 0, VALIDATED: 0 };
  for (const family of chosen) counts[family.status?.[axis] ?? 'NONE'] += 1;
  console.log(
    `${axis.padEnd(24)} ${String(counts.NONE).padStart(5)} ${String(counts.PARTIAL).padStart(8)} ${String(counts.READY).padStart(7)} ${String(counts.VALIDATED).padStart(10)}`,
  );
}

const pending = chosen
  .filter((family) => completeness(family.status) < 1)
  .sort(
    (first, second) =>
      completeness(first.status) - completeness(second.status) ||
      first.id.localeCompare(second.id),
  );
console.log('');
console.log(`${pending.length} familles à traiter. Les dix premières :`);
for (const family of pending.slice(0, 10))
  console.log(
    `  ${family.id.padEnd(34)} ${family.domain.padEnd(14)} vague ${family.priority}   ${percent(completeness(family.status))}`,
  );
