import { describe, expect, it } from 'vitest';
import { assemblyId } from '@house-technical-designer/assemblies';
import { entityId, type Wall } from '@house-technical-designer/core-domain';
import { WallDrawingTool } from './wall-drawing-tool.js';

const createWall = (points: Wall['path']['points']): Wall => ({
  id: entityId<'Wall'>('wall'),
  type: 'WALL',
  levelId: entityId<'Level'>('level'),
  path: { points },
  referenceSide: 'CENTER',
  assemblyId: assemblyId('assembly'),
  baseOffsetMm: 0,
  heightMode: 'EXPLICIT',
  heightMm: 2500,
  role: 'EXTERIOR',
});

describe('wall drawing tool', () => {
  it('keeps pointer previews transient until finish', () => {
    const tool = new WallDrawingTool({
      commandId: () => 'add-wall',
      createWall,
    });
    tool.start({ x: 0, y: 0 });
    tool.updatePointer({ x: 500, y: 300 });
    expect(tool.state).toMatchObject({
      status: 'DRAWING',
      committedPoints: [{ x: 0, y: 0 }],
      preview: {
        points: [
          { x: 0, y: 0 },
          { x: 500, y: 300 },
        ],
      },
    });
    expect(tool.finish()).toBeUndefined();
  });
  it('applies orthogonal and exact-length constraints', () => {
    const tool = new WallDrawingTool({
      commandId: () => 'add-wall',
      createWall,
    });
    tool.addPoint({ x: 0, y: 0 });
    tool.addPoint({ x: 800, y: 100 }, { orthogonal: true, lengthMm: 1200 });
    expect(tool.state).toMatchObject({
      committedPoints: [
        { x: 0, y: 0 },
        { x: 1200, y: 0 },
      ],
    });
  });
  it('creates one reversible AddWall command only on finish', () => {
    const tool = new WallDrawingTool({
      commandId: () => 'add-wall',
      createWall,
    });
    tool.start({ x: 0, y: 0 });
    tool.addPoint({ x: 1000, y: 0 });
    const command = tool.finish();
    expect(command).toMatchObject({
      id: 'add-wall',
      wall: {
        path: {
          points: [
            { x: 0, y: 0 },
            { x: 1000, y: 0 },
          ],
        },
      },
    });
    expect(tool.state).toEqual({ status: 'IDLE' });
  });
  it('handles Escape through cancellation without a command', () => {
    const tool = new WallDrawingTool({
      commandId: () => 'add-wall',
      createWall,
    });
    tool.start({ x: 0, y: 0 });
    expect(tool.cancel()).toEqual({ status: 'IDLE' });
    expect(tool.finish()).toBeUndefined();
  });
});
