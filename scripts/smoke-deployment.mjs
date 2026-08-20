import process from 'node:process';

/**
 * Checks that a deployed build is actually reachable and complete.
 *
 * A successful deployment step means the files were uploaded, not that the
 * application opens: a wrong base path publishes an `index.html` that loads a
 * script which answers 404, and the page stays blank with a green pipeline
 * behind it. This fetches the page and every asset it names.
 */

/** The assets a page references, as written in its HTML. */
export function referencedAssets(html) {
  const references = new Set();
  const pattern = /<(?:script|link)\b[^>]*?\b(?:src|href)="([^"]+)"/gu;
  for (const [, reference] of html.matchAll(pattern)) {
    // A data: icon is inline; there is nothing to fetch and nothing to miss.
    if (reference.startsWith('data:') || reference.startsWith('#')) continue;
    references.add(reference);
  }
  return [...references];
}

/**
 * What a reference's extension says its content type must start with.
 *
 * A host that answers every unknown path with `index.html` returns 200 for a
 * script that is not there; the body is HTML, and the page stays blank. The
 * type is therefore checked, not only the status.
 */
const EXPECTED_TYPES = new Map([
  ['.js', ['text/javascript', 'application/javascript']],
  ['.mjs', ['text/javascript', 'application/javascript']],
  ['.css', ['text/css']],
]);

export function typeIssue(url, contentType) {
  const extension = new URL(url).pathname.replace(/^.*(?=\.)/u, '');
  const expected = EXPECTED_TYPES.get(extension);
  if (expected === undefined) return undefined;
  const actual = (contentType ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
  return expected.includes(actual)
    ? undefined
    : `${url} est servi en ${actual === '' ? 'type inconnu' : actual} au lieu de ${expected[0]}.`;
}

/** Whether the page is the application rather than a directory listing or a 404. */
export function looksLikeApplication(html) {
  return html.includes('id="root"') && /<script\b[^>]*\bsrc="/u.test(html);
}

async function main() {
  const target = process.argv[2] ?? process.env.DEPLOYMENT_URL;
  if (target === undefined || target === '') {
    console.error(
      'Usage : node scripts/smoke-deployment.mjs <url> (ou DEPLOYMENT_URL).',
    );
    process.exit(2);
  }
  const failures = [];
  const page = await fetch(target, { redirect: 'follow' });
  if (!page.ok) failures.push(`${target} répond ${page.status}.`);
  const html = page.ok ? await page.text() : '';
  if (page.ok && !looksLikeApplication(html))
    failures.push(`${target} ne sert pas l'application.`);

  for (const reference of page.ok ? referencedAssets(html) : []) {
    const url = new URL(reference, page.url).toString();
    let response;
    try {
      response = await fetch(url);
    } catch (error) {
      failures.push(`${url} est injoignable : ${String(error)}`);
      continue;
    }
    if (!response.ok) {
      failures.push(`${url} répond ${response.status}.`);
      continue;
    }
    const mismatch = typeIssue(url, response.headers.get('content-type'));
    if (mismatch !== undefined) {
      failures.push(mismatch);
      continue;
    }
    const body = await response.arrayBuffer();
    if (body.byteLength === 0) failures.push(`${url} est vide.`);
    else console.log(`ok ${url} (${body.byteLength} octets)`);
  }

  if (failures.length > 0) {
    console.error('\nDéploiement incomplet :');
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exit(1);
  }
  console.log(`\n${target} sert l'application et tous ses fichiers.`);
}

if (process.argv[1]?.endsWith('smoke-deployment.mjs')) await main();
