/**
 * L'étage sur lequel on dessine, en permanence.
 *
 * La rangée vivait en tête de l'arborescence, et l'arborescence est passée
 * sous « Ajouter », derrière un dépliage. Le reste de l'arborescence raconte
 * ce que le projet contient — on l'ouvre quand on cherche quelque chose ;
 * l'étage courant, lui, n'est pas un contenu : c'est **où va ce qu'on trace**.
 * Le ranger d'un cran ferait payer deux clics une question qu'on se pose à
 * chaque objet.
 *
 * Elle n'est écrite qu'ici : l'arborescence ne la redessine pas.
 */
import type { Project } from '@house-technical-designer/core-domain';

export interface LevelRowProps {
  readonly project: Project;
  readonly levelId?: string;
  readonly onSelectLevel: (levelId: string) => void;
}

export function LevelRow({ project, levelId, onSelectLevel }: LevelRowProps) {
  const levels = project.building.levels;
  // Un seul niveau ne se choisit pas : la rangée serait un bouton mort au-
  // dessus des outils, et la hauteur qu'elle prend est celle du plan.
  if (levels.length < 2) return null;
  const active = levels.find(({ id }) => id === levelId) ?? levels[0];
  return (
    <div className="tree-levels" role="group" aria-label="Niveaux">
      {levels.map((level) => (
        <button
          key={level.id}
          type="button"
          className={level.id === active?.id ? 'tree-active' : undefined}
          aria-current={level.id === active?.id ? 'true' : undefined}
          onClick={() => onSelectLevel(level.id)}
        >
          {level.name}
        </button>
      ))}
    </div>
  );
}
