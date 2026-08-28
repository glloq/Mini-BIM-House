/**
 * Ce que nommer un module doit coûter.
 *
 * `module-registry.ts` promet dans son en-tête de n'importer rien, « pour que
 * nommer un module coûte quelques centaines d'octets à l'application plutôt
 * que dix-sept moteurs de calcul ». La promesse était tenue par le fichier et
 * défaite par le paquet : le barillet le réexportait à côté des moteurs, et
 * l'écran des réglages — atteint depuis les vérifications, donc depuis la
 * coque — importait le barillet pour lire un libellé.
 *
 * Les dix-sept moteurs arrivaient ainsi au premier écran de tout le monde. Ce
 * test tient les deux moitiés de la promesse : le fichier reste sans
 * dépendance, et ce qu'il déclare est ce que les moteurs déclarent.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  CALCULATION_MODULES,
  calculationModuleContract,
} from './module-registry.js';
import { PROJECT_CALCULATION_MODULES } from './modules.js';

const source = readFileSync(
  fileURLToPath(new URL('./module-registry.ts', import.meta.url)),
  'utf8',
);

describe('le registre des modules', () => {
  it('n’importe rien du tout', () => {
    /*
     * Pas même un type : `import type` disparaît à la compilation, mais rien
     * n'empêche qu'il devienne un import de valeur au remaniement suivant, et
     * la ligne serait alors la même à lire. Le plus simple est qu'il n'y en
     * ait aucune.
     */
    expect(source).not.toMatch(/^\s*import\s/mu);
    expect(source).not.toMatch(/\bfrom\s+'/u);
    expect(source).not.toMatch(/\brequire\(/u);
    expect(source).not.toMatch(/\bimport\(/u);
  });

  it('nomme exactement les modules qui existent', () => {
    expect(CALCULATION_MODULES.map(({ id }) => id).sort()).toEqual(
      PROJECT_CALCULATION_MODULES.map(({ id }) => id).sort(),
    );
  });

  it('déclare la méthode et la version que les moteurs déclarent', () => {
    /*
     * La dérive que ce fichier existe pour empêcher, appliquée à lui-même :
     * une version de moteur qui monte sans que le registre suive ferait dire
     * à l'écran des réglages qu'un résultat vient d'une méthode qui n'est plus
     * celle qui l'a produit.
     */
    for (const module of PROJECT_CALCULATION_MODULES)
      expect(calculationModuleContract(module.id), module.id).toEqual({
        methodId: module.methodId,
        version: module.version,
      });
  });

  it('ne connaît pas un module que rien ne porte', () => {
    expect(calculationModuleContract('inexistant')).toBeUndefined();
  });
});
