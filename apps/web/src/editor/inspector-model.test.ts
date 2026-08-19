import { describe, expect, it } from 'vitest';
import type { Project } from '@house-technical-designer/core-domain';
import { loadDemoProject } from '../demo-project.js';
import { inspectObject } from './inspector-model.js';

function demo(): Project {
  const result = loadDemoProject();
  if (result.status !== 'OK') throw new Error(result.message);
  return result.file.project;
}

function fieldValue(
  subject: ReturnType<typeof inspectObject>,
  section: string,
  label: string,
): string | undefined {
  return subject.sections
    .find((entry) => entry.title === section)
    ?.fields.find((entry) => entry.label === label)?.value;
}

describe('inspector', () => {
  it('describes a wall from its geometry, materials, thermal and quantities', () => {
    const subject = inspectObject(demo(), 'wall-south');
    expect(subject.kind).toBe('WALL');
    expect(subject.sections.map(({ title }) => title)).toEqual([
      'Géométrie',
      'Matériaux',
      'Thermique',
      'Quantités',
      'Références',
    ]);
    expect(fieldValue(subject, 'Géométrie', 'Longueur')).toBe('10.00 m');
    expect(fieldValue(subject, 'Géométrie', 'Épaisseur')).toBe('400 mm');
    expect(fieldValue(subject, 'Thermique', 'Résistance R')).toMatch(
      /m²·K\/W$/,
    );
    expect(fieldValue(subject, 'Quantités', 'Surface nette')).toBe('24.11 m²');
  });

  it('describes an opening and points back at its host wall', () => {
    const subject = inspectObject(demo(), 'opening-entry');
    expect(subject.kind).toBe('OPENING');
    expect(subject.title).toContain('Porte');
    expect(fieldValue(subject, 'Géométrie', 'Largeur')).toBe('900 mm');
    expect(fieldValue(subject, 'Références', 'Mur porteur')).toBe('wall-south');
  });

  it('describes a space with its ventilation and lighting service', () => {
    const subject = inspectObject(demo(), 'space-kitchen');
    expect(subject.kind).toBe('SPACE');
    expect(fieldValue(subject, 'Géométrie', 'Surface')).toBe('20.00 m²');
    expect(fieldValue(subject, 'Ventilation', 'Débit de conception')).toBe(
      '45 m³/h',
    );
    expect(fieldValue(subject, 'Éclairage', 'Luminaires posés')).toBe('1');
  });

  it('describes a pipe with its length and diameter', () => {
    const subject = inspectObject(demo(), 'water:branch-sink');
    expect(subject.kind).toBe('NETWORK_EDGE');
    expect(fieldValue(subject, 'Géométrie', 'Diamètre intérieur')).toBe(
      '12.6 mm',
    );
    expect(fieldValue(subject, 'Références', 'Discipline')).toBe('WATER');
  });

  it('says plainly when a value is unknown rather than showing a zero', () => {
    const base = demo();
    const stripped: Project = {
      ...base,
      materialLibrary: {
        materials: base.materialLibrary!.materials.map((material) => ({
          ...material,
          properties: {},
        })),
      },
    };
    const subject = inspectObject(stripped, 'wall-south');
    expect(fieldValue(subject, 'Thermique', 'Résistance R')).toBeUndefined();
    expect(
      subject.sections.find(({ title }) => title === 'Thermique')?.fields[0]
        ?.hint,
    ).toContain('conductivité');
  });

  it('reports an object the project does not contain', () => {
    const subject = inspectObject(demo(), 'nowhere');
    expect(subject.kind).toBe('UNKNOWN');
    expect(subject.sections[0]?.fields[0]?.hint).toContain('retrouvé');
  });
});
