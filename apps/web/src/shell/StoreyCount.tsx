/**
 * Combien d'étages, réglé là où on dessine.
 *
 * Le nombre d'étages se décidait dans l'assistant de création, une fois pour
 * toutes, ou s'empilait à la main dans l'éditeur avancé : un niveau, son nom,
 * son altitude, sa hauteur sous plafond — puis retracer les murs. Or « je fais
 * une maison à deux étages » est une phrase qu'on dit **en** dessinant, et ce
 * qu'on veut alors est que le bâti se répète : les mêmes murs porteurs, la
 * même emprise, la même dalle.
 *
 * Le réglage vit donc dans l'espace du bâtiment, sous la rangée des niveaux, et
 * nulle part ailleurs : c'est là qu'on regarde quand on se le demande.
 *
 * Il ne calcule rien : `storeys.ts` dit quelles commandes il faut, et chacune
 * passe par l'historique comme le reste. Retirer se défait aussi.
 */
import type { Project } from '@house-technical-designer/core-domain';
import type { ProjectCommand } from '@house-technical-designer/editor-core';

import {
  storeyCommands,
  storeyCount,
  storeyRemovalBlock,
} from '../editor/storeys.js';

export interface StoreyCountProps {
  readonly project: Project;
  readonly onCommand: (command: ProjectCommand) => boolean;
  readonly onMessage: (message: string) => void;
}

export function StoreyCount({
  project,
  onCommand,
  onMessage,
}: StoreyCountProps) {
  const count = storeyCount(project);
  const blocked = storeyRemovalBlock(project);

  const change = (wanted: number): void => {
    for (const command of storeyCommands(project, wanted, (prefix) =>
      prefix === '' ? crypto.randomUUID() : `${prefix}-${crypto.randomUUID()}`,
    ))
      if (!onCommand(command)) return;
  };

  return (
    <div className="storey-count" role="group" aria-label="Niveaux du bâtiment">
      <span className="storey-label">Niveaux</span>
      <button
        type="button"
        // La raison est écrite sur le bouton plutôt que criée après le clic :
        // effacer vingt-six murs pour avoir tapé « 2 » au lieu de « 3 » est
        // pire que le réglage qu'on cherchait.
        disabled={blocked !== undefined}
        title={blocked ?? 'Retirer le niveau du haut'}
        aria-label="Retirer un niveau"
        onClick={() => {
          if (blocked !== undefined) {
            onMessage(blocked);
            return;
          }
          change(count - 1);
        }}
      >
        −
      </button>
      {/* Un `<output>` porte le rôle « status », c'est-à-dire une région que
          les lecteurs d'écran annoncent : le compte n'est pas un message, et
          il volait la place de ceux qui en sont. */}
      <span className="storey-value">{count}</span>
      <button
        type="button"
        title="Ajouter un niveau, copie du rez-de-chaussée"
        aria-label="Ajouter un niveau"
        onClick={() => change(count + 1)}
      >
        +
      </button>
      <small className="storey-hint">
        Un niveau ajouté reprend le rez-de-chaussée : murs, dalles, pièces.
      </small>
    </div>
  );
}
