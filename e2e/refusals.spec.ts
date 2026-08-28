import { expect, test, type Page } from '@playwright/test';

import { fileAction } from './support/file-menu.js';
import {
  DESTINATIONS,
  openDestination,
  workspaceReady,
} from './support/navigation.js';

/**
 * Un contrôle qui refuse dit pourquoi.
 *
 * Un bouton grisé sans motif se lit comme une panne. On reclique, on cherche
 * le réglage qui le libère, et il n'y en a pas : la raison était dans la tête
 * de celui qui a écrit la condition. C'est le pire des refus, parce qu'il
 * ressemble à un défaut de l'application plutôt qu'à une étape qui manque.
 *
 * Le balayage en a trouvé douze, en deux fois.
 *
 * Trois d'abord : « Ajouter une feuille », qui refusait pour deux raisons et
 * n'en affichait qu'une — avec une vue et sans titre, rien à l'écran ne
 * l'expliquait —, « Exporter le dossier en PDF », qui n'en donnait aucune, et
 * la case Architecture du périmètre, verrouillée parce qu'un projet est un
 * bâtiment avant d'être des réseaux, ce que rien ne disait.
 *
 * Neuf ensuite, et c'est le balayage lui-même qui était en cause. Il attendait
 * `.canvas-panel` visible avant de regarder, et cette case est rendue tout de
 * suite, avec « Chargement de l'espace de travail… » dedans : sur onze
 * destinations sur treize, il balayait la phrase d'attente. Les neuf autres
 * sont sortis dès qu'il a attendu l'écran plutôt que sa case — dont « Relier »
 * et « Ajouter le changement », qui refusent tant qu'on n'a pas désigné les
 * deux bouts, et « Retirer », dont un commentaire du code disait déjà la
 * raison sans que l'écran la dise.
 *
 * Sur les deux projets qui comptent : la maison de démonstration, où presque
 * rien ne manque, et un projet **neuf**, où presque tout manque — donc là où
 * un contrôle a le plus de raisons de refuser, et où personne ne regardait.
 */

interface MuteControl {
  readonly name: string;
  readonly html: string;
}

async function mutedRefusals(page: Page): Promise<readonly MuteControl[]> {
  return page.evaluate(() =>
    [
      ...document.querySelectorAll(
        'button[disabled], button[aria-disabled="true"], input[disabled], select[disabled], textarea[disabled]',
      ),
    ]
      // Ce qui n'est pas à l'écran ne refuse rien à personne : un dépliage
      // fermé garde ses boutons dans le document, et ils n'y sont pas encore.
      .filter((element) => element.getClientRects().length > 0)
      .filter(
        (element) =>
          element.getAttribute('title') === null &&
          element.getAttribute('aria-describedby') === null,
      )
      .map((element) => ({
        name: (
          element.getAttribute('aria-label') ??
          element.textContent ??
          ''
        ).trim(),
        html: element.outerHTML.slice(0, 160),
      })),
  );
}

async function sweep(page: Page, project: string): Promise<readonly string[]> {
  const muted: string[] = [];
  for (const destination of DESTINATIONS) {
    await openDestination(page, destination);
    // Le panneau arrive à la demande : balayer avant qu'il soit là ne balaie
    // rien — et `.canvas-panel` est là avant lui, avec la phrase d'attente.
    await workspaceReady(page);
    for (const control of await mutedRefusals(page))
      muted.push(
        `${project} › ${destination} — « ${control.name || 'sans nom'} »\n    ${control.html}`,
      );
  }
  return [...new Set(muted)];
}

test('every control that refuses says why, on a new project', async ({
  page,
}) => {
  await page.goto('/');
  const muted = await sweep(page, 'projet neuf');
  expect(muted, muted.join('\n')).toEqual([]);
});

test('and on the demonstration house', async ({ page }) => {
  await page.goto('/');
  await fileAction(page, 'Maison de démonstration');
  await expect(page.getByRole('status')).toContainText('démonstration');
  const muted = await sweep(page, 'maison de démonstration');
  expect(muted, muted.join('\n')).toEqual([]);
});
