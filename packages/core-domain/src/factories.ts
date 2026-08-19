import type { LevelId } from './ids';
import type { Building, Level, ProjectMetadata, Site } from './types';

export function createProjectMetadata(
  name: string,
  timestamp: string,
  overrides: Partial<
    Omit<ProjectMetadata, 'name' | 'createdAt' | 'updatedAt'>
  > = {},
): ProjectMetadata {
  return { name, createdAt: timestamp, updatedAt: timestamp, ...overrides };
}

export function createSite(northAngleDeg = 0): Site {
  return { northAngleDeg };
}

export function createLevel(
  id: LevelId,
  name: string,
  elevationMm: number,
  defaultStoreyHeightMm: number,
): Level {
  if (defaultStoreyHeightMm <= 0) {
    throw new RangeError('The default storey height must be positive');
  }
  return {
    id,
    name,
    elevationMm,
    defaultStoreyHeightMm,
    walls: [],
    slabs: [],
    roofs: [],
    openings: [],
    stairs: [],
    spaces: [],
    annotations: [],
  };
}

export function createBuilding(levels: readonly Level[] = []): Building {
  return { levels, zones: [] };
}
