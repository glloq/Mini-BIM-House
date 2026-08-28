import type {
  BoundingBox2D,
  Point2D,
} from '@house-technical-designer/geometry';

import type {
  Discipline,
  GraphicProfile,
  ScenePrimitive,
  SemanticRole,
} from './scene.js';

export type SymbolSpace = 'MODEL_SPACE' | 'PAPER_SPACE';
export type SymbolPrimitive =
  | {
      readonly kind: 'LINE';
      readonly start: Point2D;
      readonly end: Point2D;
      readonly role: SemanticRole;
    }
  | {
      readonly kind: 'POLYLINE';
      readonly points: readonly Point2D[];
      readonly role: SemanticRole;
    }
  | {
      readonly kind: 'POLYGON';
      readonly points: readonly Point2D[];
      readonly role: SemanticRole;
    }
  | {
      readonly kind: 'CIRCLE';
      readonly center: Point2D;
      readonly radius: number;
      readonly role: SemanticRole;
    }
  | {
      readonly kind: 'ARC';
      readonly center: Point2D;
      readonly radius: number;
      readonly startAngleDeg: number;
      readonly endAngleDeg: number;
      readonly role: SemanticRole;
    }
  | {
      readonly kind: 'TEXT';
      readonly anchor: Point2D;
      readonly text: string;
      readonly role: SemanticRole;
    };

export interface SymbolAnchor {
  readonly id: string;
  readonly point: Point2D;
  readonly kind: 'INSERTION' | 'CONNECTION' | 'LABEL';
}

export interface SymbolDefinition {
  readonly id: string;
  readonly name: string;
  /**
   * The version of this glyph, and where it comes from.
   *
   * A symbol is a catalogue entry like any other: a plan drawn last year has
   * to be redrawn the same way this year, and a glyph copied from a published
   * plate has to say so. Optional only because the shape predates the rule;
   * everything the application ships states both.
   */
  readonly version?: string;
  readonly provenance?: {
    readonly type: string;
    readonly reference: string;
    readonly url?: string;
    readonly validAt?: string;
  };
  readonly semanticType: string;
  readonly discipline: Discipline;
  readonly viewBox: BoundingBox2D;
  readonly anchors: readonly SymbolAnchor[];
  readonly primitives: readonly SymbolPrimitive[];
  readonly scaleRules: {
    readonly space: SymbolSpace;
    readonly nominalSizeMm?: number;
  };
  readonly references?: readonly string[];
}

export interface SymbolLibrary {
  readonly id: string;
  readonly version: string;
  /** What may be done with these glyphs, which is not a property of any one. */
  readonly licence?: string;
  readonly definitions: Readonly<Record<string, SymbolDefinition>>;
}

export interface SymbolPlacement {
  readonly id: string;
  readonly symbolId: string;
  readonly position: Point2D;
  readonly drawingScale: number;
  readonly rotationDeg?: number;
  readonly modelScale?: number;
  readonly sourceObjectId?: string;
  readonly layer?: string;
  readonly zIndex?: number;
}

export function createSymbolLibrary(
  id: string,
  version: string,
  definitions: readonly SymbolDefinition[],
  licence?: string,
): SymbolLibrary {
  if (id.trim() === '' || version.trim() === '')
    throw new TypeError(
      'Symbol library identity and version must not be empty.',
    );
  const entries: Record<string, SymbolDefinition> = {};
  for (const definition of definitions) {
    validateSymbolDefinition(definition);
    if (entries[definition.id] !== undefined)
      throw new TypeError(`Duplicate symbol ID: ${definition.id}`);
    entries[definition.id] = definition;
  }
  return {
    id,
    version,
    ...(licence === undefined ? {} : { licence }),
    definitions: entries,
  };
}

export function resolveSymbol(
  library: SymbolLibrary,
  requestedId: string,
  profile: GraphicProfile,
): SymbolDefinition {
  const resolvedId = profile.symbolOverrides?.[requestedId] ?? requestedId;
  const definition = library.definitions[resolvedId];
  if (definition === undefined)
    throw new RangeError(`Unknown symbol: ${resolvedId}`);
  return definition;
}

/** Projects a safe symbol definition into the semantic scene; no arbitrary SVG is accepted. */
export function placeSymbol(
  definition: SymbolDefinition,
  placement: SymbolPlacement,
): readonly ScenePrimitive[] {
  validateSymbolDefinition(definition);
  if (placement.symbolId !== definition.id)
    throw new TypeError(
      'Symbol placement does not match the supplied definition.',
    );
  if (!Number.isFinite(placement.drawingScale) || placement.drawingScale <= 0)
    throw new RangeError('Drawing scale must be finite and positive.');
  const modelScale = placement.modelScale ?? 1;
  if (!Number.isFinite(modelScale) || modelScale <= 0)
    throw new RangeError('Symbol model scale must be finite and positive.');
  if (!finitePoint(placement.position))
    throw new RangeError('Symbol position must contain finite coordinates.');
  if (
    placement.rotationDeg !== undefined &&
    !Number.isFinite(placement.rotationDeg)
  )
    throw new RangeError('Symbol rotation must be finite.');
  const scale =
    (definition.scaleRules.space === 'PAPER_SPACE'
      ? placement.drawingScale
      : 1) * modelScale;
  const rotation = ((placement.rotationDeg ?? 0) * Math.PI) / 180;
  const transform = (point: Point2D): Point2D => ({
    x:
      placement.position.x +
      scale * (point.x * Math.cos(rotation) - point.y * Math.sin(rotation)),
    y:
      placement.position.y +
      scale * (point.x * Math.sin(rotation) + point.y * Math.cos(rotation)),
  });
  return definition.primitives.map((primitive, index): ScenePrimitive => ({
    id: `${placement.id}:${index}`,
    ...(placement.sourceObjectId === undefined
      ? {}
      : { sourceObjectId: placement.sourceObjectId }),
    semanticRole: primitive.role,
    geometry: primitiveGeometry(primitive, transform),
    layer: placement.layer ?? `SYMBOL_${definition.discipline}`,
    zIndex: placement.zIndex ?? 60,
    discipline: definition.discipline,
    metadata: {
      symbolId: definition.id,
      semanticType: definition.semanticType,
    },
  }));
}

function primitiveGeometry(
  primitive: SymbolPrimitive,
  transform: (point: Point2D) => Point2D,
): ScenePrimitive['geometry'] {
  if (primitive.kind === 'LINE')
    return {
      kind: 'POLYLINE',
      polyline: {
        points: [transform(primitive.start), transform(primitive.end)],
        closed: false,
      },
    };
  if (primitive.kind === 'POLYLINE')
    return {
      kind: 'POLYLINE',
      polyline: { points: primitive.points.map(transform), closed: false },
    };
  if (primitive.kind === 'POLYGON')
    return {
      kind: 'POLYGON',
      polygon: { outer: primitive.points.map(transform) },
    };
  if (primitive.kind === 'TEXT')
    return {
      kind: 'TEXT',
      anchor: transform(primitive.anchor),
      text: primitive.text,
    };
  const start = primitive.kind === 'CIRCLE' ? 0 : primitive.startAngleDeg;
  const end = primitive.kind === 'CIRCLE' ? 360 : primitive.endAngleDeg;
  const count = Math.max(8, Math.ceil(Math.abs(end - start) / 15));
  const points = Array.from({ length: count + 1 }, (_, index) => {
    const angle = ((start + ((end - start) * index) / count) * Math.PI) / 180;
    return transform({
      x: primitive.center.x + primitive.radius * Math.cos(angle),
      y: primitive.center.y + primitive.radius * Math.sin(angle),
    });
  });
  return { kind: 'POLYLINE', polyline: { points, closed: false } };
}

export interface SymbolIssue {
  readonly symbolId: string;
  readonly path: string;
  readonly message: string;
}

const SYMBOL_SEMVER =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/u;

/**
 * Everything wrong with the symbols, reported rather than thrown.
 *
 * The library constructor throws, which is right for a programming error and
 * useless for a data file: a glyph with a bad view box brought the whole
 * application down at import time instead of appearing in the same report as
 * every other catalogue defect. Now both exist, and they ask the same
 * questions.
 */
export function symbolCatalogIssues(
  definitions: readonly SymbolDefinition[] = rawGenericSymbolEntries(),
): readonly SymbolIssue[] {
  const issues: SymbolIssue[] = [];
  const seen = new Set<string>();
  for (const definition of definitions) {
    const at = (path: string, message: string) =>
      issues.push({ symbolId: definition.id, path, message });
    if (seen.has(definition.id)) at('id', 'is declared more than once');
    seen.add(definition.id);
    try {
      validateSymbolDefinition(definition);
    } catch (error: unknown) {
      at('', error instanceof Error ? error.message : 'is not a valid symbol');
    }
    // A plan drawn last year has to be redrawn the same way this year, so a
    // glyph is versioned like every other catalogue entry.
    if (definition.version === undefined) at('version', 'must state a version');
    else if (!SYMBOL_SEMVER.test(definition.version))
      at('version', `${definition.version} is not a version of the form 1.0.0`);
    // A glyph copied from a published plate is somebody else's drawing.
    if (definition.provenance === undefined)
      at('provenance', 'must say where the glyph comes from');
    else if (definition.provenance.reference.trim() === '')
      at('provenance/reference', 'must not be empty');
  }
  return issues;
}

/**
 * Quel glyphe dessine quelle chose, en données.
 *
 * Trente-neuf familles étaient associées à leur dessin par une table écrite en
 * TypeScript dans `view-query`, une ligne par famille. C'est tenable à quarante
 * et faux à quatre cents : la nomenclature compte cinq cent vingt-sept
 * familles, dont trois cent quatre-vingts posables ; personne ne relit une
 * table de cette taille, et aucune barrière ne sait la lire.
 *
 * Elle vit maintenant dans `data/plan-bindings.json`, à deux niveaux :
 *
 *   - `families` : cette famille-là se dessine comme ceci, et pas autrement.
 *     Une baignoire est une baignoire avant d'être « un appareil sanitaire ».
 *   - `categories` : à défaut, voici à quoi ressemble « un appareil sanitaire
 *     dont on ne sait rien de plus ». Une ligne y couvre toute une catégorie,
 *     ce qui est la seule raison pour laquelle cette approche passe à
 *     l'échelle : dix-huit lignes tiennent cent vingt-trois familles.
 *
 * Pourquoi ici et non sur la fiche de famille, qui le dit aussi en
 * `graphics.planSymbol` : le moteur de plan ne peut pas atteindre la
 * nomenclature — `view-query` ne dépend pas de `catalog-registry` et ne doit
 * pas commencer à en dépendre pour dessiner un lavabo. La planche porte donc
 * la copie que le dessin lit, et `npm run graphics:coverage -- --check` refuse
 * que les deux divergent, ce qu'elles faisaient déjà pour dix familles avant
 * que quiconque pose la question.
 *
 * Et pourquoi dans un fichier à part, hors de `data/symbols` : un symbole est
 * une fiche de catalogue, son empreinte est enregistrée, et changer son contenu
 * sans changer sa version est exactement ce que la barrière des empreintes
 * refuse — ajouter la liste de ses familles à chaque glyphe aurait fait bouger
 * quarante-cinq empreintes pour un dessin inchangé. Le dossier des symboles est
 * en outre validé fichier par fichier contre le schéma du catalogue de
 * symboles, qui n'accepte rien d'autre que des glyphes. Le lien entre un dessin
 * et une nomenclature n'est ni l'un ni l'autre : il a son fichier.
 */
interface PlanBindingFile {
  readonly formatVersion: string;
  readonly id: string;
  readonly version: string;
  /** Le glyphe que prend une chose dont ni la famille ni la catégorie n'est tenue. */
  readonly fallback: string;
  readonly bindings: {
    readonly families: Readonly<Record<string, string>>;
    readonly categories: Readonly<Record<string, string>>;
  };
}

const BINDINGS = Object.values(
  import.meta.glob('../data/plan-bindings.json', {
    eager: true,
    import: 'default',
  }) as Readonly<Record<string, PlanBindingFile>>,
)[0];

/**
 * Le glyphe qu'un objet posé prend quand rien de plus précis n'existe.
 *
 * C'est le carré de trois cents millimètres que le plan dessinait déjà, sauf
 * qu'il porte enfin un nom. La différence n'est pas cosmétique : « sans
 * représentation » devient une propriété qu'on peut vérifier — le dernier
 * maillon est publié ou il ne l'est pas — au lieu d'un cas qu'on espère ne
 * jamais atteindre.
 */
export const GENERIC_PLAN_SYMBOL =
  BINDINGS?.fallback ?? 'architecture.placed-object';

/** Les correspondances telles que le fichier les écrit, sans rien réparer. */
export function rawPlanBindings(): PlanBindingFile['bindings'] {
  return BINDINGS?.bindings ?? { families: {}, categories: {} };
}

/** Par quel maillon de la chaîne une chose a obtenu son glyphe. */
export type PlanSymbolSource = 'FAMILY' | 'CATEGORY' | 'GENERIC';

/**
 * Le même résultat, en disant par où il est passé.
 *
 * Une couverture ne se mesure pas en comptant les glyphes rendus : ils sont
 * tous rendus. Ce qui se compte, c'est le maillon — combien de familles ont
 * leur propre dessin, combien se contentent de celui de leur catégorie,
 * combien n'ont que le carré.
 */
export function planSymbolSource(subject: {
  readonly familyId?: string | undefined;
  readonly category?: string | undefined;
}): PlanSymbolSource {
  const { families, categories } = rawPlanBindings();
  if (
    subject.familyId !== undefined &&
    families[subject.familyId] !== undefined
  )
    return 'FAMILY';
  if (
    subject.category !== undefined &&
    categories[subject.category] !== undefined
  )
    return 'CATEGORY';
  return 'GENERIC';
}

/**
 * Le glyphe de plan d'une chose, et la chaîne de repli qui l'y mène.
 *
 * Trois maillons, du plus précis au moins, dans cet ordre et sans exception :
 * le dessin de la famille, celui de sa catégorie, puis le glyphe générique
 * nommé. Le troisième ne rate jamais tant qu'il est publié, ce qui est
 * exactement ce qu'on attend d'un dernier recours : une chose posée dans une
 * maison est toujours dessinée, même mal.
 *
 * La catégorie est facultative parce que tous les appelants ne l'ont pas — le
 * plan la porte sur la copie de la fiche que le projet garde, d'autres n'ont
 * que l'identifiant de famille. Un appelant qui ne la donne pas saute le
 * deuxième maillon ; il n'en reçoit pas un faux.
 */
export function planSymbolFor(subject: {
  readonly familyId?: string | undefined;
  readonly category?: string | undefined;
}): string {
  const { families, categories } = rawPlanBindings();
  if (subject.familyId !== undefined) {
    const held = families[subject.familyId];
    if (held !== undefined) return held;
  }
  if (subject.category !== undefined) {
    const held = categories[subject.category];
    if (held !== undefined) return held;
  }
  return GENERIC_PLAN_SYMBOL;
}

/**
 * Tout ce qui cloche dans les correspondances, rapporté et non lancé.
 *
 * Une correspondance qui nomme un glyphe absent ne casse rien : la chaîne rend
 * un identifiant que le plan ne trouve pas, et la chose se dessine comme un
 * carré — c'est-à-dire comme avant, sans que personne ne l'apprenne. C'est
 * précisément la panne muette qu'un catalogue doit refuser.
 */
export function planBindingIssues(
  bindings: PlanBindingFile['bindings'] = rawPlanBindings(),
  known: ReadonlySet<string> = new Set(
    rawGenericSymbolEntries().map(({ id }) => id),
  ),
): readonly SymbolIssue[] {
  const issues: SymbolIssue[] = [];
  for (const [niveau, table] of [
    ['families', bindings.families],
    ['categories', bindings.categories],
  ] as const)
    for (const [clef, symbolId] of Object.entries(table))
      if (!known.has(symbolId))
        issues.push({
          symbolId,
          path: `bindings/${niveau}/${clef}`,
          message: `names a glyph the library does not hold`,
        });
  if (!known.has(GENERIC_PLAN_SYMBOL))
    issues.push({
      symbolId: GENERIC_PLAN_SYMBOL,
      path: 'fallback',
      message: 'is the last resort of the chain and is not published',
    });
  return issues;
}

function validateSymbolDefinition(definition: SymbolDefinition): void {
  if (
    definition.id.trim() === '' ||
    definition.name.trim() === '' ||
    definition.semanticType.trim() === ''
  )
    throw new TypeError(
      'Symbol identity, name, and semantic type must not be empty.',
    );
  const values = [
    definition.viewBox.min.x,
    definition.viewBox.min.y,
    definition.viewBox.max.x,
    definition.viewBox.max.y,
  ];
  if (
    values.some((value) => !Number.isFinite(value)) ||
    definition.viewBox.min.x >= definition.viewBox.max.x ||
    definition.viewBox.min.y >= definition.viewBox.max.y
  )
    throw new RangeError(`Symbol ${definition.id} has an invalid view box.`);
  if (definition.primitives.length === 0)
    throw new TypeError(`Symbol ${definition.id} must contain a primitive.`);
  if (
    definition.scaleRules.nominalSizeMm !== undefined &&
    (!Number.isFinite(definition.scaleRules.nominalSizeMm) ||
      definition.scaleRules.nominalSizeMm <= 0)
  )
    throw new RangeError(
      `Symbol ${definition.id} has an invalid nominal size.`,
    );
  const anchorIds = new Set<string>();
  for (const anchor of definition.anchors) {
    if (
      anchor.id.trim() === '' ||
      anchorIds.has(anchor.id) ||
      !finitePoint(anchor.point)
    )
      throw new TypeError(
        `Symbol ${definition.id} has an invalid or duplicate anchor.`,
      );
    anchorIds.add(anchor.id);
  }
  for (const primitive of definition.primitives)
    validatePrimitive(definition.id, primitive);
}

function validatePrimitive(symbolId: string, primitive: SymbolPrimitive): void {
  const points =
    primitive.kind === 'LINE'
      ? [primitive.start, primitive.end]
      : primitive.kind === 'POLYLINE' || primitive.kind === 'POLYGON'
        ? primitive.points
        : primitive.kind === 'TEXT'
          ? [primitive.anchor]
          : [primitive.center];
  if (points.some((point) => !finitePoint(point)))
    throw new RangeError(`Symbol ${symbolId} contains non-finite coordinates.`);
  if (
    (primitive.kind === 'POLYLINE' && points.length < 2) ||
    (primitive.kind === 'POLYGON' && points.length < 3)
  )
    throw new RangeError(
      `Symbol ${symbolId} contains an incomplete ${primitive.kind.toLowerCase()}.`,
    );
  if (
    (primitive.kind === 'CIRCLE' || primitive.kind === 'ARC') &&
    (!Number.isFinite(primitive.radius) || primitive.radius <= 0)
  )
    throw new RangeError(`Symbol ${symbolId} contains an invalid radius.`);
  if (
    primitive.kind === 'ARC' &&
    (![primitive.startAngleDeg, primitive.endAngleDeg].every(Number.isFinite) ||
      primitive.startAngleDeg === primitive.endAngleDeg)
  )
    throw new RangeError(`Symbol ${symbolId} contains an invalid arc.`);
}

function finitePoint(point: Point2D): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}

/**
 * The symbols this application ships, as data.
 *
 * They were twenty-seven definitions written out in TypeScript with four
 * helper functions to keep them short — which works at twenty-seven and stops
 * working at three hundred: nobody reads the file, two people cannot edit it
 * at once, and no gate can read it either. A symbol is a catalogue entry like
 * any other; the last one still living in code.
 *
 * What stays here is the shape a symbol must have, the rules it must obey, and
 * the code that draws one.
 */
interface SymbolFile {
  readonly formatVersion: string;
  readonly id: string;
  readonly version: string;
  readonly licence: string;
  readonly symbols: readonly SymbolDefinition[];
}

/**
 * Every symbol file under `data/symbols`, found rather than listed.
 *
 * The tree is the list: adding a file is `git add`, and nothing else. Sorted by
 * path so that two machines, and two runs, read the glyphs in the same order.
 */
const DISCOVERED = import.meta.glob('../data/symbols/**/*.json', {
  eager: true,
  import: 'default',
}) as Readonly<Record<string, SymbolFile | undefined>>;

/**
 * Les fichiers de glyphes, c'est-à-dire ceux qui en portent.
 *
 * Le dossier tient aussi les correspondances — quel glyphe dessine quelle
 * famille — qui ne sont pas des glyphes et n'ont pas de version de catalogue à
 * elles. Reconnues à ce qu'elles ne déclarent pas de `symbols` plutôt qu'à
 * leur nom : un fichier de plus reste un `git add`, et un fichier mal nommé
 * n'entre pas dans la bibliothèque en silence.
 */
const SYMBOL_PATHS: readonly string[] = Object.keys(DISCOVERED)
  .filter((path) => Array.isArray(DISCOVERED[path]?.symbols))
  .sort();

const SYMBOL_FILES: readonly SymbolFile[] = SYMBOL_PATHS.map(
  (path) => DISCOVERED[path]!,
);

/** The files this library is made of, in a stable order. */
export function symbolCatalogSources(): readonly string[] {
  return SYMBOL_PATHS.map((path) =>
    path.replace('../', 'packages/drawing-engine/'),
  );
}

/** Every symbol as the files state them, unchecked and unrepaired. */
export function rawGenericSymbolEntries(): readonly SymbolDefinition[] {
  return SYMBOL_FILES.flatMap(({ symbols }) => symbols);
}

/** What the symbol files themselves are: their shape has a version too. */
export const GENERIC_SYMBOL_FORMAT_VERSION =
  SYMBOL_FILES[0]?.formatVersion ?? '1.0.0';

/**
 * The library, identified by the first file found.
 *
 * A second file adds glyphs to the same library rather than declaring another:
 * a drawing names a symbol, not a library, and two libraries would make the
 * same name mean two things.
 */
export const SYMBOL_LIBRARY_V1 = createSymbolLibrary(
  SYMBOL_FILES[0]?.id ?? 'generic-technical-symbols',
  SYMBOL_FILES[0]?.version ?? '1.0.0',
  rawGenericSymbolEntries(),
  SYMBOL_FILES[0]?.licence,
);
