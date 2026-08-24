/**
 * Ce qui garde l'écran atteignable, écrit une fois pour toutes.
 *
 * `npm run audit:layout` ouvre les sept espaces, leurs treize destinations,
 * leurs trente sous-parties et leurs deux cent quarante entrées, à cinq tailles
 * de fenêtre, et cherche ce qui est dans le document sans être nulle part sur
 * l'écran. Il en a trouvé deux cent trente-deux, tous ramenés à quatre règles.
 *
 * Il met vingt minutes : c'est un audit, pas une porte. Ces quatre règles-là,
 * elles, tiennent en une seconde, et ce sont elles qui empêchent les deux cent
 * trente-deux de revenir. Une feuille de style se relit mal ; une règle qui
 * disparaît ne se voit pas.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

function source(path: string): string {
  return readFileSync(
    fileURLToPath(new URL(`../${path}`, import.meta.url)),
    'utf8',
  );
}

const styles = source('styles.css');
const shell = source('main.tsx');

/**
 * Le corps d'une règle de premier niveau, par son sélecteur.
 *
 * De premier niveau exprès : une règle de même nom sous un `@media` est
 * indentée, et la confondre avec celle du dessus ferait lire la surcharge d'un
 * téléphone en croyant lire la règle générale.
 */
function rule(selector: string): string {
  const at = styles.indexOf(`\n${selector} {`);
  if (at < 0) return '';
  return styles.slice(at, styles.indexOf('}', at));
}

describe('rien n’est dans le document sans être sur l’écran', () => {
  it('fait défiler l’écran d’un document, et jamais le plan', () => {
    /*
     * Les tableaux et les formulaires occupent la case du plan, et cette case
     * rogne ce qui en sort — c'est ce qui empêche le dessin d'allonger la
     * page. Les vérifications, la table des feuilles et l'écran du projet sont
     * plus hauts qu'elle : tout ce qui passait la ligne de flottaison était
     * perdu, sans barre pour aller le chercher. Deux cent trente défauts sur
     * les deux cent trente-deux venaient de là.
     */
    expect(rule('.canvas-panel.is-document')).toMatch(/overflow:\s*auto/u);
    expect(shell).toContain('canvas-panel panel is-document');
    // Le plan, lui, ne défile pas : il prend la case qu'on lui donne.
    expect(styles).toMatch(/\n\.canvas-panel \{[^}]*overflow:\s*hidden/u);
  });

  it('garde au plan de quoi porter ce qui est posé sur son bord', () => {
    /*
     * Le minimum appartenait au dessin. Quand la case devenait plus courte que
     * lui — un objet désigné sur un écran de 768 px met l'inspecteur en rangée
     * pleine largeur — le dessin **sortait** de sa case, et tout ce qui est
     * posé sur son bord bas (le calque de fond, la rose des vents) passait
     * dessous. Le minimum appartient à la case.
     */
    expect(rule('#plan')).toMatch(/min-height:/u);
    expect(rule('.plan-canvas')).toMatch(/min-height:\s*0/u);
  });

  it('borne l’inspecteur quand il passe sous le plan', () => {
    // Sans borne, la grille lui donnait autant de hauteur qu'au dessin.
    const narrow = styles.slice(styles.indexOf('@media (max-width: 1050px)'));
    const inspector = narrow.slice(
      narrow.indexOf('.inspector {'),
      narrow.indexOf('}', narrow.indexOf('.inspector {')),
    );
    expect(inspector).toMatch(/max-height:/u);
  });

  it('pose le panneau d’affichage hors de la case du plan', () => {
    // `absolute` sous son bouton, il était rogné par la case du plan : sur un
    // écran court, ses vingt calques tombaient dehors.
    expect(rule('.display-panel')).toMatch(/position:\s*fixed/u);
    expect(rule('.display-panel')).toMatch(/overflow-y:\s*auto/u);
    expect(rule('.display-panel')).toMatch(/max-height:/u);
  });

  it('fait tenir dans la rangée ce qui commande le plan', () => {
    // « Affichage » avait repris la taille d'un bouton de formulaire — 63 px
    // dans une rangée de 42 — et son haut était rogné par la case du plan.
    expect(styles).toMatch(
      /\.tool-row-end button,\s*\n\.tool-row-end select,\s*\n\.tool-row-end input \{/u,
    );
  });
});
