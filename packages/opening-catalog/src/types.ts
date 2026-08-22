/**
 * What an opening entry is a **kind** of.
 *
 * The model already names the three: an opening in a wall is a door, a window
 * or a void. A solar protection is not one of them — it is fitted to an
 * opening rather than being one — and saying so is what stops a roller shutter
 * from being placed as a hole in a wall.
 */
export const OPENING_CATEGORIES = [
  'WINDOW',
  'DOOR',
  'SOLAR_PROTECTION',
] as const;
export type OpeningCategory = (typeof OPENING_CATEGORIES)[number];

export function isOpeningCategory(value: string): value is OpeningCategory {
  return (OPENING_CATEGORIES as readonly string[]).includes(value);
}

export type OpeningPropertyValue = string | number | boolean;

/**
 * A catalogue entry for something that pierces a wall, or shades what does.
 *
 * There was no opening catalogue. The model carried `Opening.definitionId`,
 * the nomenclature declared thirty-four families of opening, the seven
 * registries listed one — and nothing shipped a single entry, so the pointer
 * pointed at nothing and every window in every project had to have its Uw
 * typed in by hand or else be counted as an unknown.
 *
 * A window is not assembled from layers: its datasheet gives one Uw covering
 * the glass, the frame and the spacer, and no stack of layers reproduces it.
 * That is precisely why it needs a catalogue of its own rather than an
 * assembly.
 */
export interface OpeningDefinition {
  readonly id: string;
  readonly familyId: string;
  /** The kind, as the family states it; the entry echoes it and the gate compares. */
  readonly category: OpeningCategory;
  readonly name: string;
  readonly version: string;
  readonly manufacturer?: string;
  readonly model?: string;
  readonly provenance: {
    readonly type: string;
    readonly reference: string;
    readonly url?: string;
    readonly validAt?: string;
  };
  readonly properties: Readonly<Record<string, OpeningPropertyValue>>;
  /** Where one declared value comes from, when it is not the entry's own. */
  readonly sources?: readonly {
    readonly property: string;
    readonly sourceType: string;
    readonly reference: string;
  }[];
}
