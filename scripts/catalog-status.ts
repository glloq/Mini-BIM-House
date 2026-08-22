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
 *
 * It used to read the data files itself and print the statuses somebody had
 * typed into them. Seventy-one families said their plan symbol was ready and
 * not one of them named a symbol, and this is where that was on show. It now
 * asks the registry, which measures five of the sixteen axes rather than
 * believing them.
 */
import { readFileSync } from 'node:fs';
import { SYMBOL_LIBRARY_V1 } from '@house-technical-designer/drawing-engine';
import { genericEquipmentCatalog } from '@house-technical-designer/equipment-catalog';
import {
  FAMILY_REGISTRY,
  NETWORK_PRODUCT_REGISTRY,
  STATUS_AXES,
  axisCounts,
  catalogEvidence,
  completeness,
  currentCatalogManifest,
  domainProgress,
  familiesExercisedBy,
  familyReviews,
  pendingOfWave,
  qualificationHouse,
} from '@house-technical-designer/catalog-registry';

/**
 * What the reference house is actually made of.
 *
 * The `TESTS` axis used to be set from « a catalogue entry of this family
 * passes the gate », which is what `GENERIC_DATA` already says: three hundred
 * families were reported as tested because somebody had written a fiche, and
 * nothing anywhere exercised one. A family is tested when a fixture in this
 * repository holds an object of it — and the reference house is that fixture.
 */
const reference = JSON.parse(
  readFileSync('examples/reference-house/reference.houseproj.json', 'utf8'),
) as { readonly project: Parameters<typeof familiesExercisedBy>[0] };

/**
 * Two fixtures, because they prove two different things.
 *
 * The reference house is a house: it holds four families, because that is what
 * a house holds, and what it proves is that they work together. The
 * qualification house is one of each, and what it proves is narrower and worth
 * proving too — that every entry the application ships can be carried by a
 * project the importer accepts.
 */
const exercised = new Set([
  ...familiesExercisedBy(reference.project),
  ...familiesExercisedBy(qualificationHouse()),
]);

/**
 * What every registry ships, not what one of them ships.
 *
 * `entries` is the equipment catalogue, so `GENERIC_DATA` was measured from
 * equipment alone: fifty-nine materials, thirty-four menuiseries and
 * thirty-five build-ups existed and every one of their families still read
 * « personne n'a écrit de fiche ». The evidence the interface already builds
 * counts all six.
 */
const evidence = catalogEvidence();

const reviews = familyReviews({
  symbols: new Set(Object.keys(SYMBOL_LIBRARY_V1.definitions)),
  entries: genericEquipmentCatalog(),
  evidence,
  exercised,
});

const wave = Number(process.argv[2]);
const chosen = Number.isFinite(wave)
  ? reviews.filter(({ family }) => family.priority === wave)
  : reviews;

const percent = (value: number): string => `${(value * 100).toFixed(0)} %`;
console.log(
  Number.isFinite(wave)
    ? `Vague ${wave} — ${chosen.length} familles`
    : `Nomenclature — ${reviews.length} familles`,
);

console.log('');
console.log('Domaine                Familles   Avancement');
for (const { domain, families, completeness: done } of domainProgress(chosen))
  console.log(
    `${domain.padEnd(22)} ${String(families).padStart(8)}   ${percent(done).padStart(10)}`,
  );

console.log('');
console.log('Axe                       NONE  PARTIAL   READY  VALIDATED');
const counted = new Map(
  axisCounts(chosen).map((entry) => [entry.axis, entry.counts]),
);
for (const axis of STATUS_AXES) {
  const counts = counted.get(axis)!;
  console.log(
    `${axis.padEnd(24)} ${String(counts.NONE).padStart(5)} ${String(counts.PARTIAL).padStart(8)} ${String(counts.READY).padStart(7)} ${String(counts.VALIDATED).padStart(10)}`,
  );
}

if (!Number.isFinite(wave)) {
  // Every registry, not one of them. This counted the network products and
  // said nothing of the five other catalogues, so « où en est le catalogue »
  // had an answer about tubes and silence about everything else.
  const manifest = currentCatalogManifest();
  console.log('');
  console.log(`Catalogues installés — publication ${manifest.releaseId}`);
  console.log('Registre                Fiches   Empreinte');
  for (const entry of manifest.generatedFrom)
    console.log(
      `${entry.registry.padEnd(22)} ${String(entry.entryCount).padStart(7)}   ${entry.fingerprint}`,
    );

  const byFamily = new Map<string, number>();
  for (const product of NETWORK_PRODUCT_REGISTRY)
    byFamily.set(product.family, (byFamily.get(product.family) ?? 0) + 1);
  console.log('');
  console.log(
    `Produits de réseau catalogués : ${NETWORK_PRODUCT_REGISTRY.length}`,
  );
  for (const [family, count] of [...byFamily].sort())
    console.log(`  ${family.padEnd(24)} ${String(count).padStart(4)}`);
}

if (!Number.isFinite(wave)) {
  // A wave is the unit the filling is organised in, so « où en est la vague 3 »
  // has to have an answer without running the script six times.
  console.log('');
  console.log('Vague   Familles   Avec fiche   Sans fiche');
  const waves = [
    ...new Set(FAMILY_REGISTRY.map(({ priority }) => priority)),
  ].sort();
  for (const priority of waves) {
    const held = FAMILY_REGISTRY.filter((entry) => entry.priority === priority);
    const filled = held.filter(
      (entry) => (evidence.get(entry.id)?.entryCount ?? 0) > 0,
    ).length;
    console.log(
      `${String(priority).padEnd(7)} ${String(held.length).padStart(8)} ${String(filled).padStart(12)} ${String(held.length - filled).padStart(12)}`,
    );
  }
}

const pending = Number.isFinite(wave)
  ? pendingOfWave(reviews, wave)
  : [...chosen]
      .filter(({ status }) => completeness(status) < 1)
      .sort(
        (first, second) =>
          completeness(first.status) - completeness(second.status) ||
          first.family.id.localeCompare(second.family.id),
      );
console.log('');
console.log(`${pending.length} familles à traiter. Les dix premières :`);
for (const { family, status } of pending.slice(0, 10))
  console.log(
    `  ${family.id.padEnd(34)} ${family.domain.padEnd(14)} vague ${family.priority}   ${percent(completeness(status))}`,
  );
