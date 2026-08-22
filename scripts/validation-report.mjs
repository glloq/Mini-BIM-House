#!/usr/bin/env node
/**
 * Writes VALIDATION_REPORT.md from what the checks actually do.
 *
 * The file used to be typed by hand, listed the schema fixtures alone, and
 * ended with « erreurs de validation : 0 » — a claim about a run nobody could
 * date, next to a continuous integration pipeline it did not mention. A report
 * that cannot be wrong is a report that says nothing.
 *
 * This one is generated from `package.json` and from the workflow, so it can
 * only ever describe the checks that exist. `--check` fails when the committed
 * file no longer matches, which is what keeps it honest.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const REPORT = 'VALIDATION_REPORT.md';

const root = JSON.parse(readFileSync('package.json', 'utf8'));
const workflow = readFileSync('.github/workflows/ci.yml', 'utf8');

/** The scripts the pipeline runs, in the order the workflow runs them. */
function pipelineSteps() {
  const steps = [];
  for (const match of workflow.matchAll(
    /run:\s*(npm run [\w:-]+|npx [^\n]+)/gu,
  ))
    steps.push(match[1].trim());
  return [...new Set(steps)];
}

function describe(step) {
  const name = step.replace(/^npm run\s+/u, '');
  return root.scripts?.[name] ?? '—';
}

const generated = `# Rapport de validation

<!-- Généré par \`node scripts/validation-report.mjs\`. Ne pas éditer à la main. -->

Ce document décrit **les contrôles que ce dépôt exécute**, et non le résultat
d'une exécution particulière : un résultat consigné dans un fichier vieillit
sans le dire. Le résultat vivant est celui de l'intégration continue, sur la
branche et sur chaque demande de fusion.

## Ce que la chaîne vérifie

${pipelineSteps()
  .map((step) => `- \`${step}\` — \`${describe(step)}\``)
  .join('\n')}

## Contrôle d'unité

- géométrie d'édition : millimètres (\`ADR-0003\`) ;
- calculs physiques : SI ;
- coordonnées \`Point2D{x,y}\` / \`Point3D{x,y,z}\` : valeurs en millimètres ;
- dimensions de bâtiment persistées : suffixe \`Mm\` lorsque le champ n'est pas
  un type géométrique.

## Ce que ce rapport ne dit pas

Il ne dit pas qu'un projet donné est conforme à un texte réglementaire. Aucun
référentiel n'est livré, et l'application rapporte des constats sans jamais
délivrer de conformité.
`;

if (process.argv.includes('--check')) {
  const current = readFileSync(REPORT, 'utf8');
  if (current !== generated) {
    process.stderr.write(
      `${REPORT} ne correspond plus aux contrôles du dépôt.\nRelancer : node scripts/validation-report.mjs\n`,
    );
    process.exit(1);
  }
  process.stdout.write(`${REPORT} à jour.\n`);
} else {
  writeFileSync(REPORT, generated);
  process.stdout.write(`${REPORT} écrit.\n`);
}
