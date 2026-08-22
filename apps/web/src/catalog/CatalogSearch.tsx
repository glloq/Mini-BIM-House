/**
 * The header every catalogue is asked « lequel » through.
 *
 * The same search box, the same filters and the same rule for what a search
 * matches — in the material library, the assemblies, the equipment and the
 * nomenclature. Learning it once is the point.
 */
import type { ReactNode } from 'react';

import type { CatalogQuery } from './catalog-filter.js';

export interface CatalogAxisProps {
  readonly label: string;
  readonly all: string;
  readonly values: readonly string[];
  readonly labelOf?: (value: string) => string;
}

export interface CatalogSearchProps {
  readonly query: CatalogQuery;
  readonly onChange: (query: CatalogQuery) => void;
  readonly placeholder?: string;
  readonly domain?: CatalogAxisProps;
  readonly family?: CatalogAxisProps;
  /** What « incomplet » means for this catalogue, when it means anything. */
  readonly incompleteLabel?: string;
  readonly children?: ReactNode;
}

export function CatalogSearch({
  query,
  onChange,
  placeholder,
  domain,
  family,
  incompleteLabel,
  children,
}: CatalogSearchProps) {
  return (
    <div className="filters" role="search">
      <label>
        Rechercher
        <input
          type="search"
          value={query.search ?? ''}
          placeholder={placeholder ?? 'Nom, identifiant, fabricant'}
          onChange={(event) =>
            onChange({ ...query, search: event.target.value })
          }
        />
      </label>
      {domain !== undefined && (
        <Axis
          axis={domain}
          value={query.domain ?? ''}
          onChange={(value) => onChange({ ...query, domain: value })}
        />
      )}
      {family !== undefined && (
        <Axis
          axis={family}
          value={query.family ?? ''}
          onChange={(value) => onChange({ ...query, family: value })}
        />
      )}
      {incompleteLabel !== undefined && (
        <label className="checkbox">
          <input
            type="checkbox"
            checked={query.incompleteOnly === true}
            onChange={(event) =>
              onChange({ ...query, incompleteOnly: event.target.checked })
            }
          />
          {incompleteLabel}
        </label>
      )}
      {children}
    </div>
  );
}

function Axis({
  axis,
  value,
  onChange,
}: {
  readonly axis: CatalogAxisProps;
  readonly value: string;
  readonly onChange: (value: string) => void;
}) {
  return (
    <label>
      {axis.label}
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{axis.all}</option>
        {axis.values.map((entry) => (
          <option key={entry} value={entry}>
            {axis.labelOf?.(entry) ?? entry}
          </option>
        ))}
      </select>
    </label>
  );
}
