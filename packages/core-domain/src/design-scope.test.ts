import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { DATA_DOMAINS } from '@house-technical-designer/technical-types';
import { describe, expect, it } from 'vitest';

import {
  ALWAYS_ENABLED_DOMAIN,
  applyPreset,
  DESIGN_DOMAIN_REGISTRY,
  DESIGN_DOMAIN_IDS,
  defaultScopeFor,
  designDomain,
  designDomainLabel,
  domainEnabled,
  domainOfComponentCategory,
  domainOfDiscipline,
  domainsOutsideScope,
  domainsPresentIn,
  isDesignDomainId,
  isProjectIntent,
  PROJECT_INTENTS,
  PROJECT_INTENT_LABELS,
  projectScopeOf,
  SCOPE_PRESETS,
  validateProjectScope,
  withDomainDisabled,
  withDomainEnabled,
  withIntent,
  type DesignDomainId,
  type ProjectScope,
} from './design-scope.js';
import {
  createBuilding,
  createProjectMetadata,
  createSite,
} from './factories.js';
import type { ProjectId } from './ids.js';
import type { Project } from './types.js';

function project(over: Partial<Project> = {}): Project {
  return {
    id: 'p' as unknown as ProjectId,
    metadata: createProjectMetadata('Maison', '2024-01-01T00:00:00.000Z'),
    site: createSite(),
    building: createBuilding(),
    ...over,
  };
}

describe('the registry of design domains', () => {
  it('gives every domain a descriptor', () => {
    for (const id of DESIGN_DOMAIN_IDS) {
      const descriptor = designDomain(id);
      expect(descriptor.id).toBe(id);
      expect(descriptor.label.length).toBeGreaterThan(0);
      expect(descriptor.description.length).toBeGreaterThan(0);
    }
    expect(DESIGN_DOMAIN_IDS).toHaveLength(DATA_DOMAINS.length);
  });

  it('names the same trades as the catalogue families', () => {
    expect([...DESIGN_DOMAIN_IDS]).toEqual([...DATA_DOMAINS]);
  });

  it('only depends on domains that exist', () => {
    for (const id of DESIGN_DOMAIN_IDS)
      for (const dependency of designDomain(id).dependencies ?? [])
        expect(isDesignDomainId(dependency)).toBe(true);
  });

  it('never lets a domain depend on itself, directly or not', () => {
    const reachable = (id: DesignDomainId): readonly DesignDomainId[] => {
      const seen = new Set<DesignDomainId>();
      const queue = [...(designDomain(id).dependencies ?? [])];
      while (queue.length > 0) {
        const next = queue.pop()!;
        if (seen.has(next)) continue;
        seen.add(next);
        queue.push(...(designDomain(next).dependencies ?? []));
      }
      return [...seen];
    };
    for (const id of DESIGN_DOMAIN_IDS) expect(reachable(id)).not.toContain(id);
  });

  it('only defaults for intents that exist', () => {
    for (const id of DESIGN_DOMAIN_IDS)
      for (const intent of designDomain(id).defaultFor ?? [])
        expect(isProjectIntent(intent)).toBe(true);
  });

  it('names an unknown identifier rather than inventing a label', () => {
    expect(designDomainLabel('ELECTRICAL')).toBe('Électricité');
    expect(designDomainLabel('PLOMBERIE_MAGIQUE')).toBe('PLOMBERIE_MAGIQUE');
  });

  it('gives every intent a label', () => {
    for (const intent of PROJECT_INTENTS)
      expect(PROJECT_INTENT_LABELS[intent].length).toBeGreaterThan(0);
  });
});

describe('the presets', () => {
  it('only reference domains that exist', () => {
    for (const preset of SCOPE_PRESETS)
      for (const id of preset.domains) expect(isDesignDomainId(id)).toBe(true);
  });

  it('always keep architecture', () => {
    for (const preset of SCOPE_PRESETS)
      expect(preset.domains).toContain(ALWAYS_ENABLED_DOMAIN);
  });

  it('produce a scope that passes validation', () => {
    for (const preset of SCOPE_PRESETS) {
      const scope = applyPreset(defaultScopeFor('NEW_BUILD'), preset.id);
      expect(validateProjectScope(scope)).toEqual([]);
    }
  });

  it('replace the selection rather than adding to it', () => {
    const wide = applyPreset(defaultScopeFor('NEW_BUILD'), 'EVERYTHING');
    const narrow = applyPreset(wide, 'ARCHITECTURE_ONLY');
    expect(narrow.enabledDomains).not.toContain('ELECTRICAL');
  });

  it('leaves an unknown preset alone rather than emptying the scope', () => {
    const scope = defaultScopeFor('NEW_BUILD');
    expect(
      applyPreset(
        scope,
        'NOT_A_PRESET' as (typeof SCOPE_PRESETS)[number]['id'],
      ),
    ).toEqual(scope);
  });
});

describe('a project scope', () => {
  it('keeps architecture available whatever the scope says', () => {
    const empty: ProjectScope = { intent: 'STUDY', enabledDomains: [] };
    expect(domainEnabled(empty, 'ARCHITECTURE')).toBe(true);
    expect(withDomainDisabled(empty, 'ARCHITECTURE')).toEqual(empty);
    for (const intent of PROJECT_INTENTS)
      expect(defaultScopeFor(intent).enabledDomains).toContain('ARCHITECTURE');
  });

  it('pulls in what a domain cannot work without', () => {
    const scope = withDomainEnabled(
      { intent: 'NEW_BUILD', enabledDomains: ['ARCHITECTURE'] },
      'SOLAR',
    );
    expect(scope.enabledDomains).toContain('ELECTRICAL');
    expect(validateProjectScope(scope)).toEqual([]);
  });

  it('drops what depended on a domain being switched off', () => {
    const scope = withDomainDisabled(
      applyPreset(defaultScopeFor('NEW_BUILD'), 'EVERYTHING'),
      'ELECTRICAL',
    );
    expect(scope.enabledDomains).not.toContain('LIGHTING');
    expect(scope.enabledDomains).not.toContain('SOLAR');
    expect(scope.enabledDomains).not.toContain('STORAGE');
    expect(validateProjectScope(scope)).toEqual([]);
  });

  it('keeps the domains in registry order however they were added', () => {
    const scope = withDomainEnabled(
      withDomainEnabled(
        { intent: 'NEW_BUILD', enabledDomains: ['ARCHITECTURE'] },
        'FURNITURE',
      ),
      'SITE',
    );
    expect(scope.enabledDomains.indexOf('SITE')).toBeLessThan(
      scope.enabledDomains.indexOf('FURNITURE'),
    );
  });

  it('changes intent without touching the selection', () => {
    const scope = defaultScopeFor('NEW_BUILD');
    const renovation = withIntent(scope, 'RENOVATION');
    expect(renovation.intent).toBe('RENOVATION');
    expect(renovation.enabledDomains).toEqual(scope.enabledDomains);
  });

  it('says what is wrong instead of repairing it', () => {
    expect(
      validateProjectScope({
        intent: 'NEW_BUILD',
        enabledDomains: ['ARCHITECTURE', 'LIGHTING'],
      }),
    ).toEqual(['LIGHTING demande ELECTRICAL, qui n’est pas activé.']);
    expect(
      validateProjectScope({ intent: 'NEW_BUILD', enabledDomains: [] }),
    ).toEqual(['Le domaine ARCHITECTURE ne peut pas être désactivé.']);
    expect(
      validateProjectScope({
        intent: 'NEW_BUILD',
        enabledDomains: ['ARCHITECTURE', 'ARCHITECTURE'],
      }),
    ).toEqual(['Domaine répété : ARCHITECTURE.']);
    expect(
      validateProjectScope({
        intent: 'CHÂTEAU' as never,
        enabledDomains: ['ARCHITECTURE', 'PISCINE' as never],
      }),
    ).toEqual([
      'Intention de projet inconnue : CHÂTEAU.',
      'Domaine inconnu : PISCINE.',
    ]);
  });
});

describe('a project that never stated a scope', () => {
  it('opens, and is offered every domain', () => {
    const scope = projectScopeOf(project());
    expect(scope.enabledDomains).toEqual(DESIGN_DOMAIN_IDS);
    expect(validateProjectScope(scope)).toEqual([]);
  });

  it('keeps the scope it does state', () => {
    const stated: ProjectScope = {
      intent: 'STUDY',
      enabledDomains: ['ARCHITECTURE'],
    };
    expect(projectScopeOf(project({ scope: stated }))).toEqual(stated);
  });
});

describe('what the project contains, as opposed to what is in scope', () => {
  const wired = project({
    systems: [
      {
        id: 'net-1',
        discipline: 'ELECTRICAL',
        systemType: 'LIGHTING_CIRCUIT',
        nodes: [],
        ports: [],
        edges: [],
      },
    ],
  });

  it('reads the trades from the objects rather than from the scope', () => {
    expect(domainsPresentIn(wired)).toEqual(['ELECTRICAL']);
    expect(domainsPresentIn(project())).toEqual([]);
  });

  it('leaves an unstated trade unstated', () => {
    expect(domainOfDiscipline('OTHER')).toBeUndefined();
    expect(domainOfComponentCategory('OTHER')).toBeUndefined();
    expect(domainOfComponentCategory('APPLIANCE')).toBeUndefined();
    expect(domainOfComponentCategory('PHOTOVOLTAIC')).toBe('SOLAR');
  });

  it('deletes nothing when a domain leaves the scope', () => {
    const narrowed = withDomainDisabled(
      applyPreset(defaultScopeFor('NEW_BUILD'), 'EVERYTHING'),
      'ELECTRICAL',
    );
    const after: Project = { ...wired, scope: narrowed };
    expect(after.systems).toEqual(wired.systems);
    expect(domainsPresentIn(after)).toEqual(['ELECTRICAL']);
    expect(domainsOutsideScope(after, narrowed)).toEqual(['ELECTRICAL']);
  });

  it('reports nothing outside a scope that covers what is there', () => {
    const wide = applyPreset(defaultScopeFor('NEW_BUILD'), 'EVERYTHING');
    expect(domainsOutsideScope(wired, wide)).toEqual([]);
  });
});

describe('the stored form', () => {
  it('accepts exactly the domains the registry knows', () => {
    const schema: {
      readonly $defs: {
        readonly ProjectScope: {
          readonly properties: {
            readonly enabledDomains: {
              readonly items: { readonly enum: readonly string[] };
            };
            readonly intent: { readonly enum: readonly string[] };
          };
        };
      };
    } = JSON.parse(
      readFileSync(
        fileURLToPath(
          new URL('../../../schemas/project.schema.json', import.meta.url),
        ),
        'utf8',
      ),
    ) as never;
    const scope = schema.$defs.ProjectScope.properties;
    expect([...scope.enabledDomains.items.enum]).toEqual([
      ...DESIGN_DOMAIN_IDS,
    ]);
    expect([...scope.intent.enum]).toEqual([...PROJECT_INTENTS]);
  });
});

describe('the descriptor of a domain', () => {
  it('only names calculation modules, never carries their code', () => {
    for (const id of DESIGN_DOMAIN_IDS)
      for (const moduleId of DESIGN_DOMAIN_REGISTRY[id].calculationModules ??
        [])
        expect(typeof moduleId).toBe('string');
  });
});
