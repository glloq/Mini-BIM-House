import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * `unknown ?? 0` is forbidden in the adapters.
 *
 * This is the invariant the whole calculation layer rests on: the engines know
 * how to say « je ne sais pas », and it is the adapters' job to let them. A
 * `?? 0` is the adapter answering on the project's behalf — and zero is a
 * number, so nothing downstream can tell it apart from a measurement.
 *
 * A deliberate zero is still allowed; it has to say so, either by going
 * through `settings.assume()` or by carrying a comment on the line above that
 * says what the zero means.
 */
const directory = fileURLToPath(new URL('.', import.meta.url));

function adapterSources(): readonly string[] {
  return readdirSync(directory).filter(
    (name) =>
      name.endsWith('.ts') &&
      !name.endsWith('.test.ts') &&
      !name.endsWith('.bench.ts'),
  );
}

/** The lines that fall back to zero, with what stands above them. */
function silentZeros(source: string): readonly string[] {
  const lines = source.split('\n');
  const found: string[] = [];
  for (const [index, line] of lines.entries()) {
    if (!/\?\?\s*0\b/u.test(line)) continue;
    // Accumulating into a map — `(seen.get(id) ?? 0) + value` — is not a
    // fallback for an unknown: it is the empty bucket a running total starts
    // from, and the value being added is the one that had to be resolved.
    if (/\.get\([^)]*\)\s*\?\?\s*0/u.test(line)) continue;
    const above = lines
      .slice(Math.max(0, index - 6), index)
      .join(' ')
      .toLowerCase();
    const explained =
      above.includes('//') || above.includes('*') || above.includes('assume');
    if (!explained) found.push(`${index + 1}: ${line.trim()}`);
  }
  return found;
}

describe('the adapters never answer zero on the project’s behalf', () => {
  it('leaves no unexplained fallback to zero', () => {
    const offenders = new Map<string, readonly string[]>();
    for (const name of adapterSources()) {
      const found = silentZeros(
        readFileSync(new URL(name, import.meta.url), 'utf8'),
      );
      if (found.length > 0) offenders.set(name, found);
    }
    expect(
      [...offenders].map(([name, lines]) => `${name}\n  ${lines.join('\n  ')}`),
    ).toEqual([]);
  });

  it('is checking the files it thinks it is checking', () => {
    // A guard that silently stops reading anything is a guard that passes for
    // ever.
    expect(adapterSources().length).toBeGreaterThan(4);
    expect(adapterSources()).toContain('project-inputs.ts');
    expect(silentZeros('const x = maybe ?? 0;')).toHaveLength(1);
    expect(silentZeros('// zéro assumé\nconst x = maybe ?? 0;')).toHaveLength(
      0,
    );
  });
});
