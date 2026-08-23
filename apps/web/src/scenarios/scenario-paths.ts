import type { Project } from '@house-technical-designer/core-domain';

/**
 * Something a scenario can vary, named the way the drawing names it.
 *
 * The user picks a wall, a layer, an equipment property or a calculation
 * setting; the path into the project file is derived from that choice. A JSON
 * path is a persistence detail, not a question to ask someone comparing two
 * insulation thicknesses.
 */
export interface ScenarioTarget {
  readonly path: string;
  readonly label: string;
  readonly group: string;
  readonly unit?: string;
  /** Value the base project declares, so the change reads as "from → to". */
  readonly currentValue: string;
  readonly numeric: boolean;
  /**
   * The values this target accepts, when it names another object.
   *
   * A reference typed by hand can name something the project does not hold,
   * and a variant built on a dangling reference is not a variant of anything.
   */
  readonly options?: readonly {
    readonly value: string;
    readonly label: string;
  }[];
}

function stringify(value: unknown): string {
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return value;
  if (typeof value === 'boolean') return value ? 'oui' : 'non';
  return '';
}

/**
 * Everything of the building a scenario may vary.
 *
 * Kept apart from the calculation settings so that pointing at a wall on the
 * plan does not pull the whole settings catalogue into the drawing: the
 * editor asks this, and the scenarios workspace asks for both.
 */
export function buildingScenarioTargets(
  project: Project,
): readonly ScenarioTarget[] {
  const targets: ScenarioTarget[] = [];

  // Paths name objects rather than positions: deleting an assembly must not
  // silently point an existing scenario at the one that takes its place.
  const assemblyOptions = (project.assemblies ?? []).map((assembly) => ({
    value: assembly.id,
    label: `${assembly.name} (${assembly.id})`,
  }));

  // A layer is named by what it is made of, and the project knows what that
  // is called. Reading the identifier out loud was tolerable while the
  // materials were called « material-insulation »; a catalogue calls them
  // « generic-eps », and nobody comparing two insulation thicknesses should
  // have to know that.
  const materialNames = new Map(
    (project.materialLibrary?.materials ?? []).map(({ id, name }) => [
      id as string,
      name,
    ]),
  );

  for (const level of project.building.levels) {
    for (const wall of level.walls) {
      targets.push({
        path: `building/levels/${level.id}/walls/${wall.id}/assemblyId`,
        label: `Assemblage du mur ${wall.id}`,
        group: `Murs — ${level.name}`,
        currentValue: wall.assemblyId,
        numeric: false,
        options: assemblyOptions,
      });
      if (wall.heightMode === 'EXPLICIT')
        targets.push({
          path: `building/levels/${level.id}/walls/${wall.id}/heightMm`,
          label: `Hauteur du mur ${wall.id}`,
          group: `Murs — ${level.name}`,
          unit: 'mm',
          currentValue: String(wall.heightMm),
          numeric: true,
        });
    }
  }

  for (const assembly of project.assemblies ?? [])
    for (const layer of assembly.layers)
      targets.push({
        path: `assemblies/${assembly.id}/layers/${layer.id}/thicknessM`,
        label: `${assembly.name} — épaisseur de ${
          materialNames.get(layer.materialId) ?? layer.materialId
        }`,
        group: 'Assemblages',
        unit: 'm',
        currentValue: String(layer.thicknessM),
        numeric: true,
      });

  for (const equipment of project.equipment ?? [])
    for (const [key, value] of Object.entries(equipment.properties)) {
      if (typeof value !== 'number' && typeof value !== 'string') continue;
      targets.push({
        path: `equipment/${equipment.id}/properties/${key}`,
        label: `${equipment.id} — ${key}`,
        group: 'Équipements',
        currentValue: stringify(value),
        numeric: typeof value === 'number',
      });
    }

  return targets;
}
