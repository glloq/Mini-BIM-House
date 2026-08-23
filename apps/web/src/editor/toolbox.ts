/**
 * Ce qu'on a sous la main à l'étape où l'on est.
 *
 * Cent quarante et un boutons attendaient dans la colonne de gauche, quelle
 * que soit l'activité : les vingt-cinq outils du registre, groupés par métier,
 * tous dépliés en même temps. Un mur de boutons ne se lit pas — il se subit,
 * et on finit par en utiliser cinq.
 *
 * Une **entrée de boîte à outils** est un outil du registre plus ce qu'on
 * aurait choisi juste après : « WC » est l'outil composant avec la fiche WC
 * déjà désignée, « Fenêtre » est l'outil ouverture avec le type déjà choisi.
 * Trente entrées de ce genre ne sont pas trente outils de plus : le registre
 * continue de parler la langue du modèle, la boîte parle celle de la personne.
 *
 * **Aucune fiche n'est écrite en dur.** Une entrée nomme une *famille* de la
 * nomenclature — `WC`, `RADIATOR`, `SOCKET_16A` — et la fiche est celle que le
 * catalogue installé propose pour cette famille. Un projet qui n'en tient
 * aucune ne voit pas l'entrée : un bouton qui ne peut rien poser est une
 * promesse, et une promesse est pire qu'une absence.
 *
 * L'étape filtre ce qui est **proposé**. Les vingt-cinq outils restent tous
 * atteignables depuis n'importe où par la recherche et la palette, et un test
 * refuse qu'un seul devienne invisible.
 */
import type {
  DesignDomainId,
  Project,
} from '@house-technical-designer/core-domain';

import type { CreationStageId } from '../ux/creation-stages.js';
import type { DesignState } from '../ux/design-state.js';

import { draftKey, type ToolDrafts } from './tool-options.js';
import { toolById, type EditorToolDefinition } from './tool-registry.js';
import type { ToolIconId } from './tool-icons.js';

/**
 * Une question posée à l'état de la maison.
 *
 * Elle lit, et c'est le registre qui dit ce que la réponse veut dire :
 * proposer, permettre, ou mettre en avant.
 */
export type DesignPredicate = (state: DesignState) => boolean;

/**
 * Ce qu'il faut avoir fait avant, et le geste qui y mène.
 *
 * Un outil grisé en silence est une panne. Un outil grisé qui dit « ajoutez un
 * étage » et offre le bouton pour le faire est une leçon — et c'est la seule
 * façon honnête de retirer un bouton de la route de quelqu'un.
 */
export interface ToolboxRequirement {
  readonly reason: string;
  /** L'entrée qui débloque, quand c'en est une. */
  readonly entryId?: string;
}

export interface ToolboxEntry {
  readonly id: string;
  /** L'outil du registre que cette entrée porte. */
  readonly toolId: string;
  readonly label: string;
  readonly hint: string;
  readonly icon: ToolIconId;
  /** Ce que l'entrée choisit d'avance dans les options de l'outil. */
  readonly options?: Readonly<Record<string, string>>;
  /**
   * La famille de la nomenclature dont l'entrée pose une fiche.
   *
   * Résolue contre le catalogue du projet, jamais contre un identifiant écrit
   * ici. Une entrée dont la famille n'est pas installée n'est pas proposée.
   */
  readonly family?: string;
  /**
   * Absente tant que c'est faux.
   *
   * Ne retire jamais l'outil de « Tous les outils », ni de la recherche, ni de
   * la palette : une étape filtre ce qui est proposé, elle ne restreint jamais
   * ce qui est possible.
   */
  readonly visibleWhen?: DesignPredicate;
  /** Présente mais inerte, avec sa raison écrite. */
  readonly enabledWhen?: DesignPredicate;
  /** Mise en avant : c'est la suite normale du travail. */
  readonly recommendedWhen?: DesignPredicate;
  readonly requires?: ToolboxRequirement;
}

/** Ce que l'entrée vaut ici et maintenant. */
export interface ToolboxAvailability {
  readonly entry: ToolboxEntry;
  readonly enabled: boolean;
  readonly recommended: boolean;
  /** Pourquoi elle est inerte, quand elle l'est. */
  readonly requirement?: ToolboxRequirement;
}

/** Ce qu'une entrée demande à la maison, quand elle demande quelque chose. */
type EntryNeeds = Pick<
  ToolboxEntry,
  'visibleWhen' | 'enabledWhen' | 'recommendedWhen' | 'requires'
>;

export interface ToolboxSection {
  readonly id: string;
  readonly label: string;
  /** Le métier auquel cette section appartient, quand elle en a un. */
  readonly domain?: DesignDomainId;
  readonly entries: readonly ToolboxEntry[];
}

const entry = (
  id: string,
  toolId: string,
  label: string,
  hint: string,
  icon: ToolIconId,
  options?: Readonly<Record<string, string>>,
  family?: string,
  needs: EntryNeeds = {},
): ToolboxEntry => ({
  id,
  toolId,
  label,
  hint,
  icon,
  ...(options === undefined ? {} : { options }),
  ...(family === undefined ? {} : { family }),
  ...needs,
});

/*
 * Ce que chaque outil demande à la maison.
 *
 * Écrit à côté des entrées qui le portent, et jamais dans un composant :
 * ajouter un outil est une ligne, et savoir quand il sert en fait partie.
 */
const HAS_WALL: EntryNeeds = {
  enabledWhen: (state) => state.wallCount > 0,
  requires: { reason: 'Tracez d’abord un mur.', entryId: 'building.wall' },
};
const TWO_LEVELS: EntryNeeds = {
  enabledWhen: (state) => state.levelCount >= 2,
  requires: { reason: 'Ajoutez un étage avant de poser un escalier.' },
};
const HAS_CONTOUR: EntryNeeds = {
  enabledWhen: (state) => state.closedContours.length > 0,
  requires: {
    reason: 'Fermez d’abord un contour de murs.',
    entryId: 'building.wall',
  },
};
const HAS_NETWORK: EntryNeeds = {
  enabledWhen: (state) => state.networkCount > 0,
  requires: { reason: 'Créez d’abord un réseau dans « Réseaux ».' },
};

/** Poser une fiche du catalogue : l'outil composant, sa catégorie, sa famille. */
const place = (
  id: string,
  label: string,
  hint: string,
  icon: ToolIconId,
  category: string,
  family: string,
  needs: EntryNeeds = {},
): ToolboxEntry =>
  entry(id, 'COMPONENT', label, hint, icon, { category }, family, needs);

/**
 * Les sections de chaque étape, dans l'ordre où on les rencontre en dessinant.
 *
 * Les identifiants reprennent ceux des sous-étapes de `creation-stages.ts`
 * quand ils s'y trouvent : le registre des étapes dit ce qui existe, celui-ci
 * dit ce que ça propose. Un test refuse qu'ils divergent.
 */
const STAGE_SECTIONS: Readonly<
  Record<CreationStageId, readonly ToolboxSection[]>
> = {
  PROJECT: [],
  SITE: [
    {
      id: 'site.ground',
      label: 'Terrain',
      domain: 'SITE',
      entries: [
        entry(
          'site.parcel',
          'SITE',
          'Parcelle',
          'Tracer les limites du terrain',
          'SITE',
          { target: 'PARCEL' },
        ),
        entry(
          'site.neighbour',
          'SITE',
          'Voisin',
          'Tracer un bâtiment voisin, pour son ombre',
          'BUILDING',
          { target: 'OBSTACLE', kind: 'BUILDING' },
        ),
        entry(
          'site.tree',
          'SITE',
          'Arbre',
          'Poser un arbre, pour son ombre',
          'TREE',
          { target: 'OBSTACLE', kind: 'TREE' },
        ),
        entry(
          'site.exclusion',
          'SITE',
          'Zone libre',
          'Marquer une zone à laisser libre',
          'EXCLUSION',
          { target: 'OBSTACLE', kind: 'EXCLUSION' },
        ),
      ],
    },
  ],
  BUILDING: [
    {
      id: 'building.walls',
      label: 'Murs',
      domain: 'ARCHITECTURE',
      entries: [
        entry(
          'building.wall',
          'WALL',
          'Mur',
          'Tracer un mur, d’un point à l’autre',
          'WALL',
        ),
        entry(
          'building.wall-run',
          'WALL_RUN',
          'Mur continu',
          'Enchaîner les murs sans relâcher',
          'WALL_RUN',
        ),
        entry(
          'building.wall-rect',
          'WALL_RECTANGLE',
          'Murs rectangle',
          'Quatre murs par deux coins',
          'WALL_RECTANGLE',
        ),
        entry(
          'building.partition',
          'WALL',
          'Cloison',
          'Un mur intérieur, hors enveloppe',
          'PARTITION',
          { role: 'PARTITION' },
        ),
      ],
    },
    {
      id: 'building.openings',
      label: 'Ouvertures',
      domain: 'ARCHITECTURE',
      entries: [
        entry(
          'building.door',
          'OPENING',
          'Porte',
          'Poser une porte dans un mur',
          'DOOR',
          { openingType: 'DOOR' },
          undefined,
          HAS_WALL,
        ),
        entry(
          'building.window',
          'OPENING',
          'Fenêtre',
          'Poser une fenêtre dans un mur',
          'WINDOW',
          { openingType: 'WINDOW' },
          undefined,
          HAS_WALL,
        ),
        entry(
          'building.void',
          'OPENING',
          'Trémie',
          'Percer un passage dans un mur',
          'VOID',
          { openingType: 'VOID' },
          undefined,
          HAS_WALL,
        ),
      ],
    },
    {
      id: 'building.spaces',
      label: 'Pièces et niveaux',
      domain: 'ARCHITECTURE',
      entries: [
        entry(
          'building.space',
          'SPACE',
          'Pièce',
          'Nommer une pièce en pointant dedans',
          'SPACE',
          undefined,
          undefined,
          {
            // Un contour fermé qui ne porte pas de pièce est exactement le
            // travail qui reste entre « les murs sont tracés » et « les pièces
            // sont nommées ».
            recommendedWhen: (state) => state.contoursWithoutSpace > 0,
          },
        ),
        entry(
          'building.slab',
          'SLAB',
          'Dalle',
          'Tracer un plancher ou une terrasse',
          'SLAB',
          undefined,
          undefined,
          HAS_CONTOUR,
        ),
        entry(
          'building.stair',
          'STAIR',
          'Escalier',
          'Poser un escalier entre deux niveaux',
          'STAIR',
          undefined,
          undefined,
          TWO_LEVELS,
        ),
        entry(
          'building.roof',
          'ROOF',
          'Toiture',
          'Tracer un pan de toiture',
          'ROOF',
          undefined,
          undefined,
          {
            ...HAS_CONTOUR,
            // Une maison qui a son emprise et pas encore de toit : c'est là
            // que la toiture devient la suite normale du travail.
            recommendedWhen: (state) =>
              state.closedContours.length > 0 && state.roofSurfaceCount === 0,
          },
        ),
      ],
    },
    {
      id: 'structure.frame',
      label: 'Ossature',
      domain: 'STRUCTURE',
      entries: [
        entry(
          'structure.column',
          'COLUMN',
          'Poteau',
          'Poser un poteau',
          'COLUMN',
        ),
        entry(
          'structure.beam',
          'BEAM',
          'Poutre',
          'Poser une poutre entre deux points',
          'BEAM',
        ),
        entry(
          'structure.bearing',
          'WALL',
          'Mur porteur',
          'Un mur qui porte : rôle extérieur',
          'WALL',
          { role: 'EXTERIOR' },
        ),
        entry(
          'structure.slab',
          'SLAB',
          'Plancher',
          'Une dalle qui porte',
          'SLAB',
          { role: 'FLOOR' },
          undefined,
          HAS_CONTOUR,
        ),
        entry(
          'structure.hole',
          'SLAB_HOLE',
          'Trémie',
          'Percer une dalle',
          'SLAB_HOLE',
          undefined,
          undefined,
          {
            enabledWhen: (state) => state.slabCount > 0,
            requires: {
              reason: 'Posez une dalle avant d’y percer une trémie.',
              entryId: 'structure.slab',
            },
          },
        ),
      ],
    },
  ],
  FITTING: [
    {
      id: 'fitting.furniture',
      label: 'Mobilier',
      domain: 'FURNITURE',
      entries: [
        place('fitting.bed', 'Lit', 'Poser un lit', 'BED', 'FURNITURE', 'BED'),
        place(
          'fitting.table',
          'Table',
          'Poser une table',
          'TABLE',
          'FURNITURE',
          'TABLE',
        ),
        place(
          'fitting.sofa',
          'Canapé',
          'Poser un canapé',
          'SOFA',
          'FURNITURE',
          'SOFA',
        ),
        place(
          'fitting.wardrobe',
          'Armoire',
          'Poser une armoire',
          'WARDROBE',
          'FURNITURE',
          'WARDROBE',
        ),
      ],
    },
    {
      id: 'fitting.appliances',
      label: 'Électroménager',
      domain: 'FURNITURE',
      entries: [
        place(
          'fitting.fridge',
          'Réfrigérateur',
          'Poser un réfrigérateur',
          'APPLIANCE',
          'APPLIANCE',
          'REFRIGERATOR',
        ),
        place(
          'fitting.oven',
          'Four',
          'Poser un four',
          'APPLIANCE',
          'APPLIANCE',
          'OVEN',
        ),
        place(
          'fitting.washer',
          'Lave-linge',
          'Poser un lave-linge',
          'APPLIANCE',
          'APPLIANCE',
          'WASHING_MACHINE',
        ),
        place(
          'fitting.dishwasher',
          'Lave-vaisselle',
          'Poser un lave-vaisselle',
          'APPLIANCE',
          'APPLIANCE',
          'DISHWASHER',
        ),
      ],
    },
  ],
  SYSTEMS: [
    {
      id: 'systems.water',
      label: 'Eau',
      domain: 'PLUMBING',
      entries: [
        place('water.wc', 'WC', 'Poser un WC', 'WC', 'SANITARY', 'WC'),
        place(
          'water.basin',
          'Lavabo',
          'Poser un lavabo',
          'BASIN',
          'SANITARY',
          'WASHBASIN',
        ),
        place(
          'water.shower',
          'Douche',
          'Poser un receveur de douche',
          'SHOWER',
          'SANITARY',
          'SHOWER_TRAY',
        ),
        place(
          'water.sink',
          'Évier',
          'Poser un évier',
          'SINK',
          'SANITARY',
          'KITCHEN_SINK',
        ),
        place(
          'water.tank',
          'Chauffe-eau',
          'Poser un ballon d’eau chaude',
          'TANK',
          'SANITARY',
          'ELECTRIC_DHW_TANK',
        ),
        entry(
          'water.route',
          'NETWORK_ROUTE',
          'Tracer un tronçon',
          'Tracer une canalisation sur le réseau actif',
          'PIPE',

          undefined,
          undefined,
          HAS_NETWORK,
        ),
      ],
    },
    {
      id: 'systems.waste',
      label: 'Évacuation',
      domain: 'WASTEWATER',
      entries: [
        entry(
          'waste.route',
          'NETWORK_ROUTE',
          'Tracer un tronçon',
          'Tracer une évacuation',
          'PIPE',

          undefined,
          undefined,
          HAS_NETWORK,
        ),
        entry(
          'waste.branch',
          'NETWORK_BRANCH',
          'Dériver',
          'Brancher sur une évacuation existante',
          'BRANCH',

          undefined,
          undefined,
          HAS_NETWORK,
        ),
        entry(
          'waste.node',
          'NETWORK',
          'Réseau',
          'Poser un nœud d’évacuation',
          'NODE',

          undefined,
          undefined,
          HAS_NETWORK,
        ),
      ],
    },
    {
      id: 'systems.rain',
      label: 'Eaux pluviales',
      domain: 'RAINWATER',
      entries: [
        place(
          'rain.tank',
          'Cuve',
          'Poser une cuve de récupération',
          'TANK',
          'OTHER',
          'RAINWATER_TANK',
        ),
        entry(
          'rain.route',
          'NETWORK_ROUTE',
          'Tracer un tronçon',
          'Tracer une descente ou un collecteur',
          'PIPE',

          undefined,
          undefined,
          HAS_NETWORK,
        ),
      ],
    },
    {
      id: 'systems.heating',
      label: 'Chauffage',
      domain: 'HEATING',
      entries: [
        place(
          'heating.pump',
          'Pompe à chaleur',
          'Poser une pompe à chaleur',
          'HEAT_PUMP',
          'HEATING',
          'HEAT_PUMP_AIR_WATER_MONOBLOC',
        ),
        place(
          'heating.radiator',
          'Radiateur',
          'Poser un radiateur',
          'RADIATOR',
          'HEATING',
          'RADIATOR',
        ),
        place(
          'heating.towel',
          'Sèche-serviettes',
          'Poser un sèche-serviettes',
          'RADIATOR',
          'HEATING',
          'TOWEL_RADIATOR',
        ),
        place(
          'heating.floor',
          'Plancher chauffant',
          'Poser une surface de plancher chauffant',
          'UNDERFLOOR',
          'HEATING',
          'UNDERFLOOR_HEATING',
        ),
        entry(
          'heating.route',
          'NETWORK_ROUTE',
          'Tracer un tronçon',
          'Tracer une boucle de chauffage',
          'PIPE',

          undefined,
          undefined,
          HAS_NETWORK,
        ),
      ],
    },
    {
      id: 'systems.air',
      label: 'Ventilation',
      domain: 'VENTILATION',
      entries: [
        place(
          'air.unit',
          'VMC',
          'Poser un groupe de ventilation',
          'FAN',
          'VENTILATION',
          'EXTRACT_VENTILATION_UNIT',
        ),
        place(
          'air.terminal',
          'Bouche',
          'Poser une bouche d’extraction',
          'GRILLE',
          'VENTILATION',
          'EXTRACT_TERMINAL',
        ),
        entry(
          'air.route',
          'NETWORK_ROUTE',
          'Tracer un tronçon',
          'Tracer une gaine',
          'DUCT',

          undefined,
          undefined,
          HAS_NETWORK,
        ),
      ],
    },
    {
      id: 'systems.power',
      label: 'Électricité',
      domain: 'ELECTRICAL',
      entries: [
        place(
          'power.socket',
          'Prise',
          'Poser une prise',
          'SOCKET',
          'ELECTRICAL',
          'SOCKET_16A',
        ),
        place(
          'power.switch',
          'Interrupteur',
          'Poser un interrupteur',
          'SWITCH',
          'ELECTRICAL',
          'SWITCH',
        ),
        place(
          'power.board',
          'Tableau',
          'Poser le tableau de répartition',
          'BOARD',
          'ELECTRICAL',
          'MAIN_DISTRIBUTION_BOARD',
        ),
        entry(
          'power.route',
          'NETWORK_ROUTE',
          'Tracer un tronçon',
          'Tracer un circuit',
          'CABLE',

          undefined,
          undefined,
          HAS_NETWORK,
        ),
      ],
    },
    {
      id: 'systems.light',
      label: 'Éclairage',
      domain: 'LIGHTING',
      entries: [
        place(
          'light.luminaire',
          'Luminaire',
          'Poser un luminaire',
          'LAMP',
          'LIGHTING',
          'CEILING_LIGHT',
        ),
        entry(
          'light.route',
          'NETWORK_ROUTE',
          'Tracer un tronçon',
          'Tracer un circuit d’éclairage',
          'CABLE',

          undefined,
          undefined,
          HAS_NETWORK,
        ),
      ],
    },
    {
      id: 'systems.flue',
      label: 'Conduits de fumée',
      domain: 'FLUE',
      entries: [
        entry(
          'flue.route',
          'NETWORK_ROUTE',
          'Tracer un tronçon',
          'Tracer un conduit de fumée',
          'DUCT',

          undefined,
          undefined,
          HAS_NETWORK,
        ),
        entry(
          'flue.node',
          'NETWORK',
          'Réseau',
          'Poser un élément de conduit',
          'NODE',

          undefined,
          undefined,
          HAS_NETWORK,
        ),
      ],
    },
    {
      id: 'systems.data',
      label: 'Courants faibles',
      domain: 'DATA',
      entries: [
        entry(
          'data.route',
          'NETWORK_ROUTE',
          'Tracer un tronçon',
          'Tracer un câble de données',
          'CABLE',

          undefined,
          undefined,
          HAS_NETWORK,
        ),
        entry(
          'data.node',
          'NETWORK',
          'Réseau',
          'Poser une prise ou un équipement réseau',
          'NODE',

          undefined,
          undefined,
          HAS_NETWORK,
        ),
      ],
    },
    {
      id: 'systems.safety',
      label: 'Sécurité',
      domain: 'SAFETY',
      entries: [
        entry(
          'safety.node',
          'NETWORK',
          'Réseau',
          'Poser un détecteur ou un organe de sécurité',
          'NODE',

          undefined,
          undefined,
          HAS_NETWORK,
        ),
        entry(
          'safety.route',
          'NETWORK_ROUTE',
          'Tracer un tronçon',
          'Tracer une liaison de sécurité',
          'CABLE',

          undefined,
          undefined,
          HAS_NETWORK,
        ),
      ],
    },
    {
      id: 'systems.solar',
      label: 'Solaire',
      domain: 'SOLAR',
      entries: [
        place(
          'energy.pv',
          'Panneaux',
          'Poser un champ photovoltaïque',
          'PV',
          'PHOTOVOLTAIC',
          'PV_ARRAY',
          {
            enabledWhen: (state) => state.roofSurfaceCount > 0,
            requires: {
              reason: 'Dessinez la toiture avant d’y poser des panneaux.',
              entryId: 'building.roof',
            },
          },
        ),
        place(
          'energy.inverter',
          'Onduleur',
          'Poser un onduleur',
          'INVERTER',
          'PHOTOVOLTAIC',
          'STRING_INVERTER',
        ),
        entry(
          'energy.route',
          'NETWORK_ROUTE',
          'Tracer un tronçon',
          'Tracer une liaison photovoltaïque',
          'CABLE',

          undefined,
          undefined,
          HAS_NETWORK,
        ),
      ],
    },
    {
      id: 'systems.storage',
      label: 'Stockage',
      domain: 'STORAGE',
      entries: [
        place(
          'energy.battery',
          'Batterie',
          'Poser une batterie',
          'BATTERY',
          'ELECTRICAL',
          'BATTERY_RACK',
        ),
      ],
    },
  ],
  CHECKS: [],
  DOCUMENTS: [
    {
      id: 'documents.annotation',
      label: 'Annotation',
      entries: [
        entry(
          'documents.dimension',
          'DIMENSION',
          'Cotation',
          'Coter une distance',
          'DIMENSION',
        ),
        entry(
          'documents.note',
          'NOTE',
          'Annotation',
          'Écrire une note sur le plan',
          'NOTE',
        ),
      ],
    },
  ],
};

/**
 * Ce qu'on a toujours sous la main, quelle que soit l'étape.
 *
 * Sélectionner, modifier ce qui est déjà tracé, coter, annoter : aucune de ces
 * choses n'appartient à une étape, et les chercher dans la bonne serait la
 * seule difficulté qu'on aurait inventée.
 */
export const COMMON_SECTION: ToolboxSection = {
  id: 'common',
  label: 'Communs',
  entries: [
    entry(
      'common.select',
      'SELECT',
      'Sélection',
      'Prendre un objet ou une bande',
      'SELECT',
    ),
    entry(
      'common.offset',
      'OFFSET',
      'Décaler',
      'Décaler un mur parallèlement',
      'OFFSET',
    ),
    entry('common.join', 'JOIN', 'Joindre', 'Raccorder deux murs', 'JOIN'),
    entry(
      'common.trim',
      'TRIM',
      'Ajuster',
      'Ajuster un mur sur un autre',
      'TRIM',
    ),
    entry('common.split', 'SPLIT', 'Scinder', 'Couper un mur en deux', 'SPLIT'),
    entry(
      'common.rotate',
      'ROTATE',
      'Pivoter',
      'Faire tourner la sélection',
      'ROTATE',
    ),
    entry(
      'common.mirror',
      'MIRROR',
      'Miroir',
      'Retourner la sélection',
      'MIRROR',
    ),
    entry(
      'common.dimension',
      'DIMENSION',
      'Cotation',
      'Coter une distance',
      'DIMENSION',
    ),
    entry(
      'common.note',
      'NOTE',
      'Annotation',
      'Écrire une note sur le plan',
      'NOTE',
    ),
  ],
};

/** Les sections déclarées pour une étape, telles quelles. */
export function sectionsOfStage(
  stage: CreationStageId,
): readonly ToolboxSection[] {
  return STAGE_SECTIONS[stage];
}

/** Toutes les entrées déclarées, communes comprises. */
export function allToolboxEntries(): readonly ToolboxEntry[] {
  return [
    ...Object.values(STAGE_SECTIONS).flatMap((sections) =>
      sections.flatMap((section) => section.entries),
    ),
    ...COMMON_SECTION.entries,
  ];
}

/**
 * L'entrée qui débloque celle-ci, quand il y en a une.
 *
 * Une raison écrite dit ce qui manque ; celle-ci offre le geste. Toutes les
 * conditions n'en ont pas — « ajoutez un étage » se règle dans le menu du
 * projet, pas dans la boîte à outils — et une condition sans geste reste une
 * raison, ce qui vaut toujours mieux qu'un bouton muet.
 */
export function unblockingEntry(
  requirement: ToolboxRequirement | undefined,
): ToolboxEntry | undefined {
  if (requirement?.entryId === undefined) return undefined;
  return allToolboxEntries().find(({ id }) => id === requirement.entryId);
}

/** La fiche que le catalogue installé propose pour une famille, s'il en tient une. */
export function ficheOfFamily(
  project: Project,
  family: string,
): string | undefined {
  return (project.equipment ?? []).find(
    (definition) => definition.familyId === family,
  )?.id;
}

/** Si le projet peut poser ce que l'entrée propose. */
export function entryAvailable(
  project: Project,
  candidate: ToolboxEntry,
): boolean {
  if (toolById(candidate.toolId) === undefined) return false;
  return (
    candidate.family === undefined ||
    ficheOfFamily(project, candidate.family) !== undefined
  );
}

/**
 * Ce que l'entrée vaut devant cette maison-là.
 *
 * Trois degrés et pas un de plus : recommandée, active, inerte. Une entrée qui
 * ne demande rien est active et jamais recommandée — c'est le comportement
 * qu'avaient les vingt-cinq outils avant qu'on sache poser la question.
 */
export function availabilityOf(
  candidate: ToolboxEntry,
  state: DesignState,
): ToolboxAvailability {
  const enabled = candidate.enabledWhen?.(state) ?? true;
  return {
    entry: candidate,
    enabled,
    // Rien n'est mis en avant tant que rien ne le permet : recommander un
    // outil qu'on ne peut pas prendre serait recommander une déception.
    recommended: enabled && (candidate.recommendedWhen?.(state) ?? false),
    ...(enabled || candidate.requires === undefined
      ? {}
      : { requirement: candidate.requires }),
  };
}

/**
 * Ce que l'étape propose ici et maintenant.
 *
 * Filtré par le métier lu quand l'étape en propose plusieurs — les dix
 * disciplines de Systèmes ne se regardent pas toutes à la fois — et par ce que
 * le catalogue du projet permet de poser.
 */
export function toolboxFor(
  project: Project,
  stage: CreationStageId,
  domain: DesignDomainId | undefined,
  state?: DesignState,
): readonly ToolboxSection[] {
  const sections = sectionsOfStage(stage);
  const narrowed =
    domain === undefined
      ? sections
      : sections.filter(
          (section) =>
            section.domain === undefined || section.domain === domain,
        );
  // Un métier sans section déclarée ne vide pas l'étape : mieux vaut tout ce
  // que l'étape offre que rien du tout.
  const chosen = narrowed.length > 0 ? narrowed : sections;
  return chosen
    .map((section) => ({
      ...section,
      entries: section.entries.filter(
        (candidate) =>
          entryAvailable(project, candidate) &&
          // `visibleWhen` retire de la liste ; il ne retire jamais de « Tous
          // les outils », ni de la recherche, ni de la palette.
          (state === undefined || (candidate.visibleWhen?.(state) ?? true)),
      ),
    }))
    .filter((section) => section.entries.length > 0);
}

/**
 * Les familles qu'une étape propose et que le projet ne tient pas.
 *
 * Une colonne vide sans un mot est un écran qui ne dit pas ce qu'il attend :
 * Aménagement pose des fiches du catalogue, et un projet qui n'en tient
 * aucune n'a rien à poser. Mieux vaut dire d'où elles viennent que laisser
 * chercher.
 */
export function missingFicheFamilies(
  project: Project,
  stage: CreationStageId,
): readonly string[] {
  const missing = sectionsOfStage(stage)
    .flatMap((section) => section.entries)
    .filter(
      (candidate) =>
        candidate.family !== undefined &&
        ficheOfFamily(project, candidate.family) === undefined,
    )
    .map((candidate) => candidate.label);
  return [...new Set(missing)];
}

/**
 * Ce qu'il faut écrire dans les brouillons d'options pour que l'entrée
 * signifie ce qu'elle dit.
 *
 * Les clés sont celles de l'outil porté, et la fiche est cherchée dans le
 * catalogue plutôt qu'écrite ici.
 */
export function draftsForEntry(
  project: Project,
  candidate: ToolboxEntry,
): ToolDrafts {
  const tool = toolById(candidate.toolId);
  if (tool === undefined) return {};
  const drafts: Record<string, string> = {};
  for (const [key, value] of Object.entries(candidate.options ?? {}))
    drafts[keyFor(tool, key)] = value;
  if (candidate.family !== undefined) {
    const fiche = ficheOfFamily(project, candidate.family);
    if (fiche !== undefined) drafts[keyFor(tool, 'definitionId')] = fiche;
  }
  return drafts;
}

function keyFor(tool: EditorToolDefinition, option: string): string {
  const declared = (tool.options ?? []).find(({ key }) => key === option);
  return draftKey(tool.id, option, declared?.scope === 'SHARED');
}
