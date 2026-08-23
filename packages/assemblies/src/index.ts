export * from './types.js';
export * from './assemblies.js';
export * from './assembly-editor.js';

// Not the catalogue. Importing this barrel for `materialId` used to pull every
// fiche the tree holds — the eager glob of `generic-catalog.ts` runs on import
// and nothing tree-shakes a hundred JSON files away — so a first payload that
// draws nothing carried all of them. The catalogue is a subpath now:
// `@house-technical-designer/assemblies/catalog`.
