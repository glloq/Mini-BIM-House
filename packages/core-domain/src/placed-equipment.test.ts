import { describe, expect, it } from 'vitest';
import { clearanceReport } from './clearance-analysis.js';
import { entityId } from './ids.js';
import {
  placedEquipment,
  placedEquipmentByFamily,
  placedEquipmentByKind,
  placedEquipmentBySpace,
} from './placed-equipment.js';
import type { Project } from './types.js';

const ground = entityId<'Level'>('ground');

function component(id: string, extra: object = {}) {
  return {
    id: entityId<'ComponentInstance'>(id),
    type: 'COMPONENT_INSTANCE' as const,
    levelId: ground,
    category: 'HEATING' as const,
    position: { x: 1000, y: 2000 },
    elevationMm: 300,
    rotationDeg: 0,
    ...extra,
  };
}

function project(components: readonly object[], equipment: readonly object[]) {
  return {
    id: entityId<'Project'>('project'),
    metadata: {
      name: 'Projet',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
    site: { northAngleDeg: 0 },
    building: {
      levels: [
        {
          id: ground,
          name: 'RDC',
          elevationMm: 2700,
          defaultStoreyHeightMm: 2500,
          walls: [],
          openings: [],
          slabs: [],
          roofs: [],
          spaces: [],
          stairs: [],
          annotations: [],
          components,
        },
      ],
      zones: [],
    },
    equipment,
  } as unknown as Project;
}

const radiatorModel = {
  id: 'radiator-model',
  familyId: 'RADIATOR',
  kind: 'RADIATOR',
  catalogKind: 'GENERIC',
  version: '1.0.0',
  name: 'Radiateur générique',
  properties: { nominalOutputW: 1000 },
  ports: [{ id: 'flow', portTypeId: 'HEATING_FLOW' }],
  clearances: [{ zone: 'USAGE', frontMm: 150 }],
  dimensions: { widthMm: 800, depthMm: 100, heightMm: 600 },
  provenance: { type: 'GENERIC', reference: 'Valeurs génériques' },
};

describe('what actually stands in the building', () => {
  it('puts the model and the placement together', () => {
    const [placed] = placedEquipment(
      project(
        [
          component('rad-1', {
            definitionId: 'radiator-model',
            definitionVersion: '1.0.0',
          }),
        ],
        [radiatorModel],
      ),
    );
    expect(placed?.familyId).toBe('RADIATOR');
    expect(placed?.kind).toBe('RADIATOR');
    expect(placed?.definitionProperties.nominalOutputW).toBe(1000);
    expect(placed?.ports.map(({ portTypeId }) => portTypeId)).toEqual([
      'HEATING_FLOW',
    ]);
    expect(placed?.clearances.map(({ zone }) => zone)).toEqual(['USAGE']);
    expect(placed?.issues).toEqual([]);
  });

  it('counts three radiators as three, which is the whole point', () => {
    // The calculations read the catalogue alone, so a project with three
    // radiators and a project with one were the same project.
    const placed = placedEquipment(
      project(
        ['rad-1', 'rad-2', 'rad-3'].map((id) =>
          component(id, { definitionId: 'radiator-model' }),
        ),
        [radiatorModel],
      ),
    );
    expect(placed).toHaveLength(3);
    expect(placedEquipmentByKind(placed).RADIATOR).toHaveLength(3);
    expect(placedEquipmentByFamily(placed).RADIATOR).toHaveLength(3);
  });

  it('counts the height from the ground, not from the floor it stands on', () => {
    // A calculation comparing two storeys cannot do it from two heights above
    // two different floors.
    const [placed] = placedEquipment(
      project([component('rad-1')], [radiatorModel]),
    );
    expect(placed?.position.z).toBe(3000);
  });

  it('lets this one override what its model says, and keeps both readable', () => {
    const [placed] = placedEquipment(
      project(
        [
          component('rad-1', {
            definitionId: 'radiator-model',
            properties: { nominalOutputW: 1500 },
          }),
        ],
        [radiatorModel],
      ),
    );
    expect(placed?.definitionProperties.nominalOutputW).toBe(1000);
    expect(placed?.instanceProperties.nominalOutputW).toBe(1500);
    expect(placed?.resolvedProperties.nominalOutputW).toBe(1500);
  });

  it('says when a placement names a model the project no longer holds', () => {
    const [placed] = placedEquipment(
      project([component('rad-1', { definitionId: 'gone' })], []),
    );
    expect(placed?.issues.join(' ')).toContain('names no model');
  });

  it('says when the project has moved past the version that was placed', () => {
    const [placed] = placedEquipment(
      project(
        [
          component('rad-1', {
            definitionId: 'radiator-model',
            definitionVersion: '0.9.0',
          }),
        ],
        [radiatorModel],
      ),
    );
    expect(placed?.issues.join(' ')).toContain('now holds 1.0.0');
  });

  it('expose où chaque raccordement se trouve sur l’appareil', () => {
    /*
     * La fiche le dit — un radiateur part et revient à 480 mm de part et
     * d'autre de son axe, 20 mm au-dessus de son dessous — et ce type ne
     * l'exposait pas : un port n'y était qu'un identifiant et un genre. Tout ce
     * qui lit un appareil posé plaçait donc ses raccordements au point où
     * l'appareil se tient, et sur une évacuation, où la hauteur **est** le
     * calcul, les pentes que « Raccorder au réseau » proposait allaient de 12 à
     * 35 % au lieu de 1 à 3 %.
     *
     * Le décalage est rendu tel que la fiche l'écrit — dans le repère de
     * l'appareil, avant rotation —, parce que c'est la fiche du modèle et
     * qu'elle est la même pour les trois radiateurs identiques : elle ne peut
     * pas savoir comment celui-ci est tourné. C'est à qui la lit d'appliquer
     * `rotationDeg`, qui est rendu à côté.
     */
    const [placed] = placedEquipment(
      project(
        [
          component('rad-1', {
            definitionId: 'radiator-model',
            rotationDeg: 90,
          }),
        ],
        [
          {
            ...radiatorModel,
            ports: [
              {
                id: 'flow',
                portTypeId: 'HEATING_FLOW',
                position: { x: -480, y: 0, z: 20 },
              },
              { id: 'return', portTypeId: 'HEATING_RETURN' },
            ],
          },
        ],
      ),
    );
    expect(placed?.ports[0]?.position).toEqual({ x: -480, y: 0, z: 20 });
    // Non tourné : c'est le décalage de la fiche, pas celui du plan.
    expect(placed?.rotationDeg).toBe(90);
    // Une fiche qui ne situe pas un raccordement n'en gagne pas un inventé.
    expect(placed?.ports[1]?.position).toBeUndefined();
  });

  it('n’a qu’une origine, et c’est celle depuis laquelle la fiche compte', () => {
    /*
     * Le repère des ports, écrit en une assertion plutôt qu'en une phrase.
     *
     * Un appareil posé n'a qu'un point de référence dans ce modèle, et deux
     * endroits le nomment : `position` — que `resolveOne` calcule ici — et le
     * volume physique que `clearanceZones` construit du même appareil, dont la
     * base **est** cette altitude et le sommet cette altitude plus la hauteur
     * de la fiche. Tant que ces deux-là s'accordent, « le décalage part de
     * l'origine » suffit à situer un raccordement, sans les dimensions.
     *
     * Ce que ce contrôle interdit est précisément ce qui s'était installé : un
     * catalogue comptant z depuis le **centre** de la boîte pendant que la pose
     * situe le dessous, soit deux origines pour un appareil, et 288
     * raccordements de 175 fiches sous le plancher.
     *
     * Le radiateur de ce fichier est posé 300 mm au-dessus d'un plancher qui
     * est lui-même à 2 700 : son dessous est donc à 3 000 et son dessus à
     * 3 600, sa fiche faisant 600 mm de haut.
     */
    const held = project(
      [component('rad-1', { definitionId: 'radiator-model' })],
      [
        {
          ...radiatorModel,
          ports: [
            {
              id: 'bas',
              portTypeId: 'HEATING_FLOW',
              position: { x: 0, y: 0, z: 0 },
            },
            {
              id: 'haut',
              portTypeId: 'HEATING_RETURN',
              position: { x: 0, y: 0, z: 600 },
            },
          ],
        },
      ],
    );
    const [placed] = placedEquipment(held);
    expect(placed?.position.z).toBe(3000);
    const physical = clearanceReport(held).zones.find(
      ({ objectId, zone }) => objectId === 'rad-1' && zone === 'PHYSICAL',
    );
    expect(physical?.baseMm).toBe(placed?.position.z);
    expect(physical?.topMm).toBe(3600);
    // Un raccordement à z = 0 est sur le dessous de l'appareil, un autre à la
    // hauteur de la fiche est sur son dessus : rien entre les deux ne sort.
    const heights = (placed?.ports ?? []).map(
      ({ position }) => placed!.position.z + (position?.z ?? 0),
    );
    expect(heights).toEqual([3000, 3600]);
  });

  it('groups by the room each one stands in', () => {
    const placed = placedEquipment(
      project(
        [
          component('rad-1', { spaceId: 'living' }),
          component('rad-2', { spaceId: 'living' }),
          component('rad-3', { spaceId: 'bedroom' }),
        ],
        [radiatorModel],
      ),
    );
    expect(placedEquipmentBySpace(placed).living).toHaveLength(2);
    expect(placedEquipmentBySpace(placed).bedroom).toHaveLength(1);
  });
});
