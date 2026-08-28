/**
 * Un refus se lit, donc il se lit en français.
 *
 * Quand une commande refuse, l'application affiche sa phrase telle quelle,
 * dans la barre d'état, sous « Refusé — … ». C'est du texte d'interface écrit
 * dans du code technique, et c'est exactement là que la langue se perd :
 *
 *     Refusé — Wall wall-south hosts openings: opening-entry.
 *     Refusé — The split point must fall inside the wall.
 *     Refusé — Dimension offset must be finite.
 *
 * Vingt-sept phrases étaient dans ce cas. Personne ne les avait vues parce
 * qu'on ne les voit qu'en se trompant, et qu'on ne se trompe pas exprès.
 *
 * ## Ce que ce test lit, et pourquoi il lit la source
 *
 * Les refus sont des littéraux dans des `validate()` : les provoquer tous
 * demanderait de construire trente commandes dans trente états invalides, et
 * le premier refus ajouté demain n'y serait pas. Le test lit donc la source et
 * ne retient que ce qui devient une phrase d'interface — ce qui est passé à
 * `rejected(…)` ou posé dans `errors: […]`. Un `throw` reste hors du champ :
 * il ne s'affiche nulle part et il parle à qui lit une pile d'appels.
 */
import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Reconnaître le français plutôt que l'anglais.
 *
 * Un seul filet suffit ici, à l'inverse du test de l'application : ces phrases
 * sont toutes des phrases, jamais un identifiant ni une unité. Ce qui ne porte
 * aucune marque de français n'en est pas.
 */
const FRENCH =
  /[àâçéèêëîïôùûüœ’]|\b(le|la|les|un|une|des|du|de|et|ne|pas|que|qui|est|sont|dans|sur|pour|avec|sans|aucun|aucune|cette|ce|son|sa|leur|doit|doivent|peut|il|elle|au|aux|inconnu|inconnue|existe|déjà|avant|entre|tombe|porte)\b/i;

/** Ce qui devient une phrase d'interface : `rejected(…)` et `errors: […]`. */
const REFUSALS =
  /(?:rejected\(|errors:\s*\[)\s*((?:[`'][^`']*[`']\s*,?\s*)+)/gu;

function refusalsOf(source: string): readonly string[] {
  const found: string[] = [];
  for (const block of source.matchAll(REFUSALS))
    for (const literal of block[1]!.matchAll(/[`']([^`']+)[`']/gu))
      if (literal[1]!.length >= 8) found.push(literal[1]!);
  return found;
}

const ROOT = fileURLToPath(new URL('.', import.meta.url));

describe('ce qu’une commande dit quand elle refuse', () => {
  it('says it in French, in every command of the editor', () => {
    const offenders: string[] = [];
    let counted = 0;
    for (const file of globSync(`${ROOT}**/*.ts`)) {
      if (file.includes('.test.')) continue;
      for (const refusal of refusalsOf(readFileSync(file, 'utf8'))) {
        counted += 1;
        if (!FRENCH.test(refusal))
          offenders.push(`${file.slice(ROOT.length)} — ${refusal}`);
      }
    }
    // Assez de phrases pour que le test veuille dire quelque chose : s'il n'en
    // lisait plus aucune — un refactor du repérage, un dossier déplacé — il
    // passerait en ne regardant rien.
    expect(counted).toBeGreaterThan(60);
    expect(offenders, offenders.join('\n')).toEqual([]);
  });
});
