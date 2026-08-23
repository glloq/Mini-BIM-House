/**
 * Ce que le plan montre, quand rien n'est désigné.
 *
 * L'inspecteur affichait « Sélectionnez un objet du plan pour voir ses
 * propriétés » : deux cent quatre-vingts pixels réservés pour une phrase, et
 * une phrase qui n'apprend rien à qui vient de cliquer dans le vide.
 *
 * Un objet a des propriétés ; une vue aussi. À quel étage, par quel métier, à
 * quelle échelle, avec quelle charte, et combien de calques sont masqués — ce
 * sont des faits qu'on vérifie avant d'exporter et qu'on lisait jusqu'ici en
 * ouvrant trois panneaux. Ils ne se **modifient** pas ici : chacun dit où on
 * le change, parce qu'un même réglage à deux endroits finit par dire deux
 * choses.
 */
import { LAYER_PRESETS } from '@house-technical-designer/view-query';

import { scaleDenominatorForZoom } from '../documents/saved-view.js';
import { hiddenLayerCount } from '../visibility/display-count.js';
import { planRendering } from '../ux/view-profiles.js';

import type { EditorState } from './editor-state.js';

export interface ViewPropertiesProps {
  readonly editor: EditorState;
  readonly levelName: string;
  /** Le métier lu, quand l'étape en propose un. */
  readonly domainLabel?: string;
  readonly renderingId: string;
}

export function ViewProperties({
  editor,
  levelName,
  domainLabel,
  renderingId,
}: ViewPropertiesProps) {
  const hidden = hiddenLayerCount(editor);
  const preset = LAYER_PRESETS.find(({ id }) => id === editor.presetId);
  const rendering = planRendering(renderingId);
  const facts: readonly {
    readonly label: string;
    readonly value: string;
    readonly where: string;
  }[] = [
    { label: 'Niveau', value: levelName, where: 'Arborescence' },
    ...(domainLabel === undefined
      ? []
      : [
          {
            label: 'Discipline',
            value: domainLabel,
            where: 'Barre de vue',
          },
        ]),
    {
      label: 'Rendu',
      value: rendering?.label ?? renderingId,
      where: 'Affichage',
    },
    {
      label: 'Affiché',
      value: preset?.label ?? editor.presetId,
      where: 'Affichage',
    },
    {
      label: 'Calques masqués',
      value: hidden === 0 ? 'aucun' : String(hidden),
      where: 'Affichage',
    },
    {
      label: 'Échelle',
      value: `1:${scaleDenominatorForZoom(editor.camera.pixelsPerMm)}`,
      where: 'Zoom',
    },
  ];

  return (
    <article className="view-properties">
      <header>
        <h3>Ce que le plan montre</h3>
      </header>
      <dl className="inspector-fields">
        {facts.map(({ label, value, where }) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>
              {value}
              <small className="hint">se change dans {where}</small>
            </dd>
          </div>
        ))}
      </dl>
      <p className="notice">
        Cliquez un objet du plan pour voir et modifier ses propriétés.
      </p>
    </article>
  );
}
