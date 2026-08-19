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
/**
 * Ajv's standalone ESM output still emits `require(...)` for its shared runtime
 * helpers, which throws `require is not defined` in a browser bundle. Rewriting
 * those calls into real ESM imports keeps the generated file loadable by the web
 * application as well as by Node.
 *
 * The helpers are CommonJS, and bundlers and Node disagree on what a default
 * import of a CommonJS module yields, so the generated file unwraps the module
 * namespace explicitly instead of relying on one interop behaviour.
 */
const RUNTIME_UNWRAP =
  'const ajvRuntimeDefault = (namespace) => {' +
  'const exported = namespace.default ?? namespace;' +
  'return exported.default ?? exported;};';

function rewriteRuntimeRequires(code) {
  const specifiers = [
    ...new Set(
      [...code.matchAll(/require\("([^"]+)"\)/g)].map(
        ([, specifier]) => specifier,
      ),
    ),
  ].sort();
  if (specifiers.length === 0) return code;
  const names = new Map(
    specifiers.map((specifier, index) => [specifier, `ajvRuntime${index}`]),
  );
  const imports = specifiers
    .map(
      (specifier) =>
        `import * as ${names.get(specifier)}Namespace from "${specifier}${specifier.endsWith('.js') ? '' : '.js'}";` +
        `const ${names.get(specifier)} = {default: undefined};`,
    )
    .join('');
  const assignments = specifiers
    .map(
      (specifier) =>
        `${names.get(specifier)}.default = ajvRuntimeDefault(${names.get(specifier)}Namespace);`,
    )
    .join('');
  const body = code.replace(/require\("([^"]+)"\)/g, (_match, specifier) =>
    names.get(specifier),
  );
  const prologue = '"use strict";';
  const preamble = `${RUNTIME_UNWRAP}${imports}${assignments}`;
  return body.startsWith(prologue)
    ? `${prologue}${preamble}${body.slice(prologue.length)}`
    : `${preamble}${body}`;
}

const generated = rewriteRuntimeRequires(standaloneCode(ajv, validator));
if (process.argv.includes('--check')) {
  const current = await readFile(outputPath, 'utf8');
  if (current !== generated) {
    console.error(
      'Generated project validator is stale. Run npm run generate:project-validator.',
    );
    process.exitCode = 1;
  }
} else await writeFile(outputPath, generated);
