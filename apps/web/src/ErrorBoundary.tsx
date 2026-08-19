import { Component, type ErrorInfo, type ReactNode } from 'react';

export interface DiagnosticReport {
  readonly message: string;
  readonly stack?: string;
  readonly componentStack?: string;
  readonly userAgent: string;
  readonly occurredAt: string;
  readonly applicationVersion: string;
  readonly projectId?: string;
  readonly schemaVersion?: string;
}

export interface ErrorBoundaryProps {
  readonly children: ReactNode;
  readonly applicationVersion: string;
  /** Identity of the open project; never its contents. */
  readonly projectId?: string;
  readonly schemaVersion?: string;
  readonly onDownloadDiagnostic: (report: DiagnosticReport) => void;
}

interface ErrorBoundaryState {
  readonly error?: Error;
  readonly componentStack?: string;
}

/**
 * Catches a rendering failure so the application shows what happened instead of
 * a blank page.
 *
 * The diagnostic it offers carries the error and the environment, never the
 * project: a crash report should not quietly hand over someone's design.
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  override state: ErrorBoundaryState = {};

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    this.setState({
      error,
      ...(info.componentStack === null || info.componentStack === undefined
        ? {}
        : { componentStack: info.componentStack }),
    });
  }

  private report(): DiagnosticReport {
    const { error, componentStack } = this.state;
    return {
      message: error?.message ?? 'Erreur inconnue',
      ...(error?.stack === undefined ? {} : { stack: error.stack }),
      ...(componentStack === undefined ? {} : { componentStack }),
      userAgent: navigator.userAgent,
      occurredAt: new Date().toISOString(),
      applicationVersion: this.props.applicationVersion,
      ...(this.props.projectId === undefined
        ? {}
        : { projectId: this.props.projectId }),
      ...(this.props.schemaVersion === undefined
        ? {}
        : { schemaVersion: this.props.schemaVersion }),
    };
  }

  override render(): ReactNode {
    if (this.state.error === undefined) return this.props.children;
    return (
      <main className="workspace">
        <section className="panel crash-panel" role="alert">
          <h1>Une erreur inattendue est survenue</h1>
          <p>
            L’interface s’est arrêtée, mais votre projet n’a pas été modifié.
            Une sauvegarde locale est conservée dans ce navigateur : rechargez
            la page pour la retrouver.
          </p>
          <pre className="crash-detail">{this.state.error.message}</pre>
          <div className="actions">
            <button
              type="button"
              onClick={() => this.props.onDownloadDiagnostic(this.report())}
            >
              Exporter un diagnostic
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => window.location.reload()}
            >
              Recharger l’application
            </button>
          </div>
          <p className="notice">
            Le diagnostic contient le message d’erreur, la version de
            l’application et celle de votre navigateur. Il ne contient pas votre
            projet.
          </p>
        </section>
      </main>
    );
  }
}
