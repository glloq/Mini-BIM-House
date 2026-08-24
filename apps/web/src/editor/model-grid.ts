/**
 * La grille du plan, en millimètres du modèle.
 *
 * Ce qui tenait lieu de grille était un `background-image` CSS : deux dégradés
 * tous les 24 pixels, collés au cadre. Elle ne bougeait pas quand on déplaçait
 * le plan, elle ne changeait pas quand on zoomait, et ses carreaux ne
 * mesuraient rien — 24 pixels, c'est-à-dire une longueur qui dépend de
 * l'échelle et qu'aucune règle ne peut lire. Poser un mur « sur la grille »
 * était donc un hasard.
 *
 * Celle-ci est dessinée dans le repère du modèle : ses lignes passent par des
 * millimètres ronds, elle est alignée sur l'origine (0, 0), elle suit la
 * caméra au déplacement comme au zoom, et un carreau vaut toujours la même
 * longueur réelle. Elle est **toujours visible**, et elle ne dit rien de
 * l'accrochage : voir où sont les mètres et s'y coller sont deux questions,
 * et les confondre faisait disparaître le repère dès qu'on voulait dessiner
 * librement.
 *
 * Rien n'est mémorisé : le pas est **calculé** de la caméra à chaque image.
 */
import type { Camera2D } from '@house-technical-designer/editor-core';

/**
 * Les pas qu'une règle porte, en millimètres.
 *
 * Un centimètre, deux, cinq, puis la même chose dix fois plus grand : c'est
 * l'échelle d'un mètre-ruban, et c'est ce qu'on sait lire sans compter. Un pas
 * de 37 mm serait exact et illisible.
 */
const LADDER: readonly number[] = (() => {
  const rungs: number[] = [];
  for (let decade = 10; decade <= 1_000_000; decade *= 10)
    rungs.push(decade, decade * 2, decade * 5);
  return rungs;
})();

/**
 * L'écartement minimal de deux lignes, en pixels.
 *
 * En dessous, la grille cesse d'être un repère pour devenir un aplat : on ne
 * distingue plus les carreaux, seulement une teinte.
 */
const MINIMUM_SPACING_PX = 9;

/** Le nombre de carreaux au-delà duquel on cesse d'en dessiner. */
const MAXIMUM_LINES = 400;

export interface ModelGridLine {
  /** La position à l'écran, en pixels, sur l'axe de la ligne. */
  readonly atPx: number;
  /** Le millimètre du modèle par lequel elle passe. */
  readonly atMm: number;
}

export interface ModelGrid {
  /** Le pas fin, en millimètres. */
  readonly minorMm: number;
  /** Le pas fort, en millimètres : cinq ou dix fins. */
  readonly majorMm: number;
  readonly verticals: readonly ModelGridLine[];
  readonly horizontals: readonly ModelGridLine[];
  /** L'origine du modèle, quand elle est dans le cadre. */
  readonly originPx?: { readonly x: number; readonly y: number };
}

/**
 * Le pas fin que cette échelle permet de lire.
 *
 * Le premier barreau de l'échelle dont deux lignes sont assez écartées pour
 * qu'on les distingue. À très fort dézoom, le dernier barreau : mieux vaut une
 * grille trop lâche qu'une grille absente.
 */
export function gridStepMm(pixelsPerMm: number): number {
  if (!(pixelsPerMm > 0)) return LADDER[LADDER.length - 1]!;
  return (
    LADDER.find((step) => step * pixelsPerMm >= MINIMUM_SPACING_PX) ??
    LADDER[LADDER.length - 1]!
  );
}

/**
 * Le pas fort, toujours sur l'échelle, cinq ou dix fois le pas fin.
 *
 * Cinq quand le pas fin vaut deux unités, dix sinon : de cette façon le pas
 * fort est lui aussi un barreau, donc un nombre rond, donc lisible.
 */
export function majorStepMm(minorMm: number): number {
  const decade = 10 ** Math.floor(Math.log10(minorMm));
  return Math.round(minorMm / decade) === 2 ? minorMm * 5 : minorMm * 10;
}

/**
 * Les lignes visibles, à l'écran, pour cette caméra.
 *
 * Les positions sont calculées de l'origine du modèle vers l'extérieur, et non
 * du bord du cadre : c'est ce qui garantit qu'une ligne passe exactement par
 * x = 0 et qu'elle y reste, quel que soit le déplacement.
 */
export function modelGrid(camera: Camera2D): ModelGrid {
  const minorMm = gridStepMm(camera.pixelsPerMm);
  const majorMm = majorStepMm(minorMm);
  const halfWidthMm = camera.viewportWidthPx / 2 / camera.pixelsPerMm;
  const halfHeightMm = camera.viewportHeightPx / 2 / camera.pixelsPerMm;

  const lines = (
    centreMm: number,
    halfMm: number,
    viewportPx: number,
  ): ModelGridLine[] => {
    const from = Math.ceil((centreMm - halfMm) / minorMm) * minorMm;
    const to = centreMm + halfMm;
    const drawn: ModelGridLine[] = [];
    for (let atMm = from; atMm <= to; atMm += minorMm) {
      if (drawn.length >= MAXIMUM_LINES) break;
      drawn.push({
        atMm,
        atPx: viewportPx / 2 + (atMm - centreMm) * camera.pixelsPerMm,
      });
    }
    return drawn;
  };

  const origin = {
    x: camera.viewportWidthPx / 2 - camera.centerModelMm.x * camera.pixelsPerMm,
    y:
      camera.viewportHeightPx / 2 - camera.centerModelMm.y * camera.pixelsPerMm,
  };
  const inFrame =
    origin.x >= 0 &&
    origin.x <= camera.viewportWidthPx &&
    origin.y >= 0 &&
    origin.y <= camera.viewportHeightPx;

  return {
    minorMm,
    majorMm,
    verticals: lines(
      camera.centerModelMm.x,
      halfWidthMm,
      camera.viewportWidthPx,
    ),
    horizontals: lines(
      camera.centerModelMm.y,
      halfHeightMm,
      camera.viewportHeightPx,
    ),
    ...(inFrame ? { originPx: origin } : {}),
  };
}

/** Une ligne forte se lit à ce qu'elle porte un multiple du pas fort. */
export function isMajor(line: ModelGridLine, majorMm: number): boolean {
  return Math.abs(line.atMm % majorMm) < 1e-6;
}

/** Ce que le carreau mesure, écrit comme on l'écrit sur un plan. */
export function gridStepLabel(millimetres: number): string {
  return millimetres >= 1000
    ? `${(millimetres / 1000).toFixed(millimetres % 1000 === 0 ? 0 : 1).replace('.', ',')} m`
    : `${millimetres / 10} cm`;
}
