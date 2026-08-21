import type {
  Project,
  ProjectSheet,
  SavedDrawingView,
} from '@house-technical-designer/core-domain';
import {
  validateDrawingView,
  validateSheet,
} from '@house-technical-designer/core-domain';
import type { CommandValidation } from './commands.js';
import type {
  ProjectCommand,
  ProjectCommandExecution,
} from './project-commands.js';

const DOCUMENT_DOMAINS = ['drawing-overlays'] as const;

function ok(): CommandValidation {
  return { valid: true };
}

function rejected(...errors: readonly string[]): CommandValidation {
  return { valid: false, errors: [...errors] };
}

/**
 * Restores the whole drawing set.
 *
 * Views and sheets refer to one another, so undoing one change by replaying
 * its opposite would let a sheet stand for a moment naming a view that is not
 * there yet. Putting both lists back as they were cannot.
 */
class RestoreDocumentsCommand implements ProjectCommand {
  constructor(
    readonly id: string,
    readonly label: string,
    private readonly views: readonly SavedDrawingView[] | undefined,
    private readonly sheets: readonly ProjectSheet[] | undefined,
  ) {}
  validate(): CommandValidation {
    return ok();
  }
  execute(project: Project): ProjectCommandExecution {
    const previousViews = project.drawingViews;
    const previousSheets = project.sheets;
    const { drawingViews: _views, sheets: _sheets, ...rest } = project;
    return {
      nextState: {
        ...rest,
        ...(this.views === undefined ? {} : { drawingViews: this.views }),
        ...(this.sheets === undefined ? {} : { sheets: this.sheets }),
      },
      changes: { objectIds: [this.id], domains: [...DOCUMENT_DOMAINS] },
      inverse: new RestoreDocumentsCommand(
        `${this.id}:inverse`,
        `Undo ${this.label}`,
        previousViews,
        previousSheets,
      ),
    };
  }
}

abstract class DocumentCommand implements ProjectCommand {
  constructor(
    readonly id: string,
    readonly label: string,
  ) {}
  abstract validate(project: Project): CommandValidation;
  protected abstract apply(project: Project): Project;
  execute(project: Project): ProjectCommandExecution {
    return {
      nextState: this.apply(project),
      changes: { objectIds: [this.id], domains: [...DOCUMENT_DOMAINS] },
      inverse: new RestoreDocumentsCommand(
        `${this.id}:inverse`,
        `Undo ${this.label}`,
        project.drawingViews,
        project.sheets,
      ),
    };
  }
}

export class SaveDrawingViewCommand extends DocumentCommand {
  constructor(readonly view: SavedDrawingView) {
    super(`view:save:${view.id}`, `Enregistrer la vue ${view.name}`);
  }
  validate(project: Project): CommandValidation {
    const issues = validateDrawingView(this.view);
    if (issues.length > 0) return rejected(...issues);
    if (
      this.view.levelId !== undefined &&
      !project.building.levels.some(({ id }) => id === this.view.levelId)
    )
      return rejected(`Le niveau ${this.view.levelId} est introuvable.`);
    return ok();
  }
  protected apply(project: Project): Project {
    const existing = project.drawingViews ?? [];
    const replaced = existing.some(({ id }) => id === this.view.id);
    return {
      ...project,
      drawingViews: replaced
        ? existing.map((view) => (view.id === this.view.id ? this.view : view))
        : [...existing, this.view],
    };
  }
}

export class RemoveDrawingViewCommand extends DocumentCommand {
  constructor(readonly viewId: string) {
    super(`view:remove:${viewId}`, 'Supprimer une vue');
  }
  validate(project: Project): CommandValidation {
    if (!(project.drawingViews ?? []).some(({ id }) => id === this.viewId))
      return rejected(`La vue ${this.viewId} est introuvable.`);
    // A sheet naming a view that is gone is a sheet nothing can print.
    const holders = (project.sheets ?? []).filter((sheet) =>
      sheet.viewports.some(({ viewId }) => viewId === this.viewId),
    );
    return holders.length === 0
      ? ok()
      : rejected(
          `La vue ${this.viewId} est posée sur ${holders.length} feuille(s) : ${holders
            .map(({ number }) => number)
            .join(', ')}.`,
        );
  }
  protected apply(project: Project): Project {
    return {
      ...project,
      drawingViews: (project.drawingViews ?? []).filter(
        ({ id }) => id !== this.viewId,
      ),
    };
  }
}

export class SaveSheetCommand extends DocumentCommand {
  constructor(readonly sheet: ProjectSheet) {
    super(`sheet:save:${sheet.id}`, `Enregistrer la feuille ${sheet.number}`);
  }
  validate(project: Project): CommandValidation {
    const issues = validateSheet(this.sheet);
    if (issues.length > 0) return rejected(...issues);
    const views = new Set((project.drawingViews ?? []).map(({ id }) => id));
    const missing = this.sheet.viewports
      .map(({ viewId }) => viewId)
      .filter((viewId) => !views.has(viewId));
    if (missing.length > 0)
      return rejected(
        `Cette feuille désigne des vues introuvables : ${missing.join(', ')}.`,
      );
    const clash = (project.sheets ?? []).find(
      (sheet) =>
        sheet.id !== this.sheet.id && sheet.number === this.sheet.number,
    );
    return clash === undefined
      ? ok()
      : rejected(
          `Le numéro ${this.sheet.number} est déjà porté par une autre feuille.`,
        );
  }
  protected apply(project: Project): Project {
    const existing = project.sheets ?? [];
    const replaced = existing.some(({ id }) => id === this.sheet.id);
    return {
      ...project,
      sheets: replaced
        ? existing.map((sheet) =>
            sheet.id === this.sheet.id ? this.sheet : sheet,
          )
        : [...existing, this.sheet],
    };
  }
}

export class RemoveSheetCommand extends DocumentCommand {
  constructor(readonly sheetId: string) {
    super(`sheet:remove:${sheetId}`, 'Supprimer une feuille');
  }
  validate(project: Project): CommandValidation {
    return (project.sheets ?? []).some(({ id }) => id === this.sheetId)
      ? ok()
      : rejected(`La feuille ${this.sheetId} est introuvable.`);
  }
  protected apply(project: Project): Project {
    return {
      ...project,
      sheets: (project.sheets ?? []).filter(({ id }) => id !== this.sheetId),
    };
  }
}
