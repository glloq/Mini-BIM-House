/**
 * How a value came to be in the catalogue.
 *
 * Every entry says it, without exception. A generic design value and a
 * manufacturer's declared figure look identical once they are numbers in a
 * file, and a project sized on the first while its author believed the second
 * is a project whose numbers cannot be defended. `GENERIC` is not a lesser
 * status — most of a first catalogue is generic — it is a statement.
 */
export const PROVENANCE_TYPES = [
  'GENERIC',
  'STANDARD',
  'MANUFACTURER',
  'DATABASE',
  'USER',
  'CALCULATED',
  'OTHER',
] as const;
export type ProvenanceType = (typeof PROVENANCE_TYPES)[number];

export interface ProvenanceRecord {
  readonly type: ProvenanceType;
  readonly reference: string;
  readonly url?: string;
  /** When the value was true, which is not when the file was written. */
  readonly validAt?: string;
}

export function isProvenanceType(value: string): value is ProvenanceType {
  return (PROVENANCE_TYPES as readonly string[]).includes(value);
}

export interface ProvenanceIssue {
  readonly path: string;
  readonly message: string;
}

/** Provenance as a data file states it, before its type has been checked. */
export interface ProvenanceCandidate extends Omit<ProvenanceRecord, 'type'> {
  readonly type: string;
}

export function validateProvenance(
  provenance: ProvenanceCandidate | undefined,
  path = 'provenance',
): readonly ProvenanceIssue[] {
  if (provenance === undefined)
    return [
      { path, message: 'every entry must say where its values come from' },
    ];
  const issues: ProvenanceIssue[] = [];
  if (!isProvenanceType(provenance.type))
    issues.push({
      path: `${path}/type`,
      message: `unknown ${provenance.type}`,
    });
  if (provenance.reference.trim() === '')
    issues.push({ path: `${path}/reference`, message: 'must not be empty' });
  // A manufacturer's figure without a dated reference is an anonymous number
  // wearing a manufacturer's authority.
  if (provenance.type === 'MANUFACTURER' && provenance.validAt === undefined)
    issues.push({
      path: `${path}/validAt`,
      message: 'a manufacturer value must say when it was declared',
    });
  return issues;
}
