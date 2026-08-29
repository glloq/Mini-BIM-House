/**
 * Ce que la discipline sait des réseaux qu'on dessine, et ce qu'elle en
 * ignorait.
 *
 * Trois défauts se tenaient là, et tous les trois se voyaient depuis la maison
 * de référence sans que rien ne les compte :
 *
 * - le genre de nœud `STACK` — la colonne de chute — était **dessiné** trois
 *   fois dans cette maison et n'avait aucun gabarit, si bien que rien ne disait
 *   qu'une colonne reçoit et redistribue ;
 * - la table des genres donnait à un réseau **unitaire** des genres d'eaux
 *   usées séparées, de sorte que ce que l'application posait sur ce réseau
 *   refusait ensuite l'évacuation d'un WC ;
 * - une colonne étant un **point en plan**, la question « quel point de ce
 *   tracé est le plus proche » n'y avait pas de réponse, et celle qu'on rendait
 *   — la première extrémité — était la tête de colonne pour qui vise le
 *   rez-de-chaussée.
 */
import { describe, expect, it } from 'vitest';
import { portsConnectable } from '@house-technical-designer/core-domain';
import type { NetworkPort } from '@house-technical-designer/core-domain';
import { portType } from '@house-technical-designer/technical-types';
import {
  branchingTemplate,
  nearestPointOnRoute,
  networkNodeTemplates,
  systemPortType,
  templatePorts,
} from './network-authoring.js';

/** Un port tel qu'un nœud le porterait, pour poser la question au modèle. */
function port(id: string, nodeId: string, portTypeId: string): NetworkPort {
  const kind = portType(portTypeId)!;
  return {
    id,
    nodeId,
    portTypeId,
    role: kind.service,
    direction: kind.direction,
  };
}

describe('les genres de nœud d’une évacuation', () => {
  it('nomme la colonne de chute, qui reçoit et redistribue', () => {
    /*
     * Le gabarit manquant. La maison de référence porte trois nœuds `STACK` —
     * tête, milieu et pied de colonne — et la discipline n'en connaissait
     * aucun : le lavabo du premier étage marchait 12,3 m jusqu'au regard du
     * rez-de-chaussée plutôt que de rejoindre la colonne qui passe à moins de
     * trois mètres de lui et descend précisément pour ça.
     */
    const stack = networkNodeTemplates('WASTEWATER').find(
      ({ kind }) => kind === 'STACK',
    );
    expect(stack).toBeDefined();
    expect(stack?.label).toBe('Colonne de chute');
    expect(stack?.ports.map(({ direction }) => direction)).toEqual([
      'IN',
      'OUT',
    ]);
  });

  it('dérive toujours un collecteur par un regard, et non par une colonne', () => {
    /*
     * L'ordre de la liste est la seule chose qui le dise : `branchingTemplate`
     * prend le premier gabarit qui reçoit et distribue. Poser une colonne de
     * chute au milieu d'un collecteur enterré serait un dessin faux, et c'est
     * ce qui arriverait si la colonne passait devant le regard.
     */
    expect(branchingTemplate('WASTEWATER')?.kind).toBe('INSPECTION_CHAMBER');
  });
});

describe('ce qu’un type de système fait porter à ses ports', () => {
  it('fait recevoir à un réseau unitaire les eaux usées comme les eaux-vannes', () => {
    /*
     * « Unitaire » veut dire les deux réunies, et la table disait le contraire :
     * elle donnait `WASTEWATER_INLET` — des eaux usées séparées, service
     * `GREYWATER` — à l'arrivée d'un réseau `COMBINED_WASTEWATER`. Un regard
     * ou un piquage posé par l'application refusait donc l'évacuation d'un WC,
     * qui est des eaux-vannes : « BLACKWATER et GREYWATER ne sont pas le même
     * service ». Le refus était juste ; la prémisse ne l'était pas.
     */
    const arrival = systemPortType('COMBINED_WASTEWATER', 'IN')!;
    expect(arrival).toBe('WASTEWATER_COMBINED_INLET');
    const inlet = port('regard-in', 'regard', arrival);
    expect(portsConnectable(port('wc', 'wc', 'SOILWATER'), inlet)).toBe(true);
    expect(
      portsConnectable(port('lavabo', 'lavabo', 'WASTEWATER'), inlet),
    ).toBe(true);
  });

  it('laisse un réseau d’extraction tracer son premier conduit', () => {
    /*
     * La même faute que l'unitaire, sur un autre réseau.
     *
     * `AIR_EXHAUST` nomme le rejet à l'extérieur : ce que le groupe envoie en
     * toiture, c'est-à-dire un raccordement du groupe et non ce qu'une gaine
     * transporte. La table le donnait pourtant comme le départ de tout nœud
     * d'extraction. Un groupe posé par l'outil offrait donc `AIR_EXHAUST` en
     * sortie quand la bouche attendait `AIR_EXTRACT` : deux services
     * différents, et le tout premier conduit refusé.
     *
     * Le test part des gabarits et non de la table, parce que c'est par eux
     * que l'application pose ce qu'elle pose : ce qui est vérifié est qu'un
     * groupe et une bouche, tirés du registre sans rien y toucher, se
     * raccordent.
     */
    const templates = networkNodeTemplates('VENTILATION');
    const fan = templates.find(({ kind }) => kind === 'FAN')!;
    const mouth = templates.find(({ kind }) => kind === 'TERMINAL')!;
    const departure = templatePorts('vmc', fan, 'EXTRACT').find(
      ({ direction }) => direction === 'OUT',
    )!;
    const arrival = templatePorts('bouche', mouth, 'EXTRACT').find(
      ({ direction }) => direction === 'IN',
    )!;
    expect(departure.portTypeId).toBe('AIR_EXTRACT_OUTLET');
    expect(arrival.portTypeId).toBe('AIR_EXTRACT');
    expect(portsConnectable(departure, arrival)).toBe(true);
  });

  it('fait sortir d’un réseau unitaire ce qu’un réseau unitaire transporte', () => {
    // La sortie va de pair avec l'arrivée : les deux genres d'une même ligne se
    // retrouvent face à face sur un tronçon, et un départ d'eaux usées séparées
    // en aval d'une arrivée unitaire aurait rétréci le collecteur à la moitié
    // de ce qu'il porte.
    const departure = systemPortType('COMBINED_WASTEWATER', 'OUT')!;
    expect(departure).toBe('WASTEWATER_COMBINED');
    expect(
      portsConnectable(
        port('regard-out', 'regard', departure),
        port('exutoire-in', 'exutoire', 'WASTEWATER_COMBINED_INLET'),
      ),
    ).toBe(true);
  });
});

describe('le point d’un tracé le plus proche d’un endroit visé', () => {
  // Une chute : mêmes x et y d'un bout à l'autre, ce qui est le cas de la
  // colonne de la maison de référence, qui descend de 2 915 à −200.
  const stack = [
    { x: 7500, y: 5200, z: 2915 },
    { x: 7500, y: 5200, z: -200 },
  ];

  it('rend la hauteur demandée sur un tronçon que le plan ne départage pas', () => {
    /*
     * Chacun des points d'une chute est exactement aussi proche que les autres
     * de l'endroit visé : la question n'a pas de réponse en plan, et celle
     * qu'on rendait — le premier point du tracé — était la tête de colonne. Un
     * lavabo du rez-de-chaussée s'y voyait donc proposer un raccordement qui
     * remonte de trois mètres, et le geste le refusait.
     */
    expect(nearestPointOnRoute(stack, { x: 7000, y: 4600 }, 450)).toEqual({
      x: 7500,
      y: 5200,
      z: 450,
    });
  });

  it('borne la hauteur demandée aux deux bouts du tronçon', () => {
    // Sous le pied de la colonne, il n'y a plus de colonne.
    expect(nearestPointOnRoute(stack, { x: 7000, y: 4600 }, -9000)?.z).toBe(
      -200,
    );
    expect(nearestPointOnRoute(stack, { x: 7000, y: 4600 }, 9000)?.z).toBe(
      2915,
    );
  });

  it('répond comme avant quand on ne demande pas de hauteur', () => {
    // Un clic sur un plan ne dit pas de hauteur et n'a pas à en inventer une.
    expect(nearestPointOnRoute(stack, { x: 7000, y: 4600 })?.z).toBe(2915);
  });

  it('laisse le tracé décider dès qu’il court en plan', () => {
    // Sur un tronçon horizontal la hauteur est imposée par le tracé : la
    // demander ne change rien, et c'est ce qui fait que ce paramètre n'a
    // d'effet que là où il en fallait un.
    const run = [
      { x: 0, y: 0, z: 1000 },
      { x: 2000, y: 0, z: 800 },
    ];
    expect(nearestPointOnRoute(run, { x: 1000, y: 500 }, -5000)).toEqual(
      nearestPointOnRoute(run, { x: 1000, y: 500 }),
    );
  });
});
