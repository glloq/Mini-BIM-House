/**
 * Par quel métier le plan est lu, dans l'étape qui en propose plusieurs.
 *
 * Systèmes n'est pas une autre application : c'est le même dessin, le même
 * inspecteur et les mêmes outils, avec une discipline allumée. En choisir une
 * est donc un contexte et non une destination — et le plan dessous ne change
 * pas. Énergie fonctionne pareil, avec le solaire et le stockage.
 *
 * C'est aussi la seule façon de choisir un métier : les sous-étapes de
 * Systèmes et d'Énergie *sont* ces disciplines, et deux sélecteurs pour la
 * même chose sont un sélecteur de trop. Ce panneau compte les réseaux et suit
 * le périmètre ; une rangée de libellés ne saurait faire ni l'un ni l'autre.
 *
 * Un métier que le projet a désactivé n'est pas proposé — sauf si le projet en
 * tient déjà des objets : un périmètre restreint ce qu'on propose, jamais ce
 * qui existe.
 */
import {
  designDomain,
  type DesignDomainId,
  type Project,
} from '@house-technical-designer/core-domain';

import type { CreationStageId } from '../ux/creation-stages.js';

import { domainsOfStage, networksOfDomain } from './discipline-scope.js';

export interface DisciplinePickerProps {
  readonly project: Project;
  readonly stage: CreationStageId;
  readonly activeDomain?: DesignDomainId;
  readonly onSelect: (domain: DesignDomainId) => void;
}

export function DisciplinePicker({
  project,
  stage,
  activeDomain,
  onSelect,
}: DisciplinePickerProps) {
  const domains = domainsOfStage(project, stage);
  return (
    <section className="context-group" aria-label="Disciplines">
      <p className="context-group-label">Discipline</p>
      {domains.map((id) => {
        const descriptor = designDomain(id);
        const held = networksOfDomain(project, id);
        return (
          <button
            key={id}
            type="button"
            className={id === activeDomain ? 'active' : undefined}
            aria-pressed={id === activeDomain}
            title={descriptor.description}
            onClick={() => onSelect(id)}
          >
            {descriptor.label}
            {/* A count of nothing is worth saying: it is the difference
                between « rien à voir » and « rien de tracé ». */}
            <small className="discipline-count">
              {held === 0 ? 'aucun réseau' : `${held} réseau(x)`}
            </small>
          </button>
        );
      })}
      {domains.length === 0 && (
        <p className="hint">
          Aucune discipline de cette étape dans le périmètre de ce projet.
        </p>
      )}
    </section>
  );
}
