import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const root = process.cwd();
const schemaDirectory = path.join(root, 'schemas');
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);

const schemaFiles = (await readdir(schemaDirectory)).filter((file) =>
  file.endsWith('.schema.json'),
);
for (const file of schemaFiles) {
  const contents = await readFile(path.join(schemaDirectory, file), 'utf8');
  ajv.addSchema(JSON.parse(contents));
}

const fixtures = new Map([
  ['assembly.schema.json', 'assembly.example.json'],
  ['building-element.schema.json', 'building-element.example.json'],
  ['calculation-result.schema.json', 'calculation-result.example.json'],
  ['climate.schema.json', 'climate.example.json'],
  ['equipment.schema.json', 'equipment.example.json'],
  ['geometry.schema.json', 'geometry.example.json'],
  ['material.schema.json', 'material.example.json'],
  ['module-settings.schema.json', 'module-settings.example.json'],
  ['network.schema.json', 'network.example.json'],
  ['project.schema.json', 'minimal.houseproj.json'],
  ['rule-pack.schema.json', 'rule-pack.example.json'],
  ['scenario.schema.json', 'scenario.example.json'],
  ['symbol.schema.json', 'symbol.example.json'],
]);

/** Fixtures living outside `examples/`, kept validated alongside the examples. */
const additionalFixtures = [
  ['project.schema.json', 'examples/reference-house/reference.houseproj.json'],
  ['climate.schema.json', 'examples/reference-house/climate-monthly.json'],
  ['climate.schema.json', 'examples/reference-house/climate-design-day.json'],
];

/**
 * Where each registry keeps its files, and which shape they must have.
 *
 * A folder, not a list of files. Eight equipment files were named here one by
 * one, which meant an agent could drop two hundred excellent fiches into
 * `data/equipment/heating/heat-pumps-02.json` and have nothing check them —
 * and nothing load them either. The tree is the list, here and in the loaders,
 * so that adding a file is `git add` and nothing else.
 */
const catalogTrees = [
  [
    'catalog-equipment.schema.json',
    'packages/equipment-catalog/data/equipment',
  ],
  ['catalog-material.schema.json', 'packages/materials/data'],
  ['catalog-opening.schema.json', 'packages/opening-catalog/data'],
  ['catalog-assembly.schema.json', 'packages/assemblies/data'],
  ['catalog-network-product.schema.json', 'packages/network-products/data'],
  ['catalog-symbol.schema.json', 'packages/drawing-engine/data/symbols'],
];

/** Every JSON file under a folder, at any depth, in a stable order. */
async function jsonFilesUnder(directory) {
  const entries = await readdir(path.join(root, directory), {
    withFileTypes: true,
  });
  const found = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const child = `${directory}/${entry.name}`;
    if (entry.isDirectory()) found.push(...(await jsonFilesUnder(child)));
    else if (entry.name.endsWith('.json')) found.push(child);
  }
  return found;
}

for (const [schemaFile, directory] of catalogTrees)
  for (const file of await jsonFilesUnder(directory))
    additionalFixtures.push([schemaFile, file]);

let failed = false;
for (const [schemaFile, fixtureFile] of fixtures) {
  const schemaId = `https://house-technical-designer.local/schemas/${schemaFile}`;
  const validate = ajv.getSchema(schemaId);
  if (!validate) throw new Error(`Schema not registered: ${schemaId}`);
  const fixture = JSON.parse(
    await readFile(path.join(root, 'examples', fixtureFile), 'utf8'),
  );
  if (!validate(fixture)) {
    failed = true;
    console.error(`${fixtureFile} does not satisfy ${schemaFile}:`);
    console.error(ajv.errorsText(validate.errors, { separator: '\n' }));
  } else {
    console.log(`validated examples/${fixtureFile}`);
  }
}

for (const [schemaFile, fixturePath] of additionalFixtures) {
  const schemaId = `https://house-technical-designer.local/schemas/${schemaFile}`;
  const validate = ajv.getSchema(schemaId);
  if (!validate) throw new Error(`Schema not registered: ${schemaId}`);
  const fixture = JSON.parse(
    await readFile(path.join(root, fixturePath), 'utf8'),
  );
  if (!validate(fixture)) {
    failed = true;
    console.error(`${fixturePath} does not satisfy ${schemaFile}:`);
    console.error(ajv.errorsText(validate.errors, { separator: '\n' }));
  } else {
    console.log(`validated ${fixturePath}`);
  }
}

if (failed) process.exitCode = 1;
