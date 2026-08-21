import type { PropertyValue } from './property-schemas.js';

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
