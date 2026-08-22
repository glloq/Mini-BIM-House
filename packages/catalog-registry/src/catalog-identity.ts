import type { DataRegistry } from '@house-technical-designer/technical-types';
import { isDataRegistry } from '@house-technical-designer/technical-types';
import {
  validateProvenance,
  type ProvenanceCandidate,
  type ProvenanceRecord,
} from './provenance.js';

/**
 * The batch of work a catalogue record belongs to.
 *
 * Six of them, from the architectural house to the systems around it, and the
 * list is closed. It was `priority: number` — a free integer, so a family
 * could be written into wave 9 and simply never appear in any plan of work,
 * silently, because nothing was looking for a wave 9. An order of work that
 * can hold a value nobody planned for is not an order of work.
 */
export const CATALOG_WAVES = [1, 2, 3, 4, 5, 6] as const;
export type CatalogWave = (typeof CATALOG_WAVES)[number];

export const CATALOG_WAVE_LABELS: Readonly<Record<CatalogWave, string>> = {
  1: 'Maison architecturale',
  2: 'Enveloppe et ouvertures',
  3: 'Plomberie et évacuations',
  4: 'Chauffage et ventilation',
  5: 'Électricité et éclairage',
  6: 'Production, stockage et réseaux',
};

export function isCatalogWave(value: number): value is CatalogWave {
  return (CATALOG_WAVES as readonly number[]).includes(value);
}

/**
 * Where a catalogue record stands in its own life.
 *
 * A catalogue that only grows is a catalogue nobody can correct: the day a
 * generic figure turns out to be wrong, the choice is between changing it
 * underneath every project that pinned it and leaving it there for ever.
 * Neither is acceptable, so a record is retired instead — it stops being
 * offered, it keeps opening the files that hold it, and it says what to use
 * instead.
 *
 * `DRAFT` is offered to nobody and validated like everything else: work in
 * progress that the gate ignores is work nobody is checking.
 */
export const CATALOG_LIFECYCLES = [
  'DRAFT',
  'ACTIVE',
  'DEPRECATED',
  'WITHDRAWN',
] as const;
export type CatalogLifecycle = (typeof CATALOG_LIFECYCLES)[number];

export const CATALOG_LIFECYCLE_LABELS: Readonly<
  Record<CatalogLifecycle, string>
> = {
  DRAFT: 'En cours de rédaction',
  ACTIVE: 'En service',
  DEPRECATED: 'Déconseillé',
  WITHDRAWN: 'Retiré',
};

export function isCatalogLifecycle(value: string): value is CatalogLifecycle {
  return (CATALOG_LIFECYCLES as readonly string[]).includes(value);
}

/** A record nothing says anything about is in service. */
export const DEFAULT_LIFECYCLE: CatalogLifecycle = 'ACTIVE';

/**
 * Whether this record may still be offered to somebody starting a design.
 *
 * Not whether it may be *read*: a project holding a withdrawn entry opens, and
 * has to. The two questions are different and were the same string.
 */
export function isOfferable(lifecycle: CatalogLifecycle): boolean {
  return lifecycle === 'ACTIVE';
}

/**
 * One record of one registry, at one version.
 *
 * Seven registries name their entries seven different ways — `id` alone here,
 * `familyId` plus `id` there, `family` plus `id` for a product — so nothing
 * could say « this thing, this version » across them, and a project pinning an
 * entry pinned it in whichever shape its own writer had chosen. This is that
 * sentence, said once.
 */
export interface CatalogRef {
  readonly registry: DataRegistry;
  readonly id: string;
  readonly version: string;
}

/**
 * A reference as one string: `EQUIPMENT:generic-air-water-heat-pump@1.0.0`.
 *
 * Registries, identifiers and versions all end up as map keys, file names and
 * lines in a report. Writing the key by hand in each of those places is how
 * two of them come to disagree.
 */
export function formatCatalogRef(ref: CatalogRef): string {
  return `${ref.registry}:${ref.id}@${ref.version}`;
}

const REF_PATTERN = /^([A-Z_]+):([^@\s]+)@([^@\s]+)$/u;

/** The reference a string names, or nothing when it names none. */
export function parseCatalogRef(text: string): CatalogRef | undefined {
  const found = REF_PATTERN.exec(text);
  if (found === null) return undefined;
  const registry = found[1]!;
  return isDataRegistry(registry)
    ? { registry, id: found[2]!, version: found[3]! }
    : undefined;
}

export function catalogRefEquals(
  first: CatalogRef,
  second: CatalogRef,
): boolean {
  return (
    first.registry === second.registry &&
    first.id === second.id &&
    first.version === second.version
  );
}

/**
 * What every record of every registry states about itself.
 *
 * The seven registries had seven different answers to « what is this, where
 * does it come from, may I still use it » — and three of them had no answer at
 * all. Ten thousand references cannot be poured into that: the shape has to be
 * the same everywhere first, so that one loader, one index and one gate can
 * treat a material, a symbol and a heat pump as the same kind of thing.
 */
export interface CatalogRecordIdentity {
  readonly id: string;
  readonly registry: DataRegistry;
  readonly version: string;
  readonly label: string;
  /** The family of the master nomenclature, where the registry has families. */
  readonly familyId?: string;
  readonly lifecycle?: CatalogLifecycle;
  readonly wave?: CatalogWave;
  readonly provenance: ProvenanceRecord;
  /** What to use instead, once this one is deprecated or withdrawn. */
  readonly replacedBy?: string;
  readonly retiredReason?: string;
}

/** An identity as a data file states it, before anything has been checked. */
export interface CatalogIdentityCandidate extends Omit<
  CatalogRecordIdentity,
  'registry' | 'lifecycle' | 'wave' | 'provenance'
> {
  readonly registry: string;
  readonly lifecycle?: string;
  readonly wave?: number;
  readonly provenance?: ProvenanceCandidate;
}

export interface IdentityIssue {
  readonly path: string;
  readonly message: string;
}

/**
 * A version, as versions are compared.
 *
 * The same expression the entry gate uses, and for the same reason: `1.0`,
 * `v1.0.0` and `1.0.0-final` would all name one entry and none of them would
 * sort against the others.
 */
const SEMVER =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u;

/**
 * A catalogue identifier: lower-case words joined by hyphens.
 *
 * `generic-air-water-heat-pump`, and not `Generic_AirWater`. Identifiers become
 * file names, URL fragments and map keys; a catalogue that admits three
 * spellings of one word will hold all three, and the day two of them mean the
 * same entry nobody will be able to tell.
 */
const RECORD_ID = /^[a-z0-9]+(?:[-.][a-z0-9]+)*$/u;

/**
 * Everything wrong with one record's identity, whichever registry it is in.
 *
 * Deliberately not about what the record *is* — its properties, its ports, its
 * layers are each registry's own business. This is the half they share, and it
 * is the half that has to be true before a manifest can list them, an index
 * can find them or a project can pin them.
 */
export function validateCatalogIdentity(
  identity: CatalogIdentityCandidate,
  known?: { readonly records: ReadonlySet<string> },
): readonly IdentityIssue[] {
  const issues: IdentityIssue[] = [];
  const at = (path: string, message: string) => issues.push({ path, message });
  if (identity.id.trim() === '') at('id', 'must not be empty');
  else if (!RECORD_ID.test(identity.id))
    at(
      'id',
      `${identity.id} must be a lower-case identifier such as generic-air-water-heat-pump`,
    );
  if (!isDataRegistry(identity.registry))
    at('registry', `unknown registry ${identity.registry}`);
  if (identity.label.trim() === '') at('label', 'must not be empty');
  if (identity.version.trim() === '') at('version', 'must state a version');
  else if (!SEMVER.test(identity.version))
    at('version', `${identity.version} is not a version of the form 1.0.0`);
  const lifecycle = identity.lifecycle ?? DEFAULT_LIFECYCLE;
  if (!isCatalogLifecycle(lifecycle))
    at('lifecycle', `unknown lifecycle ${lifecycle}`);
  if (identity.wave !== undefined && !isCatalogWave(identity.wave))
    at(
      'wave',
      `${identity.wave} is not one of the ${CATALOG_WAVES.length} waves of work`,
    );
  for (const issue of validateProvenance(identity.provenance))
    at(issue.path, issue.message);
  // Retiring a record without saying what to use instead moves the problem to
  // whoever meets it: they get « ne plus utiliser » and no second sentence.
  const retired = lifecycle === 'DEPRECATED' || lifecycle === 'WITHDRAWN';
  if (
    retired &&
    identity.replacedBy === undefined &&
    identity.retiredReason === undefined
  )
    at(
      'lifecycle',
      'a record leaving service must name its replacement or say why it has none',
    );
  if (!retired && identity.replacedBy !== undefined)
    at('replacedBy', 'a record in service is not replaced by another');
  if (
    identity.replacedBy !== undefined &&
    known !== undefined &&
    !known.records.has(identity.replacedBy)
  )
    at('replacedBy', `unknown record ${identity.replacedBy}`);
  if (identity.replacedBy === identity.id)
    at('replacedBy', 'a record cannot replace itself');
  return issues;
}
