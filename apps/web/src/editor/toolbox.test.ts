import { describe, expect, it } from 'vitest';

import { loadDemoProject } from '../demo-project.js';
import { CREATION_STAGES, creationStage } from '../ux/creation-stages.js';
import { EMPTY_DESIGN_STATE, type DesignState } from '../ux/design-state.js';
import { TOOL_ICONS } from './tool-icons.js';
import { draftKey } from './tool-options.js';
import { EDITOR_TOOLS, toolById } from './tool-registry.js';
import {
  COMMON_SECTION,
  allToolboxEntries,
  availabilityOf,
  draftsForEntry,
  ficheOfFamily,
  missingFicheFamilies,
  sectionsOfStage,
  leftoverTools,
  toolboxFor,
  unblockingEntry,
  type ToolboxEntry,
} from './toolbox.js';

const demo = loadDemoProject();
if (demo.status === 'ERROR') throw new Error(demo.message);
const project = demo.file.project;

describe('what a stage puts under the hand', () => {
  it('leaves no tool of the registry unreachable', () => {
    // L'invariant de la refonte : une étape filtre ce qui est proposé, elle ne
    // restreint jamais ce qui est possible. Un outil qu'aucune étape n'offre
    // et qui ne serait pas commun serait un outil que plus personne ne trouve.
    const offered = new Set(allToolboxEntries().map(({ toolId }) => toolId));
    for (const tool of EDITOR_TOOLS)
      expect(offered.has(tool.id), tool.id).toBe(true);
  });

  it('names a tool the registry holds, and an icon that is drawn', () => {
    for (const candidate of allToolboxEntries()) {
      expect(toolById(candidate.toolId), candidate.id).toBeDefined();
      expect(TOOL_ICONS, candidate.id).toContain(candidate.icon);
    }
  });

  it('renames a tool only when the entry is something else', () => {
    /*
     * Une entrée qui ne change rien à l'outil porte son nom.
     *
     * « Cote » dans les communs et « Cotation » dans « Tous les outils », ce
     * sont deux noms pour un même outil sur un même écran : la personne croit
     * en avoir trouvé un second. Une entrée ne gagne son propre nom que
     * lorsqu'elle est autre chose que l'outil nu — « Porte » est l'outil
     * ouverture avec le type déjà choisi, « WC » est l'outil composant avec la
     * fiche déjà désignée.
     */
    for (const candidate of allToolboxEntries()) {
      const bare =
        candidate.options === undefined && candidate.family === undefined;
      if (!bare) continue;
      expect(candidate.label, candidate.id).toBe(
        toolById(candidate.toolId)!.label,
      );
    }
  });

  it('gives every entry a distinct identifier', () => {
    const ids = allToolboxEntries().map(({ id }) => id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('only pre-fills options the tool actually declares', () => {
    // Une option écrite ici et absente de l'outil serait un brouillon que
    // personne ne lit : l'entrée dirait « porte » et poserait autre chose.
    for (const candidate of allToolboxEntries()) {
      const tool = toolById(candidate.toolId)!;
      const declared = new Set((tool.options ?? []).map(({ key }) => key));
      for (const key of Object.keys(candidate.options ?? {}))
        expect(declared.has(key), `${candidate.id} → ${key}`).toBe(true);
      if (candidate.family !== undefined)
        expect(declared.has('definitionId'), candidate.id).toBe(true);
    }
  });

  it('takes its fiches from the installed catalogue, never from this file', () => {
    // Une entrée nomme une famille de la nomenclature ; la fiche est celle que
    // le projet tient. Un projet qui n'en tient pas ne voit pas l'entrée —
    // c'est pour cela qu'on ne peut pas exiger ici qu'elles soient toutes là.
    let resolved = 0;
    for (const candidate of allToolboxEntries()) {
      if (candidate.family === undefined) continue;
      const fiche = ficheOfFamily(project, candidate.family);
      const drafts = draftsForEntry(project, candidate);
      const key = draftKey(candidate.toolId, 'definitionId');
      if (fiche === undefined) {
        expect(drafts[key], candidate.id).toBeUndefined();
        continue;
      }
      resolved += 1;
      expect(drafts[key], candidate.id).toBe(fiche);
      expect(fiche.length).toBeGreaterThan(0);
    }
    // La maison de référence en tient assez pour que ce test veuille dire
    // quelque chose.
    expect(resolved).toBeGreaterThan(8);
  });

  it('says why a stage is empty rather than showing an empty column', () => {
    // Aménagement pose des fiches du catalogue ; un projet qui n'en tient
    // aucune n'a rien à poser, et une colonne vide sans un mot est un écran
    // qui ne dit pas ce qu'il attend.
    const bare = { ...project, equipment: [] };
    expect(toolboxFor(bare, 'FITTING', undefined)).toEqual([]);
    expect(sectionsOfStage('FITTING').length).toBeGreaterThan(0);
    expect(missingFicheFamilies(bare, 'FITTING').length).toBeGreaterThan(0);
    // Et rien à dire quand tout est là.
    expect(missingFicheFamilies(project, 'BUILDING')).toEqual([]);
  });

  it('offers nothing a project cannot place', () => {
    // Un bouton qui ne peut rien poser est une promesse, et une promesse est
    // pire qu'une absence : critère 17 du contrat.
    const bare = { ...project, equipment: [] };
    for (const stage of CREATION_STAGES)
      for (const section of toolboxFor(bare, stage, undefined))
        for (const candidate of section.entries)
          expect(candidate.family, candidate.id).toBeUndefined();
  });

  it('keeps a section for every trade a stage claims a sub-stage for', () => {
    // Le registre des étapes dit ce qui existe, la boîte dit ce que ça
    // propose : deux listes qui divergent, et une sous-étape n'offre rien.
    for (const stage of CREATION_STAGES) {
      const declared = creationStage(stage)
        .sections.map(({ domain }) => domain)
        .filter((domain) => domain !== undefined);
      const served = new Set(
        sectionsOfStage(stage)
          .map(({ domain }) => domain)
          .filter((domain) => domain !== undefined),
      );
      for (const domain of declared)
        expect(served.has(domain), `${stage} → ${domain}`).toBe(true);
    }
  });

  it('narrows Systèmes to the trade being read', () => {
    const power = toolboxFor(project, 'SYSTEMS', 'ELECTRICAL');
    expect(power.map(({ id }) => id)).toEqual(['systems.power']);
    const water = toolboxFor(project, 'SYSTEMS', 'PLUMBING');
    expect(water.map(({ id }) => id)).toEqual(['systems.water']);
  });

  it('narrows Bâtiment to its structural sub-part', () => {
    // La structure est une sous-partie du bâtiment depuis les sept espaces :
    // c'est ce qui porte les murs qu'on vient de tracer, pas un autre métier.
    const bearing = toolboxFor(project, 'BUILDING', 'STRUCTURE');
    expect(bearing.map(({ id }) => id)).toEqual(['structure.frame']);
  });

  it('shows the whole stage when the trade has nothing of its own', () => {
    // Mieux vaut tout ce que l'étape offre que rien du tout : un métier sans
    // section déclarée ne doit pas vider la colonne.
    expect(toolboxFor(project, 'BUILDING', 'FURNITURE').length).toBe(
      sectionsOfStage('BUILDING').length,
    );
  });

  it('carries the tools nobody should have to look for', () => {
    const common = COMMON_SECTION.entries.map(({ toolId }) => toolId);
    for (const id of ['SELECT', 'DIMENSION', 'NOTE', 'ROTATE', 'MIRROR'])
      expect(common).toContain(id);
  });
});

describe('what the house allows, tool by tool', () => {
  const houseWith = (patch: Partial<DesignState>): DesignState => ({
    ...EMPTY_DESIGN_STATE,
    ...patch,
  });
  const findEntry = (id: string): ToolboxEntry => {
    const found = allToolboxEntries().find((candidate) => candidate.id === id);
    if (found === undefined) throw new Error(`entrée inconnue : ${id}`);
    return found;
  };
  const gradeOf = (id: string, state: DesignState) =>
    availabilityOf(findEntry(id), state);

  it('leaves an entry that asks nothing exactly as it was', () => {
    // Le contrat de compatibilité : vingt-cinq outils marchaient sans savoir
    // répondre à la question, et ils doivent continuer.
    const plain = gradeOf('building.wall', EMPTY_DESIGN_STATE);
    expect(plain.enabled).toBe(true);
    expect(plain.recommended).toBe(false);
    expect(plain.requirement).toBeUndefined();
  });

  it('refuses a door before there is a wall, and says so', () => {
    const empty = gradeOf('building.door', EMPTY_DESIGN_STATE);
    expect(empty.enabled).toBe(false);
    expect(empty.requirement?.reason).toContain('mur');
    expect(gradeOf('building.door', houseWith({ wallCount: 1 })).enabled).toBe(
      true,
    );
  });

  it('offers the gesture that unblocks, when a tool is the gesture', () => {
    // Un outil grisé en silence est une panne ; un outil grisé qui dit ce
    // qu'il attend et donne l'outil qui y mène est une leçon.
    const blocked = gradeOf('building.door', EMPTY_DESIGN_STATE);
    expect(unblockingEntry(blocked.requirement)?.id).toBe('building.wall');
    // Un étage se pose dans le menu du projet : la raison reste, le geste non.
    const stair = gradeOf('building.stair', EMPTY_DESIGN_STATE);
    expect(stair.requirement?.reason).toContain('étage');
    expect(unblockingEntry(stair.requirement)).toBeUndefined();
  });

  it('names an entry that exists for every gesture it promises', () => {
    // Une raison qui pointe une entrée disparue serait pire qu'aucune raison.
    for (const candidate of allToolboxEntries()) {
      if (candidate.requires?.entryId === undefined) continue;
      expect(
        unblockingEntry(candidate.requires),
        `${candidate.id} → ${candidate.requires.entryId}`,
      ).toBeDefined();
    }
  });

  it('writes a reason for every condition it enforces', () => {
    for (const candidate of allToolboxEntries())
      if (candidate.enabledWhen !== undefined)
        expect(candidate.requires?.reason, candidate.id).toBeTruthy();
  });

  it('recommends the room when a contour has none', () => {
    const closed = houseWith({
      wallCount: 4,
      closedContours: [{ areaM2: 12 }],
      contoursWithoutSpace: 1,
    });
    expect(gradeOf('building.space', closed).recommended).toBe(true);
    expect(
      gradeOf('building.space', houseWith({ wallCount: 4 })).recommended,
    ).toBe(false);
  });

  it('recommends the roof once, and stops once it is drawn', () => {
    const closed = houseWith({
      wallCount: 4,
      closedContours: [{ areaM2: 12 }],
    });
    expect(gradeOf('building.roof', closed).recommended).toBe(true);
    expect(
      gradeOf('building.roof', { ...closed, roofSurfaceCount: 1 }).recommended,
    ).toBe(false);
  });

  it('never recommends what it will not let anyone take', () => {
    // Recommander un outil qu'on ne peut pas prendre serait recommander une
    // déception : les trois degrés sont ordonnés, pas indépendants.
    for (const candidate of allToolboxEntries())
      for (const state of [
        EMPTY_DESIGN_STATE,
        houseWith({ levelCount: 1, wallCount: 4 }),
        houseWith({
          levelCount: 2,
          wallCount: 8,
          closedContours: [{ areaM2: 12 }],
          slabCount: 1,
          networkCount: 1,
        }),
      ]) {
        const grade = availabilityOf(candidate, state);
        if (grade.recommended) expect(grade.enabled, candidate.id).toBe(true);
      }
  });

  it('keeps every tool of the registry reachable whatever the house', () => {
    /*
     * L'invariant de UX-3 sous la nouvelle règle.
     *
     * `visibleWhen` retire d'une liste, jamais du programme : un escalier
     * n'est pas proposé sur une maison de plain-pied, et il est alors dans
     * « Tous les outils ». Ce que ce test refuse est qu'il tombe entre les
     * deux — proposé nulle part et rangé nulle part.
     */
    for (const state of [
      EMPTY_DESIGN_STATE,
      houseWith({ levelCount: 1, wallCount: 4 }),
      houseWith({
        levelCount: 2,
        wallCount: 8,
        closedContours: [{ areaM2: 12 }],
        slabCount: 1,
        networkCount: 1,
        roofSurfaceCount: 1,
      }),
    ])
      for (const stage of CREATION_STAGES) {
        const proposed = new Set(
          [
            ...toolboxFor(project, stage, undefined, state).flatMap(
              ({ entries }) => entries,
            ),
            // Les communs sont sous la main partout : la Sélection ouvre la
            // rangée, le reste est dans le « + ».
            ...COMMON_SECTION.entries,
          ].map(({ toolId }) => toolId),
        );
        const left = new Set(
          leftoverTools(project, stage, undefined, state).map(({ id }) => id),
        );
        for (const tool of EDITOR_TOOLS)
          expect(
            proposed.has(tool.id) || left.has(tool.id),
            `${stage} · ${tool.id}`,
          ).toBe(true);
      }
  });

  it('proposes at most what it would propose knowing nothing', () => {
    // L'état est facultatif, et il ne peut que retirer : un appel qui l'ignore
    // voit tout ce que l'étape a. C'est ce qui rend sûr de l'oublier.
    const blind = toolboxFor(project, 'BUILDING', undefined)
      .flatMap(({ entries }) => entries)
      .map(({ id }) => id);
    const empty = toolboxFor(project, 'BUILDING', undefined, EMPTY_DESIGN_STATE)
      .flatMap(({ entries }) => entries)
      .map(({ id }) => id);
    expect(empty.length).toBeLessThanOrEqual(blind.length);
    for (const id of empty) expect(blind).toContain(id);
  });
});
