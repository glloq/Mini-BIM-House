/**
 * Un dessin par outil, en vingt pixels.
 *
 * Une colonne de libellés se lit ligne à ligne ; une grille d'icônes se
 * balaie. Ce qui compte n'est pas la beauté du trait mais qu'un mur ne
 * ressemble pas à une dalle : chaque forme dit ce que l'outil fabrique — un
 * trait épais pour un mur, une ouverture dans un trait pour une porte, un
 * rectangle vide pour une pièce.
 *
 * **Aucune dépendance et aucune couleur.** Ce sont des `<svg>` en ligne, en
 * `currentColor` : le bouton décide de la couleur, l'icône ne décide de rien.
 * Une bibliothèque d'icônes coûterait plus lourd que le dessin lui-même, et
 * une couleur écrite ici serait une couleur que personne ne peut changer sans
 * rouvrir ce fichier.
 */
import type { ReactElement } from 'react';

export const TOOL_ICONS = [
  'SELECT',
  'WALL',
  'WALL_RUN',
  'WALL_RECTANGLE',
  'PARTITION',
  'DOOR',
  'WINDOW',
  'VOID',
  'SPACE',
  'SLAB',
  'SLAB_HOLE',
  'STAIR',
  'ROOF',
  'COLUMN',
  'BEAM',
  'SITE',
  'BUILDING',
  'TREE',
  'EXCLUSION',
  'BED',
  'TABLE',
  'SOFA',
  'WARDROBE',
  'APPLIANCE',
  'WC',
  'BASIN',
  'SHOWER',
  'SINK',
  'TANK',
  'HEAT_PUMP',
  'RADIATOR',
  'UNDERFLOOR',
  'FAN',
  'GRILLE',
  'SOCKET',
  'SWITCH',
  'BOARD',
  'LAMP',
  'PV',
  'INVERTER',
  'BATTERY',
  'PIPE',
  'DUCT',
  'CABLE',
  'BRANCH',
  'NODE',
  'OFFSET',
  'JOIN',
  'TRIM',
  'SPLIT',
  'ROTATE',
  'MIRROR',
  'DIMENSION',
  'NOTE',
] as const;
export type ToolIconId = (typeof TOOL_ICONS)[number];

/**
 * Le trait de chaque icône, dans un carré de 24.
 *
 * Le `<svg>` qui les entoure est écrit une fois, plus bas : ici il n'y a que
 * la forme, pour qu'ajouter un outil soit une ligne.
 */
const SHAPES: Readonly<Record<ToolIconId, ReactElement>> = {
  SELECT: <path d="M5 3l14 9-6 1.5L10 20z" fill="currentColor" stroke="none" />,
  WALL: <path d="M3 10h18v4H3z" fill="currentColor" stroke="none" />,
  WALL_RUN: <path d="M3 18V8h9v8h9" />,
  WALL_RECTANGLE: <path d="M4 5h16v14H4z" />,
  PARTITION: <path d="M3 11h18v2H3z" fill="currentColor" stroke="none" />,
  DOOR: (
    <>
      <path d="M3 12h5M16 12h5" />
      <path d="M8 12v-7a7 7 0 017 7" />
    </>
  ),
  WINDOW: (
    <>
      <path d="M3 12h18" />
      <path d="M8 9v6M16 9v6" />
    </>
  ),
  VOID: <path d="M3 12h5M16 12h5M8 8v8M16 8v8" />,
  SPACE: (
    <>
      <path d="M4 5h16v14H4z" />
      <path d="M8 15h8" />
    </>
  ),
  SLAB: (
    <>
      <path d="M3 8l9-4 9 4-9 4z" />
      <path d="M3 8v4l9 4 9-4V8" />
    </>
  ),
  SLAB_HOLE: (
    <>
      <path d="M3 9l9-4 9 4-9 4z" />
      <circle cx="12" cy="9" r="2.5" />
    </>
  ),
  STAIR: <path d="M4 20v-4h4v-4h4V8h4V4h4" />,
  ROOF: <path d="M2 14L12 5l10 9M5 14v5h14v-5" />,
  COLUMN: (
    <>
      <path d="M9 4h6v16H9z" />
      <path d="M7 4h10M7 20h10" />
    </>
  ),
  BEAM: (
    <>
      <path d="M3 9h18v6H3z" />
      <path d="M3 12h18" />
    </>
  ),
  SITE: <path d="M3 6h18v12H3z" strokeDasharray="3 2" />,
  BUILDING: (
    <>
      <path d="M5 20V8h9v12" />
      <path d="M14 20V4h5v16" />
      <path d="M8 12h3" />
    </>
  ),
  TREE: (
    <>
      <circle cx="12" cy="9" r="5" />
      <path d="M12 14v6" />
    </>
  ),
  EXCLUSION: (
    <>
      <path d="M4 6h16v12H4z" strokeDasharray="3 2" />
      <path d="M7 9l10 6M17 9L7 15" />
    </>
  ),
  BED: (
    <>
      <path d="M3 17v-6h18v6" />
      <path d="M3 11V7h7v4" />
    </>
  ),
  TABLE: (
    <>
      <path d="M3 9h18" />
      <path d="M6 9v9M18 9v9" />
    </>
  ),
  SOFA: (
    <>
      <path d="M4 16v-5a2 2 0 012-2h12a2 2 0 012 2v5" />
      <path d="M2 16h20v3H2z" />
    </>
  ),
  WARDROBE: (
    <>
      <path d="M5 4h14v16H5z" />
      <path d="M12 4v16M10 12h-1M14 12h1" />
    </>
  ),
  APPLIANCE: (
    <>
      <path d="M5 4h14v16H5z" />
      <circle cx="12" cy="13" r="4" />
    </>
  ),
  WC: (
    <>
      <path d="M8 4v6a4 4 0 004 4 4 4 0 004-4V4" />
      <path d="M12 14v6M9 20h6" />
    </>
  ),
  BASIN: (
    <>
      <path d="M4 10h16a8 8 0 01-8 8 8 8 0 01-8-8z" />
      <path d="M12 10V5" />
    </>
  ),
  SHOWER: (
    <>
      <path d="M4 12h16v8H4z" />
      <path d="M12 12V6a2 2 0 012-2h4" />
    </>
  ),
  SINK: (
    <>
      <path d="M3 11h18v7H3z" />
      <circle cx="8" cy="14" r="1.5" />
      <path d="M16 11V6" />
    </>
  ),
  TANK: (
    <>
      <rect x="7" y="3" width="10" height="18" rx="4" />
      <path d="M7 15h10" />
    </>
  ),
  HEAT_PUMP: (
    <>
      <path d="M3 6h18v12H3z" />
      <circle cx="12" cy="12" r="3.5" />
    </>
  ),
  RADIATOR: (
    <>
      <path d="M5 5v14M9 5v14M15 5v14M19 5v14" />
      <path d="M3 8h18M3 16h18" />
    </>
  ),
  UNDERFLOOR: <path d="M4 8h16M4 12h16M4 16h16" strokeDasharray="4 2" />,
  FAN: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 12l5-3M12 12l-5-3M12 12v6" />
    </>
  ),
  GRILLE: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M6 10h12M6 14h12" />
    </>
  ),
  SOCKET: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="9.5" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="12" r="1.2" fill="currentColor" stroke="none" />
    </>
  ),
  SWITCH: (
    <>
      <rect x="5" y="5" width="14" height="14" rx="2" />
      <path d="M9 14l6-5" />
    </>
  ),
  BOARD: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="1" />
      <path d="M8 8v8M12 8v8M16 8v8" />
    </>
  ),
  LAMP: (
    <>
      <path d="M8 13a5 5 0 118 0c-1 1.4-1.5 2.3-1.5 3.5h-5C9.5 15.3 9 14.4 8 13z" />
      <path d="M10 20h4" />
    </>
  ),
  PV: (
    <>
      <path d="M3 6h18l-2 10H5z" />
      <path d="M9 6l-1 10M15 6l1 10M4 11h16" />
    </>
  ),
  INVERTER: (
    <>
      <rect x="5" y="4" width="14" height="16" rx="2" />
      <path d="M9 10l3-3 3 3M9 14l3 3 3-3" />
    </>
  ),
  BATTERY: (
    <>
      <rect x="4" y="7" width="15" height="10" rx="2" />
      <path d="M19 11v2h2v-2z" fill="currentColor" stroke="none" />
      <path d="M8 11v2M12 11v2" />
    </>
  ),
  PIPE: (
    <>
      <path d="M3 12h18" />
      <path d="M8 9v6M16 9v6" />
    </>
  ),
  DUCT: <path d="M3 8h18M3 16h18M3 8v8M21 8v8" />,
  CABLE: <path d="M3 16c4 0 4-8 8-8s4 8 8 8" />,
  BRANCH: <path d="M3 18h8l5-6h5M11 18l5-6" />,
  NODE: (
    <>
      <circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" />
      <path d="M12 3v5M12 16v5M3 12h5M16 12h5" />
    </>
  ),
  OFFSET: (
    <>
      <path d="M4 8h16" />
      <path d="M4 15h16" strokeDasharray="3 2" />
    </>
  ),
  JOIN: <path d="M4 20V10a4 4 0 014-4h12" />,
  TRIM: (
    <>
      <path d="M4 12h10" />
      <path d="M14 5v14" />
      <path d="M16 12h4" strokeDasharray="3 2" />
    </>
  ),
  SPLIT: (
    <>
      <path d="M3 12h7M14 12h7" />
      <path d="M12 4v16" strokeDasharray="3 2" />
    </>
  ),
  ROTATE: (
    <>
      <path d="M20 12a8 8 0 11-3-6.2" />
      <path d="M20 4v5h-5" />
    </>
  ),
  MIRROR: (
    <>
      <path d="M12 3v18" strokeDasharray="3 2" />
      <path d="M9 7L4 12l5 5zM15 7l5 5-5 5z" />
    </>
  ),
  DIMENSION: (
    <>
      <path d="M3 12h18" />
      <path d="M3 8v8M21 8v8" />
      <path d="M6 12l3-2M18 12l-3-2" />
    </>
  ),
  NOTE: (
    <>
      <path d="M5 4h9l5 5v11H5z" />
      <path d="M14 4v5h5M8 13h8M8 16h5" />
    </>
  ),
};

export interface ToolIconProps {
  readonly icon: ToolIconId;
}

export function ToolIcon({ icon }: ToolIconProps) {
  return (
    <svg
      className="tool-icon"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {SHAPES[icon]}
    </svg>
  );
}
