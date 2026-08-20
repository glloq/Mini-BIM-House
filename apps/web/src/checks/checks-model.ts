import type { Project } from '@house-technical-designer/core-domain';
import { validateTechnicalNetwork } from '@house-technical-designer/core-domain';
import {
  buildPlanView,
  defaultVisibility,
} from '@house-technical-designer/view-query';
import { buildBom } from '../quantities/bom-model.js';
import { canEditSetting } from '../project/settings-catalog.js';
import type { CalculationRun } from '../calculations/calculation-runner.js';

export type CheckStatus = 'FAIL' | 'UNKNOWN';

export type CheckSource =
  'MODEL' | 'NETWORK' | 'CALCULATION' | 'QUANTITIES' | 'RULE_PACK';

/** Where the user has to go to deal with a finding. */
export interface CheckFix {
  readonly label: string;
  readonly tab:
    | 'project'
    | 'plan'
    | 'building'
    | 'materials'
    | 'assemblies'
    | 'equipment'
    | 'networks'
    | 'calculations';
  readonly objectIds?: readonly string[];
}

/**
 * One finding about the project.
 *
 * A finding is never a compliance verdict. It states what the model or a
 * calculation could not resolve, and — this is the point — where to go and fix
 * it. `UNKNOWN` means the application could not tell, which is different from
 * a defect, and the two are never merged.
 */
export interface CheckItem {
  readonly id: string;
  readonly status: CheckStatus;
  readonly source: CheckSource;
  readonly title: string;
  readonly detail: string;
  readonly fix?: CheckFix;
}

export interface ChecksSummary {
  readonly total: number;
  readonly failures: number;
  readonly unknowns: number;
}

const SOURCE_LABELS: Readonly<Record<CheckSource, string>> = {
  MODEL: 'Modèle',
  NETWORK: 'Réseaux',
  CALCULATION: 'Calculs',
  QUANTITIES: 'Quantités',
  RULE_PACK: 'Référentiel',
};

export function sourceLabel(source: CheckSource): string {
  return SOURCE_LABELS[source];
}

/**
 * Where a missing calculation input has to be filled in.
 *
 * Nothing is offered when the screen it would open cannot actually take the
 * value: a "Corriger" that leads to a form without the field is worse than no
 * button, because it makes the application look as though it lost the input.
 */
function fixForOrigin(
  origin: string,
  moduleId: string,
  key: string,
): CheckFix | undefined {
  switch (origin) {
    case 'MODULE_SETTINGS':
      return canEditSetting(moduleId, key)
        ? { label: 'Ouvrir les réglages de calcul', tab: 'project' }
        : undefined;
    case 'CLIMATE_DATASET':
      return { label: 'Associer un jeu climatique', tab: 'project' };
    case 'EQUIPMENT':
      return { label: 'Ouvrir les équipements', tab: 'equipment' };
    case 'PROJECT':
      return { label: 'Ouvrir le plan', tab: 'plan' };
    default:
      return undefined;
  }
}

/**
 * Every finding the application can state about the project.
 *
 * Nothing here is computed twice: the plan view, the network validation, the
 * bill of materials and the calculation run are the same ones the other
 * workspaces show. This screen only gathers what they already say and adds the
 * way to act on it.
 */
export function projectChecks(
  project: Project,
  run: CalculationRun | undefined,
): readonly CheckItem[] {
  const checks: CheckItem[] = [];

  // Every level, not only the first: without a levelId the plan view falls back
  // to levels[0], and an upper floor's problems would never be reported.
  for (const level of project.building.levels) {
    const plan = buildPlanView(project, {
      levelId: level.id,
      layers: defaultVisibility(),
    });
    for (const issue of plan.issues)
      checks.push({
        id: `model:${level.id}:${issue.code}:${issue.objectId ?? 'projet'}`,
        status: 'FAIL',
        source: 'MODEL',
        title: `${level.name} — ${issue.code}`,
        detail: issue.message,
        fix: {
          label: 'Voir sur le plan',
          tab: 'plan',
          ...(issue.objectId === undefined
            ? {}
            : { objectIds: [issue.objectId] }),
        },
      });
  }

  for (const network of project.systems ?? [])
    for (const issue of validateTechnicalNetwork(network))
      checks.push({
        id: `network:${network.id}:${issue.code}:${issue.path}`,
        status: 'FAIL',
        source: 'NETWORK',
        title: `${network.systemType} — ${issue.code}`,
        detail: issue.message,
        fix: { label: 'Ouvrir les réseaux', tab: 'networks' },
      });

  if (run !== undefined) {
    for (const module of run.runs) {
      if (module.status === 'FAILED' || module.status === 'ERROR')
        checks.push({
          id: `calculation:${module.moduleId}:status`,
          status: 'FAIL',
          source: 'CALCULATION',
          title: `${module.label} — calcul impossible`,
          detail: module.message ?? 'Le module n’a pas produit de résultat.',
          fix: { label: 'Ouvrir le tableau de bord', tab: 'calculations' },
        });
      for (const missing of module.missing) {
        const fix = fixForOrigin(
          missing.expectedOrigin,
          module.moduleId,
          missing.key,
        );
        checks.push({
          id: `calculation:${module.moduleId}:${missing.key}`,
          status: 'UNKNOWN',
          source: 'CALCULATION',
          title: `${module.label} — ${missing.key}`,
          detail: missing.message,
          ...(fix === undefined ? {} : { fix }),
        });
      }
    }
  }

  const bom = buildBom(project);
  for (const warning of bom.warnings)
    checks.push({
      id: `quantities:${warning.code}:${warning.sourceEntityId}`,
      status: 'FAIL',
      source: 'QUANTITIES',
      title: warning.code,
      detail: warning.message,
      fix: {
        label: 'Voir sur le plan',
        tab: 'plan',
        objectIds: [warning.sourceEntityId],
      },
    });
  for (const [ids, label, fix] of [
    [bom.missingDensities, 'masse volumique inconnue', 'materials'],
    [bom.missingPrices, 'prix non renseigné', 'project'],
    [bom.missingImpacts, 'facteur d’impact non renseigné', 'project'],
  ] as const)
    for (const materialId of ids)
      checks.push({
        id: `quantities:${label}:${materialId}`,
        status: 'UNKNOWN',
        source: 'QUANTITIES',
        title: `${materialId} — ${label}`,
        detail:
          fix === 'materials'
            ? 'La quantité est connue, la masse ne l’est pas : la propriété manque au matériau.'
            : 'La quantité est connue mais reste non valorisée : le réglage de calcul ne couvre pas ce matériau.',
        fix:
          fix === 'materials'
            ? { label: 'Ouvrir les matériaux', tab: 'materials' }
            : { label: 'Ouvrir les réglages de calcul', tab: 'project' },
      });

  if ((project.regulatoryContext?.enabledRulePacks ?? []).length === 0)
    checks.push({
      id: 'rule-pack:none',
      status: 'UNKNOWN',
      source: 'RULE_PACK',
      title: 'Aucun référentiel activé',
      detail:
        'Ce projet n’active aucun jeu de règles : rien n’est vérifié par rapport à un texte, et rien n’est donc affirmé conforme.',
      fix: { label: 'Ouvrir les référentiels', tab: 'project' },
    });

  return checks;
}

export function summarize(checks: readonly CheckItem[]): ChecksSummary {
  return {
    total: checks.length,
    failures: checks.filter(({ status }) => status === 'FAIL').length,
    unknowns: checks.filter(({ status }) => status === 'UNKNOWN').length,
  };
}
