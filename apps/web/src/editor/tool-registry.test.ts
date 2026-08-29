import { describe, expect, it } from 'vitest';
import type { AddComponentCommand } from '@house-technical-designer/editor-core';
import { loadDemoProject } from '../demo-project.js';
import { SHORTCUTS } from './shortcuts.js';
import { optionValue, storageKeyOf, type ToolDrafts } from './tool-options.js';
import { toolOptionLayout } from './option-visibility.js';
import { OBJECT_FAMILIES } from './object-editors.js';
import { stepCoherenceProblem } from './interaction-steps.js';
import { SITE_OBSTACLE_KINDS } from '@house-technical-designer/core-domain';
import { isSurfaceSiteKind } from './site-footprints.js';
import {
  EDITOR_LEVELS,
  EDITOR_TOOLS,
  completionLabel,
  completionModeOf,
  constrainsDrafting,
  isOpenEnded,
  interactionOf,
  interactionStepAt,
  dynamicInputOf,
  populatedToolGroups,
  populatedToolGroupsAtLevel,
  requiredPoints,
  toolAtLevel,
  toolDefinition,
  type EditorTool,
  toolsInGroup,
  toolsInGroupAtLevel,
  optionsOf,
  type EditorLevel,
  type ToolCommandContext,
} from './tool-registry.js';

function file() {
  const result = loadDemoProject();
  if (result.status !== 'OK') throw new Error(result.message);
  return result.file;
}

function context(
  overrides: Partial<ToolCommandContext> = {},
): ToolCommandContext {
  return {
    file: file(),
    levelId: 'ground',
    points: [],
    picks: [],
    selection: [],
    option: (key) =>
      optionValue(file().project, 'WALL', optionsOf('WALL'), {}, key),
    optionNumber: () => undefined,
    newId: (prefix) => (prefix === '' ? 'abcdef12' : `${prefix}-test`),
    ...overrides,
  };
}

/** Les outils qui ramassent des clics et qui en font quelque chose. */
function toolsWithPoints() {
  return EDITOR_TOOLS.filter(
    (tool) => tool.requiredPoints > 0 && toolDefinition(tool.id).reads !== true,
  );
}

describe('the tools the editor offers', () => {
  it('answers every question about a tool from its own declaration', () => {
    // These four answers used to live in four separate switch statements, so a
    // new tool could compile while being unreachable, unconstrained or
    // silently needing zero clicks.
    expect(requiredPoints('WALL')).toBe(2);
    expect(requiredPoints('DIMENSION')).toBe(3);
    expect(requiredPoints('SELECT')).toBe(0);
    expect(constrainsDrafting('WALL')).toBe(true);
    expect(constrainsDrafting('DIMENSION')).toBe(false);
    expect(toolDefinition('NETWORK').group).toBe('NETWORKS');
  });

  it('offers fields to type into only where a tool reads them', () => {
    // Turning a selection is three clicks and no number; offering a length
    // there would invite the user to type into something nobody reads.
    expect(dynamicInputOf('WALL')).toEqual({ length: true, angle: true });
    expect(dynamicInputOf('MIRROR')?.angle).toBe(true);
    for (const tool of [
      'ROTATE',
      'JOIN',
      'TRIM',
      'OFFSET',
      'DIMENSION',
      'SPLIT',
      'NETWORK',
      'OPENING',
      'SELECT',
    ] as const)
      expect(dynamicInputOf(tool), tool).toBeUndefined();
  });

  it('never accepts a typed value a tool would then ignore', () => {
    // A tool that does not draft along the axes cannot honour a typed length:
    // saying it accepts one would be a promise the drawing does not keep.
    for (const tool of EDITOR_TOOLS)
      if (dynamicInputOf(tool.id) !== undefined)
        expect(constrainsDrafting(tool.id), tool.id).toBe(true);
  });

  it('gives every tool a shortcut the application actually binds', () => {
    for (const tool of EDITOR_TOOLS)
      expect(
        SHORTCUTS.some(({ id }) => id === tool.shortcutId),
        `${tool.id} declares ${tool.shortcutId}`,
      ).toBe(true);
  });

  it('lets every tool be reached from a palette group', () => {
    const grouped = populatedToolGroups().flatMap((group) =>
      toolsInGroup(group).map(({ id }) => id),
    );
    expect([...grouped].sort()).toEqual(
      EDITOR_TOOLS.map(({ id }) => id as string).sort(),
    );
  });

  it('asks for clicks only from tools that do something with them', () => {
    // Un outil qui lit — mesurer — prend des points et n'écrit rien. C'est la
    // seule raison acceptable de ne pas avoir de commande, et elle est
    // déclarée plutôt que devinée.
    for (const tool of toolsWithPoints())
      expect(
        toolDefinition(tool.id).createCommand !== undefined,
        `${tool.id} collects points`,
      ).toBe(true);
  });

  it('turns the clicks of the wall tool into a command', () => {
    const result = toolDefinition('WALL').createCommand?.(
      context({
        points: [
          { x: 0, y: 0 },
          { x: 4000, y: 0 },
        ],
      }),
    );
    expect(result?.status).toBe('OK');
    if (result?.status !== 'OK') return;
    expect(result.command.label).toContain('mur');
  });

  it('cuts the wall the click landed on, where it landed', () => {
    // Splitting used to cut at the middle whatever the user aimed at; the tool
    // is given what the canvas picked, and the point that was clicked.
    const result = toolDefinition('SPLIT').createCommand?.({
      ...context({ points: [{ x: 3000, y: 0 }] }),
      picks: ['wall-south'],
    });
    expect(result?.status).toBe('OK');
    if (result?.status !== 'OK') return;
    expect(result.command.label).toContain('Scinder');
  });

  it('asks for a wall rather than cutting nothing', () => {
    const result = toolDefinition('SPLIT').createCommand?.(
      context({ points: [{ x: 3000, y: 0 }] }),
    );
    expect(result?.status).toBe('ERROR');
    if (result?.status !== 'ERROR') return;
    expect(result.message).toContain('mur');
  });

  it('pose le composant à l’orientation que le fantôme montrait', () => {
    /*
     * Le fantôme tourne, l'objet posé aussi.
     *
     * `R` fait tourner l'aperçu sous le curseur ; sans ce passage, l'aperçu
     * promettait une orientation que la commande jetait, et l'objet retombait
     * à plat sur l'angle de son support. Un aperçu qui ment est pire que pas
     * d'aperçu du tout : on pose en confiance, et on corrige après.
     */
    const posed = (rotationDeg?: number) => {
      const result = toolDefinition('COMPONENT').createCommand?.({
        ...context({ points: [{ x: 2500, y: 500 }] }),
        option: (key) =>
          optionValue(
            file().project,
            'COMPONENT',
            optionsOf('COMPONENT'),
            {},
            key,
          ),
        ...(rotationDeg === undefined
          ? {}
          : { placementRotationDeg: rotationDeg }),
      });
      if (result?.status !== 'OK') throw new Error('la pose devait aboutir');
      return (result.command as AddComponentCommand).draft.rotationDeg;
    };
    expect(posed(37.5)).toBe(37.5);
    // Et rien n'est inventé quand on n'a rien demandé : le support décide,
    // comme avant.
    expect(posed()).not.toBe(37.5);
  });

  it('turns the selection by the angle two clicks describe', () => {
    // Centre, where things point now, where they should point: a quarter turn
    // without a number to type.
    const result = toolDefinition('ROTATE').createCommand?.({
      ...context({
        points: [
          { x: 0, y: 0 },
          { x: 1000, y: 0 },
          { x: 0, y: 1000 },
        ],
      }),
      selection: ['wall-south'],
    });
    expect(result?.status).toBe('OK');
    if (result?.status !== 'OK') return;
    expect(result.command.label).toContain('Pivoter');
  });

  it('reflects the selection across the axis that was drawn', () => {
    const result = toolDefinition('MIRROR').createCommand?.({
      ...context({
        points: [
          { x: 0, y: 0 },
          { x: 0, y: 1000 },
        ],
      }),
      selection: ['wall-south'],
    });
    expect(result?.status).toBe('OK');
  });

  it('refuses an axis of no length rather than reflecting nothing', () => {
    const result = toolDefinition('MIRROR').createCommand?.({
      ...context({
        points: [
          { x: 500, y: 500 },
          { x: 500, y: 500 },
        ],
      }),
      selection: ['wall-south'],
    });
    expect(result?.status).toBe('ERROR');
  });

  it('asks for a selection before transforming it', () => {
    const result = toolDefinition('ROTATE').createCommand?.(
      context({
        points: [
          { x: 0, y: 0 },
          { x: 1000, y: 0 },
          { x: 0, y: 1000 },
        ],
      }),
    );
    expect(result?.status).toBe('ERROR');
  });

  it('says why the network tool cannot place a node instead of throwing', () => {
    // A project with no network at all: the tool refuses in words rather than
    // placing a node nowhere.
    const empty = file();
    const withoutNetworks = {
      ...empty,
      project: { ...empty.project, systems: [] },
    } as typeof empty;
    const result = toolDefinition('NETWORK').createCommand?.({
      ...context({ points: [{ x: 1000, y: 1000 }] }),
      file: withoutNetworks,
      option: (key) =>
        optionValue(
          withoutNetworks.project,
          'NETWORK',
          optionsOf('NETWORK'),
          {},
          key,
        ),
    });
    expect(result?.status).toBe('ERROR');
    if (result?.status !== 'ERROR') return;
    expect(result.message).toContain('réseau');
  });

  it('places a node on the level the plan is showing', () => {
    // No draft at all: the options fall back to what the project holds — its
    // first network, and the first node kind of that discipline.
    const opened = file();
    const result = toolDefinition('NETWORK').createCommand?.({
      ...context({ points: [{ x: 1000, y: 1000 }] }),
      option: (key) =>
        optionValue(opened.project, 'NETWORK', optionsOf('NETWORK'), {}, key),
    });
    expect(result?.status).toBe('OK');
  });
});

describe('the options a tool asks for', () => {
  it('falls back to what the project can actually offer', () => {
    const project = file().project;
    // Nothing chosen: the wall tool proposes an assembly this project holds
    // rather than a name written into the code.
    const assemblyId = optionValue(
      project,
      'WALL',
      optionsOf('WALL'),
      {},
      'assemblyId',
    );
    expect((project.assemblies ?? []).map(({ id }) => id as string)).toContain(
      assemblyId,
    );
  });

  it('refuses a stored value the project no longer holds', () => {
    const project = file().project;
    const chosen = optionValue(
      project,
      'WALL',
      optionsOf('WALL'),
      { 'WALL.assemblyId': 'assembly-deleted' },
      'assemblyId',
    );
    // Drawing with a reference pointing nowhere is worse than drawing with
    // what the project has.
    expect(chosen).not.toBe('assembly-deleted');
    expect((project.assemblies ?? []).map(({ id }) => id as string)).toContain(
      chosen,
    );
  });

  it('lets one option depend on another', () => {
    const project = file().project;
    // The kinds of node belong to the discipline of the chosen network.
    const kind = optionValue(
      project,
      'NETWORK',
      optionsOf('NETWORK'),
      {},
      'nodeKind',
    );
    expect(kind).not.toBe('');
    const water = optionsOf('NETWORK')
      .find(({ key }) => key === 'nodeKind')!
      .choices?.({
        project,
        value: () => project.systems?.[0]?.id ?? '',
      });
    expect(water?.map(({ value }) => value)).toContain(kind);
  });

  it('proposes the matching role when a partition assembly is chosen', () => {
    const project = file().project;
    const partition = (project.assemblies ?? []).find(
      ({ category }) => category === 'PARTITION',
    )!;
    expect(
      optionValue(
        project,
        'WALL',
        optionsOf('WALL'),
        { 'WALL.assemblyId': partition.id },
        'role',
      ),
    ).toBe('PARTITION');
  });
});

describe('restricting what a click may take', () => {
  it('filters nothing until the user asks for it', () => {
    // An editor quietly ignoring half the plan would be one nobody trusts.
    expect(
      optionValue(file().project, 'SELECT', optionsOf('SELECT'), {}, 'family'),
    ).toBe('ALL');
  });

  it('offers every family the object registry declares', () => {
    const choices = optionsOf('SELECT')
      .find(({ key }) => key === 'family')!
      .choices?.({ project: file().project, value: () => '' });
    expect(choices?.map(({ value }) => value)).toEqual([
      'ALL',
      ...OBJECT_FAMILIES.map(({ id }) => id),
    ]);
  });
});

describe('how much of the editor is shown', () => {
  it('offers what a house needs at the narrowest level', () => {
    const offered = EDITOR_TOOLS.filter((tool) => toolAtLevel(tool, 'QUICK'));
    expect(offered.map(({ id }) => id)).toEqual([
      'SELECT',
      'WALL',
      'WALL_RUN',
      'OPENING',
      'SPACE',
    ]);
  });

  it('offers everything at the widest, and nothing beyond it', () => {
    expect(
      EDITOR_TOOLS.filter((tool) => toolAtLevel(tool, 'EXPERT')),
    ).toHaveLength(EDITOR_TOOLS.length);
  });

  it('grows: what one level offers, the next offers too', () => {
    const at = (level: EditorLevel) =>
      new Set(
        EDITOR_TOOLS.filter((tool) => toolAtLevel(tool, level)).map(
          ({ id }) => id,
        ),
      );
    for (const id of at('QUICK')) expect(at('DESIGN').has(id)).toBe(true);
    for (const id of at('DESIGN')) expect(at('EXPERT').has(id)).toBe(true);
  });

  it('leaves an unshown group out rather than showing an empty one', () => {
    for (const level of EDITOR_LEVELS)
      for (const group of populatedToolGroupsAtLevel(level))
        expect(toolsInGroupAtLevel(group, level).length).toBeGreaterThan(0);
  });
});

describe('ce que « terminer » veut dire', () => {
  it('ne veut rien dire pour un outil qui sait combien de points il attend', () => {
    // Un mur entre deux points se termine tout seul : lui proposer de fermer
    // une surface serait proposer un geste qui n'existe pas.
    for (const tool of EDITOR_TOOLS) {
      if (isOpenEnded(tool.id)) continue;
      expect(completionModeOf(tool.id), tool.id).toBeUndefined();
    }
  });

  it('sépare les surfaces des chemins, et un seul endroit les nomme', () => {
    const closing = EDITOR_TOOLS.filter(
      ({ id }) => completionModeOf(id) === 'CLOSE_POLYGON',
    ).map(({ id }) => id);
    expect([...closing].sort()).toEqual(['ROOF', 'SITE', 'SLAB', 'SLAB_HOLE']);
    // Tout autre outil ouvert termine un chemin : il n'y a pas de troisième
    // cas, et rien à déclarer pour l'obtenir.
    for (const tool of EDITOR_TOOLS) {
      if (!isOpenEnded(tool.id)) continue;
      if (closing.includes(tool.id)) continue;
      expect(completionModeOf(tool.id), tool.id).toBe('FINISH_PATH');
    }
  });

  it('demande au moins trois sommets pour une surface', () => {
    // Deux sommets ne referment rien, et un bouton « Fermer la surface » qui
    // refuse ensuite se lit comme une panne.
    for (const tool of EDITOR_TOOLS) {
      if (completionModeOf(tool.id) !== 'CLOSE_POLYGON') continue;
      expect(requiredPoints(tool.id), tool.id).toBeGreaterThanOrEqual(3);
    }
  });

  it('écrit le geste avec le mot du geste', () => {
    expect(completionLabel('CLOSE_POLYGON')).toBe('Fermer la surface');
    expect(completionLabel('FINISH_PATH')).toBe('Terminer le tracé');
  });
});

describe('ce qu’un outil déclare attendre, clic par clic', () => {
  it('ne laisse jamais les étapes contredire le nombre de points', () => {
    /*
     * Deux déclarations du même geste sont deux vérités qui divergent : un
     * outil passé de deux à trois clics, dont les étapes en décrivent
     * toujours deux, afficherait « Cliquez son extrémité » pour un clic qui
     * n'est pas celui-là — et le compilateur n'en saurait rien, puisque les
     * deux champs sont valides séparément. Le nombre de points reste
     * l'autorité ; c'est ici qu'on empêche la seconde source de vérité.
     */
    for (const tool of EDITOR_TOOLS) {
      expect(stepCoherenceProblem(tool), tool.id).toBeUndefined();
    }
  });

  it('déclare une phrase que l’écran peut prolonger', () => {
    for (const tool of EDITOR_TOOLS) {
      for (const step of interactionOf(tool.id) ?? []) {
        expect(step.prompt.length, tool.id).toBeGreaterThan(0);
        // Le point final appartient à l'écran, qui ajoute parfois ce qui est
        // déjà posé ou comment refermer. Une étape ponctuée obligerait à
        // dépoinctuer pour la prolonger.
        expect(step.prompt.endsWith('.'), `${tool.id} · ${step.prompt}`).toBe(
          false,
        );
        // Le rang du point est précisément ce qu'on remplace : une étape qui
        // le redit n'apporte rien de plus que le repli qu'elle remplace.
        expect(step.prompt, tool.id).not.toMatch(
          /(premier|second|deuxième|troisième) point\b/i,
        );
      }
    }
  });

  it('ne laisse viser que des familles d’objets qui existent', () => {
    // `accepts` servira à restreindre ce qu'un clic peut attraper. Une famille
    // mal orthographiée ne restreindrait rien du tout, en silence.
    const known = OBJECT_FAMILIES.flatMap((family) => [...family.kinds]);
    for (const tool of EDITOR_TOOLS) {
      for (const step of interactionOf(tool.id) ?? []) {
        for (const kind of step.accepts ?? [])
          expect(known, `${tool.id} · ${kind}`).toContain(kind);
      }
    }
  });

  it('nomme l’objet du geste pour les outils où le rang ne disait rien', () => {
    /*
     * Les huit outils du relevé : ceux dont les clics portent des rôles
     * distincts, que « premier / second point » écrasait en un seul. Les
     * inscrire ici est ce qui empêche qu'une refonte du registre les
     * reperde sans que personne ne le voie.
     */
    for (const id of [
      'WALL',
      'OPENING',
      'OFFSET',
      'JOIN',
      'TRIM',
      'DIMENSION',
      'ROTATE',
      'NETWORK_ROUTE',
    ] as const) {
      const steps = interactionOf(id);
      expect(steps, id).toBeDefined();
      // Deux clics de rôles différents ne peuvent pas partager une phrase.
      const prompts = new Set(steps!.map(({ prompt }) => prompt));
      expect(prompts.size, id).toBe(steps!.length);
    }
  });

  it('demande au clic qui vise un objet de dire lequel', () => {
    // Un outil qui coupe un mur ne devrait pas pouvoir attraper la cotation
    // qui passe par là. Le tracé de réseau fait exception : ce qu'un tronçon
    // relie est un nœud ou un équipement, et le nœud n'est pas une famille
    // que le registre d'objets nomme à part.
    for (const tool of EDITOR_TOOLS) {
      if (tool.id === 'NETWORK_ROUTE') continue;
      for (const step of interactionOf(tool.id) ?? []) {
        if (step.kind !== 'PICK') continue;
        expect(step.accepts, `${tool.id} · ${step.prompt}`).toBeDefined();
      }
    }
  });

  it('répète la dernière étape au-delà de ce qu’un tracé ouvert exige', () => {
    const last = interactionOf('SITE')!.slice(-1)[0]!;
    expect(interactionStepAt('SITE', 12)).toBe(last);
    // Un outil qui ne déclare rien ne répond rien, et le repli s'applique.
    expect(interactionStepAt('SELECT', 0)).toBeUndefined();
  });
});

/**
 * Un geste par objet du terrain, et non un geste pour tous.
 *
 * L'outil Terrain traçait tout ce qui entoure la maison de la même façon :
 * trois sommets au minimum, et on referme. C'est le geste de la parcelle, du
 * voisin, de la terrasse — ce n'est celui ni de l'arbre, ni de la haie, ni du
 * portail, et le leur imposer demandait à quelqu'un de dessiner un houppier
 * sommet par sommet. Ces tests tiennent la séparation par les deux bouts : ce
 * que l'outil des surfaces n'offre plus, et ce que les outils du geste
 * demandent.
 */
describe('ce que chaque chose du terrain demande pour être posée', () => {
  /** Les natures que l'outil des surfaces accepte encore de tracer. */
  function surfaceChoices(): readonly string[] {
    const choices = optionsOf('SITE')
      .find(({ key }) => key === 'kind')!
      .choices?.({ project: file().project, value: () => '' });
    return (choices ?? []).map(({ value }) => value);
  }

  it('ne propose plus de tracer un arbre en polygone fermé', () => {
    // Le chemin par lequel un houppier pouvait naître triangulaire.
    for (const kind of ['TREE', 'HEDGE', 'FENCE', 'GATE'])
      expect(surfaceChoices(), kind).not.toContain(kind);
    // Ce qui est vraiment une surface reste là où on le trace.
    for (const kind of ['BUILDING', 'TERRACE', 'PATH', 'PARKING', 'EXCLUSION'])
      expect(surfaceChoices(), kind).toContain(kind);
  });

  /**
   * Ce qu'un outil du terrain pose vraiment, en le lui faisant faire.
   *
   * On lit la commande qu'il fabrique plutôt que ce qu'il déclare : c'est la
   * seule lecture qu'un outil ne puisse pas démentir.
   */
  function kindPosedBy(toolId: EditorTool): string | undefined {
    const result = toolDefinition(toolId).createCommand?.(
      context({
        points: [
          { x: 0, y: 0 },
          { x: 5000, y: 0 },
          { x: 5000, y: 5000 },
        ],
        option: (key) =>
          optionValue(file().project, toolId, optionsOf(toolId), {}, key),
      }),
    );
    if (result === undefined || result.status !== 'OK') return undefined;
    // La commande porte le brouillon qu'elle appliquera ; on le lit tel quel
    // plutôt que de l'appliquer, parce que la question est ce que l'outil
    // fabrique, pas ce que le projet en fait ensuite.
    const posed = result.command as unknown as {
      readonly draft?: { readonly kind?: string };
    };
    return posed.draft?.kind;
  }

  it('offre à chaque nature qui n’est pas une surface son propre outil', () => {
    // Une nature retirée de la liste des surfaces sans outil qui la pose
    // serait une chose qu'on ne peut plus dessiner du tout.
    const posed = new Set(
      EDITOR_TOOLS.filter(({ group }) => group === 'SITE').map(({ id }) =>
        kindPosedBy(id),
      ),
    );
    for (const kind of SITE_OBSTACLE_KINDS) {
      if (isSurfaceSiteKind(kind)) continue;
      expect(posed, kind).toContain(kind);
    }
  });

  it('plante un arbre d’un seul clic', () => {
    expect(requiredPoints('SITE_TREE')).toBe(1);
    expect(isOpenEnded('SITE_TREE')).toBe(false);
    expect(completionModeOf('SITE_TREE')).toBeUndefined();
    // Et le diamètre du houppier est une saisie, pas une série de clics.
    expect(optionsOf('SITE_TREE').map(({ key }) => key)).toContain(
      'crownDiameterMm',
    );
  });

  it('suit une haie et une clôture sans jamais les refermer', () => {
    for (const tool of ['SITE_HEDGE', 'SITE_FENCE'] as const) {
      expect(requiredPoints(tool), tool).toBe(2);
      expect(isOpenEnded(tool), tool).toBe(true);
      // Un tracé qu'on termine, pas une surface qu'on referme : proposer
      // « Fermer la surface » pour une clôture serait proposer un aller-retour
      // à la souris en guise d'épaisseur.
      expect(completionModeOf(tool), tool).toBe('FINISH_PATH');
    }
    // La haie a une largeur ; la clôture est une ligne et n'en a pas.
    expect(optionsOf('SITE_HEDGE').map(({ key }) => key)).toContain('widthMm');
    expect(optionsOf('SITE_FENCE').map(({ key }) => key)).not.toContain(
      'widthMm',
    );
  });

  it('pose un portail entre deux points, et s’arrête là', () => {
    expect(requiredPoints('SITE_GATE')).toBe(2);
    expect(isOpenEnded('SITE_GATE')).toBe(false);
  });

  it('nomme l’objet dans chacune de ses phrases', () => {
    // « Cliquez le premier point » ne dit pas ce qu'on est en train de poser.
    // Un outil dont le geste est particulier doit nommer sa chose.
    for (const [tool, mot] of [
      ['SITE_TREE', /arbre/iu],
      ['SITE_HEDGE', /haie/iu],
      ['SITE_FENCE', /clôture|poteau/iu],
      ['SITE_GATE', /portail|montant/iu],
    ] as const) {
      const steps = interactionOf(tool);
      expect(steps, tool).toBeDefined();
      for (const step of steps!) expect(step.prompt, tool).toMatch(mot);
    }
  });
});

describe('ce qu’un outil demande, et quand il le demande', () => {
  /*
   * Une option peut dépendre d'une autre — la nature d'un obstacle ne se pose
   * que si l'on trace un obstacle. Ce qui est déclaré est donc une petite
   * fonction, et une petite fonction se trompe : celle-ci pourrait lire une
   * clé qui n'existe pas, ou refuser tous les états d'un coup. On parcourt
   * donc chaque état que l'utilisateur peut atteindre en touchant un seul
   * menu, et l'on vérifie que la barre y reste utilisable.
   */
  function statesOf(toolId: EditorTool): readonly ToolDrafts[] {
    const options = optionsOf(toolId);
    const states: ToolDrafts[] = [{}];
    for (const option of options) {
      if (option.kind !== 'SELECT') continue;
      for (const choice of option.choices?.({
        project: file().project,
        value: () => '',
      }) ?? [])
        states.push({ [storageKeyOf(toolId, option)]: choice.value });
    }
    return states;
  }

  it('laisse toujours quelque chose à décider, quel que soit l’état', () => {
    const project = file().project;
    for (const tool of EDITOR_TOOLS) {
      const options = optionsOf(tool.id);
      if (options.length === 0) continue;
      for (const drafts of statesOf(tool.id)) {
        const layout = toolOptionLayout(project, tool.id, options, drafts);
        // Un outil dont tout serait masqué ou replié n'offrirait qu'un
        // « Plus de réglages » : le dépliage aurait alors caché l'outil.
        expect(
          layout.primary.length,
          `${tool.id} ${JSON.stringify(drafts)}`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it('ne masque jamais ce qu’il faudra bien avoir dit', () => {
    /*
     * Une option retirée de l'écran garde sa valeur, et c'est ce qui permet
     * de la retirer. On le vérifie là où la dépendance est déclarée : on
     * répond, on change d'avis en touchant chaque menu de l'outil, et l'on
     * relit — y compris dans les états où le champ a disparu.
     */
    const project = file().project;
    for (const tool of EDITOR_TOOLS) {
      const options = optionsOf(tool.id);
      const dependent = options.filter(
        ({ visibleWhen }) => visibleWhen !== undefined,
      );
      for (const option of dependent) {
        const choices = option.choices?.({ project, value: () => '' }) ?? [];
        const answer =
          option.kind === 'SELECT'
            ? choices[choices.length - 1]?.value
            : option.kind === 'NUMBER'
              ? '4321'
              : 'ce qu’on a répondu';
        if (answer === undefined || answer === '') continue;
        const held = { [storageKeyOf(tool.id, option)]: answer };
        for (const drafts of statesOf(tool.id))
          expect(
            optionValue(
              project,
              tool.id,
              options,
              { ...drafts, ...held },
              option.key,
            ),
            `${tool.id}.${option.key}`,
          ).toBe(answer);
      }
    }
  });
});
