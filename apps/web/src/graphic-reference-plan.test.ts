import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ARCHITECTURAL_CLEAN_SCREEN,
  GENERIC_TECHNICAL_SCREEN,
  renderSemanticSceneToSvg,
  resolveGraphicToken,
  type ScenePrimitive,
} from '@house-technical-designer/drawing-engine';
import { polygonContains } from '@house-technical-designer/geometry';
import { loadProjectJson } from '@house-technical-designer/project-io/files';
import {
  LAYER_PRESETS,
  buildPlanView,
  presetVisibility,
} from '@house-technical-designer/view-query';
import { exportProjectPlan } from './project-workspace.js';

/**
 * La maison sur laquelle le moteur graphique est jugé.
 *
 * La fixture principale est un rectangle de dix mètres sur huit : elle prouve
 * qu'un plan peut être produit et ne dit rien de sa lisibilité. Celle-ci a ce
 * qu'un rectangle n'a pas — trois chambres, un dégagement, un cellier dont le
 * nom ne tient pas, une baie, une porte de garage, des pièces humides
 * meublées et quatorze murs qui se rencontrent de cinq façons.
 *
 * Une comparaison de pixels sur trois moteurs de rendu répondrait à une autre
 * question, et y répondrait différemment sur chaque machine. Les captures sont
 * donc des SVG : la différence se lit comme un diff, et ce qui suit vérifie en
 * plus, un par un, les critères que ces captures sont censées satisfaire.
 */
const file = (() => {
  const loaded = loadProjectJson(
    readFileSync(
      'examples/graphic-reference-house/reference.houseproj.json',
      'utf8',
    ),
  );
  if (loaded.status !== 'OK')
    throw new Error(`La maison de référence graphique est invalide.`);
  return loaded.file;
})();

const preset = (id: string) =>
  presetVisibility(LAYER_PRESETS.find((entry) => entry.id === id)!);

/**
 * Le même jeu de calques, sans le terrain.
 *
 * Un plan de niveau montre le bâtiment ; la parcelle est le sujet d'un plan de
 * masse, et la faire tenir dans le cadre réduit la maison au quart de la
 * feuille. La capture cadre donc ce qu'elle est censée juger.
 */
const sheetLayers = (id: string) => ({
  ...preset(id),
  'site.parcel': false,
});

const drawn = (scale = 50, presetId = 'architecture') =>
  buildPlanView(file.project, {
    layers: preset(presetId),
    scale,
    graphicProfileId: ARCHITECTURAL_CLEAN_SCREEN.profile.id,
  }).primitives;

const find = (
  primitives: readonly ScenePrimitive[],
  id: string,
): ScenePrimitive | undefined => primitives.find((entry) => entry.id === id);

const strokeOf = (
  primitive: ScenePrimitive | undefined,
  bundle = ARCHITECTURAL_CLEAN_SCREEN,
): number => {
  const token = resolveGraphicToken(bundle.profile, primitive!);
  return bundle.styles.tokens[token!]?.strokeWidthPaperMm ?? 0;
};

const fillOf = (
  primitive: ScenePrimitive | undefined,
  bundle = ARCHITECTURAL_CLEAN_SCREEN,
): string | undefined =>
  bundle.styles.tokens[resolveGraphicToken(bundle.profile, primitive!)!]?.fill;

describe('the reference house the charter is judged on', () => {
  it('holds the programme the drawing has to cope with', () => {
    const level = file.project.building.levels[0]!;
    const rooms = level.spaces.map(({ category }) => category);
    expect(rooms.filter((category) => category === 'BEDROOM')).toHaveLength(3);
    for (const category of [
      'LIVING_KITCHEN',
      'BATHROOM',
      'WC',
      'CORRIDOR',
      'STORAGE',
      'GARAGE',
      'HALL',
      'OFFICE',
    ])
      expect(rooms).toContain(category);
    expect(level.walls.length).toBeGreaterThanOrEqual(14);
    expect(level.openings.length).toBeGreaterThanOrEqual(20);
    expect(level.components?.length ?? 0).toBeGreaterThanOrEqual(15);
  });

  it('draws itself without a single unresolved reference', () => {
    expect(
      buildPlanView(file.project, { layers: preset('architecture') }).issues,
    ).toEqual([]);
  });
});

describe('the criteria the drawing is accepted on', () => {
  it('makes the outer walls carry the building', () => {
    const plan = drawn();
    expect(strokeOf(find(plan, 'wall:wall-south'))).toBeGreaterThan(
      strokeOf(find(plan, 'wall:wall-corridor-south')),
    );
    expect(strokeOf(find(plan, 'wall:wall-corridor-south'))).toBeGreaterThan(
      strokeOf(find(plan, 'wall:wall-bed-1-2')),
    );
  });

  it('keeps the make-up of the walls out of the architectural drawing', () => {
    expect(
      drawn().filter(({ layer }) => layer === 'architecture.wall-layers'),
    ).toEqual([]);
    // And puts it back on the materials drawing, which is what it is for.
    expect(
      drawn(50, 'materials').filter(
        ({ layer }) => layer === 'architecture.wall-layers',
      ).length,
    ).toBeGreaterThan(0);
  });

  it('closes every junction two walls make', () => {
    const patches = drawn().filter(({ id }) => id.startsWith('wall-join:'));
    expect(patches.length).toBeGreaterThanOrEqual(14);
    for (const patch of patches) expect(patch.geometry.kind).toBe('POLYGON');
  });

  it('breaks the wall for every opening', () => {
    const plan = drawn();
    for (const opening of file.project.building.levels[0]!.openings)
      expect(find(plan, `opening:${opening.id}`)?.semanticRole).toBe(
        'OPENING_REVEAL',
      );
  });

  it('shows every hinged door swinging somewhere in particular', () => {
    const plan = drawn();
    const hinged = plan.filter(
      ({ id, metadata }) =>
        id.startsWith('opening-swing') && metadata?.part === 'SWING',
    );
    expect(hinged.length).toBeGreaterThanOrEqual(9);
    // The sliding one sweeps nothing, and the garage panel is overhead.
    expect(find(plan, 'opening-swing:door-garage-service')).toBeUndefined();
    expect(find(plan, 'opening-leaf:door-garage-service')).toBeDefined();
    expect(find(plan, 'opening-panel:opening-garage-door')).toBeDefined();
  });

  it('washes each room with the colour of what it is for', () => {
    const plan = drawn();
    const fills = new Map(
      ['space-bed-1', 'space-bath', 'space-garage', 'space-living'].map(
        (id) => [id, fillOf(find(plan, `space:${id}`))],
      ),
    );
    expect(new Set(fills.values()).size).toBe(4);
    for (const fill of fills.values()) expect(fill).toMatch(/^#[0-9A-F]{6}$/iu);
    // Two bedrooms are the same room to a drawing.
    expect(fillOf(find(plan, 'space:space-bed-1'))).toBe(
      fillOf(find(plan, 'space:space-bed-2')),
    );
  });

  it('sets a room name and its area in two levels', () => {
    const plan = drawn();
    const name = resolveGraphicToken(
      ARCHITECTURAL_CLEAN_SCREEN.profile,
      find(plan, 'space-label-name:space-bed-1')!,
    );
    const area = resolveGraphicToken(
      ARCHITECTURAL_CLEAN_SCREEN.profile,
      find(plan, 'space-label-area:space-bed-1')!,
    );
    expect(
      ARCHITECTURAL_CLEAN_SCREEN.styles.tokens[name!]?.fontSizePaperMm,
    ).toBeGreaterThan(
      ARCHITECTURAL_CLEAN_SCREEN.styles.tokens[area!]?.fontSizePaperMm ?? 0,
    );
  });

  it('never writes a room name outside its room', () => {
    const plan = drawn();
    for (const space of file.project.building.levels[0]!.spaces) {
      const label = find(plan, `space-label-name:${space.id}`);
      const fill = find(plan, `space:${space.id}`);
      if (label === undefined) continue;
      if (label.geometry.kind !== 'TEXT' || fill?.geometry.kind !== 'POLYGON')
        continue;
      expect(
        polygonContains(fill.geometry.polygon, label.geometry.anchor),
      ).toBe(true);
    }
  });

  it('writes less on the same plan when the sheet gets smaller', () => {
    // The same room too small for two lines at 1:100 is too small for two
    // lines, and nothing is written rather than written into the room next
    // door.
    const near = drawn(50).filter(({ id }) =>
      id.startsWith('space-label-area:'),
    ).length;
    const far = drawn(200).filter(({ id }) =>
      id.startsWith('space-label-area:'),
    ).length;
    expect(far).toBeLessThan(near);
  });

  it('keeps the fixtures and the dimensions behind the building', () => {
    const plan = drawn();
    const bath = plan.find(
      ({ sourceObjectId }) => sourceObjectId === 'fixture-bathtub',
    );
    expect(bath).toBeDefined();
    expect(strokeOf(bath)).toBeLessThan(
      strokeOf(find(plan, 'wall:wall-bed-1-2')),
    );
    expect(
      ARCHITECTURAL_CLEAN_SCREEN.styles.tokens.dimension?.strokeWidthPaperMm,
    ).toBeLessThan(
      ARCHITECTURAL_CLEAN_SCREEN.styles.tokens['wall-partition']!
        .strokeWidthPaperMm!,
    );
  });

  it('keeps selection and hover visible against a much lighter drawing', () => {
    const states = ARCHITECTURAL_CLEAN_SCREEN.styles.stateOverrides!;
    expect(states.SELECTED?.stroke).toBeDefined();
    expect(states.HOVER?.stroke).toBeDefined();
    expect(states.SELECTED?.stroke).not.toBe(states.HOVER?.stroke);
  });

  it('leaves the technical charter able to draw the same house', () => {
    const technical = buildPlanView(file.project, {
      layers: preset('synthesis'),
      graphicProfileId: GENERIC_TECHNICAL_SCREEN.profile.id,
    });
    expect(technical.issues).toEqual([]);
    for (const primitive of technical.primitives)
      expect(
        resolveGraphicToken(GENERIC_TECHNICAL_SCREEN.profile, primitive),
      ).toBeDefined();
  });
});

describe('the captures', () => {
  const screenSheet = (
    scale: number,
    presetId: string,
    bundle: typeof ARCHITECTURAL_CLEAN_SCREEN,
  ): string => {
    const plan = buildPlanView(file.project, {
      layers: sheetLayers(presetId),
      scale,
      dimensions: 'PROJECT_AND_OVERALL',
      graphicProfileId: bundle.profile.id,
    });
    return renderSemanticSceneToSvg(
      plan.scene,
      plan.view,
      bundle.profile,
      bundle.styles,
      { includeSemanticGroups: true },
    );
  };

  it.each([
    ['architectural-1-50', 50, 'architecture', ARCHITECTURAL_CLEAN_SCREEN],
    ['architectural-1-100', 100, 'architecture', ARCHITECTURAL_CLEAN_SCREEN],
    ['technical-1-50', 50, 'synthesis', GENERIC_TECHNICAL_SCREEN],
    ['materials-1-50', 50, 'materials', ARCHITECTURAL_CLEAN_SCREEN],
  ] as const)(
    'matches the stored %s sheet',
    async (name, scale, presetId, bundle) => {
      await expect(screenSheet(scale, presetId, bundle)).toMatchFileSnapshot(
        `./__snapshots__/graphic-reference-${name}.svg`,
      );
    },
  );

  it('prints through the very pipeline the screen draws with', async () => {
    // Not a second renderer for paper: the same semantic scene, the printed
    // charter of the same family, and the same SVG writer.
    const artifact = exportProjectPlan(file, {
      layers: sheetLayers('print'),
      scale: 50,
      graphicProfileId: ARCHITECTURAL_CLEAN_SCREEN.profile.id,
      dimensions: 'PROJECT_AND_OVERALL',
    });
    expect(artifact.content).toContain('architectural-clean-print');
    await expect(artifact.content).toMatchFileSnapshot(
      './__snapshots__/graphic-reference-architectural-print-1-50.svg',
    );
  });
});
