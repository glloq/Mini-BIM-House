/**
 * What the user typed while drawing, read as a length.
 *
 * The project is in millimetres and the person drawing thinks in whatever unit
 * the tape measure shows. `4200`, `4.2 m`, `420 cm` and `4,2m` are the same
 * wall, so all of them are accepted; anything else is refused rather than
 * guessed, because a length nobody meant is worse than no length at all.
 */
export function parseLengthMm(text: string): number | undefined {
  const cleaned = text.trim().toLowerCase().replace(',', '.');
  if (cleaned === '') return undefined;
  const match = /^(-?\d+(?:\.\d+)?)\s*(mm|cm|dm|m)?$/u.exec(cleaned);
  if (match === null) return undefined;
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) return undefined;
  const factor =
    match[2] === 'm'
      ? 1000
      : match[2] === 'dm'
        ? 100
        : match[2] === 'cm'
          ? 10
          : 1;
  return value * factor;
}

/** The same, read as a bearing in degrees. */
export function parseAngleDeg(text: string): number | undefined {
  const cleaned = text.trim().toLowerCase().replace(',', '.').replace('°', '');
  if (cleaned === '') return undefined;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : undefined;
}

/** Length and bearing of the segment being drafted, as the user reads them. */
export function draftedMeasures(
  origin: { readonly x: number; readonly y: number },
  target: { readonly x: number; readonly y: number },
): { readonly lengthMm: number; readonly angleDeg: number } {
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  return {
    lengthMm: Math.hypot(dx, dy),
    angleDeg: (Math.atan2(dy, dx) * 180) / Math.PI,
  };
}
