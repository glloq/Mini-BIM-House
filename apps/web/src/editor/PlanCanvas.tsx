import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { Project } from '@house-technical-designer/core-domain';
import {
  GENERIC_TECHNICAL_SCREEN,
  renderSemanticSceneToSvg,
  type ScenePrimitive,
} from '@house-technical-designer/drawing-engine';
import { findSnap, modelToScreen } from '@house-technical-designer/editor-core';
import type { Segment2D } from '@house-technical-designer/geometry';
import type { AnalysisOverlay } from '@house-technical-designer/calculation-core';
import {
  buildPlanView,
  overlayPrimitives,
  pickPrimitive,
  previewWallFaces,
  type PlanViewResult,
} from '@house-technical-designer/view-query';
import type { EditorAction, EditorState } from './editor-state.js';
import { offsetAlongWall, type GeometryEdit, type Grip } from './grips.js';
import { gripsFor } from './object-editors.js';
import {
  constrainPoint,
  constrainsDrafting,
  pointerModelPoint,
  requiredPoints,
} from './editor-state.js';

/** What a handle does, said out loud for anyone not looking at the screen. */
function gripLabel(grip: Grip): string {
  switch (grip.kind) {
    case 'WALL_POINT':
      return `Déplacer l’extrémité ${grip.pointIndex + 1} du mur ${grip.wallId}`;
    case 'WALL_BODY':
      return `Déplacer le mur ${grip.wallId}`;
    case 'OPENING':
      return `Déplacer l’ouverture ${grip.openingId} sur son mur`;
    case 'POLYGON_VERTEX':
      return `Déplacer le sommet ${grip.vertexIndex + 1} de ${grip.objectId} · alt-clic pour le retirer`;
    case 'POLYGON_EDGE':
      return `Ajouter un sommet sur le côté ${grip.edgeIndex + 1} de ${grip.objectId}`;
  }
}

/** Model-space pick tolerance, generous enough for a fingertip on a tablet. */
const PICK_TOLERANCE_MM = 120;

export interface PlanCanvasProps {
  readonly project: Project;
  readonly editor: EditorState;
  readonly dispatch: (action: EditorAction) => void;
  readonly onCommitPoints: (
    points: readonly { x: number; y: number }[],
  ) => void;
  readonly wallThicknessMm: number;
  /**
   * What a dragged handle asks of the model.
   *
   * The canvas knows where the handles are and where the pointer went; what
   * that means for the project is decided where the commands live.
   */
  readonly onEditGeometry?: (edit: GeometryEdit) => void;
  /** Analysis values projected onto the drawing, when one is selected. */
  readonly overlay?: AnalysisOverlay;
}

/** Segments the snap engine considers: every wall axis on the level. */
function snapSegments(
  project: Project,
  levelId?: string,
): readonly Segment2D[] {
  const level =
    levelId === undefined
      ? project.building.levels[0]
      : project.building.levels.find(({ id }) => id === levelId);
  const segments: Segment2D[] = [];
  for (const wall of level?.walls ?? [])
    for (let index = 1; index < wall.path.points.length; index += 1)
      segments.push({
        start: wall.path.points[index - 1]!,
        end: wall.path.points[index]!,
      });
  return segments;
}

type RenderResult =
  | { readonly status: 'OK'; readonly markup: string }
  | { readonly status: 'EMPTY' }
  | { readonly status: 'ERROR'; readonly message: string };

export function PlanCanvas({
  project,
  editor,
  dispatch,
  onCommitPoints,
  wallThicknessMm,
  onEditGeometry,
  overlay,
}: PlanCanvasProps) {
  const container = useRef<HTMLDivElement>(null);
  const panOrigin = useRef<{ x: number; y: number } | undefined>(undefined);
  /** The handle being dragged, and where it started. */
  const dragging = useRef<
    { readonly grip: Grip; readonly from: { x: number; y: number } } | undefined
  >(undefined);

  const preview = useMemo<readonly ScenePrimitive[]>(() => {
    if (editor.pendingPoints.length === 0 || editor.cursorModel === undefined)
      return [];
    const origin = editor.pendingPoints[editor.pendingPoints.length - 1]!;
    const target = constrainPoint(
      origin,
      editor.activeSnap?.point ?? editor.cursorModel,
      editor.snap,
      editor.directInput,
    );
    const footprint =
      editor.activeTool === 'WALL'
        ? previewWallFaces([origin, target], wallThicknessMm)
        : undefined;
    const lengthMm = Math.round(
      Math.hypot(target.x - origin.x, target.y - origin.y),
    );
    const angleDeg =
      (Math.atan2(target.y - origin.y, target.x - origin.x) * 180) / Math.PI;
    return [
      ...(footprint === undefined
        ? []
        : [
            {
              id: 'preview:wall',
              semanticRole: 'WALL_CUT' as const,
              geometry: { kind: 'POLYGON' as const, polygon: footprint },
              layer: 'architecture.walls',
              zIndex: 90,
              discipline: 'ARCHITECTURE' as const,
              state: 'GHOST' as const,
            },
          ]),
      {
        id: 'preview:axis',
        semanticRole: 'ANNOTATION' as const,
        geometry: {
          kind: 'POLYLINE' as const,
          polyline: { points: [origin, target], closed: false },
        },
        layer: 'annotation.dimensions',
        zIndex: 91,
        discipline: 'ARCHITECTURE' as const,
        state: 'GHOST' as const,
      },
      {
        id: 'preview:label',
        semanticRole: 'ANNOTATION' as const,
        geometry: {
          kind: 'TEXT' as const,
          anchor: {
            x: (origin.x + target.x) / 2,
            y: (origin.y + target.y) / 2,
          },
          text: `${(lengthMm / 1000).toFixed(2)} m · ${angleDeg.toFixed(1)}°`,
        },
        layer: 'annotation.dimensions',
        zIndex: 92,
        discipline: 'ARCHITECTURE' as const,
        state: 'GHOST' as const,
      },
    ];
  }, [editor, wallThicknessMm]);

  const base: PlanViewResult = useMemo(
    () =>
      buildPlanView(project, {
        ...(editor.levelId === undefined ? {} : { levelId: editor.levelId }),
        layers: editor.layers,
        selection: editor.selection,
        ...(editor.hoveredId === undefined
          ? {}
          : { hoveredId: editor.hoveredId }),
        extraPrimitives: preview,
        graphicProfileId: GENERIC_TECHNICAL_SCREEN.profile.id,
      }),
    [
      project,
      editor.levelId,
      editor.layers,
      editor.selection,
      editor.hoveredId,
      preview,
    ],
  );

  const plan: PlanViewResult = useMemo(() => {
    if (overlay === undefined) return base;
    return buildPlanView(project, {
      ...(editor.levelId === undefined ? {} : { levelId: editor.levelId }),
      layers: { ...editor.layers, 'analysis.overlay': true },
      selection: editor.selection,
      ...(editor.hoveredId === undefined
        ? {}
        : { hoveredId: editor.hoveredId }),
      extraPrimitives: [
        ...preview,
        ...overlayPrimitives(base.primitives, overlay),
      ],
      graphicProfileId: GENERIC_TECHNICAL_SCREEN.profile.id,
    });
  }, [
    base,
    overlay,
    project,
    editor.levelId,
    editor.layers,
    editor.selection,
    editor.hoveredId,
    preview,
  ]);

  /**
   * The drawing, or why there is none.
   *
   * An empty level and a renderer that threw are not the same thing, and
   * showing both as "nothing to display" hides a real failure behind a blank
   * canvas. The two are kept apart so the second one can be reported.
   */
  const rendered = useMemo((): RenderResult => {
    try {
      const markup = renderSemanticSceneToSvg(
        plan.scene,
        plan.view,
        GENERIC_TECHNICAL_SCREEN.profile,
        GENERIC_TECHNICAL_SCREEN.styles,
        { includeInteractionStates: true, includeSemanticGroups: true },
      );
      return plan.scene.primitives.length === 0
        ? { status: 'EMPTY' }
        : { status: 'OK', markup };
    } catch (error) {
      return {
        status: 'ERROR',
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }, [plan]);

  const segments = useMemo(
    () => snapSegments(project, editor.levelId),
    [project, editor.levelId],
  );

  useEffect(() => {
    const element = container.current;
    if (element === null) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry === undefined) return;
      dispatch({
        type: 'RESIZE',
        viewport: {
          widthPx: entry.contentRect.width,
          heightPx: entry.contentRect.height,
        },
      });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [dispatch]);

  const modelPointOf = useCallback(
    (event: { clientX: number; clientY: number }) => {
      const bounds = container.current?.getBoundingClientRect();
      if (bounds === undefined) return undefined;
      return pointerModelPoint(
        editor.camera,
        { x: event.clientX, y: event.clientY },
        bounds,
      );
    },
    [editor.camera],
  );

  /**
   * Resolves the snap for a pointer event from the event itself.
   *
   * Reading it back from state would reuse the previous pointer position when a
   * move and a press arrive in the same frame, which is exactly what happens on
   * a fast click and used to commit the same point twice.
   */
  const snapFor = useCallback(
    (event: { clientX: number; clientY: number }) => {
      const bounds = container.current?.getBoundingClientRect();
      if (bounds === undefined || !editor.snap.enabled) return undefined;
      return findSnap(
        editor.camera,
        { x: event.clientX - bounds.left, y: event.clientY - bounds.top },
        segments,
        {
          tolerancePx: editor.snap.tolerancePx,
          ...(editor.snap.grid
            ? { gridSpacingMm: editor.snap.gridSpacingMm }
            : {}),
        },
      );
    },
    [editor.camera, editor.snap, segments],
  );

  const handleMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const bounds = container.current?.getBoundingClientRect();
      const model = modelPointOf(event);
      if (bounds === undefined || model === undefined) return;
      if (panOrigin.current !== undefined) {
        dispatch({
          type: 'PAN',
          deltaPx: {
            x: event.clientX - panOrigin.current.x,
            y: event.clientY - panOrigin.current.y,
          },
        });
        panOrigin.current = { x: event.clientX, y: event.clientY };
        return;
      }
      const snap = snapFor(event);
      dispatch({
        type: 'MOVE_CURSOR',
        model,
        ...(snap === undefined ? {} : { snap }),
      });
      if (editor.activeTool === 'SELECT') {
        const picked = pickPrimitive(plan.primitives, model, PICK_TOLERANCE_MM);
        dispatch({
          type: 'HOVER',
          ...(picked === undefined ? {} : { objectId: picked.objectId }),
        });
      }
    },
    [dispatch, editor.activeTool, modelPointOf, plan.primitives, snapFor],
  );

  const handleDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button === 1 || event.shiftKey) {
        panOrigin.current = { x: event.clientX, y: event.clientY };
        event.currentTarget.setPointerCapture(event.pointerId);
        return;
      }
      const model = modelPointOf(event);
      if (model === undefined) return;
      if (editor.activeTool === 'SELECT') {
        const picked = pickPrimitive(plan.primitives, model, PICK_TOLERANCE_MM);
        dispatch({
          type: 'SELECT',
          ...(picked === undefined ? {} : { objectId: picked.objectId }),
          additive: event.ctrlKey || event.metaKey,
        });
        return;
      }
      const snapped = snapFor(event)?.point ?? model;
      const origin = editor.pendingPoints[editor.pendingPoints.length - 1];
      const point =
        origin === undefined || !constrainsDrafting(editor.activeTool)
          ? snapped
          : constrainPoint(origin, snapped, editor.snap, editor.directInput);
      const points = [...editor.pendingPoints, point];
      dispatch({ type: 'COMMIT_POINT', point });
      // Each tool declares how many points it needs; the canvas does not keep
      // its own list of which ones are single-click.
      if (points.length >= requiredPoints(editor.activeTool))
        onCommitPoints(points);
    },
    [dispatch, editor, modelPointOf, onCommitPoints, plan.primitives, snapFor],
  );

  const handleUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (panOrigin.current === undefined) return;
    panOrigin.current = undefined;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  }, []);

  const grips = useMemo(
    () =>
      editor.activeTool === 'SELECT' && onEditGeometry !== undefined
        ? gripsFor(project, editor.levelId, editor.selection)
        : [],
    [
      editor.activeTool,
      editor.levelId,
      editor.selection,
      onEditGeometry,
      project,
    ],
  );

  /**
   * Applies what a released handle means.
   *
   * The point committed is the snapped one, so a corner dragged onto another
   * wall lands on it exactly rather than a few millimetres away.
   */
  const commitDrag = useCallback(
    (grip: Grip, to: { x: number; y: number }): void => {
      if (onEditGeometry === undefined) return;
      switch (grip.kind) {
        case 'WALL_POINT':
          onEditGeometry({
            kind: 'WALL_POINT',
            wallId: grip.wallId,
            pointIndex: grip.pointIndex,
            to,
          });
          return;
        case 'WALL_BODY':
          onEditGeometry({
            kind: 'WALL_MOVE',
            wallId: grip.wallId,
            delta: { x: to.x - grip.at.x, y: to.y - grip.at.y },
          });
          return;
        case 'OPENING': {
          const level =
            editor.levelId === undefined
              ? project.building.levels[0]
              : project.building.levels.find(({ id }) => id === editor.levelId);
          const wall = level?.walls.find(({ id }) => id === grip.wallId);
          const opening = level?.openings.find(
            ({ id }) => id === grip.openingId,
          );
          if (wall === undefined || opening === undefined) return;
          const along = offsetAlongWall(wall.path.points, to);
          if (along === undefined) return;
          onEditGeometry({
            kind: 'OPENING_OFFSET',
            openingId: grip.openingId,
            // The handle sits at the middle of the opening; the model stores
            // where it starts.
            offsetMm: Math.round(along - opening.widthMm / 2),
          });
          return;
        }
        case 'POLYGON_VERTEX':
          onEditGeometry({
            kind: 'POLYGON_VERTEX',
            objectId: grip.objectId,
            objectKind: grip.objectKind,
            vertexIndex: grip.vertexIndex,
            to,
          });
          return;
        case 'POLYGON_EDGE':
          onEditGeometry({
            kind: 'POLYGON_INSERT',
            objectId: grip.objectId,
            objectKind: grip.objectKind,
            edgeIndex: grip.edgeIndex,
            at: to,
          });
      }
    },
    [editor.levelId, onEditGeometry, project],
  );

  const handleGripDown = useCallback(
    (grip: Grip, event: React.PointerEvent<HTMLButtonElement>): void => {
      event.stopPropagation();
      event.preventDefault();
      // Alt-clicking a corner removes it: the same handle, the opposite
      // intention, as every drawing tool spells it.
      if (event.altKey && grip.kind === 'POLYGON_VERTEX') {
        onEditGeometry?.({
          kind: 'POLYGON_REMOVE',
          objectId: grip.objectId,
          objectKind: grip.objectKind,
          vertexIndex: grip.vertexIndex,
        });
        return;
      }
      dragging.current = {
        grip,
        from: { x: event.clientX, y: event.clientY },
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [onEditGeometry],
  );

  const handleGripUp = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>): void => {
      const drag = dragging.current;
      dragging.current = undefined;
      if (event.currentTarget.hasPointerCapture(event.pointerId))
        event.currentTarget.releasePointerCapture(event.pointerId);
      if (drag === undefined) return;
      const moved =
        Math.abs(event.clientX - drag.from.x) +
        Math.abs(event.clientY - drag.from.y);
      // A click that never moved is a click on the object, not an edit.
      if (moved < 2 && drag.grip.kind !== 'POLYGON_EDGE') return;
      const model = modelPointOf(event);
      if (model === undefined) return;
      commitDrag(drag.grip, snapFor(event)?.point ?? model);
    },
    [commitDrag, modelPointOf, snapFor],
  );

  const handleWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      const bounds = container.current?.getBoundingClientRect();
      if (bounds === undefined) return;
      dispatch({
        type: 'ZOOM',
        anchorPx: {
          x: event.clientX - bounds.left,
          y: event.clientY - bounds.top,
        },
        factor: event.deltaY < 0 ? 1.15 : 1 / 1.15,
      });
    },
    [dispatch],
  );

  const snapMarker =
    editor.activeSnap === undefined
      ? undefined
      : modelToScreen(editor.camera, editor.activeSnap.point);

  // The camera maps model millimetres onto the element, so the rendered SVG is
  // placed with a transform rather than re-rendered on every pan and zoom.
  const origin = modelToScreen(editor.camera, plan.view.viewport.min);
  const scale =
    editor.camera.pixelsPerMm *
    (plan.view.viewport.max.x - plan.view.viewport.min.x);

  return (
    <div
      ref={container}
      className={`plan-canvas tool-${editor.activeTool.toLowerCase()}`}
      role="application"
      aria-label="Plan du niveau"
      onPointerMove={handleMove}
      onPointerDown={handleDown}
      onPointerUp={handleUp}
      onPointerLeave={handleUp}
      onWheel={handleWheel}
    >
      {rendered.status === 'EMPTY' && (
        <div className="empty-state">
          <strong>Rien à afficher sur ce niveau</strong>
          <span>Tracez un mur ou activez d’autres calques.</span>
        </div>
      )}
      {rendered.status === 'ERROR' && (
        <div className="empty-state error" role="alert">
          <strong>Impossible d’afficher le plan</strong>
          <span>
            Le modèle est intact : seul son dessin a échoué. Les autres espaces
            de travail restent utilisables.
          </span>
          <pre className="crash-detail">{rendered.message}</pre>
        </div>
      )}
      {rendered.status === 'OK' && (
        <div
          className="plan-canvas-scene"
          style={{
            left: `${origin.x}px`,
            top: `${origin.y}px`,
            width: `${scale}px`,
          }}
          dangerouslySetInnerHTML={{ __html: rendered.markup }}
        />
      )}
      {grips.map((grip) => {
        const at = modelToScreen(editor.camera, grip.at);
        return (
          <button
            key={grip.id}
            type="button"
            className={`grip grip-${grip.kind.toLowerCase().replace('_', '-')}`}
            style={{ left: `${at.x}px`, top: `${at.y}px` }}
            aria-label={gripLabel(grip)}
            onPointerDown={(event) => handleGripDown(grip, event)}
            onPointerUp={handleGripUp}
          />
        );
      })}
      {snapMarker !== undefined && (
        <span
          className={`snap-marker snap-${editor.activeSnap!.kind.toLowerCase()}`}
          style={{ left: `${snapMarker.x}px`, top: `${snapMarker.y}px` }}
          aria-hidden="true"
        />
      )}
      {/*
        A continuous coordinate readout would flood a screen reader on every
        pointer move, so it is shown without being announced; the application
        status region carries the messages that matter.
      */}
      <p className="canvas-status" aria-live="off">
        {editor.cursorModel === undefined
          ? 'Déplacez le curseur sur le plan.'
          : `${Math.round(editor.cursorModel.x)} ; ${Math.round(editor.cursorModel.y)} mm`}
        {editor.activeSnap !== undefined &&
          ` · accroche ${editor.activeSnap.kind.toLowerCase()}`}
      </p>
    </div>
  );
}
