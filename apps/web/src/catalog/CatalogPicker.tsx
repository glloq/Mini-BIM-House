import { useMemo, useState } from 'react';
import {
  foldForSearch,
  installedCatalog,
  type CatalogRepository,
  type CatalogSummary,
} from '@house-technical-designer/catalog-registry';
import type { DataRegistry } from '@house-technical-designer/technical-types';

/**
 * The one way a catalogue entry gets into a project.
 *
 * The material library used to offer « importer le catalogue générique (46) » —
 * one button that put the whole shelf in the basket. It worked at sixteen
 * entries; at fifty-nine it was already the reason an empty project weighed
 * ninety-two kilobytes, and at ten thousand it is not a button, it is a
 * mistake with a number next to it.
 *
 * What replaces it asks the question the user actually has: which one. Rows
 * come from the repository — a name, a version, a category — and the fiche
 * itself is fetched only when somebody picks it. The assemblies had no offer
 * at all and worked only because the project was handed every build-up; they
 * have the same one now.
 */
export interface CatalogPickerProps {
  readonly registry: DataRegistry;
  /** What the project already holds, so it is not offered twice. */
  readonly taken: ReadonlySet<string>;
  readonly label: string;
  /**
   * Called with the entry as the catalogue states it, once fetched.
   *
   * The repository comes with it because one pick is sometimes several: taking
   * a build-up means taking the materials its layers name, and a layer
   * pointing at a material the project does not hold is a wall that draws,
   * costs nothing and insulates nothing.
   */
  readonly onPick: (
    summary: CatalogSummary,
    body: unknown,
    repository: CatalogRepository,
  ) => void | Promise<void>;
}

const MAXIMUM_SHOWN = 40;

export function CatalogPicker({
  registry,
  taken,
  label,
  onPick,
}: CatalogPickerProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [pending, setPending] = useState<string | undefined>(undefined);
  const repository = useMemo(() => installedCatalog(), []);

  // Rows, never fiches: what the list draws is a name and a version, and
  // holding the bodies to draw them is what does not scale.
  const choices = useMemo(() => {
    const held = repository.index.byRegistry.get(registry) ?? [];
    const needle = foldForSearch(text.trim());
    return held.filter(
      (summary) =>
        !taken.has(summary.id) &&
        (needle === '' || foldForSearch(summary.label).includes(needle)),
    );
  }, [repository, registry, taken, text]);

  if (!open)
    return (
      <button type="button" className="secondary" onClick={() => setOpen(true)}>
        {label}
      </button>
    );

  return (
    <div className="catalog-picker" role="group" aria-label={label}>
      <div className="catalog-picker-head">
        <label>
          <span className="visually-hidden">{label}</span>
          <input
            type="search"
            value={text}
            autoFocus
            placeholder="Chercher au catalogue"
            onChange={(event) => setText(event.target.value)}
          />
        </label>
        <button
          type="button"
          className="secondary"
          onClick={() => setOpen(false)}
        >
          Fermer
        </button>
      </div>
      <p className="catalog-picker-count">
        {choices.length} au catalogue, {taken.size} déjà dans le projet.
      </p>
      <ul className="catalog-picker-list">
        {choices.slice(0, MAXIMUM_SHOWN).map((summary) => (
          <li key={summary.id}>
            <button
              type="button"
              disabled={pending === summary.id}
              onClick={() => {
                setPending(summary.id);
                void repository
                  .entry(summary.ref)
                  .then(async (body) => {
                    await onPick(summary, body, repository);
                  })
                  .finally(() => {
                    setPending(undefined);
                  });
              }}
            >
              <span className="catalog-picker-name">{summary.label}</span>
              <span className="catalog-picker-meta">
                {summary.category ?? ''} {summary.version}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {choices.length > MAXIMUM_SHOWN && (
        // Saying so, rather than showing forty and letting the list look
        // complete: a silent truncation reads as « that is all there is ».
        <p className="catalog-picker-count">
          {choices.length - MAXIMUM_SHOWN} de plus ; affinez la recherche.
        </p>
      )}
    </div>
  );
}
