/**
 * Poser, caler, tourner et verrouiller le calque de papier.
 *
 * ## Ce qui manquait
 *
 * Le panneau n'offrait que quatre nombres : largeur, transparence, coin X,
 * coin Y. Mettre un cadastre à l'échelle revenait donc à taper des largeurs au
 * jugé — 18, 22, 21,40 — jusqu'à ce que la façade du plan tombe sur celle de
 * l'image, et l'import donnait vingt mètres à toute image dont personne
 * n'avait dit la taille. Personne ne travaille comme ça.
 *
 * Ce que la personne sait d'un relevé, ce n'est jamais sa largeur : c'est
 * qu'entre ce coin de mur et cet autre il y a 12,50 m. Le panneau demande donc
 * exactement cela — deux points, une distance — et calcule le reste.
 *
 * ## Quatre réglages et un verrou
 *
 * Caler, déplacer, tourner, voir à travers : quatre gestes qui ne se font pas
 * en même temps, donc quatre volets plutôt qu'une colonne de dix champs où
 * l'on cherche celui qu'on veut. Le verrou n'est pas un volet mais un état :
 * il est visible en permanence, parce qu'une image calée qu'un curseur peut
 * encore déplacer n'est calée que jusqu'au prochain accident.
 *
 * ## Où sont les deux points
 *
 * Le calcul lui-même ne connaît ni pixels ni caméra : il vit dans
 * `underlay-calibration.ts`, il prend des points du modèle et il est vérifié
 * séparément. Ce panneau les recueille de deux manières — au clavier, en
 * coordonnées, qui marche partout et même sans souris ; et au clic sur le
 * plan, quand la surface de dessin veut bien donner le prochain point
 * (`onRequestPoint`). Les deux écrivent la même chose, et le clic n'est qu'un
 * moyen commode de remplir les mêmes champs.
 *
 * Il vit dans l'espace du terrain, contre le plan, parce que c'est en
 * regardant le dessin qu'on cale un relevé — jamais dans un formulaire d'un
 * autre écran.
 */
import { useEffect, useRef, useState } from 'react';
import type {
  Project,
  SiteUnderlay,
} from '@house-technical-designer/core-domain';
import type { Point2D } from '@house-technical-designer/geometry';
import {
  SetSiteUnderlayCommand,
  type ProjectCommand,
} from '@house-technical-designer/editor-core';

import {
  UNDERLAY_DEFAULT_WIDTH_MM,
  underlayFromFile,
} from './underlay-file.js';
import {
  calibrateUnderlay,
  isUnderlayLocked,
  measuredBetween,
  readCalibration,
  underlayLocked,
  underlayMoved,
  underlayRotationDeg,
  underlayTurned,
  underlayWidened,
  type UnderlayChange,
} from './underlay-calibration.js';

export interface UnderlayControlProps {
  readonly project: Project;
  readonly onCommand: (command: ProjectCommand) => boolean;
  readonly onMessage: (message: string) => void;
  /** Où poser le coin de l'image : le centre de ce qu'on regarde. */
  readonly originMm: { readonly x: number; readonly y: number };
  /**
   * Demander au plan le prochain clic, quand le plan sait le donner.
   *
   * Le panneau est posé **sur** la surface de dessin mais ne la commande pas :
   * il ne sait pas transformer un clic en point du modèle, et il n'a pas à le
   * savoir. Il annonce qu'il attend un point, la surface le lui envoie, et
   * rend une fonction qui annule l'attente — refermer le volet ou changer
   * d'avis ne doit pas laisser un clic piégé pour plus tard.
   *
   * Facultatif : sans elle, les deux points se saisissent en coordonnées, et
   * tout le reste du panneau fonctionne à l'identique.
   */
  readonly onRequestPoint?: (receive: (pointMm: Point2D) => void) => () => void;
}

/** Ce qu'on règle en ce moment. Un volet à la fois : on ne cale pas en tournant. */
type Adjustment = 'CALIBRATE' | 'MOVE' | 'TURN' | 'SEE';

const ADJUSTMENTS: readonly (readonly [Adjustment, string])[] = [
  ['CALIBRATE', 'Calibrer'],
  ['MOVE', 'Déplacer'],
  ['TURN', 'Rotation'],
  ['SEE', 'Transparence'],
];

/** Des millimètres du modèle, dits en mètres comme on les prononce. */
const metres = (millimetres: number): string =>
  (millimetres / 1000).toFixed(2).replace('.', ',');

/** La même chose pour un champ de saisie, qui n'accepte que le point. */
const metresValue = (millimetres: number): string =>
  (millimetres / 1000).toFixed(2);

/**
 * Un nombre tapé, en mètres, rendu en millimètres.
 *
 * La virgule est acceptée : c'est comme cela qu'on écrit 12,50 en français, et
 * un champ qui refuse la virgule est un champ qu'on croit cassé.
 */
const millimetresTyped = (text: string): number | undefined => {
  const value = Number(text.replace(',', '.'));
  return text.trim() === '' || !Number.isFinite(value)
    ? undefined
    : value * 1000;
};

/**
 * Un point de calibration en cours de saisie.
 *
 * Le point du modèle est gardé à côté de son texte plutôt que relu de lui :
 * un clic sur le plan donne un point au millimètre, et le réécrire à deux
 * décimales de mètre le raboterait au centimètre avant même de servir. Le
 * texte n'est repris que lorsque c'est la personne qui l'a tapé.
 */
interface PointDraft {
  readonly mm: Point2D;
  readonly x: string;
  readonly y: string;
}

const draftOf = (point: Point2D): PointDraft => ({
  mm: point,
  x: metresValue(point.x),
  y: metresValue(point.y),
});

const draftEdited = (
  draft: PointDraft | undefined,
  axis: 'x' | 'y',
  text: string,
): PointDraft => {
  const base: PointDraft = draft ?? { mm: { x: 0, y: 0 }, x: '0', y: '0' };
  const typed = millimetresTyped(text);
  // Un champ vidé garde le point qu'il avait : on efface pour retaper, et le
  // point ne doit pas sauter à zéro entre les deux frappes.
  const mm: Point2D =
    typed === undefined
      ? base.mm
      : axis === 'x'
        ? { x: typed, y: base.mm.y }
        : { x: base.mm.x, y: typed };
  return axis === 'x' ? { ...base, x: text, mm } : { ...base, y: text, mm };
};

export function UnderlayControl({
  project,
  onCommand,
  onMessage,
  originMm,
  onRequestPoint,
}: UnderlayControlProps) {
  const picker = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [adjustment, setAdjustment] = useState<Adjustment>('CALIBRATE');
  const [pointA, setPointA] = useState<PointDraft | undefined>(undefined);
  const [pointB, setPointB] = useState<PointDraft | undefined>(undefined);
  const [distanceText, setDistanceText] = useState('');
  const [awaiting, setAwaiting] = useState<'A' | 'B' | undefined>(undefined);
  /**
   * L'image vient d'arriver et personne n'a encore dit ce qu'elle mesure.
   *
   * L'import est obligé de lui donner une largeur — une image sans dimensions
   * ne s'affiche pas —, et il lui donne l'ordre de grandeur d'une parcelle.
   * C'est un point de départ, pas une mesure, et le taire est ce qui faisait
   * croire à une échelle. L'aveu est un état de l'écran et rien d'autre : il
   * n'est pas écrit dans le projet, et rouvrir le fichier ne le ressort pas.
   */
  const [provisional, setProvisional] = useState(false);
  /** De quoi renoncer au point qu'on attend : un clic promis se reprend. */
  const cancelPick = useRef<(() => void) | undefined>(undefined);
  const underlay = project.site.underlay;
  const locked = underlay !== undefined && isUnderlayLocked(underlay);

  const forget = (): void => {
    cancelPick.current?.();
    cancelPick.current = undefined;
    setAwaiting(undefined);
  };

  // Le panneau démonté ne doit pas laisser la surface de dessin attendre un
  // point pour quelqu'un qui n'est plus là : le prochain clic redeviendrait
  // une calibration au lieu d'une sélection.
  useEffect(
    () => () => {
      cancelPick.current?.();
    },
    [],
  );

  const set = (next: SiteUnderlay | undefined): void => {
    onCommand(new SetSiteUnderlayCommand(next));
  };

  /** Ce qu'un module a refusé se dit ; ce qu'il a accepté s'applique. */
  const applied = (change: UnderlayChange): void => {
    if (change.status === 'ERROR') {
      onMessage(change.message);
      return;
    }
    set(change.underlay);
  };

  function request(which: 'A' | 'B'): void {
    if (onRequestPoint === undefined) return;
    cancelPick.current?.();
    setAwaiting(which);
    cancelPick.current = onRequestPoint((point) => {
      cancelPick.current = undefined;
      if (which === 'A') {
        setPointA(draftOf(point));
        // Le second point est ce qu'on va chercher ensuite, sans exception :
        // enchaîner évite un aller-retour vers le panneau au milieu d'un geste
        // qui se fait les yeux sur le plan.
        request('B');
        return;
      }
      setPointB(draftOf(point));
      setAwaiting(undefined);
    });
  }

  const load = async (file: File | undefined): Promise<void> => {
    if (file === undefined) return;
    const result = await underlayFromFile(file, { originMm });
    if (result.status === 'ERROR') {
      onMessage(result.message);
      return;
    }
    set(result.underlay);
    setOpen(true);
    // Une image qui vient d'arriver n'est pas à l'échelle : elle porte une
    // largeur d'attente, et le premier geste utile est de la caler. Le volet
    // s'ouvre donc là, et non sur la transparence.
    setAdjustment('CALIBRATE');
    setPointA(undefined);
    setPointB(undefined);
    setDistanceText('');
    setProvisional(true);
    forget();
  };

  const distanceMm = millimetresTyped(distanceText);
  const measuredMm =
    pointA === undefined || pointB === undefined
      ? undefined
      : measuredBetween(pointA.mm, pointB.mm);
  const reading =
    pointA === undefined || pointB === undefined || distanceMm === undefined
      ? undefined
      : readCalibration(pointA.mm, pointB.mm, distanceMm);

  const calibrate = (): void => {
    if (underlay === undefined || pointA === undefined || pointB === undefined)
      return;
    if (distanceMm === undefined) {
      onMessage('Dites la distance réelle entre les deux points, en mètres.');
      return;
    }
    const result = calibrateUnderlay(
      underlay,
      pointA.mm,
      pointB.mm,
      distanceMm,
    );
    if (result.status === 'ERROR') {
      onMessage(result.message);
      return;
    }
    set(result.underlay);
    setProvisional(false);
    // Ce qui vient de se passer se dit en clair : une image qui change de
    // taille sans un mot laisse penser qu'on s'est trompé de bouton.
    onMessage(
      `Image de fond calée : ${metres(result.measuredMm)} m mesurés valent ${metres(distanceMm)} m, l’image est multipliée par ${result.factor.toFixed(3).replace('.', ',')}.`,
    );
  };

  const pointFields = (
    which: 'A' | 'B',
    draft: PointDraft | undefined,
    change: (next: PointDraft) => void,
  ) => (
    <label key={which}>
      <span>
        Point {which} <small>(m)</small>
      </span>
      {(['x', 'y'] as const).map((axis) => (
        <input
          key={axis}
          type="number"
          step={0.1}
          disabled={locked}
          value={draft === undefined ? '' : draft[axis]}
          aria-label={`Point ${which}, ${axis.toUpperCase()} en mètres`}
          onChange={(event) =>
            change(draftEdited(draft, axis, event.target.value))
          }
        />
      ))}
    </label>
  );

  return (
    <div
      className="underlay-control"
      role="group"
      aria-label="Image de fond"
      // Ces boutons sont posés **sur** la surface de dessin, et la surface de
      // dessin capture le pointeur dès qu'on la presse : le relâchement partait
      // alors au plan, et le clic n'arrivait jamais au bouton. Ce qui est
      // pressé ici est pressé ici.
      onPointerDown={(event) => event.stopPropagation()}
      onPointerUp={(event) => event.stopPropagation()}
    >
      <input
        ref={picker}
        type="file"
        accept="image/*"
        className="visually-hidden"
        aria-label="Choisir une image de fond"
        onChange={(event) => {
          void load(event.target.files?.[0]);
          // Reprendre le même fichier après l'avoir retiré doit marcher : un
          // champ qui garde sa valeur ne redéclenche rien.
          event.target.value = '';
        }}
      />
      {underlay === undefined ? (
        <button
          type="button"
          title="Poser un relevé, un cadastre ou une esquisse sous le dessin"
          onClick={() => picker.current?.click()}
        >
          Image de fond…
        </button>
      ) : (
        <>
          <button
            type="button"
            aria-expanded={open}
            title={`${underlay.name ?? 'Image de fond'}${locked ? ' — verrouillée' : ''}`}
            onClick={() => {
              setOpen((current) => !current);
              forget();
            }}
          >
            Fond · {metres(underlay.widthMm)} m{locked ? ' · verrouillée' : ''}
          </button>
          {open && (
            <div className="underlay-settings panel">
              <div
                className="underlay-actions"
                role="group"
                aria-label="Ce qu’on règle sur l’image"
              >
                {ADJUSTMENTS.map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className={adjustment === id ? undefined : 'secondary'}
                    aria-pressed={adjustment === id}
                    onClick={() => {
                      setAdjustment(id);
                      forget();
                    }}
                  >
                    {label}
                  </button>
                ))}
                {/* Le verrou n'est pas un volet mais un état : il reste visible
                    quel que soit ce qu'on règle, parce que c'est lui qui dit
                    pourquoi les champs ne répondent plus. */}
                <button
                  type="button"
                  className={locked ? undefined : 'secondary'}
                  aria-pressed={locked}
                  title={
                    locked
                      ? 'Rendre l’image modifiable'
                      : 'Empêcher l’image calée de bouger par accident'
                  }
                  onClick={() => {
                    forget();
                    set(underlayLocked(underlay, !locked));
                  }}
                >
                  {locked ? 'Déverrouiller' : 'Verrouiller'}
                </button>
              </div>
              {locked && (
                <p className="hint">
                  Image verrouillée : elle ne se déplace, ne tourne et ne se
                  recale plus tant que le verrou est mis.
                </p>
              )}

              {adjustment === 'CALIBRATE' && (
                <>
                  <p className="hint">
                    Deux points dont vous connaissez la distance, puis cette
                    distance : l’image prend son échelle. Le point A ne bouge
                    pas.
                  </p>
                  {/* Dire que la largeur est une attente et non une mesure :
                      c'est ce silence qui faisait croire à une échelle. */}
                  {provisional && (
                    <p className="hint">
                      Largeur provisoire : {metres(UNDERLAY_DEFAULT_WIDTH_MM)} m
                      posés au jugé à l’import, tant que l’image n’est pas
                      calée.
                    </p>
                  )}
                  {pointFields('A', pointA, setPointA)}
                  {pointFields('B', pointB, setPointB)}
                  {onRequestPoint !== undefined && (
                    <div className="underlay-actions">
                      <button
                        type="button"
                        className="secondary"
                        disabled={locked}
                        onClick={() =>
                          awaiting === undefined ? request('A') : forget()
                        }
                      >
                        {awaiting === undefined
                          ? 'Cliquer les deux points'
                          : 'Annuler'}
                      </button>
                    </div>
                  )}
                  {awaiting !== undefined && (
                    <p className="hint" role="status">
                      {awaiting === 'A'
                        ? 'Cliquez le point A sur le plan.'
                        : 'Cliquez le point B sur le plan.'}
                    </p>
                  )}
                  <label>
                    <span>
                      Distance réelle <small>(m)</small>
                    </span>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      disabled={locked}
                      value={distanceText}
                      aria-label="Distance réelle entre les deux points, en mètres"
                      onChange={(event) => setDistanceText(event.target.value)}
                    />
                  </label>
                  {/* Le facteur avant le clic : un ×15 se voit et se corrige,
                      une image devenue immense se subit. */}
                  {measuredMm !== undefined && (
                    <p className="hint">
                      Mesuré {metres(measuredMm)} m
                      {reading !== undefined &&
                        (reading.status === 'OK'
                          ? ` · l’image sera multipliée par ${reading.factor.toFixed(3).replace('.', ',')}`
                          : ` · ${reading.message}`)}
                    </p>
                  )}
                  <div className="underlay-actions">
                    <button
                      type="button"
                      disabled={
                        locked ||
                        reading === undefined ||
                        reading.status === 'ERROR'
                      }
                      onClick={calibrate}
                    >
                      Appliquer
                    </button>
                  </div>
                  {/* La largeur reste saisissable : un plan de géomètre porte
                      son échelle, et la dire est plus court que de désigner
                      deux points. */}
                  <label>
                    <span>
                      Largeur <small>(m)</small>
                    </span>
                    <input
                      type="number"
                      min={0.1}
                      step={0.5}
                      disabled={locked}
                      value={Number(metresValue(underlay.widthMm))}
                      aria-label="Largeur de l’image en mètres"
                      onChange={(event) => {
                        const wanted = millimetresTyped(event.target.value);
                        if (wanted === undefined) return;
                        setProvisional(false);
                        applied(underlayWidened(underlay, wanted));
                      }}
                    />
                  </label>
                </>
              )}

              {adjustment === 'MOVE' && (
                <>
                  {/* Le coin, en mètres : caler un relevé se fait au nombre
                      quand l'œil ne suffit plus. */}
                  {(['x', 'y'] as const).map((axis) => (
                    <label key={axis}>
                      <span>
                        Coin {axis.toUpperCase()} <small>(m)</small>
                      </span>
                      <input
                        type="number"
                        step={0.5}
                        disabled={locked}
                        value={Number(metresValue(underlay.originMm[axis]))}
                        aria-label={`Coin ${axis.toUpperCase()} de l’image en mètres`}
                        onChange={(event) => {
                          const at = millimetresTyped(event.target.value);
                          if (at !== undefined)
                            applied(
                              underlayMoved(
                                underlay,
                                axis === 'x'
                                  ? { x: at, y: underlay.originMm.y }
                                  : { x: underlay.originMm.x, y: at },
                              ),
                            );
                        }}
                      />
                    </label>
                  ))}
                </>
              )}

              {adjustment === 'TURN' && (
                <>
                  <p className="hint">
                    Un cadastre n’est presque jamais nord en haut : tournez la
                    feuille jusqu’à ce que la rue tombe sur la rue.
                  </p>
                  <label>
                    <span>
                      Rotation <small>(°)</small>
                    </span>
                    <input
                      type="number"
                      step={0.5}
                      disabled={locked}
                      value={Number(underlayRotationDeg(underlay).toFixed(1))}
                      aria-label="Rotation de l’image en degrés"
                      onChange={(event) => {
                        const turned = Number(event.target.value);
                        if (Number.isFinite(turned))
                          applied(underlayTurned(underlay, turned));
                      }}
                    />
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={359}
                    step={1}
                    disabled={locked}
                    value={Math.round(underlayRotationDeg(underlay))}
                    aria-label="Rotation de l’image, réglage continu"
                    onChange={(event) =>
                      applied(
                        underlayTurned(underlay, Number(event.target.value)),
                      )
                    }
                  />
                  <div className="underlay-actions">
                    {/* Les quarts de tour couvrent le cas le plus fréquent :
                        une image scannée dans le mauvais sens. */}
                    {([-90, 90] as const).map((quarter) => (
                      <button
                        key={quarter}
                        type="button"
                        className="secondary"
                        disabled={locked}
                        onClick={() =>
                          applied(
                            underlayTurned(
                              underlay,
                              underlayRotationDeg(underlay) + quarter,
                            ),
                          )
                        }
                      >
                        {quarter > 0 ? '+90°' : '−90°'}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="secondary"
                      disabled={locked}
                      onClick={() => applied(underlayTurned(underlay, 0))}
                    >
                      Remettre droite
                    </button>
                  </div>
                </>
              )}

              {adjustment === 'SEE' && (
                <label>
                  <span>Transparence</span>
                  <input
                    type="range"
                    min={5}
                    max={100}
                    step={5}
                    // Le verrou retient la géométrie, pas le regard : régler la
                    // transparence ne déplace rien, et c'est justement ce qu'on
                    // veut pouvoir faire sans déverrouiller.
                    value={Math.round((underlay.opacity ?? 0.55) * 100)}
                    aria-label="Opacité de l’image"
                    onChange={(event) =>
                      set({
                        ...underlay,
                        opacity: Number(event.target.value) / 100,
                      })
                    }
                  />
                </label>
              )}

              <div className="underlay-actions">
                <button
                  type="button"
                  className="secondary"
                  disabled={locked}
                  onClick={() => picker.current?.click()}
                >
                  Remplacer
                </button>
                <button
                  type="button"
                  className="secondary"
                  disabled={locked}
                  // Elle n'emporte rien : ce n'est pas un objet du modèle.
                  onClick={() => {
                    forget();
                    set(undefined);
                    setOpen(false);
                  }}
                >
                  Retirer
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
