/**
 * The data layer of this application, checked in one pass, before anything
 * ships it.
 *
 * The audit that asked for this named what it was for: a battery pack declared
 * the `BATTERY_DEVICE` schema and carried `maxChargePowerKW` where the schema
 * says `maximumChargePowerW`. Both files were valid on their own, the family
 * said `GENERIC_DATA: READY`, and the integration was green — because nothing
 * compared the two. Six hundred entries added on top of that would have been
 * six hundred entries nobody had compared to anything.
 *
 * It runs the same functions the test suite runs, on the same data, and says
 * what is wrong in a form somebody adding a family can act on: which file,
 * which entry, which property. Contributors get it in a second without running
 * thirteen hundred tests; the integration gets it as a gate.
 */
import { existsSync, readFileSync } from 'node:fs';
import {
  SYMBOL_LIBRARY_V1,
  rawGenericSymbolEntries,
  symbolCatalogIssues,
} from '@house-technical-designer/drawing-engine';
import { PROJECT_CALCULATION_MODULE_IDS } from '@house-technical-designer/calculation-adapters';
import { rawGenericEquipmentEntries } from '@house-technical-designer/equipment-catalog';
import {
  FAMILY_REGISTRY,
  NETWORK_PRODUCT_REGISTRY,
  PROPERTY_SCHEMA_REGISTRY,
  currentCatalogManifest,
  stampedCatalogEntries,
  validateCatalogFingerprints,
  validateAssemblyCatalog,
  validateCatalog,
  validateMaterialCatalog,
  validateOpeningCatalog,
  validateNetworkProducts,
  validateRegistry,
  validateSchemas,
} from '@house-technical-designer/catalog-registry';
import { rawGenericMaterialEntries } from '@house-technical-designer/materials';
import { rawGenericAssemblyEntries } from '@house-technical-designer/assemblies';
import { rawGenericOpeningEntries } from '@house-technical-designer/opening-catalog';

const MANIFEST_PATH = 'packages/catalog-registry/data/manifest.json';
const symbols = new Set(Object.keys(SYMBOL_LIBRARY_V1.definitions));
const calculators = new Set<string>(PROJECT_CALCULATION_MODULE_IDS);

interface Section {
  readonly title: string;
  readonly counted: number;
  readonly noun: string;
  readonly issues: readonly {
    readonly subject: string;
    readonly path: string;
    readonly message: string;
  }[];
}

const sections: readonly Section[] = [
  {
    // First, because everything else is measured against these: a schema that
    // is itself wrong makes a check pass that should have failed.
    title: 'Schémas de propriétés',
    counted: PROPERTY_SCHEMA_REGISTRY.length,
    noun: 'schémas',
    issues: validateSchemas().map(({ schemaId, path, message }) => ({
      subject: schemaId,
      path,
      message,
    })),
  },
  {
    title: 'Nomenclature',
    counted: FAMILY_REGISTRY.length,
    noun: 'familles',
    issues: validateRegistry({ symbols, calculators }).map(
      ({ familyId, path, message }) => ({ subject: familyId, path, message }),
    ),
  },
  {
    // Read as the files state it, not as the loader repaired it: a provenance
    // of `GENRIC` used to become `OTHER` on the way in, so the typo was mended
    // before any gate could see it.
    title: 'Catalogue générique',
    counted: rawGenericEquipmentEntries().length,
    noun: 'définitions',
    issues: validateCatalog(rawGenericEquipmentEntries(), symbols).map(
      ({ entryId, path, message }) => ({ subject: entryId, path, message }),
    ),
  },
  {
    // The last of the seven registries to have lived in TypeScript, and the
    // last no gate had ever read.
    title: 'Matériaux',
    counted: rawGenericMaterialEntries().length,
    noun: 'matériaux',
    issues: validateMaterialCatalog().map(({ entryId, path, message }) => ({
      subject: entryId,
      path,
      message,
    })),
  },
  {
    // The pointer existed and the catalogue did not: every window in every
    // project had its Uw typed in by hand, or was counted as an unknown.
    title: 'Ouvertures',
    counted: rawGenericOpeningEntries().length,
    noun: 'ouvertures',
    issues: validateOpeningCatalog().map(({ entryId, path, message }) => ({
      subject: entryId,
      path,
      message,
    })),
  },
  {
    title: 'Assemblages',
    counted: rawGenericAssemblyEntries().length,
    noun: 'compositions',
    issues: validateAssemblyCatalog().map(({ entryId, path, message }) => ({
      subject: entryId,
      path,
      message,
    })),
  },
  {
    // The last of the seven registries to live in TypeScript, and the only one
    // whose defects used to stop the application rather than be reported.
    title: 'Symboles',
    counted: rawGenericSymbolEntries().length,
    noun: 'symboles',
    issues: symbolCatalogIssues().map(({ symbolId, path, message }) => ({
      subject: symbolId,
      path,
      message,
    })),
  },
  {
    title: 'Produits réseau',
    counted: NETWORK_PRODUCT_REGISTRY.length,
    noun: 'produits',
    issues: validateNetworkProducts().map(({ productId, path, message }) => ({
      subject: productId,
      path,
      message,
    })),
  },
];

/**
 * The manifest, compared to what is actually installed.
 *
 * A manifest nobody checks is a manifest that describes a previous release,
 * which is worse than none: it is a promise about what a project was designed
 * with.
 */
const fingerprints = validateCatalogFingerprints();
const manifest = currentCatalogManifest();
const recorded = existsSync(MANIFEST_PATH)
  ? (JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as {
      readonly releaseId?: string;
    })
  : undefined;

let failed = false;
for (const { title, counted, noun, issues } of sections) {
  if (issues.length === 0) {
    console.log(`✓ ${title} — ${counted} ${noun}`);
    continue;
  }
  failed = true;
  console.log(`✗ ${title} — ${issues.length} anomalies sur ${counted} ${noun}`);
  for (const { subject, path, message } of issues)
    console.log(`    ${subject} · ${path} : ${message}`);
}

if (fingerprints.length === 0)
  console.log(
    `✓ Empreintes — ${stampedCatalogEntries().length} fiches, tous registres`,
  );
else {
  console.log(`✗ Empreintes — ${fingerprints.length} anomalies`);
  for (const { ref, message } of fingerprints)
    console.log(`    ${ref} : ${message}`);
  failed = true;
}

if (recorded === undefined)
  console.log('✗ Manifeste — absent ; lancer npm run catalog:manifest.');
else if (recorded.releaseId !== manifest.releaseId) {
  console.log(
    `✗ Manifeste — publication ${recorded.releaseId} enregistrée, ${manifest.releaseId} installée.`,
  );
} else
  console.log(
    `✓ Manifeste — publication ${manifest.releaseId}, format ${manifest.catalogFormatVersion}`,
  );
if (recorded?.releaseId !== manifest.releaseId) failed = true;

if (failed) {
  console.error(
    '\nLes données ne sont pas cohérentes avec leurs propres registres.',
  );
  process.exit(1);
}
