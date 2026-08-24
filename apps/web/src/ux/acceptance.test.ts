import {
  DESIGN_DOMAIN_IDS,
  designDomain,
  domainsPresentIn,
  projectScopeOf,
  withDomainDisabled,
  type Project,
} from '@house-technical-designer/core-domain';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { loadDemoProject } from '../demo-project.js';
import { EDITOR_TOOLS } from '../editor/tool-registry.js';
import { workflowEntries } from '../workflow/workflow-registry.js';
import { LAYER_PRESETS } from '@house-technical-designer/view-query';
import {
  CREATION_STAGES,
  creationStage,
  librariesOfStage,
} from './creation-stages.js';
import { editsFor } from '../editor/object-editors.js';
import { DEFAULT_SHELL_NAVIGATION, destinationsOf } from './stage-state.js';
import { WORKFLOW_GROUPS } from './workflow-steps.js';
import { DESTINATION_LABELS, DESTINATIONS } from './destinations.js';

const demo = loadDemoProject();
if (demo.status === 'ERROR') throw new Error(demo.message);
const house = demo.file.project;

function source(path: string): string {
  return readFileSync(
    fileURLToPath(new URL(`../${path}`, import.meta.url)),
    'utf8',
  );
}

/**
 * The code alone, without what is written about it.
 *
 * These files explain at length what they refuse to do, and a check that reads
 * the prose finds the very words it is looking for — in the sentence saying
 * they will never appear.
 */
function code(path: string): string {
  return source(path)
    .replace(/\/\*[\s\S]*?\*\//gu, '')
    .replace(/\/\/.*$/gmu, '');
}

/**
 * The eighteen criteria of `docs/UX_ARCHITECTURE.md`, as checks.
 *
 * A contract every pull request is « read against » is a contract nobody
 * reads. These are the ones a machine can settle; the rest are settled by the
 * end-to-end journeys, which is why they are named here even when the
 * assertion lives elsewhere.
 */
describe('the eighteen acceptance criteria', () => {
  it('1. the primary navigation holds exactly seven entries', () => {
    expect(CREATION_STAGES).toHaveLength(7);
  });

  it('2. no library, quantity, scenario or check is a primary destination', () => {
    const labels = CREATION_STAGES.map((id) => creationStage(id).label);
    for (const forbidden of [
      DESTINATION_LABELS.materials,
      DESTINATION_LABELS.assemblies,
      DESTINATION_LABELS.quantities,
      DESTINATION_LABELS.scenarios,
      DESTINATION_LABELS.checks,
    ])
      expect(labels).not.toContain(forbidden);
  });

  /*
   * Le critère 3 a changé de forme avec la refonte, et pas de fond.
   *
   * Il disait « les dix phases ne sont nulle part dans la navigation », ce qui
   * valait tant que la navigation était cinq lieux. Elle est maintenant neuf
   * étapes, et une étape est bien ce qu'on est en train de faire — mais elle
   * ne verrouille rien, ne remplace jamais le plan, et n'est jamais écrite
   * dans le projet. C'est cela qu'il faut tenir.
   */
  it('3. a stage constrains nothing, replaces no plan, and is never persisted', () => {
    expect(WORKFLOW_GROUPS).toHaveLength(10);
    expect(CREATION_STAGES.length).toBeLessThan(WORKFLOW_GROUPS.length);
    // Le plan reste atteignable depuis toutes les étapes qui dessinent : une
    // étape qui emmènerait loin du modèle serait un lieu, pas une étape.
    for (const stage of CREATION_STAGES)
      if (creationStage(stage).domains.length > 0)
        expect(destinationsOf(stage), stage).toContain('plan');
    // L'étape est un état d'écran. Rien de la navigation n'entre dans le
    // fichier projet, ni le registre n'écrit quoi que ce soit.
    expect(JSON.stringify(house)).not.toContain('stage');
    expect(code('ux/stage-state.ts')).not.toMatch(/setItem|Command\(/u);
  });

  it('4. no step state is persisted', () => {
    // The registry reads and never writes: no step identifier is ever stored.
    expect(code('workflow/workflow-registry.ts')).not.toContain(
      'stepCompleted',
    );
    expect(code('workflow/workflow-registry.ts')).not.toMatch(
      /setItem|Command\(/u,
    );
    expect(JSON.stringify(house)).not.toContain('stepCompleted');
  });

  it('5. the guide recommends and never blocks', () => {
    for (const entry of workflowEntries(house))
      if (entry.state === 'BLOCKED')
        expect(entry.actions.length).toBeGreaterThan(0);
  });

  it('6. disabling a domain deletes nothing and can be said out loud', () => {
    const narrowed = withDomainDisabled(projectScopeOf(house), 'ELECTRICAL');
    const after: Project = { ...house, scope: narrowed };
    expect(after.systems).toEqual(house.systems);
    expect(domainsPresentIn(after)).toEqual(domainsPresentIn(house));
  });

  it('7. architecture is always available', () => {
    expect(
      withDomainDisabled(projectScopeOf(house), 'ARCHITECTURE').enabledDomains,
    ).toContain('ARCHITECTURE');
  });

  it('8. a project saved without a scope opens', () => {
    const { scope: _dropped, ...withoutScope } = house;
    expect(projectScopeOf(withoutScope as Project).enabledDomains).toEqual(
      DESIGN_DOMAIN_IDS,
    );
  });

  it('9. the scope travels in the file, the panel widths do not', () => {
    // The layout is a preference of the browser: it is written to a Storage
    // the caller hands over, and the only caller hands over localStorage.
    expect(source('shell/workspace-layout.ts')).toContain('storage.setItem');
    expect(source('main.tsx')).toContain('loadLayout(');
    // And it never reaches the project: a panel width in a `.houseproj` would
    // travel to another machine and rearrange somebody else's screen.
    expect(source('project-workspace.ts')).not.toContain('sidebarPx');
    expect(JSON.stringify(house)).not.toContain('sidebarPx');
  });

  it('10. cross-cutting navigation goes through one target', () => {
    // A second way of navigating is a second depth of navigation, and the
    // shallow one always wins by accident.
    const main = source('main.tsx');
    expect(main).toContain('const navigateTo = useCallback');
    expect(main.match(/UiTarget/gu)?.length).toBeGreaterThan(0);
  });

  it('11. a finding can name the field it is about', () => {
    expect(source('checks/checks-model.ts')).toContain('propertyPath');
    expect(source('editor/InspectorPanel.tsx')).toContain('expandProperty');
  });

  it('12. creating a project is a page, never a modal', () => {
    const page = code('project-creation/ProjectCreationPage.tsx');
    expect(page).not.toContain('aria-modal');
    expect(page).toContain('<main');
  });

  it('13. the initial shape is optional and goes through the BIM commands', () => {
    const shape = source('project-creation/initial-shape.ts');
    expect(shape).toContain('addWallRunCommand');
    expect(shape).toContain('AddSlabCommand');
    expect(source('ux/new-project-draft.ts')).toContain(
      'Je dessinerai moi-même',
    );
  });

  it('14. an unknown value stays unknown', () => {
    expect(house.site.location).toBeDefined();
    // The creation model refuses half a location rather than completing it.
    expect(source('project-creation/new-project.ts')).toContain(
      'ne situe rien',
    );
  });

  it('15. progressive disclosure, and no separate expert mode', () => {
    expect(source('editor/ToolHeader.tsx')).toContain('details');
    for (const path of ['editor/ToolHeader.tsx', 'editor/ContextToolBar.tsx'])
      expect(code(path)).not.toContain('editorLevel');
  });

  it('16. no business component writes a colour', () => {
    // The shell components take their colour from the tokens; a hexadecimal
    // in a component is a colour nobody can change without reading the
    // component.
    for (const path of [
      'shell/StageBar.tsx',
      'shell/ContextPanel.tsx',
      'shell/ShellStatusBar.tsx',
      'editor/ToolHeader.tsx',
      'editor/tool-icons.tsx',
      'editor/ContextToolBar.tsx',
      'checks/IssueCenter.tsx',
      'visibility/DisplayPanel.tsx',
      'shell/SectionBar.tsx',
      'shell/TopBar.tsx',
      'workflow/WorkflowGuide.tsx',
    ])
      expect(code(path), path).not.toMatch(/#[0-9a-f]{3,8}\b/iu);
  });

  it('17. nothing is offered for a capability that does not exist', () => {
    // A start mode that needs a file, a template or another project is not
    // shown: a button that does nothing is worse than an absent one, because
    // it is a promise.
    const page = source('project-creation/ProjectCreationPage.tsx');
    expect(page).toContain('descriptor.needs === undefined');
  });

  it('18. every tool of the context panel is reachable from the palette', () => {
    const main = source('main.tsx');
    expect(main).toContain('EDITOR_TOOLS.map');
    expect(EDITOR_TOOLS.length).toBeGreaterThan(0);
    // And so are the disciplines and the visibility presets, which are the
    // other things the panel offers.
    expect(main).toContain('technicalDomains(file.project).map');
    expect(main).toContain('LAYER_PRESETS.map');
    expect(LAYER_PRESETS.length).toBeGreaterThan(0);
  });

  it('opens a library from the field that designates a fiche', () => {
    /*
     * Une bibliothèque est un catalogue qu'on consulte, pas un lieu où l'on
     * va. Changer l'assemblage d'un mur demandait de quitter le plan, de
     * trouver la fiche, puis de revenir.
     *
     * Tout champ dont les options sont des fiches du projet doit donc savoir
     * laquelle ouvrir : un champ qui l'oublie renvoie la personne chercher
     * elle-même.
     */
    const wall = house.building.levels[0]!.walls[0]!;
    const assembly = editsFor(house, wall.id).find(
      ({ id }) => id === 'assemblyId',
    );
    expect(assembly?.library).toBe('assemblies');

    const component = (house.building.levels[0]!.components ?? [])[0];
    expect(component).toBeDefined();
    const fiche = editsFor(house, component!.id).find(
      ({ id }) => id === 'definitionId',
    );
    expect(fiche?.library).toBe('equipment');

    // Et les quatre bibliothèques restent atteignables sans sélection : elles
    // sont rangées avec ce qu'on cherche, dans l'arborescence.
    const offered = new Set(
      CREATION_STAGES.flatMap((stage) => [...librariesOfStage(stage)]),
    );
    for (const library of [
      'materials',
      'assemblies',
      'openings',
      'equipment',
    ] as const)
      expect(offered.has(library), library).toBe(true);
  });

  it('names every trade it offers, so a sub-stage never says a bare id', () => {
    for (const id of DESIGN_DOMAIN_IDS)
      expect(designDomain(id).label).not.toBe(id);
  });

  it('leaves every one of the thirteen destinations reachable', () => {
    for (const tab of DESTINATIONS) {
      const stages = CREATION_STAGES.filter((stage) =>
        destinationsOf(stage).includes(tab),
      );
      expect(stages.length, tab).toBeGreaterThan(0);
    }
    expect(DEFAULT_SHELL_NAVIGATION.stage).toBe('BUILDING');
  });
});
