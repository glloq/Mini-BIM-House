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

/**
 * Deux formes d'ouverture, et ce que le format en dit.
 *
 * Une baie et une fenêtre de toit ne se repèrent pas de la même façon, et le
 * schéma les décrit désormais séparément. La conséquence utile n'est pas qu'il
 * accepte les deux : c'est qu'il refuse les mélanges — une baie sans allège,
 * une fenêtre de toit avec une position le long d'un mur, un hôte de mur porté
 * par un placement de toiture. Chacun de ces trois-là est un fichier qu'un
 * outil tiers pourrait écrire en croyant bien faire.
 */
describe('les deux façons de percer', () => {
  /** Le même fichier, avec une ouverture de plus dans le premier niveau. */
  function withOpening(opening: Record<string, unknown>): string {
    const file = JSON.parse(house) as {
      project: {
        building: {
          levels: { openings: Record<string, unknown>[] }[];
        };
      };
    };
    file.project.building.levels[0]!.openings.push(opening);
    return JSON.stringify(file);
  }

  const ROOF_WINDOW = {
    id: 'velux',
    type: 'OPENING',
    openingType: 'WINDOW',
    host: { kind: 'ROOF', id: 'roof:plane:0' },
    placement: { alongEaveMm: 1500, upSlopeMm: 900 },
    widthMm: 780,
    heightMm: 1180,
  };

  it('accepte une fenêtre de toit', () => {
    // La référence n'est pas résolue ici — c'est le travail de la validation
    // de projet — mais la forme, elle, doit passer.
    const result = loadProjectJson(withOpening(ROOF_WINDOW));
    expect(result.status).not.toBe('INVALID_JSON');
  });

  it('refuse une fenêtre de toit repérée le long d’un mur', () => {
    const { placement, ...rest } = ROOF_WINDOW;
    void placement;
    expect(
      loadProjectJson(
        withOpening({ ...rest, offsetAlongHostMm: 1500, sillHeightMm: 900 }),
      ).status,
    ).toBe('INVALID_PROJECT');
  });

  it('refuse une baie repérée dans un pan', () => {
    expect(
      loadProjectJson(
        withOpening({
          ...ROOF_WINDOW,
          host: { kind: 'WALL', id: 'wall' },
        }),
      ).status,
    ).toBe('INVALID_PROJECT');
  });

  it('refuse une fenêtre de toit qui porte les deux', () => {
    // Le mélange est ce qu'un `oneOf` refuse et qu'un objet unique acceptait :
    // deux jeux de coordonnées pour un seul objet, dont un seul est lu.
    expect(
      loadProjectJson(
        withOpening({
          ...ROOF_WINDOW,
          offsetAlongHostMm: 1500,
          sillHeightMm: 900,
        }),
      ).status,
    ).toBe('INVALID_PROJECT');
  });

  it('refuse un placement qui remonte sous l’égout', () => {
    expect(
      loadProjectJson(
        withOpening({
          ...ROOF_WINDOW,
          placement: { alongEaveMm: 1500, upSlopeMm: -900 },
        }),
      ).status,
    ).toBe('INVALID_PROJECT');
  });
});
