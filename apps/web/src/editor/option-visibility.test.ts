import { describe, expect, it } from 'vitest';
import type { Project } from '@house-technical-designer/core-domain';
import { loadDemoProject } from '../demo-project.js';
import { toolOptionLayout, visibleToolOptions } from './option-visibility.js';
import { optionValue, type ToolDrafts } from './tool-options.js';
import { EDITOR_TOOLS, optionsOf, type EditorTool } from './tool-registry.js';

function project(): Project {
  const result = loadDemoProject();
  if (result.status !== 'OK') throw new Error(result.message);
  return result.file.project;
}

/** Les clés offertes d'emblée, dans l'ordre où la barre les pose. */
function offeredAtOnce(
  tool: EditorTool,
  drafts: ToolDrafts = {},
  onProject: Project = project(),
): readonly string[] {
  return toolOptionLayout(onProject, tool, optionsOf(tool), drafts).primary.map(
    ({ option }) => option.key,
  );
}

/** Les clés repliées derrière « Plus de réglages ». */
function foldedAway(
  tool: EditorTool,
  drafts: ToolDrafts = {},
): readonly string[] {
  return toolOptionLayout(
    project(),
    tool,
    optionsOf(tool),
    drafts,
  ).advanced.map(({ option }) => option.key);
}

describe('ce que l’outil demande au moment du placement', () => {
  it('ne pose pas, pour une parcelle, les questions d’un obstacle', () => {
    // Le cas nommé par l'audit : « Tracer / Nature / Hauteur / Nom », alors
    // qu'une parcelle n'a ni nature, ni hauteur, ni nom.
    expect(offeredAtOnce('SITE')).toEqual(['target']);
    expect(foldedAway('SITE')).toEqual([]);
  });

  it('les repose dès qu’un obstacle est ce que l’on trace', () => {
    const drafts = { 'SITE.target': 'OBSTACLE' };
    expect(offeredAtOnce('SITE', drafts)).toEqual([
      'target',
      'kind',
      'heightMm',
    ]);
    // Le nom reste possible, mais on ne le demande pas pour tracer.
    expect(foldedAway('SITE', drafts)).toEqual(['name']);
  });

  it('offre du mur ce qui décide du mur, et replie le reste', () => {
    expect(offeredAtOnce('WALL')).toEqual(['assemblyId', 'referenceSide']);
    expect(foldedAway('WALL')).toEqual(['role']);
  });

  it('ne nomme pas une pièce quand on les crée toutes d’un coup', () => {
    expect(offeredAtOnce('SPACE')).toEqual(['name', 'category', 'scope']);
    expect(offeredAtOnce('SPACE', { 'SPACE.scope': 'ALL' })).toEqual([
      'category',
      'scope',
    ]);
  });

  it('ne demande une pente qu’aux réseaux qui s’écoulent', () => {
    // Le réseau est partagé entre les outils : sa clé n'est pas préfixée.
    expect(offeredAtOnce('NETWORK_ROUTE', { networkId: 'water' })).toEqual([
      'networkId',
    ]);
    expect(offeredAtOnce('NETWORK_ROUTE', { networkId: 'wastewater' })).toEqual(
      ['networkId', 'slopePercent'],
    );
  });
});

describe('masquer n’est pas effacer', () => {
  it('garde la nature choisie pendant qu’on trace une parcelle', () => {
    // On choisit une terrasse, on repasse sur la parcelle : le champ quitte
    // l'écran. Ce que l'outil lira, lui, n'a pas bougé — c'est toute la
    // différence entre une décision d'affichage et une décision de modèle.
    const drafts = { 'SITE.kind': 'TERRACE', 'SITE.target': 'PARCEL' };
    const options = optionsOf('SITE');
    expect(
      visibleToolOptions(project(), 'SITE', options, drafts).map(
        ({ key }) => key,
      ),
    ).toEqual(['target']);
    expect(optionValue(project(), 'SITE', options, drafts, 'kind')).toBe(
      'TERRACE',
    );

    const back = { ...drafts, 'SITE.target': 'OBSTACLE' };
    const offered = toolOptionLayout(project(), 'SITE', options, back).primary;
    expect(offered.find(({ option }) => option.key === 'kind')?.value).toBe(
      'TERRACE',
    );
  });

  it('garde ce qui est replié, et dit combien de réglages ne sont plus d’origine', () => {
    const options = optionsOf('WALL');
    const drafts = { 'WALL.role': 'INTERIOR' };
    const layout = toolOptionLayout(project(), 'WALL', options, drafts);
    expect(
      layout.advanced.map(({ option, value }) => [option.key, value]),
    ).toEqual([['role', 'INTERIOR']]);
    expect(layout.changedAdvanced).toBe(1);
    expect(optionValue(project(), 'WALL', options, drafts, 'role')).toBe(
      'INTERIOR',
    );
    // Rien de touché, rien à signaler : le dépliage ne cache alors que des
    // valeurs par défaut, et le dire serait crier au loup.
    expect(
      toolOptionLayout(project(), 'WALL', options, {}).changedAdvanced,
    ).toBe(0);
  });

  it('rend inerte, sans le masquer, ce à quoi on ne peut pas encore répondre', () => {
    const without: Project = { ...project(), systems: [] };
    const layout = toolOptionLayout(
      without,
      'NETWORK',
      optionsOf('NETWORK'),
      {},
    );
    const nodeKind = layout.primary.find(
      ({ option }) => option.key === 'nodeKind',
    );
    expect(nodeKind).toBeDefined();
    expect(nodeKind?.enabled).toBe(false);
    // Avec un réseau, la même question redevient une question.
    expect(
      toolOptionLayout(
        project(),
        'NETWORK',
        optionsOf('NETWORK'),
        {},
      ).primary.find(({ option }) => option.key === 'nodeKind')?.enabled,
    ).toBe(true);
  });
});

describe('ce que le registre promet à la barre d’outils', () => {
  it('offre toujours au moins une décision d’emblée', () => {
    // Un outil dont tout serait replié montrerait « Plus de réglages » et
    // rien d'autre : le dépliage servirait alors à cacher l'outil lui-même.
    for (const tool of EDITOR_TOOLS) {
      const options = optionsOf(tool.id);
      if (options.length === 0) continue;
      const layout = toolOptionLayout(project(), tool.id, options, {});
      expect(layout.primary.length, tool.id).toBeGreaterThan(0);
    }
  });

  it('rend ce qu’on lui a dit, pour toute option du registre, offerte ou non', () => {
    /*
     * La preuve prise sur tout le registre plutôt que sur un cas.
     *
     * Pour chaque option de chaque outil : on lui donne une valeur, et
     * `optionValue` — ce que les outils appellent au moment de construire —
     * la rend, que la barre montre le champ, le replie ou le retire. C'est ce
     * test qui autorise à masquer quoi que ce soit.
     */
    const only = project();
    for (const tool of EDITOR_TOOLS) {
      const options = optionsOf(tool.id);
      for (const option of options) {
        const context = { project: only, value: () => '' };
        const choices = option.choices?.(context) ?? [];
        // Une liste vide n'offre rien à choisir : il n'y a alors pas de
        // valeur qu'on puisse dire avoir donnée.
        if (option.kind === 'SELECT' && choices.length === 0) continue;
        const given =
          option.kind === 'SELECT'
            ? (choices[choices.length - 1]?.value ?? '')
            : option.kind === 'NUMBER'
              ? '1234'
              : 'Ce que l’on a tapé';
        const drafts = {
          [`${tool.id}.${option.key}`]: given,
          [option.key]: given,
        };
        expect(
          optionValue(only, tool.id, options, drafts, option.key),
          `${tool.id}.${option.key}`,
        ).toBe(given);
      }
    }
  });
});
