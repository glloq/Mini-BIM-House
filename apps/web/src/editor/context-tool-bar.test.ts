import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  EDITOR_TOOLS,
  populatedToolGroups,
  toolAtLevel,
  toolDefinition,
  toolsInGroup,
} from './tool-registry.js';

/**
 * What the redesign asks of the tools, checked on the registry.
 *
 * The components themselves are rendered by the end-to-end journeys; what can
 * be checked here is the shape of what they are given.
 */
describe('the tools of the context panel', () => {
  it('leaves no tool out of a group the panel shows', () => {
    const shown = new Set(
      populatedToolGroups().flatMap((group) =>
        toolsInGroup(group).map(({ id }) => id),
      ),
    );
    for (const tool of EDITOR_TOOLS) expect(shown.has(tool.id)).toBe(true);
  });

  it('keeps every group short enough to read without searching', () => {
    // Three densities and no more; past about ten entries a list needs a
    // search, and a tool group that needs a search is a group to split.
    for (const group of populatedToolGroups())
      expect(toolsInGroup(group).length).toBeLessThanOrEqual(10);
  });

  it('shows the common tools and folds the rest away, for everyone', () => {
    // No « simple » and « expert » modes: one screen, with the advanced tools
    // one disclosure away rather than in another product.
    for (const group of populatedToolGroups()) {
      const tools = toolsInGroup(group);
      const common = tools.filter((tool) => toolAtLevel(tool, 'DESIGN'));
      expect(
        common.length +
          tools.filter((tool) => !toolAtLevel(tool, 'DESIGN')).length,
      ).toBe(tools.length);
      // A group whose every tool is advanced would show as an empty group with
      // a disclosure under it.
      expect(common.length).toBeGreaterThan(0);
    }
  });

  it('offers selection as the resting state rather than as a tool to pick', () => {
    const select = toolDefinition('SELECT');
    expect(select.requiredPoints).toBe(0);
    expect(toolAtLevel(select, 'QUICK')).toBe(true);
  });
});

describe('la bande ne déplace pas les menus de l’outil', () => {
  /*
   * Ce qui se passait, et pourquoi c'est une panne.
   *
   * La rangée flotte sur les trente-quatre premiers pixels du plan — un choix
   * assumé : une rangée qui pousse le dessin le fait changer d'échelle, et le
   * point qu'on visait n'est plus là. Mais dès le premier sommet posé, la
   * barre de contexte gagne « Fermer la surface », « Annuler dernier sommet »,
   * « Annuler le tracé » et les mesures ; large comme son contenu, elle
   * poussait d'autant les listes de l'outil — l'assemblage, le contour — vers
   * la droite, sous le pointeur, au milieu du geste. Relevé de bout en bout sur
   * la maison de démonstration avec l'outil « Dalle libre », dans une bande de
   * 1 036 px : 277 px au premier clic, 290 au deuxième, 335 au troisième.
   *
   * La barre prend donc, quand l'outil a des menus, une largeur décidée
   * d'avance plutôt que celle de ce qu'elle porte, et les menus commencent au
   * même pixel avant et après. Le déplacement se mesure de bout en bout ; ce
   * qui se vérifie ici est que les trois déclarations qui l'ancrent sont
   * toujours là, parce qu'une feuille de style se perd sans bruit.
   */
  const styles = readFileSync(
    new URL('../styles.css', import.meta.url),
    'utf8',
  );

  /** Le corps d'une règle, du sélecteur à l'accolade fermante. */
  const body = (selector: string): string => {
    const start = styles.indexOf(`${selector} {`);
    expect(start, selector).toBeGreaterThanOrEqual(0);
    const rule = styles.slice(start);
    return rule.slice(0, rule.indexOf('}'));
  };

  it('donne à la barre une largeur décidée d’avance, et non celle de son contenu', () => {
    // 663 px de barre pour 1 020 px utiles une fois le tracé commencé, soit un
    // peu moins des deux tiers : on lui donne les deux tiers, plafonnés à ce
    // qu'elle réclame pour qu'un grand écran rende le surplus aux menus.
    expect(body('.tool-line:has(> .tool-group) .context-tool-bar')).toContain(
      'flex: 0 0 min(65%, 42rem);',
    );
  });

  it('laisse aux menus de l’outil la place qui reste', () => {
    expect(body('.tool-line > .tool-group')).toContain('flex: 1 1 0;');
  });

  it('donne le mou à la phrase, qui est la seule chose qu’on accepte de couper', () => {
    expect(
      body('.tool-line .context-tool-bar > .context-instruction'),
    ).toContain('flex: 1 1 auto;');
  });
});
