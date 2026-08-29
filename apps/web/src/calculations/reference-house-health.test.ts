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
import { clearanceReport } from '@house-technical-designer/core-domain';
import { loadDemoProject, demoClimateDatasets } from '../demo-project.js';
import { projectChecks } from '../checks/checks-model.js';
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
   * La ventilation est typée, et il a fallu trancher pour y arriver.
   *
   * Le graphe d'un réseau est ici l'**arbre de distribution depuis l'organe** —
   * le tableau vers les circuits, le caisson vers les bouches — et le module de
   * ventilation en dépend : `edgeFlows` accumule les débits en descendant
   * depuis la racine, si bien que le conduit principal porte la somme des
   * bouches. Les évacuations font exception parce que la gravité leur donne un
   * exutoire unique, et leur graphe suit donc l'écoulement.
   *
   * Or `AIR_EXTRACT` est déclaré entrant et `AIR_EXTRACT_OUTLET` sortant. Les
   * typer « selon la physique » — l'air part de la bouche et va au caisson —
   * met le vocabulaire à contresens du graphe et fait échouer la validation :
   * « déclare AIR_EXTRACT, qui est IN, et dit OUT ». Le modèle a raison contre
   * la tentative.
   *
   * Ce qui est retenu : les genres suivent le **graphe** et non le fluide.
   * Un port sortant est du côté de l'organe, un port entrant du côté du
   * terminal — ce que les deux noms disent déjà, à condition de les lire comme
   * une place dans l'arbre plutôt que comme un sens de circulation. Les dix
   * ports du réseau se raccordent, et la VMC se branche.
   *
   * La tension demeure et elle est écrite ici plutôt que dans un réseau muet :
   * « entrant » et « sortant » nomment une place, pas une direction, et un
   * vocabulaire qui distinguerait les deux serait mieux. Ce qui a changé est
   * qu'un réseau sans genre de port était **inutilisable en silence** — rien
   * ne pouvait s'y raccorder, et rien ne disait pourquoi.
   */
  const NOT_YET_TYPED = new Set<string>([]);

  it.each(['water', 'wastewater', 'ventilation', 'electrical'])(
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

  it('n’en laisse aucun sans genre de port', () => {
    // La liste est vide, et le test reste : un réseau neuf qui arriverait sans
    // genre de port serait de nouveau inutilisable en silence.
    const remaining = (house().systems ?? [])
      .filter(({ ports }) =>
        ports.some(({ portTypeId }) => portTypeId === undefined),
      )
      .map(({ id }) => id);
    expect(remaining).toEqual([...NOT_YET_TYPED]);
  });
});

/**
 * Ce que la maison de référence dit à l'écran des vérifications.
 *
 * Trente-sept constats, dont dix-sept en défaut : des objets qui occupaient le
 * même volume — un ballon tampon et un circulateur au même endroit, un
 * disjoncteur « dans » son tableau — et vingt raccordements dont rien ne disait
 * s'ils tenaient. C'est ce qu'un visiteur voyait en ouvrant l'exemple.
 *
 * Ce test ne fige aucun nombre de constats : il fige qu'aucun ne soit **en
 * défaut**, et nomme un par un les rares qui restent en suspens. Un constat en
 * défaut sur l'exemple de référence est soit un défaut de l'exemple, soit un
 * défaut du logiciel ; dans les deux cas quelqu'un doit le regarder.
 */
describe('l’écran des vérifications, sur la maison de référence', () => {
  const checks = projectChecks(house(), undefined);

  it('n’a plus rien en défaut', () => {
    expect(
      checks
        .filter(({ status }) => status === 'FAIL')
        .map(({ id, detail }) => `${id}: ${detail ?? ''}`),
    ).toEqual([]);
  });

  it('ne laisse en suspens que ce qui est nommé', () => {
    /*
     * Il n'en reste qu'un, et c'est un choix de l'utilisateur : activer un
     * texte réglementaire est une décision, et prétendre le contraire ferait
     * dire à l'application qu'un projet est conforme à quelque chose que
     * personne n'a choisi.
     *
     * Les cinq raccordements de ventilation qui figuraient ici ont disparu
     * parce que le réseau déclare enfin ce que ses ports transportent. Ils
     * n'étaient pas « en attente d'une étude » : rien ne pouvait dire s'ils
     * tenaient, faute de vocabulaire.
     */
    const pending = checks
      .filter(({ status }) => status === 'UNKNOWN')
      .map(({ id }) => id);
    expect(pending).toEqual(['rule-pack:none']);
  });

  it('ne fait se rentrer dedans aucun objet', () => {
    // Le contrôle géométrique seul, sans le reste de l'écran : deux volumes
    // qui se recouvrent alors qu'ils n'ont pas le droit.
    expect(
      clearanceReport(house()).conflicts.map(
        ({ first, second, message }) =>
          `${first.objectId}/${first.zone} ↔ ${second.objectId}/${second.zone} : ${message}`,
      ),
    ).toEqual([]);
  });

  it('sait qu’un appareil logé dans un autre n’est pas une collision', () => {
    /*
     * Un disjoncteur **est** monté dans son tableau : dix-huit millimètres de
     * large dans un coffret de trois cent cinquante. La géométrie ne peut pas
     * faire la différence entre ce montage et deux objets qui se rentrent
     * dedans ; c'est le modèle qui la fait, et il faut donc que quelqu'un
     * l'ait dit.
     */
    const level = house().building.levels[0]!;
    const breaker = (level.components ?? []).find(
      ({ id }) => id === 'component-breaker',
    )!;
    expect(breaker.housedInId).toBe('component-board');
  });
});
