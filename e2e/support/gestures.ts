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
 * - `change` sur une **liste déroulante**, et sur elle seule. Choisir dans une
 *   liste est un geste que personne ne fait gratuitement — c'est l'ouvrir, la
 *   lire et désigner une ligne — et `selectOption()` n'envoie aucun appui :
 *   sans cette ligne, changer la menuiserie d'une fenêtre ou la discipline
 *   d'un réseau ne coûtait rien du tout dans le relevé, ce qui est faux. On
 *   ne compte que `select` : un `change` de champ texte est le reflet du
 *   `fill()` qui précède, et le compter reviendrait à compter deux fois la
 *   saisie qu'on a justement décidé de ne pas compter.
 *
 * Remplir un champ avec `fill()` ne produit rien : c'est voulu. Une saisie se
 * compte à sa validation — la frappe elle-même n'est pas ce qu'on cherche à
 * réduire, le nombre d'allers-retours l'est.
 */

/** Un geste relevé dans la page : ce qu'on a fait, et sur quoi. */
export type Gesture = { readonly kind: string; readonly at: string };

/**
 * Un repère posé dans le relevé, entre deux gestes.
 *
 * Une intention longue — créer un réseau **puis** y tracer un tronçon, fermer
 * une dalle **puis** y percer une trémie — dépense son budget en deux ou trois
 * endroits, et un relevé de douze lignes ne dit pas lequel est le coupable.
 * Nommer les étapes ne change pas le compte d'un iota : c'est une annotation
 * du relevé, pas une remise à zéro. Un test ne peut donc pas s'en servir pour
 * faire disparaître des gestes — il ne peut que rendre lisible où ils partent.
 */
export type Step = { readonly after: number; readonly label: string };

declare global {
  interface Window {
    __gestes?: Gesture[];
    __etapes?: Step[];
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
    window.__etapes = [];
    /*
     * Ce que l'étiquette d'un champ écrit d'elle-même.
     *
     * Une étiquette qui **enveloppe** son champ — `<label>Métier<select>…` —
     * contient aussi le texte du champ, c'est-à-dire, pour une liste
     * déroulante, tout son catalogue d'options : le relevé disait
     * « Métier Tous Architecture Structure Terrain Pl… » là où l'écran dit
     * « Métier ». Ce qui la nomme est ce qu'elle écrit elle-même, donc ses
     * propres nœuds de texte ; le texte entier ne sert que de repli, pour
     * l'étiquette posée à côté du champ plutôt qu'autour.
     */
    const labelOf = (element: Element): string => {
      const label = (element as HTMLInputElement).labels?.[0];
      if (label === undefined || label === null) return '';
      const direct = [...label.childNodes]
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent ?? '')
        .join(' ');
      return direct.trim() === '' ? (label.textContent ?? '') : direct;
    };
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
      /*
       * Un champ ne se nomme pas par ce qu'il contient.
       *
       * Le texte d'une liste déroulante est la suite de toutes ses options :
       * la nommer ainsi écrirait le catalogue entier dans le relevé, et le
       * relevé sert justement à être lu d'un coup d'œil. C'est son étiquette
       * qui la nomme, comme à l'écran.
       */
      const control =
        element instanceof HTMLInputElement ||
        element instanceof HTMLSelectElement ||
        element instanceof HTMLTextAreaElement;
      const own = control ? labelOf(element) : (element.textContent ?? '');
      const text = own.trim().replace(/\s+/gu, ' ');
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
    addEventListener(
      'change',
      (event) => {
        if (!(event.target instanceof HTMLSelectElement)) return;
        window.__gestes?.push({ kind: 'choix', at: nameOf(event.target) });
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
    window.__etapes = [];
  });
}

/**
 * Nommer l'étape qui commence, dans le relevé et nulle part ailleurs.
 *
 * C'est la seule chose qu'un test peut dire au compteur, et elle n'ôte ni
 * n'ajoute rien : le repère retient combien de gestes avaient été relevés à
 * cet instant, et le message d'échec insère la ligne à cet endroit-là. Le
 * budget, lui, reste le nombre de gestes, entier.
 */
export async function mark(page: Page, label: string): Promise<void> {
  await page.evaluate((step) => {
    window.__etapes?.push({ after: window.__gestes?.length ?? 0, label: step });
  }, label);
}

/** Le relevé, dans l'ordre. */
export async function spent(page: Page): Promise<readonly Gesture[]> {
  return await page.evaluate(() => window.__gestes ?? []);
}

/** Les repères posés en chemin, dans l'ordre. */
export async function steps(page: Page): Promise<readonly Step[]> {
  return await page.evaluate(() => window.__etapes ?? []);
}

/** Le relevé, lisible d'un coup d'œil dans un message d'échec. */
function ledger(
  gestures: readonly Gesture[],
  marks: readonly Step[] = [],
): string {
  const lines: string[] = [];
  const written = (upTo: number): void => {
    for (const step of marks)
      if (step.after === upTo) lines.push(`  — ${step.label}`);
  };
  gestures.forEach((gesture, index) => {
    written(index);
    lines.push(`  ${index + 1}. ${gesture.kind} — ${gesture.at}`);
  });
  written(gestures.length);
  return lines.join('\n');
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
  const marks = await steps(page);
  const relevé = ledger(gestures, marks);
  expect(
    gestures.length,
    `« ${intent} » a coûté ${gestures.length} gestes, budget ${budget} :\n${relevé}`,
  ).toBeLessThanOrEqual(budget);
  expect(
    gestures.length,
    `« ${intent} » n'a coûté que ${gestures.length} gestes pour un budget de ${budget} : soit l'écran s'est simplifié et le budget doit descendre, soit le test ne fait plus ce qu'il annonce.\n${relevé}`,
  ).toBeGreaterThan(budget - 3);
}
