/**
 * La grille, dessinée derrière tout le reste.
 *
 * Un `<svg>` posé sur le cadre, sous le plan : il ne prend aucun clic, il
 * n'entre dans aucune sélection, et il n'est annoncé à personne — une grille
 * se voit, elle ne se lit pas à voix haute.
 *
 * Ce qu'il dessine vient entièrement de `model-grid.ts`, qui ne connaît que la
 * caméra. Rien ici ne décide d'un pas.
 */
import type { Camera2D } from '@house-technical-designer/editor-core';

import { isMajor, modelGrid } from './model-grid.js';

export function ModelGrid({ camera }: { readonly camera: Camera2D }) {
  if (!(camera.viewportWidthPx > 0) || !(camera.viewportHeightPx > 0))
    return null;
  const grid = modelGrid(camera);
  return (
    <svg
      className="model-grid"
      width={camera.viewportWidthPx}
      height={camera.viewportHeightPx}
      viewBox={`0 0 ${camera.viewportWidthPx} ${camera.viewportHeightPx}`}
      aria-hidden="true"
      focusable="false"
    >
      {grid.verticals.map((line) => (
        <line
          key={`v${line.atMm}`}
          className={isMajor(line, grid.majorMm) ? 'major' : 'minor'}
          x1={line.atPx}
          y1={0}
          x2={line.atPx}
          y2={camera.viewportHeightPx}
        />
      ))}
      {grid.horizontals.map((line) => (
        <line
          key={`h${line.atMm}`}
          className={isMajor(line, grid.majorMm) ? 'major' : 'minor'}
          x1={0}
          y1={line.atPx}
          x2={camera.viewportWidthPx}
          y2={line.atPx}
        />
      ))}
      {/* L'origine du modèle, quand elle est là : deux axes, parce que « où est
          le zéro » est la question qu'on se pose en tapant une coordonnée. */}
      {grid.originPx !== undefined && (
        <>
          <line
            className="origin"
            x1={grid.originPx.x}
            y1={0}
            x2={grid.originPx.x}
            y2={camera.viewportHeightPx}
          />
          <line
            className="origin"
            x1={0}
            y1={grid.originPx.y}
            x2={camera.viewportWidthPx}
            y2={grid.originPx.y}
          />
        </>
      )}
    </svg>
  );
}
