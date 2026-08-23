/**
 * Rebuilds the reference house's equipment from the catalogue.
 *
 * The main fixture predates the catalogue. Its nine pieces of equipment carried
 * `kind: 'PHOTOVOLTAIC'` — the taxonomy `familyId` replaced — no version, no
 * provenance, no ports and no dimensions. So the house exercised four families,
 * all of them network products picked up from its runs, and its own equipment
 * exercised none: `familiesExercisedBy` reads `familyId`, and there was none to
 * read. The README said it held « un objet de chaque famille », which had been
 * measured against nothing for as long as the axis existed.
 *
 * The copies now come through `equipmentSnapshot` — the same constructor the
 * interface uses when somebody places a fiche — so the fixture exercises what
 * the application ships rather than a shape nobody writes any more. And the
 * heating, which the house did not have at all, arrives with it: a house with
 * no generator and no emitter is not a house a thermal calculation has
 * anything to say about.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { isHostType } from '@house-technical-designer/core-domain';
import { equipmentSnapshot } from '@house-technical-designer/equipment-catalog/snapshot';
import {
  projectOpeningFromCatalog,
  rawGenericOpeningEntries,
} from '@house-technical-designer/opening-catalog';
import {
  family,
  familyCapabilities,
  genericCatalog,
} from '../packages/catalog-registry/src/registry.js';

const FILE = 'examples/reference-house/reference.houseproj.json';

/**
 * What this house is made of, by catalogue identifier.
 *
 * A house, not one of each: that is the qualification house's job. What this
 * list has to be is a dwelling somebody could live in — a generator, emitters
 * in the rooms that need them, the water it drinks and the water it drains,
 * the board that feeds it and the sockets it feeds.
 */
const HELD: readonly { readonly id: string; readonly why: string }[] = [
  // Chauffage — la maison n'en avait aucun.
  { id: 'generic-air-water-heat-pump', why: 'la génération' },
  { id: 'generic-heating-buffer-tank', why: 'le tampon hydraulique' },
  { id: 'generic-circulator-pump', why: 'la circulation' },
  { id: 'generic-radiator', why: 'les émetteurs' },
  { id: 'generic-towel-radiator', why: 'les émetteurs des salles d’eau' },
  // Eau chaude, ventilation, eaux pluviales : déjà là, mais sans identité.
  { id: 'generic-dhw-tank', why: 'l’eau chaude sanitaire' },
  // Simple flux, parce que c'est ce que le réseau dessine : des bouches
  // d'extraction, des entrées d'air en menuiserie qui ne sont raccordées à
  // rien, et un transfert sous la porte du palier. Un groupe double flux
  // souffle son air par des gaines, et la maison n'en a pas — les deux fiches
  // disent leur `systemType`, personne ne les comparait, et la maison en
  // déclarait un et en était l'autre.
  { id: 'generic-extract-ventilation-unit', why: 'la ventilation simple flux' },
  { id: 'generic-air-terminal', why: 'les bouches' },
  { id: 'generic-rainwater-tank', why: 'la récupération' },
  // Sanitaires — la maison a une salle de bains et une cuisine.
  { id: 'generic-washbasin', why: 'le lavabo' },
  { id: 'generic-shower-tray', why: 'la douche' },
  { id: 'generic-wc', why: 'les WC' },
  { id: 'generic-kitchen-sink', why: 'l’évier' },
  // Électricité — le tableau et ce qu'il alimente.
  { id: 'generic-distribution-board', why: 'le tableau' },
  { id: 'generic-miniature-circuit-breaker', why: 'les protections' },
  { id: 'generic-socket', why: 'les prises' },
  { id: 'generic-led-luminaire', why: 'l’éclairage' },
  // Production et stockage.
  { id: 'generic-pv-array', why: 'le champ photovoltaïque' },
  { id: 'generic-inverter', why: 'l’onduleur' },
  { id: 'generic-battery-rack', why: 'la batterie' },
];

const catalogue = new Map(genericCatalog().map((entry) => [entry.id, entry]));
const missing = HELD.filter(({ id }) => !catalogue.has(id));
if (missing.length > 0) {
  console.error(
    `Fiches absentes du catalogue : ${missing.map(({ id }) => id).join(', ')}`,
  );
  process.exit(1);
}

const equipment = HELD.map(({ id }) => {
  const entry = catalogue.get(id)!;
  return equipmentSnapshot(entry, {
    id,
    allowedHosts: (
      family(entry.familyId)?.placement?.allowedHosts ?? []
    ).filter(isHostType),
    requiredClearances: family(entry.familyId)?.clearances ?? [],
    capabilities: familyCapabilities(entry.familyId),
  });
});

/**
 * The menuiseries its windows are drawn with.
 *
 * The house had none. Its openings named `generic-window` and `generic-door`,
 * which were entries in the *equipment* list — a window described as a machine,
 * from before the opening catalogue existed. So every window in the main
 * fixture had a transmittance nobody had stated, which is precisely the defect
 * `Opening.definitionId` was given a catalogue to close.
 */
const OPENINGS: readonly string[] = [
  'generic-window-casement-double',
  'generic-entrance-door',
  'generic-internal-door',
];

const openingTypes = OPENINGS.map((id) => {
  const entry = rawGenericOpeningEntries().find((held) => held.id === id);
  if (entry === undefined) {
    console.error(`Menuiserie absente du catalogue : ${id}`);
    process.exit(1);
  }
  return projectOpeningFromCatalog(entry);
});

const held = JSON.parse(readFileSync(FILE, 'utf8')) as {
  project: {
    equipment?: unknown;
    openingTypes?: unknown;
    building: {
      levels: readonly {
        readonly openings: { definitionId?: string }[];
      }[];
    };
  };
};
held.project.equipment = equipment;
held.project.openingTypes = openingTypes;
// The openings point at a model the project holds, which is what the importer
// refuses to do without.
const MODEL: Readonly<Record<string, string>> = {
  'generic-window': 'generic-window-casement-double',
  'generic-door': 'generic-entrance-door',
};
let repointed = 0;
for (const level of held.project.building.levels)
  for (const opening of level.openings) {
    const wanted = MODEL[opening.definitionId ?? ''];
    if (wanted !== undefined) {
      opening.definitionId = wanted;
      repointed += 1;
    }
  }
/**
 * What the modules need to say something about these fiches.
 *
 * A cost per placed unit, the roof plane the array sits on, the state of charge
 * a battery starts at. The house declared all three for the nine hand-written
 * entries it used to hold; changing the entries without changing these would
 * have left the fixture reporting missing inputs — which is exactly what it
 * exists to prove never happens.
 *
 * Demonstration figures, sourced as such. They are not a quotation.
 */
const PRICES: Readonly<Record<string, number>> = {
  'generic-air-water-heat-pump': 8200,
  'generic-heating-buffer-tank': 640,
  'generic-circulator-pump': 320,
  'generic-radiator': 210,
  'generic-towel-radiator': 290,
  'generic-dhw-tank': 780,
  'generic-extract-ventilation-unit': 340,
  'generic-air-terminal': 24,
  'generic-rainwater-tank': 1900,
  'generic-washbasin': 180,
  'generic-shower-tray': 260,
  'generic-wc': 240,
  'generic-kitchen-sink': 320,
  'generic-distribution-board': 210,
  'generic-miniature-circuit-breaker': 12,
  'generic-socket': 9,
  'generic-led-luminaire': 38,
  'generic-pv-array': 3400,
  'generic-inverter': 1250,
  'generic-battery-rack': 3600,
  'generic-window-casement-double': 520,
  'generic-entrance-door': 890,
  'generic-internal-door': 180,
};
/**
 * And what it costs to put each of them in.
 *
 * A separate table because it is a separate question: the price of a thing is
 * a supplier's, the price of installing it is a trade's, and a project that
 * states one without the other reports a total that is not one. This one was
 * left naming `equipment-vmc` and `equipment-pv` long after those entries
 * ceased to exist — a table nobody reads any more, still being read.
 */
const LABOUR: Readonly<Record<string, number>> = {
  'generic-air-water-heat-pump': 1400,
  'generic-heating-buffer-tank': 260,
  'generic-circulator-pump': 120,
  'generic-radiator': 95,
  'generic-towel-radiator': 110,
  'generic-dhw-tank': 340,
  'generic-extract-ventilation-unit': 240,
  'generic-air-terminal': 18,
  'generic-rainwater-tank': 850,
  'generic-washbasin': 140,
  'generic-shower-tray': 220,
  'generic-wc': 160,
  'generic-kitchen-sink': 150,
  'generic-distribution-board': 180,
  'generic-miniature-circuit-breaker': 14,
  'generic-socket': 22,
  'generic-led-luminaire': 25,
  'generic-pv-array': 900,
  'generic-inverter': 300,
  'generic-battery-rack': 400,
  'generic-window-casement-double': 160,
  'generic-entrance-door': 220,
  'generic-internal-door': 90,
};

const named = [...HELD.map(({ id }) => id), ...OPENINGS];
const figures = (
  table: Readonly<Record<string, number>>,
  what: string,
): Record<string, number> =>
  Object.fromEntries(
    named.map((id) => {
      const figure = table[id];
      if (figure === undefined) {
        console.error(`Aucun ${what} de démonstration pour ${id}`);
        process.exit(1);
      }
      return [id, figure];
    }),
  );
const prices = figures(PRICES, 'prix');
const labour = figures(LABOUR, 'coût de pose');

const settings = (
  held.project as unknown as {
    calculationSettings: Record<string, { settings: Record<string, unknown> }>;
  }
).calculationSettings;
settings['cost']!.settings['unitPriceByEquipment'] = prices;
settings['cost']!.settings['labourPriceByEquipment'] = labour;
settings['photovoltaic']!.settings['roofId'] = 'roof-south';
settings['battery']!.settings['initialSoc'] = 0.5;

writeFileSync(FILE, `${JSON.stringify(held, undefined, 2)}\n`, 'utf8');

console.log('');
console.log(
  `Maison de référence — ${equipment.length} fiches et ${openingTypes.length} menuiseries, du catalogue`,
);
console.log(`  ${repointed} ouverture(s) rebranchée(s) sur leur modèle`);
console.log(`  ${Object.keys(prices).length} prix unitaires déclarés`);
for (const { id, why } of HELD) console.log(`  ${id.padEnd(38)} ${why}`);
