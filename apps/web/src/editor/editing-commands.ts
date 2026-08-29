import type {
  ComponentCategory,
  ComponentInstance,
  Dimension,
  DimensionType,
  Level,
  SiteObstacleKind,
  StairType,
  StructuralMemberKind,
  Opening,
  Project,
  ProjectFile,
  Roof,
  RoofPlane,
  Slab,
  Space,
  Stair,
  StructuralMember,
  Wall,
  WallOpening,
} from '@house-technical-designer/core-domain';
import {
  dimensionId,
  entityId,
  allRoofPlanes,
  isWallOpening,
  roofPlaneFrame,
} from '@house-technical-designer/core-domain';
import {
  AddComponentCommand,
  AddDimensionCommand,
  AddOpeningCommand,
  AddRoofCommand,
  AddRoofOpeningCommand,
  AddRoofStructureCommand,
  AddSlabCommand,
  AddSiteObstacleCommand,
  AddSpaceCommand,
  AddStairCommand,
  AddTextNoteCommand,
  AddStructuralMemberCommand,
  AddWallCommand,
  MoveNetworkEdgeVertexCommand,
  MoveWallCommand,
  MoveWallPointCommand,
  ProjectEditorCommand,
  ProjectCommandDispatcher,
  ProjectTransactionCommand,
  ReplaceProjectCommand,
  type DetectedRoom,
  SetParcelBoundaryCommand,
  SetWallPathCommand,
  SplitWallCommand,
  UpdateOpeningCommand,
  UpdateSlabCommand,
  createOpeningInsertionCommand,
  detectRooms,
  withInsertedVertex,
  withMovedVertex,
  withoutVertex,
  type ProjectCommand,
} from '@house-technical-designer/editor-core';
import { chooseHost, type HostChoice } from './host-choice.js';
import { polygonSurface } from './polygon-surface.js';
import {
  crownFootprint,
  outlineRefusal,
  ribbonFootprint,
} from './site-footprints.js';
import type { Point2D, Polygon2D } from '@house-technical-designer/geometry';
import { polygonContains } from '@house-technical-designer/geometry';
import type { GeometryEdit } from './grips.js';
import {
  OBJECT_EDITORS,
  capabilitiesOf,
  removalCommandFor,
  transformCommandsFor,
} from './object-editors.js';
import {
  transformPoint,
  transformedAzimuthDeg,
  translatedPolygon,
  type PlanTransform,
} from './object-transform.js';

// Moving, turning and reflecting are one map from a point to a point, and the
// families answer them all at once; what the rest of the application imports
// from here keeps working.
export {
  transformPoint,
  transformedAzimuthDeg,
  translatedPolygon,
  type PlanTransform,
};

/** How far from a wall axis an opening may be dropped, in millimetres. */
const MAXIMUM_HOST_DISTANCE_MM = 600;

/** How far from a wall endpoint a dimension click may land, in millimetres. */
const MAXIMUM_ENDPOINT_DISTANCE_MM = 1200;

export interface WallToolDraft {
  readonly assemblyId: string;
  readonly role: Wall['role'];
  /**
   * Quelle face le tracé représente.
   *
   * Le modèle la porte depuis toujours et l'inspecteur la modifie ; les outils
   * de tracé ne l'offraient pas, si bien qu'on dessinait à l'axe et qu'on
   * corrigeait après — l'inverse de la façon dont on lit un plan
   * d'architecte, où les cotes sont intérieures. Absente, c'est l'axe, comme
   * avant.
   *
   * Gauche et droite sont **relatives au sens du tracé**, et c'est le mot du
   * modèle : lequel des deux côtés est l'intérieur n'appartient pas à un mur,
   * il appartient à l'enceinte.
   */
  readonly referenceSide?: Wall['referenceSide'];
}

export interface OpeningToolDraft {
  readonly openingType: 'DOOR' | 'WINDOW';
  readonly widthMm: number;
  readonly heightMm: number;
  readonly sillHeightMm: number;
}

function levelOf(project: Project, levelId: string | undefined) {
  return levelId === undefined
    ? project.building.levels[0]
    : project.building.levels.find(({ id }) => id === levelId);
}

export type EditingCommandResult =
  | { readonly status: 'OK'; readonly command: ProjectCommand }
  | { readonly status: 'ERROR'; readonly message: string };

/** Builds the command that adds a wall between two drafted points. */
export function addWallCommand(
  file: ProjectFile,
  levelId: string | undefined,
  points: readonly Point2D[],
  draft: WallToolDraft,
  wallId: string,
): EditingCommandResult {
  const level = levelOf(file.project, levelId);
  if (level === undefined)
    return { status: 'ERROR', message: 'Le projet ne contient aucun niveau.' };
  if (points.length < 2)
    return { status: 'ERROR', message: 'Un mur demande deux points.' };
  const assembly = (file.project.assemblies ?? []).find(
    ({ id }) => id === draft.assemblyId,
  );
  if (assembly === undefined)
    return {
      status: 'ERROR',
      message: `Assemblage inconnu : ${draft.assemblyId || 'aucun'}.`,
    };
  const wall: Wall = {
    id: entityId<'Wall'>(wallId),
    type: 'WALL',
    levelId: level.id,
    path: { points: [points[0]!, points[points.length - 1]!] },
    referenceSide: draft.referenceSide ?? 'CENTER',
    assemblyId: assembly.id,
    baseOffsetMm: 0,
    heightMode: 'EXPLICIT',
    heightMm: level.defaultStoreyHeightMm,
    role: draft.role,
  };
  return {
    status: 'OK',
    command: new ProjectEditorCommand(
      `add-wall:${wall.id}`,
      'Ajouter un mur',
      level.id,
      new AddWallCommand(`add-wall:${wall.id}`, wall),
    ),
  };
}

/**
 * Builds the walls a run of points describes.
 *
 * A house is drawn as a run — corner, corner, corner — and not as a series of
 * unrelated pairs of clicks. Two readings of the same run are both legitimate
 * and neither is guessable: a wall per side, which can then take its own
 * assembly and its own openings; or one polyline wall, which stays one thing
 * when it is moved. The user says which.
 */
export function addWallRunCommand(
  file: ProjectFile,
  levelId: string | undefined,
  points: readonly Point2D[],
  draft: WallToolDraft,
  options: {
    readonly asOneWall: boolean;
    readonly closed: boolean;
    readonly newId: (prefix: string) => string;
  },
): EditingCommandResult {
  const level = levelOf(file.project, levelId);
  if (level === undefined)
    return { status: 'ERROR', message: 'Le projet ne contient aucun niveau.' };
  const assembly = (file.project.assemblies ?? []).find(
    ({ id }) => id === draft.assemblyId,
  );
  if (assembly === undefined)
    return {
      status: 'ERROR',
      message: `Assemblage inconnu : ${draft.assemblyId || 'aucun'}.`,
    };
  // Two clicks at the same place are one point, not a wall of no length; the
  // run keeps what the user actually described.
  const corners: Point2D[] = [];
  for (const point of points) {
    const last = corners[corners.length - 1];
    if (last === undefined || last.x !== point.x || last.y !== point.y)
      corners.push(point);
  }
  const path =
    options.closed && corners.length > 2 ? [...corners, corners[0]!] : corners;
  if (path.length < 2)
    return {
      status: 'ERROR',
      message: 'Un mur demande deux points distincts.',
    };

  const wallAt = (walls: readonly Point2D[], id: string): Wall => ({
    id: entityId<'Wall'>(id),
    type: 'WALL',
    levelId: level.id,
    path: { points: walls },
    referenceSide: draft.referenceSide ?? 'CENTER',
    assemblyId: assembly.id,
    baseOffsetMm: 0,
    heightMode: 'EXPLICIT',
    heightMm: level.defaultStoreyHeightMm,
    role: draft.role,
  });

  if (options.asOneWall) {
    const wall = wallAt(path, options.newId('wall'));
    return {
      status: 'OK',
      command: new ProjectEditorCommand(
        `add-wall:${wall.id}`,
        'Ajouter un mur polyligne',
        level.id,
        new AddWallCommand(`add-wall:${wall.id}`, wall),
      ),
    };
  }

  const commands: ProjectCommand[] = [];
  for (let index = 1; index < path.length; index += 1) {
    const wall = wallAt(
      [path[index - 1]!, path[index]!],
      options.newId('wall'),
    );
    commands.push(
      new ProjectEditorCommand(
        `add-wall:${wall.id}`,
        'Ajouter un mur',
        level.id,
        new AddWallCommand(`add-wall:${wall.id}`, wall),
      ),
    );
  }
  return {
    status: 'OK',
    command: new ProjectTransactionCommand(
      `wall-run:${commands.length}:${options.newId('')}`,
      commands.length === 1
        ? 'Ajouter un mur'
        : `Ajouter ${commands.length} murs`,
      commands,
    ),
  };
}

/**
 * Builds the four walls of a rectangle drawn by its opposite corners.
 *
 * Drawing a house begins by enclosing it, and enclosing it by four clicks that
 * must land on right angles is four chances to miss one.
 */
export function addWallRectangleCommand(
  file: ProjectFile,
  levelId: string | undefined,
  points: readonly Point2D[],
  draft: WallToolDraft,
  newId: (prefix: string) => string,
): EditingCommandResult {
  const [from, to] = points;
  if (from === undefined || to === undefined)
    return { status: 'ERROR', message: 'Deux coins opposés sont attendus.' };
  if (from.x === to.x || from.y === to.y)
    return {
      status: 'ERROR',
      message: 'Les deux coins doivent délimiter une surface.',
    };
  /*
   * Les coins sont remis dans un ordre fixe.
   *
   * « Gauche » et « droite » sont relatives au sens du parcours : sur un
   * rectangle tracé du coin bas-droit vers le haut-gauche, elles s'échangent.
   * Une option qui promet « faces intérieures » ne peut pas dépendre du sens
   * du glissement — on normalise donc le parcours, et l'option dit alors la
   * vérité quel que soit le geste.
   */
  const left = Math.min(from.x, to.x);
  const right = Math.max(from.x, to.x);
  const top = Math.min(from.y, to.y);
  const bottom = Math.max(from.y, to.y);
  return addWallRunCommand(
    file,
    levelId,
    [
      { x: left, y: top },
      { x: left, y: bottom },
      { x: right, y: bottom },
      { x: right, y: top },
    ],
    draft,
    { asOneWall: false, closed: true, newId },
  );
}

/**
 * Places one thing in the building, where the user pointed.
 *
 * The room it stands in is read from the plan rather than asked for: the user
 * has just pointed at a place, and that place is in a room or it is not. What
 * the model does not know it leaves unsaid — a component outside every room is
 * a component with no room, not a component in the first one.
 */
export function placeComponentCommand(
  file: ProjectFile,
  levelId: string | undefined,
  point: Point2D,
  draft: {
    readonly category: ComponentCategory;
    readonly definitionId?: string;
    readonly name?: string;
    readonly elevationMm: number;
  },
  componentId: string,
  picked?: string,
): EditingCommandResult {
  const level = levelOf(file.project, levelId);
  if (level === undefined)
    return { status: 'ERROR', message: 'Le projet ne contient aucun niveau.' };
  const room = level.spaces.find(
    (space) =>
      space.boundaryMode === 'MANUAL' &&
      pointInPolygon(point, space.manualPolygon.outer),
  );
  const support = hostUnder(
    file.project,
    level,
    point,
    picked,
    draft.definitionId,
  );
  return {
    status: 'OK',
    command: new AddComponentCommand(level.id, {
      id: componentId,
      category: draft.category,
      ...(draft.definitionId === undefined || draft.definitionId === ''
        ? {}
        : { definitionId: draft.definitionId }),
      ...(draft.name === undefined || draft.name.trim() === ''
        ? {}
        : { name: draft.name }),
      position: { x: point.x, y: point.y },
      elevationMm: draft.elevationMm,
      // L'angle du support, et non zéro : c'est ce que l'aperçu montre avant
      // le clic, et un aperçu qui montre autre chose que ce qu'on obtient est
      // pire que pas d'aperçu.
      rotationDeg: support.wallAngleDeg ?? 0,
      ...(room === undefined ? {} : { spaceId: room.id }),
      ...(support.hostObjectId === undefined
        ? {}
        : { hostObjectId: support.hostObjectId }),
    }),
  };
}

/**
 * Ce à quoi l'objet posé se fixe — et qui l'accepte.
 *
 * L'outil ne le disait pas du tout : il posait un composant sans support, et le
 * modèle refusait — « ce modèle se fixe à : Dalle, Mur ». Puis il a pris la
 * dalle sous le point, pour tout, et le modèle a refusé autrement — « Terrain,
 * et slab-ground n'en est pas un ». Vingt et une entrées sur deux cent
 * quarante ne pouvaient toujours rien poser : les prises et les interrupteurs,
 * qui veulent un mur ; les puits, les fosses et les bornes, qui veulent le
 * terrain ; les gouttières et les panneaux, qui veulent une toiture.
 *
 * La fiche dit ce qu'elle accepte. On cherche donc un support **parmi ceux
 * qu'elle accepte**, dans l'ordre où l'on vise :
 *
 * 1. **Ce que le clic a touché**, s'il convient : c'est le plus explicite.
 * 2. **Le mur le plus proche**, quand la fiche veut un mur — poser une prise
 *    c'est viser un mur, et on vise à un mètre près.
 * 3. **La toiture, puis la dalle** sous le point : poser un lit c'est viser le
 *    milieu d'une chambre, pas la ligne du sol.
 *
 * Rien, sinon — et rien est la bonne réponse pour ce qui se pose sur le
 * terrain : le modèle l'accepte, parce que le terrain est partout.
 */
/**
 * Cuts or extends a walking line so that it is exactly `lengthMm` long.
 *
 * The line keeps its start and every turn it takes; only its end moves, along
 * the direction of its last stretch. A shorter line loses the stretches past
 * the mark, a longer one grows out of its last one.
 */
function fittedToLength(
  points: readonly Point2D[],
  lengthMm: number,
): readonly Point2D[] {
  const kept: Point2D[] = [{ ...points[0]! }];
  let travelled = 0;
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1]!;
    const to = points[index]!;
    const segment = Math.hypot(to.x - from.x, to.y - from.y);
    if (segment === 0) continue;
    const last = index === points.length - 1;
    if (travelled + segment >= lengthMm || last) {
      const ratio = (lengthMm - travelled) / segment;
      kept.push({
        x: from.x + (to.x - from.x) * ratio,
        y: from.y + (to.y - from.y) * ratio,
      });
      return kept;
    }
    kept.push({ ...to });
    travelled += segment;
  }
  return kept;
}

/**
 * Ce qui portera cette pose, et sous quel angle.
 *
 * La règle vit dans `host-choice.ts`, avec l'aperçu qui la montre. Elle était
 * écrite deux fois : ici pour poser, là-bas pour dessiner le fantôme — et deux
 * écritures de la même règle finissent par ne plus dire la même chose, ce qui
 * ferait d'un aperçu une promesse que la pose ne tient pas.
 *
 * L'angle est ce qui manquait le plus : le fantôme se couchait le long du mur
 * et l'objet posé arrivait à zéro degré. On voyait la bonne chose, on obtenait
 * l'autre.
 */
function hostUnder(
  project: Project,
  level: Level,
  point: Point2D,
  picked: string | undefined,
  definitionId: string | undefined,
): HostChoice {
  return chooseHost(
    level,
    point,
    picked,
    definitionId === undefined
      ? undefined
      : (project.equipment ?? []).find(({ id }) => id === definitionId)
          ?.allowedHosts,
  );
}

/**
 * Builds a stair along the line the user walked with the pointer.
 *
 * The storey it arrives at is the one just above, because that is what a stair
 * between two floors does; the inspector lets it be sent elsewhere. Its riser
 * height is never asked for: the storeys already answer it.
 *
 * The line is then fitted to the flight it has to carry: so many risers of so
 * deep a tread need a known length of floor, and a line drawn shorter or
 * longer than that would be a stair whose plan and whose dimensions describe
 * two different objects. The user says where the stair goes and which way it
 * turns; how far it reaches follows from its steps.
 */
export function addStairCommand(
  file: ProjectFile,
  levelId: string | undefined,
  points: readonly Point2D[],
  draft: {
    readonly stairType: StairType;
    readonly widthMm: number;
    readonly riserCount: number;
    readonly treadDepthMm: number;
  },
  stairId: string,
): EditingCommandResult {
  const level = levelOf(file.project, levelId);
  if (level === undefined)
    return { status: 'ERROR', message: 'Le projet ne contient aucun niveau.' };
  if (points.length < 2)
    return {
      status: 'ERROR',
      message: 'Une ligne de foulée demande deux points.',
    };
  const above = file.project.building.levels
    .filter(({ elevationMm }) => elevationMm > level.elevationMm)
    .sort((first, second) => first.elevationMm - second.elevationMm)[0];
  if (above === undefined)
    return {
      status: 'ERROR',
      message: `Aucun niveau ne se trouve au-dessus de ${level.name} : un escalier n’aurait nulle part où monter.`,
    };
  return {
    status: 'OK',
    command: new AddStairCommand(level.id, {
      id: stairId,
      topLevelId: above.id,
      stairType: draft.stairType,
      widthMm: draft.widthMm,
      riserCount: draft.riserCount,
      treadDepthMm: draft.treadDepthMm,
      path: fittedToLength(
        points,
        Math.max(0, draft.riserCount - 1) * draft.treadDepthMm,
      ),
    }),
  };
}

/**
 * Builds a roof from the outline that was drawn, or from the walls below it.
 *
 * Every side starts as a slope of the same pitch, which is a hipped roof; the
 * inspector turns the sides that should be gables into gables. Nothing about
 * the shape is guessed at creation, because the two-sided roof and the hipped
 * roof have the same outline and only the user knows which was meant.
 */
/**
 * Quels côtés sont des pans, et quels côtés sont des pignons.
 *
 * Les pignons sont pris sur les côtés les plus courts, parce que c'est ainsi
 * qu'une charpente est posée : le faîtage suit la longueur. Sur un contour qui
 * n'est pas un rectangle, « deux pans » prend les deux plus courts côtés et
 * laisse le reste en pans — ce qui est faux pour une maison en L, et c'est
 * pourquoi l'inspecteur garde le dernier mot côté par côté.
 */
function roofEdges(
  outline: readonly Point2D[],
  draft: {
    readonly slopeDeg: number;
    readonly overhangMm: number;
    readonly pans?: 1 | 2 | 4;
  },
): readonly {
  readonly kind: 'SLOPED' | 'GABLE';
  readonly slopeDeg: number;
  readonly overhangMm: number;
}[] {
  const lengths = outline.map((point, index) => {
    const next = outline[(index + 1) % outline.length]!;
    return { index, length: Math.hypot(next.x - point.x, next.y - point.y) };
  });
  const gables = new Set<number>();
  const wanted = draft.pans === undefined ? 0 : outline.length - draft.pans;
  if (wanted > 0)
    for (const { index } of [...lengths]
      .sort((a, b) => a.length - b.length)
      .slice(0, wanted))
      gables.add(index);
  return outline.map((_, index) => ({
    kind: gables.has(index) ? ('GABLE' as const) : ('SLOPED' as const),
    slopeDeg: draft.slopeDeg,
    overhangMm: draft.overhangMm,
  }));
}

export function addRoofStructureCommand(
  file: ProjectFile,
  levelId: string | undefined,
  points: readonly Point2D[],
  draft: {
    readonly assemblyId: string;
    readonly slopeDeg: number;
    readonly overhangMm: number;
    readonly fromWalls: boolean;
    /**
     * Combien de pans, quand on le dit d'un mot.
     *
     * Le nombre de pans n'est pas une propriété de la toiture : c'est la
     * nature de chacun de ses côtés. « Deux pans » veut dire que les deux
     * côtés les plus courts sont des pignons, « un pan » que trois le sont.
     * L'inspecteur les change ensuite un par un, comme avant.
     *
     * Absent, tous les côtés sont des pans — c'est ce que la toiture faisait
     * jusqu'ici, et une croupe sur quatre côtés reste une croupe.
     */
    readonly pans?: 1 | 2 | 4;
  },
  roofId: string,
): EditingCommandResult {
  const level = levelOf(file.project, levelId);
  if (level === undefined)
    return { status: 'ERROR', message: 'Le projet ne contient aucun niveau.' };
  let outline: readonly Point2D[];
  if (draft.fromWalls) {
    const point = points[0];
    if (point === undefined)
      return { status: 'ERROR', message: 'Un point est attendu.' };
    const room = detectRooms(file.project, level.id).find((candidate) =>
      pointInPolygon(point, candidate.polygon.outer),
    );
    if (room === undefined)
      return {
        status: 'ERROR',
        message: 'Ce point n’est dans aucun contour fermé par les murs.',
      };
    outline = room.polygon.outer;
  } else {
    if (points.length < 3)
      return { status: 'ERROR', message: 'Une toiture demande trois points.' };
    outline = points;
  }
  return {
    status: 'OK',
    command: new AddRoofStructureCommand(level.id, {
      id: roofId,
      footprint: { outer: outline.map((point) => ({ ...point })) },
      edges: roofEdges(outline, draft),
      assemblyId: draft.assemblyId,
      baseElevationMm: level.elevationMm + level.defaultStoreyHeightMm,
    }),
  };
}

/** Builds a column, a beam or a footing from the points that were clicked. */
export function addStructuralMemberCommand(
  file: ProjectFile,
  levelId: string | undefined,
  points: readonly Point2D[],
  draft: {
    readonly kind: StructuralMemberKind;
    readonly widthMm: number;
    readonly depthMm: number;
    readonly heightMm?: number;
  },
  memberId: string,
): EditingCommandResult {
  const level = levelOf(file.project, levelId);
  if (level === undefined)
    return { status: 'ERROR', message: 'Le projet ne contient aucun niveau.' };
  const wanted = draft.kind === 'BEAM' ? 2 : 1;
  if (points.length < wanted)
    return {
      status: 'ERROR',
      message:
        wanted === 1
          ? 'Un point est attendu.'
          : 'Une poutre demande deux points.',
    };
  return {
    status: 'OK',
    command: new AddStructuralMemberCommand(level.id, {
      id: memberId,
      kind: draft.kind,
      path: points.slice(0, wanted).map((point) => ({ ...point })),
      widthMm: draft.widthMm,
      depthMm: draft.depthMm,
      ...(draft.heightMm === undefined ? {} : { heightMm: draft.heightMm }),
    }),
  };
}

/**
 * Trace la parcelle, ou une **surface** posée sur le terrain autour d'elle.
 *
 * Ce qui se referme : la parcelle, la terrasse, l'allée, le stationnement, le
 * bâtiment voisin, la zone à laisser libre. Ce qui ne se referme pas — l'arbre
 * qu'on plante d'un clic, la haie et la clôture qu'on suit, le portail entre
 * ses deux montants — est refusé ici en nommant le geste qui convient, plutôt
 * que d'accepter un triangle en guise de houppier.
 */
export function addSiteOutlineCommand(
  points: readonly Point2D[],
  draft: {
    readonly target: 'PARCEL' | 'OBSTACLE';
    readonly kind: SiteObstacleKind;
    readonly heightMm?: number;
    readonly name?: string;
  },
  obstacleId: string,
): EditingCommandResult {
  // La parcelle est une limite, pas un obstacle : sa nature ne dit rien de la
  // façon dont on la trace, et c'est toujours un contour fermé.
  if (draft.target === 'OBSTACLE') {
    const refusal = outlineRefusal(draft.kind);
    if (refusal !== undefined) return { status: 'ERROR', message: refusal };
  }
  if (points.length < 3)
    return { status: 'ERROR', message: 'Un contour demande trois points.' };
  const outline = points.map((point) => ({ ...point }));
  return {
    status: 'OK',
    command:
      draft.target === 'PARCEL'
        ? new SetParcelBoundaryCommand(outline)
        : new AddSiteObstacleCommand({
            id: obstacleId,
            outline,
            kind: draft.kind,
            ...(draft.heightMm === undefined
              ? {}
              : { heightMm: draft.heightMm }),
            ...(draft.name === undefined ? {} : { name: draft.name }),
          }),
  };
}

/**
 * Plante un arbre là où l'on a cliqué, houppier compris.
 *
 * Un clic, un diamètre, une hauteur. Le diamètre **n'est pas stocké** : il
 * fabrique le contour du houppier et disparaît. Le polygone est la seule
 * emprise que le modèle connaisse, donc la seule qui puisse être déplacée,
 * mesurée et projetée en ombre — et deux réponses à « jusqu'où va cet arbre »
 * finiraient par diverger dès le premier sommet tiré à la souris.
 */
export function addSiteTreeCommand(
  point: Point2D | undefined,
  draft: {
    readonly crownDiameterMm: number;
    readonly heightMm?: number;
    readonly name?: string;
  },
  obstacleId: string,
): EditingCommandResult {
  if (point === undefined)
    return {
      status: 'ERROR',
      message: 'Cliquez l’endroit où planter l’arbre.',
    };
  const outline = crownFootprint(point, draft.crownDiameterMm);
  if (outline === undefined)
    return {
      status: 'ERROR',
      message: 'Le diamètre du houppier doit être une longueur positive.',
    };
  return {
    status: 'OK',
    command: new AddSiteObstacleCommand({
      id: obstacleId,
      outline,
      kind: 'TREE',
      ...(draft.heightMm === undefined ? {} : { heightMm: draft.heightMm }),
      ...(draft.name === undefined ? {} : { name: draft.name }),
    }),
  };
}

/**
 * Pose ce qui suit un axe : une haie, une clôture, un portail.
 *
 * On clique la ligne — deux points pour un portail, autant qu'on veut pour une
 * haie — et l'emprise est le ruban que cette ligne laisse à la largeur donnée.
 * Là encore, ce qui est stocké est le ruban : la largeur a servi à le tracer
 * et n'est pas conservée à côté de lui.
 */
export function addSiteAxisCommand(
  points: readonly Point2D[],
  draft: {
    readonly kind: SiteObstacleKind;
    readonly widthMm: number;
    readonly heightMm?: number;
    readonly name?: string;
  },
  obstacleId: string,
): EditingCommandResult {
  if (points.length < 2)
    return {
      status: 'ERROR',
      message: 'Un tracé demande au moins deux points.',
    };
  const outline = ribbonFootprint(points, draft.widthMm);
  if (outline === undefined)
    return {
      status: 'ERROR',
      message: 'Deux points confondus ne tracent aucune ligne.',
    };
  return {
    status: 'OK',
    command: new AddSiteObstacleCommand({
      id: obstacleId,
      outline,
      kind: draft.kind,
      ...(draft.heightMm === undefined ? {} : { heightMm: draft.heightMm }),
      ...(draft.name === undefined ? {} : { name: draft.name }),
    }),
  };
}

/** Whether a point falls inside a contour, by the crossing-number rule. */
export function pointInPolygon(
  point: Point2D,
  outline: readonly Point2D[],
): boolean {
  let inside = false;
  for (
    let index = 0, previous = outline.length - 1;
    index < outline.length;
    previous = index, index += 1
  ) {
    const current = outline[index]!;
    const last = outline[previous]!;
    if (current.y > point.y === last.y > point.y) continue;
    const crossingX =
      ((last.x - current.x) * (point.y - current.y)) / (last.y - current.y) +
      current.x;
    if (point.x < crossingX) inside = !inside;
  }
  return inside;
}

/**
 * Turns the contour the walls enclose around a point into a room.
 *
 * A room is described by walls that already exist, and redrawing its outline
 * by hand is redrawing what the model can already derive — with the near
 * certainty of a corner a few millimetres off, which then reads as a gap.
 */
export function addSpaceAtPointCommand(
  file: ProjectFile,
  levelId: string | undefined,
  point: Point2D,
  draft: { readonly name: string; readonly category: string },
  spaceId: string,
): EditingCommandResult {
  const level = levelOf(file.project, levelId);
  if (level === undefined)
    return { status: 'ERROR', message: 'Le projet ne contient aucun niveau.' };
  const rooms = detectRooms(file.project, level.id);
  if (rooms.length === 0)
    return {
      status: 'ERROR',
      message: 'Les murs de ce niveau n’enferment aucun contour.',
    };
  const found = rooms.find((room) => pointInPolygon(point, room.polygon.outer));
  if (found === undefined)
    return {
      status: 'ERROR',
      message: 'Ce point n’est dans aucun contour fermé par les murs.',
    };
  if (found.existingSpaceId !== undefined)
    return {
      status: 'ERROR',
      message: `Ce contour porte déjà la pièce ${found.existingSpaceId}.`,
    };
  return {
    status: 'OK',
    command: new AddSpaceCommand(level.id, {
      id: spaceId,
      name: draft.name,
      category: draft.category,
      polygon: found.polygon,
    }),
  };
}

/**
 * Réunir deux pièces en une.
 *
 * Deux pièces sont séparées par ce qui les sépare : une cloison. Les réunir
 * n'est donc pas une opération sur les pièces, c'est **retirer la cloison** —
 * après quoi les murs n'enferment plus qu'un contour, et ce contour n'a besoin
 * que d'une pièce.
 *
 * Le contour d'arrivée n'est pas deviné : la cloison est retirée sur une copie
 * du projet, et c'est la détection qui dit ce que les murs enferment alors. On
 * ne calcule pas une union de polygones dont le modèle saurait déjà la réponse.
 *
 * Tout part en une seule commande : deux pièces à moitié fusionnées — la
 * cloison retirée, deux espaces qui se recouvrent — seraient un état que
 * personne n'a demandé et qu'il faudrait défaire en quatre fois.
 */
export function mergeSpacesCommand(
  file: ProjectFile,
  levelId: string | undefined,
  from: Point2D,
  to: Point2D,
  spaceId: string,
): EditingCommandResult {
  const level = levelOf(file.project, levelId);
  if (level === undefined)
    return { status: 'ERROR', message: 'Le projet ne contient aucun niveau.' };
  const rooms = detectRooms(file.project, level.id);
  const first = rooms.find((room) => pointInPolygon(from, room.polygon.outer));
  const second = rooms.find((room) => pointInPolygon(to, room.polygon.outer));
  if (first === undefined || second === undefined)
    return {
      status: 'ERROR',
      message: 'Désignez deux contours fermés par les murs.',
    };
  if (first === second)
    return { status: 'ERROR', message: 'Ces deux points sont la même pièce.' };
  /*
   * Lequel des murs communs est celui qui sépare.
   *
   * Les deux contours en citent plusieurs : sur un rectangle coupé en deux,
   * les murs du haut et du bas courent d'un bout à l'autre et appartiennent
   * donc aux deux pièces. Les retirer tous ouvrirait la maison.
   *
   * Le séparateur est celui dont le retrait laisse **un seul contour qui
   * contient les deux points**. On ne le devine pas : on essaie, et c'est la
   * détection qui tranche — la même qui dessine les pièces.
   */
  const shared = first.sourceWallIds.filter((id) =>
    second.sourceWallIds.includes(id),
  );
  if (shared.length === 0)
    return {
      status: 'ERROR',
      message: 'Ces deux pièces ne partagent aucun mur : rien à retirer.',
    };
  let removal: ProjectCommand | undefined;
  let merged: DetectedRoom | undefined;
  let without: Project | undefined;
  for (const wallId of shared) {
    const command = removalCommandFor(file.project, level.id, wallId);
    if (command === undefined) continue;
    const dispatcher = new ProjectCommandDispatcher(file.project);
    if (dispatcher.dispatch(command).status !== 'APPLIED') continue;
    const candidate = detectRooms(dispatcher.project, level.id).find((room) =>
      pointInPolygon(from, room.polygon.outer),
    );
    if (candidate === undefined || !pointInPolygon(to, candidate.polygon.outer))
      continue;
    removal = command;
    merged = candidate;
    without = dispatcher.project;
    break;
  }
  if (removal === undefined || merged === undefined || without === undefined)
    return {
      status: 'ERROR',
      message:
        'Aucun mur commun ne sépare ces deux pièces sans ouvrir le reste.',
    };
  const kept = level.spaces.find(({ id }) => id === first.existingSpaceId);
  const dropped = level.spaces.filter(
    ({ id }) => id === first.existingSpaceId || id === second.existingSpaceId,
  );
  /*
   * Ce que les deux pièces portaient suit dans la pièce réunie.
   *
   * Sans cela, réunir refusait : « cette pièce est encore désignée par
   * Plafonnier séjour, Radiateur séjour, Prise séjour… ». Le refus était juste
   * — on n'efface pas une pièce que des objets nomment — mais réunir n'est pas
   * effacer. Le luminaire du séjour est toujours dans la pièce ; c'est la
   * pièce qui a changé de contour.
   */
  /*
   * Ce que les deux pièces portaient suit dans la pièce réunie.
   *
   * Réunir refusait : « cette pièce est encore désignée par Plafonnier séjour,
   * Radiateur séjour, Zone chauffée, ventilation:inlet-living… ». Le refus
   * était juste — on n'efface pas une pièce que des objets nomment — mais
   * réunir n'est pas effacer. Le luminaire est toujours dans la pièce ; c'est
   * la pièce qui a changé de contour.
   *
   * Le projet réuni est donc écrit d'un coup, et validé d'un coup : les
   * composants, les zones et les nœuds de réseau qui nommaient l'une ou
   * l'autre nomment la nouvelle. Un objet accroché au mur qu'on retire
   * retrouve un support sous lui, comme s'il venait d'être posé là.
   */
  const gone = new Set(dropped.map(({ id }) => id as string));
  const survivor =
    without.building.levels.find(({ id }) => id === level.id) ?? level;
  const standing = new Set(survivor.walls.map(({ id }) => id as string));
  const rehosted = survivor.components?.map((component) => {
    const host =
      component.hostObjectId === undefined ||
      standing.has(component.hostObjectId)
        ? component.hostObjectId
        : hostUnder(
            without,
            survivor,
            component.position,
            undefined,
            component.definitionId,
          ).hostObjectId;
    const inside =
      component.spaceId !== undefined && gone.has(component.spaceId);
    return {
      ...component,
      ...(inside ? { spaceId: entityId<'Space'>(spaceId) } : {}),
      ...(host === undefined ? {} : { hostObjectId: host }),
    };
  });
  const rejoined: Space = {
    id: entityId<'Space'>(spaceId),
    type: 'SPACE',
    levelId: level.id,
    // La pièce qui reste garde le nom de la première désignée : c'est celle
    // qu'on a montrée en premier, et un nom inventé serait un nom que
    // personne n'a choisi.
    name: kept?.name ?? 'Pièce',
    category: kept?.category ?? 'OTHER',
    ...(kept?.usageProfileId === undefined
      ? {}
      : { usageProfileId: kept.usageProfileId }),
    ...(kept?.thermalZoneId === undefined
      ? {}
      : { thermalZoneId: kept.thermalZoneId }),
    boundaryMode: 'MANUAL',
    manualPolygon: merged.polygon,
  };
  const rebuilt: Project = {
    ...without,
    building: {
      ...without.building,
      levels: without.building.levels.map((current) =>
        current.id !== level.id
          ? current
          : {
              ...current,
              spaces: [
                ...current.spaces.filter(({ id }) => !gone.has(id)),
                rejoined,
              ],
              ...(rehosted === undefined ? {} : { components: rehosted }),
            },
      ),
      zones: without.building.zones.map((zone) => ({
        ...zone,
        spaceIds: [
          ...new Set(
            zone.spaceIds.map((id) => (gone.has(id) ? entityId(spaceId) : id)),
          ),
        ],
      })),
    },
    ...(without.systems === undefined
      ? {}
      : {
          systems: without.systems.map((network) => ({
            ...network,
            nodes: network.nodes.map((node) =>
              node.spaceId !== undefined && gone.has(node.spaceId)
                ? { ...node, spaceId }
                : node,
            ),
          })),
        }),
  };
  return {
    status: 'OK',
    command: new ReplaceProjectCommand(
      `merge-spaces:${spaceId}`,
      'Réunir deux pièces',
      () => rebuilt,
      { objectIds: [spaceId, ...gone], domains: ['building'] },
    ),
  };
}

/**
 * Turns every contour the walls enclose into a room, in one action.
 *
 * A house has as many rooms as it has enclosed contours, and naming them one
 * by one through a panel is the navigation this replaces. Contours already
 * covered are left alone rather than duplicated.
 */
export function addEveryDetectedRoomCommand(
  file: ProjectFile,
  levelId: string | undefined,
  draft: { readonly category: string },
  newId: (prefix: string) => string,
): EditingCommandResult {
  const level = levelOf(file.project, levelId);
  if (level === undefined)
    return { status: 'ERROR', message: 'Le projet ne contient aucun niveau.' };
  const rooms = detectRooms(file.project, level.id).filter(
    (room) => room.existingSpaceId === undefined,
  );
  if (rooms.length === 0)
    return {
      status: 'ERROR',
      message: 'Aucun contour fermé n’est encore sans pièce.',
    };
  const commands = rooms.map((room, index) => {
    const id = newId('space');
    return new AddSpaceCommand(level.id, {
      id,
      name: `Pièce ${level.spaces.length + index + 1}`,
      category: draft.category,
      polygon: room.polygon,
    });
  });
  return {
    status: 'OK',
    command: new ProjectTransactionCommand(
      `spaces:detected:${newId('')}`,
      `Ajouter ${commands.length} pièce(s) détectée(s)`,
      commands,
    ),
  };
}

/**
 * Builds a slab, either from the points clicked or from the contour aimed at.
 *
 * A floor almost always covers a room that already exists; asking the user to
 * click its corners again is asking for the same shape a second time, and the
 * second one is never quite the first.
 */
export function addSlabFromPointsCommand(
  file: ProjectFile,
  levelId: string | undefined,
  points: readonly Point2D[],
  draft: {
    readonly assemblyId: string;
    readonly role: Slab['role'];
    readonly fromRoom: boolean;
  },
  slabId: string,
): EditingCommandResult {
  const level = levelOf(file.project, levelId);
  if (level === undefined)
    return { status: 'ERROR', message: 'Le projet ne contient aucun niveau.' };
  let polygon: Polygon2D;
  if (draft.fromRoom) {
    const point = points[0];
    if (point === undefined)
      return { status: 'ERROR', message: 'Un point est attendu.' };
    const room = detectRooms(file.project, level.id).find((candidate) =>
      pointInPolygon(point, candidate.polygon.outer),
    );
    if (room === undefined)
      return {
        status: 'ERROR',
        message: 'Ce point n’est dans aucun contour fermé par les murs.',
      };
    polygon = room.polygon;
  } else {
    if (points.length < 3)
      return { status: 'ERROR', message: 'Une dalle demande trois points.' };
    polygon = { outer: points.map((point) => ({ ...point })) };
  }
  return {
    status: 'OK',
    command: new AddSlabCommand(level.id, {
      id: slabId,
      polygon,
      assemblyId: draft.assemblyId,
      role: draft.role,
      elevationOffsetMm: 0,
    }),
  };
}

/**
 * Cuts an opening through the slab a contour falls in.
 *
 * A stairwell is a hole in the floor above it, and the floor is one object
 * with a hole rather than four slabs around a gap: a hole moves with its slab
 * and cannot be left behind.
 */
export function punchSlabHoleCommand(
  file: ProjectFile,
  levelId: string | undefined,
  points: readonly Point2D[],
): EditingCommandResult {
  const level = levelOf(file.project, levelId);
  if (level === undefined)
    return { status: 'ERROR', message: 'Le projet ne contient aucun niveau.' };
  if (points.length < 3)
    return { status: 'ERROR', message: 'Une trémie demande trois points.' };
  const centre = {
    x: points.reduce((total, { x }) => total + x, 0) / points.length,
    y: points.reduce((total, { y }) => total + y, 0) / points.length,
  };
  const host = level.slabs.find((slab) =>
    pointInPolygon(centre, slab.polygon.outer),
  );
  if (host === undefined)
    return {
      status: 'ERROR',
      message: 'Aucune dalle ne passe sous ce contour : rien à percer.',
    };
  // Every corner has to be over the slab: a hole crossing an edge would be a
  // shape the slab does not enclose, and the drawing would show a slab that
  // is not the one the model holds.
  if (!points.every((point) => pointInPolygon(point, host.polygon.outer)))
    return {
      status: 'ERROR',
      message: `La trémie sort de la dalle ${host.id}.`,
    };
  return {
    status: 'OK',
    command: new ProjectTransactionCommand(
      `slab:hole:${host.id}`,
      'Percer une trémie',
      [
        new UpdateSlabCommand(level.id, host.id, {
          polygon: {
            outer: host.polygon.outer,
            holes: [
              ...(host.polygon.holes ?? []),
              points.map((point) => ({ ...point })),
            ],
          },
        }),
      ],
    ),
  };
}

/**
 * Builds the command that inserts an opening.
 *
 * The point is projected onto the nearest wall, so the user drops the opening
 * roughly where they want it and the model keeps it hosted exactly on the wall.
 */
export function addOpeningCommand(
  file: ProjectFile,
  levelId: string | undefined,
  point: Point2D,
  draft: OpeningToolDraft,
  openingId: string,
): EditingCommandResult {
  const level = levelOf(file.project, levelId);
  if (level === undefined)
    return { status: 'ERROR', message: 'Le projet ne contient aucun niveau.' };
  const command = createOpeningInsertionCommand(point, level.walls, {
    maximumHostDistanceMm: MAXIMUM_HOST_DISTANCE_MM,
    commandId: () => `add-opening:${openingId}`,
    createOpening: (placement): WallOpening => ({
      id: entityId<'Opening'>(openingId),
      type: 'OPENING',
      openingType: draft.openingType,
      host: { kind: 'WALL' as const, id: placement.host.id },
      offsetAlongHostMm: Math.max(
        0,
        Math.round(placement.offsetAlongHostMm - draft.widthMm / 2),
      ),
      sillHeightMm: draft.sillHeightMm,
      widthMm: draft.widthMm,
      heightMm: draft.heightMm,
    }),
  });
  if (command === undefined)
    return {
      status: 'ERROR',
      message: 'Aucun mur assez proche pour héberger cette ouverture.',
    };
  return {
    status: 'OK',
    command: new ProjectEditorCommand(
      `add-opening:${openingId}`,
      'Ajouter une ouverture',
      level.id,
      command,
    ),
  };
}

/** Ce que l'outil « fenêtre de toit » demande. */
export interface RoofOpeningToolDraft {
  readonly openingType: 'WINDOW' | 'VOID';
  readonly widthMm: number;
  readonly heightMm: number;
}

/**
 * Poser une fenêtre là où l'on a cliqué sur un pan.
 *
 * Le clic est en plan ; la fenêtre se repère dans le pan, qui est incliné. La
 * conversion se fait ici, et dans le bon sens : la distance du clic à l'égout,
 * mesurée au sol, est la **projection** de ce qu'on remonte sur le rampant, et
 * la diviser par le cosinus est ce qui met la fenêtre là où le doigt était.
 *
 * Le clic vise le milieu de la fenêtre, comme pour une baie de mur : c'est
 * ainsi qu'on la pose du regard, et recentrer ici évite d'avoir à viser un
 * coin. Ce qui déborderait du pan est refusé par la commande, avec ce qui
 * déborde.
 */
export function addRoofOpeningCommand(
  file: ProjectFile,
  levelId: string | undefined,
  point: Point2D,
  draft: RoofOpeningToolDraft,
  openingId: string,
): EditingCommandResult {
  const level = levelOf(file.project, levelId);
  if (level === undefined)
    return { status: 'ERROR', message: 'Le projet ne contient aucun niveau.' };
  const planes = allRoofPlanes(level);
  if (planes.length === 0)
    return {
      status: 'ERROR',
      message: 'Aucune toiture sur ce niveau : dessinez-en une d’abord.',
    };
  const plane = planes.find(({ footprint }) =>
    polygonContains(footprint, point),
  );
  if (plane === undefined)
    return {
      status: 'ERROR',
      message: 'Cliquez dans un pan de toiture pour y poser une fenêtre.',
    };
  const frame = roofPlaneFrame(plane);
  if (frame === undefined)
    return {
      status: 'ERROR',
      message: `Le pan ${plane.id} est plat : il ne porte pas de fenêtre de toit.`,
    };
  const offset = {
    x: point.x - frame.eaveStart.x,
    y: point.y - frame.eaveStart.y,
  };
  const alongMm = offset.x * frame.along.x + offset.y * frame.along.y;
  const upMm = offset.x * frame.upSlope.x + offset.y * frame.upSlope.y;
  const cosine = Math.cos((plane.slopeDeg * Math.PI) / 180);
  // Pas de `ProjectEditorCommand` ici : celle-ci travaille déjà sur le projet
  // entier, parce que les pans dont elle a besoin sont dérivés d'une toiture.
  return {
    status: 'OK',
    command: new AddRoofOpeningCommand(level.id, {
      id: openingId,
      planeId: plane.id,
      openingType: draft.openingType,
      alongEaveMm: Math.max(0, Math.round(alongMm - draft.widthMm / 2)),
      upSlopeMm: Math.max(0, Math.round(upMm / cosine - draft.heightMm / 2)),
      widthMm: draft.widthMm,
      heightMm: draft.heightMm,
    }),
  };
}

export interface DimensionToolDraft {
  readonly dimensionType: DimensionType;
}

interface EndpointHit {
  readonly reference: Dimension['first'];
  readonly point: Point2D;
  readonly distanceMm: number;
}

/** The wall endpoint a click landed on, if one is close enough to have been meant. */
function nearestWallEndpoint(
  walls: readonly Wall[],
  point: Point2D,
): EndpointHit | undefined {
  const candidates: EndpointHit[] = [];
  for (const wall of walls) {
    const ends = [
      { endpoint: 'START' as const, point: wall.path.points[0] },
      { endpoint: 'END' as const, point: wall.path.points.at(-1) },
    ];
    for (const end of ends) {
      if (end.point === undefined) continue;
      candidates.push({
        reference: {
          kind: 'WALL_ENDPOINT',
          wallId: wall.id,
          endpoint: end.endpoint,
        },
        point: end.point,
        distanceMm: Math.hypot(end.point.x - point.x, end.point.y - point.y),
      });
    }
  }
  return candidates
    .filter(({ distanceMm }) => distanceMm <= MAXIMUM_ENDPOINT_DISTANCE_MM)
    .sort((first, second) => first.distanceMm - second.distanceMm)[0];
}

/**
 * Builds the command that adds a dimension between two wall endpoints.
 *
 * The two first points name what is measured; the third sets how far the
 * dimension line sits from it. The offset is signed, so the user places the
 * line on the side they clicked rather than on a side the application chose.
 */
/**
 * Writes a note on the plan, where it was clicked.
 *
 * A note says something to a human being; nothing about it is derived and
 * nothing reads it back. What it must not be is empty: an annotation with no
 * text is an invisible object the user cannot find again.
 */
export function addTextNoteCommand(
  file: ProjectFile,
  levelId: string | undefined,
  points: readonly Point2D[],
  draft: { readonly text: string; readonly heightMm: number },
  id: string,
): EditingCommandResult {
  const level = levelOf(file.project, levelId);
  if (level === undefined)
    return { status: 'ERROR', message: 'Le projet ne contient aucun niveau.' };
  const at = points[0];
  if (at === undefined)
    return { status: 'ERROR', message: 'Une annotation se pose en un point.' };
  if (draft.text.trim() === '')
    return {
      status: 'ERROR',
      message: 'Écrivez le texte de l’annotation avant de la poser.',
    };
  return {
    status: 'OK',
    command: new AddTextNoteCommand(level.id, {
      id,
      at: { ...at },
      text: draft.text,
      heightMm: draft.heightMm,
    }),
  };
}

export function addDimensionCommand(
  file: ProjectFile,
  levelId: string | undefined,
  points: readonly Point2D[],
  draft: DimensionToolDraft,
  id: string,
): EditingCommandResult {
  const level = levelOf(file.project, levelId);
  if (level === undefined)
    return { status: 'ERROR', message: 'Le projet ne contient aucun niveau.' };
  if (points.length < 3)
    return {
      status: 'ERROR',
      message: 'Une cote demande deux extrémités puis un point de décalage.',
    };
  const first = nearestWallEndpoint(level.walls, points[0]!);
  const second = nearestWallEndpoint(level.walls, points[1]!);
  if (first === undefined || second === undefined)
    return {
      status: 'ERROR',
      message:
        'Une cote se rattache à deux extrémités de murs : cliquez plus près des angles.',
    };
  if (
    first.reference.wallId === second.reference.wallId &&
    first.reference.endpoint === second.reference.endpoint
  )
    return {
      status: 'ERROR',
      message: 'Une cote demande deux extrémités distinctes.',
    };
  const dimension: Dimension = {
    id: dimensionId(id),
    kind: 'DIMENSION',
    type: draft.dimensionType,
    first: first.reference,
    second: second.reference,
    offsetMm: signedOffsetMm(first.point, second.point, points[2]!),
  };
  return {
    status: 'OK',
    command: new ProjectEditorCommand(
      `add-dimension:${dimension.id}`,
      'Ajouter une cote',
      level.id,
      new AddDimensionCommand(`add-dimension:${dimension.id}`, dimension),
    ),
  };
}

/** Distance from the measured line to the third click, signed by its side. */
function signedOffsetMm(
  first: Point2D,
  second: Point2D,
  target: Point2D,
): number {
  const dx = second.x - first.x;
  const dy = second.y - first.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return 0;
  return Math.round(
    ((target.x - first.x) * -dy + (target.y - first.y) * dx) / length,
  );
}

/** The editor command that deletes one object, whatever kind it is. */
/**
 * Builds the single command that deletes everything the selection names.
 *
 * One user action is one command: deleting three walls either happens or does
 * not, and Ctrl+Z brings all three back. Running one command per object could
 * leave the model half-deleted when the third one is refused.
 */
export function deleteObjectsCommand(
  file: ProjectFile,
  levelId: string | undefined,
  objectIds: readonly string[],
): EditingCommandResult {
  const level = levelOf(file.project, levelId);
  if (level === undefined)
    return { status: 'ERROR', message: 'Le projet ne contient aucun niveau.' };
  if (objectIds.length === 0)
    return { status: 'ERROR', message: 'La sélection est vide.' };
  const commands: ProjectCommand[] = [];
  for (const objectId of objectIds) {
    // Each family says how it is deleted, beside where it says how it is drawn
    // and edited: nothing here knows what a slab or a network node is.
    const command = removalCommandFor(file.project, level.id, objectId);
    if (command === undefined)
      return {
        status: 'ERROR',
        message: `Cet objet ne peut pas être supprimé depuis le plan : ${objectId}.`,
      };
    commands.push(command);
  }
  const id = `delete:${objectIds.join(',')}`;
  return {
    status: 'OK',
    command:
      commands.length === 1
        ? commands[0]!
        : new ProjectTransactionCommand(
            id,
            `Supprimer ${objectIds.length} objets`,
            commands,
          ),
  };
}

/**
 * Moves what is selected, as one action.
 *
 * A move is a transform like the other two; it is kept as its own function
 * because the rest of the application says « move » and because a wall moved
 * carries its openings, which a rewritten path would not.
 */
export function moveObjectsCommand(
  file: ProjectFile,
  levelId: string | undefined,
  objectIds: readonly string[],
  deltaMm: Point2D,
): EditingCommandResult {
  if (!Number.isFinite(deltaMm.x) || !Number.isFinite(deltaMm.y))
    return { status: 'ERROR', message: 'Déplacement non mesurable.' };
  return transformObjectsCommand(file, levelId, objectIds, {
    kind: 'TRANSLATE',
    deltaMm,
  });
}

const TRANSFORM_LABELS: Readonly<Record<PlanTransform['kind'], string>> = {
  TRANSLATE: 'Déplacer',
  ROTATE: 'Pivoter',
  MIRROR: 'Retourner',
};

/**
 * Moves, turns or reflects what is selected, as one action.
 *
 * Nothing here knows what a wall or a stair is: each family declares how it
 * follows a transform, beside where it declares how it is drawn, inspected and
 * deleted. This used to be a chain of `if` over four families, written when
 * there were four; every family added since fell through it and was told it
 * did not move, which was true of the code and false of the object.
 */
export function transformObjectsCommand(
  file: ProjectFile,
  levelId: string | undefined,
  objectIds: readonly string[],
  transform: PlanTransform,
): EditingCommandResult {
  const level = levelOf(file.project, levelId);
  if (level === undefined)
    return { status: 'ERROR', message: 'Le projet ne contient aucun niveau.' };
  if (objectIds.length === 0)
    return { status: 'ERROR', message: 'La sélection est vide.' };
  if (transform.kind === 'ROTATE' && !Number.isFinite(transform.angleDeg))
    return { status: 'ERROR', message: 'Angle non mesurable.' };
  const selection = new Set(objectIds);
  const commands: ProjectCommand[] = [];
  for (const objectId of objectIds) {
    const outcome = transformCommandsFor(
      file.project,
      level.id,
      objectId,
      transform,
      selection,
    );
    if (outcome === undefined)
      return {
        status: 'ERROR',
        message: `Cet objet n’appartient pas à ce niveau : ${objectId}.`,
      };
    if (outcome.status === 'REFUSED')
      return { status: 'ERROR', message: outcome.message };
    commands.push(...outcome.commands);
  }
  // Every object of the selection answered, and none of them had anything to
  // do: a segment whose corners are all its ends, an object already in place.
  if (commands.length === 0)
    return {
      status: 'ERROR',
      message: 'Rien à déplacer dans cette sélection.',
    };
  const id = `${transform.kind.toLowerCase()}:${objectIds.join(',')}`;
  const label = `${TRANSFORM_LABELS[transform.kind]} ${
    objectIds.length === 1 ? 'un objet' : `${objectIds.length} objets`
  }`;
  return {
    status: 'OK',
    command:
      commands.length === 1
        ? commands[0]!
        : new ProjectTransactionCommand(id, label, commands),
  };
}

/**
 * What was copied, held apart from the project it came from.
 *
 * The objects themselves are kept rather than their identifiers: what is
 * pasted must not change because the originals were deleted, moved or edited
 * in between, and a copy taken on one storey has to survive being pasted on
 * another.
 */
export interface PlanClipboard {
  readonly walls: readonly Wall[];
  readonly openings: readonly Opening[];
  readonly slabs: readonly Slab[];
  readonly roofs: readonly RoofPlane[];
  /**
   * The families the lots C to H added, which the clipboard did not know.
   *
   * Copying a storey onto the one above is what this exists for, and it copied
   * the walls and left the stairs, the roof, the posts and the radiators
   * behind — silently, because nothing said what had not been taken.
   */
  readonly stairs: readonly Stair[];
  readonly roofStructures: readonly Roof[];
  readonly structure: readonly StructuralMember[];
  readonly components: readonly ComponentInstance[];
  /**
   * The storey the copy was taken from, and how high it sits.
   *
   * A copy is not only a shape: a roof plane knows its own altitude and a wall
   * may be built up to a named storey. Pasted a floor higher, both have to be
   * read against the storey they land on, or the copy keeps the altitude of the
   * one it came from — right shape, wrong height, and nothing says so.
   */
  readonly sourceLevelId?: string;
  readonly sourceElevationMm?: number;
}

/** How many objects the clipboard holds, across every family. */
export function clipboardCount(clipboard: PlanClipboard): number {
  return (
    clipboard.walls.length +
    clipboard.openings.length +
    clipboard.slabs.length +
    clipboard.roofs.length +
    clipboard.stairs.length +
    clipboard.roofStructures.length +
    clipboard.structure.length +
    clipboard.components.length
  );
}

/** Whether anything at all was copied. */
export function clipboardIsEmpty(clipboard: PlanClipboard): boolean {
  return clipboardCount(clipboard) === 0;
}

/** A clipboard holding nothing, which is what a session starts with. */
export const EMPTY_CLIPBOARD: PlanClipboard = {
  walls: [],
  openings: [],
  slabs: [],
  roofs: [],
  stairs: [],
  roofStructures: [],
  structure: [],
  components: [],
};

/**
 * Takes a copy of what is selected.
 *
 * An opening is kept only when the wall carrying it is copied too: pasted
 * elsewhere it would have no wall to sit in.
 */
export function copyObjects(
  file: ProjectFile,
  levelId: string | undefined,
  objectIds: readonly string[],
): PlanClipboard {
  const level = levelOf(file.project, levelId);
  if (level === undefined) return EMPTY_CLIPBOARD;
  const chosen = new Set(objectIds);
  const kept = <T extends { readonly id: string }>(
    objects: readonly T[] | undefined,
  ): readonly T[] => (objects ?? []).filter(({ id }) => chosen.has(id));
  const walls = kept(level.walls);
  const hosts = new Set(walls.map(({ id }) => id as string));
  return {
    walls,
    openings: level.openings.filter(
      (opening) =>
        chosen.has(opening.id as string) && hosts.has(opening.host.id),
    ),
    slabs: kept(level.slabs),
    roofs: kept(level.roofs),
    stairs: kept(level.stairs),
    roofStructures: kept(level.roofStructures),
    structure: kept(level.structure),
    components: kept(level.components),
    sourceLevelId: level.id,
    sourceElevationMm: level.elevationMm,
  };
}

/**
 * The storey a copied wall should now be built up to.
 *
 * A wall built up to the first floor, pasted on the first floor, must be built
 * up to the second — not back down to where it came from. The storey at the
 * same distance in the list is the one that means the same thing; when there is
 * none above, the wall keeps an explicit height rather than pointing at a level
 * that does not exist.
 */
function retargetedHeight(
  project: Project,
  wall: Wall,
  sourceLevelId: string | undefined,
  targetLevel: { readonly id: string; readonly defaultStoreyHeightMm: number },
): Wall {
  if (wall.heightMode !== 'TO_LEVEL') return wall;
  const levels = project.building.levels;
  const source = levels.findIndex(({ id }) => id === sourceLevelId);
  const target = levels.findIndex(({ id }) => id === targetLevel.id);
  const top = levels.findIndex(({ id }) => id === wall.topLevelId);
  if (source === -1 || target === -1 || top === -1) return wall;
  const shifted = levels[top + (target - source)];
  if (shifted !== undefined) return { ...wall, topLevelId: shifted.id };
  // Nothing that high in this project: the copy keeps a height it can state
  // rather than a reference nobody can resolve.
  const { topLevelId: _top, topOffsetMm: _offset, ...rest } = wall;
  return {
    ...rest,
    heightMode: 'EXPLICIT',
    heightMm: targetLevel.defaultStoreyHeightMm,
  };
}

/**
 * The storey a copied reference should now point at.
 *
 * The storey at the same distance in the list is the one that means the same
 * thing: a stair from the ground floor to the first, pasted on the first, goes
 * to the second. Nothing that high in the project and there is no answer, which
 * the caller says rather than guessing one.
 */
function retargetedLevel(
  project: Project,
  referenced: string,
  sourceLevelId: string | undefined,
  targetLevelId: string,
): string | undefined {
  const levels = project.building.levels;
  const source = levels.findIndex(({ id }) => id === sourceLevelId);
  const target = levels.findIndex(({ id }) => id === targetLevelId);
  const pointed = levels.findIndex(({ id }) => id === referenced);
  if (source === -1 || target === -1 || pointed === -1) return undefined;
  return levels[pointed + (target - source)]?.id;
}

/**
 * Puts a copy down on a storey, which is not necessarily the one it came from.
 *
 * Copying a storey's partitions onto the one above is the reason this exists,
 * and it is why the paste never reuses an identifier: two objects sharing one
 * would make a click ambiguous and a scenario point at either of them.
 */
export function pasteClipboardCommand(
  file: ProjectFile,
  levelId: string | undefined,
  clipboard: PlanClipboard,
  deltaMm: Point2D,
  newId: (prefix: string) => string,
): DuplicationResult {
  const level = levelOf(file.project, levelId);
  if (level === undefined)
    return { status: 'ERROR', message: 'Le projet ne contient aucun niveau.' };
  if (clipboardIsEmpty(clipboard))
    return { status: 'ERROR', message: 'Rien n’a été copié.' };
  const commands: ProjectCommand[] = [];
  const createdIds: string[] = [];
  const copiedWalls = new Map<string, string>();
  const carried = (point: Point2D): Point2D => ({
    x: point.x + deltaMm.x,
    y: point.y + deltaMm.y,
  });
  // How far up the copy is going. Everything a copy knows about its own
  // altitude is read against the storey it lands on rather than the one it was
  // taken from.
  const risenMm =
    clipboard.sourceElevationMm === undefined
      ? 0
      : level.elevationMm - clipboard.sourceElevationMm;

  for (const wall of clipboard.walls) {
    const copyId = newId('wall');
    copiedWalls.set(wall.id, copyId);
    createdIds.push(copyId);
    commands.push(
      new ProjectEditorCommand(
        `wall:paste:${copyId}`,
        'Coller un mur',
        level.id,
        new AddWallCommand(`wall:paste:${copyId}`, {
          ...retargetedHeight(
            file.project,
            wall,
            clipboard.sourceLevelId,
            level,
          ),
          id: copyId as Wall['id'],
          levelId: level.id,
          path: { points: wall.path.points.map(carried) },
        }),
      ),
    );
  }
  for (const opening of clipboard.openings) {
    // Coller une fenêtre de toit demanderait de coller le pan qui la porte, et
    // un pan est dérivé d'une toiture : ce n'est pas un objet du presse-papier.
    if (!isWallOpening(opening)) continue;
    const host = copiedWalls.get(opening.host.id);
    if (host === undefined) continue;
    const copyId = newId('opening');
    createdIds.push(copyId);
    commands.push(
      new ProjectEditorCommand(
        `opening:paste:${copyId}`,
        'Coller une ouverture',
        level.id,
        new AddOpeningCommand(`opening:paste:${copyId}`, {
          ...opening,
          id: copyId as Opening['id'],
          // An opening belongs to its wall; the wall is what belongs to a level.
          host: { kind: 'WALL' as const, id: host },
        }),
      ),
    );
  }
  for (const slab of clipboard.slabs) {
    const copyId = newId('slab');
    createdIds.push(copyId);
    commands.push(
      new AddSlabCommand(level.id, {
        id: copyId,
        polygon: translatedPolygon(slab.polygon, deltaMm),
        assemblyId: slab.assemblyId,
        role: slab.role,
        elevationOffsetMm: slab.elevationOffsetMm,
      }),
    );
  }
  for (const roof of clipboard.roofs) {
    const copyId = newId('roof');
    createdIds.push(copyId);
    commands.push(
      new AddRoofCommand(level.id, {
        id: copyId,
        footprint: translatedPolygon(roof.footprint, deltaMm),
        assemblyId: roof.assemblyId,
        slopeDeg: roof.slopeDeg,
        azimuthDeg: roof.azimuthDeg,
        // The plane rises with the storey: pasted one floor up it sits one
        // floor higher, not at the altitude of the floor it came from.
        baseElevationMm: roof.baseElevationMm + risenMm,
      }),
    );
  }
  for (const roof of clipboard.roofStructures) {
    const copyId = newId('roof');
    createdIds.push(copyId);
    commands.push(
      new AddRoofStructureCommand(level.id, {
        id: copyId,
        footprint: translatedPolygon(roof.footprint, deltaMm),
        edges: roof.edges,
        assemblyId: roof.assemblyId,
        // The eaves rise with the storey, like a roof plane's altitude.
        baseElevationMm: roof.baseElevationMm + risenMm,
      }),
    );
  }
  for (const member of clipboard.structure) {
    const copyId = newId('member');
    createdIds.push(copyId);
    commands.push(
      new AddStructuralMemberCommand(level.id, {
        id: copyId,
        kind: member.kind,
        path: member.path.map(carried),
        widthMm: member.widthMm,
        depthMm: member.depthMm,
        ...(member.elevationMm === undefined
          ? {}
          : { elevationMm: member.elevationMm }),
        ...(member.heightMm === undefined ? {} : { heightMm: member.heightMm }),
        ...(member.materialId === undefined
          ? {}
          : { materialId: member.materialId }),
      }),
    );
  }
  for (const stair of clipboard.stairs) {
    // A stair joins two storeys. Pasted a floor up it has to arrive a floor
    // higher; keeping the storey it came from would make it a stair that goes
    // down, which the commands and the reader both refuse.
    const arrival = retargetedLevel(
      file.project,
      stair.topLevelId,
      clipboard.sourceLevelId,
      level.id,
    );
    if (arrival === undefined)
      return {
        status: 'ERROR',
        message: `Aucun niveau ne se trouve au-dessus de ${level.name} : l’escalier collé n’y monterait pas.`,
      };
    const copyId = newId('stair');
    createdIds.push(copyId);
    commands.push(
      new AddStairCommand(level.id, {
        id: copyId,
        topLevelId: arrival,
        stairType: stair.stairType,
        widthMm: stair.widthMm,
        riserCount: stair.riserCount,
        treadDepthMm: stair.treadDepthMm,
        path: stair.path.points.map(carried),
        ...(stair.landings === undefined ? {} : { landings: stair.landings }),
      }),
    );
  }
  for (const component of clipboard.components) {
    const copyId = newId('component');
    createdIds.push(copyId);
    const host =
      component.hostObjectId === undefined
        ? undefined
        : copiedWalls.get(component.hostObjectId);
    commands.push(
      new AddComponentCommand(level.id, {
        id: copyId,
        category: component.category,
        position: carried(component.position),
        elevationMm: component.elevationMm,
        rotationDeg: component.rotationDeg,
        ...(component.name === undefined ? {} : { name: component.name }),
        ...(component.definitionId === undefined
          ? {}
          : { definitionId: component.definitionId }),
        // A support and a room belong to a storey. Pasted onto another one,
        // what the copy was fixed to is not there: the copy stands where it
        // was put and says so, rather than pointing at a wall downstairs.
        ...(host === undefined ? {} : { hostObjectId: host }),
      }),
    );
  }
  const id = `paste:${createdIds.join(',')}`;
  return {
    status: 'OK',
    createdIds,
    command:
      commands.length === 1
        ? commands[0]!
        : new ProjectTransactionCommand(
            id,
            createdIds.length === 1
              ? 'Coller un objet'
              : `Coller ${createdIds.length} objets`,
            commands,
          ),
  };
}

/** Which edge of their own outlines the objects are lined up on. */
export type AlignEdge = 'LEFT' | 'RIGHT' | 'TOP' | 'BOTTOM';

export const ALIGN_LABELS: Readonly<Record<AlignEdge, string>> = {
  LEFT: 'Aligner à gauche',
  RIGHT: 'Aligner à droite',
  TOP: 'Aligner en haut',
  BOTTOM: 'Aligner en bas',
};

/** The extent of one object on the plan, or nothing when it has none. */
function objectExtent(
  file: ProjectFile,
  level: {
    readonly walls: readonly Wall[];
    readonly slabs: readonly Slab[];
    readonly roofs: readonly RoofPlane[];
  },
  objectId: string,
): { readonly min: Point2D; readonly max: Point2D } | undefined {
  const points: Point2D[] = [];
  const wall = level.walls.find(({ id }) => id === objectId);
  if (wall !== undefined) points.push(...wall.path.points);
  const slab = level.slabs.find(({ id }) => id === objectId);
  if (slab !== undefined) points.push(...slab.polygon.outer);
  const roof = level.roofs.find(({ id }) => id === objectId);
  if (roof !== undefined) points.push(...roof.footprint.outer);
  const node = (file.project.systems ?? [])
    .flatMap((network) => network.nodes)
    .find(({ id }) => id === objectId);
  if (node !== undefined) points.push(node.position);
  if (points.length === 0) return undefined;
  return {
    min: {
      x: Math.min(...points.map(({ x }) => x)),
      y: Math.min(...points.map(({ y }) => y)),
    },
    max: {
      x: Math.max(...points.map(({ x }) => x)),
      y: Math.max(...points.map(({ y }) => y)),
    },
  };
}

/**
 * Lines several objects up on one edge of the selection.
 *
 * Each object travels the distance that brings its own edge onto the outermost
 * one, so nothing is reshaped: aligning is moving, and a wall that ends up
 * shorter would not be an alignment.
 */
export function alignObjectsCommand(
  file: ProjectFile,
  levelId: string | undefined,
  objectIds: readonly string[],
  edge: AlignEdge,
): EditingCommandResult {
  const level = levelOf(file.project, levelId);
  if (level === undefined)
    return { status: 'ERROR', message: 'Le projet ne contient aucun niveau.' };
  if (objectIds.length < 2)
    return {
      status: 'ERROR',
      message: 'Sélectionnez au moins deux objets à aligner.',
    };
  const extents = objectIds.map((objectId) => ({
    objectId,
    extent: objectExtent(file, level, objectId),
  }));
  const measurable = extents.filter(
    (
      entry,
    ): entry is {
      objectId: string;
      extent: { readonly min: Point2D; readonly max: Point2D };
    } => entry.extent !== undefined,
  );
  if (measurable.length < 2)
    return {
      status: 'ERROR',
      message: 'Ces objets ne se mesurent pas sur le plan.',
    };
  const target =
    edge === 'LEFT'
      ? Math.min(...measurable.map(({ extent }) => extent.min.x))
      : edge === 'RIGHT'
        ? Math.max(...measurable.map(({ extent }) => extent.max.x))
        : edge === 'TOP'
          ? Math.min(...measurable.map(({ extent }) => extent.min.y))
          : Math.max(...measurable.map(({ extent }) => extent.max.y));
  const commands: ProjectCommand[] = [];
  for (const { objectId, extent } of measurable) {
    const current =
      edge === 'LEFT'
        ? extent.min.x
        : edge === 'RIGHT'
          ? extent.max.x
          : edge === 'TOP'
            ? extent.min.y
            : extent.max.y;
    const distance = target - current;
    // An object already on the edge is left alone rather than moved by zero.
    if (Math.abs(distance) < 1e-6) continue;
    const delta =
      edge === 'LEFT' || edge === 'RIGHT'
        ? { x: distance, y: 0 }
        : { x: 0, y: distance };
    const moved = moveObjectsCommand(file, levelId, [objectId], delta);
    if (moved.status === 'ERROR') return moved;
    commands.push(moved.command);
  }
  if (commands.length === 0)
    return {
      status: 'ERROR',
      message: 'Ces objets sont déjà alignés.',
    };
  // Even a single move is recorded as an alignment: the history has to say what
  // the user asked for, not how it happened to be carried out.
  return {
    status: 'OK',
    command: new ProjectTransactionCommand(
      `align:${edge}:${objectIds.join(',')}`,
      ALIGN_LABELS[edge],
      commands,
    ),
  };
}

/** Where two infinite lines cross, when they do. */
export function linesIntersection(
  firstStart: Point2D,
  firstEnd: Point2D,
  secondStart: Point2D,
  secondEnd: Point2D,
): Point2D | undefined {
  const first = { x: firstEnd.x - firstStart.x, y: firstEnd.y - firstStart.y };
  const second = {
    x: secondEnd.x - secondStart.x,
    y: secondEnd.y - secondStart.y,
  };
  const denominator = first.x * second.y - first.y * second.x;
  // Parallel walls never meet, and pretending otherwise would send an endpoint
  // to infinity.
  if (Math.abs(denominator) < 1e-9) return undefined;
  const along =
    ((secondStart.x - firstStart.x) * second.y -
      (secondStart.y - firstStart.y) * second.x) /
    denominator;
  return {
    x: firstStart.x + first.x * along,
    y: firstStart.y + first.y * along,
  };
}

/** A straight wall of this level, or nothing when the identifier is not one. */
function straightWall(
  level: { readonly walls: readonly Wall[] },
  objectId: string | undefined,
): Wall | undefined {
  const wall = level.walls.find(({ id }) => id === objectId);
  return wall !== undefined && wall.path.points.length === 2 ? wall : undefined;
}

/**
 * Draws a wall parallel to another one, on the side that was pointed at.
 *
 * The distance is the one the user showed by clicking: an offset asked for in
 * millimetres would be a number to invent, and the point is already there.
 */
export function offsetWallCommand(
  file: ProjectFile,
  levelId: string | undefined,
  wallId: string,
  towards: Point2D,
  newWallId: string,
): EditingCommandResult {
  const level = levelOf(file.project, levelId);
  if (level === undefined)
    return { status: 'ERROR', message: 'Le projet ne contient aucun niveau.' };
  const wall = straightWall(level, wallId);
  if (wall === undefined)
    return {
      status: 'ERROR',
      message: 'Le décalage parallèle demande un mur droit.',
    };
  const start = wall.path.points[0]!;
  const end = wall.path.points[1]!;
  const axis = { x: end.x - start.x, y: end.y - start.y };
  const length = Math.hypot(axis.x, axis.y);
  if (length === 0)
    return { status: 'ERROR', message: 'Ce mur n’a pas de longueur.' };
  const normal = { x: -axis.y / length, y: axis.x / length };
  const signed =
    (towards.x - start.x) * normal.x + (towards.y - start.y) * normal.y;
  if (Math.abs(signed) < 1)
    return {
      status: 'ERROR',
      message: 'Indiquez de quel côté et à quelle distance décaler le mur.',
    };
  const delta = { x: normal.x * signed, y: normal.y * signed };
  return {
    status: 'OK',
    command: new ProjectEditorCommand(
      `wall:offset:${newWallId}`,
      `Décaler un mur de ${Math.round(Math.abs(signed))} mm`,
      level.id,
      new AddWallCommand(`wall:offset:${newWallId}`, {
        ...wall,
        id: newWallId as Wall['id'],
        // The copy carries no openings: a hole in one wall is not a hole in
        // the wall beside it.
        path: {
          points: [
            { x: start.x + delta.x, y: start.y + delta.y },
            { x: end.x + delta.x, y: end.y + delta.y },
          ],
        },
      }),
    ),
  };
}

/** Which end of a wall is nearest a point. */
function nearestEndIndex(wall: Wall, point: Point2D): 0 | 1 {
  const start = wall.path.points[0]!;
  const end = wall.path.points[1]!;
  return Math.hypot(point.x - start.x, point.y - start.y) <=
    Math.hypot(point.x - end.x, point.y - end.y)
    ? 0
    : 1;
}

/**
 * Brings a wall to meet another one.
 *
 * One wall or both: joining two walls sends the near end of each to where their
 * axes cross, and adjusting sends only the near end of the first. Extending and
 * trimming are the same gesture — the endpoint goes to the crossing whether
 * that makes the wall longer or shorter, which is what the user pointed at.
 */
export function joinWallsCommand(
  file: ProjectFile,
  levelId: string | undefined,
  first: { readonly wallId: string; readonly at: Point2D },
  second: { readonly wallId: string; readonly at: Point2D },
  both: boolean,
): EditingCommandResult {
  const level = levelOf(file.project, levelId);
  if (level === undefined)
    return { status: 'ERROR', message: 'Le projet ne contient aucun niveau.' };
  if (first.wallId === second.wallId)
    return {
      status: 'ERROR',
      message: 'Désignez deux murs différents.',
    };
  const firstWall = straightWall(level, first.wallId);
  const secondWall = straightWall(level, second.wallId);
  if (firstWall === undefined || secondWall === undefined)
    return {
      status: 'ERROR',
      message: 'Ces opérations demandent deux murs droits.',
    };
  const crossing = linesIntersection(
    firstWall.path.points[0]!,
    firstWall.path.points[1]!,
    secondWall.path.points[0]!,
    secondWall.path.points[1]!,
  );
  if (crossing === undefined)
    return {
      status: 'ERROR',
      message: 'Ces deux murs sont parallèles : ils ne se rejoignent pas.',
    };
  const moved = (wall: Wall, at: Point2D): ProjectCommand => {
    const index = nearestEndIndex(wall, at);
    const points = wall.path.points.map((point, position) =>
      position === index ? crossing : point,
    );
    return new ProjectEditorCommand(
      `wall:join:${wall.id}`,
      both ? 'Joindre deux murs' : 'Ajuster un mur',
      level.id,
      new SetWallPathCommand(`wall:join:${wall.id}`, wall.id, points),
    );
  };
  const commands = both
    ? [moved(firstWall, first.at), moved(secondWall, second.at)]
    : [moved(firstWall, first.at)];
  return {
    status: 'OK',
    command:
      commands.length === 1
        ? commands[0]!
        : new ProjectTransactionCommand(
            `join:${firstWall.id}:${secondWall.id}`,
            'Joindre deux murs',
            commands,
          ),
  };
}

/** What a duplication produced, so the copies can be selected in its place. */
export type DuplicationResult =
  | {
      readonly status: 'OK';
      readonly command: ProjectCommand;
      readonly createdIds: readonly string[];
    }
  | { readonly status: 'ERROR'; readonly message: string };

/**
 * Copies what is selected, a little to the side.
 *
 * The copies are what the user then works on, so their identifiers are
 * reported: a duplication that leaves the originals selected looks like
 * nothing happened.
 *
 * The families are asked in the order they are declared, which is why what
 * hangs on something finds it already copied: an opening lands in the copy of
 * its wall, a radiator on the copy of its support. A family that declines says
 * why, and the whole duplication stops rather than half happening.
 */
export function duplicateObjectsCommand(
  file: ProjectFile,
  levelId: string | undefined,
  objectIds: readonly string[],
  deltaMm: Point2D,
  newId: (prefix: string) => string,
): DuplicationResult {
  const level = levelOf(file.project, levelId);
  if (level === undefined)
    return { status: 'ERROR', message: 'Le projet ne contient aucun niveau.' };
  if (objectIds.length === 0)
    return { status: 'ERROR', message: 'La sélection est vide.' };
  const commands: ProjectCommand[] = [];
  const createdIds: string[] = [];
  const copies = new Map<string, string>();
  const context = { newId, copies };
  // In the order of the families rather than of the selection: a wall has to
  // be copied before the opening it carries can be put into the copy.
  const pending = new Set(objectIds);
  for (const editor of OBJECT_EDITORS) {
    for (const objectId of objectIds) {
      if (!pending.has(objectId)) continue;
      const outcome = editor.duplicate?.(
        file.project,
        level.id,
        objectId,
        deltaMm,
        context,
      );
      if (outcome === undefined) continue;
      pending.delete(objectId);
      if (outcome.status === 'REFUSED')
        return { status: 'ERROR', message: outcome.message };
      copies.set(objectId, outcome.createdId);
      createdIds.push(outcome.createdId);
      commands.push(...outcome.commands);
    }
  }
  for (const objectId of pending) {
    const { duplicable } = capabilitiesOf(file.project, objectId);
    return {
      status: 'ERROR',
      message: duplicable
        ? `Cet objet n’appartient pas à ce niveau : ${objectId}.`
        : `Cet objet ne se duplique pas depuis le plan : ${objectId}.`,
    };
  }
  if (commands.length === 0)
    return {
      status: 'ERROR',
      message: 'Rien de sélectionné ne se duplique depuis le plan.',
    };
  const id = `duplicate:${createdIds.join(',')}`;
  return {
    status: 'OK',
    createdIds,
    command:
      commands.length === 1
        ? commands[0]!
        : new ProjectTransactionCommand(
            id,
            createdIds.length === 1
              ? 'Dupliquer un objet'
              : `Dupliquer ${createdIds.length} objets`,
            commands,
          ),
  };
}

/**
 * Cuts a wall where the user pointed.
 *
 * Splitting from the toolbar cut at the middle, whatever the user had in mind;
 * the domain command has always taken a point, and this is what hands it the
 * one that was clicked. The point is projected onto the wall, so a click a
 * little beside it still cuts where it was aimed.
 */
export function splitWallCommand(
  file: ProjectFile,
  levelId: string | undefined,
  wallId: string,
  at: Point2D,
  newWallId: string,
): EditingCommandResult {
  return geometryEditCommand(
    file,
    levelId,
    { kind: 'WALL_SPLIT', wallId, at },
    newWallId,
  );
}

/**
 * The command a dragged handle produces.
 *
 * The canvas reports what was dragged and where it landed; turning that into an
 * edit of the project happens here, where the commands are known and where a
 * refusal can be explained.
 */
export function geometryEditCommand(
  file: ProjectFile,
  levelId: string | undefined,
  edit: GeometryEdit,
  newWallId?: string,
): EditingCommandResult {
  const level = levelOf(file.project, levelId);
  if (level === undefined)
    return { status: 'ERROR', message: 'Aucun niveau actif.' };
  switch (edit.kind) {
    case 'WALL_POINT':
      return {
        status: 'OK',
        command: new ProjectEditorCommand(
          `wall:point:${edit.wallId}:${edit.pointIndex}`,
          'Déplacer une extrémité de mur',
          level.id,
          new MoveWallPointCommand(
            `wall:point:${edit.wallId}`,
            edit.wallId as Wall['id'],
            edit.pointIndex,
            edit.to,
          ),
        ),
      };
    case 'WALL_MOVE':
      return {
        status: 'OK',
        command: new ProjectEditorCommand(
          `wall:move:${edit.wallId}`,
          'Déplacer un mur',
          level.id,
          new MoveWallCommand(
            `wall:move:${edit.wallId}`,
            edit.wallId as Wall['id'],
            edit.delta,
          ),
        ),
      };
    case 'WALL_SPLIT': {
      if (newWallId === undefined)
        return {
          status: 'ERROR',
          message: 'Aucun identifiant disponible pour le mur créé.',
        };
      return {
        status: 'OK',
        command: new ProjectEditorCommand(
          `wall:split:${edit.wallId}`,
          'Scinder un mur',
          level.id,
          new SplitWallCommand(
            `wall:split:${edit.wallId}`,
            edit.wallId as Wall['id'],
            edit.at,
            newWallId as Wall['id'],
          ),
        ),
      };
    }
    case 'OPENING_OFFSET':
      return {
        status: 'OK',
        command: new UpdateOpeningCommand(level.id, edit.openingId, {
          offsetAlongHostMm: edit.offsetMm,
        }),
      };
    case 'ROUTE_VERTEX':
      return {
        status: 'OK',
        command: new MoveNetworkEdgeVertexCommand(
          edit.networkId,
          edit.edgeId,
          edit.vertexIndex,
          edit.to,
        ),
      };
    case 'POLYGON_VERTEX':
    case 'POLYGON_INSERT':
    case 'POLYGON_REMOVE': {
      /*
       * Les quatre surfaces écrivent par le même chemin.
       *
       * Cette branche connaissait deux familles et deux commandes, et il en
       * aurait fallu deux de plus pour la parcelle et la trémie. Le contour
       * sait où il vit et comment il se réécrit ; ces lignes ne manipulent que
       * des sommets.
       */
      const surface = polygonSurface(file.project, levelId, edit.objectId);
      if (surface === undefined)
        return {
          status: 'ERROR',
          message: `${edit.objectId} est introuvable.`,
        };
      const polygon = { outer: surface.outline };
      const next =
        edit.kind === 'POLYGON_VERTEX'
          ? withMovedVertex(polygon, edit.vertexIndex, edit.to)
          : edit.kind === 'POLYGON_INSERT'
            ? withInsertedVertex(polygon, edit.edgeIndex, edit.at)
            : withoutVertex(polygon, edit.vertexIndex);
      if (next === undefined)
        return {
          status: 'ERROR',
          message:
            'Un contour garde au moins trois sommets : celui-ci ne peut pas en perdre un de plus.',
        };
      return { status: 'OK', command: surface.withOutline(next.outer) };
    }
  }
}
