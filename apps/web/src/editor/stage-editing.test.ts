/**
 * Ce que l'interface propose, comparé à ce que le projet accepte.
 *
 * Le verrou central refusait déjà les commandes venues du mauvais espace, et
 * ce test n'existe pas pour le vérifier une seconde fois — `ownership.test.ts`
 * s'en charge. Il existe parce qu'un refus n'est pas une interface : mesurés
 * sur la maison de référence, l'inspecteur et le menu offraient encore
 * 4 392 champs modifiables, 828 boutons « Supprimer », 1 800 transformations
 * et 66 gestes de famille sur des objets qu'aucune de ces commandes n'aurait
 * pu toucher depuis l'espace où on les regardait. Sept mille propositions dont
 * la seule issue était une phrase en bas de l'écran.
 *
 * Les nombres viennent du fichier et non d'une maquette : une règle vérifiée
 * sur deux objets inventés dit seulement que les deux ont été inventés
 * ensemble. Ici, tout ce que la maison contient est passé devant les sept
 * espaces, et le compte attendu est zéro.
 *
 * La seconde moitié du test lit le code de l'inspecteur et de la coque. Une
 * règle juste que le panneau ne reçoit pas est une règle qui n'existe pas :
 * c'est exactement l'état d'avant, où `InspectorPanel` ne savait même pas
 * depuis quel espace on le regardait.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { loadDemoProject } from '../demo-project.js';
import {
  CREATION_STAGES,
  type CreationStageId,
} from '../ux/creation-stages.js';
import { ownerStageOf } from '../ux/ownership.js';
import { objectActionsFor, type ObjectActionHost } from './object-actions.js';
import {
  contextActionsFor,
  editsFor,
  inspectObject,
} from './object-editors.js';
import {
  canDeleteInStage,
  contextActionsInStage,
  editsInStage,
  objectActionsInStage,
  readOnlyNoticeFor,
  sharedEditsInStage,
} from './stage-editing.js';

/** Une coque qui ne fait rien : on compte ce qui est offert, pas ce qui suit. */
const NOTHING: ObjectActionHost = {
  transform: () => {},
  align: () => {},
  duplicate: () => {},
  remove: () => {},
  frame: () => {},
  selectSimilar: () => {},
  startTool: () => {},
  runCommand: () => {},
};

const demo = loadDemoProject();
if (demo.status === 'ERROR') throw new Error(demo.message);
const house = demo.file.project;

const LEVEL_IDS = house.building.levels.map(({ id }) => id);

/** Tout ce que la maison de référence contient, identifiant par identifiant. */
function everything(): readonly string[] {
  const ids: string[] = ['site:parcel'];
  for (const level of house.building.levels) {
    ids.push(...level.walls.map(({ id }) => id));
    ids.push(...level.spaces.map(({ id }) => id));
    ids.push(...level.openings.map(({ id }) => id));
    ids.push(...level.slabs.map(({ id }) => id));
    ids.push(...level.roofs.map(({ id }) => id));
    ids.push(...level.stairs.map(({ id }) => id));
    ids.push(...(level.structure ?? []).map(({ id }) => id));
    ids.push(...(level.components ?? []).map(({ id }) => id));
  }
  for (const network of house.systems ?? []) {
    ids.push(...network.nodes.map(({ id }) => id));
    ids.push(...network.edges.map(({ id }) => id));
  }
  return ids.filter((id) => inspectObject(house, id).kind !== 'UNKNOWN');
}

/** Chaque objet possédé, en face de chacun des six espaces qui ne l'ont pas. */
function elsewhere(): readonly (readonly [CreationStageId, string])[] {
  const pairs: (readonly [CreationStageId, string])[] = [];
  for (const objectId of everything()) {
    const owner = ownerStageOf(house, objectId);
    if (owner === undefined) continue;
    for (const stage of CREATION_STAGES)
      if (stage !== owner) pairs.push([stage, objectId]);
  }
  return pairs;
}

function source(path: string): string {
  return readFileSync(
    fileURLToPath(new URL(`../${path}`, import.meta.url)),
    'utf8',
  );
}

describe("ce que l'espace actif laisse proposer", () => {
  it('mesure la maison entière, pour que le compte veuille dire quelque chose', () => {
    // Si la maison de référence perdait ses objets, tout ce qui suit passerait
    // en ne mesurant rien.
    expect(elsewhere().length).toBeGreaterThan(500);
  });

  it("n'offre aucun champ modifiable hors de l'espace propriétaire", () => {
    const offered = elsewhere().flatMap(([stage, objectId]) =>
      editsInStage(stage, house, objectId).map(({ id }) => `${objectId}:${id}`),
    );
    expect(offered).toEqual([]);
  });

  it('n’offre aucune suppression hors de l’espace propriétaire', () => {
    const offered = elsewhere().filter(([stage, objectId]) =>
      canDeleteInStage(stage, house, [objectId]),
    );
    expect(offered).toEqual([]);
  });

  it("n'offre aucun geste de famille hors de l'espace propriétaire", () => {
    const offered = elsewhere().flatMap(([stage, objectId]) =>
      LEVEL_IDS.flatMap((levelId) =>
        contextActionsInStage(stage, house, levelId, objectId).map(
          ({ id }) => `${stage}:${objectId}:${id}`,
        ),
      ),
    );
    expect(offered).toEqual([]);
  });

  it("n'offre aucune action qui écrit hors de l'espace propriétaire", () => {
    /*
     * Le registre des actions décrit un geste une fois pour tous les
     * affichages, et il ne connaît pas les espaces : c'est ici qu'il les
     * rencontre. Une action qui écrit — transformer, dupliquer, supprimer,
     * aligner, un geste de famille, ou même seulement **armer** l'outil qui
     * écrira — n'a rien à faire dans une barre regardée depuis un espace qui
     * ne possède pas l'objet, puisque la commande y sera refusée.
     */
    const offered = elsewhere().flatMap(([stage, objectId]) =>
      LEVEL_IDS.flatMap((levelId) =>
        objectActionsInStage(stage, {
          project: house,
          levelId,
          selection: [objectId],
          host: NOTHING,
        })
          .filter(({ writes }) => writes)
          .map(({ id }) => `${stage}:${objectId}:${id}`),
      ),
    );
    expect(offered).toEqual([]);
  });

  it('laisse partout ce qui ne fait que lire', () => {
    /*
     * L'inverse compte autant : on vient précisément lire un mur depuis
     * Systèmes, et une barre qui n'offrirait plus rien ferait croire que
     * l'objet n'est plus là. Cadrer et désigner les semblables restent.
     */
    for (const [stage, objectId] of elsewhere()) {
      const offered = objectActionsInStage(stage, {
        project: house,
        levelId: LEVEL_IDS[0]!,
        selection: [objectId],
        host: NOTHING,
      });
      expect(
        offered.map(({ id }) => id),
        objectId,
      ).toContain('frame');
      expect(offered.every(({ writes }) => !writes)).toBe(true);
    }
  });

  it("ne retire aucune action dans l'espace propriétaire", () => {
    // La frontière filtre ; elle n'invente rien et ne retire rien chez soi.
    for (const objectId of everything()) {
      const owner = ownerStageOf(house, objectId);
      if (owner === undefined) continue;
      for (const levelId of LEVEL_IDS) {
        const context = {
          project: house,
          levelId,
          selection: [objectId],
          host: NOTHING,
        };
        expect(
          objectActionsInStage(owner, context).map(({ id }) => id),
        ).toEqual(objectActionsFor(context).map(({ id }) => id));
      }
    }
  });

  it('retire tout ce qui écrit dès qu’un seul objet vient d’ailleurs', () => {
    // Même règle que l'édition commune et la suppression : appliquer un geste
    // à un objet sur deux laisserait une maison à moitié changée.
    const mixed = ['wall-south', 'water:trunk'];
    const offered = objectActionsInStage('BUILDING', {
      project: house,
      levelId: LEVEL_IDS[0]!,
      selection: mixed,
      host: NOTHING,
    });
    expect(offered.filter(({ writes }) => writes)).toEqual([]);
  });

  it('nomme le propriétaire et donne le bouton qui y mène', () => {
    for (const [stage, objectId] of elsewhere()) {
      const owner = ownerStageOf(house, objectId);
      const notice = readOnlyNoticeFor(stage, house, [objectId]);
      expect(notice?.owners).toEqual(owner === undefined ? undefined : [owner]);
      // Le nom de l'espace, en toutes lettres : « cet objet n'est pas
      // modifiable » laisserait le chercher dans sept onglets.
      expect(notice?.sentence).toMatch(/^Cet objet se modifie dans .+\.$/u);
      expect(notice?.action?.stage).toBe(owner);
      expect(notice?.action?.label).toMatch(/^Modifier dans .+$/u);
    }
  });

  it("ne retire rien dans l'espace propriétaire", () => {
    for (const objectId of everything()) {
      const owner = ownerStageOf(house, objectId);
      if (owner === undefined) continue;
      // Comparés par identifiant : deux appels rendent deux fermetures
      // différentes pour le même champ, et l'égalité profonde le dirait.
      expect(editsInStage(owner, house, objectId).map(({ id }) => id)).toEqual(
        editsFor(house, objectId).map(({ id }) => id),
      );
      expect(canDeleteInStage(owner, house, [objectId])).toBe(true);
      expect(readOnlyNoticeFor(owner, house, [objectId])).toBeUndefined();
      for (const levelId of LEVEL_IDS)
        expect(
          contextActionsInStage(owner, house, levelId, objectId).map(
            ({ id }) => id,
          ),
        ).toEqual(
          contextActionsFor(house, levelId, objectId).map(({ id }) => id),
        );
    }
  });

  it('laisse partout ce qui n’appartient à personne', () => {
    // « Sans propriétaire » veut dire « partout », jamais « nulle part » : une
    // famille ajoutée demain doit rester corrigible, pas devenir un objet que
    // plus rien ne touche.
    for (const stage of CREATION_STAGES) {
      expect(canDeleteInStage(stage, house, ['sans-proprietaire'])).toBe(true);
      expect(
        readOnlyNoticeFor(stage, house, ['sans-proprietaire']),
      ).toBeUndefined();
    }
  });

  it('retire l’édition commune dès qu’un seul objet vient d’ailleurs', () => {
    const wallAndPipe = ['wall-south', 'water:trunk'];
    // Depuis Bâtiment, le mur est chez lui et le tronçon ne l'est pas : une
    // édition commune appliquée à six objets sur sept laisserait une maison à
    // moitié changée sans que rien ne l'ait dit.
    expect(sharedEditsInStage('BUILDING', house, wallAndPipe)).toEqual([]);
    expect(canDeleteInStage('BUILDING', house, wallAndPipe)).toBe(false);
    const notice = readOnlyNoticeFor('FITTING', house, wallAndPipe);
    expect(notice?.owners).toEqual(['BUILDING', 'SYSTEMS']);
    expect(notice?.sentence).toBe(
      'Ces objets se modifient ailleurs : Bâtiment, Systèmes.',
    );
    // Deux propriétaires ne font pas deux boutons : on ne va pas à moitié dans
    // deux endroits.
    expect(notice?.action).toBeUndefined();
  });
});

describe("l'inspecteur et le menu reçoivent vraiment l'espace", () => {
  const panel = source('editor/InspectorPanel.tsx');
  const shell = source('main.tsx');

  it("donne l'espace actif au panneau", () => {
    expect(panel).toMatch(/readonly stage: CreationStageId;/u);
    expect(panel).toContain("from './stage-editing.js'");
    expect(shell).toContain('stage={navigation.stage}');
  });

  it('donne au panneau de quoi mener chez le propriétaire', () => {
    expect(panel).toContain('onEditInOwnerStage');
    expect(shell).toContain('onEditInOwnerStage={editInOwnerStage}');
    // La bascule change d'espace et ne touche pas à la sélection : c'est elle
    // qu'on emmène.
    expect(shell).toMatch(/const editInOwnerStage = useCallback\(/u);
    expect(shell).not.toMatch(
      /editInOwnerStage = useCallback\([\s\S]{0,600}CLEAR_SELECTION/u,
    );
  });

  it('branche la barre contextuelle sur le registre, et sur la frontière', () => {
    const bar = source('editor/ContextToolBar.tsx');
    // Un registre que rien n'interroge ne vaut rien : la barre passe par lui,
    // et elle y passe par `stage-editing.ts` plutôt qu'en direct.
    expect(bar).toContain('objectActionsInStage(stage, context)');
    expect(bar).toContain("from './stage-editing.js'");
    expect(bar).not.toContain('objectActionsFor(');
    // Et elle ne décide plus elle-même de ce qu'une sélection permet : plus de
    // liste d'alignements ni de lecture directe des capacités.
    expect(bar).not.toContain('selectionCapabilities');
    expect(shell).toContain('actions={selectionActions}');
    expect(shell).toContain('stage={navigation.stage}');
  });

  it("construit le menu contextuel avec l'espace actif", () => {
    expect(shell).toContain(
      'contextActionsInStage(stage, project, levelId, objectId)',
    );
    // L'appel non filtré ne doit plus exister dans la coque : c'est lui qui
    // offrait les gestes de famille depuis n'importe où.
    expect(shell).not.toContain('contextActionsFor(');
    expect(shell).toContain('ownerStageOf(project, objectId)');
  });
});
