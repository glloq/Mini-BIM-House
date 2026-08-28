/**
 * Le même plan, dessiné depuis chaque espace de création.
 *
 * `ux/ownership.ts` dit qu'un objet ne se modifie que dans son espace. Rien à
 * l'écran ne le disait : la parcelle, le mur et la gaine avaient partout le
 * même poids, si bien qu'on tirait depuis le Bâtiment sur une limite de
 * terrain qui refusait sans qu'on comprenne pourquoi.
 *
 * Ce fichier vérifie la moitié visible de cette règle **sur le dessin
 * produit**, et non sur la table qui la décrit : c'est la seule façon de
 * savoir que le composant du plan passe bien par le moteur graphique, et que
 * le moteur n'a pas simplement une belle table que personne n'appelle.
 */
import { describe, expect, it } from 'vitest';

import {
  ARCHITECTURAL_CLEAN_SCREEN,
  DRAWING_SPACES,
  graphicProfileForStage,
  renderSemanticSceneToSvg,
} from '@house-technical-designer/drawing-engine';
import {
  buildPlanView,
  defaultVisibility,
} from '@house-technical-designer/view-query';

import {
  CREATION_STAGES,
  type CreationStageId,
} from '../ux/creation-stages.js';
import { loadDemoProject } from '../demo-project.js';

const project = (() => {
  const demo = loadDemoProject();
  if (demo.status !== 'OK') throw new Error(demo.message);
  return demo.file.project;
})();

const levelId = project.building.levels[0]!.id;

/** Le plan, dessiné exactement comme le composant du plan le dessine. */
function draw(stage: CreationStageId): string {
  const charter = graphicProfileForStage(ARCHITECTURAL_CLEAN_SCREEN, stage);
  const plan = buildPlanView(project, {
    levelId,
    layers: { ...defaultVisibility(), 'architecture.roofs': true },
    graphicProfileId: charter.profile.id,
  });
  return renderSemanticSceneToSvg(
    plan.scene,
    plan.view,
    charter.profile,
    charter.styles,
    { includeInteractionStates: true, includeSemanticGroups: true },
  );
}

/** Le style que le dessin porte, pour l'objet qu'on nomme. */
function styleOf(svg: string, id: string): string {
  const found = new RegExp(`id="${id}"[^>]*?style="([^"]*)"`, 'u').exec(svg);
  expect(found, `le plan ne dessine pas ${id}`).not.toBeNull();
  return found![1]!;
}

/** Ce que le dessin déclare pour une propriété, quand il la déclare. */
function declared(style: string, property: string): string | undefined {
  return style
    .split(';')
    .find((entry) => entry.startsWith(`${property}:`))
    ?.slice(property.length + 1);
}

const opacityOf = (style: string): number =>
  Number(declared(style, 'opacity') ?? '1');

const wallId = `wall:${project.building.levels[0]!.walls[0]!.id}`;

describe('le plan lu depuis l’espace ouvert', () => {
  it('nomme les mêmes sept espaces que la coque', () => {
    // Le moteur graphique ne dépend pas de l'application, et réécrit donc la
    // liste. Un huitième espace doit casser ici, avant que le dessin ne fasse
    // semblant de le connaître.
    expect([...DRAWING_SPACES]).toEqual([...CREATION_STAGES]);
  });

  it('dessine la maison dans chacun d’eux sans jamais rester sans style', () => {
    // Un jeton dégradé qu'aucune charte ne porterait ne se verrait qu'ici.
    for (const stage of CREATION_STAGES)
      expect(draw(stage)).toContain('data-layer="site.parcel"');
  });

  it('montre la parcelle au Terrain et la laisse en fond ailleurs', () => {
    const inSite = styleOf(draw('SITE'), 'site:ground');
    expect(declared(inSite, 'fill')).not.toBe('none');
    for (const stage of ['BUILDING', 'FITTING', 'SYSTEMS'] as const)
      expect(opacityOf(styleOf(draw(stage), 'site:ground'))).toBeLessThan(
        opacityOf(inSite),
      );
  });

  it('met les murs devant au Bâtiment, et derrière dans les Systèmes', () => {
    // Un mur reste visible partout — on route une gaine contre un mur — mais
    // il cesse d'être ce qu'on lit en premier dès qu'on n'est plus venu pour
    // lui.
    const inBuilding = styleOf(draw('BUILDING'), wallId);
    const inSystems = styleOf(draw('SYSTEMS'), wallId);
    expect(inSystems).not.toBe(inBuilding);
    expect(opacityOf(inSystems)).toBeLessThan(opacityOf(inBuilding));
    expect(opacityOf(inSystems)).toBeGreaterThan(0.4);
  });

  it('laisse le plan entier là où on le regarde en entier', () => {
    // Griser la moitié du dessin pendant qu'on cherche pourquoi une pièce est
    // trop froide reviendrait à cacher la réponse.
    const whole = draw('CHECKS');
    expect(whole).toBe(draw('DOCUMENTS'));
    expect(styleOf(whole, wallId)).toBe(styleOf(draw('BUILDING'), wallId));
  });

  it('ne change pas de charte en changeant d’espace', () => {
    // Une vue enregistrée nomme une charte, pas un moment de la séance : le
    // rendu refuse de dessiner si les deux cessent de coïncider, et un plan
    // exporté depuis le Terrain doit sortir comme un plan exporté d'ailleurs.
    for (const stage of CREATION_STAGES)
      expect(graphicProfileForStage(ARCHITECTURAL_CLEAN_SCREEN, stage).id).toBe(
        ARCHITECTURAL_CLEAN_SCREEN.id,
      );
  });
});
