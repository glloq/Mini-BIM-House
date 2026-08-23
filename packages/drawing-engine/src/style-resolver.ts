import type {
  GraphicMetadataValue,
  GraphicProfile,
  GraphicStyleRule,
  ScenePrimitive,
  SemanticRole,
} from './scene.js';

/**
 * How many things a rule asks about.
 *
 * A rule that names a role and a category is more specific than one that names
 * the role alone, and that ordering is the whole point of having rules: the
 * general case is written once, the exceptions are written next to it, and no
 * one has to keep a table of hand-picked priority numbers in their head.
 */
export function graphicStyleRuleSpecificity(
  match: GraphicStyleRule['match'],
): number {
  return (
    (match.semanticRole === undefined ? 0 : 1) +
    (match.layer === undefined ? 0 : 1) +
    Object.keys(match.metadata ?? {}).length
  );
}

/**
 * The token a profile draws one primitive with.
 *
 * Specific rule, then generic role, then nothing — and « nothing » is the
 * caller's problem to report, not something to paper over with a default
 * style. Ties between rules of equal weight go to the one declared first, so
 * a profile reads top to bottom like a stylesheet does.
 */
export function resolveGraphicToken(
  profile: GraphicProfile,
  primitive: Pick<ScenePrimitive, 'semanticRole' | 'layer' | 'metadata'>,
): string | undefined {
  let chosen: GraphicStyleRule | undefined;
  let chosenWeight = Number.NEGATIVE_INFINITY;
  for (const rule of profile.styleRules ?? []) {
    if (!matchesPrimitive(rule.match, primitive)) continue;
    const weight = rule.priority ?? graphicStyleRuleSpecificity(rule.match);
    if (weight > chosenWeight) {
      chosen = rule;
      chosenWeight = weight;
    }
  }
  if (chosen !== undefined) return chosen.token;
  return profile.roleTokens[primitive.semanticRole];
}

function matchesPrimitive(
  match: GraphicStyleRule['match'],
  primitive: Pick<ScenePrimitive, 'semanticRole' | 'layer' | 'metadata'>,
): boolean {
  if (
    match.semanticRole !== undefined &&
    !matchesValue<SemanticRole>(match.semanticRole, primitive.semanticRole)
  )
    return false;
  if (match.layer !== undefined && !matchesValue(match.layer, primitive.layer))
    return false;
  for (const [key, expected] of Object.entries(match.metadata ?? {})) {
    const metadata = primitive.metadata;
    // A metadata key the primitive does not carry is not a match, even when
    // the rule expects `null`: « the room has no category » and « the room's
    // category is nothing » are different statements about the model.
    if (metadata === undefined || !Object.hasOwn(metadata, key)) return false;
    if (!matchesValue<GraphicMetadataValue>(expected, metadata[key] ?? null))
      return false;
  }
  return true;
}

function matchesValue<T extends GraphicMetadataValue>(
  expected: T | readonly T[],
  actual: T,
): boolean {
  return Array.isArray(expected)
    ? expected.some((value: T) => Object.is(value, actual))
    : Object.is(expected, actual);
}
