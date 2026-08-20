/**
 * The properties a selected object writes on the drawing itself.
 *
 * A window is placed by saying how far it sits from the corner, and that number
 * lived in a field called `offsetAlongHostMm` in a panel on the right. These
 * are the ones worth reading where they are measured; the rest stay in the
 * inspector, which is where a property nobody measures on a plan belongs.
 */
export const TEMPORARY_EDIT_IDS: readonly string[] = [
  'lengthMm',
  'offsetAlongHostMm',
  'widthMm',
];
