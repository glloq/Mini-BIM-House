import { describe, expect, it } from 'vitest';
import { ProjectCommandDispatcher } from '@house-technical-designer/editor-core';
import { SetSiteUnderlayCommand } from '@house-technical-designer/editor-core';

import { loadDemoProject } from '../demo-project.js';
import { underlayAtWidth } from './underlay-file.js';

const demo = loadDemoProject();
if (demo.status === 'ERROR') throw new Error(demo.message);
const project = demo.file.project;

const underlay = {
  image: 'data:image/png;base64,iVBORw0KGgo=',
  originMm: { x: -2000, y: -1000 },
  widthMm: 20_000,
  heightMm: 15_000,
  opacity: 0.55,
  name: 'cadastre.png',
};

describe('le calque de papier', () => {
  it('garde son rapport quand on dit ce qu’il mesure', () => {
    // Personne ne connaît la hauteur d'un cadastre ; tout le monde connaît la
    // longueur d'une façade. La hauteur suit.
    const wider = underlayAtWidth(underlay, 40_000);
    expect(wider.widthMm).toBe(40_000);
    expect(wider.heightMm).toBe(30_000);
    expect(wider.image).toBe(underlay.image);
  });

  it('se pose et se retire sans rien emporter', () => {
    /*
     * Ce n'est pas un objet du modèle : il n'entre dans aucun calcul, aucune
     * nomenclature, aucune vérification. Le retirer laisse le projet exactement
     * comme il était.
     */
    const commands = new ProjectCommandDispatcher(project);
    expect(commands.dispatch(new SetSiteUnderlayCommand(underlay)).status).toBe(
      'APPLIED',
    );
    expect(commands.project.site.underlay).toEqual(underlay);
    expect(commands.project.building).toEqual(project.building);

    expect(
      commands.dispatch(new SetSiteUnderlayCommand(undefined)).status,
    ).toBe('APPLIED');
    expect(commands.project.site.underlay).toBeUndefined();
    expect(commands.project.site).toEqual(project.site);
  });

  it('refuse une image qui ne mesure rien', () => {
    const commands = new ProjectCommandDispatcher(project);
    const refused = commands.dispatch(
      new SetSiteUnderlayCommand({ ...underlay, widthMm: 0 }),
    );
    expect(refused.status).toBe('REJECTED');
    if (refused.status !== 'REJECTED') return;
    expect(refused.errors.join(' ')).toContain('largeur');
  });

  it('refuse une opacité hors du tour', () => {
    const commands = new ProjectCommandDispatcher(project);
    expect(
      commands.dispatch(new SetSiteUnderlayCommand({ ...underlay, opacity: 4 }))
        .status,
    ).toBe('REJECTED');
  });
});
