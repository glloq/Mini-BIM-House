import { useMemo, useState } from 'react';
import type { CatalogSummary } from '@house-technical-designer/catalog-registry';
import {
  CATALOG_DOMAINS,
  catalogFamilyView,
  catalogRows,
  shownDomain,
  withChosenDomain,
  type CatalogFilter,
} from './catalog-browser.js';
import { FAMILY_REGISTRY } from '@house-technical-designer/catalog-registry';

import { SymbolGlyph } from './SymbolGlyph.js';

export interface CatalogBrowserProps {
  /**
   * The rows of each family, not its fiches.
   *
   * The panel draws a name and a version; it was handed whole catalogue
   * entries to do it. The body is fetched when somebody places one.
   */
  readonly summariesByFamily: Readonly<
    Record<string, readonly CatalogSummary[]>
  >;
  readonly known: Parameters<typeof catalogFamilyView>[2];
  readonly onAdd: (summary: CatalogSummary) => void;
  /**
   * Le filtre de départ, quand on l'ouvre depuis un endroit qui sait lequel.
   *
   * Cinq cents familles à plat sont une liste qu'on ne lit pas ; les
   * quarante-six de l'électricité sont un catalogue. Ouvert depuis la
   * sous-partie « Électricité », le métier est déjà su, et le redemander
   * serait faire recommencer un choix déjà fait.
   *
   * Ce peut être plusieurs métiers (`domains`) : une sous-partie n'en sert
   * pas qu'un, et n'en montrer qu'un laissait l'autre moitié de ce qu'elle
   * pose derrière un élargissement à la main.
   */
  readonly openOn?: CatalogFilter;
  /** Ce que le bouton d'une fiche dit qu'il fait : ajouter, ou poser. */
  readonly placeLabel?: string;
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
 * Les métiers ouverts, nommés comme on les nomme ailleurs.
 *
 * Les libellés viennent de `CATALOG_DOMAINS`, c'est-à-dire de la même table
 * que les options de la liste déroulante : une phrase qui dirait « Plomberie »
 * au-dessus d'une case qui dit autre chose serait une deuxième traduction à
 * tenir à jour. L'identifiant brut est rendu tel quel si la table l'ignore —
 * cela ne devrait jamais arriver, et faire disparaître le métier serait pire
 * que le montrer nu.
 */
function ouverts(domains: readonly string[]): string {
  const labels = domains.map(
    (id) => CATALOG_DOMAINS.find((domain) => domain.id === id)?.label ?? id,
  );
  return labels.length < 2
    ? (labels[0] ?? '')
    : `${labels.slice(0, -1).join(', ')} et ${labels[labels.length - 1]}`;
}

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
  summariesByFamily,
  known,
  onAdd,
  openOn,
  placeLabel,
}: CatalogBrowserProps) {
  // Le filtre de départ n'est qu'un départ : il peuple l'état, il ne le
  // verrouille pas. Élargir la recherche reste un clic.
  const [filter, setFilter] = useState<CatalogFilter>(
    openOn === undefined ? {} : { ...openOn, withGenericData: true },
  );
  const [openId, setOpenId] = useState<string | undefined>(undefined);
  const rows = useMemo(
    () => catalogRows(summariesByFamily, known, filter),
    [summariesByFamily, known, filter],
  );
  // The families still in service, counted from the nomenclature rather than
  // typed here: it read 518 for weeks after the registry had moved on.
  const inService = useMemo(
    () =>
      FAMILY_REGISTRY.filter(
        ({ lifecycle }) => (lifecycle ?? 'ACTIVE') === 'ACTIVE',
      ).length,
    [],
  );
  const retired = FAMILY_REGISTRY.length - inService;
  const open = useMemo(
    () =>
      openId === undefined
        ? undefined
        : catalogFamilyView(openId, summariesByFamily, known),
    [openId, summariesByFamily, known],
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
            /*
             * Ce qu'on montre est le premier des métiers ouverts, et ce qu'on
             * choisit efface l'ouverture : les deux règles vivent dans
             * `catalog-browser.ts`, où un test les tient, plutôt qu'ici où
             * rien ne les regarde.
             */
            value={shownDomain(filter)}
            onChange={(event) => {
              const chosen = event.target.value;
              setFilter((current) => withChosenDomain(current, chosen));
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

      {/*
       * Ce que la case « Métier » ne peut pas dire à elle seule.
       *
       * Elle ne montre qu'un métier — le plus servi — alors que la liste en
       * dessous en montre plusieurs : sans cette phrase, on lit « Plomberie »
       * au-dessus de meubles sous vasque et on ne sait plus à quoi la case
       * sert. Elle dit aussi ce qui arrive si on y touche, parce que c'est
       * exactement ce qu'on est tenté de faire en la lisant.
       */}
      {filter.domain === undefined && (filter.domains ?? []).length > 1 && (
        <p className="hint">
          Ouvert sur {ouverts(filter.domains ?? [])}. Choisir un métier
          ci-dessus n’en garde qu’un.
        </p>
      )}
      <p className="hint">
        {/* Of the families in service: one that has left it is offered to
            nobody, and counting it in the denominator would make « toutes »
            a number the list can never reach. */}
        {rows.length} famille(s) sur {inService}.{' '}
        {rows.length > SHOWN ? `Les ${SHOWN} premières :` : ''}
      </p>
      {retired > 0 && (
        <p className="hint">
          {retired} famille(s) ont quitté le service : chacune dit ce qui la
          remplace, et les projets qui les portent s’ouvrent toujours.
        </p>
      )}
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
              {/*
               * Le dessin d'abord, le nom ensuite.
               *
               * « Applique murale », « Hublot », « Réglette » : trois lignes
               * qui se ressemblent, et qu'on départageait en posant puis en
               * regardant le plan. Le glyphe montré ici est celui-là même,
               * résolu par la même chaîne — donc ce qu'on choisit est ce
               * qu'on verra.
               */}
              <SymbolGlyph familyId={row.familyId} category={row.category} />
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
                        <span>{entry.label}</span>
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => {
                            onAdd(entry);
                          }}
                        >
                          {placeLabel ?? 'Ajouter au projet'}
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
