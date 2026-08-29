/**
 * Ce qui garde l'écran atteignable, écrit une fois pour toutes.
 *
 * `npm run audit:layout` ouvre les sept espaces, leurs treize destinations,
 * leurs trente sous-parties et leurs deux cent quarante entrées, à cinq tailles
 * de fenêtre, et cherche ce qui est dans le document sans être nulle part sur
 * l'écran. Il en a trouvé deux cent trente-deux, tous ramenés à quatre règles,
 * et une cinquième le jour où il a ouvert un second projet.
 *
 * Il met quarante minutes : c'est un audit, pas une porte. Ces règles-là,
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

  it('fait défiler le mode ouvert, et jamais la colonne elle-même', () => {
    /*
     * L'inspecteur passait sous le plan en dessous de 1 050 px, et il fallait
     * l'y borner : sans borne, la grille lui donnait autant de hauteur qu'au
     * dessin. Il n'y a plus de seconde colonne à replier — les propriétés
     * sont dans celle de gauche, à la place des outils.
     *
     * La borne qui compte est donc ailleurs. La colonne montre une fiche de
     * propriétés qui peut être longue ; si c'est la colonne qui défile, la
     * bascule « Outils / Propriétés » part avec elle vers le haut, et l'on se
     * retrouve dans un panneau dont la seule sortie est hors de l'écran.
     */
    expect(rule('.sidebar')).toMatch(/flex-direction:\s*column/u);
    expect(rule('.column-pane')).toMatch(/flex:\s*1/u);
    expect(rule('.column-pane')).toMatch(/overflow-y:\s*auto/u);
    expect(rule('.column-pane')).toMatch(/min-height:\s*0/u);
  });

  it('borne le navigateur du modèle, qui flotte sur le dessin', () => {
    /*
     * L'arborescence n'est plus dans la colonne : c'est un panneau qu'on
     * ouvre, posé contre le plan. Posé, donc hors de toute case qui le
     * contiendrait — cent onze entrées sur un écran de 768 px sortent par le
     * bas, et il n'y aurait rien pour aller les chercher.
     */
    expect(rule('.model-navigator')).toMatch(/position:\s*fixed/u);
    expect(rule('.model-navigator')).toMatch(/overflow-y:\s*auto/u);
    expect(rule('.model-navigator')).toMatch(/bottom:/u);
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

  it('ne laisse aucun champ de la rangée dépasser la place qu’on lui donne', () => {
    /*
     * La cinquième, et celle qu'il a fallu un **projet neuf** pour voir.
     *
     * La largeur d'un `<select>` est celle de sa plus longue option. Le filtre
     * de l'outil Sélection en a de longues — « Tous les objets », « Ouverture »,
     * « Trémie » — et `max-width: 9rem` fait 144 px : sur un écran de 390, il
     * sortait de trente pixels à droite du plan, rogné par la case du plan et
     * sans rien qui défile pour aller le chercher. Sur huit écrans.
     *
     * Il n'apparaissait pas sur la maison de démonstration, seul projet que
     * l'audit ouvrait, parce que ce n'est pas là qu'on a cet outil en main. Une
     * borne fixe ne suffit pas : il faut aussi celle que la place impose.
     */
    expect(rule('.tool-header select,\n.tool-header input')).toMatch(
      /max-width:\s*min\([^)]*100%\)/u,
    );
  });
});
