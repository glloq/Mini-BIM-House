import {
  CLEARANCE_GROUPS,
  type ClearanceGroupId,
} from './clearance-overlay.js';

export interface ClearanceControlProps {
  readonly groups: readonly ClearanceGroupId[];
  readonly onChange: (groups: readonly ClearanceGroupId[]) => void;
  /** How many pairs of zones are sharing space they may not share. */
  readonly conflicts: number;
  /** How many zones this project requires and nobody has measured. */
  readonly unmeasured: number;
}

/**
 * What room the machines need, shown one kind at a time.
 *
 * Not one switch: every zone of every appliance at once is a plan covered in
 * overlapping rectangles nobody reads. Somebody placing a heat pump wants its
 * air, somebody wiring a board wants the working space in front of it, and
 * neither wants the other.
 */
export function ClearanceControl({
  groups,
  onChange,
  conflicts,
  unmeasured,
}: ClearanceControlProps) {
  const toggle = (id: ClearanceGroupId) => {
    onChange(
      groups.includes(id)
        ? groups.filter((one) => one !== id)
        : [...groups, id],
    );
  };
  return (
    <section
      className="tool-options"
      role="group"
      aria-label="Dégagements sur le plan"
    >
      <h3>Dégagements</h3>
      <ul className="clearance-groups">
        {CLEARANCE_GROUPS.map((group) => (
          <li key={group.id}>
            <label>
              <input
                type="checkbox"
                checked={groups.includes(group.id)}
                onChange={() => {
                  toggle(group.id);
                }}
              />
              {group.label}
            </label>
          </li>
        ))}
      </ul>
      {conflicts > 0 && (
        <p className="hint">
          {conflicts === 1
            ? '1 volume partagé par deux objets qui ne le peuvent pas.'
            : `${conflicts} volumes partagés par des objets qui ne le peuvent pas.`}{' '}
          Le détail est dans l’espace Vérifications.
        </p>
      )}
      {unmeasured > 0 && (
        <p className="hint">
          {unmeasured === 1
            ? '1 dégagement demandé par un modèle et que personne n’a mesuré : il n’est pas dessiné.'
            : `${unmeasured} dégagements demandés par des modèles et que personne n’a mesurés : ils ne sont pas dessinés.`}
        </p>
      )}
    </section>
  );
}
