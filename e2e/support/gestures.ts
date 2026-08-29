import { expect, type Page } from '@playwright/test';

/**
 * Compter ce que coûte une intention, en gestes réellement faits.
 *
 * Les tests de bout en bout disent qu'une chose est **possible**. Aucun ne dit
 * ce qu'elle **coûte**, et c'est pourtant là que se joue l'ergonomie : poser
 * une porte reste « possible » quand il faut sept clics pour y arriver, et
 * aucune suite verte ne s'en aperçoit. Une régression d'ergonomie est
 * silencieuse par nature — elle n'échoue nulle part.
 *
 * On compte donc, et on plafonne. Le nombre n'est pas tenu par le test : il
 * est relevé dans la page, par un écouteur en phase de capture posé avant que
 * l'application démarre. Tout ce qui appuie sur quelque chose est compté, que
 * l'appui vienne d'un `click` de Playwright, d'un helper qui fouille les
 * sous-parties ou d'un menu qu'il a fallu rouvrir. Un test ne peut pas
 * s'arranger avec le compteur : il n'y touche pas.
 *
 * Ce qui est compté :
 *
 * - `pointerdown` — un appui, doigt ou souris. Bouger n'en est pas un : viser
 *   est gratuit, c'est appuyer qui coûte.
 * - `keydown`, sauf les modificateurs seuls. `Maj` maintenu pendant un tracé
 *   n'est pas un geste de plus ; `Entrée` pour valider une cote en est un.
 *
 * Remplir un champ avec `fill()` ne produit rien : c'est voulu. Une saisie se
 * compte à sa validation — la frappe elle-même n'est pas ce qu'on cherche à
 * réduire, le nombre d'allers-retours l'est.
 */

/** Un geste relevé dans la page : ce qu'on a fait, et sur quoi. */
export type Gesture = { readonly kind: string; readonly at: string };

declare global {
  interface Window {
    __gestes?: Gesture[];
  }
}

/**
 * Poser l'écouteur, avant que la page existe.
 *
 * `addInitScript` rejoue le script à chaque navigation : le relevé repart de
 * zéro en même temps que l'application, ce qui est le comportement voulu.
 */
export async function countGestures(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.__gestes = [];
    const nameOf = (target: EventTarget | null): string => {
      const element =
        target instanceof Element
          ? target.closest(
              'button, a, summary, input, select, textarea, [role="button"], .plan-canvas',
            )
          : null;
      if (element === null) return 'la page';
      const aria = element.getAttribute('aria-label');
      if (aria !== null && aria !== '') return aria;
      const text = (element.textContent ?? '').trim().replace(/\s+/gu, ' ');
      if (text !== '') return text.slice(0, 40);
      const label =
        element.getAttribute('placeholder') ?? element.getAttribute('name');
      if (label !== null && label !== '') return label;
      return element.className === ''
        ? element.tagName.toLowerCase()
        : `.${String(element.className).split(' ')[0]}`;
    };
    addEventListener(
      'pointerdown',
      (event) =>
        void window.__gestes?.push({ kind: 'appui', at: nameOf(event.target) }),
      true,
    );
    addEventListener(
      'keydown',
      (event) => {
        if (['Shift', 'Control', 'Alt', 'Meta'].includes(event.key)) return;
        window.__gestes?.push({
          kind: `touche ${event.key}`,
          at: nameOf(event.target),
        });
      },
      true,
    );
  });
}

/**
 * Remettre le relevé à zéro : ce qui précède est la mise en place.
 *
 * Charger la maison de démonstration coûte des clics qui ne font pas partie de
 * l'intention qu'on mesure. On les paie, puis on remet le compteur à zéro et
 * on commence à compter ce qu'on veut savoir.
 */
export async function startCounting(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.__gestes = [];
  });
}

/** Le relevé, dans l'ordre. */
export async function spent(page: Page): Promise<readonly Gesture[]> {
  return await page.evaluate(() => window.__gestes ?? []);
}

/** Le relevé, lisible d'un coup d'œil dans un message d'échec. */
function ledger(gestures: readonly Gesture[]): string {
  return gestures
    .map((gesture, index) => `  ${index + 1}. ${gesture.kind} — ${gesture.at}`)
    .join('\n');
}

/**
 * Le plafond, et ce qu'il a fallu pour l'atteindre.
 *
 * Un budget dépassé n'est pas seulement un nombre : le message montre la
 * dépense geste par geste, parce que la question qui suit est toujours
 * « lequel est en trop ? ».
 *
 * Le plancher compte autant. Un budget qu'on n'atteint jamais n'est plus un
 * budget : si l'intention se satisfait de bien moins de gestes que prévu,
 * c'est que le test a cessé de faire ce qu'il annonce — un helper qui échoue
 * en silence, une étape sautée — ou que l'écran s'est amélioré et que le
 * chiffre doit être réécrit. Les deux méritent qu'on regarde.
 */
export async function expectGestures(
  page: Page,
  intent: string,
  budget: number,
): Promise<void> {
  const gestures = await spent(page);
  expect(
    gestures.length,
    `« ${intent} » a coûté ${gestures.length} gestes, budget ${budget} :\n${ledger(gestures)}`,
  ).toBeLessThanOrEqual(budget);
  expect(
    gestures.length,
    `« ${intent} » n'a coûté que ${gestures.length} gestes pour un budget de ${budget} : soit l'écran s'est simplifié et le budget doit descendre, soit le test ne fait plus ce qu'il annonce.\n${ledger(gestures)}`,
  ).toBeGreaterThan(budget - 3);
}
