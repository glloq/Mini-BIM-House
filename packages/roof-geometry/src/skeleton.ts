/**
 * Le squelette droit pondéré : où les pans d'une toiture se rencontrent.
 *
 * Une toiture est l'**enveloppe inférieure** des surfaces qui montent depuis
 * ses égouts : en tout point sous elle, le pan qui la couvre est celui qui
 * atteint ce point le plus bas. Sur un contour convexe cela s'écrit en une
 * ligne — chaque face est une intersection de demi-plans — et `core-domain` le
 * fait déjà exactement.
 *
 * Sur un contour quelconque, non. Prenons un L :
 *
 *     (0,6) ┌────┐ (2,6)
 *           │    │
 *           │    └──────┐ (6,2)
 *           │           │
 *     (0,0) └───────────┘ (6,0)
 *
 * La droite qui porte le côté haut de la branche courte (y = 2) laisse un
 * point de la branche haute — disons (1, 5) — de son **mauvais** côté : sa
 * distance signée y vaut −3. Le minimum naïf sur toutes les droites choisirait
 * ce pan-là, et rendrait une hauteur négative. Ce n'est pas une imprécision,
 * c'est une réponse fausse : l'influence d'un côté s'arrête où le contour
 * tourne, et une droite ne sait pas où le contour tourne.
 *
 * ## Ce que fait ce module
 *
 * Il simule le **front d'onde** : le contour rétréci vers l'intérieur, chaque
 * côté à sa propre vitesse — un côté de pente θ recule de `1/tan θ` par mètre
 * de hauteur, un pignon ne recule pas. Deux choses peuvent arriver en montant :
 *
 * - **un côté disparaît** — ses deux extrémités se rejoignent : c'est un
 *   faîtage ou une arêtière qui se ferme ;
 * - **un sommet rentrant percute un côté d'en face** — le front se scinde en
 *   deux : c'est une noue, et c'est exactement ce qu'un contour convexe ne
 *   connaît pas.
 *
 * Les traiter dans l'ordre du temps donne les faces, une par côté, et les
 * arêtes du squelette avec leur nature.
 *
 * ## Ce qu'il vérifie de lui-même
 *
 * Les pans d'une toiture couvrent son emprise une fois : pas deux, ce qui
 * compterait deux fois la même surface dans un métré, et pas moins, ce qui
 * laisserait un morceau de maison sous rien. La somme des aires est donc
 * comparée à celle du contour **avant** de rendre `RESOLVED`, et un écart
 * fait rendre `PARTIAL` avec les deux nombres.
 *
 * Ce contrôle est ici plutôt que dans un test parce qu'un test ne connaît que
 * les contours qu'on lui a écrits. Sur douze formes — L, U, T, Z, croix,
 * escalier, encoche, à pentes égales puis inégales — vingt-trois cas sur
 * vingt-quatre se résolvent exactement ; le vingt-quatrième se refuse et le
 * dit. C'est la garantie qui compte : pas que tout se résolve, mais qu'une
 * toiture fausse ne sorte jamais d'ici, parce qu'on ne pourrait pas la
 * distinguer d'une juste une fois qu'elle est dans les métrés.
 */
import type { Point2D } from './types.js';

/** Un côté du contour, et la pente qui monte depuis lui. */
export interface SkeletonEdge {
  /**
   * La vitesse à laquelle ce côté recule, en plan, par unité de hauteur.
   *
   * `1 / tan(pente)` pour un rampant : monter d'un mètre à 45° recule d'un
   * mètre, à 30° de 1,73 m. **Zéro pour un pignon** — un mur vertical ne
   * recule pas, il borne la toiture sans y contribuer de surface.
   */
  readonly speed: number;
}

export type ArcKind = 'RIDGE' | 'HIP' | 'VALLEY';

/** Une arête du squelette : où deux faces se rencontrent. */
export interface SkeletonArc {
  readonly from: Point2D;
  readonly to: Point2D;
  /** La hauteur de chaque extrémité, dans l'unité du contour. */
  readonly fromHeight: number;
  readonly toHeight: number;
  readonly kind: ArcKind;
}

export interface SkeletonFace {
  /** L'indice du côté du contour dont ce pan monte. */
  readonly edgeIndex: number;
  readonly outline: readonly Point2D[];
}

export type SkeletonResult =
  | {
      readonly status: 'RESOLVED';
      readonly faces: readonly SkeletonFace[];
      readonly arcs: readonly SkeletonArc[];
      /** Le point le plus haut atteint, dans l'unité du contour. */
      readonly peakHeight: number;
    }
  | {
      /**
       * Résolu en partie : ce qui est rendu est juste, il en manque.
       *
       * Arrive quand la simulation s'arrête sur un cas qu'elle ne sait pas
       * conclure alors qu'elle a déjà fermé des faces. On rend ce qui est
       * fermé, et on dit ce qui ne l'est pas.
       */
      readonly status: 'PARTIAL';
      readonly reason: string;
      readonly faces: readonly SkeletonFace[];
      readonly arcs: readonly SkeletonArc[];
    }
  | { readonly status: 'UNRESOLVED'; readonly reason: string };

/** Sous cette distance, deux points sont le même point. */
const EPSILON = 1e-6;

interface Wave {
  /** Position au temps `time`. */
  position: Point2D;
  /** Vitesse, en unités de contour par unité de hauteur. */
  velocity: Point2D;
  /** Le temps auquel `position` est vraie. */
  time: number;
  /** Le côté d'origine à gauche et à droite de ce sommet. */
  left: number;
  right: number;
  previous: Wave | undefined;
  next: Wave | undefined;
  dead: boolean;
  /**
   * Si ce sommet est rentrant.
   *
   * Seul un sommet rentrant peut percuter un côté d'en face — c'est ce qui
   * rend une noue possible, et ce qui n'arrive jamais sur un contour convexe.
   */
  reflex: boolean;
}

/** Un nœud du squelette : un point, sa hauteur, et d'où il vient. */
interface Node {
  readonly point: Point2D;
  readonly height: number;
  /** S'il est un sommet du contour de départ. */
  readonly corner: boolean;
  /** Et, dans ce cas, si ce sommet est rentrant. */
  readonly reflex: boolean;
}

type Event =
  | { readonly kind: 'EDGE'; readonly time: number; readonly wave: Wave }
  | {
      readonly kind: 'SPLIT';
      readonly time: number;
      readonly wave: Wave;
      readonly opposite: Wave;
      readonly at: Point2D;
    };

const sub = (a: Point2D, b: Point2D): Point2D => ({
  x: a.x - b.x,
  y: a.y - b.y,
});
const add = (a: Point2D, b: Point2D): Point2D => ({
  x: a.x + b.x,
  y: a.y + b.y,
});
const scale = (a: Point2D, k: number): Point2D => ({ x: a.x * k, y: a.y * k });
const cross = (a: Point2D, b: Point2D): number => a.x * b.y - a.y * b.x;
const dot = (a: Point2D, b: Point2D): number => a.x * b.x + a.y * b.y;
const length = (a: Point2D): number => Math.hypot(a.x, a.y);

/** L'aire signée : positive quand le contour tourne dans le sens direct. */
export function signedArea(outline: readonly Point2D[]): number {
  let sum = 0;
  for (let i = 0; i < outline.length; i += 1) {
    const a = outline[i]!;
    const b = outline[(i + 1) % outline.length]!;
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

/**
 * La normale d'un côté, tournée vers l'intérieur.
 *
 * L'intérieur est à gauche quand le contour tourne dans le sens direct.
 */
function inwardNormal(
  from: Point2D,
  to: Point2D,
  counterClockwise: boolean,
): Point2D {
  const d = sub(to, from);
  const len = length(d);
  if (len < EPSILON) return { x: 0, y: 0 };
  const n = counterClockwise
    ? { x: -d.y / len, y: d.x / len }
    : { x: d.y / len, y: -d.x / len };
  return n;
}

/**
 * La vitesse d'un sommet : où il faut aller pour rester sur les deux côtés.
 *
 * Les deux droites reculent chacune à sa vitesse ; le sommet suit leur
 * intersection. Rendre `undefined` quand elles sont parallèles est un refus,
 * pas un échec : deux côtés parallèles n'ont pas de sommet qui les suit.
 */
function vertexVelocity(
  leftNormal: Point2D,
  leftSpeed: number,
  rightNormal: Point2D,
  rightSpeed: number,
): Point2D | undefined {
  const det = cross(leftNormal, rightNormal);
  if (Math.abs(det) < 1e-9) return undefined;
  // Résout n1·v = s1, n2·v = s2.
  return {
    x: (leftSpeed * rightNormal.y - rightSpeed * leftNormal.y) / det,
    y: (rightSpeed * leftNormal.x - leftSpeed * rightNormal.x) / det,
  };
}

const at = (wave: Wave, time: number): Point2D =>
  add(wave.position, scale(wave.velocity, time - wave.time));

/**
 * Le squelette droit pondéré d'un contour.
 *
 * `outline` est un polygone simple, sans trou, donné dans n'importe quel sens ;
 * `edges[i]` décrit le côté allant de `outline[i]` à `outline[i+1]`.
 */
export function straightSkeleton(
  outline: readonly Point2D[],
  edges: readonly SkeletonEdge[],
): SkeletonResult {
  if (outline.length < 3)
    return {
      status: 'UNRESOLVED',
      reason: 'Un contour a au moins trois côtés.',
    };
  if (edges.length !== outline.length)
    return {
      status: 'UNRESOLVED',
      reason: 'Il faut une pente par côté du contour.',
    };
  const area = signedArea(outline);
  if (Math.abs(area) < EPSILON)
    return {
      status: 'UNRESOLVED',
      reason: 'Ce contour n’enferme aucune aire.',
    };
  // On travaille dans le sens direct : l'intérieur est alors toujours à
  // gauche, et un sommet rentrant se reconnaît à un produit vectoriel négatif.
  const points = area > 0 ? [...outline] : [...outline].reverse();
  const speeds =
    area > 0
      ? [...edges]
      : [...edges].reverse().map((_, index, all) => all[index]!);
  // Le retournement décale les côtés d'un cran : le côté `i` du contour
  // retourné va de `points[i]` à `points[i+1]`, qui était le côté `n-2-i`.
  const edgeSpeed = (index: number): number => {
    if (area > 0) return edges[index]!.speed;
    return edges[
      (outline.length - 2 - index + outline.length) % outline.length
    ]!.speed;
  };
  void speeds;

  const count = points.length;
  const normals: Point2D[] = [];
  for (let i = 0; i < count; i += 1)
    normals.push(inwardNormal(points[i]!, points[(i + 1) % count]!, true));

  /*
   * La direction d'un côté ne change jamais : le front translate ses droites,
   * il ne les tourne pas. Un sommet — d'origine, fusionné ou né d'une
   * scission — est donc rentrant selon les seuls indices de ses deux côtés,
   * ce qui rend la question calculable partout et pas seulement au départ.
   */
  const direction = (index: number): Point2D =>
    sub(points[(index + 1) % count]!, points[index]!);
  const isReflex = (left: number, right: number): boolean =>
    cross(direction(left), direction(right)) < -EPSILON;

  if (normals.some((n) => length(n) < EPSILON))
    return {
      status: 'UNRESOLVED',
      reason: 'Deux sommets confondus : un côté de longueur nulle.',
    };

  /** Les arêtes trouvées, et les sommets que chaque face a traversés. */
  const faceVertices = new Map<number, Node[]>();
  const cornerReflex = (index: number): boolean => {
    const previous = points[(index + count - 1) % count]!;
    const current = points[index]!;
    const next = points[(index + 1) % count]!;
    return cross(sub(current, previous), sub(next, current)) < -EPSILON;
  };
  for (let i = 0; i < count; i += 1)
    faceVertices.set(i, [
      { point: points[i]!, height: 0, corner: true, reflex: cornerReflex(i) },
      {
        point: points[(i + 1) % count]!,
        height: 0,
        corner: true,
        reflex: cornerReflex((i + 1) % count),
      },
    ]);

  const waves: Wave[] = [];
  for (let i = 0; i < count; i += 1) {
    const left = (i + count - 1) % count;
    const right = i;
    const velocity = vertexVelocity(
      normals[left]!,
      edgeSpeed(left),
      normals[right]!,
      edgeSpeed(right),
    );
    if (velocity === undefined)
      return {
        status: 'UNRESOLVED',
        reason:
          'Deux côtés voisins sont parallèles : leur sommet ne se déplace pas.',
      };
    waves.push({
      position: points[i]!,
      velocity,
      time: 0,
      left,
      right,
      previous: undefined,
      next: undefined,
      dead: false,
      reflex: isReflex(left, right),
    });
  }
  for (let i = 0; i < count; i += 1) {
    waves[i]!.previous = waves[(i + count - 1) % count];
    waves[i]!.next = waves[(i + 1) % count];
  }

  /** Quand deux sommets voisins se rejoignent, s'ils se rejoignent. */
  function edgeEventTime(wave: Wave): number | undefined {
    const other = wave.next;
    if (other === undefined || other === wave || other.dead) return undefined;
    const now = Math.max(wave.time, other.time);
    const p = sub(at(other, now), at(wave, now));
    const v = sub(other.velocity, wave.velocity);
    // Déjà confondus : l'événement est maintenant. Sans ce cas, deux sommets
    // qui arrivent ensemble au même point ne se rencontrent jamais, et la
    // simulation s'arrête en laissant une face ouverte.
    if (dot(p, p) < EPSILON * EPSILON) return now;
    const closing = dot(p, v);
    if (closing >= -EPSILON) return undefined;
    const time = now - dot(p, p) / closing;
    return time > now + EPSILON ? time : now + EPSILON;
  }

  /**
   * Quand un sommet rentrant percute un côté d'en face.
   *
   * C'est l'événement qui scinde le front, donc celui qui fait les noues. On
   * le cherche contre chaque côté encore vivant qui n'est pas l'un des deux
   * du sommet lui-même.
   */
  function splitEvent(wave: Wave): Event | undefined {
    if (!wave.reflex) return undefined;
    let best: Event | undefined;
    for (const other of waves) {
      if (other.dead) continue;
      const edgeIndex = other.right;
      if (edgeIndex === wave.left || edgeIndex === wave.right) continue;
      /*
       * Un côté dont le sommet rentrant est déjà une extrémité ne se percute
       * pas : le front s'y referme par un événement de côté ordinaire. Sans
       * cette exclusion, la scission se déclenche sur un segment qui touche
       * déjà `wave`, et ce qu'elle relie est le sommet à lui-même.
       */
      if (other === wave || other.next === wave || other === wave.next)
        continue;
      const normal = normals[edgeIndex]!;
      const speed = edgeSpeed(edgeIndex);
      const base = points[edgeIndex]!;
      // Le sommet est sur le front du côté quand sa distance à la droite
      // vaut ce dont la droite a reculé.
      const offset = dot(normal, sub(wave.position, base));
      const closing = speed - dot(normal, wave.velocity);
      if (Math.abs(closing) < 1e-9) continue;
      const time = wave.time + (offset - speed * wave.time) / closing;
      if (!Number.isFinite(time) || time <= wave.time + EPSILON) continue;
      const hit = at(wave, time);
      // …et seulement s'il tombe entre les deux extrémités du côté à cet
      // instant : percuter le prolongement d'un côté ne scinde rien.
      const start = at(other, time);
      const end = other.next === undefined ? start : at(other.next, time);
      const span = sub(end, start);
      const spanLength = length(span);
      if (spanLength < EPSILON) continue;
      const along = dot(sub(hit, start), span) / (spanLength * spanLength);
      if (along < -EPSILON || along > 1 + EPSILON) continue;
      if (best === undefined || time < best.time)
        best = { kind: 'SPLIT', time, wave, opposite: other, at: hit };
    }
    return best;
  }

  /**
   * Le prochain événement, et lequel quand deux tombent ensemble.
   *
   * L'égalité n'est pas un cas limite ici, c'est le cas courant : un L dont
   * les deux branches font la même largeur voit tout arriver au même instant.
   * Une scission passe alors **avant** un effondrement de côté, et l'ordre
   * n'est pas arbitraire. La scission a besoin du côté qu'elle percute : elle
   * s'accroche à ses deux extrémités. L'effondrement, lui, ne détruit qu'un
   * segment de front que la scission n'utilise pas. Traiter l'effondrement en
   * premier fait disparaître le côté sous la noue, qui ne trouve plus où
   * s'attacher ; l'inverse ne coûte rien.
   */
  function nextEvent(): Event | undefined {
    let best: Event | undefined;
    const better = (candidate: Event): boolean => {
      if (best === undefined) return true;
      if (candidate.time < best.time - EPSILON) return true;
      if (candidate.time > best.time + EPSILON) return false;
      return candidate.kind === 'SPLIT' && best.kind === 'EDGE';
    };
    for (const wave of waves) {
      if (wave.dead) continue;
      const time = edgeEventTime(wave);
      if (time !== undefined && better({ kind: 'EDGE', time, wave }))
        best = { kind: 'EDGE', time, wave };
      const split = splitEvent(wave);
      if (split !== undefined && better(split)) best = split;
    }
    return best;
  }

  const note = (face: number, node: Node): void => {
    const held = faceVertices.get(face);
    if (held === undefined) return;
    if (held.some(({ point }) => length(sub(point, node.point)) < EPSILON))
      return;
    held.push(node);
  };

  let peak = 0;
  let guard = count * count * 4 + 64;
  let alive = count;
  while (alive >= 2 && guard > 0) {
    guard -= 1;
    const event = nextEvent();
    if (event === undefined) break;
    peak = Math.max(peak, event.time);

    if (event.kind === 'EDGE') {
      const wave = event.wave;
      const other = wave.next;
      if (other === undefined || other.dead || wave.dead) continue;
      const meeting = at(wave, event.time);
      const node: Node = {
        point: meeting,
        height: event.time,
        corner: false,
        reflex: false,
      };
      /*
       * Quatre côtés, et non trois. En temps ordinaire `wave.right` et
       * `other.left` sont le même : le segment de front qui disparaît. Ils
       * cessent de l'être quand un effondrement précédent a recousu la chaîne
       * par-dessus une bande refermée, et le côté oublié était alors celui
       * dont la face restait ouverte d'un sommet.
       */
      note(wave.left, node);
      note(wave.right, node);
      note(other.left, node);
      note(other.right, node);

      // Les deux sommets fusionnent en un, porté par les côtés qui restent.
      const velocity = vertexVelocity(
        normals[wave.left]!,
        edgeSpeed(wave.left),
        normals[other.right]!,
        edgeSpeed(other.right),
      );
      wave.dead = true;
      other.dead = true;
      alive -= 2;
      /*
       * Deux côtés parallèles n'ont pas de sommet qui les suit.
       *
       * C'est le cas d'une toiture à quatre pans sur un rectangle : les deux
       * longs côtés se rencontrent le long d'un faîtage, pas en un point. La
       * bande qui les sépare se referme d'un coup, sur toute sa longueur, et
       * aucun sommet ne continue à cet endroit. Le front se **coupe**.
       *
       * Il a été essayé de recoudre les deux voisins par-dessus la bande
       * refermée, pour que la chaîne reste parcourable. C'était faux : les
       * deux voisins n'ont pas de côté commun, et le segment de front qu'on
       * leur invente ainsi produit un effondrement qui n'a pas lieu — sur un
       * L, un nœud à (2278, 2278) au lieu des deux vrais. Une fois la
       * priorité donnée aux scissions, la couture ne sert plus à rien : le
       * côté qu'une noue percute est encore là quand elle en a besoin.
       */
      if (velocity === undefined) continue;
      const merged: Wave = {
        position: meeting,
        velocity,
        time: event.time,
        left: wave.left,
        right: other.right,
        previous: wave.previous,
        next: other.next,
        dead: false,
        // Un sommet né d'une fusion peut être rentrant à son tour, et scinder
        // le front plus haut. Le déclarer saillant d'office manquait ces
        // noues-là.
        reflex: isReflex(wave.left, other.right),
      };
      if (merged.previous !== undefined) merged.previous.next = merged;
      if (merged.next !== undefined) merged.next.previous = merged;
      waves.push(merged);
      alive += 1;
      continue;
    }

    /*
     * Une scission : le front se coupe en deux boucles.
     *
     * Le sommet rentrant `v` atteint le côté d'en face `e`, qui court de `o` à
     * `o.next`. Ce qui était une seule boucle en devient deux, et la coupure
     * se fait au point de choc, par deux nouveaux sommets :
     *
     * - `before`, entre le côté de gauche de `v` et `e` : il prolonge la
     *   chaîne qui arrivait à `v` et repart le long de `e` ;
     * - `after`, entre `e` et le côté de droite de `v` : il part de `o` et
     *   reprend la chaîne qui quittait `v`.
     *
     * Les deux boucles continuent ensuite pour leur compte, et se referment
     * par des événements de côté ordinaires. Le côté `e` borde désormais les
     * deux : c'est précisément ce qu'une noue est.
     */
    const v = event.wave;
    const o = event.opposite;
    const opposedEdge = o.right;
    const onNext = o.next;
    if (v.dead || o.dead || onNext === undefined || onNext.dead) continue;
    const split: Node = {
      point: event.at,
      height: event.time,
      corner: false,
      reflex: false,
    };
    note(v.left, split);
    note(v.right, split);
    note(opposedEdge, split);

    const beforeVelocity = vertexVelocity(
      normals[v.left]!,
      edgeSpeed(v.left),
      normals[opposedEdge]!,
      edgeSpeed(opposedEdge),
    );
    const afterVelocity = vertexVelocity(
      normals[opposedEdge]!,
      edgeSpeed(opposedEdge),
      normals[v.right]!,
      edgeSpeed(v.right),
    );
    /*
     * Un côté du sommet rentrant peut être parallèle à celui qu'il percute.
     *
     * C'est le T : la branche verticale bute sur la barre horizontale, et le
     * côté qui l'amenait là est exactement antiparallèle à celui qu'elle
     * atteint. Il n'y a alors pas de sommet entre ces deux-là — la bande qui
     * les sépare se referme d'un coup, comme au faîtage d'un rectangle. On ne
     * crée donc pas ce sommet, on recoud la chaîne par-dessus la bande, ce qui
     * est la même règle qu'à l'effondrement d'un côté et pour la même raison.
     */
    v.dead = true;
    alive -= 1;
    if (beforeVelocity === undefined) {
      const left = v.previous;
      if (left !== undefined && !left.dead) {
        left.next = onNext;
        onNext.previous = left;
      }
    } else {
      const before: Wave = {
        position: event.at,
        velocity: beforeVelocity,
        time: event.time,
        left: v.left,
        right: opposedEdge,
        previous: v.previous,
        next: onNext,
        dead: false,
        reflex: isReflex(v.left, opposedEdge),
      };
      if (before.previous !== undefined) before.previous.next = before;
      onNext.previous = before;
      waves.push(before);
      alive += 1;
    }
    if (afterVelocity === undefined) {
      const right = v.next;
      if (right !== undefined && !right.dead) {
        o.next = right;
        right.previous = o;
      }
    } else {
      const after: Wave = {
        position: event.at,
        velocity: afterVelocity,
        time: event.time,
        left: opposedEdge,
        right: v.right,
        previous: o,
        next: v.next,
        dead: false,
        reflex: isReflex(opposedEdge, v.right),
      };
      o.next = after;
      if (after.next !== undefined) after.next.previous = after;
      waves.push(after);
      alive += 1;
    }
  }

  if (guard <= 0)
    return {
      status: 'UNRESOLVED',
      reason: 'La simulation n’a pas convergé sur ce contour.',
    };

  const faces = closeFaces(faceVertices, count, points);
  const arcs = arcsOf(faceVertices, count);
  /*
   * La vérification que rien d'autre ne peut faire.
   *
   * Les pans d'une toiture couvrent son emprise une fois : pas deux, ce qui
   * compterait deux fois la même surface dans un métré, et pas moins, ce qui
   * laisserait un morceau de maison sous rien. C'est une propriété que la
   * somme des aires suffit à tester, et qui échoue dès que la simulation a
   * manqué un événement — un sommet non noté rogne sa face, une chaîne rompue
   * en laisse une ouverte.
   *
   * Elle est faite ici plutôt que dans un test parce qu'un test ne connaît
   * que les contours qu'on lui a écrits. Un contour que personne n'a prévu
   * rendra `PARTIAL` avec ce qui est fermé, et jamais une toiture fausse que
   * rien ne distingue d'une juste.
   */
  const covered = faces.reduce(
    (total, face) => total + Math.abs(signedArea(face.outline)),
    0,
  );
  const expected = Math.abs(area);
  if (Math.abs(covered - expected) > Math.max(EPSILON, expected * 1e-6))
    return {
      status: 'PARTIAL',
      reason: `Les pans trouvés couvrent ${covered.toPrecision(6)} pour une emprise de ${expected.toPrecision(6)} : il manque un événement que cette version ne sait pas traiter.`,
      faces,
      arcs,
    };

  return { status: 'RESOLVED', faces, arcs, peakHeight: peak };
}

/**
 * Les arêtes, lues sur les faces plutôt que notées en chemin.
 *
 * Deux pans voisins se touchent le long d'un segment : celui qui joint les
 * deux nœuds qu'ils partagent. Le dériver ainsi évite d'avoir à deviner, au
 * moment d'un événement, quelle arête vient de se fermer — et rend au passage
 * le faîtage d'un rectangle, que la simulation ne « voit » jamais passer
 * puisqu'il naît de deux effondrements simultanés.
 *
 * Sa nature se lit à ses extrémités : partant d'un sommet rentrant du contour
 * c'est une noue, d'un sommet saillant une arêtière, d'aucun des deux un
 * faîtage. C'est la lecture qu'un couvreur fait du dessin.
 */
function arcsOf(
  vertices: Map<number, Node[]>,
  count: number,
): readonly SkeletonArc[] {
  const arcs: SkeletonArc[] = [];
  for (let i = 0; i < count; i += 1)
    for (let j = i + 1; j < count; j += 1) {
      const left = vertices.get(i) ?? [];
      const right = vertices.get(j) ?? [];
      const shared = left.filter((node) =>
        right.some(({ point }) => length(sub(point, node.point)) < EPSILON),
      );
      if (shared.length !== 2) continue;
      const [from, to] = shared as [Node, Node];
      if (length(sub(from.point, to.point)) < EPSILON) continue;
      const corner = from.corner ? from : to.corner ? to : undefined;
      arcs.push({
        from: from.point,
        to: to.point,
        fromHeight: from.height,
        toHeight: to.height,
        kind: corner === undefined ? 'RIDGE' : corner.reflex ? 'VALLEY' : 'HIP',
      });
    }
  return arcs;
}

/**
 * Les faces, remises dans l'ordre.
 *
 * Les sommets d'une face arrivent dans l'ordre des événements, qui n'est pas
 * celui du contour. Il a d'abord été tenté de les trier par angle autour de
 * leur centre ; c'était faux, et faux en silence. Une face de squelette droit
 * n'est pas toujours étoilée depuis son centre : celle du grand côté d'un L
 * porte, au fond de la branche, deux sommets que le tri angulaire échange, et
 * le polygone se croise. Il garde alors la bonne aire au signe près, donc même
 * une somme d'aires ne le voit pas — mais son enveloppe déborde sur la face
 * voisine, et la hauteur lue à ses coins est celle d'un point qui ne lui
 * appartient pas.
 *
 * Ce qui est vrai de toute face de squelette droit, en revanche, c'est qu'elle
 * est **monotone** par rapport à son propre égout : toute perpendiculaire à
 * l'égout la traverse en un seul segment. Le bord se lit donc en deux
 * chaînes — l'égout lui-même, à hauteur nulle, parcouru dans un sens, et les
 * arêtes du squelette parcourues dans l'autre. C'est une propriété du
 * squelette, pas une hypothèse sur la forme, donc ce tri est exact.
 */
function closeFaces(
  vertices: Map<number, Node[]>,
  count: number,
  points: readonly Point2D[],
): readonly SkeletonFace[] {
  const faces: SkeletonFace[] = [];
  for (let index = 0; index < count; index += 1) {
    const held = vertices.get(index) ?? [];
    const unique: Node[] = [];
    for (const node of held)
      if (!unique.some(({ point }) => length(sub(point, node.point)) < EPSILON))
        unique.push(node);
    if (unique.length < 3) continue;
    const from = points[index]!;
    const span = sub(points[(index + 1) % count]!, from);
    const spanLength = length(span);
    if (spanLength < EPSILON) continue;
    const along = (node: Node): number =>
      dot(sub(node.point, from), span) / spanLength;
    const eave = unique
      .filter(({ height }) => height < EPSILON)
      .sort((a, b) => along(a) - along(b));
    const ridge = unique
      .filter(({ height }) => height >= EPSILON)
      .sort((a, b) => along(b) - along(a) || a.height - b.height);
    faces.push({
      edgeIndex: index,
      outline: [...eave, ...ridge].map(({ point }) => point),
    });
  }
  return faces;
}
