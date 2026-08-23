/**
 * Les sept parties de la maison, sur une rangée, toujours au même endroit.
 *
 * Un rail vertical de cinq espaces disait « où je travaille » ; sept onglets
 * disent de quelle partie de la maison on s'occupe, et ils se lisent dans
 * l'ordre où on la décrit — ce qui n'oblige personne à le suivre. Un onglet ne
 * mène nulle part : la barre reste au-dessus du même dessin, et en changer
 * change ce qu'on a sous la main, jamais ce qu'on a le droit de faire.
 *
 * En dessous de 1 100 px elle se réduit à l'onglet courant et à une liste
 * déroulante : sept libellés tiennent mieux que neuf, mais pas sur une rangée
 * étroite, et une barre qui passe à deux rangées est la moitié d'une barre
 * d'outils perdue.
 */
import {
  CREATION_STAGES,
  creationStage,
  type CreationStageId,
} from '../ux/creation-stages.js';

export interface StageBarProps {
  readonly stage: CreationStageId;
  readonly onSelect: (stage: CreationStageId) => void;
  /** Ce que l'étape a encore à faire, quand le guide a quelque chose à dire. */
  readonly remaining?: Readonly<Partial<Record<CreationStageId, number>>>;
}

export function StageBar({ stage, onSelect, remaining }: StageBarProps) {
  return (
    <nav className="stage-bar" aria-label="Étapes de création">
      <label className="stage-compact">
        <span className="visually-hidden">Étape de création</span>
        <select
          value={stage}
          onChange={(event) => onSelect(event.target.value as CreationStageId)}
        >
          {CREATION_STAGES.map((id) => (
            <option key={id} value={id}>
              {creationStage(id).label}
            </option>
          ))}
        </select>
      </label>
      {CREATION_STAGES.map((id) => {
        const definition = creationStage(id);
        const current = id === stage;
        const left = remaining?.[id] ?? 0;
        return (
          <button
            key={id}
            type="button"
            className={current ? 'stage-entry active' : 'stage-entry'}
            aria-current={current ? 'step' : undefined}
            title={
              left > 0
                ? `${definition.label} — ${definition.description} (${left} à faire)`
                : `${definition.label} — ${definition.description}`
            }
            onClick={() => onSelect(id)}
          >
            {definition.label}
            {/*
             * Le compte est dans l'infobulle, pas dans le nom accessible.
             *
             * Sans `aria-hidden`, le bouton s'appelle « Bâtiment 3 » : il
             * change de nom quand la maison change, et plus rien ne le trouve
             * — ni un lecteur d'écran à qui on a dit « Bâtiment », ni un test.
             */}
            {left > 0 && (
              <span className="stage-remaining" aria-hidden="true">
                {left}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
