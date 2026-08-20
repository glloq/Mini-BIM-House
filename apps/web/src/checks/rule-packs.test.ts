import { describe, expect, it } from 'vitest';
import { entityId, type Project } from '@house-technical-designer/core-domain';
import {
  AVAILABLE_RULE_PACKS,
  assessmentContext,
  evaluateRulePacks,
} from './rule-packs.js';

const PACK_ID = 'fr-rainwater-example';

function rainwaterNetwork(
  id: string,
  withPrefilter: boolean,
): Project['systems'] {
  return [
    {
      id,
      discipline: 'RAINWATER',
      systemType: 'RAINWATER_HARVESTING',
      nodes: [
        {
          id: `${id}-tank`,
          kind: 'TANK',
          position: { x: 0, y: 0, z: 0 },
        },
        ...(withPrefilter
          ? [
              {
                id: `${id}-prefilter`,
                kind: 'PREFILTER' as const,
                position: { x: 1, y: 0, z: 0 },
              },
            ]
          : []),
      ],
      ports: [],
      edges: [],
    },
  ];
}

function project(
  regulatory: Project['regulatoryContext'],
  systems: Project['systems'] = [],
): Project {
  return {
    id: entityId<'Project'>('project'),
    metadata: {
      name: 'Référentiels',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
    site: { northAngleDeg: 0 },
    building: { levels: [], zones: [] },
    systems,
    ...(regulatory === undefined ? {} : { regulatoryContext: regulatory }),
  };
}

const FRANCE = {
  country: 'FR',
  referenceDate: '2026-01-01',
  enabledRulePacks: [PACK_ID],
} as const;

describe('the context a rule pack is assessed in', () => {
  it('is undefined until the project states a country and a valid date', () => {
    expect(assessmentContext(project(undefined))).toBeUndefined();
    expect(
      assessmentContext(
        project({ country: 'FR', enabledRulePacks: [PACK_ID] }),
      ),
    ).toBeUndefined();
    expect(
      assessmentContext(project({ ...FRANCE, referenceDate: 'bientôt' })),
    ).toBeUndefined();
    expect(assessmentContext(project({ ...FRANCE }))).toEqual({
      country: 'FR',
      referenceDate: '2026-01-01',
    });
  });
});

describe('running the packs a project activates', () => {
  it('refuses to run without a date rather than assuming today', () => {
    const [evaluation] = evaluateRulePacks(
      project({ country: 'FR', enabledRulePacks: [PACK_ID] }),
    );
    expect(evaluation?.report).toBeUndefined();
    expect(evaluation?.notice).toContain('date de référence');
  });

  it('does not apply a French pack to a project in another country', () => {
    const [evaluation] = evaluateRulePacks(
      project({ ...FRANCE, country: 'BE' }),
    );
    expect(evaluation?.report).toBeUndefined();
    expect(evaluation?.notice).toContain('FR');
    expect(evaluation?.notice).toContain('BE');
  });

  it('does not apply a pack before its text came into force', () => {
    expect(AVAILABLE_RULE_PACKS[0]?.validity.from).toBe('2025-03-15');
    const [evaluation] = evaluateRulePacks(
      project({ ...FRANCE, referenceDate: '2024-06-01' }),
    );
    expect(evaluation?.report).toBeUndefined();
    expect(evaluation?.notice).toContain('2024-06-01');
  });

  it('names an activated pack the application does not ship', () => {
    const [evaluation] = evaluateRulePacks(
      project({ ...FRANCE, enabledRulePacks: ['de-rainwater-2019'] }),
    );
    expect(evaluation?.notice).toContain('de-rainwater-2019');
  });

  it('answers once per object rather than once per rule', () => {
    const systems = [
      ...rainwaterNetwork('rain-a', true)!,
      ...rainwaterNetwork('rain-b', false)!,
    ];
    const [evaluation] = evaluateRulePacks(project({ ...FRANCE }, systems));
    const results = (evaluation?.report?.items ?? []).map(
      ({ result }) => result,
    );
    expect(results).toHaveLength(2);
    // A compliant system must not hide a non-compliant one behind a single
    // verdict, and each result has to say which object it is about.
    expect(
      results.find(({ objectIds }) => objectIds.includes('rain-a'))?.status,
    ).toBe('PASS');
    expect(
      results.find(({ objectIds }) => objectIds.includes('rain-b'))?.status,
    ).toBe('FAIL');
  });

  it('says a rule does not apply when the project holds no such object', () => {
    const [evaluation] = evaluateRulePacks(project({ ...FRANCE }));
    expect(evaluation?.report?.items[0]?.result.status).toBe('NOT_APPLICABLE');
    expect(evaluation?.report?.summary.notApplicable).toBe(1);
  });
});
