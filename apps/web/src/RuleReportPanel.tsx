import type { RuleReport } from '@house-technical-designer/rule-engine';

const statusLabels = {
  PASS: 'Validé',
  FAIL: 'Écart',
  UNKNOWN: 'Non vérifiable',
  NOT_APPLICABLE: 'Non applicable',
} as const;

export function RuleReportPanel({
  report,
  onLocate,
}: {
  readonly report: RuleReport;
  readonly onLocate?: (objectIds: readonly string[]) => void;
}) {
  const { summary } = report;
  // Several packs can be reported side by side, so the heading each panel is
  // labelled by has to be its own.
  const titleId = `rule-title-${report.packId}`;
  return (
    <section className="rule-panel" aria-labelledby={titleId}>
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Référentiel actif</p>
          <h2 id={titleId}>Contrôles et preuves</h2>
        </div>
        <span className={`coverage coverage-${summary.coverage.toLowerCase()}`}>
          Couverture{' '}
          {summary.coverage === 'COMPLETE' ? 'complète' : 'partielle'}
        </span>
      </div>
      <p className="pack-version">
        {report.packId} · version {report.packVersion}
      </p>
      <dl className="rule-summary">
        <Summary
          label="Contrôles"
          value={`${summary.checked}/${summary.total}`}
        />
        <Summary label="Validés" value={summary.pass} />
        <Summary label="Écarts" value={summary.fail} />
        <Summary label="Non vérifiables" value={summary.unknown} />
      </dl>
      <div className="rule-list">
        {report.items.map(({ result, references }) => (
          <article
            className={`rule-card status-${result.status.toLowerCase()}`}
            key={`${result.ruleId}:${result.objectIds.join(',')}`}
          >
            <header>
              <span className="status-dot" aria-hidden="true" />
              <strong>{statusLabels[result.status]}</strong>
              <code>{result.ruleId}</code>
            </header>
            <p>{result.message}</p>
            {result.objectIds.length > 0 && (
              <p className="objects">
                Objets : {result.objectIds.join(', ')}
                {onLocate !== undefined && (
                  <button
                    type="button"
                    className="link"
                    onClick={() => onLocate(result.objectIds)}
                  >
                    Localiser
                  </button>
                )}
              </p>
            )}
            {result.evidence !== undefined && (
              <details>
                <summary>Afficher la preuve</summary>
                <pre>{JSON.stringify(result.evidence, null, 2)}</pre>
              </details>
            )}
            {references.map((reference) => (
              <p className="reference" key={reference.id}>
                Source :{' '}
                {reference.url === undefined ? (
                  reference.title
                ) : (
                  <a href={reference.url} target="_blank" rel="noreferrer">
                    {reference.title}
                  </a>
                )}
              </p>
            ))}
            {result.suggestion !== undefined && (
              <aside className="suggestion">
                <strong>Suggestion</strong>
                {result.suggestion.description}
              </aside>
            )}
          </article>
        ))}
      </div>
      <p className="coverage-note">
        Ce panneau décrit les contrôles exécutés ; il ne constitue pas une
        déclaration de conformité globale.
      </p>
    </section>
  );
}

function Summary({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string | number;
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
