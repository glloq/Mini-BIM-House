#!/usr/bin/env node
/**
 * Licence audit of every installed dependency.
 *
 * The application is distributed under AGPL-3.0-only, so a dependency has to be
 * one the AGPL can incorporate. The audit reads the licence declared by each
 * package actually installed — the lockfile says what is installed, the
 * installed `package.json` says under what terms — and refuses anything that is
 * neither permissive, nor copyleft the AGPL absorbs, nor explicitly reviewed.
 *
 * It never guesses: a package with no licence field is reported as unknown and
 * fails the audit rather than being assumed permissive.
 */
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(import.meta.dirname, '..');

/** Licences the AGPL can incorporate without further thought. */
const ALLOWED = new Set([
  '0BSD',
  'AGPL-3.0-only',
  'AGPL-3.0-or-later',
  'Apache-2.0',
  'Artistic-2.0',
  'BlueOak-1.0.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'CC0-1.0',
  'GPL-2.0-or-later',
  'GPL-3.0-only',
  'GPL-3.0-or-later',
  'ISC',
  'LGPL-2.1-or-later',
  'LGPL-3.0-only',
  'LGPL-3.0-or-later',
  'MIT',
  'MIT-0',
  'MPL-2.0',
  'Python-2.0',
  'Unlicense',
  'WTFPL',
  'Zlib',
]);

/**
 * Packages whose declared expression this audit cannot parse but whose terms
 * have been read. Each entry says why, so the exception is reviewable.
 */
const REVIEWED = new Map([
  [
    'caniuse-lite',
    'Données sous CC-BY-4.0, utilisées à la construction et non redistribuées.',
  ],
]);

function normalise(license) {
  if (typeof license === 'string') return license.trim();
  if (license !== null && typeof license === 'object' && 'type' in license)
    return String(license.type).trim();
  return undefined;
}

/** Splits `(MIT OR Apache-2.0)` into the alternatives it offers. */
function alternatives(expression) {
  return expression
    .replaceAll('(', ' ')
    .replaceAll(')', ' ')
    .split(/\s+(?:OR|AND)\s+/u)
    .map((part) => part.trim())
    .filter((part) => part !== '');
}

function verdict(name, expression) {
  if (REVIEWED.has(name)) return 'REVIEWED';
  if (expression === undefined) return 'UNKNOWN';
  const parts = alternatives(expression);
  if (parts.length === 0) return 'UNKNOWN';
  return parts.some((part) => ALLOWED.has(part)) ? 'ALLOWED' : 'REFUSED';
}

const lock = JSON.parse(
  await readFile(path.join(root, 'package-lock.json'), 'utf8'),
);

const findings = [];
for (const [location, entry] of Object.entries(lock.packages ?? {})) {
  // The workspace's own packages carry the project's licence by definition.
  if (location === '' || entry.link === true) continue;
  if (!location.startsWith('node_modules/')) continue;
  const manifestPath = path.join(root, location, 'package.json');
  if (!existsSync(manifestPath)) continue;
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const expression =
    normalise(manifest.license) ??
    (Array.isArray(manifest.licenses)
      ? manifest.licenses.map(normalise).filter(Boolean).join(' OR ')
      : undefined);
  const name = manifest.name ?? location.replace(/^node_modules\//u, '');
  findings.push({
    name,
    version: manifest.version ?? entry.version ?? 'inconnue',
    license: expression ?? '—',
    verdict: verdict(name, expression),
    development: entry.dev === true,
  });
}

findings.sort(
  (first, second) =>
    first.name.localeCompare(second.name) ||
    first.version.localeCompare(second.version),
);

const byVerdict = (wanted) => findings.filter((one) => one.verdict === wanted);
const refused = byVerdict('REFUSED');
const unknown = byVerdict('UNKNOWN');

const counts = new Map();
for (const finding of findings)
  counts.set(finding.license, (counts.get(finding.license) ?? 0) + 1);

console.log(`${findings.length} paquets installés audités.\n`);
console.log('Licences déclarées :');
for (const [license, count] of [...counts].sort(
  (first, second) => second[1] - first[1] || first[0].localeCompare(second[0]),
))
  console.log(`  ${String(count).padStart(4)}  ${license}`);

if (byVerdict('REVIEWED').length > 0) {
  console.log('\nExceptions revues :');
  for (const finding of byVerdict('REVIEWED'))
    console.log(`  ${finding.name} — ${REVIEWED.get(finding.name)}`);
}

if (refused.length === 0 && unknown.length === 0) {
  console.log(
    '\nAucune licence incompatible avec AGPL-3.0-only, aucune licence inconnue.',
  );
  process.exit(0);
}

if (refused.length > 0) {
  console.error('\nLicences refusées :');
  for (const finding of refused)
    console.error(
      `  ${finding.name}@${finding.version} — ${finding.license}${finding.development ? ' (développement)' : ''}`,
    );
}
if (unknown.length > 0) {
  console.error('\nLicences non déclarées :');
  for (const finding of unknown)
    console.error(
      `  ${finding.name}@${finding.version}${finding.development ? ' (développement)' : ''}`,
    );
}
console.error(
  '\nUne licence inconnue n’est pas une licence permissive : lisez les termes,' +
    ' puis ajoutez le paquet à ALLOWED ou à REVIEWED avec la raison.',
);
process.exit(1);
