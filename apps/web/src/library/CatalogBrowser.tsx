import { useMemo, useState } from 'react';
import type { EquipmentDefinition } from '@house-technical-designer/equipment-catalog';
import {
  CATALOG_DOMAINS,
  catalogFamilyView,
  catalogRows,
  type CatalogFilter,
} from './catalog-browser.js';
import type { DataDomain } from '@house-technical-designer/catalog-registry';

export interface CatalogBrowserProps {
  readonly entriesByFamily: Readonly<
    Record<string, readonly EquipmentDefinition[]>
  >;
  readonly known: Parameters<typeof catalogFamilyView>[2];
  readonly onAdd: (definition: EquipmentDefinition) => void;
}

const AXIS_LABELS: Readonly<Record<string, string>> = {
  MODEL: 'Modèle',
  PROPERTIES: 'Propriétés',
  PORTS: 'Ports',
  PLACEMENT: 'Placement',
  PLAN_SYMBOL: 'Symbole de plan',
  ELEVATION_SYMBOL: 'Symbole d’élévation',
  SCHEMATIC_SYMBOL: 'Symbole de schéma',
  NETWORK: 'Réseau',
  CALCULATION: 'Calcul',
  QUANTITIES: 'Métrés',
  COST: 'Coût',
  CARBON: 'Carbone',
  RULES: 'Règles',
  TESTS: 'Tests',
  GENERIC_DATA: 'Données génériques',
  PRODUCT_DATA: 'Données fabricant',
};

const STATUS_LABELS: Readonly<Record<string, string>> = {
  NONE: 'rien',
  PARTIAL: 'entamé',
  READY: 'écrit',
  VALIDATED: 'prouvé',
};

const SHOWN = 40;

/**
 * The nomenclature, browsable.
 *
 * The panel used to list the nineteen generic entries and nothing else, while
 * the rest of the application had been checking five hundred and eighteen
 * families for weeks: the interface knew about four per cent of the data it
 * was built on. What makes the size usable is not a longer list but the
 * filters — a trade, a wave, a word, and « what can I actually place today ».
 *
 * A family shows what it is, not what it has: its ports, its supports, the
 * room it needs, what reads it, and how far each axis has got. Most of them
 * are at the beginning, and saying so is the point.
 */
export function CatalogBrowser({
  entriesByFamily,
  known,
  onAdd,
}: CatalogBrowserProps) {
  const [filter, setFilter] = useState<CatalogFilter>({});
  const [openId, setOpenId] = useState<string | undefined>(undefined);
  const rows = useMemo(
    () => catalogRows(entriesByFamily, known, filter),
    [entriesByFamily, known, filter],
  );
  const open = useMemo(
    () =>
      openId === undefined
        ? undefined
        : catalogFamilyView(openId, entriesByFamily, known),
    [openId, entriesByFamily, known],
  );

  return (
    <section className="catalog-browser" aria-labelledby="catalog-heading">
      <h3 id="catalog-heading">Nomenclature</h3>
      <div
        className="catalog-filters"
        role="group"
        aria-label="Filtrer la nomenclature"
      >
        <label>
          Rechercher
          <input
            type="search"
            value={filter.search ?? ''}
            onChange={(event) => {
              setFilter((current) => ({
                ...current,
                search: event.target.value,
              }));
            }}
            placeholder="pompe, tableau, VMC…"
          />
        </label>
        <label>
          Métier
          <select
            value={filter.domain ?? ''}
            onChange={(event) => {
              const chosen = event.target.value;
              setFilter((current) => {
                const { domain: _domain, ...rest } = current;
                return chosen === ''
                  ? rest
                  : { ...rest, domain: chosen as DataDomain };
              });
            }}
          >
            <option value="">Tous</option>
            {CATALOG_DOMAINS.map((domain) => (
              <option key={domain.id} value={domain.id}>
                {domain.label}
              </option>
            ))}
          </select>
        </label>
        <label className="catalog-toggle">
          <input
            type="checkbox"
            checked={filter.withGenericData === true}
            onChange={(event) => {
              setFilter((current) => ({
                ...current,
                withGenericData: event.target.checked,
              }));
            }}
          />
          Seulement ce qui est posable
        </label>
      </div>

      <p className="hint">
        {rows.length} famille(s) sur 518.{' '}
        {rows.length > SHOWN ? `Les ${SHOWN} premières :` : ''}
      </p>
      <ul className="catalog-list">
        {rows.slice(0, SHOWN).map((row) => (
          <li key={row.familyId}>
            <button
              type="button"
              className="catalog-row"
              aria-expanded={openId === row.familyId}
              onClick={() => {
                setOpenId(openId === row.familyId ? undefined : row.familyId);
              }}
            >
              <strong>{row.label}</strong>
              <span className="hint">
                {row.domainLabel} · vague {row.wave} ·{' '}
                {(row.progress * 100).toFixed(0)} %
                {row.entryCount > 0
                  ? ` · ${row.entryCount} fiche(s)`
                  : ' · aucune fiche'}
              </span>
            </button>
            {openId === row.familyId && open !== undefined && (
              <article className="catalog-detail">
                <dl>
                  {open.ports.length > 0 && (
                    <>
                      <dt>Raccordé par</dt>
                      <dd>{open.ports.join(', ')}</dd>
                    </>
                  )}
                  {open.optionalPorts.length > 0 && (
                    <>
                      <dt>Peut l’être par</dt>
                      <dd>{open.optionalPorts.join(', ')}</dd>
                    </>
                  )}
                  {open.hosts.length > 0 && (
                    <>
                      <dt>Se fixe à</dt>
                      <dd>{open.hosts.join(', ')}</dd>
                    </>
                  )}
                  {open.clearances.length > 0 && (
                    <>
                      <dt>Dégagements</dt>
                      <dd>{open.clearances.join(', ')}</dd>
                    </>
                  )}
                  {open.calculators.length > 0 && (
                    <>
                      <dt>Lu par</dt>
                      <dd>{open.calculators.join(', ')}</dd>
                    </>
                  )}
                  {open.properties.length > 0 && (
                    <>
                      <dt>Propriétés</dt>
                      <dd>
                        {open.properties
                          .map(
                            (property) =>
                              `${property.label}${
                                property.unit === undefined
                                  ? ''
                                  : ` (${property.unit})`
                              }`,
                          )
                          .join(', ')}
                      </dd>
                    </>
                  )}
                </dl>
                <p className="hint">
                  {open.axes
                    .filter(({ value }) => value !== 'NONE')
                    .map(
                      ({ axis, value }) =>
                        `${AXIS_LABELS[axis] ?? axis} : ${STATUS_LABELS[value] ?? value}`,
                    )
                    .join(' · ') ||
                    'Rien n’a encore été fait sur cette famille.'}
                </p>
                {open.entries.length === 0 ? (
                  <p className="hint">
                    Aucune fiche générique : rien à poser depuis cette famille
                    pour l’instant.
                  </p>
                ) : (
                  <ul className="catalog-entries">
                    {open.entries.map((entry) => (
                      <li key={entry.id}>
                        <span>{entry.name}</span>
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => {
                            onAdd(entry);
                          }}
                        >
                          Ajouter au projet
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            )}
          </li>
        ))}
        {rows.length === 0 && (
          <li className="empty-state">Aucune famille ne correspond.</li>
        )}
      </ul>
    </section>
  );
}
