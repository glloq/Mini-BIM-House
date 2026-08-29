import {
  DATA_DOMAINS,
  DATA_DOMAIN_LABELS,
  FAMILY_REGISTRY,
  STATUS_AXES,
  completeness,
  familyStatus,
  portRequirement,
  portType,
  schemaOfFamily,
  statusOf,
  CLEARANCE_LABELS,
  type DataDomain,
  type FamilyDefinition,
  type StatusValue,
} from '@house-technical-designer/catalog-registry';
import {
  HOST_TYPE_LABELS,
  isHostType,
} from '@house-technical-designer/core-domain';
import type { CatalogSummary } from '@house-technical-designer/catalog-registry';

export interface CatalogFilter {
  readonly search?: string;
  readonly domain?: DataDomain;
  /**
   * Les métiers sur lesquels la nomenclature s'ouvre, quand elle en sert
   * plusieurs à la fois.
   *
   * Une sous-partie ne tient pas dans un métier. La salle de bain pose des
   * WC, des douches et des lavabos — de la Plomberie — et aussi des meubles
   * sous vasque et des colonnes ; la cuisine mêle l'électroménager et le
   * mobilier. Filtrée sur le seul métier le plus servi, l'autre moitié de ce
   * qu'elle pose restait derrière un élargissement à la main que personne ne
   * devine : chercher « colonne de rangement » dans la Plomberie ne rend
   * rien, et une recherche vide fait croire que la famille n'existe pas.
   *
   * C'est donc une liste, et non un remplacement de `domain` : le métier
   * unique reste ce que choisit la liste déroulante quand quelqu'un s'en
   * sert, et il continue de marcher tel quel.
   *
   * Une liste vide ne filtre rien. C'est le cas d'une sous-partie qui ne
   * déclare aucun métier ; lui rendre zéro famille serait la punir de ne
   * rien savoir, alors que la nomenclature entière est exactement la bonne
   * réponse à « je ne sais pas où chercher ».
   */
  readonly domains?: readonly DataDomain[];
  readonly wave?: number;
  /** Only the families somebody can actually place something from today. */
  readonly withGenericData?: boolean;
  /**
   * Whether the families that have left service are listed too.
   *
   * They are not, by default. A retired family still opens the projects that
   * hold it — that is the whole point of retiring rather than deleting — and
   * offering it beside the family that replaced it is how a duplicate comes
   * back the day after it was merged. Somebody reading the nomenclature to
   * understand it can still ask for them.
   */
  readonly withRetired?: boolean;
}

export interface CatalogRow {
  readonly familyId: string;
  readonly label: string;
  readonly domain: DataDomain;
  /**
   * Sa catégorie, pour le deuxième maillon de la chaîne graphique.
   *
   * Une famille qui ne nomme pas son glyphe prend celui de sa catégorie ; sans
   * elle, l'aperçu sauterait ce maillon et montrerait le carré générique à des
   * familles que le plan dessine correctement. L'aperçu doit dire vrai ou ne
   * rien dire.
   */
  readonly category?: string;
  readonly domainLabel: string;
  readonly wave: number;
  /** Between 0 and 1, every axis weighing the same. */
  readonly progress: number;
  readonly entryCount: number;
  /** What replaces this family, when it has left service. */
  readonly replacedBy?: string;
  readonly retiredReason?: string;
}

/**
 * The nomenclature, filtered, as a list somebody can read.
 *
 * Five hundred and eighteen families do not go in a panel that lists nineteen
 * catalogue entries; and the panel that listed nineteen was the whole of what
 * the interface knew about a nomenclature the rest of the application had been
 * checking for weeks. The filters are what make the size usable: a trade, a
 * wave, a word, and « what can I actually place today ».
 */
export function catalogRows(
  summariesByFamily: Readonly<Record<string, readonly CatalogSummary[]>>,
  known: Parameters<typeof familyStatus>[1],
  filter: CatalogFilter = {},
): readonly CatalogRow[] {
  const needle = (filter.search ?? '').trim().toLowerCase();
  return FAMILY_REGISTRY.filter((family) => {
    if (
      filter.withRetired !== true &&
      (family.lifecycle ?? 'ACTIVE') !== 'ACTIVE'
    )
      return false;
    if (filter.domain !== undefined && family.domain !== filter.domain)
      return false;
    /*
     * Les deux se cumulent, ils ne se remplacent pas.
     *
     * Chaque filtre rétrécit — c'est ce que « filtrer » veut dire — et deux
     * critères posés ensemble se lisent « et », comme le métier et la vague
     * juste au-dessus. L'écran, lui, ne les pose jamais ensemble : choisir un
     * métier à la main efface la liste d'ouverture (voir
     * `withChosenDomain`), parce qu'un choix explicite remplace ce sur quoi
     * on avait ouvert. Le cumul n'est donc pas un mode d'emploi, c'est la
     * réponse la moins surprenante au cas où les deux arriveraient quand
     * même : on ne rend jamais plus large que ce qui a été demandé.
     */
    if (
      filter.domains !== undefined &&
      filter.domains.length > 0 &&
      !filter.domains.includes(family.domain)
    )
      return false;
    if (filter.wave !== undefined && family.priority !== filter.wave)
      return false;
    const entries = summariesByFamily[family.id] ?? [];
    if (filter.withGenericData === true && entries.length === 0) return false;
    if (needle === '') return true;
    return (
      family.label.toLowerCase().includes(needle) ||
      family.id.toLowerCase().includes(needle) ||
      entries.some((entry) => entry.label.toLowerCase().includes(needle))
    );
  })
    .map((family) => ({
      familyId: family.id,
      label: family.label,
      domain: family.domain,
      ...(family.category === undefined ? {} : { category: family.category }),
      domainLabel: DATA_DOMAIN_LABELS[family.domain],
      wave: family.priority,
      progress: completeness(familyStatus(family.id, known)),
      entryCount: (summariesByFamily[family.id] ?? []).length,
      ...(family.replacedBy === undefined
        ? {}
        : { replacedBy: family.replacedBy }),
      ...(family.retiredReason === undefined
        ? {}
        : { retiredReason: family.retiredReason }),
    }))
    .sort(
      (first, second) =>
        second.progress - first.progress ||
        first.label.localeCompare(second.label, 'fr'),
    );
}

/**
 * Le métier que la liste déroulante montre.
 *
 * Celui qu'on a choisi ; à défaut le premier de ceux sur lesquels on a
 * ouvert, `sectionFamilyDomains` les rendant du plus servi au moins servi.
 * La salle de bain affiche donc « Plomberie » et non « Tous » : dire « Tous »
 * quand on montre deux métiers sur seize serait faux, et laisser la case vide
 * ferait croire qu'aucun filtre n'est posé alors que la liste en applique un.
 *
 * Ce que la case ne dit pas — les métiers suivants — est dit en toutes
 * lettres à côté d'elle : une case qui nomme un métier au-dessus d'une liste
 * qui en montre deux serait, sans cela, une contradiction muette.
 */
export function shownDomain(filter: CatalogFilter): DataDomain | '' {
  return filter.domain ?? filter.domains?.[0] ?? '';
}

/**
 * Ce que devient le filtre quand quelqu'un choisit un métier à la main.
 *
 * Le choix **remplace** l'ouverture, il ne s'y ajoute pas : demander
 * « Mobilier » depuis une salle de bain ouverte sur Plomberie + Mobilier doit
 * rendre le Mobilier, et rien d'autre. Garder la liste rendrait les deux, et
 * la personne aurait alors déplacé une case sans que la liste bouge — le
 * genre de commande morte qui apprend à ne plus toucher aux filtres.
 *
 * Et « Tous » efface les deux. Un « Tous » qui resterait borné aux métiers
 * d'ouverture serait le pire des deux mondes : le mot promet la nomenclature
 * entière, et la sortie n'en montrerait qu'un cinquième.
 */
export function withChosenDomain(
  filter: CatalogFilter,
  chosen: string,
): CatalogFilter {
  const { domain: _domain, domains: _domains, ...rest } = filter;
  return chosen === '' ? rest : { ...rest, domain: chosen as DataDomain };
}

export interface CatalogAxis {
  readonly axis: string;
  readonly value: StatusValue;
}

export interface CatalogFamilyView {
  readonly family: FamilyDefinition;
  readonly domainLabel: string;
  readonly ports: readonly string[];
  readonly optionalPorts: readonly string[];
  readonly hosts: readonly string[];
  readonly clearances: readonly string[];
  readonly calculators: readonly string[];
  readonly properties: readonly {
    readonly key: string;
    readonly label: string;
    readonly unit?: string;
    readonly source: string;
  }[];
  readonly axes: readonly CatalogAxis[];
  /**
   * The rows of this family, not its fiches.
   *
   * A browser shows a name, a family and a version; it used to be handed whole
   * catalogue entries — ports, clearances, performance maps and every figure —
   * to draw that. Invisible at nineteen entries, and the reason the panel
   * takes four seconds to open at ten thousand. The body is fetched from the
   * repository when somebody actually places one.
   */
  readonly entries: readonly CatalogSummary[];
}

/** Everything the nomenclature holds about one family, in words. */
export function catalogFamilyView(
  familyId: string,
  summariesByFamily: Readonly<Record<string, readonly CatalogSummary[]>>,
  known: Parameters<typeof familyStatus>[1],
): CatalogFamilyView | undefined {
  const found = FAMILY_REGISTRY.find(({ id }) => id === familyId);
  if (found === undefined) return undefined;
  const named = (candidates: readonly unknown[] | undefined) =>
    (candidates ?? []).map((candidate) => {
      const requirement = portRequirement(
        candidate as Parameters<typeof portRequirement>[0],
      );
      const labels = requirement.anyOf
        .map((id) => portType(id)?.label ?? id)
        .join(' ou ');
      return requirement.minCount === 1 && requirement.maxCount === 1
        ? labels
        : `${labels} (${requirement.minCount}${
            requirement.maxCount === undefined
              ? '+'
              : `–${requirement.maxCount}`
          })`;
    });
  const status = familyStatus(familyId, known);
  return {
    family: found,
    domainLabel: DATA_DOMAIN_LABELS[found.domain],
    ports: named(found.ports),
    optionalPorts: named(found.optionalPorts),
    hosts: (found.placement?.allowedHosts ?? []).map((host) =>
      isHostType(host) ? HOST_TYPE_LABELS[host] : host,
    ),
    clearances: (found.clearances ?? []).map((zone) => CLEARANCE_LABELS[zone]),
    calculators: [...(found.calculators ?? [])],
    properties: (schemaOfFamily(familyId)?.properties ?? []).map(
      (property) => ({
        key: property.key,
        label: property.label,
        ...(property.unit === undefined ? {} : { unit: property.unit }),
        source: property.source,
      }),
    ),
    axes: STATUS_AXES.map((axis) => ({ axis, value: statusOf(status, axis) })),
    entries: summariesByFamily[familyId] ?? [],
  };
}

/** The trades that actually hold families, for the filter to offer. */
export const CATALOG_DOMAINS: readonly {
  readonly id: DataDomain;
  readonly label: string;
}[] = DATA_DOMAINS.filter((domain) =>
  FAMILY_REGISTRY.some((family) => family.domain === domain),
).map((domain) => ({ id: domain, label: DATA_DOMAIN_LABELS[domain] }));
