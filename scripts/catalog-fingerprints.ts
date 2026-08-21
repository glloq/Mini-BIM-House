/**
 * Records what each catalogue entry says, so that saying something else
 * requires saying so.
 *
 * A version is a promise. `generic-battery@1.0.0` has to mean the same figures
 * today as it did when a project pinned it; without a record of what it said,
 * a fiche could be corrected in place and every project holding the old pin
 * would silently design with the new numbers while claiming the old ones.
 *
 * Run this after a deliberate change, having raised the version. If the
 * version has not moved, the gate will say so rather than let the record be
 * rewritten under it.
 *
 * Taken over the entries as their files state them, which is what the gate
 * reads: a fingerprint of the loader's output would move whenever the loader
 * changed, and say nothing about the data.
 */
import { writeFileSync } from 'node:fs';
import { rawGenericEquipmentEntries } from '@house-technical-designer/equipment-catalog';
import { catalogFingerprints } from '@house-technical-designer/catalog-registry';

const PATH = 'packages/catalog-registry/data/fingerprints.json';
const entries = catalogFingerprints(rawGenericEquipmentEntries());
writeFileSync(PATH, `${JSON.stringify({ entries }, undefined, 2)}\n`);
console.log(`${Object.keys(entries).length} fiches enregistrées dans ${PATH}.`);
