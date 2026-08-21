/**
 * What a technical object is made of, below everything that uses it.
 *
 * A port kind and a clearance zone are named by the catalogue, by the model of
 * the building, by the networks and by the importer. Keeping them in the
 * catalogue meant that anything wanting to *use* one had to depend on five
 * hundred families and seventeen calculation engines, or keep its own copy —
 * and the copies had already begun to disagree. They are declarations, they
 * depend on nothing, and they live here so that everything can share them.
 */
export * from './clearances.js';
export * from './registries.js';
export * from './port-requirements.js';
export * from './port-types.js';
