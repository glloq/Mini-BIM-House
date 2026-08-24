/**
 * Ce qu'une surface laisse corriger, et ce qu'elle dit d'elle-même.
 *
 * Un contour sélectionné ne montrait que ses poignées : on tirait un sommet à
 * la souris et on espérait tomber sur le bon millimètre. Aucun côté n'avait de
 * longueur écrite, aucun sommet n'avait de coordonnées, et « faire une
 * parcelle de 30 sur 25 » se faisait au jugé, puis se vérifiait après coup en
 * lisant la surface de l'objet créé.
 *
 * Un seul jeu de champs répond pour les quatre surfaces — dalle, toiture,
 * trémie, terrain — parce que ce sont les mêmes questions : combien mesure ce
 * côté, où est ce sommet, quelle aire cela fait. `polygonSurface` dit où est le
 * contour ; ces lignes ne connaissent que des sommets.
 */
import type { Project } from '@house-technical-designer/core-domain';
import {
  polygonArea,
  ringPerimeter,
  type Point2D,
} from '@house-technical-designer/geometry';

import type { InspectorEdit } from './inspector-edits.js';
import { polygonSurface, type PolygonSurface } from './polygon-surface.js';

/** Un angle droit se reconnaît à un degré près : un relevé n'est jamais exact. */
const RIGHT_ANGLE_TOLERANCE_DEG = 1;

function unit(from: Point2D, to: Point2D): Point2D | undefined {
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  if (length <= 0) return undefined;
  return { x: (to.x - from.x) / length, y: (to.y - from.y) / length };
}

function sideLengthMm(outline: readonly Point2D[], index: number): number {
  const from = outline[index]!;
  const to = outline[(index + 1) % outline.length]!;
  return Math.hypot(to.x - from.x, to.y - from.y);
}

/**
 * L'angle intérieur au sommet, en degrés.
 *
 * Mesuré entre les deux côtés qui s'y rejoignent, ramené dans [0, 360[ : un
 * contour peut rentrer sur lui-même, et écrire 90° pour un angle de 270°
 * dirait le contraire de ce qu'on voit.
 */
export function vertexAngleDeg(
  outline: readonly Point2D[],
  index: number,
): number {
  const count = outline.length;
  const here = outline[index]!;
  const before = outline[(index - 1 + count) % count]!;
  const after = outline[(index + 1) % count]!;
  const toBefore = Math.atan2(before.y - here.y, before.x - here.x);
  const toAfter = Math.atan2(after.y - here.y, after.x - here.x);
  const raw = ((toBefore - toAfter) * 180) / Math.PI;
  return ((raw % 360) + 360) % 360;
}

/**
 * Les quatre sommets d'un rectangle, quand c'en est un.
 *
 * Quatre côtés et quatre angles droits : c'est la forme qu'on décrit par une
 * largeur et une profondeur plutôt que par huit coordonnées, et c'est la forme
 * de presque toutes les dalles et de presque toutes les parcelles.
 */
export function rectangleOf(
  outline: readonly Point2D[],
): { readonly widthMm: number; readonly depthMm: number } | undefined {
  if (outline.length !== 4) return undefined;
  for (let index = 0; index < 4; index += 1) {
    const angle = vertexAngleDeg(outline, index);
    const off = Math.min(Math.abs(angle - 90), Math.abs(angle - 270));
    if (off > RIGHT_ANGLE_TOLERANCE_DEG) return undefined;
  }
  return {
    widthMm: sideLengthMm(outline, 0),
    depthMm: sideLengthMm(outline, 1),
  };
}

/** Le rectangle refait sur ses deux mesures, le premier coin gardé en place. */
function resizedRectangle(
  outline: readonly Point2D[],
  widthMm: number,
  depthMm: number,
): readonly Point2D[] | undefined {
  const corner = outline[0]!;
  const along = unit(corner, outline[1]!);
  const across = unit(outline[1]!, outline[2]!);
  if (along === undefined || across === undefined) return undefined;
  const second = {
    x: corner.x + along.x * widthMm,
    y: corner.y + along.y * widthMm,
  };
  return [
    corner,
    second,
    { x: second.x + across.x * depthMm, y: second.y + across.y * depthMm },
    { x: corner.x + across.x * depthMm, y: corner.y + across.y * depthMm },
  ];
}

function withVertex(
  outline: readonly Point2D[],
  index: number,
  to: Point2D,
): readonly Point2D[] {
  return outline.map((point, position) =>
    position === index ? { x: to.x, y: to.y } : point,
  );
}

function parsed(value: string): number | undefined {
  const millimetres = Number(value.replace(',', '.'));
  return Number.isFinite(millimetres) ? millimetres : undefined;
}

/** Ce que le contour mesure, sans rien laisser corriger. */
export interface PolygonFacts {
  readonly vertices: number;
  readonly areaM2: number;
  readonly perimeterM: number;
  /** Les longueurs des côtés, dans l'ordre du tracé, en millimètres. */
  readonly sidesMm: readonly number[];
  /** Les angles intérieurs, dans l'ordre des sommets, en degrés. */
  readonly anglesDeg: readonly number[];
  readonly rectangle?: { readonly widthMm: number; readonly depthMm: number };
}

export function polygonFacts(
  outline: readonly Point2D[],
): PolygonFacts | undefined {
  if (outline.length < 3) return undefined;
  const rectangle = rectangleOf(outline);
  return {
    vertices: outline.length,
    areaM2: polygonArea({ outer: outline }) / 1e6,
    perimeterM: ringPerimeter(outline) / 1000,
    sidesMm: outline.map((_point, index) => sideLengthMm(outline, index)),
    anglesDeg: outline.map((_point, index) => vertexAngleDeg(outline, index)),
    ...(rectangle === undefined ? {} : { rectangle }),
  };
}

/**
 * Les champs qu'une surface offre, le rectangle d'abord.
 *
 * L'ordre est celui dans lequel on corrige : une largeur et une profondeur
 * quand la forme s'y prête, puis les côtés un par un, puis les coordonnées —
 * qu'on ne touche que lorsqu'on relève un bornage.
 */
export function polygonSurfaceEdits(
  project: Project,
  levelId: string | undefined,
  objectId: string,
): readonly InspectorEdit[] {
  const surface = polygonSurface(project, levelId, objectId);
  if (surface === undefined) return [];
  return surfaceEdits(surface);
}

function surfaceEdits(surface: PolygonSurface): readonly InspectorEdit[] {
  const outline = surface.outline;
  if (outline.length < 3) return [];
  const rectangle = rectangleOf(outline);
  const prefix = `${surface.kind.toLowerCase()}.polygon`;

  const rectangleEdits: readonly InspectorEdit[] =
    rectangle === undefined
      ? []
      : [
          {
            id: 'polygon.widthMm',
            semanticId: `${prefix}.widthMm`,
            label: 'Largeur',
            hint: 'Le premier coin reste en place.',
            control: {
              kind: 'NUMBER',
              value: Math.round(rectangle.widthMm),
              unit: 'mm',
              step: 10,
              min: 1,
            },
            apply: (value) => {
              const widthMm = parsed(value);
              if (widthMm === undefined || widthMm <= 0) return undefined;
              const next = resizedRectangle(
                outline,
                widthMm,
                rectangle.depthMm,
              );
              return next === undefined ? undefined : surface.withOutline(next);
            },
          },
          {
            id: 'polygon.depthMm',
            semanticId: `${prefix}.depthMm`,
            label: 'Profondeur',
            hint: 'Le premier coin reste en place.',
            control: {
              kind: 'NUMBER',
              value: Math.round(rectangle.depthMm),
              unit: 'mm',
              step: 10,
              min: 1,
            },
            apply: (value) => {
              const depthMm = parsed(value);
              if (depthMm === undefined || depthMm <= 0) return undefined;
              const next = resizedRectangle(
                outline,
                rectangle.widthMm,
                depthMm,
              );
              return next === undefined ? undefined : surface.withOutline(next);
            },
          },
        ];

  const sides: readonly InspectorEdit[] = outline.map((_point, index) => ({
    id: `polygon.side.${index}`,
    semanticId: `${prefix}.side`,
    label: `Côté ${index + 1}`,
    // Ce qu'un côté peut faire tout seul : pousser le sommet qui le termine.
    // Garder tous les autres angles demanderait de résoudre le contour entier,
    // et personne ne saurait dire lequel des sommets a bougé.
    hint: 'Le sommet suivant glisse le long du côté.',
    control: {
      kind: 'NUMBER',
      value: Math.round(sideLengthMm(outline, index)),
      unit: 'mm',
      step: 10,
      min: 1,
    },
    apply: (value) => {
      const lengthMm = parsed(value);
      if (lengthMm === undefined || lengthMm <= 0) return undefined;
      const from = outline[index]!;
      const direction = unit(from, outline[(index + 1) % outline.length]!);
      if (direction === undefined) return undefined;
      return surface.withOutline(
        withVertex(outline, (index + 1) % outline.length, {
          x: from.x + direction.x * lengthMm,
          y: from.y + direction.y * lengthMm,
        }),
      );
    },
  }));

  const coordinates: readonly InspectorEdit[] = outline.flatMap(
    (point, index) =>
      (['x', 'y'] as const).map((axis) => ({
        id: `polygon.vertex.${index}.${axis}`,
        semanticId: `${prefix}.vertex.${axis}`,
        label: `Sommet ${index + 1} · ${axis.toUpperCase()}`,
        control: {
          kind: 'NUMBER' as const,
          value: Math.round(point[axis]),
          unit: 'mm',
          step: 10,
        },
        apply: (value: string) => {
          const at = parsed(value);
          if (at === undefined) return undefined;
          return surface.withOutline(
            withVertex(outline, index, { ...point, [axis]: at }),
          );
        },
      })),
  );

  return [...rectangleEdits, ...sides, ...coordinates];
}
