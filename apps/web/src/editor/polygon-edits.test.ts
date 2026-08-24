import { describe, expect, it } from 'vitest';

import type { Project } from '@house-technical-designer/core-domain';
import { ProjectCommandDispatcher } from '@house-technical-designer/editor-core';

import { loadDemoProject } from '../demo-project.js';
import {
  polygonFacts,
  polygonSurfaceEdits,
  rectangleOf,
  vertexAngleDeg,
} from './polygon-edits.js';
import { polygonSurface, slabHoleId } from './polygon-surface.js';

const demo = loadDemoProject();
if (demo.status === 'ERROR') throw new Error(demo.message);
const project = demo.file.project;

/** Le projet après la commande, ou l'échec dit franchement. */
function applied(
  project: Project,
  command: { execute: unknown } | undefined,
): Project {
  const commands = new ProjectCommandDispatcher(project);
  const result = commands.dispatch(command as never);
  if (result.status !== 'APPLIED')
    throw new Error(`commande refusée : ${JSON.stringify(result)}`);
  return commands.project;
}

const RECTANGLE = [
  { x: 0, y: 0 },
  { x: 30_000, y: 0 },
  { x: 30_000, y: 25_000 },
  { x: 0, y: 25_000 },
];

describe('ce qu’un contour mesure', () => {
  it('donne l’aire, le périmètre, les côtés et les angles', () => {
    const facts = polygonFacts(RECTANGLE)!;
    expect(facts.areaM2).toBeCloseTo(750, 6);
    expect(facts.perimeterM).toBeCloseTo(110, 6);
    expect(facts.sidesMm).toEqual([30_000, 25_000, 30_000, 25_000]);
    expect(facts.anglesDeg.map(Math.round)).toEqual([90, 90, 90, 90]);
    expect(facts.rectangle).toEqual({ widthMm: 30_000, depthMm: 25_000 });
  });

  it('ne prend pas un quadrilatère quelconque pour un rectangle', () => {
    // Une largeur et une profondeur ne décrivent pas cette forme : les
    // proposer écrirait un rectangle à la place de ce qu'on a tracé.
    expect(
      rectangleOf([
        { x: 0, y: 0 },
        { x: 30_000, y: 0 },
        { x: 28_000, y: 25_000 },
        { x: 0, y: 25_000 },
      ]),
    ).toBeUndefined();
    expect(rectangleOf(RECTANGLE.slice(0, 3))).toBeUndefined();
  });

  it('dit 270° pour un angle rentrant, jamais 90°', () => {
    // Un contour peut rentrer sur lui-même ; écrire 90° dirait le contraire
    // de ce qu'on voit.
    const el = [
      { x: 0, y: 0 },
      { x: 4000, y: 0 },
      { x: 4000, y: 2000 },
      { x: 2000, y: 2000 },
      { x: 2000, y: 4000 },
      { x: 0, y: 4000 },
    ];
    expect(Math.round(vertexAngleDeg(el, 3))).toBe(270);
  });

  it('ne mesure rien en dessous de trois sommets', () => {
    expect(polygonFacts(RECTANGLE.slice(0, 2))).toBeUndefined();
  });
});

describe('ce qu’une surface laisse corriger', () => {
  const slabId = project.building.levels[0]!.slabs[0]!.id;

  it('répond pour une dalle, avec ses côtés et ses coordonnées', () => {
    const edits = polygonSurfaceEdits(project, 'ground', slabId);
    const ids = edits.map(({ id }) => id);
    expect(ids).toContain('polygon.side.0');
    expect(ids).toContain('polygon.vertex.0.x');
    expect(ids).toContain('polygon.vertex.0.y');
    // Un champ par côté et deux par sommet : rien n'est laissé au jugé.
    const outline = polygonSurface(project, 'ground', slabId)!.outline;
    expect(ids.filter((id) => id.startsWith('polygon.side.'))).toHaveLength(
      outline.length,
    );
    expect(ids.filter((id) => id.startsWith('polygon.vertex.'))).toHaveLength(
      outline.length * 2,
    );
  });

  it('redimensionne une parcelle rectangulaire par sa largeur', () => {
    // « Une parcelle de 30 sur 25 » se tapait au jugé et se vérifiait après
    // coup, en lisant la surface de l'objet créé.
    const drawn = {
      ...project,
      site: { ...project.site, parcelBoundary: { outer: RECTANGLE } },
    };
    const width = polygonSurfaceEdits(drawn, undefined, 'site:parcel').find(
      ({ id }) => id === 'polygon.widthMm',
    )!;
    expect(width.control).toMatchObject({ value: 30_000, unit: 'mm' });

    const outline = polygonSurface(
      applied(drawn, width.apply('40000')),
      undefined,
      'site:parcel',
    )!.outline;
    expect(polygonFacts(outline)!.areaM2).toBeCloseTo(1000, 6);
    // Le premier coin ne bouge pas : c'est ce que dit le champ.
    expect(outline[0]).toEqual({ x: 0, y: 0 });
  });

  it('pousse le sommet suivant quand on donne une longueur de côté', () => {
    const drawn = {
      ...project,
      site: { ...project.site, parcelBoundary: { outer: RECTANGLE } },
    };
    const side = polygonSurfaceEdits(drawn, undefined, 'site:parcel').find(
      ({ id }) => id === 'polygon.side.0',
    )!;
    const outline = polygonSurface(
      applied(drawn, side.apply('10000')),
      undefined,
      'site:parcel',
    )!.outline;
    expect(outline[1]).toEqual({ x: 10_000, y: 0 });
    // Et rien d'autre : les autres sommets sont où on les avait mis.
    expect(outline[2]).toEqual({ x: 30_000, y: 25_000 });
  });

  it('déplace un sommet par ses coordonnées', () => {
    const drawn = {
      ...project,
      site: { ...project.site, parcelBoundary: { outer: RECTANGLE } },
    };
    const y = polygonSurfaceEdits(drawn, undefined, 'site:parcel').find(
      ({ id }) => id === 'polygon.vertex.2.y',
    )!;
    expect(
      polygonSurface(
        applied(drawn, y.apply('26500')),
        undefined,
        'site:parcel',
      )!.outline[2],
    ).toEqual({ x: 30_000, y: 26_500 });
  });

  it('refuse une valeur qui ne se lit pas, plutôt que d’en inventer une', () => {
    const edits = polygonSurfaceEdits(project, 'ground', slabId);
    for (const edit of edits) expect(edit.apply('bientôt')).toBeUndefined();
    const side = edits.find(({ id }) => id === 'polygon.side.0')!;
    expect(side.apply('0')).toBeUndefined();
  });

  it('ne répond rien pour un objet qui n’est pas une surface', () => {
    expect(polygonSurfaceEdits(project, 'ground', 'wall-south')).toEqual([]);
  });
});

describe('une trémie est une surface comme les autres', () => {
  const level = project.building.levels[0]!;
  const slab = level.slabs[0]!;
  const pierced = {
    ...project,
    building: {
      ...project.building,
      levels: project.building.levels.map((current) =>
        current.id !== level.id
          ? current
          : {
              ...current,
              slabs: current.slabs.map((existing) =>
                existing.id !== slab.id
                  ? existing
                  : {
                      ...existing,
                      polygon: {
                        outer: existing.polygon.outer,
                        holes: [
                          [
                            { x: 1000, y: 1000 },
                            { x: 2000, y: 1000 },
                            { x: 2000, y: 2000 },
                            { x: 1000, y: 2000 },
                          ],
                        ],
                      },
                    },
              ),
            },
      ),
    },
  };

  it('se désigne, se mesure et se corrige', () => {
    // Un trou vivait dans un tableau, sans nom : donc sans moyen d'être
    // désigné, donc sans moyen d'être corrigé.
    const id = slabHoleId(slab.id, 0);
    const surface = polygonSurface(pierced, level.id, id)!;
    expect(surface.kind).toBe('SLAB_HOLE');
    expect(polygonFacts(surface.outline)!.areaM2).toBeCloseTo(1, 6);

    const width = polygonSurfaceEdits(pierced, level.id, id).find(
      ({ id: field }) => field === 'polygon.widthMm',
    )!;
    const after = applied(pierced, width.apply('2000'));
    expect(
      polygonFacts(polygonSurface(after, level.id, id)!.outline)!.areaM2,
    ).toBeCloseTo(2, 6);
    // Et la dalle qui la porte n'a pas bougé.
    expect(polygonSurface(after, level.id, slab.id)!.outline).toEqual(
      slab.polygon.outer,
    );
  });
});
