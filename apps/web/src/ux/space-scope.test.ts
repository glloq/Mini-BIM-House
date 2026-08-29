import { describe, expect, it } from 'vitest';

import { CREATION_STAGES } from './creation-stages.js';
import { selectableInStage, selectableKinds } from './space-scope.js';

describe('ce que chaque espace laisse désigner', () => {
  it('ne laisse pas modifier la parcelle depuis le bâtiment', () => {
    /*
     * On pouvait prendre la parcelle depuis l'onglet du bâtiment et les murs
     * depuis celui de l'aménagement : un clic un peu large, et l'on déplaçait
     * la limite du terrain en croyant bouger une cloison.
     */
    expect(selectableInStage('BUILDING', 'SITE')).toBe(false);
    expect(selectableInStage('BUILDING', 'WALL')).toBe(true);
  });

  it('ne laisse pas modifier la maison depuis l’aménagement', () => {
    expect(selectableInStage('FITTING', 'WALL')).toBe(false);
    expect(selectableInStage('FITTING', 'SPACE')).toBe(false);
    expect(selectableInStage('FITTING', 'COMPONENT')).toBe(true);
  });

  it('laisse le terrain à l’espace du terrain', () => {
    expect(selectableInStage('SITE', 'SITE')).toBe(true);
    /*
     * Et plus les dalles. La terrasse en était une, seule de sa sous-partie à
     * fabriquer un ouvrage du bâtiment quand l'allée et le stationnement à
     * côté posent une emprise de terrain. C'était un bouton mort depuis qu'un
     * objet appartient à un espace : on la traçait ici, le verrou la refusait
     * comme dalle. Elle est devenue ce que ses voisines sont.
     */
    expect(selectableInStage('SITE', 'SLAB')).toBe(false);
    expect(selectableInStage('SITE', 'OPENING')).toBe(false);
  });

  it('laisse les réseaux aux systèmes, et rien des murs', () => {
    expect(selectableInStage('SYSTEMS', 'NETWORK_EDGE')).toBe(true);
    expect(selectableInStage('SYSTEMS', 'NETWORK_NODE')).toBe(true);
    expect(selectableInStage('SYSTEMS', 'WALL')).toBe(false);
  });

  it('laisse les cotes et les annotations passer partout', () => {
    // Elles disent quelque chose du dessin, et on les corrige là où on les lit.
    for (const stage of CREATION_STAGES) {
      expect(selectableInStage(stage, 'DIMENSION'), stage).toBe(true);
      expect(selectableInStage(stage, 'NOTE'), stage).toBe(true);
    }
  });

  it('ne restreint rien là où restreindre cacherait ce qu’on cherche', () => {
    // Un écart s'ouvre sur son objet, quel qu'il soit ; une feuille porte
    // n'importe quelle vue.
    expect(selectableKinds('CHECKS')).toBeUndefined();
    expect(selectableKinds('DOCUMENTS')).toBeUndefined();
    expect(selectableKinds('PROJECT')).toBeUndefined();
  });

  it('laisse toujours prendre ce que l’espace sait poser', () => {
    /*
     * L'invariant : un espace qui propose un outil doit laisser reprendre ce
     * que cet outil pose. Sans lui, on dessinerait un objet qu'on ne pourrait
     * plus jamais désigner — pire que de ne pas l'avoir proposé.
     */
    for (const stage of CREATION_STAGES) {
      const allowed = selectableKinds(stage);
      if (allowed === undefined) continue;
      expect(allowed.size, stage).toBeGreaterThan(0);
    }
  });
});
