import {
  entityIndex,
  referencesFromOutsideLevel,
  referencesTo,
  type ProjectReference,
} from '@house-technical-designer/core-domain';
import type { Project } from '@house-technical-designer/core-domain';

/**
 * What a refusal says, so the user knows which object to look at first.
 *
 * By name when the object has one — « la zone Zone chauffée » reaches somebody
 * in a way « heated » does not — and by identifier otherwise, which is still
 * something they can find.
 */
function named(
  project: Project,
  references: readonly ProjectReference[],
): string {
  const index = entityIndex(project);
  const shown = references.slice(0, 3);
  const listed = shown
    .map(({ fromId, label }) => {
      const found = index.get(fromId)?.label;
      return `${found ?? fromId} (${label})`;
    })
    .join(', ');
  return references.length > shown.length
    ? `${listed}, et ${references.length - shown.length} autre(s)`
    : listed;
}

/**
 * Why deleting this object would leave the project unreadable, if it would.
 *
 * What makes a deletion unsafe is never in the thing being deleted: it is in
 * everything that happens to name it. Each command used to ask its own
 * question — or no question at all — and the ones nobody thought of were the
 * ones that mattered: an empty storey can still be the storey a wall climbs
 * to, the storey a stair arrives at, the storey a node declares and the storey
 * a saved view draws. The importer refuses such a project, so the editor must
 * never write one.
 */
export function removalRefusal(
  project: Project,
  objectId: string,
  what = 'Cet objet',
): string | undefined {
  const references = referencesTo(project, objectId);
  return references.length === 0
    ? undefined
    : `${what} est encore désigné par ${named(project, references)}. Retirez ces liens avant de le supprimer.`;
}

/**
 * Why deleting a whole storey would leave the project unreadable.
 *
 * What the storey holds goes with it, so its own pointers are not a reason to
 * refuse; a pointer coming from anywhere else is.
 */
export function levelRemovalRefusal(
  project: Project,
  levelId: string,
): string | undefined {
  const references = referencesFromOutsideLevel(project, levelId);
  return references.length === 0
    ? undefined
    : `Ce niveau est encore désigné par ${named(project, references)}. Retirez ces liens avant de le supprimer.`;
}
