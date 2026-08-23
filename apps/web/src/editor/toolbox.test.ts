import { describe, expect, it } from 'vitest';

import { loadDemoProject } from '../demo-project.js';
import { CREATION_STAGES, creationStage } from '../ux/creation-stages.js';
import { TOOL_ICONS } from './tool-icons.js';
import { draftKey } from './tool-options.js';
import { EDITOR_TOOLS, toolById } from './tool-registry.js';
import {
  COMMON_SECTION,
  allToolboxEntries,
  draftsForEntry,
  ficheOfFamily,
  missingFicheFamilies,
  sectionsOfStage,
  toolboxFor,
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

  it('shows the whole stage when the trade has nothing of its own', () => {
    // Mieux vaut tout ce que l'étape offre que rien du tout : un métier sans
    // section déclarée ne doit pas vider la colonne.
    expect(toolboxFor(project, 'BUILDING', 'STRUCTURE').length).toBe(
      sectionsOfStage('BUILDING').length,
    );
  });

  it('carries the tools nobody should have to look for', () => {
    const common = COMMON_SECTION.entries.map(({ toolId }) => toolId);
    for (const id of ['SELECT', 'DIMENSION', 'NOTE', 'ROTATE', 'MIRROR'])
      expect(common).toContain(id);
  });
});
