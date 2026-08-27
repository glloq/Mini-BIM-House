/**
 * Le nom de chaque icône, sans le dessin.
 *
 * `tool-icons.tsx` tient les tracés, donc du JSX, donc du React. Le registre
 * des outils n'a besoin que du **nom** — `icon: 'WALL'` — et le lui faire
 * prendre dans un fichier `.tsx` obligeait tout ce qui lit le registre à
 * savoir compiler du JSX : un script Node qui audite la boîte à outils
 * échouait sur « --jsx is not set » sans avoir jamais dessiné quoi que ce soit.
 *
 * Un nom n'est pas un dessin. Les deux vivent donc dans deux fichiers, et
 * celui-ci ne dépend de rien.
 */
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
