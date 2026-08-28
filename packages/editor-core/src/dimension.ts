import type {
  Dimension,
  DimensionId,
} from '@house-technical-designer/core-domain';
import { resolveDimension } from '@house-technical-designer/core-domain';
import type {
  ChangeSet,
  CommandExecution,
  CommandValidation,
  EditorCommand,
  EditorProjectState,
} from './commands.js';

// The dimension itself is a project fact, so its type and resolution live in
// the domain. Only the commands that edit it belong to the editor.
export type {
  Dimension,
  DimensionId,
  DimensionResolution,
  DimensionType,
  WallEndpointReference,
} from '@house-technical-designer/core-domain';
export {
  dimensionId,
  resolveDimension,
} from '@house-technical-designer/core-domain';

export class AddDimensionCommand implements EditorCommand {
  readonly label = 'Add dimension';
  constructor(
    readonly id: string,
    readonly dimension: Dimension,
  ) {}
  validate(state: EditorProjectState): CommandValidation {
    if (state.dimensions.some(({ id }) => id === this.dimension.id))
      return {
        valid: false,
        errors: [`La cote ${this.dimension.id} existe déjà.`],
      };
    if (!Number.isFinite(this.dimension.offsetMm))
      return {
        valid: false,
        errors: ['Le décalage d’une cote doit être un nombre fini.'],
      };
    const resolution = resolveDimension(this.dimension, state.walls);
    return resolution.status === 'OK'
      ? { valid: true }
      : {
          valid: false,
          errors: [
            `Cette cote mesure des murs absents : ${resolution.missingWallIds.join(', ')}.`,
          ],
        };
  }
  execute(state: EditorProjectState): CommandExecution {
    return {
      nextState: {
        ...state,
        dimensions: [...state.dimensions, this.dimension],
      },
      inverse: new DeleteDimensionCommand(
        `${this.id}:inverse`,
        this.dimension.id,
      ),
      changes: dimensionChanges(this.dimension),
    };
  }
}

export class DeleteDimensionCommand implements EditorCommand {
  readonly label = 'Delete dimension';
  constructor(
    readonly id: string,
    readonly dimensionId: DimensionId,
  ) {}
  validate(state: EditorProjectState): CommandValidation {
    return state.dimensions.some(({ id }) => id === this.dimensionId)
      ? { valid: true }
      : {
          valid: false,
          errors: [`La cote ${this.dimensionId} n’existe pas.`],
        };
  }
  execute(state: EditorProjectState): CommandExecution {
    const dimension = state.dimensions.find(
      ({ id }) => id === this.dimensionId,
    );
    if (dimension === undefined)
      throw new Error('Delete dimension executed without validation.');
    return {
      nextState: {
        ...state,
        dimensions: state.dimensions.filter(
          ({ id }) => id !== this.dimensionId,
        ),
      },
      inverse: new AddDimensionCommand(`${this.id}:inverse`, dimension),
      changes: dimensionChanges(dimension),
    };
  }
}

function dimensionChanges(dimension: Dimension): ChangeSet {
  return {
    objectIds: [dimension.id, dimension.first.wallId, dimension.second.wallId],
    domains: ['dimensions', 'drawing'],
    paths: [`dimensions/${dimension.id}`],
  };
}
