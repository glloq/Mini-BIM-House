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
import {
  contextActionsFor,
  editsFor,
  inspectObject,
} from './object-editors.js';
import {
  canDeleteInStage,
  contextActionsInStage,
  editsInStage,
  readOnlyNoticeFor,
  sharedEditsInStage,
} from './stage-editing.js';

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
