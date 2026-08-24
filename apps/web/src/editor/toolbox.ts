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
 * L'étape filtre ce qui est **proposé**, et les sept espaces sont séparés :
 * on n'atteint pas les étapes du terrain depuis l'onglet du bâtiment. La
 * recherche et la palette restent le chemin vers tout, depuis partout — on les
 * ouvre exprès. Un test refuse qu'un outil n'ait aucun espace.
 */
import type {
  DesignDomainId,
  Project,
} from '@house-technical-designer/core-domain';
import { domainOfDiscipline } from '@house-technical-designer/core-domain';

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
   * Ne retire jamais l'outil de la recherche ni de la palette : une étape
   * filtre ce qui est proposé, elle ne restreint jamais ce qui est possible.
   */
  readonly visibleWhen?: DesignPredicate;
  /** Présente mais inerte, avec sa raison écrite. */
  readonly enabledWhen?: DesignPredicate;
  /** Mise en avant : c'est la suite normale du travail. */
  readonly recommendedWhen?: DesignPredicate;
  readonly requires?: ToolboxRequirement;
  /**
   * Le métier de la sous-partie qui la porte.
   *
   * Estampillé à la lecture plutôt qu'écrit deux cent quarante fois : la
   * section le déclare déjà, et une entrée qui l'ignorerait obligerait chaque
   * écran à remonter la hiérarchie pour le retrouver.
   *
   * Il sert à répondre « quel réseau ? » : prendre « Tracer un tronçon » dans
   * la ventilation choisissait le premier réseau du projet, c'est-à-dire
   * l'eau, et le refus parlait ensuite de ports déjà reliés.
   */
  readonly domain?: DesignDomainId;
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
/**
 * Un réseau **de ce métier-là**, et pas n'importe lequel.
 *
 * « Un réseau existe » activait « Tracer un tronçon » dans les douze
 * disciplines : le bouton de la ventilation était vif sur un projet qui n'a
 * qu'un réseau d'eau, on cliquait, et le refus parlait de ports libres. Ce
 * qu'on veut savoir est si ce métier a de quoi tracer.
 */
const hasNetworkOf = (domain: DesignDomainId): EntryNeeds => ({
  enabledWhen: (state) => state.networkDomains.includes(domain),
  requires: {
    reason: 'Créez d’abord un réseau de ce métier dans « Réseaux ».',
  },
});

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
      id: 'site.parcel',
      label: 'Parcelle',
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
          'site.exclusion',
          'SITE',
          'Zone libre',
          'Marquer une zone à laisser libre',
          'EXCLUSION',
          { target: 'OBSTACLE', kind: 'EXCLUSION' },
        ),
      ],
    },
    {
      id: 'site.access',
      label: 'Accès',
      domain: 'SITE',
      entries: [
        entry(
          'site.terrace',
          'SLAB',
          'Terrasse',
          'Tracer une terrasse au sol',
          'SLAB',
          { role: 'TERRACE' },
        ),
        entry(
          'site.path',
          'SITE',
          'Allée',
          'Tracer une allée ou un accès',
          'SITE',
          { target: 'OBSTACLE', kind: 'PATH' },
        ),
        entry(
          'site.parking',
          'SITE',
          'Stationnement',
          'Tracer une aire de stationnement',
          'SITE',
          { target: 'OBSTACLE', kind: 'PARKING' },
        ),
      ],
    },
    {
      id: 'site.things',
      label: 'Éléments',
      domain: 'SITE',
      entries: [
        entry(
          'site.tree',
          'SITE',
          'Arbre',
          'Poser un arbre, pour son ombre',
          'TREE',
          { target: 'OBSTACLE', kind: 'TREE' },
        ),
        entry(
          'site.neighbour',
          'SITE',
          'Voisin',
          'Tracer un bâtiment voisin, pour son ombre',
          'BUILDING',
          { target: 'OBSTACLE', kind: 'BUILDING' },
        ),
        place('site.well', 'Puits', 'Poser un puits', 'TANK', 'OTHER', 'WELL'),
        place(
          'site.borehole',
          'Forage',
          'Poser un forage',
          'TANK',
          'OTHER',
          'BOREHOLE',
        ),
        place(
          'site.tank',
          'Cuve',
          'Poser une cuve enterrée',
          'TANK',
          'OTHER',
          'SITE_RAINWATER_TANK',
        ),
        entry(
          'site.hedge',
          'SITE',
          'Haie',
          'Tracer une haie, pour son ombre',
          'TREE',
          { target: 'OBSTACLE', kind: 'HEDGE' },
        ),
        entry('site.fence', 'SITE', 'Clôture', 'Tracer une clôture', 'WALL', {
          target: 'OBSTACLE',
          kind: 'FENCE',
        }),
        entry('site.gate', 'SITE', 'Portail', 'Tracer un portail', 'DOOR', {
          target: 'OBSTACLE',
          kind: 'GATE',
        }),
      ],
    },
    {
      id: 'site.services',
      label: 'Réseaux extérieurs',
      domain: 'SITE',
      entries: [
        place(
          'site.water',
          'Arrivée eau',
          'Poser le branchement d’eau',
          'PIPE',
          'OTHER',
          'WATER_PUBLIC_CONNECTION',
        ),
        place(
          'site.power',
          'Électricité',
          'Poser le coffret de branchement',
          'BOARD',
          'ELECTRICAL',
          'ELECTRICAL_SERVICE_BOX',
        ),
        place(
          'site.sewer',
          'Égout',
          'Poser le branchement d’égout',
          'PIPE',
          'OTHER',
          'PUBLIC_SEWER_CONNECTION',
        ),
        place(
          'site.septic',
          'Assainissement',
          'Poser une fosse toutes eaux',
          'TANK',
          'OTHER',
          'SITE_SEPTIC_TANK',
        ),
        place(
          'site.storm',
          'Eaux pluviales',
          'Poser un regard d’eaux pluviales',
          'NODE',
          'OTHER',
          'SITE_RAINWATER_CHAMBER',
        ),
        place(
          'site.telecom',
          'Télécom',
          'Poser l’arrivée télécom',
          'CABLE',
          'OTHER',
          'FIBER_TERMINATION',
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
        // « Trémie » nommait deux choses : un percement de mur, ici, et un
        // percement de dalle dans « Dalles ». On cliquait l'un en croyant
        // prendre l'autre. Une trémie est un trou dans un plancher ; ce qui
        // traverse un mur est un passage.
        entry(
          'building.void',
          'OPENING',
          'Passage',
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
      label: 'Pièces',
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
          'building.merge',
          'MERGE_SPACES',
          'Fusionner',
          'Réunir deux pièces en retirant ce qui les sépare',
          'SPACE',
          undefined,
          undefined,
          {
            enabledWhen: (state) => state.spaceCount >= 2,
            requires: {
              reason: 'Il faut deux pièces pour en réunir deux.',
              entryId: 'building.space',
            },
          },
        ),
        entry(
          'building.separate',
          'WALL',
          'Séparer',
          'Couper une pièce par une cloison',
          'PARTITION',
          { role: 'PARTITION' },
          undefined,
          {
            enabledWhen: (state) => state.spaceCount > 0,
            requires: {
              reason: 'Créez d’abord une pièce à séparer.',
              entryId: 'building.space',
            },
          },
        ),
      ],
    },
    {
      id: 'building.slabs',
      label: 'Dalles',
      domain: 'ARCHITECTURE',
      entries: [
        entry(
          'building.slab',
          'SLAB',
          'Dalle auto',
          'Une dalle sur le contour visé',
          'SLAB',
          { role: 'FLOOR', outline: 'ROOM' },
          undefined,
          HAS_CONTOUR,
        ),
        entry(
          'building.slab-free',
          'SLAB',
          'Dalle libre',
          'Une dalle sur les points cliqués',
          'SLAB',
          { role: 'FLOOR', outline: 'POINTS' },
        ),
        entry(
          'building.terrace',
          'SLAB',
          'Terrasse',
          'Une dalle de terrasse',
          'SLAB',
          { role: 'TERRACE' },
        ),
        entry(
          'building.slab-hole',
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
              entryId: 'building.slab',
            },
          },
        ),
      ],
    },
    {
      id: 'building.stairs',
      label: 'Escalier',
      domain: 'ARCHITECTURE',
      /*
       * Absente d'une maison de plain-pied.
       *
       * Pas grisée : absente. Sur un seul niveau il n'y a pas d'escalier à
       * dessiner, et il n'y a donc rien à expliquer. L'outil reste atteignable
       * par « + », par la recherche et par la palette — une sous-partie filtre
       * ce qui est proposé, elle ne restreint jamais ce qui est possible.
       */
      entries: [
        entry(
          'building.stair',
          'STAIR',
          'Droit',
          'Un escalier droit',
          'STAIR',
          { stairType: 'STRAIGHT' },
          undefined,
          { ...TWO_LEVELS, visibleWhen: (state) => state.levelCount >= 2 },
        ),
        entry(
          'building.stair-l',
          'STAIR',
          'Quart tournant',
          'Un escalier à un quart tournant',
          'STAIR',
          { stairType: 'L_SHAPED' },
          undefined,
          { ...TWO_LEVELS, visibleWhen: (state) => state.levelCount >= 2 },
        ),
        entry(
          'building.stair-u',
          'STAIR',
          'Deux quarts tournants',
          'Un escalier à deux quarts tournants',
          'STAIR',
          { stairType: 'U_SHAPED' },
          undefined,
          { ...TWO_LEVELS, visibleWhen: (state) => state.levelCount >= 2 },
        ),
        entry(
          'building.stair-spiral',
          'STAIR',
          'Hélicoïdal',
          'Un escalier hélicoïdal',
          'STAIR',
          { stairType: 'SPIRAL' },
          undefined,
          { ...TWO_LEVELS, visibleWhen: (state) => state.levelCount >= 2 },
        ),
      ],
    },
    {
      id: 'building.roof',
      label: 'Toiture',
      domain: 'ARCHITECTURE',
      entries: [
        entry(
          'building.roof',
          'ROOF',
          'Toit auto',
          'Une toiture sur le contour des murs',
          'ROOF',
          { outline: 'WALLS' },
          undefined,
          {
            ...HAS_CONTOUR,
            // Une maison qui a son emprise et pas encore de toit : c'est là
            // que la toiture devient la suite normale du travail.
            recommendedWhen: (state) =>
              state.closedContours.length > 0 && state.roofSurfaceCount === 0,
          },
        ),
        entry(
          'building.roof-2',
          'ROOF',
          '2 pans',
          'Deux pans, pignons sur les côtés courts',
          'ROOF',
          { outline: 'WALLS', pans: '2' },
          undefined,
          HAS_CONTOUR,
        ),
        entry(
          'building.roof-1',
          'ROOF',
          '1 pan',
          'Un seul pan, trois pignons',
          'ROOF',
          { outline: 'WALLS', pans: '1' },
          undefined,
          HAS_CONTOUR,
        ),
        entry(
          'building.roof-free',
          'ROOF',
          'Pan libre',
          'Une toiture sur les points cliqués',
          'ROOF',
          { outline: 'POINTS' },
        ),
        entry(
          'building.roof-void',
          'OPENING',
          'Ouverture de toit',
          'Percer une toiture',
          'VOID',
          { openingType: 'VOID' },
          undefined,
          {
            enabledWhen: (state) => state.roofSurfaceCount > 0,
            requires: {
              reason: 'Dessinez d’abord une toiture.',
              entryId: 'building.roof',
            },
          },
        ),
      ],
    },
    {
      id: 'structure.frame',
      label: 'Structure',
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
          'structure.footing',
          'COLUMN',
          'Fondation',
          'Poser une fondation ponctuelle',
          'COLUMN',
          { kind: 'FOOTING' },
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
          'fitting.sofa',
          'Canapé',
          'Poser un canapé',
          'SOFA',
          'FURNITURE',
          'SOFA',
        ),
        place(
          'fitting.table',
          'Table',
          'Poser une table',
          'TABLE',
          'FURNITURE',
          'TABLE',
        ),
        place(
          'fitting.chair',
          'Chaise',
          'Poser une chaise',
          'TABLE',
          'FURNITURE',
          'CHAIR',
        ),
        place(
          'fitting.wardrobe',
          'Armoire',
          'Poser une armoire',
          'WARDROBE',
          'FURNITURE',
          'WARDROBE',
        ),
        place(
          'fitting.desk',
          'Bureau',
          'Poser un bureau',
          'TABLE',
          'FURNITURE',
          'DESK',
        ),
      ],
    },
    {
      id: 'fitting.kitchen',
      label: 'Cuisine',
      domain: 'FURNITURE',
      entries: [
        place(
          'fitting.kitchen-unit',
          'Meuble bas',
          'Poser un meuble de cuisine',
          'WARDROBE',
          'FURNITURE',
          'KITCHEN_CABINET',
        ),
        place(
          'fitting.worktop',
          'Plan de travail',
          'Poser un plan de travail',
          'TABLE',
          'FURNITURE',
          'WORKTOP',
        ),
        place(
          'fitting.sink',
          'Évier',
          'Poser un évier',
          'SINK',
          'SANITARY',
          'KITCHEN_SINK',
        ),
        place(
          'fitting.hob',
          'Plaque',
          'Poser une plaque de cuisson',
          'APPLIANCE',
          'APPLIANCE',
          'HOB',
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
          'fitting.fridge',
          'Réfrigérateur',
          'Poser un réfrigérateur',
          'APPLIANCE',
          'APPLIANCE',
          'REFRIGERATOR',
        ),
      ],
    },
    {
      id: 'fitting.bathroom',
      label: 'Salle de bain',
      domain: 'FURNITURE',
      entries: [
        place('fitting.wc', 'WC', 'Poser un WC', 'WC', 'SANITARY', 'WC'),
        place(
          'fitting.shower',
          'Douche',
          'Poser une douche',
          'SHOWER',
          'SANITARY',
          'SHOWER_TRAY',
        ),
        place(
          'fitting.bath',
          'Baignoire',
          'Poser une baignoire',
          'SHOWER',
          'SANITARY',
          'BATHTUB',
        ),
        place(
          'fitting.basin',
          'Lavabo',
          'Poser un lavabo',
          'BASIN',
          'SANITARY',
          'WASHBASIN',
        ),
        place(
          'fitting.bathroom-unit',
          'Meuble',
          'Poser un meuble de salle de bain',
          'WARDROBE',
          'FURNITURE',
          'CABINET',
        ),
      ],
    },
    {
      id: 'fitting.appliances',
      label: 'Électroménager',
      domain: 'FURNITURE',
      entries: [
        place(
          'fitting.washer',
          'Lave-linge',
          'Poser un lave-linge',
          'APPLIANCE',
          'APPLIANCE',
          'WASHING_MACHINE',
        ),
        place(
          'fitting.dryer',
          'Sèche-linge',
          'Poser un sèche-linge',
          'APPLIANCE',
          'APPLIANCE',
          'DRYER',
        ),
        place(
          'fitting.dishwasher',
          'Lave-vaisselle',
          'Poser un lave-vaisselle',
          'APPLIANCE',
          'APPLIANCE',
          'DISHWASHER',
        ),
        place(
          'fitting.freezer',
          'Congélateur',
          'Poser un congélateur',
          'APPLIANCE',
          'APPLIANCE',
          'FREEZER',
        ),
        place(
          'fitting.microwave',
          'Micro-ondes',
          'Poser un micro-ondes',
          'APPLIANCE',
          'APPLIANCE',
          'MICROWAVE',
        ),
      ],
    },
    {
      id: 'fitting.outdoor',
      label: 'Extérieur',
      domain: 'FURNITURE',
      entries: [
        place(
          'fitting.garden-table',
          'Table de jardin',
          'Poser une table dehors',
          'TABLE',
          'FURNITURE',
          'TABLE',
        ),
        place(
          'fitting.outdoor-light',
          'Éclairage extérieur',
          'Poser un éclairage dehors',
          'LAMP',
          'LIGHTING',
          'SITE_EXTERIOR_LIGHT',
        ),
        place(
          'fitting.outdoor-socket',
          'Prise extérieure',
          'Poser une prise dehors',
          'SOCKET',
          'ELECTRICAL',
          'SITE_EXTERIOR_SOCKET',
        ),
        place(
          'fitting.ev',
          'Borne de recharge',
          'Poser une borne de recharge',
          'BOARD',
          'ELECTRICAL',
          'SITE_EV_CHARGER',
        ),
        place(
          'fitting.tap',
          'Robinet extérieur',
          'Poser un robinet dehors',
          'PIPE',
          'SANITARY',
          'OUTDOOR_TAP',
        ),
      ],
    },
    {
      /*
       * Ce que le catalogue ne nomme pas.
       *
       * Chaque entrée d'ici pose une fiche : « Lit », « Lave-linge »,
       * « Prise ». Il faut aussi pouvoir poser ce qui n'a pas de fiche — un
       * appareil qu'on décrira à la main — et cet outil-là n'avait plus de
       * maison depuis que les espaces ne se versent plus les uns dans les
       * autres. Un outil sans espace est un outil qu'on ne trouve plus.
       */
      id: 'fitting.other',
      label: 'Divers',
      domain: 'FURNITURE',
      entries: [
        entry(
          'fitting.component',
          'COMPONENT',
          'Composant',
          'Poser un appareil que le catalogue ne nomme pas',
          'APPLIANCE',
          { category: 'FURNITURE' },
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
          hasNetworkOf('PLUMBING'),
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
          hasNetworkOf('WASTEWATER'),
        ),
        entry(
          'waste.branch',
          'NETWORK_BRANCH',
          'Dériver',
          'Brancher sur une évacuation existante',
          'BRANCH',

          undefined,
          undefined,
          hasNetworkOf('WASTEWATER'),
        ),
        entry(
          'waste.node',
          'NETWORK',
          'Réseau',
          'Poser un nœud d’évacuation',
          'NODE',

          undefined,
          undefined,
          hasNetworkOf('WASTEWATER'),
        ),
        place(
          'waste.trap',
          'Siphon',
          'Poser un siphon d’appareil',
          'PIPE',
          'SANITARY',
          'TRAP',
        ),
        place(
          'waste.stack',
          'Chute',
          'Poser une chute d’eaux usées',
          'PIPE',
          'SANITARY',
          'WASTE_STACK',
        ),
        place(
          'waste.chamber',
          'Regard',
          'Poser un regard de visite',
          'NODE',
          'OTHER',
          'INSPECTION_CHAMBER',
        ),
        place(
          'waste.vent',
          'Ventilation primaire',
          'Poser une ventilation primaire',
          'DUCT',
          'OTHER',
          'VENT_STACK',
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
          hasNetworkOf('RAINWATER'),
        ),
        place(
          'rain.gutter',
          'Gouttière',
          'Poser une gouttière',
          'PIPE',
          'OTHER',
          'GUTTER',
        ),
        place(
          'rain.downpipe',
          'Descente',
          'Poser une descente d’eaux pluviales',
          'PIPE',
          'OTHER',
          'DOWNPIPE',
        ),
        place(
          'rain.filter',
          'Filtre',
          'Poser un filtre à eau de pluie',
          'TANK',
          'OTHER',
          'RAIN_FILTER',
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
          hasNetworkOf('HEATING'),
        ),
        place(
          'heating.manifold',
          'Collecteur',
          'Poser un collecteur de chauffage',
          'NODE',
          'HEATING',
          'HEATING_MANIFOLD',
        ),
        place(
          'heating.thermostat',
          'Thermostat',
          'Poser un thermostat d’ambiance',
          'SWITCH',
          'HEATING',
          'ROOM_THERMOSTAT',
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
          hasNetworkOf('VENTILATION'),
        ),
        place(
          'air.supply',
          'Bouche de soufflage',
          'Poser une bouche de soufflage',
          'GRILLE',
          'VENTILATION',
          'SUPPLY_TERMINAL',
        ),
        place(
          'air.inlet',
          'Entrée d’air',
          'Poser une entrée d’air',
          'GRILLE',
          'VENTILATION',
          'AIR_INLET',
        ),
        place(
          'air.roof',
          'Sortie de toiture',
          'Poser une sortie de toiture',
          'DUCT',
          'VENTILATION',
          'EXHAUST_TERMINAL',
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
          hasNetworkOf('ELECTRICAL'),
        ),
        place(
          'power.box',
          'Boîte',
          'Poser une boîte de dérivation',
          'NODE',
          'ELECTRICAL',
          'JUNCTION_BOX',
        ),
        place(
          'power.double',
          'Prise double',
          'Poser une prise double',
          'SOCKET',
          'ELECTRICAL',
          'DOUBLE_SOCKET',
        ),
        place(
          'power.two-way',
          'Va-et-vient',
          'Poser un va-et-vient',
          'SWITCH',
          'ELECTRICAL',
          'TWO_WAY_SWITCH',
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
          hasNetworkOf('LIGHTING'),
        ),
        place(
          'light.downlight',
          'Spot',
          'Poser un spot encastré',
          'LAMP',
          'LIGHTING',
          'DOWNLIGHT',
        ),
        place(
          'light.wall',
          'Applique',
          'Poser une applique murale',
          'LAMP',
          'LIGHTING',
          'WALL_LIGHT',
        ),
        place(
          'light.pendant',
          'Suspension',
          'Poser une suspension',
          'LAMP',
          'LIGHTING',
          'PENDANT',
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
          hasNetworkOf('FLUE'),
        ),
        entry(
          'flue.node',
          'NETWORK',
          'Réseau',
          'Poser un élément de conduit',
          'NODE',

          undefined,
          undefined,
          hasNetworkOf('FLUE'),
        ),
        place(
          'flue.stove',
          'Poêle à bois',
          'Poser un poêle à bois',
          'HEAT_PUMP',
          'HEATING',
          'WOOD_STOVE',
        ),
        place(
          'flue.pellet',
          'Poêle à granulés',
          'Poser un poêle à granulés',
          'HEAT_PUMP',
          'HEATING',
          'PELLET_STOVE',
        ),
        place(
          'flue.insert',
          'Insert',
          'Poser un insert',
          'HEAT_PUMP',
          'HEATING',
          'WOOD_INSERT',
        ),
        place(
          'flue.terminal',
          'Sortie de toit',
          'Poser une sortie de toit',
          'DUCT',
          'OTHER',
          'CHIMNEY_TERMINAL',
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
          hasNetworkOf('DATA'),
        ),
        entry(
          'data.node',
          'NETWORK',
          'Réseau',
          'Poser une prise ou un équipement réseau',
          'NODE',

          undefined,
          undefined,
          hasNetworkOf('DATA'),
        ),
        place(
          'data.rack',
          'Baie',
          'Poser une baie de brassage',
          'BOARD',
          'OTHER',
          'NETWORK_RACK',
        ),
        place(
          'data.socket',
          'Prise RJ45',
          'Poser une prise RJ45',
          'SOCKET',
          'OTHER',
          'RJ45_SOCKET',
        ),
        place('data.router', 'Box', 'Poser la box', 'NODE', 'OTHER', 'ROUTER'),
        place(
          'data.wifi',
          'Borne Wi-Fi',
          'Poser une borne Wi-Fi',
          'NODE',
          'OTHER',
          'WIFI_ACCESS_POINT',
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
          hasNetworkOf('SAFETY'),
        ),
        entry(
          'safety.route',
          'NETWORK_ROUTE',
          'Tracer un tronçon',
          'Tracer une liaison de sécurité',
          'CABLE',

          undefined,
          undefined,
          hasNetworkOf('SAFETY'),
        ),
        place(
          'safety.smoke',
          'Détecteur de fumée',
          'Poser un détecteur de fumée',
          'NODE',
          'OTHER',
          'SMOKE_DETECTOR',
        ),
        place(
          'safety.co',
          'Détecteur CO',
          'Poser un détecteur de monoxyde',
          'NODE',
          'OTHER',
          'CO_DETECTOR',
        ),
        place(
          'safety.panel',
          'Centrale d’alarme',
          'Poser une centrale d’alarme',
          'BOARD',
          'OTHER',
          'ALARM_PANEL',
        ),
        place(
          'safety.extinguisher',
          'Extincteur',
          'Poser un extincteur',
          'NODE',
          'OTHER',
          'EXTINGUISHER',
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
          hasNetworkOf('SOLAR'),
        ),
        place(
          'energy.combiner',
          'Coffret DC',
          'Poser un coffret de raccordement DC',
          'BOARD',
          'PHOTOVOLTAIC',
          'DC_COMBINER',
        ),
        place(
          'energy.meter',
          'Compteur de production',
          'Poser un compteur de production',
          'BOARD',
          'ELECTRICAL',
          'PRODUCTION_METER',
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
        place(
          'energy.battery-inverter',
          'Onduleur',
          'Poser un onduleur de batterie',
          'INVERTER',
          'ELECTRICAL',
          'BATTERY_INVERTER',
        ),
        place(
          'energy.battery-isolator',
          'Coupure',
          'Poser un sectionneur de batterie',
          'SWITCH',
          'ELECTRICAL',
          'BATTERY_ISOLATOR',
        ),
        entry(
          'energy.storage-route',
          'NETWORK_ROUTE',
          'Tracer un tronçon',
          'Tracer une liaison de batterie',
          'CABLE',
          undefined,
          undefined,
          hasNetworkOf('STORAGE'),
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
      'common.measure',
      'MEASURE',
      'Mesurer',
      'Mesurer une distance sans rien poser',
      'DIMENSION',
    ),
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
  return STAGE_SECTIONS[stage].map(stamped);
}

/**
 * La section, ses entrées portant son métier.
 *
 * Écrire le métier sur chaque entrée serait l'écrire deux cent quarante fois ;
 * le laisser sur la section seule obligerait chaque écran à remonter la
 * hiérarchie pour savoir de quel réseau on parle.
 */
function stamped(section: ToolboxSection): ToolboxSection {
  if (section.domain === undefined) return section;
  const domain = section.domain;
  return {
    ...section,
    entries: section.entries.map((entry) => ({ domain, ...entry })),
  };
}

/** Toutes les entrées déclarées, communes comprises. */
export function allToolboxEntries(): readonly ToolboxEntry[] {
  return [
    ...Object.values(STAGE_SECTIONS).flatMap((sections) =>
      sections.map(stamped).flatMap((section) => section.entries),
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

/**
 * Si le programme sait faire ce que l'entrée propose.
 *
 * Il ne s'agit plus de savoir si le **projet** tient déjà la fiche : une
 * entrée dont la famille n'était pas installée disparaissait, et `Aménagement`
 * sur un projet neuf était un espace entièrement vide — pas une sous-partie,
 * pas un bouton, rien à quoi rattacher « il faut ouvrir la bibliothèque ».
 * C'était punir de ne pas connaître le programme.
 *
 * Une entrée nomme une famille, et prendre l'entrée **installe** la fiche que
 * cette famille désigne. La seule chose qui puisse encore la retirer est un
 * outil que le registre ne tient pas — c'est-à-dire un bug.
 */
export function entryAvailable(
  _project: Project,
  candidate: ToolboxEntry,
): boolean {
  return toolById(candidate.toolId) !== undefined;
}

/** Si la fiche que cette entrée pose est déjà dans le projet. */
export function entryFicheInstalled(
  project: Project,
  candidate: ToolboxEntry,
): boolean {
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
  /*
   * Et le réseau de son métier, quand l'outil en demande un.
   *
   * Même mécanique que la fiche : l'entrée nomme un **métier**, jamais un
   * identifiant de réseau, et c'est le projet qui répond. Sans cela, prendre
   * « Tracer un tronçon » dans la ventilation choisissait le premier réseau du
   * projet — l'eau — et le refus parlait de ports déjà reliés.
   */
  if (
    candidate.domain !== undefined &&
    (tool.options ?? []).some(({ key }) => key === 'networkId')
  ) {
    const network = networkOfDomain(project, candidate.domain);
    if (network !== undefined) drafts[keyFor(tool, 'networkId')] = network;
  }
  return drafts;
}

/** Le réseau que ce métier a, quand il en a un. */
export function networkOfDomain(
  project: Project,
  domain: DesignDomainId,
): string | undefined {
  return (project.systems ?? []).find(
    (network) => domainOfDiscipline(network.discipline) === domain,
  )?.id;
}

/**
 * L'entrée que l'écran est en train de faire, et elle seule.
 *
 * « Toit auto », « 2 pans », « 1 pan » et « Pan libre » prennent le même outil
 * et ne diffèrent que par ce qu'ils pré-remplissent. Comparer les outils
 * allumait les quatre à la fois : quatre boutons enfoncés pour un seul geste,
 * et plus rien pour dire lequel on avait pris.
 *
 * Une entrée est active quand l'outil est le sien **et** que tout ce qu'elle
 * pré-remplit est encore ce qui est réglé. Rien n'est mémorisé : la réponse
 * est relue des brouillons, donc changer une option à la main éteint l'entrée
 * — ce qui est exact, parce qu'on ne fait plus tout à fait ce qu'elle fait.
 */
export function isEntryActive(
  project: Project,
  candidate: ToolboxEntry,
  activeTool: string,
  drafts: ToolDrafts,
): boolean {
  if (candidate.toolId !== activeTool) return false;
  return activeEntryId(project, activeTool, drafts) === candidate.id;
}

/**
 * Celle des entrées de cet outil que l'écran est en train de faire.
 *
 * « Toit auto » ne pré-remplit que le contour, « 2 pans » le contour **et** le
 * nombre de pans : ce que l'un règle, l'autre le règle aussi, donc satisfaire
 * son propre pré-remplissage ne suffit pas à être la bonne réponse. La plus
 * précise gagne, et à égalité c'est l'ordre du registre qui tranche — celui
 * d'un chantier.
 *
 * La question est posée à tout le registre plutôt qu'aux entrées affichées :
 * la réponse ne doit pas dépendre de ce qui est sous la main à cet instant.
 */
export function activeEntryId(
  project: Project,
  activeTool: string,
  drafts: ToolDrafts,
): string | undefined {
  let best: { readonly id: string; readonly keys: number } | undefined;
  for (const candidate of allToolboxEntries()) {
    if (candidate.toolId !== activeTool) continue;
    const wanted = Object.entries(draftsForEntry(project, candidate));
    if (!wanted.every(([key, value]) => drafts[key] === value)) continue;
    if (best === undefined || wanted.length > best.keys)
      best = { id: candidate.id, keys: wanted.length };
  }
  return best?.id;
}

/**
 * De quoi prendre l'outil composant avec une fiche déjà choisie.
 *
 * Les entrées nomment une famille et laissent `draftsForEntry` trouver la
 * fiche ; celui qui vient de choisir dans la nomenclature tient déjà la
 * fiche — il n'a pas de famille à résoudre, il a une réponse. Les clés sont
 * fabriquées ici parce que c'est ici qu'on sait comment elles s'écrivent.
 */
export function componentDrafts(
  definitionId: string,
  category: string,
): ToolDrafts {
  const tool = toolById('COMPONENT');
  if (tool === undefined) return {};
  return {
    [keyFor(tool, 'category')]: category,
    [keyFor(tool, 'definitionId')]: definitionId,
  };
}

function keyFor(tool: EditorToolDefinition, option: string): string {
  const declared = (tool.options ?? []).find(({ key }) => key === option);
  return draftKey(tool.id, option, declared?.scope === 'SHARED');
}
