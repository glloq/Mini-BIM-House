# Repository instructions

- Read `ARCHITECTURE.md` and `IMPLEMENTATION_PLAN.md` before changing code.
- Use strict TypeScript. Keep business formulas out of React and the domain model independent of SVG.
- Persist editor geometry in millimetres; perform physics in SI; convert explicitly through `packages/units`.
- Unknown values stay unknown: never silently replace them with zero or a typical value.
- Do not hard-code regulations in calculators. Use versioned Rule Packs and never `eval` or `new Function`.
- Do not persist derived data as a source of truth. Represent technical networks as graphs.
- Persistent contract changes require matching schemas, examples, migrations when needed, and tests.
- Add tests for every change. Avoid heavy dependencies without a documented justification.
- All workspace packages share a single version (`0.1.0`). When adding an internal
  `@house-technical-designer/*` dependency, use that exact version and re-run `npm install`
  so `package-lock.json` stays reproducible; a mismatch makes `npm ci` try to fetch the
  package from the public registry and breaks CI.

## Commands

- Fresh reproducible install (same as CI): `npm ci`
- Install after changing dependencies: `npm install` (then commit `package-lock.json`)
- Format: `npm run format` / `npm run format:check`
- Lint: `npm run lint`
- Typecheck: `npm run typecheck`
- Tests: `npm test`
- Schema validation: `npm run validate:schemas`
- README screenshot (after building the web app): `npm run docs:screenshots`
- Build: `npm run build`
