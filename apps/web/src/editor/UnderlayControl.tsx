/**
 * Poser, cadrer et retirer le calque de papier.
 *
 * Trois réglages et pas un de plus : ce que l'image mesure en largeur, où est
 * son coin, et à quel point elle transparaît. Le reste — son rapport, sa
 * hauteur — se lit du fichier : personne ne connaît la hauteur d'un cadastre,
 * tout le monde connaît la longueur d'une façade.
 *
 * Il vit dans l'espace du terrain, contre le plan, parce que c'est en
 * regardant le dessin qu'on cale un relevé — jamais dans un formulaire d'un
 * autre écran.
 */
import { useRef, useState } from 'react';
import type {
  Project,
  SiteUnderlay,
} from '@house-technical-designer/core-domain';
import {
  SetSiteUnderlayCommand,
  type ProjectCommand,
} from '@house-technical-designer/editor-core';

import { underlayAtWidth, underlayFromFile } from './underlay-file.js';

export interface UnderlayControlProps {
  readonly project: Project;
  readonly onCommand: (command: ProjectCommand) => boolean;
  readonly onMessage: (message: string) => void;
  /** Où poser le coin de l'image : le centre de ce qu'on regarde. */
  readonly originMm: { readonly x: number; readonly y: number };
}

const metres = (millimetres: number): string =>
  (millimetres / 1000).toFixed(2).replace('.', ',');

export function UnderlayControl({
  project,
  onCommand,
  onMessage,
  originMm,
}: UnderlayControlProps) {
  const picker = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const underlay = project.site.underlay;

  const set = (next: SiteUnderlay | undefined): void => {
    onCommand(new SetSiteUnderlayCommand(next));
  };

  const load = async (file: File | undefined): Promise<void> => {
    if (file === undefined) return;
    const result = await underlayFromFile(file, { originMm });
    if (result.status === 'ERROR') {
      onMessage(result.message);
      return;
    }
    set(result.underlay);
    setOpen(true);
  };

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
            title={underlay.name ?? 'Image de fond'}
            onClick={() => setOpen((current) => !current)}
          >
            Fond · {metres(underlay.widthMm)} m
          </button>
          {open && (
            <div className="underlay-settings panel">
              <label>
                <span>
                  Largeur <small>(m)</small>
                </span>
                <input
                  type="number"
                  min={0.1}
                  step={0.5}
                  value={Number((underlay.widthMm / 1000).toFixed(2))}
                  aria-label="Largeur de l’image en mètres"
                  onChange={(event) => {
                    const wanted = Number(event.target.value) * 1000;
                    if (wanted > 0) set(underlayAtWidth(underlay, wanted));
                  }}
                />
              </label>
              <label>
                <span>Transparence</span>
                <input
                  type="range"
                  min={5}
                  max={100}
                  step={5}
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
              {/* Le coin, en mètres : caler un relevé se fait au nombre quand
                  l'œil ne suffit plus. */}
              {(['x', 'y'] as const).map((axis) => (
                <label key={axis}>
                  <span>
                    Coin {axis.toUpperCase()} <small>(m)</small>
                  </span>
                  <input
                    type="number"
                    step={0.5}
                    value={Number((underlay.originMm[axis] / 1000).toFixed(2))}
                    aria-label={`Coin ${axis.toUpperCase()} de l’image en mètres`}
                    onChange={(event) => {
                      const at = Number(event.target.value) * 1000;
                      if (Number.isFinite(at))
                        set({
                          ...underlay,
                          originMm: { ...underlay.originMm, [axis]: at },
                        });
                    }}
                  />
                </label>
              ))}
              <div className="underlay-actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => picker.current?.click()}
                >
                  Remplacer
                </button>
                <button
                  type="button"
                  className="secondary"
                  // Elle n'emporte rien : ce n'est pas un objet du modèle.
                  onClick={() => {
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
