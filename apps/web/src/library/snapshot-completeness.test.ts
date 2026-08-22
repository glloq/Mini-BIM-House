import { describe, expect, it } from 'vitest';
import {
  genericCatalog,
  familyCapabilities,
  family,
} from '@house-technical-designer/catalog-registry';
import { projectEquipmentFromCatalog } from './library-model.js';
import type { EquipmentDefinition as ProjectEquipment } from '@house-technical-designer/core-domain';
import type { HostType } from '@house-technical-designer/core-domain';
import { isHostType } from '@house-technical-designer/core-domain';
import {
  CURRENT_PROJECT_SCHEMA_VERSION,
  validateProjectFile,
} from '@house-technical-designer/project-io';
import { populatedProject } from '../test-support/populated-project.js';
import {
  AddEquipmentCommand,
  ProjectCommandDispatcher,
} from '@house-technical-designer/editor-core';

/**
 * What the copy deliberately does not carry, and why.
 *
 * Every other field of a catalogue entry has to reach the project, because the
 * project is what has to open the same way in two years — with a catalogue
 * that has moved, or with no catalogue installed at all. A field left out has
 * to be left out on purpose and say so here; the test below turns anything
 * else into a failure, so that the next field somebody adds to the catalogue
 * cannot quietly stop at the project's edge.
 */
const DELIBERATELY_NOT_COPIED: Readonly<Record<string, string>> = {
  id: 'the copy gets an identifier of its own, unique within the project',
};

const hostsOf = (familyId: string): readonly HostType[] =>
  (family(familyId)?.placement?.allowedHosts ?? []).filter(isHostType);

const copyOf = (entry: ReturnType<typeof genericCatalog>[number]) =>
  projectEquipmentFromCatalog(
    entry,
    [],
    hostsOf(entry.familyId),
    family(entry.familyId)?.clearances,
    familyCapabilities(entry.familyId),
  );

describe('a project carries the whole entry, not a summary of it', () => {
  it('leaves no field of the catalogue behind', () => {
    const lost = new Set<string>();
    for (const entry of genericCatalog()) {
      const copy = copyOf(entry) as unknown as Record<string, unknown>;
      for (const key of Object.keys(entry))
        if (
          DELIBERATELY_NOT_COPIED[key] === undefined &&
          copy[key] === undefined
        )
          lost.add(key);
    }
    expect([...lost]).toEqual([]);
  });

  it('keeps the curves that say how the machine behaves away from its nominal point', () => {
    // A heat pump is not a number: 2.0 at −15 °C and 5.0 at 15 °C. The copy
    // used to keep the nominal figure and drop the curve, so a file reopened
    // without the catalogue installed had the one value the machine almost
    // never delivers.
    const pump = genericCatalog().find(
      ({ id }) => id === 'generic-air-water-heat-pump',
    )!;
    const copy = copyOf(pump);
    expect(copy.performanceCurves).toEqual(pump.performanceCurves);
    expect(copy.performanceCurves?.[0]?.points.length).toBeGreaterThan(1);
  });

  it('keeps where each figure came from, one figure at a time', () => {
    const pump = genericCatalog().find(
      ({ id }) => id === 'generic-air-water-heat-pump',
    )!;
    const copy = copyOf(pump);
    expect(copy.sources).toEqual(pump.sources);
    expect(new Set(copy.sources?.map(({ property }) => property))).toEqual(
      new Set(Object.keys(pump.properties)),
    );
  });

  it('keeps what draws it and what may be done with it', () => {
    const pump = genericCatalog().find(
      ({ id }) => id === 'generic-air-water-heat-pump',
    )!;
    const copy = copyOf(pump);
    expect(copy.rendering).toEqual(pump.rendering);
    expect(copy.capabilities).toContain('CONNECTABLE');
    expect(copy.capabilities).toContain('PERFORMANCE_MAPPED');
  });

  it('answers what it is, where it goes and how it is drawn without the catalogue', () => {
    // The point of the copy, stated as a test: nothing below reads the
    // nomenclature or the catalogue. If any of it needed them, a project would
    // not really be self-contained — it would be a set of pointers into
    // something that moves.
    const copies: readonly ProjectEquipment[] = genericCatalog().map(copyOf);
    for (const copy of copies) {
      expect(copy.familyId).toBeDefined();
      expect(copy.version).toBeDefined();
      expect(copy.provenance?.type).toBeDefined();
      expect(copy.allowedHosts?.length).toBeGreaterThan(0);
      expect(copy.ports?.length ?? 0).toBeGreaterThan(0);
      expect(copy.capabilities).toContain('PLACEABLE');
    }
  });

  it('writes a copy the importer accepts', () => {
    // The port shape said `required: [id, discipline, role, position]` and the
    // copy wrote none of the middle two — so placing an equipment from the
    // panel produced a project the importer would have refused on reopening.
    // The rule this suite exists for is that a command must never be able to
    // do that.
    const commands = new ProjectCommandDispatcher(populatedProject());
    for (const entry of genericCatalog())
      expect(
        commands.dispatch(new AddEquipmentCommand(copyOf(entry))).status,
      ).toBe('APPLIED');
    const issues = validateProjectFile({
      format: 'house-technical-designer-project',
      schemaVersion: CURRENT_PROJECT_SCHEMA_VERSION,
      project: commands.project,
    });
    expect(issues).toEqual([]);
  });
});
