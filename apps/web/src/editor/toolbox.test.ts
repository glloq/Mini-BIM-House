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
  entryAvailable,
  entryFicheInstalled,
  ficheOfFamily,
  isEntryActive,
  sectionsOfStage,
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

  it('propose ce qu’on peut poser, même si la fiche n’est pas encore là', () => {
    /*
     * L'ancienne règle retirait le bouton, et c'était pire que la promesse
     * qu'elle voulait éviter : `Aménagement` sur un projet sans catalogue
     * n'avait pas une sous-partie, pas un bouton, rien à quoi rattacher « il
     * faut ouvrir la bibliothèque ». On punissait de ne pas connaître le
     * programme.
     *
     * Une entrée nomme une famille, et la prendre installe la fiche que cette
     * famille désigne. Elle peut donc rester.
     */
    const bare = { ...project, equipment: [] };
    const offered = toolboxFor(bare, 'FITTING', undefined);
    expect(offered.length).toBeGreaterThan(0);
    expect(offered.flatMap(({ entries }) => entries).length).toBeGreaterThan(0);
    // Et l'écran sait laquelle reste à installer : ce n'est pas la même chose
    // que de ne pas pouvoir la poser.
    const bed = offered
      .flatMap(({ entries }) => entries)
      .find(({ id }) => id === 'fitting.bed')!;
    expect(entryFicheInstalled(bare, bed)).toBe(false);
    expect(entryFicheInstalled(project, bed)).toBe(true);
    // Un outil que le registre ne tient pas reste la seule vraie absence.
    expect(entryAvailable(bare, { ...bed, toolId: 'OUTIL_INVENTÉ' })).toBe(
      false,
    );
  });

  it('nomme une famille du catalogue, jamais une fiche', () => {
    // Critère 17 : ce qu'une entrée désigne est une famille de la
    // nomenclature. Aucune n'écrit l'identifiant d'une fiche, sans quoi le
    // catalogue installé ne pourrait plus répondre.
    const fiches = new Set((project.equipment ?? []).map(({ id }) => id));
    for (const stage of CREATION_STAGES)
      for (const section of toolboxFor(project, stage, undefined))
        for (const candidate of section.entries)
          expect(
            candidate.family === undefined || !fiches.has(candidate.family),
            candidate.id,
          ).toBe(true);
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

  it('donne un espace à chaque outil du registre', () => {
    /*
     * L'invariant de UX-3, sous la règle que les parties sont séparées.
     *
     * Le « + » versait dans chaque espace tout ce que le registre tient :
     * « Mur », « Toiture » et « Escalier » dans l'espace du terrain,
     * « Terrain » dans celui du bâtiment. Un espace qui propose ce qui
     * appartient à un autre n'est plus une partie de la maison, c'est un menu.
     *
     * L'invariant change donc de forme, pas de fond : ce qu'on refuse est
     * qu'un outil n'ait **aucun** espace. Sur la maison la plus fournie —
     * `visibleWhen` retire d'une liste, jamais du programme — chacun doit
     * trouver la sienne.
     */
    const furnished = houseWith({
      levelCount: 2,
      wallCount: 8,
      closedContours: [{ areaM2: 12 }],
      slabCount: 1,
      networkCount: 1,
      roofSurfaceCount: 1,
    });
    const housed = new Set(
      [
        ...CREATION_STAGES.flatMap((stage) =>
          toolboxFor(project, stage, undefined, furnished).flatMap(
            ({ entries }) => entries,
          ),
        ),
        // Les communs sont sous la main partout : la Sélection ouvre la
        // rangée, le reste est dans le « + » de chaque espace.
        ...COMMON_SECTION.entries,
      ].map(({ toolId }) => toolId),
    );
    for (const tool of EDITOR_TOOLS)
      expect(housed.has(tool.id), tool.id).toBe(true);
  });

  it('ne verse pas un espace dans un autre', () => {
    /*
     * Ce que l'audit demande en toutes lettres : les parties sont séparées.
     *
     * On ne doit pas atteindre les étapes du terrain depuis l'onglet du
     * bâtiment, ni l'inverse. La recherche (Ctrl+K) reste le chemin vers
     * tout, depuis partout — elle, on l'ouvre exprès.
     */
    const offered = (stage: (typeof CREATION_STAGES)[number]): Set<string> =>
      new Set(
        toolboxFor(project, stage, undefined, EMPTY_DESIGN_STATE)
          .flatMap(({ entries }) => entries)
          .map(({ toolId }) => toolId),
      );
    expect(offered('BUILDING').has('SITE')).toBe(false);
    expect(offered('SITE').has('WALL')).toBe(false);
    expect(offered('SITE').has('STAIR')).toBe(false);
    expect(offered('FITTING').has('NETWORK_ROUTE')).toBe(false);
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

describe('quelle entrée est en cours', () => {
  it('n’en allume qu’une là où plusieurs partagent l’outil', () => {
    /*
     * « Toit auto », « 2 pans », « 1 pan » et « Pan libre » prennent tous
     * l'outil ROOF : comparer les outils enfonçait les quatre boutons à la
     * fois, et plus rien ne disait lequel on avait pris.
     */
    const roofs = allToolboxEntries().filter(({ toolId }) => toolId === 'ROOF');
    expect(roofs.length).toBeGreaterThan(1);
    for (const chosen of roofs) {
      const drafts = draftsForEntry(project, chosen);
      const lit = roofs.filter((candidate) =>
        isEntryActive(project, candidate, 'ROOF', drafts),
      );
      expect(
        lit.map(({ id }) => id),
        chosen.id,
      ).toEqual([chosen.id]);
    }
  });

  it('s’éteint quand on change à la main ce qu’elle avait rempli', () => {
    const free = allToolboxEntries().find(({ id }) => id === 'building.roof-2');
    expect(free).toBeDefined();
    const drafts = draftsForEntry(project, free!);
    expect(isEntryActive(project, free!, 'ROOF', drafts)).toBe(true);
    // On ne fait plus tout à fait ce que l'entrée fait : elle ne peut plus
    // prétendre être en cours.
    const key = Object.keys(drafts)[0]!;
    expect(
      isEntryActive(project, free!, 'ROOF', { ...drafts, [key]: 'autre' }),
    ).toBe(false);
  });

  it('n’allume rien quand l’outil n’est pas le sien', () => {
    const wall = allToolboxEntries().find(({ toolId }) => toolId === 'WALL')!;
    expect(isEntryActive(project, wall, 'SELECT', {})).toBe(false);
  });
});

describe('les noms que les entrées portent', () => {
  it('ne donne pas le même nom à deux gestes différents', () => {
    /*
     * « Trémie » nommait un percement de mur dans « Ouvertures » et un
     * percement de dalle dans « Dalles » : on cliquait l'un en croyant prendre
     * l'autre, et rien à l'écran ne les distinguait.
     */
    const seen = new Map<string, string>();
    for (const stage of CREATION_STAGES)
      for (const section of toolboxFor(project, stage, undefined))
        for (const candidate of section.entries) {
          const shown = `${stage} · ${candidate.label}`;
          const before = seen.get(shown);
          if (before !== undefined && before !== candidate.toolId)
            expect(
              before,
              `${shown} : « ${candidate.id} » et « ${before} » portent le même nom`,
            ).toBe(candidate.toolId);
          seen.set(shown, candidate.toolId);
        }
  });
});
