/**
 * Ce qu'un objet ouvert laissait passer.
 *
 * Le schéma tolérait des propriétés qu'il ne déclarait pas — sur le projet, le
 * site, les niveaux, les réseaux, les fiches. Une faute de frappe passait donc
 * la validation, le champ n'était lu par personne, et la valeur qu'on croyait
 * avoir donnée n'existait nulle part :
 *
 *     { "definitonId": "generic-door" }
 *
 * Soixante-treize objets ont été fermés. Ce test est ce qui les garde fermés :
 * il vaut pour tous, parce qu'une faute de frappe n'est pas un cas particulier.
 *
 * Ce qui reste ouvert l'est **écrit** — le sac de propriétés d'un matériau,
 * dont les clés viennent du registre de propriétés et non d'une liste fixe.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

import { loadProjectJson } from './file-io.js';

const house = readFileSync(
  new URL(
    '../../../examples/reference-house/reference.houseproj.json',
    import.meta.url,
  ),
  'utf8',
);

/** Le même fichier, avec une clé de plus quelque part. */
function withTypo(path: readonly string[], key: string): string {
  const file = JSON.parse(house) as Record<string, unknown>;
  let node = file;
  for (const step of path) node = node[step] as Record<string, unknown>;
  node[key] = 'quelque chose';
  return JSON.stringify(file);
}

describe('un format qui refuse ce qu’il ne connaît pas', () => {
  it('accepte la maison de référence telle qu’elle est écrite', () => {
    expect(loadProjectJson(house).status).toBe('OK');
  });

  it.each([
    [['project'], 'definitonId'],
    [['project', 'site'], 'northAngleDegrees'],
    [['project', 'metadata'], 'auteur'],
    [['project', 'building'], 'niveaux'],
  ])('refuse %s / %s', (path, key) => {
    const result = loadProjectJson(withTypo(path, key));
    expect(result.status).toBe('INVALID_PROJECT');
  });

  it('laisse ouvert ce qui est écrit comme ouvert', () => {
    // Les propriétés d'un matériau viennent du registre de propriétés, qui
    // parle une autre langue que le modèle : le sac est ouvert exprès.
    const file = JSON.parse(house) as {
      project: {
        materialLibrary?: {
          materials: { properties: Record<string, unknown> }[];
        };
      };
    };
    const material = file.project.materialLibrary?.materials[0];
    if (material === undefined) return;
    material.properties.thermalConductivity = 0.04;
    expect(loadProjectJson(JSON.stringify(file)).status).toBe('OK');
  });
});
