import { describe, expect, it } from 'vitest';
import { ProjectCommandDispatcher } from '@house-technical-designer/editor-core';
import { loadDemoProject } from '../demo-project.js';
import {
  EMPTY_CLIPBOARD,
  clipboardIsEmpty,
  copyObjects,
  duplicateObjectsCommand,
  moveObjectsCommand,
  pasteClipboardCommand,
  repeatObjectsCommand,
} from './editing-commands.js';

function file() {
  const result = loadDemoProject();
  if (result.status !== 'OK') throw new Error(result.message);
  return result.file;
}

function walls(project: ReturnType<typeof file>['project']) {
  return project.building.levels[0]!.walls;
}

describe('carrying a selection across the plan', () => {
  it('moves several walls as a single action', () => {
    const opened = file();
    const before = walls(opened.project).find(({ id }) => id === 'wall-south')!;
    const result = moveObjectsCommand(
      opened,
      'ground',
      ['wall-south', 'wall-north'],
      { x: 500, y: -250 },
    );
    expect(result.status).toBe('OK');
    if (result.status !== 'OK') return;

    const dispatcher = new ProjectCommandDispatcher(opened.project);
    expect(dispatcher.dispatch(result.command).status).toBe('APPLIED');
    const after = walls(dispatcher.project).find(
      ({ id }) => id === 'wall-south',
    )!;
    expect(after.path.points[0]).toEqual({
      x: before.path.points[0]!.x + 500,
      y: before.path.points[0]!.y - 250,
    });

    // One drag, one undo: both walls come back.
    expect(dispatcher.undo().status).toBe('APPLIED');
    expect(
      walls(dispatcher.project).find(({ id }) => id === 'wall-south')!.path
        .points[0],
    ).toEqual(before.path.points[0]);
  });

  it('carries a slab and a roof by their outline', () => {
    const opened = file();
    const result = moveObjectsCommand(opened, 'ground', ['slab-ground'], {
      x: 100,
      y: 100,
    });
    expect(result.status).toBe('OK');
    if (result.status !== 'OK') return;
    const dispatcher = new ProjectCommandDispatcher(opened.project);
    expect(dispatcher.dispatch(result.command).status).toBe('APPLIED');
    const slab = dispatcher.project.building.levels[0]!.slabs[0]!;
    const original = opened.project.building.levels[0]!.slabs[0]!;
    expect(slab.polygon.outer[0]).toEqual({
      x: original.polygon.outer[0]!.x + 100,
      y: original.polygon.outer[0]!.y + 100,
    });
  });

  it('refuses to carry an opening away from its wall, and says why', () => {
    const result = moveObjectsCommand(file(), 'ground', ['opening-entry'], {
      x: 100,
      y: 0,
    });
    expect(result.status).toBe('ERROR');
    if (result.status !== 'ERROR') return;
    // One refusal for the three verbs: an opening belongs to its wall whether
    // the wall is being moved, turned or reflected.
    expect(result.message).toContain('appartient à son mur');
  });

  it('refuses a room, which is what its walls enclose', () => {
    const result = moveObjectsCommand(file(), 'ground', ['space-living'], {
      x: 100,
      y: 0,
    });
    expect(result.status).toBe('ERROR');
    if (result.status !== 'ERROR') return;
    expect(result.message).toContain('murs');
  });

  it('refuses an unmeasurable move rather than writing one', () => {
    const result = moveObjectsCommand(file(), 'ground', ['wall-south'], {
      x: Number.NaN,
      y: 0,
    });
    expect(result.status).toBe('ERROR');
  });
});

describe('copying a selection a little to the side', () => {
  const ids = (prefix: string) => `${prefix}-copy`;

  it('donne un support à la copie d’un équipement qui n’en nommait pas', () => {
    /*
     * Sept équipements sur vingt-trois se laissaient dupliquer.
     *
     * Les vingt-trois appareils de la maison de référence sont posés sans
     * support nommé, et la fiche d'un plafonnier exige un mur ou une dalle.
     * La copie était donc refusée — « Ce modèle se fixe à : Mur, Dalle » —
     * alors que l'original est là, sous les yeux. Le refus était exact : c'est
     * bien la copie qui manquait de support. Seuls passaient les sept
     * appareils dont la fiche n'exige rien.
     *
     * La copie demande maintenant son support à la règle qui répond déjà pour
     * une pose, au point où elle arrive. Il en reste un seul de refusé, et
     * pour une raison qu'on ne peut pas lui enlever : un disjoncteur se fixe à
     * un tableau, et déplacer une copie de soixante centimètres ne la pose sur
     * aucun tableau.
     */
    const opened = file();
    const level = opened.project.building.levels[0]!;
    const posed = level.components ?? [];
    expect(posed.length).toBeGreaterThan(20);
    const accepted = posed.filter((component) => {
      const result = duplicateObjectsCommand(
        opened,
        'ground',
        [component.id],
        { x: 600, y: 0 },
        (prefix) => `${prefix}-${component.id}`,
      );
      return (
        result.status === 'OK' && result.command.validate(opened.project).valid
      );
    });
    expect(accepted.length).toBe(posed.length - 1);
  });

  it('dit laquelle des copies est refusée, et ce qu’il faut en faire', () => {
    /*
     * Une copie peut être impossible là où elle tombe.
     *
     * Un appareil répété finit par sortir de la dalle qui le portait, et sa
     * fiche exige un support. Le refus remontait alors du modèle, nommant
     * l'identifiant d'un objet que personne n'a jamais vu :
     * « component:add:component-1803978a-4ec8-… ». Rien ne disait laquelle des
     * copies était en cause, ni qu'il suffisait d'en demander moins.
     */
    const opened = file();
    const result = repeatObjectsCommand(
      opened,
      'ground',
      ['component-battery'],
      // Le pas est choisi pour que la troisième copie sorte de la dalle : les
      // deux premières passent, ce qui est le cas intéressant.
      [
        { x: 833, y: 0 },
        { x: 1666, y: 0 },
        { x: 2499, y: 0 },
      ],
      (prefix) => `${prefix}-copie`,
    );
    expect(result.status).toBe('ERROR');
    if (result.status !== 'ERROR') return;
    expect(result.message).toContain('copie n° 3');
    expect(result.message).toContain('Mur, Dalle');
    expect(result.message).toContain('Réduisez le pas');
  });

  it('copies walls and reports the copies, which is what is worked on next', () => {
    const opened = file();
    const result = duplicateObjectsCommand(
      opened,
      'ground',
      ['wall-south', 'wall-north'],
      { x: 200, y: 200 },
      (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 8)}`,
    );
    expect(result.status).toBe('OK');
    if (result.status !== 'OK') return;
    expect(result.createdIds).toHaveLength(2);

    const dispatcher = new ProjectCommandDispatcher(opened.project);
    expect(dispatcher.dispatch(result.command).status).toBe('APPLIED');
    expect(walls(dispatcher.project)).toHaveLength(
      walls(opened.project).length + 2,
    );
    const copy = walls(dispatcher.project).find(
      ({ id }) => id === result.createdIds[0],
    )!;
    const original = walls(opened.project).find(
      ({ id }) => id === 'wall-south',
    )!;
    expect(copy.path.points[0]).toEqual({
      x: original.path.points[0]!.x + 200,
      y: original.path.points[0]!.y + 200,
    });
    expect(copy.assemblyId).toBe(original.assemblyId);

    // One action, one undo.
    expect(dispatcher.undo().status).toBe('APPLIED');
    expect(walls(dispatcher.project)).toHaveLength(
      walls(opened.project).length,
    );
  });

  it('hosts a copied opening on the copy of its wall', () => {
    const opened = file();
    const host = opened.project.building.levels[0]!.openings.find(
      ({ id }) => id === 'opening-entry',
    )!.host.id;
    const result = duplicateObjectsCommand(
      opened,
      'ground',
      [host, 'opening-entry'],
      { x: 0, y: 1000 },
      ids,
    );
    expect(result.status).toBe('OK');
    if (result.status !== 'OK') return;
    const dispatcher = new ProjectCommandDispatcher(opened.project);
    expect(dispatcher.dispatch(result.command).status).toBe('APPLIED');
    const copied = dispatcher.project.building.levels[0]!.openings.find(
      ({ id }) => id === 'opening-copy',
    )!;
    expect(copied.host.id).toBe('wall-copy');
  });

  it('refuses an opening whose wall is not being copied, and says why', () => {
    const result = duplicateObjectsCommand(
      file(),
      'ground',
      ['opening-entry'],
      { x: 0, y: 1000 },
      ids,
    );
    expect(result.status).toBe('ERROR');
    if (result.status !== 'ERROR') return;
    expect(result.message).toContain('son mur');
  });

  it('refuses a selection with nothing it can copy', () => {
    expect(
      duplicateObjectsCommand(file(), 'ground', [], { x: 0, y: 0 }, ids).status,
    ).toBe('ERROR');
    expect(
      duplicateObjectsCommand(
        file(),
        'ground',
        ['water:sink'],
        { x: 0, y: 0 },
        ids,
      ).status,
    ).toBe('ERROR');
  });
});

describe('copying to another storey', () => {
  const ids = (prefix: string) => `${prefix}-pasted`;

  it('keeps the objects rather than their identifiers', () => {
    const taken = copyObjects(file(), 'ground', ['wall-south', 'slab-ground']);
    expect(taken.walls.map(({ id }) => id)).toEqual(['wall-south']);
    expect(taken.slabs).toHaveLength(1);
    expect(clipboardIsEmpty(taken)).toBe(false);
    expect(clipboardIsEmpty(copyObjects(file(), 'ground', []))).toBe(true);
  });

  it('leaves out an opening whose wall was not copied', () => {
    // Pasted elsewhere it would have no wall to sit in.
    const taken = copyObjects(file(), 'ground', ['opening-entry']);
    expect(taken.openings).toEqual([]);
  });

  it('puts the copy down on the storey being drawn', () => {
    const opened = file();
    const taken = copyObjects(opened, 'ground', ['wall-south']);
    const result = pasteClipboardCommand(
      opened,
      'ground',
      taken,
      { x: 200, y: 200 },
      ids,
    );
    expect(result.status).toBe('OK');
    if (result.status !== 'OK') return;
    const dispatcher = new ProjectCommandDispatcher(opened.project);
    expect(dispatcher.dispatch(result.command).status).toBe('APPLIED');
    const pasted = walls(dispatcher.project).find(
      ({ id }) => id === 'wall-pasted',
    )!;
    // The copy belongs to the storey it was pasted on, whichever one that is.
    expect(pasted.levelId).toBe('ground');
    expect(pasted.path.points[0]).toEqual({
      x:
        walls(opened.project).find(({ id }) => id === 'wall-south')!.path
          .points[0]!.x + 200,
      y:
        walls(opened.project).find(({ id }) => id === 'wall-south')!.path
          .points[0]!.y + 200,
    });
  });

  it('survives the original being deleted in between', () => {
    const opened = file();
    const taken = copyObjects(opened, 'ground', ['wall-south']);
    const dispatcher = new ProjectCommandDispatcher(opened.project);
    // Whatever happens to the original, what was copied is what is pasted.
    const result = pasteClipboardCommand(
      { ...opened, project: dispatcher.project },
      'ground',
      taken,
      { x: 0, y: 0 },
      ids,
    );
    expect(result.status).toBe('OK');
  });

  it('refuses to paste what was never copied', () => {
    const result = pasteClipboardCommand(
      file(),
      'ground',
      EMPTY_CLIPBOARD,
      { x: 0, y: 0 },
      ids,
    );
    expect(result.status).toBe('ERROR');
    if (result.status !== 'ERROR') return;
    expect(result.message).toContain('copié');
  });
});

describe('what a copy knows about height once pasted upstairs', () => {
  const ids = (prefix: string) => `${prefix}-upstairs`;

  /** The demonstration house with a first floor above the ground one. */
  function twoStoreys() {
    const opened = file();
    // The reference house puts its roof on the storey it covers; this suite is
    // about copying one upstairs, so it starts from a roof on the ground.
    const ground = {
      ...opened.project.building.levels[0]!,
      roofs: opened.project.building.levels.flatMap((level) => level.roofs),
    };
    const first = {
      ...ground,
      id: 'first',
      name: 'Étage',
      elevationMm: ground.elevationMm + 2800,
      walls: [],
      openings: [],
      spaces: [],
      slabs: [],
      roofs: [],
      annotations: [],
    };
    return {
      ...opened,
      project: {
        ...opened.project,
        building: {
          ...opened.project.building,
          levels: [ground, first],
        },
      },
    } as typeof opened;
  }

  it('raises a roof plane by the height between the two storeys', () => {
    const opened = twoStoreys();
    const roof = opened.project.building.levels[0]!.roofs[0]!;
    const taken = copyObjects(opened, 'ground', [roof.id]);
    const result = pasteClipboardCommand(
      opened,
      'first',
      taken,
      { x: 0, y: 0 },
      ids,
    );
    expect(result.status).toBe('OK');
    if (result.status !== 'OK') return;
    const dispatcher = new ProjectCommandDispatcher(opened.project);
    expect(dispatcher.dispatch(result.command).status).toBe('APPLIED');
    const pasted = dispatcher.project.building.levels[1]!.roofs[0]!;
    // Same shape, one storey higher: the altitude of the floor it came from
    // would have put it back through the ground floor ceiling.
    expect(pasted.baseElevationMm).toBe(roof.baseElevationMm + 2800);
  });

  it('keeps the altitude when the copy stays on its own storey', () => {
    const opened = twoStoreys();
    const roof = opened.project.building.levels[0]!.roofs[0]!;
    const taken = copyObjects(opened, 'ground', [roof.id]);
    const result = pasteClipboardCommand(
      opened,
      'ground',
      taken,
      { x: 100, y: 100 },
      ids,
    );
    expect(result.status).toBe('OK');
    if (result.status !== 'OK') return;
    const dispatcher = new ProjectCommandDispatcher(opened.project);
    dispatcher.dispatch(result.command);
    expect(
      dispatcher.project.building.levels[0]!.roofs.find(
        ({ id }) => id === 'roof-upstairs',
      )!.baseElevationMm,
    ).toBe(roof.baseElevationMm);
  });

  it('builds a wall up to the storey that means the same thing', () => {
    const opened = twoStoreys();
    const ground = opened.project.building.levels[0]!;
    const withCeiling = {
      ...opened,
      project: {
        ...opened.project,
        building: {
          ...opened.project.building,
          levels: [
            {
              ...ground,
              walls: ground.walls.map((wall) =>
                wall.id === 'wall-south'
                  ? {
                      ...wall,
                      heightMode: 'TO_LEVEL' as const,
                      topLevelId: 'first',
                    }
                  : wall,
              ),
            },
            opened.project.building.levels[1]!,
            {
              ...opened.project.building.levels[1]!,
              id: 'second',
              name: 'Combles',
              elevationMm: 5600,
            },
          ],
        },
      },
    } as typeof opened;

    const taken = copyObjects(withCeiling, 'ground', ['wall-south']);
    const result = pasteClipboardCommand(
      withCeiling,
      'first',
      taken,
      { x: 0, y: 0 },
      ids,
    );
    expect(result.status).toBe('OK');
    if (result.status !== 'OK') return;
    const dispatcher = new ProjectCommandDispatcher(withCeiling.project);
    expect(dispatcher.dispatch(result.command).status).toBe('APPLIED');
    const pasted = dispatcher.project.building.levels[1]!.walls.find(
      ({ id }) => id === 'wall-upstairs',
    )!;
    // Built up to the floor above the one it landed on, not back down to the
    // floor above the one it came from.
    expect(pasted.heightMode).toBe('TO_LEVEL');
    if (pasted.heightMode !== 'TO_LEVEL') return;
    expect(pasted.topLevelId).toBe('second');
  });

  it('states a height when there is no storey that high to point at', () => {
    const opened = twoStoreys();
    const ground = opened.project.building.levels[0]!;
    const withCeiling = {
      ...opened,
      project: {
        ...opened.project,
        building: {
          ...opened.project.building,
          levels: [
            {
              ...ground,
              walls: ground.walls.map((wall) =>
                wall.id === 'wall-south'
                  ? {
                      ...wall,
                      heightMode: 'TO_LEVEL' as const,
                      topLevelId: 'first',
                    }
                  : wall,
              ),
            },
            opened.project.building.levels[1]!,
          ],
        },
      },
    } as typeof opened;
    const taken = copyObjects(withCeiling, 'ground', ['wall-south']);
    const result = pasteClipboardCommand(
      withCeiling,
      'first',
      taken,
      { x: 0, y: 0 },
      ids,
    );
    expect(result.status).toBe('OK');
    if (result.status !== 'OK') return;
    const dispatcher = new ProjectCommandDispatcher(withCeiling.project);
    expect(dispatcher.dispatch(result.command).status).toBe('APPLIED');
    const pasted = dispatcher.project.building.levels[1]!.walls.find(
      ({ id }) => id === 'wall-upstairs',
    )!;
    // A reference nobody can resolve is worse than a height it can state.
    expect(pasted.heightMode).toBe('EXPLICIT');
  });
});
