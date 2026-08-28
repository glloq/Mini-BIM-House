/**
 * Ce que la maison de référence doit pouvoir dire d'elle-même.
 *
 * Elle est le sujet de presque tout : les captures du README, les parcours de
 * bout en bout, les aperçus, les tests de pose. Si ses propres calculs sortent
 * en erreur, c'est le produit entier qu'on regarde à travers un exemple cassé —
 * et personne ne le voyait, parce que rien ne lisait le verdict des dix-sept
 * modules d'un coup.
 *
 * Ce qu'ils disaient : quatre erreurs sur les évacuations — trois tronçons dont
 * le tracé ne rejoignait pas les nœuds qu'ils déclarent relier, et une chute
 * refusée pour « pente indéfinie » ; l'électricité sans aucune chute de tension,
 * parce que le circuit se ramifie ; la cuve d'eau de pluie sans niveau de
 * départ.
 *
 * Ce test lit ce verdict. Il ne fige aucun nombre — ceux-là bougent avec les
 * méthodes — mais il fige le fait qu'aucun module ne butte sur les **données**
 * de cet exemple-là.
 */
import { describe, expect, it } from 'vitest';
import type { Project } from '@house-technical-designer/core-domain';
import { loadDemoProject, demoClimateDatasets } from '../demo-project.js';
import {
  runProjectCalculations,
  type ModuleRun,
} from './calculation-runner.js';

function house(): Project {
  const result = loadDemoProject();
  if (result.status !== 'OK') throw new Error(result.message);
  return result.file.project;
}

const RUN = await runProjectCalculations(house(), demoClimateDatasets());

/**
 * Le seul module qui ne rend pas « OK », et pourquoi c'est juste.
 *
 * Le thermique déclare exclure les ponts thermiques : c'est une limite de la
 * méthode, écrite, et non un manque des données. Un module qui la déclare doit
 * rester `PARTIAL` — le jour où il passerait `OK` sans avoir appris à les
 * traiter, ce serait un silence, pas un progrès.
 */
const METHOD_LIMITED = new Set(['thermal']);

describe('la maison de référence, vue par ses dix-sept modules', () => {
  it('les fait tous tourner', () => {
    expect(RUN.runs).toHaveLength(17);
    expect(RUN.runs.every(({ result }) => result !== undefined)).toBe(true);
  });

  it('n’en laisse aucun buter sur les données', () => {
    const stuck = RUN.runs.filter(
      ({ moduleId, status }) =>
        status !== 'OK' && !METHOD_LIMITED.has(moduleId),
    );
    expect(
      stuck.map(({ moduleId, status }) => `${moduleId}: ${status}`),
    ).toEqual([]);
  });

  it('ne rapporte aucune erreur, sur aucun module', () => {
    /*
     * Une erreur dit que le modèle est incohérent — un tracé qui ne rejoint
     * pas ses nœuds, un réseau qui n'atteint pas son exutoire. Un avertissement
     * dit ce que la méthode ne couvre pas. Le premier est un défaut de
     * l'exemple, le second une propriété du calcul.
     */
    const errors = RUN.runs.flatMap(({ moduleId, result }) =>
      (result?.warnings ?? [])
        .filter(({ severity }) => severity === 'ERROR')
        .map(({ code, message }) => `${moduleId} ${code}: ${message}`),
    );
    expect(errors).toEqual([]);
  });

  it('n’a aucune donnée manquante à réclamer', () => {
    // `missing` est ce que le projet aurait dû fournir et n'a pas fourni :
    // une puissance non dite, une section non dite, un niveau de cuve non dit.
    expect(
      RUN.missing.map(({ moduleId, key }) => `${moduleId}/${key}`),
    ).toEqual([]);
  });

  it('dit ses limites de méthode plutôt que de se taire dessus', () => {
    // L'inverse du test précédent, et tout aussi nécessaire : un module qui
    // ne couvre pas tout doit le dire, sans quoi « OK » vaudrait « exact ».
    const thermal = RUN.runs.find(({ moduleId }) => moduleId === 'thermal')!;
    expect((thermal.result?.warnings ?? []).map(({ code }) => code)).toContain(
      'THERMAL_BRIDGE_NOT_INCLUDED',
    );
  });
});

describe('ce que les évacuations de la maison de référence valent', () => {
  const drainage = (): ModuleRun =>
    RUN.runs.find(({ moduleId }) => moduleId === 'wastewater')!;

  it('se calcule entièrement', () => {
    expect(drainage().status).toBe('OK');
  });

  it('accepte la chute comme une chute, et non comme une pente indéfinie', () => {
    /*
     * Une maison à étage a une chute : un tuyau vertical, où l'eau tombe et
     * n'a donc pas de pente. Elle était refusée, ce qui mettait en défaut le
     * réseau de toute maison à plus d'un niveau.
     */
    const outputs = drainage().result?.outputs as
      { readonly segments?: readonly Record<string, unknown>[] } | undefined;
    const vertical = (outputs?.segments ?? []).filter(
      (segment) => segment.vertical === true,
    );
    expect(vertical.length).toBeGreaterThan(0);
    for (const segment of vertical) {
      expect(segment.slope).toBeNull();
      expect(segment.lengthM as number).toBeGreaterThan(0);
    }
  });

  it('fait couler chaque tronçon horizontal vers le bas', () => {
    const outputs = drainage().result?.outputs as
      { readonly segments?: readonly Record<string, unknown>[] } | undefined;
    for (const segment of outputs?.segments ?? [])
      if (segment.vertical !== true)
        expect(segment.slope as number, String(segment.id)).toBeGreaterThan(0);
  });
});

/**
 * Ce que les réseaux de la maison de référence savent dire d'eux-mêmes.
 *
 * Un port qui ne déclare pas son genre ne peut pas être vérifié : la
 * vérification répond « rien ne dit si les deux se raccordent », ce qui n'est
 * ni un succès ni un échec, et se lit comme un silence. La maison de référence
 * avait vingt raccordements dans cet état — toutes les évacuations, toute la
 * ventilation, et la moitié de l'électricité, ajoutée à l'étage sans que
 * personne ne suive.
 */
describe('les réseaux de la maison de référence', () => {
  const house = () => {
    const result = loadDemoProject();
    if (result.status !== 'OK') throw new Error(result.message);
    return result.file.project;
  };

  /*
   * La ventilation reste à typer, et pour une raison qui demande son propre
   * changement : ses tronçons sont dessinés depuis le caisson vers les bouches
   * alors que l'air d'une extraction va dans l'autre sens. Typer ses ports
   * selon la physique demande de retourner le graphe, que le module de
   * ventilation lit — c'est un chantier, pas un oubli.
   */
  const NOT_YET_TYPED = new Set(['ventilation']);

  it.each(['water', 'wastewater', 'electrical'])(
    'dit ce que chaque port de %s transporte',
    (networkId) => {
      const network = (house().systems ?? []).find(
        ({ id }) => id === networkId,
      )!;
      const untyped = network.ports.filter(
        ({ portTypeId }) => portTypeId === undefined,
      );
      expect(untyped.map(({ id }) => id)).toEqual([]);
    },
  );

  it('n’en laisse qu’un seul non typé, et il est nommé', () => {
    // L'inverse : si la ventilation venait à être typée, cette liste devrait
    // être vidée plutôt que de rester là à décrire un état révolu.
    const remaining = (house().systems ?? [])
      .filter(({ ports }) =>
        ports.some(({ portTypeId }) => portTypeId === undefined),
      )
      .map(({ id }) => id);
    expect(remaining).toEqual([...NOT_YET_TYPED]);
  });
});
