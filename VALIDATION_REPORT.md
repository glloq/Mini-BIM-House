# Rapport de validation

<!-- Généré par `node scripts/validation-report.mjs`. Ne pas éditer à la main. -->

Ce document décrit **les contrôles que ce dépôt exécute**, et non le résultat
d'une exécution particulière : un résultat consigné dans un fichier vieillit
sans le dire. Le résultat vivant est celui de l'intégration continue, sur la
branche et sur chaque demande de fusion.

## Ce que la chaîne vérifie

- `npm run format:check` — `prettier --check .`
- `npm run lint` — `eslint .`
- `npm run typecheck` — `npm run typecheck --workspaces --if-present && tsc -p e2e/tsconfig.json && tsc -p scripts/tsconfig.json`
- `npm run validate:schemas` — `node scripts/generate-project-validator.mjs --check && node scripts/validate-schemas.mjs`
- `npm run validate:catalog` — `vite-node scripts/validate-catalog.ts`
- `npm run validate:docs` — `node scripts/validation-report.mjs --check`
- `npm run catalog:manifest` — `vite-node scripts/catalog-manifest.ts`
- `npm run test:discovery` — `vitest run --config vitest.discovery.config.ts`
- `npm run benchmark` — `vitest bench --run`
- `npm run test:coverage` — `vitest run --coverage`
- `npm run audit:licenses` — `node scripts/audit-licenses.mjs`
- `npm run build` — `npm run build --workspaces --if-present`
- `npm run check:bundle` — `node scripts/check-bundle-budget.mjs`
- `npm run test:e2e:install` — `playwright install --with-deps chromium firefox webkit`
- `npm run measure:shell` — `node scripts/measure-shell.mjs`
- `npm run test:e2e` — `playwright test`

## Contrôle d'unité

- géométrie d'édition : millimètres (`ADR-0003`) ;
- calculs physiques : SI ;
- coordonnées `Point2D{x,y}` / `Point3D{x,y,z}` : valeurs en millimètres ;
- dimensions de bâtiment persistées : suffixe `Mm` lorsque le champ n'est pas
  un type géométrique.

## Ce que ce rapport ne dit pas

Il ne dit pas qu'un projet donné est conforme à un texte réglementaire. Aucun
référentiel n'est livré, et l'application rapporte des constats sans jamais
délivrer de conformité.
