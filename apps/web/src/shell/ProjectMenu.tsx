/**
 * Ce qu'on fait au fichier, replié sous un mot.
 *
 * Nouveau, ouvrir, enregistrer, exporter et la maison de démonstration
 * occupaient six boutons d'une barre qui passait à la ligne, soit cent
 * quarante-quatre pixels d'écran sur un portable pour six gestes qu'on fait
 * une fois par séance. Un fichier n'est pas un lieu ; c'est un menu.
 *
 * Il s'appelle « Fichier » et non « Projet » : « Projet » est déjà un espace
 * de travail dans le rail, et deux choses du même nom sont une chose de trop.
 */
import { useEffect, useRef, useState } from 'react';

export interface ProjectMenuItem {
  readonly id: string;
  readonly label: string;
  /** Ce que l'entrée fait, quand son libellé ne suffit pas. */
  readonly hint?: string;
}

export interface ProjectMenuProps {
  readonly items: readonly ProjectMenuItem[];
  readonly onSelect: (id: string) => void;
}

export function ProjectMenu({ items, onSelect }: ProjectMenuProps) {
  const [open, setOpen] = useState(false);
  const holder = useRef<HTMLDivElement>(null);

  // Un menu qui reste ouvert quand on regarde ailleurs est un menu qu'il faut
  // penser à fermer.
  useEffect(() => {
    if (!open) return undefined;
    const close = (event: MouseEvent): void => {
      if (!holder.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  return (
    <div className="project-menu" ref={holder}>
      <button
        type="button"
        className="secondary"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((current) => !current)}
      >
        Fichier ▾
      </button>
      {open && (
        <div className="project-menu-list panel" role="menu">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              className="ghost"
              {...(item.hint === undefined ? {} : { title: item.hint })}
              onClick={() => {
                setOpen(false);
                onSelect(item.id);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
