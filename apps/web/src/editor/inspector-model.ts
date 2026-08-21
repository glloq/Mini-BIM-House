import type { Project } from '@house-technical-designer/core-domain';
import {
  calculateWallNetArea,
  resolveDimension,
  stairDimensions,
} from '@house-technical-designer/core-domain';
import { serializedTotalThicknessM } from '@house-technical-designer/assemblies';
import { polygonArea } from '@house-technical-designer/geometry';
import { assemblyView } from '../library/library-model.js';

export interface InspectorField {
  readonly label: string;
  /** Formatted value, or undefined when the model does not know it. */
  readonly value?: string;
  readonly hint?: string;
}

export interface InspectorSection {
  readonly title: string;
  readonly fields: readonly InspectorField[];
}

/** What each family of placed component is called in the interface. */
export const COMPONENT_CATEGORY_LABELS: Readonly<Record<string, string>> = {
  HEATING: 'Chauffage',
  SANITARY: 'Sanitaire',
  VENTILATION: 'Ventilation',
  ELECTRICAL: 'Électricité',
  LIGHTING: 'Éclairage',
  PHOTOVOLTAIC: 'Photovoltaïque',
  APPLIANCE: 'Appareil',
  FURNITURE: 'Mobilier',
  OTHER: 'Autre',
};

export interface InspectorSubject {
  readonly objectId: string;
  readonly kind:
    | 'WALL'
    | 'OPENING'
    | 'SPACE'
    | 'SLAB'
    | 'ROOF'
    | 'NETWORK_EDGE'
    | 'NETWORK_NODE'
    | 'DIMENSION'
    | 'COMPONENT'
    | 'STAIR'
    | 'UNKNOWN';
  readonly title: string;
  readonly sections: readonly InspectorSection[];
}

const metres = (millimetres: number): string =>
  `${(millimetres / 1000).toFixed(2)} m`;

export function field(
  label: string,
  value: string | number | undefined,
  hint?: string,
): InspectorField {
  return {
    label,
    ...(value === undefined ? {} : { value: String(value) }),
    ...(hint === undefined ? {} : { hint }),
  };
}

export function wallSubject(
  project: Project,
  objectId: string,
): InspectorSubject | undefined {
  for (const level of project.building.levels) {
    const wall = level.walls.find(({ id }) => id === objectId);
    if (wall === undefined) continue;
    const assembly = (project.assemblies ?? []).find(
      ({ id }) => id === wall.assemblyId,
    );
    const points = wall.path.points;
    let lengthMm = 0;
    for (let index = 1; index < points.length; index += 1)
      lengthMm += Math.hypot(
        points[index]!.x - points[index - 1]!.x,
        points[index]!.y - points[index - 1]!.y,
      );
    const heightMm = wall.heightMode === 'EXPLICIT' ? wall.heightMm : undefined;
    const openings = level.openings.filter(
      ({ hostElementId }) => hostElementId === wall.id,
    );
    const area = calculateWallNetArea(wall, openings);
    const view =
      assembly === undefined ? undefined : assemblyView(project, assembly);
    return {
      objectId,
      kind: 'WALL',
      title: `Mur ${wall.id}`,
      sections: [
        {
          title: 'Géométrie',
          fields: [
            field('Longueur', metres(lengthMm)),
            field(
              'Hauteur',
              heightMm === undefined ? undefined : metres(heightMm),
              heightMm === undefined ? 'Hauteur héritée du niveau' : undefined,
            ),
            field(
              'Épaisseur',
              assembly === undefined
                ? undefined
                : `${Math.round(serializedTotalThicknessM(assembly) * 1000)} mm`,
            ),
            field('Axe de référence', wall.referenceSide),
            field('Rôle', wall.role),
          ],
        },
        {
          title: 'Matériaux',
          fields:
            view === undefined
              ? [field('Assemblage', undefined, 'Assemblage introuvable')]
              : [
                  field('Assemblage', view.assembly.name),
                  ...view.layers.map((layer) =>
                    field(
                      layer.materialName,
                      `${layer.thicknessMm} mm`,
                      layer.layer.role,
                    ),
                  ),
                ],
        },
        {
          title: 'Thermique',
          fields: [
            field(
              'Résistance R',
              view?.thermalResistanceM2KW === undefined
                ? undefined
                : `${view.thermalResistanceM2KW.toFixed(2)} m²·K/W`,
              view?.thermalResistanceM2KW === undefined
                ? 'Une couche ne déclare pas sa conductivité'
                : undefined,
            ),
            field(
              'Transmission U',
              view?.uValueWm2K === undefined
                ? undefined
                : `${view.uValueWm2K.toFixed(3)} W/(m²·K)`,
            ),
          ],
        },
        {
          title: 'Quantités',
          fields: [
            field(
              'Surface brute',
              area?.status === 'OK'
                ? `${(area.grossAreaMm2 / 1_000_000).toFixed(2)} m²`
                : undefined,
            ),
            field(
              'Surface nette',
              area?.status === 'OK'
                ? `${(area.netAreaMm2 / 1_000_000).toFixed(2)} m²`
                : undefined,
              area?.status === 'OK'
                ? undefined
                : 'Hauteur ou ouvertures indéterminées',
            ),
            field('Ouvertures hébergées', openings.length),
          ],
        },
        {
          title: 'Références',
          fields: [
            field('Niveau', level.name),
            field('Identifiant', wall.id),
            field('Assemblage', wall.assemblyId),
          ],
        },
      ],
    };
  }
  return undefined;
}

export function openingSubject(
  project: Project,
  objectId: string,
): InspectorSubject | undefined {
  for (const level of project.building.levels) {
    const opening = level.openings.find(({ id }) => id === objectId);
    if (opening === undefined) continue;
    return {
      objectId,
      kind: 'OPENING',
      title: `${opening.openingType === 'DOOR' ? 'Porte' : 'Fenêtre'} ${opening.id}`,
      sections: [
        {
          title: 'Géométrie',
          fields: [
            field('Largeur', `${opening.widthMm} mm`),
            field('Hauteur', `${opening.heightMm} mm`),
            field('Allège', `${opening.sillHeightMm} mm`),
            field('Position sur le mur', `${opening.offsetAlongHostMm} mm`),
          ],
        },
        {
          title: 'Quantités',
          fields: [
            field(
              'Surface',
              `${((opening.widthMm * opening.heightMm) / 1_000_000).toFixed(2)} m²`,
            ),
          ],
        },
        {
          title: 'Références',
          fields: [
            field('Mur porteur', opening.hostElementId),
            field('Niveau', level.name),
          ],
        },
      ],
    };
  }
  return undefined;
}

export function spaceSubject(
  project: Project,
  objectId: string,
): InspectorSubject | undefined {
  for (const level of project.building.levels) {
    const space = level.spaces.find(({ id }) => id === objectId);
    if (space === undefined) continue;
    const polygon =
      space.boundaryMode === 'MANUAL' ? space.manualPolygon : undefined;
    const areaM2 =
      polygon === undefined
        ? undefined
        : Math.abs(polygonArea(polygon)) / 1_000_000;
    const heightM = level.defaultStoreyHeightMm / 1000;
    const terminals = (project.systems ?? [])
      .filter(({ discipline }) => discipline === 'VENTILATION')
      .flatMap(({ nodes }) => nodes)
      .filter((node) => node.spaceId === space.id);
    const flowM3h = terminals.reduce<number>((total, node) => {
      // Stated in the node's property record; older files carried it as a
      // field of the node itself, and both are read.
      const value =
        node.properties?.targetFlowM3h ??
        (node as unknown as Record<string, unknown>).targetFlowM3h;
      return total + (typeof value === 'number' ? value : 0);
    }, 0);
    const luminaires = (project.systems ?? [])
      .filter(({ discipline }) => discipline === 'ELECTRICAL')
      .flatMap(({ nodes }) => nodes)
      .filter((node) => node.spaceId === space.id && node.kind === 'LUMINAIRE');
    return {
      objectId,
      kind: 'SPACE',
      title: space.name,
      sections: [
        {
          title: 'Géométrie',
          fields: [
            field(
              'Surface',
              areaM2 === undefined ? undefined : `${areaM2.toFixed(2)} m²`,
              areaM2 === undefined
                ? 'Contour automatique non résolu'
                : undefined,
            ),
            field('Hauteur', `${heightM.toFixed(2)} m`),
            field(
              'Volume',
              areaM2 === undefined
                ? undefined
                : `${(areaM2 * heightM).toFixed(2)} m³`,
            ),
            field('Catégorie', space.category),
          ],
        },
        {
          title: 'Ventilation',
          fields: [
            field('Terminaux', terminals.length),
            field(
              'Débit de conception',
              terminals.length === 0 ? undefined : `${flowM3h} m³/h`,
              terminals.length === 0
                ? 'Aucun terminal ne dessert cette pièce'
                : undefined,
            ),
          ],
        },
        {
          title: 'Éclairage',
          fields: [field('Luminaires posés', luminaires.length)],
        },
        {
          title: 'Références',
          fields: [
            field('Niveau', level.name),
            field('Identifiant', space.id),
            field('Zone thermique', space.thermalZoneId),
          ],
        },
      ],
    };
  }
  return undefined;
}

export function networkSubject(
  project: Project,
  objectId: string,
): InspectorSubject | undefined {
  for (const network of project.systems ?? []) {
    const edge = network.edges.find(({ id }) => id === objectId);
    if (edge !== undefined) {
      let lengthMm = 0;
      for (let index = 1; index < edge.path.length; index += 1) {
        const previous = edge.path[index - 1]!;
        const current = edge.path[index]!;
        lengthMm += Math.hypot(
          current.x - previous.x,
          current.y - previous.y,
          current.z - previous.z,
        );
      }
      const properties = edge.properties ?? {};
      const diameter =
        typeof properties.internalDiameterM === 'number'
          ? properties.internalDiameterM
          : typeof properties.diameterM === 'number'
            ? properties.diameterM
            : undefined;
      return {
        objectId,
        kind: 'NETWORK_EDGE',
        title: `${network.discipline} · ${edge.id}`,
        sections: [
          {
            title: 'Géométrie',
            fields: [
              field('Longueur', metres(lengthMm)),
              field(
                'Diamètre intérieur',
                diameter === undefined
                  ? undefined
                  : `${(diameter * 1000).toFixed(1)} mm`,
                diameter === undefined ? 'Diamètre non renseigné' : undefined,
              ),
              field('Type', edge.kind),
            ],
          },
          {
            title: 'Références',
            fields: [
              field('Réseau', network.id),
              field('Discipline', network.discipline),
              field('Système', network.systemType),
            ],
          },
        ],
      };
    }
    const node = network.nodes.find(({ id }) => id === objectId);
    if (node === undefined) continue;
    // Properties live in the node's record; a file written before that record
    // existed carried them as fields of the node, and both are shown.
    const record: Record<string, unknown> = {
      ...(node as unknown as Record<string, unknown>),
      ...(node.properties ?? {}),
    };
    return {
      objectId,
      kind: 'NETWORK_NODE',
      title: `${network.discipline} · ${node.id}`,
      sections: [
        {
          title: 'Position',
          fields: [
            field('X', `${node.position.x} mm`),
            field('Y', `${node.position.y} mm`),
            field('Z', `${node.position.z} mm`),
          ],
        },
        {
          title: 'Propriétés',
          fields: Object.entries(record)
            .filter(
              ([key]) =>
                ![
                  'id',
                  'kind',
                  'position',
                  'spaceId',
                  'hostObjectId',
                  'properties',
                ].includes(key),
            )
            .map(([key, value]) =>
              field(
                key,
                typeof value === 'string' ||
                  typeof value === 'number' ||
                  typeof value === 'boolean'
                  ? String(value)
                  : undefined,
              ),
            ),
        },
        {
          title: 'Références',
          fields: [
            field('Réseau', network.id),
            field('Type de nœud', node.kind),
            field('Pièce desservie', node.spaceId),
          ],
        },
      ],
    };
  }
  return undefined;
}

export function buildingElementSubject(
  project: Project,
  objectId: string,
): InspectorSubject | undefined {
  for (const level of project.building.levels) {
    const slab = level.slabs.find(({ id }) => id === objectId);
    if (slab !== undefined)
      return {
        objectId,
        kind: 'SLAB',
        title: `Dalle ${slab.id}`,
        sections: [
          {
            title: 'Géométrie',
            fields: [
              field(
                'Surface',
                `${(Math.abs(polygonArea(slab.polygon)) / 1_000_000).toFixed(2)} m²`,
              ),
              field('Rôle', slab.role),
              field('Décalage', `${slab.elevationOffsetMm} mm`),
            ],
          },
          {
            title: 'Références',
            fields: [
              field('Assemblage', slab.assemblyId),
              field('Niveau', level.name),
            ],
          },
        ],
      };
    const roof = level.roofs.find(({ id }) => id === objectId);
    if (roof !== undefined)
      return {
        objectId,
        kind: 'ROOF',
        title: `Pan de toiture ${roof.id}`,
        sections: [
          {
            title: 'Géométrie',
            fields: [
              field(
                'Surface projetée',
                `${(Math.abs(polygonArea(roof.footprint)) / 1_000_000).toFixed(2)} m²`,
              ),
              field('Pente', `${roof.slopeDeg}°`),
              field('Azimut', `${roof.azimuthDeg}°`),
            ],
          },
          {
            title: 'Références',
            fields: [
              field('Assemblage', roof.assemblyId),
              field('Niveau', level.name),
            ],
          },
        ],
      };
  }
  return undefined;
}

const DIMENSION_TYPE_LABELS: Readonly<Record<string, string>> = {
  ALIGNED: 'Alignée',
  HORIZONTAL: 'Horizontale',
  VERTICAL: 'Verticale',
};

export function dimensionSubject(
  project: Project,
  objectId: string,
): InspectorSubject | undefined {
  for (const level of project.building.levels) {
    const dimension = level.annotations.find(({ id }) => id === objectId);
    if (dimension === undefined) continue;
    const resolution = resolveDimension(dimension, level.walls);
    return {
      objectId,
      kind: 'DIMENSION',
      title: `Cote ${DIMENSION_TYPE_LABELS[dimension.type] ?? dimension.type}`,
      sections: [
        {
          title: 'Mesure',
          fields: [
            resolution.status === 'OK'
              ? field('Valeur', metres(resolution.valueMm))
              : field(
                  'Valeur',
                  undefined,
                  `Murs référencés absents : ${resolution.missingWallIds.join(', ')}.`,
                ),
            field('Décalage', metres(dimension.offsetMm)),
            field(
              'Texte affiché',
              dimension.overrideText,
              dimension.overrideText === undefined
                ? 'La valeur mesurée est affichée telle quelle.'
                : 'Texte imposé : il ne remplace pas la valeur mesurée.',
            ),
          ],
        },
        {
          title: 'Références',
          fields: [
            field(
              'Première extrémité',
              `${dimension.first.wallId} · ${dimension.first.endpoint === 'START' ? 'début' : 'fin'}`,
            ),
            field(
              'Seconde extrémité',
              `${dimension.second.wallId} · ${dimension.second.endpoint === 'START' ? 'début' : 'fin'}`,
            ),
            field('Niveau', level.name),
          ],
        },
      ],
    };
  }
  return undefined;
}

/** What a thing placed in the building shows in the inspector. */
export function componentSubject(
  project: Project,
  objectId: string,
): InspectorSubject | undefined {
  for (const level of project.building.levels) {
    const component = (level.components ?? []).find(
      ({ id }) => id === objectId,
    );
    if (component === undefined) continue;
    const definition = (project.equipment ?? []).find(
      ({ id }) => id === component.definitionId,
    );
    const room = level.spaces.find(({ id }) => id === component.spaceId);
    return {
      objectId,
      kind: 'COMPONENT',
      title:
        component.name ??
        `${COMPONENT_CATEGORY_LABELS[component.category] ?? component.category} ${component.id}`,
      sections: [
        {
          title: 'Implantation',
          fields: [
            field('Niveau', level.name),
            field(
              'Position',
              `${Math.round(component.position.x)} ; ${Math.round(component.position.y)} mm`,
            ),
            field('Altitude sur le niveau', `${component.elevationMm} mm`),
            field('Orientation', `${component.rotationDeg.toFixed(1)}°`),
            field(
              'Pièce',
              room?.name,
              room === undefined
                ? 'Ce composant ne déclare aucune pièce.'
                : undefined,
            ),
          ],
        },
        {
          title: 'Modèle',
          fields: [
            field(
              'Catégorie',
              COMPONENT_CATEGORY_LABELS[component.category] ??
                component.category,
            ),
            // The properties of the model belong to the model: repeating them
            // here would be a second answer to one question, and the two would
            // stop agreeing the first time one of them changed.
            field(
              'Modèle catalogue',
              definition === undefined ? undefined : definition.kind,
              definition === undefined
                ? 'Ce composant ne renvoie à aucun modèle du catalogue.'
                : undefined,
            ),
            field('Identifiant du modèle', component.definitionId),
          ],
        },
        {
          title: 'Références',
          fields: [
            field('Identifiant', component.id),
            field(
              'Support',
              component.hostObjectId,
              component.hostObjectId === undefined
                ? 'Ce composant n’est fixé à rien.'
                : undefined,
            ),
          ],
        },
      ],
    };
  }
  return undefined;
}

/** What a stair shows: what it joins, and what that makes it measure. */
export function stairSubject(
  project: Project,
  objectId: string,
): InspectorSubject | undefined {
  for (const level of project.building.levels) {
    const stair = level.stairs.find(({ id }) => id === objectId);
    if (stair === undefined) continue;
    const top = project.building.levels.find(
      ({ id }) => id === stair.topLevelId,
    );
    const riseMm =
      top === undefined ? undefined : top.elevationMm - level.elevationMm;
    const measured =
      riseMm === undefined ? undefined : stairDimensions(stair, riseMm);
    const comfortable =
      measured === undefined
        ? undefined
        : measured.blondelMm >= 590 && measured.blondelMm <= 650;
    return {
      objectId,
      kind: 'STAIR',
      title: `Escalier ${stair.id}`,
      sections: [
        {
          title: 'Ce qu’il joint',
          fields: [
            field('Niveau de départ', level.name),
            field(
              'Niveau d’arrivée',
              top?.name,
              top === undefined
                ? 'Ce niveau n’existe pas dans le projet.'
                : undefined,
            ),
            field(
              'Hauteur à monter',
              riseMm === undefined ? undefined : metres(riseMm),
              riseMm === undefined
                ? 'Sans niveau d’arrivée, la montée est inconnue.'
                : undefined,
            ),
          ],
        },
        {
          title: 'Dimensionnement',
          fields: [
            field('Nombre de contremarches', stair.riserCount),
            field(
              'Hauteur de marche',
              measured === undefined
                ? undefined
                : `${measured.riserHeightMm.toFixed(1)} mm`,
              measured === undefined
                ? 'Elle se déduit de la montée, qui est inconnue.'
                : 'Déduite de la montée et du nombre de contremarches.',
            ),
            field('Giron', `${stair.treadDepthMm} mm`),
            field('Emmarchement', `${stair.widthMm} mm`),
            field(
              'Longueur au sol',
              measured === undefined ? undefined : metres(measured.runMm),
            ),
            field(
              'Formule de Blondel',
              measured === undefined
                ? undefined
                : `${measured.blondelMm.toFixed(0)} mm`,
              comfortable === undefined
                ? undefined
                : comfortable
                  ? 'Entre 590 et 650 mm : confortable.'
                  : 'Hors de 590–650 mm : inconfortable, à vous de décider.',
            ),
          ],
        },
        {
          title: 'Références',
          fields: [
            field('Identifiant', stair.id),
            field('Type', stair.stairType),
            field('Paliers', (stair.landings ?? []).length),
          ],
        },
      ],
    };
  }
  return undefined;
}
