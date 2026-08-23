import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The numbers the documentation states, against the code that decides them.
 *
 * `17 modules`, `520 familles`, `18 analyses`, `26 familles d'entités`, `5
 * sortes de vue` are all written by hand in several documents. A number
 * retyped in three places is a number wrong in two of them the day it changes,
 * and a reader has no way of telling which one is the house's.
 *
 * This does not generate the prose. It refuses to let it drift: change the
 * code and this test names every document still carrying the old figure.
 */
const DOCUMENTS = [
  'README.md',
  'docs/BETA_READINESS.md',
  'docs/DATA_REGISTRIES.md',
  'docs/USER_GUIDE_MVP.md',
  'examples/reference-house/README.md',
];

function documentsSaying(pattern) {
  return DOCUMENTS.filter((path) => pattern.test(readFileSync(path, 'utf8')));
}

/** Every whole number in the documents, next to the word that qualifies it. */
function statedCounts(word) {
  const found = new Map();
  for (const path of DOCUMENTS) {
    const text = readFileSync(path, 'utf8');
    for (const match of text.matchAll(
      new RegExp(`(\\d{1,4})\\s+${word}`, 'gu'),
    ))
      found.set(path, [...(found.get(path) ?? []), Number(match[1])]);
  }
  return found;
}

describe('the figures the documentation states', () => {
  it('counts the calculation modules the registry declares', async () => {
    const { CALCULATION_MODULES } =
      await import('../packages/calculation-adapters/src/module-registry.ts');
    for (const [path, counts] of statedCounts('modules'))
      for (const count of counts)
        expect(count, `${path} says ${count} modules`).toBe(
          CALCULATION_MODULES.length,
        );
  });

  it('counts the catalogue families the registry holds', async () => {
    const { FAMILY_REGISTRY } =
      await import('../packages/catalog-registry/src/registry.ts');
    for (const [path, counts] of statedCounts('familles'))
      for (const count of counts)
        expect(count, `${path} says ${count} familles`).toBe(
          FAMILY_REGISTRY.length,
        );
  });

  it('counts the analyses the plan can be coloured by', async () => {
    const { OVERLAY_OPTIONS } =
      await import('../apps/web/src/calculations/overlay-source.ts');
    // « Aucune analyse » is not an analysis.
    const analyses = OVERLAY_OPTIONS.filter(({ id }) => id !== 'none').length;
    for (const [path, counts] of statedCounts('analyses'))
      for (const count of counts)
        expect(count, `${path} says ${count} analyses`).toBe(analyses);
    for (const [path, counts] of statedCounts('résultats'))
      for (const count of counts)
        expect(count, `${path} says ${count} résultats`).toBe(analyses);
  });

  it('counts the kinds of drawing the project holds', async () => {
    const { DRAWING_VIEW_TYPES } =
      await import('../packages/core-domain/src/documents.ts');
    for (const [path, counts] of statedCounts('sortes de vue'))
      for (const count of counts)
        expect(count, `${path} says ${count} sortes de vue`).toBe(
          DRAWING_VIEW_TYPES.length,
        );
  });

  it('names the version the packages carry', () => {
    const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
    // The badge and the state-of-the-project section both name it.
    expect(readFileSync('README.md', 'utf8')).toContain(version);
    expect(readFileSync('apps/web/package.json', 'utf8')).toContain(
      `"version": "${version}"`,
    );
    expect(readFileSync('CHANGELOG.md', 'utf8')).toContain(`## ${version}`);
    // The readiness page says where *this* version stands, so it has to be
    // this version. It said beta.5 while the package said beta.6.
    expect(readFileSync('docs/BETA_READINESS.md', 'utf8')).toContain(
      `\`${version}\` aujourd'hui`,
    );
  });

  it('never states a count of analyses in words while another states a figure', async () => {
    const { OVERLAY_OPTIONS } =
      await import('../apps/web/src/calculations/overlay-source.ts');
    const analyses = OVERLAY_OPTIONS.filter(({ id }) => id !== 'none').length;
    // A number written in letters escapes the digit check above, and that is
    // how « 18 résultats » and « dix analyses » came to sit in one document.
    const WRITTEN = {
      deux: 2,
      trois: 3,
      quatre: 4,
      cinq: 5,
      six: 6,
      sept: 7,
      huit: 8,
      neuf: 9,
      dix: 10,
      onze: 11,
      douze: 12,
      treize: 13,
      quatorze: 14,
      quinze: 15,
      seize: 16,
      'dix-sept': 17,
      'dix-huit': 18,
      'dix-neuf': 19,
      vingt: 20,
    };
    for (const path of DOCUMENTS) {
      const text = readFileSync(path, 'utf8');
      for (const [word, value] of Object.entries(WRITTEN))
        for (const noun of ['analyses', 'résultats projetés'])
          if (new RegExp(`\\b${word} ${noun}\\b`, 'iu').test(text))
            expect(value, `${path} says « ${word} ${noun} »`).toBe(analyses);
    }
  });

  it('has no document still promising what is already done', () => {
    // A readiness note listing a gap that was closed reads as a gap.
    for (const stale of [
      /les dix analyses/u,
      /réglages encore invisibles/u,
      /que le plan ne dessine pas encore/u,
    ])
      expect(documentsSaying(stale), String(stale)).toEqual([]);
  });

  it('lists every package the repository actually holds', () => {
    // The architecture page names the packages one by one. A package added
    // without a line, or a line left behind by a package that moved, makes the
    // page a description of a repository that no longer exists.
    const architecture = readFileSync('ARCHITECTURE.md', 'utf8');
    const held = readdirSync('packages', { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map(({ name }) => name);
    const named = held.filter((name) => architecture.includes(`\`${name}\``));
    expect(held.filter((name) => !named.includes(name))).toEqual([]);
  });

  it('keeps the interface contract in step with the code that holds it', async () => {
    // UX_ARCHITECTURE.md is the contract every interface PR is read against.
    // A contract that names nine stages while the code holds ten is not a
    // contract, it is a description of a previous plan.
    const contract = readFileSync('docs/UX_ARCHITECTURE.md', 'utf8');
    const { CREATION_STAGES } =
      await import('../apps/web/src/ux/creation-stages.ts');
    const { WORKFLOW_GROUP_LABELS } =
      await import('../apps/web/src/ux/workflow-steps.ts');
    const { DESIGN_DOMAIN_IDS, PROJECT_INTENTS } =
      await import('../packages/core-domain/src/design-scope.ts');
    expect(contract).toContain(CREATION_STAGES.join(' | '));
    // The contract lists the phases by name; a phase added to the engine and
    // not to the list would be a phase nobody agreed to.
    expect(contract).toContain(Object.values(WORKFLOW_GROUP_LABELS).join(', '));
    expect(contract).toContain('Les seize domaines');
    expect(DESIGN_DOMAIN_IDS).toHaveLength(16);
    for (const intent of PROJECT_INTENTS) expect(contract).toContain(intent);
    // The eighteen acceptance criteria are numbered; the list has to still
    // have eighteen of them.
    const criteria = contract
      .slice(contract.indexOf('## 12.'), contract.indexOf('## 13.'))
      .matchAll(/^\d+\. /gmu);
    expect([...criteria]).toHaveLength(18);
  });

  it('keeps the generated validation report in step with the checks', () => {
    // The report used to be typed by hand and ended with « erreurs de
    // validation : 0 » — a claim about a run nobody could date.
    expect(
      execFileSync('node', ['scripts/validation-report.mjs', '--check'], {
        encoding: 'utf8',
      }),
    ).toContain('à jour');
  });
});
