import type { Project } from '@house-technical-designer/core-domain';
import {
  clearanceReport,
  stairDimensions,
  unresolvedRoofs,
  validateTechnicalNetwork,
} from '@house-technical-designer/core-domain';
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
/**
 * The network object a missing input is about, when it is about one.
 *
 * The adapters name what they could not read: `segments/<id>/diameterM`,
 * `cables/<id>/conductorSectionMm2`. The identifier in the middle is the object
 * whose properties the user has to open.
 */
function networkObjectOf(key: string): string | undefined {
  const match = /^(?:segments|cables)\/([^/]+)\//u.exec(key);
  return match?.[1];
}

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
    case 'PROJECT': {
      // A missing diameter or section is a network fact, and the plan cannot
      // take it: the button leads to the segment it is about, in the workspace
      // that can.
      const object = networkObjectOf(key);
      return object === undefined
        ? { label: 'Ouvrir le plan', tab: 'plan' }
        : {
            label: 'Ouvrir le tronçon',
            tab: 'networks',
            objectIds: [object],
          };
    }
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
    // A roof whose planes cannot be worked out counts in no area of the
    // project. That is the safe behaviour, and it is also a silent one: the
    // user has drawn a roof and the quantities do not mention it. Saying so
    // here is what keeps the silence honest.
    for (const { roof, reason } of unresolvedRoofs(level))
      checks.push({
        id: `model:${level.id}:roof-unresolved:${roof.id}`,
        status: 'UNKNOWN',
        source: 'MODEL',
        title: `${level.name} — toiture ${roof.id} non résolue`,
        detail: `${reason} Ses pans ne sont donc comptés ni dans les métrés, ni dans l’enveloppe thermique, ni dans les apports solaires.`,
        fix: {
          label: 'Voir sur le plan',
          tab: 'plan',
          objectIds: [roof.id],
        },
      });
    // A stair is described twice: by the line it is drawn along, and by the
    // marches it is made of. Nothing forces the two to agree, and when they
    // do not, the plan shows one stair and the dimensions state another.
    for (const stair of level.stairs) {
      const top = project.building.levels.find(
        ({ id }) => id === stair.topLevelId,
      );
      if (top === undefined) continue;
      const measured = stairDimensions(
        stair,
        top.elevationMm - level.elevationMm,
      );
      if (measured.pathMatchesRun) continue;
      const short = measured.pathDifferenceMm < 0;
      checks.push({
        id: `model:${level.id}:stair-path:${stair.id}`,
        status: 'FAIL',
        source: 'MODEL',
        title: `${level.name} — escalier ${stair.id} : la ligne tracée ne porte pas ses marches`,
        detail: short
          ? `Les ${stair.riserCount - 1} marches de ${stair.treadDepthMm} mm demandent ${measured.runMm.toFixed(0)} mm au sol, alors que la ligne de foulée n’en mesure que ${measured.pathLengthMm.toFixed(0)} mm : ${Math.abs(measured.pathDifferenceMm).toFixed(0)} mm de trop. Le plan ne dessine donc pas toutes les marches.`
          : `La ligne de foulée mesure ${measured.pathLengthMm.toFixed(0)} mm alors que les marches n’en occupent que ${measured.runMm.toFixed(0)} mm : ${measured.pathDifferenceMm.toFixed(0)} mm du haut de la volée restent sans marche.`,
        fix: {
          label: 'Voir sur le plan',
          tab: 'plan',
          objectIds: [stair.id],
        },
      });
    }
  }

  // The room the machines need around them. A geometric statement and nothing
  // more — these volumes overlap, and these two kinds may not — because
  // whether that breaks a rule of a particular country is a question for a
  // rule pack, which knows which country and which year.
  const clearances = clearanceReport(project);
  for (const conflict of clearances.conflicts)
    checks.push({
      id: `clearance:${conflict.first.objectId}:${conflict.first.zone}:${conflict.second.objectId}:${conflict.second.zone}`,
      status: 'FAIL',
      source: 'MODEL',
      title: `Dégagements — ${conflict.first.objectId} et ${conflict.second.objectId}`,
      detail: conflict.message,
      fix: {
        label: 'Voir sur le plan',
        tab: 'plan',
        objectIds: [conflict.first.objectId, conflict.second.objectId],
      },
    });
  for (const missing of clearances.unmeasured)
    checks.push({
      id: `clearance-unknown:${missing.objectId}:${missing.zone}`,
      status: 'UNKNOWN',
      source: 'MODEL',
      title: `Dégagements — ${missing.objectId}`,
      detail: missing.message,
      fix: {
        label: 'Voir sur le plan',
        tab: 'plan',
        objectIds: [missing.objectId],
      },
    });

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
