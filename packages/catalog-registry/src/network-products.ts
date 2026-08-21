import type { DataDomain } from '@house-technical-designer/technical-types';
import type { PropertyValue } from './property-schemas.js';
import type { ProvenanceRecord } from './provenance.js';

/**
 * A length of something a network is made of: pipe, cable, duct, flue.
 *
 * These are not equipment. A PER 16×2 is a product with a diameter, a
 * roughness and a pressure class, and there are three hundred of them; making
 * each one an « equipment definition » with ports and clearances would be
 * describing a tube as though it were a heat pump. And none of it belongs in
 * `NetworkEdge`: an edge is a run drawn in a building, the product is what the
 * run is made of, and one project uses the same product on forty edges.
 */
export interface NetworkProduct {
  readonly id: string;
  /** PIPE, CABLE, DUCT, CONDUIT, FLUE — the family it is an entry of. */
  readonly family: string;
  readonly domain: DataDomain;
  readonly label: string;
  readonly properties: Readonly<Record<string, PropertyValue>>;
  readonly provenance: ProvenanceRecord;
}

export interface NetworkProductIssue {
  readonly path: string;
  readonly message: string;
}

/**
 * Whether the inner diameter a product states agrees with its own walls.
 *
 * The three numbers are one number too many, and a catalogue of three hundred
 * tubes will have a typo in it. Refusing the entry is cheaper than sizing a
 * network on a tube whose bore is wrong by four millimetres.
 */
export function invalidBore(
  properties: Readonly<Record<string, PropertyValue>>,
): NetworkProductIssue | undefined {
  const outer = properties.outerDiameterMm;
  const wall = properties.wallThicknessMm;
  const inner = properties.innerDiameterMm;
  if (
    typeof outer !== 'number' ||
    typeof wall !== 'number' ||
    typeof inner !== 'number'
  )
    return undefined;
  const expected = outer - 2 * wall;
  return Math.abs(expected - inner) < 0.05
    ? undefined
    : {
        path: 'innerDiameterMm',
        message: `states ${inner} mm where ${outer} mm outside and ${wall} mm of wall give ${expected.toFixed(1)} mm`,
      };
}
