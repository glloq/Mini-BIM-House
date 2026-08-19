import { readFile, readdir, writeFile } from 'node:fs/promises';
import process from 'node:process';
import Ajv2020 from 'ajv/dist/2020.js';
import standaloneCode from 'ajv/dist/standalone/index.js';

const outputPath = 'packages/project-io/src/generated-project-validator.js';
const ajv = new Ajv2020({
  allErrors: true,
  strict: true,
  code: { source: true, esm: true },
});
for (const file of (await readdir('schemas')).filter((name) =>
  name.endsWith('.schema.json'),
)) {
  ajv.addSchema(JSON.parse(await readFile(`schemas/${file}`, 'utf8')));
}
const validator = ajv.getSchema(
  'https://house-technical-designer.local/schemas/project.schema.json',
);
if (validator === undefined)
  throw new Error('Project schema was not registered.');
const generated = standaloneCode(ajv, validator);
if (process.argv.includes('--check')) {
  const current = await readFile(outputPath, 'utf8');
  if (current !== generated) {
    console.error(
      'Generated project validator is stale. Run npm run generate:project-validator.',
    );
    process.exitCode = 1;
  }
} else await writeFile(outputPath, generated);
