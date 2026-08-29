import { describe, expect, it } from 'vitest';
import { ProjectCommandDispatcher } from '@house-technical-designer/editor-core';
import type { Level, Project } from '@house-technical-designer/core-domain';
import { loadDemoProject } from '../demo-project.js';
import { placeComponentCommand } from './editing-commands.js';
import { chooseHost, projectEquipment } from './host-choice.js';

function house(): { readonly project: Project; readonly level: Level } {
  const loaded = loadDemoProject();
  if (loaded.status !== 'OK') throw new Error(loaded.message);
  const level = loaded.file.project.building.levels[0];
  if (level === undefined)
    throw new Error('la maison de référence a un niveau');
  return { project: loaded.file.project, level };
}

/** Les supports que la fiche du projet déclare — jamais une liste écrite ici. */
function hostsOf(project: Project, definitionId: string) {
  const fiche = projectEquipment(project, definitionId);
  if (fiche === undefined) throw new Error(`fiche absente : ${definitionId}`);
  return fiche.allowedHosts;
}

/*
 * La maison de référence : un rectangle de 10 m sur 8, deux refends au milieu.
 * Le centre d'un quart de la maison est à plus de 1,50 m de tous les murs,
 * ce qui en fait le point où une prise n'a rien à quoi s'accrocher.
 */
const AGAINST_SOUTH_WALL = { x: 2500, y: 500 };
const MIDDLE_OF_A_ROOM = { x: 2500, y: 2000 };
const OUTSIDE_THE_HOUSE = { x: 40_000, y: 40_000 };

describe('ce qui portera ce que l’on s’apprête à poser', () => {
  it('accroche au mur ce que la fiche veut au mur, et prend son angle', () => {
    // Une prise se vise sur un mur, à un mètre près : elle ne se pose pas
    // exactement sur l'axe, et exiger l'axe rendrait l'outil injouable.
    const { project, level } = house();
    const choice = chooseHost(
      level,
      AGAINST_SOUTH_WALL,
      undefined,
      hostsOf(project, 'generic-socket'),
    );
    expect(choice.accepted).toBe(true);
    expect(choice.hostObjectId).toBe('wall-south');
    // Le mur sud va de (0, 0) à (10000, 0) : le fantôme se couche dessus.
    expect(choice.wallAngleDeg).toBe(0);
    expect(choice.sentence).toBe('Posé sur un mur, orienté comme lui.');
  });

  it('prend l’angle du mur que l’on vise, pas celui d’un autre', () => {
    const { project, level } = house();
    // Le mur ouest va de (0, 8000) à (0, 0) : il descend, donc −90°.
    const choice = chooseHost(
      level,
      { x: 500, y: 6000 },
      undefined,
      hostsOf(project, 'generic-socket'),
    );
    expect(choice.hostObjectId).toBe('wall-west');
    expect(choice.wallAngleDeg).toBe(-90);
  });

  it('refuse avant le clic ce qu’aucun support ne peut porter ici', () => {
    /*
     * Le cœur de l'affaire : au milieu d'une pièce il n'y a pas de mur, et
     * une prise n'a rien à quoi tenir. On lisait cela après avoir cliqué.
     */
    const { project, level } = house();
    const choice = chooseHost(
      level,
      MIDDLE_OF_A_ROOM,
      undefined,
      hostsOf(project, 'generic-socket'),
    );
    expect(choice.accepted).toBe(false);
    expect(choice.hostObjectId).toBeUndefined();
    expect(choice.sentence).toBe(
      'Rien ici ne peut porter ce modèle : il se pose sur un mur.',
    );
  });

  it('énumère tous les supports admis quand la fiche en nomme plusieurs', () => {
    const { level } = house();
    const choice = chooseHost(level, OUTSIDE_THE_HOUSE, undefined, [
      'ROOF',
      'CEILING',
      'OPENING',
    ]);
    expect(choice.accepted).toBe(false);
    expect(choice.sentence).toBe(
      'Rien ici ne peut porter ce modèle : il se pose sur une toiture, un plafond ou une baie.',
    );
  });

  it('laisse au sol l’orientation courante du fantôme', () => {
    // Poser un lit, c'est viser le milieu d'une chambre ; lui faire prendre
    // l'angle du mur le plus proche serait décider à la place de quelqu'un.
    const { project, level } = house();
    const choice = chooseHost(
      level,
      MIDDLE_OF_A_ROOM,
      undefined,
      hostsOf(project, 'generic-air-water-heat-pump'),
    );
    expect(choice.accepted).toBe(true);
    expect(choice.hostObjectId).toBe('slab-ground');
    expect(choice.wallAngleDeg).toBeUndefined();
    expect(choice.sentence).toBe('Posé sur une dalle.');
  });

  it('accepte sans support ce que la fiche pose sur le terrain', () => {
    // Le terrain n'est pas un objet du niveau : ce qui s'y pose se pose sans
    // hôte, et l'absence d'hôte est ici la bonne réponse et non un refus.
    const { project, level } = house();
    const choice = chooseHost(
      level,
      OUTSIDE_THE_HOUSE,
      undefined,
      hostsOf(project, 'generic-well'),
    );
    expect(choice.accepted).toBe(true);
    expect(choice.hostObjectId).toBeUndefined();
    expect(choice.sentence).toBe('Posé sur le terrain.');
  });

  it('préfère ce que le curseur touche à ce qui est le plus proche', () => {
    // Le refend vertical passe à 2,50 m ; désigné, c'est lui qui porte, même
    // si le mur sud est plus près. Ce qu'on montre est ce qu'on croit viser.
    const { project, level } = house();
    const choice = chooseHost(
      level,
      AGAINST_SOUTH_WALL,
      'wall-partition-v',
      hostsOf(project, 'generic-socket'),
    );
    expect(choice.hostObjectId).toBe('wall-partition-v');
    expect(choice.wallAngleDeg).toBe(90);
  });

  it('n’oppose aucune règle à une fiche qui n’en déclare aucune', () => {
    // Le composant générique, celui qu'on pose quand le catalogue ne nomme
    // pas la chose : refuser à sa place serait inventer une règle.
    const { level } = house();
    for (const hosts of [undefined, []] as const) {
      const choice = chooseHost(level, OUTSIDE_THE_HOUSE, undefined, hosts);
      expect(choice.accepted).toBe(true);
      expect(choice.sentence).toBe(
        'Posé ici : cette fiche ne réclame aucun support.',
      );
    }
  });
});

/**
 * Ce que le fantôme annonce et ce que le clic fait, sur les mêmes points.
 *
 * `chooseHost` rejoue le choix que `hostUnder` fait dans la commande, parce
 * que la commande ne l'expose pas. Deux copies d'une même règle finissent par
 * diverger, et la seule façon de s'en apercevoir est de les confronter : on
 * pose vraiment, on répartit vraiment, et l'on compare le support enregistré
 * à celui qui avait été annoncé. Un aperçu qui promet un mur et une pose qui
 * ne trouve rien est le défaut que ce test attrape.
 */
describe('l’aperçu et la pose disent la même chose', () => {
  const points = [
    AGAINST_SOUTH_WALL,
    MIDDLE_OF_A_ROOM,
    OUTSIDE_THE_HOUSE,
    { x: 500, y: 6000 },
    { x: 5000, y: 4000 },
    { x: 9800, y: 7800 },
    { x: 100, y: 100 },
    { x: 7500, y: 6000 },
  ];
  const fiches = [
    'generic-socket',
    'generic-radiator',
    'generic-air-water-heat-pump',
    'generic-well',
    'generic-miniature-circuit-breaker',
    'generic-washbasin',
  ];

  it('choisit le même support et refuse aux mêmes endroits', () => {
    const loaded = loadDemoProject();
    if (loaded.status !== 'OK') throw new Error(loaded.message);
    const file = loaded.file;
    const level = file.project.building.levels[0]!;
    let refusals = 0;
    let hosted = 0;
    for (const definitionId of fiches)
      for (const point of points) {
        const announced = chooseHost(
          level,
          point,
          undefined,
          hostsOf(file.project, definitionId),
        );
        const built = placeComponentCommand(
          file,
          level.id,
          point,
          { category: 'OTHER', definitionId, elevationMm: 0 },
          'component-under-test',
        );
        if (built.status !== 'OK') throw new Error(built.message);
        const dispatcher = new ProjectCommandDispatcher(file.project);
        const applied = dispatcher.dispatch(built.command);
        const where = `${definitionId} en ${point.x};${point.y}`;
        // Le verdict d'abord : ce que l'aperçu promet, la pose le tient.
        expect(applied.status === 'APPLIED', where).toBe(announced.accepted);
        if (applied.status !== 'APPLIED') {
          refusals += 1;
          continue;
        }
        const placed = dispatcher.project.building.levels
          .flatMap((storey) => storey.components ?? [])
          .find(({ id }) => id === 'component-under-test');
        expect(placed?.hostObjectId, where).toBe(announced.hostObjectId);
        if (announced.hostObjectId !== undefined) hosted += 1;
      }
    // Sans refus ni supports trouvés, le test ne prouverait qu'une moitié de
    // ce qu'il vérifie : il faut que les deux branches aient été empruntées.
    expect(refusals).toBeGreaterThan(0);
    expect(hosted).toBeGreaterThan(0);
  });
});
