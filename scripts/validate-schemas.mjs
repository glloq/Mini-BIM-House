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

if (failed) process.exitCode = 1;
