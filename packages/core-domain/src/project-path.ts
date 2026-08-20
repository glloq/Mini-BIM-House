/**
 * Addressing a value inside a project.
 *
 * A path names what it addresses: `assemblies/wall-timber/layers/insulation`
 * refers to that layer whatever position it holds, while
 * `assemblies/3/layers/1` refers to whatever happens to sit there. Scenarios
 * outlive edits, so they address objects by identity; an index still resolves,
 * because files written before this rule have to keep opening.
 */
export function parseProjectPath(path: string): readonly string[] {
  return path.split('/').filter((segment) => segment !== '');
}

function isIndex(segment: string): boolean {
  return /^\d+$/u.test(segment);
}

function identifierOf(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const id = (value as { readonly id?: unknown }).id;
  return typeof id === 'string' ? id : undefined;
}

/**
 * The position a segment addresses in an array, or `undefined` when none does.
 *
 * Identity wins over position: an element whose id is the segment is the one
 * meant, even when the segment also reads as a number.
 */
export function elementIndex(
  container: readonly unknown[],
  segment: string,
): number | undefined {
  const byId = container.findIndex((entry) => identifierOf(entry) === segment);
  if (byId !== -1) return byId;
  if (!isIndex(segment)) return undefined;
  const index = Number(segment);
  return index < container.length ? index : undefined;
}

/** The child a segment addresses, without creating anything. */
export function childAt(container: unknown, segment: string): unknown {
  if (Array.isArray(container)) {
    const index = elementIndex(container, segment);
    return index === undefined ? undefined : container[index];
  }
  if (typeof container === 'object' && container !== null)
    return (container as Record<string, unknown>)[segment];
  return undefined;
}

/** The value a path addresses, or `undefined` when the project has no such node. */
export function resolveProjectPath(root: unknown, path: string): unknown {
  let current: unknown = root;
  for (const segment of parseProjectPath(path)) {
    current = childAt(current, segment);
    if (current === undefined) return undefined;
  }
  return current;
}
