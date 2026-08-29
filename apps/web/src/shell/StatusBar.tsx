import { useRef, useState } from 'react';

import {
  DIMENSION_MODES,
  DIMENSION_MODE_LABELS,
  type DimensionMode,
  type EditorAction,
  type EditorState,
} from '../editor/editor-state.js';

import { gridLabel, scaleLabel } from './status-bar-labels.js';

export interface StatusBarProps {
  readonly editor: EditorState;
  readonly dispatch: (action: EditorAction) => void;
  readonly levelName: string;
}

/** The snaps, in the order a drawing hand looks for them. */
const SNAPS = [
  ['grid', 'Grille'],
  ['endpoint', 'Extrémités'],
  ['midpoint', 'Milieux'],
  ['intersection', 'Intersections'],
] as const;

/**
 * Ce que le dessin fait, sur son bord bas.
 *
 * Ce ne sont pas des outils, et ils étaient parmi eux : le pas de grille, le
 * pas angulaire, les accrochages, l'échelle et la taille de la sélection sont
 * l'état de la vue — lus sans arrêt, changés rarement.
 *
 * Six cellules, dans l'ordre du §1 : où l'on est, à quel pas, ce qui accroche,
 * ce qui est d'équerre, ce que le plan cote tout seul, à quelle échelle, et où
 * est la souris. Les valeurs sont écrites comme on les lit — « 10 cm » et
 * « 1:50 », pas « 100 mm » et « 0,02 px/mm ».
 */
export function StatusBar({ editor, dispatch, levelName }: StatusBarProps) {
  const snap = editor.snap;
  /*
   * Le repli des réglages, ancré à la main.
   *
   * La barre défile — c'est ce qui la garde sur une rangée sur un téléphone —
   * et une boîte qui défile **rogne** ce qui en sort : le panneau était
   * dessiné, invisible, et le plan recevait les clics à sa place. Les sept
   * réglages étaient donc inatteignables à la souris.
   *
   * Il est donc posé en `fixed`, hors du défilement, à l'endroit où se trouve
   * son propre bouton. Rien n'est mémorisé : la position est relue du bouton
   * à chaque ouverture.
   */
  const snapsFold = useRef<HTMLDetailsElement>(null);
  const [snapsAt, setSnapsAt] = useState<
    { readonly left: number; readonly bottom: number } | undefined
  >(undefined);
  return (
    <div className="status-bar" role="group" aria-label="État du dessin">
      <span className="status-cell">{levelName}</span>
      <span className="status-cell" title="Pas de grille">
        grille {gridLabel(snap.gridSpacingMm)}
      </span>
      <label className="checkbox status-cell">
        <input
          type="checkbox"
          checked={snap.enabled}
          onChange={(event) =>
            dispatch({
              type: 'SET_SNAP',
              snap: { enabled: event.target.checked },
            })
          }
        />
        Accrochage
      </label>
      {/*
       * L'orthogonal a sa place à part.
       *
       * C'est le seul accrochage qu'on allume et qu'on éteint en dessinant —
       * les autres se règlent une fois. Le mettre avec eux sous « Réglages »
       * le rendait deux clics plus loin que ce qu'il vaut.
       *
       * Et il n'a même plus besoin qu'on l'éteigne : `Maj` tenue l'inverse le
       * temps d'un segment. La case reste, parce qu'un réglage qu'on ne peut
       * obtenir qu'en tenant une touche est un réglage qu'on tient pendant
       * une heure ; l'infobulle dit la touche, faute de quoi personne ne la
       * découvre.
       */}
      <label
        className="checkbox status-cell"
        title={
          snap.orthogonal
            ? 'Les angles suivent le pas angulaire. Maj tenue libère l’angle, le temps d’un segment.'
            : 'Les angles sont libres. Maj tenue les ramène au pas angulaire, le temps d’un segment.'
        }
      >
        <input
          type="checkbox"
          disabled={!snap.enabled}
          checked={snap.orthogonal}
          onChange={(event) =>
            dispatch({
              type: 'SET_SNAP',
              snap: { orthogonal: event.target.checked },
            })
          }
        />
        Ortho
      </label>
      {/*
       * Les sept réglages de l'accrochage, repliés.
       *
       * Cinq cases, un pas de grille et un pas angulaire faisaient passer la
       * barre d'état à deux rangées — 81 px sur un portable — pour des valeurs
       * qu'on règle une fois et qu'on relit rarement. Elles restent à un clic,
       * et la barre tient sur sa rangée.
       */}
      <details
        ref={snapsFold}
        className="status-cell status-snaps"
        onToggle={(event) => {
          if (!event.currentTarget.open) {
            setSnapsAt(undefined);
            return;
          }
          const at = snapsFold.current?.getBoundingClientRect();
          if (at === undefined) return;
          setSnapsAt({
            left: at.left,
            bottom: window.innerHeight - at.top + 6,
          });
        }}
      >
        <summary>Réglages</summary>
        <div
          className="status-snaps-list panel"
          {...(snapsAt === undefined
            ? {}
            : {
                style: {
                  left: `${snapsAt.left}px`,
                  bottom: `${snapsAt.bottom}px`,
                },
              })}
        >
          {SNAPS.map(([key, label]) => (
            <label key={key} className="checkbox">
              <input
                type="checkbox"
                disabled={!snap.enabled}
                checked={snap[key]}
                onChange={(event) =>
                  dispatch({
                    type: 'SET_SNAP',
                    snap: { [key]: event.target.checked },
                  })
                }
              />
              {label}
            </label>
          ))}
          <label className="status-number">
            Pas
            <input
              type="number"
              min={1}
              step={10}
              value={snap.gridSpacingMm}
              aria-label="Pas de grille en millimètres"
              onChange={(event) => {
                const gridSpacingMm = Number(event.target.value);
                // A grid of zero is not a grid; the field keeps what it had.
                if (Number.isFinite(gridSpacingMm) && gridSpacingMm > 0)
                  dispatch({ type: 'SET_SNAP', snap: { gridSpacingMm } });
              }}
            />
            mm
          </label>
          <label className="status-number">
            Angle
            <input
              type="number"
              min={1}
              max={90}
              step={5}
              value={snap.angleStepDeg}
              aria-label="Pas angulaire en degrés"
              onChange={(event) => {
                const angleStepDeg = Number(event.target.value);
                if (Number.isFinite(angleStepDeg) && angleStepDeg > 0)
                  dispatch({ type: 'SET_SNAP', snap: { angleStepDeg } });
              }}
            />
            °
          </label>
          {/*
           * Les deux touches qu'on tient, écrites là où elles agissent.
           *
           * Elles ne sont pas dans la palette de commandes, et c'est juste :
           * une touche tenue ne déclenche rien, elle change le sens du geste
           * en cours. Mais elle ne s'apprend nulle part non plus, et le
           * panoramique s'apprenait jusqu'ici en tenant `Maj` par hasard.
           * Le repli des réglages d'accrochage est l'endroit où l'on vient
           * quand on cherche comment le dessin se contraint.
           */}
          <p className="status-help">
            <strong>Maj</strong> tenue inverse la contrainte d'angle, le temps
            d'un segment. <strong>Espace</strong> tenue, ou le bouton du milieu,
            fait glisser le plan.
          </p>
        </div>
      </details>
      <label className="status-cell status-number">
        Cotes
        <select
          value={editor.dimensionMode}
          aria-label="Cotes automatiques"
          onChange={(event) =>
            dispatch({
              type: 'SET_DIMENSION_MODE',
              mode: event.target.value as DimensionMode,
            })
          }
        >
          {DIMENSION_MODES.map((mode) => (
            <option key={mode} value={mode}>
              {DIMENSION_MODE_LABELS[mode]}
            </option>
          ))}
        </select>
      </label>
      <span className="status-cell" title="Échelle approchée à l’écran">
        ≈ {scaleLabel(editor.camera.pixelsPerMm)}
      </span>
      <span className="status-cell">
        {editor.cursorModel === undefined
          ? 'x — y —'
          : `x ${(editor.cursorModel.x / 1000).toFixed(2)} y ${(
              editor.cursorModel.y / 1000
            ).toFixed(2)} m`}
      </span>
      <span className="status-cell">
        {editor.selection.length === 0
          ? 'aucune sélection'
          : `${editor.selection.length} sélectionné(s)`}
      </span>
    </div>
  );
}
