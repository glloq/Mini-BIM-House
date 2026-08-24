/**
 * Le nord, réglé contre le plan.
 *
 * Il se réglait dans un champ « Orientation du nord », dans l'écran Projet,
 * derrière deux clics et sans rien à regarder pendant qu'on le change. Or
 * l'orientation ne se choisit pas dans l'absolu : on la choisit **en
 * regardant la parcelle**, la rue, l'ombre du voisin. Un angle qu'on décide
 * sans voir ce qu'il oriente est un angle qu'on tape deux fois.
 *
 * La rose est donc posée sur le dessin, en bas à droite, dans l'espace où le
 * terrain se dessine — et nulle part ailleurs, parce qu'ailleurs elle serait
 * un cadran de plus à ignorer.
 *
 * Elle ne mémorise rien : l'aiguille lit `site.northAngleDeg`, et la tourner
 * écrit une commande comme n'importe quel autre changement.
 */
import type { Project } from '@house-technical-designer/core-domain';
import {
  UpdateSiteCommand,
  type ProjectCommand,
} from '@house-technical-designer/editor-core';

/** Les quatre quarts, pour ne pas avoir à taper 90. */
const QUARTERS = [0, 90, 180, 270] as const;

import { northAngle } from './north-angle.js';

export interface NorthDialProps {
  readonly project: Project;
  readonly onCommand: (command: ProjectCommand) => void;
}

export function NorthDial({ project, onCommand }: NorthDialProps) {
  const angle = northAngle(project.site.northAngleDeg);
  const set = (next: number): void =>
    onCommand(new UpdateSiteCommand({ northAngleDeg: northAngle(next) }));

  return (
    <div className="north-dial" role="group" aria-label="Orientation du nord">
      <svg viewBox="0 0 40 40" aria-hidden="true" focusable="false">
        <circle className="north-face" cx="20" cy="20" r="17" />
        {/* L'aiguille tourne dans le sens des aiguilles d'une montre, comme
            l'angle : un cadran qui tourne à l'envers de son nombre se lit une
            fois sur deux. */}
        <g transform={`rotate(${angle} 20 20)`}>
          <polygon className="north-needle" points="20,5 24,22 20,19 16,22" />
        </g>
        <text className="north-letter" x="20" y="36" textAnchor="middle">
          N
        </text>
      </svg>
      <div className="north-controls">
        <label htmlFor="north-angle">
          Nord <small>(°)</small>
        </label>
        <input
          id="north-angle"
          type="number"
          step={5}
          value={angle}
          aria-label="Angle du nord en degrés"
          onChange={(event) => {
            const typed = Number(event.target.value);
            if (Number.isFinite(typed)) set(typed);
          }}
        />
        <div className="north-quarters">
          {QUARTERS.map((quarter) => (
            <button
              key={quarter}
              type="button"
              className={quarter === angle ? 'active' : undefined}
              aria-pressed={quarter === angle}
              title={`Mettre le nord à ${quarter}°`}
              onClick={() => set(quarter)}
            >
              {quarter}°
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
