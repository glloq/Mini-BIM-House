import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Project } from '@house-technical-designer/core-domain';
import type { ProjectCommand } from '@house-technical-designer/editor-core';
import {
  ARCHITECTURAL_CLEAN_SCREEN,
  graphicProfileBundle,
  graphicProfileForStage,
  renderSemanticSceneToSvg,
  type ScenePrimitive,
} from '@house-technical-designer/drawing-engine';
import { findSnap, modelToScreen } from '@house-technical-designer/editor-core';
import type { Point2D, Segment2D } from '@house-technical-designer/geometry';
import type { AnalysisOverlay } from '@house-technical-designer/calculation-core';
import {
  clearancePrimitives,
  type ClearanceGroupId,
} from './clearance-overlay.js';
import {
  buildPlanView,
  overlayPrimitives,
  objectsInBox,
  pickCandidates,
  pickPrimitive,
  selectionBoxOf,
  previewWallFaces,
  type PlanViewResult,
} from '@house-technical-designer/view-query';
import type { EditorAction, EditorState } from './editor-state.js';
import { offsetAlongWall, type GeometryEdit, type Grip } from './grips.js';
import {
  editsFor,
  familyOf,
  gripsFor,
  inspectObject,
} from './object-editors.js';
import { selectableInStage } from '../ux/space-scope.js';
import { pickToleranceMm } from './pick-tolerance.js';
import { DynamicInput } from './DynamicInput.js';
import { ModelGrid } from './ModelGrid.js';
import { NorthDial } from './NorthDial.js';
import { UnderlayControl } from './UnderlayControl.js';
import { UnderlayImage } from './UnderlayImage.js';
import type { CreationStageId, PlanAid } from '../ux/creation-stages.js';
import { TemporaryDimensions } from './TemporaryDimensions.js';
import {
  areaLabel,
  measureLabel,
  roomLabels,
  roomMeasures,
} from './room-labels.js';
import { surfaceLabels, surfaceMeasureLabel } from './surface-labels.js';
import { runSlopes, slopeLabel } from './run-slopes.js';
import { TEMPORARY_EDIT_IDS } from './temporary-edits.js';
import { draftedMeasures } from './typed-values.js';
import {
  carriedGeometry,
  componentGhostOutline,
  footprintLabel,
} from './ghost-geometry.js';
import { chooseHost, projectEquipment } from './host-choice.js';
import {
  resolveDraftPoint,
  pointerModelPoint,
  requiredPoints,
} from './editor-state.js';
import {
  completionModeOf,
  drawsWalls,
  dynamicInputOf,
  isOpenEnded,
} from './tool-registry.js';
import {
  draftMeasureLabel,
  draftMeasures as draftMeasuresOf,
} from './draft-measures.js';

/**
 * La taille de la marque du premier sommet, en pixels.
 *
 * En pixels et non en millimètres : le premier sommet se cherche justement
 * quand on a dézoomé pour voir tout le contour, et une marque de trente
 * centimètres n'existe plus à cette échelle.
 */
const FIRST_VERTEX_MARK_PX = 5;

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
    case 'ROUTE_VERTEX':
      return `Déplacer le coude ${grip.vertexIndex} du tronçon ${grip.edgeId}`;
  }
}

/** How far the pointer travels before a click becomes a rubber band, in pixels. */
const BAND_THRESHOLD_PX = 4;

/**
 * L'écart entre le fantôme et la phrase qui l'accompagne, en pixels.
 *
 * En pixels comme la marque du premier sommet, et pour la même raison : une
 * prise fait huit centimètres, une baignoire un mètre soixante-dix, et un
 * écart en millimètres serait collé sur l'une et perdu au large de l'autre.
 */
const GHOST_LABEL_GAP_PX = 16;

/** Rien sous le curseur à annoncer : la valeur rendue quand il n'y a pas de fantôme. */
const NO_GHOST = { primitives: [] as readonly ScenePrimitive[] } as const;

export interface PlanCanvasProps {
  readonly project: Project;
  readonly editor: EditorState;
  readonly dispatch: (action: EditorAction) => void;
  readonly onCommitPoints: (
    points: readonly { x: number; y: number }[],
    /** What each click landed on, for a tool that acts on objects. */
    picks: readonly (string | undefined)[],
  ) => void;
  /**
   * Ends a run of points, which is not the same as placing one.
   *
   * A tool whose number of points nobody knows in advance is finished by the
   * user saying so; the fields on the drawing need the same way out as the
   * canvas has.
   */
  readonly onFinishRun?: () => void;
  /** Carries the whole selection, once a drag on it has been released. */
  readonly onMoveSelection?: (delta: { x: number; y: number }) => void;
  /** Applies an edit typed on the drawing itself. */
  readonly onCommand?: (command: ProjectCommand) => boolean;
  /**
   * Opens the actions of the object the pointer is on.
   *
   * What can be done to an object is decided where the commands live; the
   * canvas only says which object, and where in the window the pointer was.
   */
  readonly onObjectMenu?: (
    objectId: string,
    atPx: { readonly x: number; readonly y: number },
  ) => void;
  /**
   * The only family a click or a band may take, when one is asked for.
   *
   * Picking a room in a house where every room is covered by a slab, or a wall
   * under a dimension line, is a fight the drawing always wins. Nothing is
   * filtered unless the user asks: an editor quietly ignoring half the plan
   * would be one nobody could trust.
   */
  readonly selectableFamily?: string;
  readonly wallThicknessMm: number;
  /**
   * What a dragged handle asks of the model.
   *
   * The canvas knows where the handles are and where the pointer went; what
   * that means for the project is decided where the commands live.
   */
  readonly onEditGeometry?: (edit: GeometryEdit) => void;
  /**
   * The charter the drawing is drawn with.
   *
   * The canvas used to name one itself, so every drawing in the application
   * was the technical charter whatever it was being read for. A view receives
   * its charter; it does not choose it.
   */
  readonly graphicProfileId?: string;
  /** Analysis values projected onto the drawing, when one is selected. */
  readonly overlay?: AnalysisOverlay;
  /** Which groups of clearance zones the user has asked to see. */
  readonly clearanceGroups?: readonly ClearanceGroupId[];
  /**
   * Créer la pièce d'un contour fermé qui n'en porte pas.
   *
   * Le geste appartient à la coque, qui sait dispatcher une commande ; ce que
   * le canvas apporte est l'endroit — le contour qu'on désigne.
   */
  readonly onCreateRoom?: (at: Point2D) => void;
  /**
   * Ce que le plan montre en plus du dessin, dans cet espace-ci.
   *
   * Le nord ne se règle qu'où il veut dire quelque chose. Ailleurs, la rose
   * serait un cadran de plus à ignorer.
   */
  readonly aids?: readonly PlanAid[];
  /**
   * L'espace ouvert : il décide de ce qu'on a le droit de désigner ici.
   *
   * Sans lui, on prend la parcelle depuis l'onglet du bâtiment.
   */
  readonly stage: CreationStageId;
  /** Ce qu'il y a à dire quand une aide refuse : l'image trop lourde, par exemple. */
  readonly onMessage?: (message: string) => void;
  /**
   * La fiche que l'outil Composant est réglé à poser.
   *
   * La valeur **résolue** de l'option, pas les brouillons dont elle sort : le
   * canvas dessine, il n'arbitre pas ce qu'un formulaire a saisi. C'est déjà
   * la façon dont `wallThicknessMm` arrive ici — la coque lit l'option, le
   * canvas reçoit le nombre — et deux chemins pour une même question est ce
   * qui fait qu'un aperçu finit par montrer autre chose que ce qu'on pose.
   *
   * Sans elle, aucun fantôme : un objet dessiné aux dimensions de personne
   * dirait quelque chose que le projet ne soutient pas.
   */
  readonly componentDefinitionId?: string;
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
  onFinishRun,
  wallThicknessMm,
  onEditGeometry,
  onMoveSelection,
  onCommand,
  onCreateRoom,
  aids = [],
  stage,
  onMessage,
  onObjectMenu,
  selectableFamily,
  graphicProfileId,
  overlay,
  clearanceGroups = [],
  componentDefinitionId,
}: PlanCanvasProps) {
  /*
   * La charte, telle qu'elle se lit depuis l'espace ouvert.
   *
   * Deux décisions, et aucune n'est prise ici. Quelle charte : celle que la
   * vue nomme, ou celle avec laquelle on lit un plan de maison quand cette
   * version ne connaît pas la sienne — une charte absente n'est pas une raison
   * de ne rien dessiner. Comment elle se lit : le moteur graphique met en
   * avant ce que cet espace possède et laisse le reste en arrière, ce qui est
   * un changement de profil de rendu et non une couleur écrite dans un
   * composant.
   *
   * Mémorisée parce que tout le plan en dépend : une charte reconstruite à
   * chaque frappe redessinerait la maison à chaque frappe.
   */
  const charter = useMemo(
    () =>
      graphicProfileForStage(
        (graphicProfileId === undefined
          ? undefined
          : graphicProfileBundle(graphicProfileId)) ??
          ARCHITECTURAL_CLEAN_SCREEN,
        stage,
      ),
    [graphicProfileId, stage],
  );
  const container = useRef<HTMLDivElement>(null);
  const panOrigin = useRef<{ x: number; y: number } | undefined>(undefined);
  /** The handle being dragged, and where it started. */
  const dragging = useRef<
    { readonly grip: Grip; readonly from: { x: number; y: number } } | undefined
  >(undefined);
  /**
   * The selection being dragged, where it started and where it stands.
   *
   * The travelled distance is kept here as well as in the state: the state is
   * what the ghost is drawn from, and the reference is what the drop is
   * computed from. Reading the state on release would use the value of the
   * previous render, and drop the selection a frame behind the pointer.
   */
  const moving = useRef<
    | {
        readonly from: { x: number; y: number };
        /** Where the press happened on the screen, to tell a click from a drag. */
        readonly fromClient: { x: number; y: number };
        readonly objectId: string;
        readonly pointerType: string;
        delta: { readonly x: number; readonly y: number };
      }
    | undefined
  >(undefined);
  const [moveDelta, setMoveDelta] = useState<
    { readonly x: number; readonly y: number } | undefined
  >(undefined);
  /**
   * What the last click at this spot offered, and which one it took.
   *
   * A duct crossing a wall inside a room puts three objects under one pixel.
   * Clicking again at the same spot offers the next one rather than the same
   * one for ever.
   */
  const cycling = useRef<
    | {
        readonly atPx: { readonly x: number; readonly y: number };
        readonly objectIds: readonly string[];
        readonly index: number;
      }
    | undefined
  >(undefined);
  /** Where the pointer went down, while it is deciding between click and band. */
  const press = useRef<
    | {
        readonly clientX: number;
        readonly clientY: number;
        readonly model: { x: number; y: number };
        readonly additive: boolean;
        readonly pointerType: string;
      }
    | undefined
  >(undefined);

  /**
   * À qui appartient le prochain clic, quand ce n'est pas au dessin.
   *
   * Le panneau de l'image de fond a besoin de deux points du plan pour caler
   * un relevé, et il ne sait pas transformer un clic en millimètres — c'est la
   * surface qui sait. Elle prête donc son prochain clic à qui le demande : un
   * seul, consommé aussitôt, et le geste reprend son cours normal.
   *
   * Une référence et non un état : l'attente ne change rien à ce qui est
   * dessiné, et un rendu de plus à chaque demande ne servirait personne.
   */
  const lendPoint = useRef<((pointMm: Point2D) => void) | undefined>(undefined);

  /** The rubber band, drawn the way every other preview is. */
  const band = useMemo<readonly ScenePrimitive[]>(() => {
    if (editor.selectionBox === undefined) return [];
    const { box, mode } = selectionBoxOf(
      editor.selectionBox.from,
      editor.selectionBox.to,
    );
    return [
      {
        id: 'preview:selection-box',
        semanticRole: 'ANNOTATION' as const,
        geometry: {
          kind: 'POLYLINE' as const,
          polyline: {
            points: [
              box.min,
              { x: box.max.x, y: box.min.y },
              box.max,
              { x: box.min.x, y: box.max.y },
            ],
            closed: true,
          },
        },
        layer: 'annotation.dimensions',
        zIndex: 95,
        discipline: 'ARCHITECTURE' as const,
        state: 'GHOST' as const,
        metadata: { selectionMode: mode },
      },
    ];
  }, [editor.selectionBox]);

  const preview = useMemo<readonly ScenePrimitive[]>(() => {
    if (editor.pendingPoints.length === 0 || editor.cursorModel === undefined)
      return band;
    const origin = editor.pendingPoints[editor.pendingPoints.length - 1]!;
    const target = resolveDraftPoint({
      tool: editor.activeTool,
      pendingPoints: editor.pendingPoints,
      raw: editor.cursorModel,
      ...(editor.activeSnap === undefined
        ? {}
        : { snapped: editor.activeSnap.point }),
      snap: editor.snap,
      directInput: editor.directInput,
    });
    const footprint = drawsWalls(editor.activeTool)
      ? previewWallFaces([origin, target], wallThicknessMm)
      : undefined;
    const lengthMm = Math.round(
      Math.hypot(target.x - origin.x, target.y - origin.y),
    );
    const angleDeg =
      (Math.atan2(target.y - origin.y, target.x - origin.x) * 180) / Math.PI;
    // What the run has already taken, so a wall drawn corner by corner is a
    // shape being closed rather than a rubber band and a memory.
    const laid: readonly ScenePrimitive[] =
      editor.pendingPoints.length < 2
        ? []
        : [
            {
              id: 'preview:run',
              semanticRole: 'ANNOTATION',
              geometry: {
                kind: 'POLYLINE',
                polyline: { points: editor.pendingPoints, closed: false },
              },
              layer: 'annotation.dimensions',
              zIndex: 89,
              discipline: 'ARCHITECTURE',
              state: 'GHOST',
            },
          ];

    /*
     * Le premier sommet, reconnaissable, et ce que la surface mesure déjà.
     *
     * On traçait une parcelle sans savoir lequel des sommets refermait le
     * contour ni ce qu'elle faisait : les deux se découvraient une fois
     * l'objet créé. Le premier sommet porte donc une marque, l'arête de
     * fermeture est dessinée pendant qu'on trace, et l'aire s'écrit au centre.
     *
     * La marque est dimensionnée en pixels puis convertie en millimètres :
     * une taille en millimètres disparaîtrait au dézoom, et c'est au dézoom
     * qu'on cherche le premier sommet.
     */
    const closing = completionModeOf(editor.activeTool) === 'CLOSE_POLYGON';
    const first = editor.pendingPoints[0]!;
    const markMm = FIRST_VERTEX_MARK_PX / editor.camera.pixelsPerMm;
    const mark: readonly ScenePrimitive[] = closing
      ? [
          {
            id: 'preview:first-vertex',
            semanticRole: 'ANNOTATION' as const,
            geometry: {
              kind: 'POLYGON' as const,
              polygon: {
                outer: [
                  { x: first.x - markMm, y: first.y - markMm },
                  { x: first.x + markMm, y: first.y - markMm },
                  { x: first.x + markMm, y: first.y + markMm },
                  { x: first.x - markMm, y: first.y + markMm },
                ],
              },
            },
            layer: 'annotation.dimensions',
            zIndex: 93,
            discipline: 'ARCHITECTURE' as const,
            state: 'GHOST' as const,
          },
        ]
      : [];
    const ring = closing ? [...editor.pendingPoints, target] : [];
    const measured = closing
      ? draftMeasuresOf(ring, 'CLOSE_POLYGON')
      : undefined;
    const surface: readonly ScenePrimitive[] =
      closing && ring.length >= 3
        ? [
            {
              id: 'preview:closing-edge',
              semanticRole: 'ANNOTATION' as const,
              geometry: {
                kind: 'POLYLINE' as const,
                polyline: { points: [target, first], closed: false },
              },
              layer: 'annotation.dimensions',
              zIndex: 88,
              discipline: 'ARCHITECTURE' as const,
              state: 'GHOST' as const,
            },
            ...(measured === undefined
              ? []
              : [
                  {
                    id: 'preview:area',
                    semanticRole: 'ANNOTATION' as const,
                    geometry: {
                      kind: 'TEXT' as const,
                      anchor: {
                        x:
                          ring.reduce((sum, { x }) => sum + x, 0) / ring.length,
                        y:
                          ring.reduce((sum, { y }) => sum + y, 0) / ring.length,
                      },
                      text: draftMeasureLabel(measured),
                    },
                    layer: 'annotation.dimensions',
                    zIndex: 93,
                    discipline: 'ARCHITECTURE' as const,
                    state: 'GHOST' as const,
                  },
                ]),
          ]
        : [];
    return [
      ...band,
      ...laid,
      ...surface,
      ...mark,
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
  }, [band, editor, wallThicknessMm]);

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
        graphicProfileId: charter.profile.id,
      }),
    [
      project,
      editor.levelId,
      editor.layers,
      editor.selection,
      editor.hoveredId,
      preview,
      charter,
    ],
  );

  /**
   * The selection as it would be once dropped.
   *
   * A move nobody can see before releasing is a move made blind: the ghost is
   * the same primitives, carried by the distance travelled so far.
   */
  const ghost = useMemo<readonly ScenePrimitive[]>(() => {
    if (moveDelta === undefined) return [];
    return base.primitives
      .filter(
        (primitive) =>
          primitive.sourceObjectId !== undefined &&
          editor.selection.includes(primitive.sourceObjectId),
      )
      .map((primitive, index): ScenePrimitive => {
        // The very transformation the command applies, so the ghost and what
        // lands can never describe two different shapes.
        const geometry = carriedGeometry(primitive.geometry, moveDelta);
        return {
          ...primitive,
          id: `preview:move:${index}`,
          geometry,
          zIndex: 93,
          state: 'GHOST' as const,
        };
      });
  }, [base.primitives, editor.selection, moveDelta]);

  /**
   * L'objet qu'on s'apprête à poser, vu avant qu'on clique.
   *
   * L'outil Composant n'a qu'un clic — un lit, un frigo, un WC, une prise se
   * posent d'un geste — et l'aperçu du canvas ne se construisait qu'à partir
   * d'un point déjà posé. Il n'y avait donc, pour tout le mobilier et tous les
   * équipements, strictement rien à voir avant de cliquer : on posait, on
   * regardait, on annulait. Le refus arrivait par la même porte, en toutes
   * lettres, une fois le clic donné — « Ce modèle se fixe à : Mur » — alors
   * que c'est avant qu'il sert à quelque chose.
   *
   * Ce que le fantôme montre tient en trois choses, et aucune n'est décidée
   * ici :
   *
   * - **la taille**, telle que la fiche du projet la déclare ;
   * - **le support**, choisi par le même enchaînement que la commande, et
   *   redessiné en survol pour qu'on voie lequel des murs porte ;
   * - **le refus**, quand la fiche n'accepte rien de ce qu'il y a sous le
   *   curseur : le contour passe en erreur et la phrase dit sur quoi ce
   *   modèle se pose.
   *
   * Il est calculé sur `base` et non sur `plan`, parce que `plan` contient
   * déjà les aperçus — dont celui-ci — et qu'un fantôme qui se désignerait
   * lui-même comme support serait une boucle. La différence porte sur les
   * seules zones de dégagement, qui ne sont pas des supports sur lesquels on
   * pose.
   *
   * Dérivé et jamais gardé : il n'existe qu'entre deux mouvements de souris,
   * et rien de tout cela n'entre dans le fichier projet.
   */
  const componentGhost = useMemo((): {
    readonly primitives: readonly ScenePrimitive[];
    readonly sentence?: string;
  } => {
    if (editor.activeTool !== 'COMPONENT' || editor.cursorModel === undefined)
      return NO_GHOST;
    const fiche = projectEquipment(project, componentDefinitionId);
    if (fiche === undefined) return NO_GHOST;
    const level =
      editor.levelId === undefined
        ? project.building.levels[0]
        : project.building.levels.find(({ id }) => id === editor.levelId);
    if (level === undefined) return NO_GHOST;
    const at = editor.cursorModel;
    // Le même tirage que le clic donnera : ce que le canvas sait, c'est à
    // quelle distance on vise juste sur cet écran et à ce zoom-là.
    const picked = pickPrimitive(
      base.primitives,
      at,
      pickToleranceMm(editor.camera, 'mouse'),
    );
    const choice = chooseHost(level, at, picked?.objectId, fiche.allowedHosts);
    const outline = componentGhostOutline(
      at,
      fiche.dimensions,
      choice.wallAngleDeg ?? 0,
    );
    if (outline === undefined) return NO_GHOST;
    const size = footprintLabel(
      fiche.dimensions?.widthMm ?? 0,
      fiche.dimensions?.depthMm ?? 0,
    );
    const sentence = `${size} · ${choice.sentence}`;
    /*
     * Le support, repassé par-dessus pour qu'on le distingue.
     *
     * Ce sont les traits du plan eux-mêmes, réémis en survol : le mur porteur
     * se reconnaît donc à la charte du dessin et non à une couleur écrite
     * dans ce composant. Le lien vers l'objet source est coupé exprès — une
     * copie qui le garderait serait désignable, et le clic prendrait la copie
     * dessinée au-dessus au lieu du mur qu'elle recouvre.
     */
    const carried =
      choice.hostObjectId === undefined
        ? []
        : base.primitives
            .filter(
              ({ sourceObjectId }) => sourceObjectId === choice.hostObjectId,
            )
            .map((primitive, index): ScenePrimitive => {
              const { sourceObjectId: _unused, ...rest } = primitive;
              return {
                ...rest,
                id: `preview:component-host:${index}`,
                zIndex: 94,
                state: 'HOVER' as const,
              };
            });
    const gapMm = GHOST_LABEL_GAP_PX / editor.camera.pixelsPerMm;
    return {
      sentence,
      primitives: [
        ...carried,
        {
          id: 'preview:component',
          semanticRole: 'ANNOTATION' as const,
          geometry: { kind: 'POLYGON' as const, polygon: outline },
          layer: 'components.placed',
          zIndex: 95,
          discipline: 'ARCHITECTURE' as const,
          // Un refus doit se voir, et se voir là où l'on regarde. L'état
          // d'erreur est celui que la charte réserve à ce qui ne va pas ;
          // c'est elle qui décide à quoi cela ressemble.
          state: choice.accepted ? ('GHOST' as const) : ('ERROR' as const),
        },
        {
          id: 'preview:component-label',
          semanticRole: 'ANNOTATION' as const,
          geometry: {
            kind: 'TEXT' as const,
            anchor: {
              x: at.x,
              y: Math.min(...outline.outer.map(({ y }) => y)) - gapMm,
            },
            text: sentence,
          },
          layer: 'annotation.dimensions',
          zIndex: 96,
          discipline: 'ARCHITECTURE' as const,
          state: choice.accepted ? ('GHOST' as const) : ('ERROR' as const),
        },
      ],
    };
  }, [
    base.primitives,
    componentDefinitionId,
    editor.activeTool,
    editor.camera,
    editor.cursorModel,
    editor.levelId,
    project,
  ]);

  /**
   * The room the placed machines need around them.
   *
   * Worked out here and never stored: the zones are the catalogue entry and
   * the placement seen together, and a stored copy stops agreeing the moment
   * anything moves.
   */
  const clearances = useMemo<readonly ScenePrimitive[]>(
    () =>
      clearancePrimitives(project, {
        ...(editor.levelId === undefined ? {} : { levelId: editor.levelId }),
        groups: clearanceGroups,
      }),
    [project, editor.levelId, clearanceGroups],
  );

  const plan: PlanViewResult = useMemo(() => {
    if (
      overlay === undefined &&
      ghost.length === 0 &&
      clearances.length === 0 &&
      componentGhost.primitives.length === 0
    )
      return base;
    return buildPlanView(project, {
      ...(editor.levelId === undefined ? {} : { levelId: editor.levelId }),
      layers: {
        ...editor.layers,
        'analysis.overlay': true,
        'analysis.clearances': clearances.length > 0,
      },
      selection: editor.selection,
      ...(editor.hoveredId === undefined
        ? {}
        : { hoveredId: editor.hoveredId }),
      extraPrimitives: [
        ...preview,
        ...ghost,
        ...componentGhost.primitives,
        ...clearances,
        ...(overlay === undefined
          ? []
          : overlayPrimitives(base.primitives, overlay)),
      ],
      graphicProfileId: charter.profile.id,
    });
  }, [
    base,
    ghost,
    componentGhost,
    clearances,
    overlay,
    project,
    editor.levelId,
    editor.layers,
    editor.selection,
    editor.hoveredId,
    preview,
    charter,
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
        charter.profile,
        charter.styles,
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
  }, [plan, charter]);

  const segments = useMemo(
    () => snapSegments(project, editor.levelId),
    [project, editor.levelId],
  );

  /*
   * Ce que chaque contour fermé porte, écrit dessus.
   *
   * La surface était dans l'inspecteur, à une sélection de là ; un contour
   * fermé sans pièce ne disait rien du tout. C'est pourtant à ce moment-là
   * qu'on se demande si les murs qu'on vient de fermer sont reconnus, et le
   * plan est l'endroit où poser la question.
   *
   * `Aucune` les éteint : quelqu'un qui veut un dessin nu doit pouvoir
   * l'avoir.
   */
  const labels = useMemo(
    () =>
      editor.dimensionMode === 'NONE'
        ? []
        : roomLabels(project, editor.levelId),
    [editor.dimensionMode, editor.levelId, project],
  );

  /*
   * Ce qu'on a **tracé**, par opposition à ce que les murs enferment.
   *
   * Deux questions, deux dessins : « cette pièce fait combien » et « qu'est-ce
   * que je viens de fermer ». La seconde n'avait aucune réponse sur le plan —
   * une parcelle finie était un trait pointillé pâle et rien d'autre.
   *
   * L'espace ouvert en fait partie : l'aire de la parcelle se lit au Terrain,
   * pas en travers du plan du bâtiment. C'est `surface-labels.ts` qui tranche,
   * ici on lui dit d'où on regarde.
   *
   * `Aucune` les éteint aussi : un dessin nu est un dessin nu.
   */
  const surfaces = useMemo(
    () =>
      editor.dimensionMode === 'NONE'
        ? []
        : surfaceLabels(project, editor.levelId, editor.selection, { stage }),
    [editor.dimensionMode, editor.levelId, editor.selection, project, stage],
  );

  /*
   * Les cotes qu'un plan porte sans qu'on les pose.
   *
   * Prises sur ce que les murs enferment — à l'intérieur, comme un plan
   * d'architecte les porte. Elles ne remplacent pas la cotation : une pièce en
   * L n'a ni largeur ni profondeur, et ces deux traits en donnent une lecture
   * rectangulaire. L'outil Cotation reste là pour dire ce qu'on veut dire.
   */
  /*
   * La pente d'une évacuation, écrite sur elle.
   *
   * Une évacuation horizontale est une évacuation qui ne s'écoule pas, et
   * rien ne le disait sur le plan : il fallait sélectionner le tronçon et
   * lire une propriété, alors que c'est en le traçant qu'on veut le savoir.
   */
  const slopes = useMemo(
    () =>
      editor.dimensionMode === 'NONE'
        ? []
        : runSlopes(
            project,
            editor.dimensionMode === 'SELECTION'
              ? { selection: editor.selection }
              : {},
          ),
    [editor.dimensionMode, editor.selection, project],
  );

  const measures = useMemo(
    () =>
      roomMeasures(project, editor.levelId, {
        mode: editor.dimensionMode,
        selection: editor.selection,
      }),
    [editor.dimensionMode, editor.levelId, editor.selection, project],
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
      if (editor.activeTool !== 'SELECT') return;
      const carried = moving.current;
      if (carried !== undefined) {
        // The snap of this very event, not the one the last render carried.
        const target = snap?.point ?? model;
        const delta = {
          x: target.x - carried.from.x,
          y: target.y - carried.from.y,
        };
        carried.delta = delta;
        setMoveDelta(delta);
        return;
      }
      const pressed = press.current;
      if (pressed !== undefined) {
        const travelled = Math.hypot(
          event.clientX - pressed.clientX,
          event.clientY - pressed.clientY,
        );
        // Past a few pixels the gesture is a band and not a click; below it,
        // the pointer is only shaking.
        if (travelled > BAND_THRESHOLD_PX)
          dispatch({
            type: 'SET_SELECTION_BOX',
            from: pressed.model,
            to: model,
          });
        return;
      }
      const picked = pickPrimitive(
        plan.primitives,
        model,
        pickToleranceMm(editor.camera, event.pointerType),
      );
      dispatch({
        type: 'HOVER',
        ...(picked === undefined ? {} : { objectId: picked.objectId }),
      });
    },
    [
      dispatch,
      editor.activeTool,
      editor.camera,
      modelPointOf,
      plan.primitives,
      snapFor,
    ],
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
      // Un point promis à l'image de fond : ce clic est pour elle et pour elle
      // seule — il ne sélectionne rien, ne pose aucun sommet, et la promesse
      // est tenue une fois puis oubliée. Le point est celui du curseur et non
      // celui de l'accroche : une calibration accrochée à la grille se
      // trouverait recalée au carreau le plus proche sans que personne le voie.
      const lent = lendPoint.current;
      if (lent !== undefined) {
        lendPoint.current = undefined;
        lent(model);
        return;
      }
      if (editor.activeTool === 'SELECT') {
        const under = pickPrimitive(
          plan.primitives,
          model,
          pickToleranceMm(editor.camera, event.pointerType),
        );
        // Pressing on something already selected carries it: that is what a
        // drag means everywhere else, and it is how a selection is moved.
        if (
          onMoveSelection !== undefined &&
          under !== undefined &&
          editor.selection.includes(under.objectId)
        ) {
          moving.current = {
            from: model,
            fromClient: { x: event.clientX, y: event.clientY },
            objectId: under.objectId,
            pointerType: event.pointerType,
            delta: { x: 0, y: 0 },
          };
          event.currentTarget.setPointerCapture(event.pointerId);
          return;
        }
        // What this press means is not known yet: released where it started it
        // is a click on one object, dragged it is a band over several. The
        // decision is taken when the pointer comes back up.
        press.current = {
          clientX: event.clientX,
          clientY: event.clientY,
          model,
          additive: event.ctrlKey || event.metaKey,
          pointerType: event.pointerType,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
        return;
      }
      /*
       * Recliquer le premier sommet referme la surface.
       *
       * C'était le geste que tout le monde essayait, et il posait un sommet de
       * plus au même endroit : un contour à cinq sommets dont deux confondus.
       * Il fallait connaître « Ctrl+Entrée » pour finir ce qu'on avait
       * commencé à la souris.
       */
      if (
        completionModeOf(editor.activeTool) === 'CLOSE_POLYGON' &&
        editor.pendingPoints.length >= requiredPoints(editor.activeTool) &&
        onFinishRun !== undefined
      ) {
        const first = editor.pendingPoints[0]!;
        const reach = pickToleranceMm(editor.camera, event.pointerType);
        if (Math.hypot(model.x - first.x, model.y - first.y) <= reach) {
          onFinishRun();
          return;
        }
      }
      const snapped = snapFor(event)?.point;
      const point = resolveDraftPoint({
        tool: editor.activeTool,
        pendingPoints: editor.pendingPoints,
        raw: model,
        ...(snapped === undefined ? {} : { snapped }),
        snap: editor.snap,
        directInput: editor.directInput,
      });
      const points = [...editor.pendingPoints, point];
      // The click is reported with what it landed on: the canvas is what knows
      // how close is close enough on this screen at this zoom.
      const picked = pickPrimitive(
        plan.primitives,
        model,
        pickToleranceMm(editor.camera, event.pointerType),
      );
      const picks = [...editor.pendingPicks, picked?.objectId];
      dispatch({
        type: 'COMMIT_POINT',
        point,
        ...(picked === undefined ? {} : { objectId: picked.objectId }),
      });
      // Each tool declares how many points it needs; the canvas does not keep
      // its own list of which ones are single-click. A tool that draws until
      // the user says stop has no count to reach: it is the run being ended
      // that commits it, never a click.
      if (isOpenEnded(editor.activeTool)) return;
      if (points.length < requiredPoints(editor.activeTool)) return;
      onCommitPoints(points, picks);
    },
    [
      dispatch,
      editor,
      modelPointOf,
      onCommitPoints,
      onFinishRun,
      onMoveSelection,
      plan.primitives,
      snapFor,
    ],
  );

  /**
   * Si l'on a le droit de prendre cet objet ici.
   *
   * Deux filtres, et deux raisons différentes :
   *
   * - **l'espace** : on pouvait prendre la parcelle depuis l'onglet du
   *   bâtiment et les murs depuis celui de l'aménagement. Un clic un peu
   *   large, et l'on déplaçait la limite du terrain en croyant bouger une
   *   cloison. Un espace filtre ce qu'il propose ; il filtre aussi ce qu'il
   *   prend, sans quoi la séparation des parties n'est qu'une façade.
   * - **la famille**, que la Sélection propose de restreindre : c'est un
   *   réglage, celui qu'on met quand deux objets se superposent.
   */
  const selectable = useCallback(
    (objectId: string): boolean => {
      const kind = inspectObject(project, objectId).kind;
      if (kind !== 'UNKNOWN' && !selectableInStage(stage, kind)) return false;
      return (
        selectableFamily === undefined ||
        selectableFamily === 'ALL' ||
        familyOf(project, objectId)?.id === selectableFamily
      );
    },
    [project, selectableFamily, stage],
  );

  /**
   * Takes what a click at this point means.
   *
   * Clicking the same spot again offers the next object under it rather than
   * the same one for ever, whether that spot held nothing selected or the
   * object the previous click had already taken.
   */
  const selectAt = useCallback(
    (
      atPx: { readonly x: number; readonly y: number },
      model: { readonly x: number; readonly y: number },
      pointerType: string,
      additive: boolean,
    ) => {
      const candidates = pickCandidates(
        plan.primitives,
        model,
        pickToleranceMm(editor.camera, pointerType),
      )
        .map(({ objectId }) => objectId)
        .filter(selectable);
      const previous = cycling.current;
      const sameSpot =
        previous !== undefined &&
        Math.hypot(atPx.x - previous.atPx.x, atPx.y - previous.atPx.y) <=
          BAND_THRESHOLD_PX &&
        previous.objectIds.join(',') === candidates.join(',');
      const index = sameSpot ? (previous.index + 1) % candidates.length : 0;
      const chosen = candidates[index];
      cycling.current =
        chosen === undefined
          ? undefined
          : { atPx, objectIds: candidates, index };
      dispatch({
        type: 'SELECT',
        ...(chosen === undefined ? {} : { objectId: chosen }),
        additive,
      });
    },
    [dispatch, editor.camera, plan.primitives, selectable],
  );

  const handleUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.currentTarget.hasPointerCapture(event.pointerId))
        event.currentTarget.releasePointerCapture(event.pointerId);
      if (panOrigin.current !== undefined) {
        panOrigin.current = undefined;
        return;
      }
      const carried = moving.current;
      moving.current = undefined;
      if (carried !== undefined) {
        setMoveDelta(undefined);
        const travelled = Math.hypot(
          event.clientX - carried.fromClient.x,
          event.clientY - carried.fromClient.y,
        );
        // Pressing a selected object without travelling is a click on it, not
        // a move of nothing: it selects that one object. Deciding by the
        // distance in millimetres instead would let the snap of the release
        // invent a displacement nobody asked for.
        if (travelled <= BAND_THRESHOLD_PX) {
          selectAt(
            carried.fromClient,
            carried.from,
            carried.pointerType,
            false,
          );
          return;
        }
        // Where the pointer actually is now, snapped, rather than where the
        // last render believed it was.
        const dropped = modelPointOf(event);
        const target = snapFor(event)?.point ?? dropped;
        const delta =
          target === undefined
            ? carried.delta
            : { x: target.x - carried.from.x, y: target.y - carried.from.y };
        if (delta.x !== 0 || delta.y !== 0) onMoveSelection?.(delta);
        return;
      }
      const pressed = press.current;
      press.current = undefined;
      if (pressed === undefined) return;
      const model = modelPointOf(event) ?? pressed.model;
      if (editor.selectionBox !== undefined) {
        const { box, mode } = selectionBoxOf(pressed.model, model);
        dispatch({ type: 'CLEAR_SELECTION_BOX' });
        dispatch({
          type: 'SELECT_MANY',
          objectIds: objectsInBox(plan.primitives, box, mode).filter(
            selectable,
          ),
          additive: pressed.additive,
        });
        return;
      }
      selectAt(
        { x: pressed.clientX, y: pressed.clientY },
        pressed.model,
        pressed.pointerType,
        pressed.additive,
      );
    },
    [
      dispatch,
      editor.selectionBox,
      modelPointOf,
      onMoveSelection,
      plan.primitives,
      selectAt,
      selectable,
      snapFor,
    ],
  );

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
          return;
        case 'ROUTE_VERTEX':
          onEditGeometry({
            kind: 'ROUTE_VERTEX',
            networkId: grip.networkId,
            edgeId: grip.edgeId,
            vertexIndex: grip.vertexIndex,
            to,
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

  /**
   * Where the fields that say how long and how steep should sit.
   *
   * They follow the point being drafted, which is what the user is watching;
   * they appear only while something is being drawn, so they never sit over an
   * empty plan.
   */
  const drafting = editor.pendingPoints[editor.pendingPoints.length - 1];
  const accepts = dynamicInputOf(editor.activeTool);
  const draftTarget =
    drafting === undefined ||
    editor.cursorModel === undefined ||
    accepts === undefined
      ? undefined
      : resolveDraftPoint({
          tool: editor.activeTool,
          pendingPoints: editor.pendingPoints,
          raw: editor.cursorModel,
          ...(editor.activeSnap === undefined
            ? {}
            : { snapped: editor.activeSnap.point }),
          snap: editor.snap,
          directInput: editor.directInput,
        });
  const draftMeasures =
    drafting === undefined || draftTarget === undefined
      ? undefined
      : draftedMeasures(drafting, draftTarget);
  const draftAtPx =
    draftTarget === undefined
      ? undefined
      : modelToScreen(editor.camera, draftTarget);

  /**
   * The measurements written on the drawing, for the object selected.
   *
   * They are the inspector's own edits, placed where they are measured: the
   * command, its validation and its place in the history are the same.
   */
  const temporary = useMemo(() => {
    if (onCommand === undefined || editor.selection.length !== 1)
      return undefined;
    const objectId = editor.selection[0]!;
    const shown = editsFor(project, objectId).filter((edit) =>
      TEMPORARY_EDIT_IDS.includes(edit.id),
    );
    if (shown.length === 0) return undefined;
    const anchor =
      grips.find(({ kind }) => kind === 'WALL_BODY') ??
      grips.find(({ kind }) => kind === 'OPENING') ??
      grips[0];
    if (anchor === undefined) return undefined;
    return { edits: shown, atPx: modelToScreen(editor.camera, anchor.at) };
  }, [editor.camera, editor.selection, grips, onCommand, project]);

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
      onContextMenu={(event) => {
        if (onObjectMenu === undefined) return;
        const model = modelPointOf(event);
        if (model === undefined) return;
        // A context menu comes from a mouse or from a long press the browser
        // reports as one; the coarse tolerance is the safe reading of both.
        const picked = pickPrimitive(
          plan.primitives,
          model,
          pickToleranceMm(editor.camera, 'touch'),
        );
        if (picked === undefined || !selectable(picked.objectId)) return;
        // Only when there is something to act on: a menu over an empty plan
        // would take the browser's own away for nothing.
        event.preventDefault();
        if (!editor.selection.includes(picked.objectId))
          dispatch({ type: 'SELECT', objectId: picked.objectId });
        onObjectMenu(picked.objectId, { x: event.clientX, y: event.clientY });
      }}
      onPointerUp={handleUp}
      onPointerLeave={handleUp}
      onWheel={handleWheel}
    >
      {/*
        La grille, en premier et derrière tout.
        Elle était un `background-image` CSS de 24 pixels collé au cadre : elle
        ne suivait ni le déplacement ni le zoom, et ses carreaux ne mesuraient
        aucune longueur. Celle-ci est dans le repère du modèle.
      */}
      <ModelGrid camera={editor.camera} />
      {/* Le calque de papier, entre la grille et le dessin : on trace
          par-dessus ce qu'on a, et on ne le désigne jamais. */}
      {project.site.underlay !== undefined && (
        <UnderlayImage
          camera={editor.camera}
          underlay={project.site.underlay}
        />
      )}
      {temporary !== undefined && (
        <TemporaryDimensions
          edits={temporary.edits}
          atPx={temporary.atPx}
          framePx={{
            width: editor.camera.viewportWidthPx,
            height: editor.camera.viewportHeightPx,
          }}
          onApply={(edit, value) => {
            const command = edit.apply(value);
            if (command !== undefined) onCommand?.(command);
          }}
        />
      )}

      {draftMeasures !== undefined &&
        draftAtPx !== undefined &&
        accepts !== undefined && (
          <DynamicInput
            atPx={draftAtPx}
            lengthMm={draftMeasures.lengthMm}
            angleDeg={draftMeasures.angleDeg}
            {...(editor.directInput.lengthMm === undefined
              ? {}
              : { lockedLengthMm: editor.directInput.lengthMm })}
            {...(editor.directInput.angleDeg === undefined
              ? {}
              : { lockedAngleDeg: editor.directInput.angleDeg })}
            accepts={accepts}
            onChange={(input) => dispatch({ type: 'SET_DIRECT_INPUT', input })}
            onCommit={() => {
              // Enter places the point the fields describe, exactly as clicking
              // there would — and, exactly as clicking there would, it does not
              // end a run whose number of corners nobody has decided yet.
              const points = [...editor.pendingPoints, draftTarget!];
              dispatch({ type: 'COMMIT_POINT', point: draftTarget! });
              if (isOpenEnded(editor.activeTool)) return;
              if (points.length >= requiredPoints(editor.activeTool))
                onCommitPoints(points, [...editor.pendingPicks, undefined]);
            }}
            {...(isOpenEnded(editor.activeTool) && onFinishRun !== undefined
              ? { onFinish: onFinishRun }
              : {})}
            {...(completionModeOf(editor.activeTool) === undefined
              ? {}
              : { completion: completionModeOf(editor.activeTool)! })}
            {...(editor.pendingPoints.length === 0
              ? {}
              : { onUndoPoint: () => dispatch({ type: 'UNDO_POINT' }) })}
            onCancel={() => dispatch({ type: 'CANCEL' })}
          />
        )}

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
      {slopes.map((slope) => {
        const at = modelToScreen(editor.camera, slope.at);
        return (
          <span
            key={slope.id}
            className={slope.tooFlat ? 'run-slope run-slope-flat' : 'run-slope'}
            style={{ left: `${at.x}px`, top: `${at.y}px` }}
            title={
              slope.tooFlat
                ? 'Une évacuation horizontale est une évacuation qui ne s’écoule pas.'
                : undefined
            }
          >
            {slopeLabel(slope.slopePercent)}
          </span>
        );
      })}
      {measures.map((measure) => {
        const from = modelToScreen(editor.camera, measure.from);
        const to = modelToScreen(editor.camera, measure.to);
        return (
          <span
            key={measure.id}
            className={`room-measure room-measure-${measure.axis.toLowerCase()}`}
            style={{
              left: `${Math.min(from.x, to.x)}px`,
              top: `${Math.min(from.y, to.y)}px`,
              ...(measure.axis === 'X'
                ? { width: `${Math.abs(to.x - from.x)}px` }
                : { height: `${Math.abs(to.y - from.y)}px` }),
            }}
          >
            <span className="room-measure-value">
              {measureLabel(measure.lengthMm)}
            </span>
          </span>
        );
      })}
      {/*
        Ce qu'on a tracé, écrit dessus.
        Une parcelle fermée ne montrait qu'un trait pâle : l'écran redevenait
        blanc au moment même où l'objet venait d'exister. Le terrain se lit
        toujours ; les dalles, toitures et trémies quand on les désigne, parce
        qu'une maison en superpose plusieurs.
      */}
      {surfaces.map((surface) => {
        const at = modelToScreen(editor.camera, surface.at);
        return (
          <span
            key={`surface:${surface.objectId}`}
            className={
              surface.selected ? 'surface-label selected' : 'surface-label'
            }
            style={{ left: `${at.x}px`, top: `${at.y}px` }}
          >
            {surfaceMeasureLabel(surface)}
          </span>
        );
      })}
      {labels.map((label) => {
        const at = modelToScreen(editor.camera, label.at);
        return (
          <div
            key={label.id}
            className={
              label.spaceId === undefined
                ? 'room-label room-label-free'
                : 'room-label'
            }
            style={{ left: `${at.x}px`, top: `${at.y}px` }}
          >
            {label.name !== undefined && (
              <span className="room-label-name">{label.name}</span>
            )}
            <span className="room-label-area">{areaLabel(label.areaM2)}</span>
            {/*
             * Un contour fermé sans pièce porte le geste qui la crée, là où il
             * se pose. Aller le chercher dans une barre d'outils pour désigner
             * ensuite un endroit qu'on est déjà en train de regarder est un
             * détour que rien ne justifie.
             */}
            {label.spaceId === undefined && onCreateRoom !== undefined && (
              <button
                type="button"
                className="room-label-add"
                onClick={() => onCreateRoom(label.at)}
              >
                + Créer pièce
              </button>
            )}
          </div>
        );
      })}
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
      {/* La rose des vents, contre le dessin : on choisit une orientation en
          regardant la parcelle, pas dans un champ d'un autre écran. */}
      {/* Poser un relevé sous le dessin : on le cale en regardant le plan,
          jamais dans un formulaire d'un autre écran. */}
      {aids.includes('UNDERLAY') && onCommand !== undefined && (
        <UnderlayControl
          project={project}
          onCommand={(command) => onCommand(command)}
          onMessage={(message) => onMessage?.(message)}
          originMm={editor.camera.centerModelMm}
          onRequestPoint={(receive) => {
            lendPoint.current = receive;
            return () => {
              if (lendPoint.current === receive) lendPoint.current = undefined;
            };
          }}
        />
      )}
      {aids.includes('NORTH') && onCommand !== undefined && (
        <NorthDial
          project={project}
          onCommand={(command) => onCommand(command)}
        />
      )}
      <p className="canvas-status" aria-live="off">
        {editor.cursorModel === undefined
          ? 'Déplacez le curseur sur le plan.'
          : `${Math.round(editor.cursorModel.x)} ; ${Math.round(editor.cursorModel.y)} mm`}
        {editor.activeSnap !== undefined &&
          ` · accroche ${editor.activeSnap.kind.toLowerCase()}`}
        {/* Ce que le fantôme dit, écrit aussi en toutes lettres.
            Un contour rouge sous le curseur dit qu'on refuse ; il ne dit pas
            sur quoi ce modèle se pose, et c'est cette phrase-là qu'on relit.
            La sortie de l'outil y est nommée parce qu'un objet qui suit la
            souris sans qu'on sache l'arrêter est un objet qu'on subit. */}
        {componentGhost.sentence !== undefined &&
          ` · ${componentGhost.sentence} · clic pose, Échap annule`}
        {/* The two directions of a band ask two different questions, and the
            rectangle alone does not say which one is being asked. */}
        {editor.selectionBox !== undefined &&
          (selectionBoxOf(editor.selectionBox.from, editor.selectionBox.to)
            .mode === 'WINDOW'
            ? ' · fenêtre : objets entièrement compris'
            : ' · capture : objets touchés')}
        {/* A run has no number of points known in advance, so the way out of
            it has to be written somewhere the user is already looking. */}
        {isOpenEnded(editor.activeTool) &&
          editor.pendingPoints.length > 0 &&
          ` · ${editor.pendingPoints.length} point(s) · ${
            completionModeOf(editor.activeTool) === 'CLOSE_POLYGON'
              ? 'Entrée ferme la surface'
              : 'Entrée termine'
          }, Échap annule`}
      </p>
    </div>
  );
}
