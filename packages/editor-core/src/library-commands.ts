import type {
  EquipmentDefinition,
  Project,
} from '@house-technical-designer/core-domain';
import type {
  Assembly,
  AssemblyCategory,
  AssemblyLayer,
} from '@house-technical-designer/assemblies';
import {
  assemblyId as toAssemblyId,
  assemblyLayerId as toAssemblyLayerId,
  moveAssemblyLayer,
  validateAssembly,
} from '@house-technical-designer/assemblies';
import type { Material, MaterialId } from '@house-technical-designer/materials';
import { validateMaterial } from '@house-technical-designer/materials';
import type { ChangeSet, CommandValidation } from './commands.js';
import type {
  ProjectCommand,
  ProjectCommandExecution,
} from './project-commands.js';

const LIBRARY_DOMAINS = [
  'quantities',
  'thermal',
  'hygrothermal',
  'acoustics',
  'heating',
  'energy',
  'cost',
  'environmental',
  'drawing-overlays',
] as const;

function libraryChanges(...objectIds: readonly string[]): ChangeSet {
  return { objectIds, domains: [...LIBRARY_DOMAINS] };
}

function ok(): CommandValidation {
  return { valid: true };
}

function rejected(...errors: readonly string[]): CommandValidation {
  return { valid: false, errors: [...errors] };
}

function materials(project: Project): readonly Material[] {
  return project.materialLibrary?.materials ?? [];
}

/** Material identifiers an assembly may reference. */
function materialIds(project: Project): ReadonlySet<MaterialId> {
  return new Set(materials(project).map(({ id }) => id));
}

function assemblies(project: Project): readonly Assembly[] {
  return project.assemblies ?? [];
}

function equipment(project: Project): readonly EquipmentDefinition[] {
  return project.equipment ?? [];
}

function withMaterials(project: Project, next: readonly Material[]): Project {
  return { ...project, materialLibrary: { materials: next } };
}

/** Objects that would be left dangling by a deletion, so the user can be told which. */
export interface LibraryReference {
  readonly kind: 'ASSEMBLY' | 'WALL' | 'SLAB' | 'ROOF' | 'NETWORK_NODE';
  readonly id: string;
  readonly name: string;
}

/** Assemblies whose layers use a material. */
export function assembliesUsingMaterial(
  project: Project,
  materialId: string,
): readonly LibraryReference[] {
  return assemblies(project)
    .filter((assembly) =>
      assembly.layers.some((layer) => layer.materialId === materialId),
    )
    .map((assembly) => ({
      kind: 'ASSEMBLY' as const,
      id: assembly.id,
      name: assembly.name,
    }));
}

/** Building elements that reference an assembly. */
export function elementsUsingAssembly(
  project: Project,
  assemblyId: string,
): readonly LibraryReference[] {
  const references: LibraryReference[] = [];
  for (const level of project.building.levels) {
    for (const wall of level.walls)
      if (wall.assemblyId === assemblyId)
        references.push({ kind: 'WALL', id: wall.id, name: wall.id });
    for (const slab of level.slabs)
      if (slab.assemblyId === assemblyId)
        references.push({ kind: 'SLAB', id: slab.id, name: slab.id });
    for (const roof of level.roofs)
      if (roof.assemblyId === assemblyId)
        references.push({ kind: 'ROOF', id: roof.id, name: roof.id });
  }
  return references;
}

/** Network nodes that place an equipment definition. */
export function nodesUsingEquipment(
  project: Project,
  equipmentId: string,
): readonly LibraryReference[] {
  return (project.systems ?? []).flatMap((network) =>
    network.nodes
      .filter((node) => {
        const record = node as unknown as Readonly<Record<string, unknown>>;
        return (
          record.catalogItemId === equipmentId ||
          record.equipmentId === equipmentId
        );
      })
      .map((node) => ({
        kind: 'NETWORK_NODE' as const,
        id: node.id,
        name: `${network.id} · ${node.id}`,
      })),
  );
}

function describe(references: readonly LibraryReference[]): string {
  return references
    .slice(0, 5)
    .map(({ name }) => name)
    .join(', ');
}

abstract class LibraryCommand implements ProjectCommand {
  constructor(
    readonly id: string,
    readonly label: string,
  ) {}
  abstract validate(project: Project): CommandValidation;
  protected abstract apply(project: Project): Project;
  execute(project: Project): ProjectCommandExecution {
    return {
      nextState: this.apply(project),
      changes: libraryChanges(this.id),
      inverse: new RestoreLibraryCommand(
        `${this.id}:inverse`,
        `Annuler ${this.label}`,
        project,
      ),
    };
  }
}

/** Restores a previous project state; used as the inverse of a library edit. */
export class RestoreLibraryCommand implements ProjectCommand {
  constructor(
    readonly id: string,
    readonly label: string,
    readonly previous: Project,
  ) {}
  validate(): CommandValidation {
    return ok();
  }
  execute(project: Project): ProjectCommandExecution {
    return {
      nextState: this.previous,
      changes: libraryChanges(this.id),
      inverse: new RestoreLibraryCommand(
        `${this.id}:inverse`,
        `Rétablir ${this.label}`,
        project,
      ),
    };
  }
}

export class AddMaterialCommand extends LibraryCommand {
  constructor(readonly material: Material) {
    super(
      `material:add:${material.id}`,
      `Ajouter le matériau ${material.name}`,
    );
  }
  validate(project: Project): CommandValidation {
    const issues = validateMaterial(this.material);
    if (issues.length > 0)
      return rejected(
        ...issues.map(({ path, message }) => `${path} : ${message}`),
      );
    return materials(project).some(({ id }) => id === this.material.id)
      ? rejected(`Le matériau ${this.material.id} existe déjà.`)
      : ok();
  }
  protected apply(project: Project): Project {
    return withMaterials(project, [...materials(project), this.material]);
  }
}

export class UpdateMaterialCommand extends LibraryCommand {
  constructor(readonly material: Material) {
    super(
      `material:update:${material.id}`,
      `Modifier le matériau ${material.name}`,
    );
  }
  validate(project: Project): CommandValidation {
    const issues = validateMaterial(this.material);
    if (issues.length > 0)
      return rejected(
        ...issues.map(({ path, message }) => `${path} : ${message}`),
      );
    return materials(project).some(({ id }) => id === this.material.id)
      ? ok()
      : rejected(`Le matériau ${this.material.id} est introuvable.`);
  }
  protected apply(project: Project): Project {
    return withMaterials(
      project,
      materials(project).map((material) =>
        material.id === this.material.id ? this.material : material,
      ),
    );
  }
}

export class RemoveMaterialCommand extends LibraryCommand {
  constructor(readonly materialId: string) {
    super(
      `material:remove:${materialId}`,
      `Supprimer le matériau ${materialId}`,
    );
  }
  validate(project: Project): CommandValidation {
    if (!materials(project).some(({ id }) => id === this.materialId))
      return rejected(`Le matériau ${this.materialId} est introuvable.`);
    const used = assembliesUsingMaterial(project, this.materialId);
    return used.length === 0
      ? ok()
      : rejected(
          `Le matériau est utilisé par ${used.length} assemblage(s) : ${describe(used)}.`,
        );
  }
  protected apply(project: Project): Project {
    return withMaterials(
      project,
      materials(project).filter(({ id }) => id !== this.materialId),
    );
  }
}

export class AddAssemblyCommand extends LibraryCommand {
  constructor(readonly assembly: Assembly) {
    super(
      `assembly:add:${assembly.id}`,
      `Ajouter l'assemblage ${assembly.name}`,
    );
  }
  validate(project: Project): CommandValidation {
    const issues = validateAssembly(this.assembly, materialIds(project));
    if (issues.length > 0)
      return rejected(
        ...issues.map(({ path, message }) => `${path} : ${message}`),
      );
    return assemblies(project).some(({ id }) => id === this.assembly.id)
      ? rejected(`L'assemblage ${this.assembly.id} existe déjà.`)
      : ok();
  }
  protected apply(project: Project): Project {
    return { ...project, assemblies: [...assemblies(project), this.assembly] };
  }
}

export class UpdateAssemblyCommand extends LibraryCommand {
  constructor(readonly assembly: Assembly) {
    super(
      `assembly:update:${assembly.id}`,
      `Modifier l'assemblage ${assembly.name}`,
    );
  }
  validate(project: Project): CommandValidation {
    const issues = validateAssembly(this.assembly, materialIds(project));
    if (issues.length > 0)
      return rejected(
        ...issues.map(({ path, message }) => `${path} : ${message}`),
      );
    return assemblies(project).some(({ id }) => id === this.assembly.id)
      ? ok()
      : rejected(`L'assemblage ${this.assembly.id} est introuvable.`);
  }
  protected apply(project: Project): Project {
    return {
      ...project,
      assemblies: assemblies(project).map((assembly) =>
        assembly.id === this.assembly.id ? this.assembly : assembly,
      ),
    };
  }
}

export class RemoveAssemblyCommand extends LibraryCommand {
  constructor(readonly assemblyId: string) {
    super(
      `assembly:remove:${assemblyId}`,
      `Supprimer l'assemblage ${assemblyId}`,
    );
  }
  validate(project: Project): CommandValidation {
    if (!assemblies(project).some(({ id }) => id === this.assemblyId))
      return rejected(`L'assemblage ${this.assemblyId} est introuvable.`);
    const used = elementsUsingAssembly(project, this.assemblyId);
    return used.length === 0
      ? ok()
      : rejected(
          `L'assemblage est utilisé par ${used.length} élément(s) : ${describe(used)}.`,
        );
  }
  protected apply(project: Project): Project {
    return {
      ...project,
      assemblies: assemblies(project).filter(
        ({ id }) => id !== this.assemblyId,
      ),
    };
  }
}

/** Applies a transformation to one assembly, revalidating it against the library. */
export class EditAssemblyLayersCommand extends LibraryCommand {
  constructor(
    id: string,
    label: string,
    readonly assemblyId: string,
    readonly transform: (assembly: Assembly) => Assembly,
  ) {
    super(id, label);
  }
  private target(project: Project): Assembly | undefined {
    return assemblies(project).find(({ id }) => id === this.assemblyId);
  }
  validate(project: Project): CommandValidation {
    const assembly = this.target(project);
    if (assembly === undefined)
      return rejected(`L'assemblage ${this.assemblyId} est introuvable.`);
    let next: Assembly;
    try {
      next = this.transform(assembly);
    } catch (error) {
      return rejected(
        error instanceof Error ? error.message : 'Transformation impossible.',
      );
    }
    const issues = validateAssembly(next, materialIds(project));
    return issues.length === 0
      ? ok()
      : rejected(...issues.map(({ path, message }) => `${path} : ${message}`));
  }
  protected apply(project: Project): Project {
    return {
      ...project,
      assemblies: assemblies(project).map((assembly) =>
        assembly.id === this.assemblyId ? this.transform(assembly) : assembly,
      ),
    };
  }
}

export function addAssemblyLayerCommand(
  assemblyId: string,
  layer: AssemblyLayer,
  index?: number,
): EditAssemblyLayersCommand {
  return new EditAssemblyLayersCommand(
    `assembly:layer:add:${assemblyId}:${layer.id}`,
    'Ajouter une couche',
    assemblyId,
    (assembly) => {
      const layers = [...assembly.layers];
      layers.splice(index ?? layers.length, 0, layer);
      return { ...assembly, layers };
    },
  );
}

export function removeAssemblyLayerCommand(
  assemblyId: string,
  layerId: string,
): EditAssemblyLayersCommand {
  return new EditAssemblyLayersCommand(
    `assembly:layer:remove:${assemblyId}:${layerId}`,
    'Retirer une couche',
    assemblyId,
    (assembly) => ({
      ...assembly,
      layers: assembly.layers.filter(({ id }) => id !== layerId),
    }),
  );
}

export function moveAssemblyLayerCommand(
  assemblyId: string,
  layerId: string,
  offset: number,
): EditAssemblyLayersCommand {
  return new EditAssemblyLayersCommand(
    `assembly:layer:move:${assemblyId}:${layerId}:${offset}`,
    'Déplacer une couche',
    assemblyId,
    (assembly) => {
      const fromIndex = assembly.layers.findIndex(({ id }) => id === layerId);
      if (fromIndex < 0)
        throw new RangeError(`La couche ${layerId} est introuvable.`);
      return moveAssemblyLayer(assembly, fromIndex, fromIndex + offset);
    },
  );
}

export function setAssemblyLayerThicknessCommand(
  assemblyId: string,
  layerId: string,
  thicknessMm: number,
): EditAssemblyLayersCommand {
  return new EditAssemblyLayersCommand(
    `assembly:layer:thickness:${assemblyId}:${layerId}`,
    'Modifier une épaisseur',
    assemblyId,
    (assembly) => ({
      ...assembly,
      layers: assembly.layers.map((layer) =>
        layer.id === layerId
          ? { ...layer, thicknessM: thicknessMm / 1000 }
          : layer,
      ),
    }),
  );
}

export function setAssemblyLayerMaterialCommand(
  assemblyId: string,
  layerId: string,
  materialId: MaterialId,
): EditAssemblyLayersCommand {
  return new EditAssemblyLayersCommand(
    `assembly:layer:material:${assemblyId}:${layerId}`,
    'Changer le matériau d’une couche',
    assemblyId,
    (assembly) => ({
      ...assembly,
      layers: assembly.layers.map((layer) =>
        layer.id === layerId ? { ...layer, materialId } : layer,
      ),
    }),
  );
}

/**
 * Property values an equipment may carry.
 *
 * A form can produce NaN from an emptied number field, and NaN is not a value
 * JSON can hold: written into a project it would survive in memory and vanish
 * on save. A value that cannot be persisted is refused here rather than
 * discovered later.
 */
function invalidProperties(equipment: EquipmentDefinition): readonly string[] {
  const errors: string[] = [];
  for (const [key, value] of Object.entries(equipment.properties)) {
    if (typeof value === 'number' && !Number.isFinite(value))
      errors.push(
        `La propriété ${key} n'est pas un nombre : videz le champ pour la retirer plutôt que d'y laisser une valeur invalide.`,
      );
    if (typeof value === 'function' || typeof value === 'undefined')
      errors.push(`La propriété ${key} n'est pas une valeur enregistrable.`);
  }
  return errors;
}

export class AddEquipmentCommand extends LibraryCommand {
  constructor(readonly equipment: EquipmentDefinition) {
    super(
      `equipment:add:${equipment.id}`,
      `Ajouter l'équipement ${equipment.id}`,
    );
  }
  validate(project: Project): CommandValidation {
    if (this.equipment.id.trim() === '')
      return rejected("L'identifiant de l'équipement ne peut pas être vide.");
    const invalid = invalidProperties(this.equipment);
    if (invalid.length > 0) return rejected(...invalid);
    return equipment(project).some(({ id }) => id === this.equipment.id)
      ? rejected(`L'équipement ${this.equipment.id} existe déjà.`)
      : ok();
  }
  protected apply(project: Project): Project {
    return { ...project, equipment: [...equipment(project), this.equipment] };
  }
}

export class UpdateEquipmentCommand extends LibraryCommand {
  constructor(readonly equipment: EquipmentDefinition) {
    super(
      `equipment:update:${equipment.id}`,
      `Modifier l'équipement ${equipment.id}`,
    );
  }
  validate(project: Project): CommandValidation {
    if (!equipment(project).some(({ id }) => id === this.equipment.id))
      return rejected(`L'équipement ${this.equipment.id} est introuvable.`);
    const invalid = invalidProperties(this.equipment);
    return invalid.length > 0 ? rejected(...invalid) : ok();
  }
  protected apply(project: Project): Project {
    return {
      ...project,
      equipment: equipment(project).map((item) =>
        item.id === this.equipment.id ? this.equipment : item,
      ),
    };
  }
}

export class RemoveEquipmentCommand extends LibraryCommand {
  constructor(readonly equipmentId: string) {
    super(
      `equipment:remove:${equipmentId}`,
      `Supprimer l'équipement ${equipmentId}`,
    );
  }
  validate(project: Project): CommandValidation {
    if (!equipment(project).some(({ id }) => id === this.equipmentId))
      return rejected(`L'équipement ${this.equipmentId} est introuvable.`);
    const used = nodesUsingEquipment(project, this.equipmentId);
    return used.length === 0
      ? ok()
      : rejected(
          `L'équipement est posé sur ${used.length} nœud(s) de réseau : ${describe(used)}.`,
        );
  }
  protected apply(project: Project): Project {
    return {
      ...project,
      equipment: equipment(project).filter(({ id }) => id !== this.equipmentId),
    };
  }
}

/** Copies catalogue materials into a project, skipping the ones already present. */
export class ImportMaterialsCommand extends LibraryCommand {
  constructor(readonly imported: readonly Material[]) {
    super(
      `material:import:${imported.length}`,
      `Importer ${imported.length} matériau(x)`,
    );
  }
  private additions(project: Project): readonly Material[] {
    const known = new Set(materials(project).map(({ id }) => id));
    return this.imported.filter(({ id }) => !known.has(id));
  }
  validate(project: Project): CommandValidation {
    const additions = this.additions(project);
    if (additions.length === 0)
      return rejected('Tous ces matériaux sont déjà dans le projet.');
    const issues = additions.flatMap((material) => validateMaterial(material));
    return issues.length === 0
      ? ok()
      : rejected(...issues.map(({ path, message }) => `${path} : ${message}`));
  }
  protected apply(project: Project): Project {
    return withMaterials(project, [
      ...materials(project),
      ...this.additions(project),
    ]);
  }
}

/** Builds an empty assembly of a category, ready to receive layers. */
export function draftAssembly(
  id: string,
  name: string,
  category: AssemblyCategory,
  layers: readonly AssemblyLayer[] = [],
): Assembly {
  return { id: toAssemblyId(id), name, category, layers };
}

/** Builds an assembly layer from millimetres, the unit the interface works in. */
export function draftAssemblyLayer(
  id: string,
  materialId: MaterialId,
  thicknessMm: number,
  role?: AssemblyLayer['role'],
): AssemblyLayer {
  return {
    id: toAssemblyLayerId(id),
    materialId,
    thicknessM: thicknessMm / 1000,
    ...(role === undefined ? {} : { role }),
  };
}
