/**
 * Le dessin que prendra la chose, montré avant de la poser.
 *
 * La nomenclature nomme cinq cent dix-huit familles, et les nommer est tout ce
 * qu'elle faisait : « Applique murale », « Hublot », « Réglette », trois lignes
 * de texte qui se ressemblent. On choisissait un mot, on posait, on regardait
 * le plan, et on découvrait le dessin après coup — c'est-à-dire au moment où
 * le corriger coûte le plus cher.
 *
 * Ce n'est pas une icône : c'est **le glyphe du plan**, résolu par la même
 * chaîne que le dessin — la famille, sa catégorie, puis le carré générique.
 * Ce qu'on voit dans la liste est donc, au trait près, ce qui apparaîtra sous
 * le curseur. Un aperçu qui différerait du plan serait pire que rien : il
 * ferait choisir sur une promesse.
 *
 * Rien n'est stocké et rien n'est dupliqué : la planche des symboles est déjà
 * chargée par le panneau qui l'ouvre, et le rendu se recalcule de la
 * définition à chaque fois.
 */
import type { Point2D } from '@house-technical-designer/geometry';
import {
  planSymbolFor,
  planSymbolSource,
  SYMBOL_LIBRARY_V1,
  type SymbolPrimitive,
} from '@house-technical-designer/drawing-engine';

export interface SymbolGlyphProps {
  readonly familyId?: string | undefined;
  /** La catégorie, quand on la connaît : c'est le deuxième maillon de la chaîne. */
  readonly category?: string | undefined;
  /** Le côté de la case, en pixels. Le glyphe s'y inscrit sans se déformer. */
  readonly size?: number;
}

/** Les points d'une suite, dans le repère du glyphe. */
function path(points: readonly Point2D[]): string {
  return points.map(({ x, y }) => `${x},${y}`).join(' ');
}

/**
 * Un tracé, tel que la planche l'écrit.
 *
 * Les six formes du vocabulaire des symboles, sans en interpréter aucune : un
 * cercle est un cercle, un arc est un arc. Le moteur de plan les aplatit en
 * polylignes parce qu'une scène ne connaît que des segments ; un navigateur
 * sait dessiner les deux, et le fait mieux.
 */
function Primitive({ primitive }: { readonly primitive: SymbolPrimitive }) {
  if (primitive.kind === 'LINE')
    return (
      <line
        x1={primitive.start.x}
        y1={primitive.start.y}
        x2={primitive.end.x}
        y2={primitive.end.y}
      />
    );
  if (primitive.kind === 'POLYLINE')
    return <polyline points={path(primitive.points)} fill="none" />;
  if (primitive.kind === 'POLYGON')
    return <polygon points={path(primitive.points)} />;
  if (primitive.kind === 'CIRCLE')
    return (
      <circle
        cx={primitive.center.x}
        cy={primitive.center.y}
        r={primitive.radius}
      />
    );
  if (primitive.kind === 'ARC') {
    const point = (angleDeg: number): Point2D => ({
      x:
        primitive.center.x +
        primitive.radius * Math.cos((angleDeg * Math.PI) / 180),
      y:
        primitive.center.y +
        primitive.radius * Math.sin((angleDeg * Math.PI) / 180),
    });
    const sweep = primitive.endAngleDeg - primitive.startAngleDeg;
    const start = point(primitive.startAngleDeg);
    const end = point(primitive.endAngleDeg);
    return (
      <path
        d={`M ${start.x},${start.y} A ${primitive.radius},${primitive.radius} 0 ${Math.abs(sweep) > 180 ? 1 : 0} ${sweep > 0 ? 1 : 0} ${end.x},${end.y}`}
        fill="none"
      />
    );
  }
  // Un symbole peut porter une lettre — « V » pour une vanne, « T » pour un
  // thermostat. Elle se dessine à sa taille, dans le repère du glyphe.
  return (
    <text
      x={primitive.anchor.x}
      y={primitive.anchor.y}
      textAnchor="middle"
      dominantBaseline="middle"
    >
      {primitive.text}
    </text>
  );
}

export function SymbolGlyph({
  familyId,
  category,
  size = 28,
}: SymbolGlyphProps) {
  const symbolId = planSymbolFor({ familyId, category });
  const definition = SYMBOL_LIBRARY_V1.definitions[symbolId];
  // Une planche incomplète ne casse pas une liste : la case reste, vide, et la
  // ligne garde sa hauteur. Rien ne saute sous la souris de qui fait défiler.
  if (definition === undefined)
    return (
      <span className="symbol-glyph" style={{ width: size, height: size }} />
    );

  const { min, max } = definition.viewBox;
  const width = Math.max(max.x - min.x, 1);
  const height = Math.max(max.y - min.y, 1);
  /*
   * Le repère du plan, sans retournement.
   *
   * Le dessin lit ces mêmes coordonnées telles quelles : un réservoir de WC
   * écrit en y négatif est en haut du plan, et doit être en haut de l'aperçu.
   * Retourner l'axe ici donnerait un aperçu joli et faux.
   */
  const margin = Math.max(width, height) * 0.06;
  const stroke = Math.max(width, height) / 34;
  const source = planSymbolSource({ familyId, category });
  return (
    <svg
      className="symbol-glyph"
      data-source={source}
      width={size}
      height={size}
      viewBox={`${min.x - margin} ${min.y - margin} ${width + margin * 2} ${height + margin * 2}`}
      preserveAspectRatio="xMidYMid meet"
      strokeWidth={stroke}
      fontSize={Math.max(width, height) / 4}
      // Le nom est à côté : lire deux fois la même chose à voix haute n'aide
      // personne. Le titre reste, pour la souris qui s'arrête dessus.
      aria-hidden="true"
      focusable="false"
    >
      <title>{definition.name}</title>
      {definition.primitives.map((primitive, index) => (
        <Primitive key={index} primitive={primitive} />
      ))}
    </svg>
  );
}
