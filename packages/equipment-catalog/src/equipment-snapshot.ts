import type {
  EquipmentDefinition as ProjectEquipment,
  HostType,
} from '@house-technical-designer/core-domain';
import {
  isClearanceZone,
  type ClearanceZone,
} from '@house-technical-designer/technical-types';
import type { EquipmentDefinition } from './types.js';

/** What the project decides about this copy, rather than the catalogue. */
export interface SnapshotOptions {
  /** Unique within the project, which is not the catalogue's business. */
  readonly id: string;
  readonly allowedHosts?: readonly HostType[];
  readonly requiredClearances?: readonly ClearanceZone[];
  readonly capabilities?: readonly string[];
}

/**
 * A catalogue definition, as a project holds it.
 *
 * A copy, and not a summary. It used to keep four fields and hide the rest
 * inside `properties` — `catalogDefinitionId`, `catalogDefinitionVersion` —
 * where nothing could read them: the version pin looked for `version` at the
 * top and found nothing, so a component placed from the interface recorded no
 * pin at all, and the whole point of pinning was lost between two panels.
 *
 * What travels is what makes the entry more than a bag of numbers: the family
 * it belongs to, its version, what it may be fixed to, what it is connected
 * by, the room it needs, how it behaves away from its nominal point, what
 * draws it, and where each of its figures came from. A project claiming to be
 * self-contained has to carry them, because the catalogue it was copied from
 * will move and this file must not.
 *
 * It lives beside the catalogue rather than in the interface because it is not
 * an interface concern: the qualification fixture built its own copies by
 * hand, which is how a second constructor for one idea comes to exist — and
 * the one nobody looks at is the one that quietly stops carrying a field.
 *
 * And it lives here rather than in the registry because reaching for the
 * registry reaches for five hundred families of JSON: the interface copies a
 * fiche on the first screen it draws, and the nomenclature has no business
 * following it there.
 */
export function equipmentSnapshot(
  definition: EquipmentDefinition,
  options: SnapshotOptions,
): ProjectEquipment {
  // What bucket this belongs to is the family's word, not the entry's: the
  // entry used to carry a `kind` and a `category` of its own, and the copy
  // taken into the project carried whichever of the two it happened to read.
  // It arrives here already stamped by `genericCatalog`.
  const category = definition.category;
  return {
    id: options.id,
    familyId: definition.familyId,
    kind: category ?? definition.familyId,
    catalogKind: definition.catalogKind,
    version: definition.version,
    name: definition.name,
    ...(category === undefined ? {} : { category }),
    ...(definition.manufacturer === undefined
      ? {}
      : { manufacturer: definition.manufacturer }),
    ...(definition.model === undefined ? {} : { model: definition.model }),
    ...(definition.dimensions === undefined
      ? {}
      : { dimensions: definition.dimensions }),
    ...(options.allowedHosts === undefined
      ? {}
      : { allowedHosts: options.allowedHosts }),
    ...(options.requiredClearances === undefined
      ? {}
      : { requiredClearances: options.requiredClearances }),
    ...(options.capabilities === undefined
      ? {}
      : { capabilities: options.capabilities }),
    ports: definition.ports.map((port) => ({
      id: port.id,
      portTypeId: port.portTypeId,
      position: port.position,
    })),
    ...(definition.clearances === undefined
      ? {}
      : {
          clearances: definition.clearances.filter(
            (
              clearance,
            ): clearance is typeof clearance & { zone: ClearanceZone } =>
              isClearanceZone(clearance.zone),
          ),
        }),
    provenance: definition.provenance,
    // Where each figure comes from, not just where the fiche as a whole does.
    // A manufacturer sheet declares half its numbers and computes the other
    // half, and a copy that kept only the entry-level sentence could no longer
    // tell which was which.
    ...(definition.sources.length === 0 ? {} : { sources: definition.sources }),
    // A heat pump is not a number: its coefficient of performance at −7 °C is
    // not the one at 7 °C. The curves stopped at the project's edge, so a file
    // reopened without the catalogue installed had lost the only thing that
    // said how the machine behaves anywhere but at its nominal point.
    ...(definition.performanceCurves === undefined
      ? {}
      : { performanceCurves: definition.performanceCurves }),
    ...(definition.rendering === undefined
      ? {}
      : { rendering: definition.rendering }),
    ...(definition.costEntryId === undefined
      ? {}
      : { costEntryId: definition.costEntryId }),
    ...(definition.environmentalDeclarationId === undefined
      ? {}
      : { environmentalDeclarationId: definition.environmentalDeclarationId }),
    properties: { ...definition.properties, name: definition.name },
  };
}
