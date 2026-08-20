import type {
  Assembly,
  AssemblyLayer,
} from '@house-technical-designer/assemblies';
import { serializedTotalThicknessM } from '@house-technical-designer/assemblies';
import type {
  KnownMaterialProperty,
  Material,
  MaterialEditorRow,
  MaterialFilter,
  MaterialSource,
  MaterialSourceType,
} from '@house-technical-designer/materials';
import { queryMaterials } from '@house-technical-designer/materials';
import { calculateThermalResistance } from '@house-technical-designer/thermal';
import type {
  EquipmentDefinition as ProjectEquipment,
  Project,
} from '@house-technical-designer/core-domain';
import type { EquipmentDefinition } from '@house-technical-designer/equipment-catalog';
import {
  assembliesUsingMaterial,
  elementsUsingAssembly,
  type LibraryReference,
} from '@house-technical-designer/editor-core';

/** Properties the interface shows for every material, with their unit and group. */
export const MATERIAL_PROPERTY_FIELDS = [
  {
    key: 'densityKgM3',
    label: 'Masse volumique',
    unit: 'kg/m³',
    group: 'Physique',
  },
  {
    key: 'specificHeatJKgK',
    label: 'Chaleur massique',
    unit: 'J/(kg·K)',
    group: 'Physique',
  },
  {
    key: 'lambdaWmK',
    label: 'Conductivité λ',
    unit: 'W/(m·K)',
    group: 'Thermique',
  },
  { key: 'emissivity', label: 'Émissivité', unit: '—', group: 'Thermique' },
  {
    key: 'mu',
    label: 'Facteur de résistance à la vapeur μ',
    unit: '—',
    group: 'Hygrothermique',
  },
  {
    key: 'sdM',
    label: 'Épaisseur d’air équivalente Sd',
    unit: 'm',
    group: 'Hygrothermique',
  },
] as const satisfies readonly {
  readonly key: KnownMaterialProperty;
  readonly label: string;
  readonly unit: string;
  readonly group: string;
}[];

export const MATERIAL_PROPERTY_KEYS = MATERIAL_PROPERTY_FIELDS.map(
  ({ key }) => key,
);

export interface MaterialRowView extends MaterialEditorRow {
  /** Assemblies that would break if the material were deleted. */
  readonly usedBy: readonly LibraryReference[];
  readonly deletable: boolean;
}

/** Builds the material list the panel renders, including deletion safety. */
export function materialRows(
  project: Project,
  filter: MaterialFilter = {},
): readonly MaterialRowView[] {
  const materials = project.materialLibrary?.materials ?? [];
  return queryMaterials(materials, {
    ...filter,
    requiredProperties: filter.requiredProperties ?? MATERIAL_PROPERTY_KEYS,
  }).map((row) => {
    const usedBy = assembliesUsingMaterial(project, row.material.id);
    return { ...row, usedBy, deletable: usedBy.length === 0 };
  });
}

/** Categories present in a project library, for the filter menu. */
export function materialCategories(project: Project): readonly string[] {
  return [
    ...new Set(
      (project.materialLibrary?.materials ?? [])
        .map(({ category }) => category)
        .filter((category): category is string => category !== undefined),
    ),
  ].sort((first, second) => first.localeCompare(second, 'fr'));
}

export interface AssemblyLayerView {
  readonly layer: AssemblyLayer;
  readonly materialName: string;
  readonly thicknessMm: number;
  readonly lambdaWmK?: number;
  readonly resistanceM2KW?: number;
  /** Share of the total thickness, for the graphic preview. */
  readonly thicknessRatio: number;
}

export interface AssemblyView {
  readonly assembly: Assembly;
  readonly layers: readonly AssemblyLayerView[];
  readonly totalThicknessMm: number;
  readonly thermalResistanceM2KW?: number;
  readonly uValueWm2K?: number;
  /** Layers whose material declares no conductivity, so R and U stay unknown. */
  readonly missingConductivityLayerIds: readonly string[];
  readonly usedBy: readonly LibraryReference[];
  readonly deletable: boolean;
}

/**
 * Surface resistances used only for the library preview.
 *
 * The authoritative envelope calculation reads them from the project's thermal
 * module settings; this preview states the convention it applied so the value on
 * screen can be traced.
 */
export const PREVIEW_SURFACE_RESISTANCES = {
  insideSurfaceResistanceM2KW: 0.13,
  outsideSurfaceResistanceM2KW: 0.04,
  reference: 'ISO 6946, flux horizontal',
} as const;

/** Builds the assembly view: layers, thicknesses and derived R and U. */
export function assemblyView(
  project: Project,
  assembly: Assembly,
): AssemblyView {
  const materials = new Map(
    (project.materialLibrary?.materials ?? []).map((material) => [
      material.id,
      material,
    ]),
  );
  const totalThicknessMm = Math.round(
    serializedTotalThicknessM(assembly) * 1000,
  );
  const resistance = calculateThermalResistance(
    assembly.layers.map((layer) => {
      const lambdaWmK = materials.get(layer.materialId)?.properties.lambdaWmK;
      return {
        layerId: layer.id,
        materialId: layer.materialId,
        thicknessM: layer.thicknessM,
        ...(typeof lambdaWmK === 'number' ? { lambdaWmK } : {}),
      };
    }),
    {
      id: 'library-preview',
      version: '1',
      insideSurfaceResistanceM2KW:
        PREVIEW_SURFACE_RESISTANCES.insideSurfaceResistanceM2KW,
      outsideSurfaceResistanceM2KW:
        PREVIEW_SURFACE_RESISTANCES.outsideSurfaceResistanceM2KW,
    },
  );
  const byLayerId = new Map(
    resistance.layers.map((layer) => [layer.layerId, layer]),
  );
  const usedBy = elementsUsingAssembly(project, assembly.id);
  return {
    assembly,
    totalThicknessMm,
    layers: assembly.layers.map((layer) => {
      const material = materials.get(layer.materialId);
      const lambdaWmK = material?.properties.lambdaWmK;
      const resistanceM2KW = byLayerId.get(layer.id)?.resistanceM2KW;
      return {
        layer,
        materialName: material?.name ?? `${layer.materialId} (absent)`,
        thicknessMm: Math.round(layer.thicknessM * 1000),
        ...(typeof lambdaWmK === 'number' ? { lambdaWmK } : {}),
        ...(resistanceM2KW === undefined ? {} : { resistanceM2KW }),
        thicknessRatio:
          totalThicknessMm === 0
            ? 0
            : (layer.thicknessM * 1000) / totalThicknessMm,
      };
    }),
    ...(resistance.totalResistanceM2KW === undefined
      ? {}
      : { thermalResistanceM2KW: resistance.totalResistanceM2KW }),
    ...(resistance.uValueWm2K === undefined
      ? {}
      : { uValueWm2K: resistance.uValueWm2K }),
    missingConductivityLayerIds: resistance.diagnostics
      .filter(({ code }) => code === 'THERMAL_MISSING_LAMBDA')
      .map(({ layerId }) => layerId)
      .filter((layerId): layerId is string => layerId !== undefined),
    usedBy,
    deletable: usedBy.length === 0,
  };
}

/** Builds every assembly view of a project, in declaration order. */
export function assemblyViews(project: Project): readonly AssemblyView[] {
  return (project.assemblies ?? []).map((assembly) =>
    assemblyView(project, assembly),
  );
}

/** A free identifier derived from a name, so the user never types one. */
export function nextLibraryId(
  prefix: string,
  name: string,
  taken: readonly string[],
): string {
  const slug =
    name
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/gu, '-')
      .replace(/^-|-$/gu, '') || 'sans-nom';
  const used = new Set(taken);
  const base = `${prefix}-${slug}`;
  if (!used.has(base)) return base;
  for (let index = 2; ; index += 1) {
    const candidate = `${base}-${index}`;
    if (!used.has(candidate)) return candidate;
  }
}

/** Copies a material as a project-owned custom entry, keeping its provenance. */
export function duplicateMaterialDraft(
  material: Material,
  taken: readonly string[],
): Material {
  const name = `${material.name} (copie)`;
  return {
    ...material,
    id: nextLibraryId('material', name, taken) as Material['id'],
    name,
    kind: 'CUSTOM',
    sources: (material.sources ?? []).map((source) => ({
      ...source,
      reference: `Copié de ${material.id} — ${source.reference ?? 'sans référence'}`,
    })),
  };
}

/** The provenances a property value can be given, with what each one means. */
export const MATERIAL_SOURCE_TYPES = [
  {
    value: 'STANDARD',
    label: 'Norme',
    hint: 'Valeur tabulée d’une norme ou d’un référentiel public.',
  },
  {
    value: 'MANUFACTURER',
    label: 'Fabricant',
    hint: 'Performance déclarée par le fabricant du produit.',
  },
  {
    value: 'DATABASE',
    label: 'Base de données',
    hint: 'Valeur reprise d’une base tierce identifiée.',
  },
  { value: 'USER', label: 'Saisie', hint: 'Valeur saisie dans ce projet.' },
  {
    value: 'CALCULATED',
    label: 'Calculée',
    hint: 'Valeur déduite d’autres données, dont la méthode est à citer.',
  },
  { value: 'OTHER', label: 'Autre', hint: 'Provenance à décrire librement.' },
] as const satisfies readonly {
  readonly value: MaterialSourceType;
  readonly label: string;
  readonly hint: string;
}[];

/** What a property declares about where its value comes from. */
export function propertySource(
  material: Material,
  property: string,
): MaterialSource | undefined {
  return (material.sources ?? []).find(
    (source) => source.property === property,
  );
}

/**
 * The material with the provenance of one property replaced.
 *
 * A provenance without a type is no provenance at all, so clearing the type
 * removes the entry rather than leaving a reference attached to nothing.
 */
export interface PropertySourcePatch {
  readonly sourceType?: MaterialSourceType | '';
  readonly reference?: string;
}

export function withPropertySource(
  material: Material,
  property: string,
  next: PropertySourcePatch,
): Material {
  const current = propertySource(material, property);
  const others = (material.sources ?? []).filter(
    (source) => source.property !== property,
  );
  const sourceType = next.sourceType ?? current?.sourceType;
  if (sourceType === undefined || sourceType === '')
    return others.length === 0
      ? withoutSources(material)
      : { ...material, sources: others };
  const reference = next.reference ?? current?.reference;
  const entry: MaterialSource = {
    property,
    sourceType,
    ...(reference === undefined || reference.trim() === ''
      ? {}
      : { reference }),
  };
  return { ...material, sources: [...others, entry] };
}

function withoutSources(material: Material): Material {
  const { sources: _sources, ...rest } = material;
  return rest;
}

/**
 * The material with one property set to a value the user typed.
 *
 * Overwriting a number taken from a standard makes the reference describe a
 * value that is no longer there, so the provenance follows the edit: it becomes
 * a user entry, and the user may then say where the number actually comes from.
 * A material that never declared a provenance stays without one — an unknown
 * provenance is not invented here either.
 */
export function withEditedProperty(
  material: Material,
  property: string,
  value: number | undefined,
): Material {
  const properties = { ...material.properties };
  if (value === undefined) delete properties[property];
  else properties[property] = value;
  const edited = { ...material, properties };
  const current = propertySource(material, property);
  if (value === undefined)
    return current === undefined
      ? edited
      : withPropertySource(edited, property, { sourceType: '' });
  if (current === undefined || current.sourceType === 'USER') return edited;
  if (material.properties[property] === value) return edited;
  return withPropertySource(edited, property, {
    sourceType: 'USER',
    reference: '',
  });
}

/**
 * Copies a catalogue definition into the project.
 *
 * The project keeps the catalogue identifier and version so a later catalogue
 * update never rewrites a project silently.
 */
export function projectEquipmentFromCatalog(
  definition: EquipmentDefinition,
  takenIds: readonly string[],
): ProjectEquipment {
  return {
    id: nextLibraryId('equipment', definition.name, takenIds),
    kind: definition.kind,
    catalogKind: definition.catalogKind,
    properties: {
      ...definition.properties,
      name: definition.name,
      catalogDefinitionId: definition.id,
      catalogDefinitionVersion: definition.version,
    },
  };
}
