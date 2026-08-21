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
import { SYMBOL_LIBRARY_V1 } from '@house-technical-designer/drawing-engine';
import { genericEquipmentCatalog } from '@house-technical-designer/equipment-catalog';
import {
  NETWORK_PRODUCT_REGISTRY,
  STATUS_AXES,
  axisCounts,
  completeness,
  domainProgress,
  familyReviews,
  pendingOfWave,
} from '@house-technical-designer/catalog-registry';

const reviews = familyReviews({
  symbols: new Set(Object.keys(SYMBOL_LIBRARY_V1.definitions)),
  entries: genericEquipmentCatalog(),
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
