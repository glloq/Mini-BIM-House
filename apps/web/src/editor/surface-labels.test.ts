/**
 * L'aire d'une surface est écrite là où on se la demande, et pas ailleurs.
 *
 * « Parcelle · 784,00 m² » restait posée au milieu du dessin dans les sept
 * espaces : au milieu du plan du bâtiment, elle répondait par-dessus les
 * pièces à une question que personne n'avait posée. Ce fichier tient la règle
 * qui l'a arrêtée, et il échouerait si elle disparaissait.
 */
import { describe, expect, it } from 'vitest';

import { CREATION_STAGES } from '../ux/creation-stages.js';
import { loadDemoProject } from '../demo-project.js';
import { surfaceLabels, surfaceMeasureLabel } from './surface-labels.js';

const project = (() => {
  const demo = loadDemoProject();
  if (demo.status !== 'OK') throw new Error(demo.message);
  return demo.file.project;
})();

const level = project.building.levels[0]!;
const slabId = level.slabs[0]!.id;

const labelsIn = (
  stage: (typeof CREATION_STAGES)[number],
  selection: readonly string[] = [],
) => surfaceLabels(project, level.id, selection, { stage });

describe('ce que chaque surface porte, écrit dessus', () => {
  it('écrit l’aire de la parcelle dans le Terrain', () => {
    // C'est là qu'on trace la parcelle, et donc là qu'on se demande ce qu'elle
    // fait. Une parcelle sans son aire n'apprend rien.
    const parcel = labelsIn('SITE').find(
      ({ objectId }) => objectId === 'site:parcel',
    );
    expect(parcel).toBeDefined();
    expect(surfaceMeasureLabel(parcel!)).toMatch(/^Parcelle · [\d\s,.]+ m²$/u);
  });

  it('ne l’écrit dans aucun autre espace', () => {
    // Ailleurs la parcelle est un cadre : visible, consultable, et pas le
    // sujet. Son aire par-dessus le plan du bâtiment est du bruit permanent.
    for (const stage of CREATION_STAGES) {
      if (stage === 'SITE') continue;
      expect(labelsIn(stage).map(({ objectId }) => objectId)).not.toContain(
        'site:parcel',
      );
    }
  });

  it('ne la ramène pas non plus parce qu’on l’a désignée ailleurs', () => {
    // La sélection ne rend pas un objet modifiable hors de son espace ; elle
    // ne doit pas davantage le rendre annoté. L'inspecteur donne l'aire de ce
    // qu'on désigne, et c'est lui qu'on regarde à ce moment-là.
    expect(
      labelsIn('BUILDING', ['site:parcel']).map(({ objectId }) => objectId),
    ).not.toContain('site:parcel');
    expect(
      labelsIn('SITE', ['site:parcel']).map(({ objectId }) => objectId),
    ).toContain('site:parcel');
  });

  it('traite les emprises du terrain comme la parcelle', () => {
    // Un arbre et la maison du voisin bornent le sol : ils appartiennent au
    // même espace, et leur aire se lit au même endroit.
    const inSite = labelsIn('SITE').map(({ objectId }) => objectId);
    const elsewhere = labelsIn('FITTING').map(({ objectId }) => objectId);
    for (const { id } of project.site.obstacles ?? []) {
      expect(inSite).toContain(id);
      expect(elsewhere).not.toContain(id);
    }
  });

  it('n’écrit une dalle que lorsqu’on la désigne, dans tous les espaces', () => {
    // Une maison porte plusieurs surfaces superposées : trois nombres empilés
    // au milieu du séjour se lisent moins bien qu'aucun. La règle du terrain
    // ne déborde pas sur elles.
    for (const stage of CREATION_STAGES) {
      expect(labelsIn(stage).map(({ objectId }) => objectId)).not.toContain(
        slabId,
      );
      expect(
        labelsIn(stage, [slabId]).map(({ objectId }) => objectId),
      ).toContain(slabId);
    }
  });

  it('recalcule l’aire au lieu de la retenir', () => {
    // Une aire écrite dans le modèle serait fausse au premier sommet déplacé.
    const outer = project.site.parcelBoundary!.outer;
    const half = outer.map(({ x, y }) => ({ x: x / 2, y }));
    const shrunk = {
      ...project,
      site: { ...project.site, parcelBoundary: { outer: half } },
    };
    const areaOf = (source: typeof project): number =>
      surfaceLabels(source, level.id, [], { stage: 'SITE' }).find(
        ({ objectId }) => objectId === 'site:parcel',
      )!.areaM2;
    expect(areaOf(shrunk)).toBeCloseTo(areaOf(project) / 2, 6);
  });
});
