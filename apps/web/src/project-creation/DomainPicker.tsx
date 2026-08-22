/**
 * Which trades will be worked on — the interface's scope, not the file's.
 *
 * Every box here is read from the registry. Twenty checkboxes written in JSX
 * is twenty places to forget a trade, and the trade that gets forgotten is the
 * one nobody on the team happens to practise.
 *
 * A preset writes into the selection and then steps out of the way: the boxes
 * stay visible and stay editable, so nobody has to guess what « Maison
 * complète » decided on their behalf.
 */
import {
  applyPreset,
  DESIGN_DOMAIN_CATEGORY_LABELS,
  DESIGN_DOMAIN_IDS,
  designDomain,
  domainEnabled,
  SCOPE_PRESETS,
  withDomainDisabled,
  withDomainEnabled,
  type DesignDomainCategory,
  type DesignDomainId,
  type ProjectScope,
} from '@house-technical-designer/core-domain';

export interface DomainPickerProps {
  readonly scope: ProjectScope;
  readonly onChange: (scope: ProjectScope) => void;
  /** Trades the project already holds objects of, when it holds any. */
  readonly present?: readonly DesignDomainId[];
}

const CATEGORY_ORDER: readonly DesignDomainCategory[] = [
  'ESSENTIAL',
  'TECHNICAL',
  'ENERGY',
  'OTHER',
];

export function DomainPicker({ scope, onChange, present }: DomainPickerProps) {
  const held = new Set(present ?? []);
  return (
    <div className="domain-picker">
      <div className="actions">
        {SCOPE_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className="secondary"
            title={preset.description}
            onClick={() => onChange(applyPreset(scope, preset.id))}
          >
            {preset.label}
          </button>
        ))}
      </div>
      {CATEGORY_ORDER.map((category) => {
        const domains = DESIGN_DOMAIN_IDS.filter(
          (id) => designDomain(id).category === category,
        );
        if (domains.length === 0) return null;
        return (
          <fieldset key={category} className="domain-group">
            <legend>{DESIGN_DOMAIN_CATEGORY_LABELS[category]}</legend>
            {domains.map((id) => {
              const descriptor = designDomain(id);
              const enabled = domainEnabled(scope, id);
              // Architecture is never off. Showing its box greyed says so;
              // hiding it would leave people looking for what is missing.
              const locked = id === 'ARCHITECTURE';
              return (
                <label key={id} className="checkbox domain-entry">
                  <input
                    type="checkbox"
                    checked={enabled}
                    disabled={locked}
                    onChange={(event) =>
                      onChange(
                        event.target.checked
                          ? withDomainEnabled(scope, id)
                          : withDomainDisabled(scope, id),
                      )
                    }
                  />
                  <span>
                    <strong>{descriptor.label}</strong>
                    <small>{descriptor.description}</small>
                    {!enabled && held.has(id) && (
                      <small className="warning">
                        Hors périmètre, mais ce projet en contient déjà. Rien
                        n’est supprimé : l’interface cesse seulement d’en
                        proposer.
                      </small>
                    )}
                  </span>
                </label>
              );
            })}
          </fieldset>
        );
      })}
    </div>
  );
}
