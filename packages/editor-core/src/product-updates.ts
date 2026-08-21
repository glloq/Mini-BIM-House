import { networkProduct } from '@house-technical-designer/network-products';
import type {
  NetworkProductSnapshot,
  Project,
} from '@house-technical-designer/core-domain';

/**
 * A product the catalogue has corrected since this project copied it.
 *
 * Offered, never applied. A project keeps its own copy so that it opens the
 * same way in two years; the price of that promise is that a correction has to
 * be accepted rather than arrive. Saying nothing would be the old behaviour
 * with extra steps — the network silently resized the day somebody edited a
 * tube — and applying it silently would be exactly the same defect.
 */
export interface NetworkProductUpdate {
  readonly productId: string;
  readonly label: string;
  /** What the project was drawn with. */
  readonly heldVersion?: string;
  /** What the catalogue offers now. */
  readonly catalogVersion?: string;
  /** The properties that differ, so the offer says what would change. */
  readonly changed: readonly string[];
}

function differences(
  held: Readonly<Record<string, unknown>>,
  offered: Readonly<Record<string, unknown>>,
): readonly string[] {
  const keys = new Set([...Object.keys(held), ...Object.keys(offered)]);
  return [...keys]
    .filter((key) => held[key] !== offered[key])
    .sort((first, second) => first.localeCompare(second));
}

/** Every product of this project the catalogue has moved past. */
export function networkProductUpdates(
  project: Project,
): readonly NetworkProductUpdate[] {
  return (project.networkProducts ?? []).flatMap((held) => {
    const offered = networkProduct(held.id);
    if (offered === undefined) return [];
    const changed = differences(held.properties, offered.properties);
    if (held.version === offered.version && changed.length === 0) return [];
    return [
      {
        productId: held.id,
        label: held.label,
        ...(held.version === undefined ? {} : { heldVersion: held.version }),
        ...(offered.version === undefined
          ? {}
          : { catalogVersion: offered.version }),
        changed,
      },
    ];
  });
}

/** The project with one product replaced by what the catalogue offers today. */
export function withUpdatedNetworkProduct(
  project: Project,
  productId: string,
): Project {
  const offered = networkProduct(productId);
  if (offered === undefined) return project;
  const updated: NetworkProductSnapshot = {
    id: offered.id,
    family: offered.family,
    domain: offered.domain,
    label: offered.label,
    ...(offered.version === undefined ? {} : { version: offered.version }),
    properties: { ...offered.properties },
    provenance: { ...offered.provenance },
  };
  return {
    ...project,
    networkProducts: (project.networkProducts ?? []).map((held) =>
      held.id === productId ? updated : held,
    ),
    // The runs drawn with it record the version they now carry, or the
    // difference would be reported for ever.
    systems: (project.systems ?? []).map((network) => ({
      ...network,
      edges: network.edges.map((edge) =>
        edge.productId === productId && offered.version !== undefined
          ? { ...edge, productVersion: offered.version }
          : edge,
      ),
    })),
  };
}
