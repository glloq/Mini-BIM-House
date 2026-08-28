import { useMemo } from 'react';
import type { Project } from '@house-technical-designer/core-domain';
import { safeFileStem } from '../project-workspace.js';
import { bomToCsv, buildBom } from './bom-model.js';

const LOT_LABELS: Readonly<Record<string, string>> = {
  STRUCTURE: 'Structure',
  INSULATION: 'Isolation',
  FINISHES: 'Finitions',
  ENVELOPE: 'Enveloppe',
  OTHER: 'Autre',
};

export interface QuantitiesPanelProps {
  readonly project: Project;
  readonly onSelectObjects: (objectIds: readonly string[]) => void;
  readonly onExportCsv: (content: string, fileName: string) => void;
}

export function QuantitiesPanel({
  project,
  onSelectObjects,
  onExportCsv,
}: QuantitiesPanelProps) {
  const report = useMemo(() => buildBom(project), [project]);

  return (
    <section className="library-panel" aria-labelledby="quantities-heading">
      <header className="panel-heading">
        <div>
          <p className="panel-label">Quantités</p>
          <h2 id="quantities-heading">Nomenclature</h2>
        </div>
        <div className="actions">
          <button
            type="button"
            className="secondary"
            disabled={report.lines.length === 0}
            {...(report.lines.length === 0
              ? {
                  title:
                    'La nomenclature est vide : rien de ce qui est dessiné ne porte encore de matière.',
                }
              : {})}
            onClick={() =>
              onExportCsv(
                bomToCsv(report),
                `${safeFileStem(project.metadata.name)}-nomenclature.csv`,
              )
            }
          >
            Exporter en CSV
          </button>
        </div>
      </header>

      <div className="dashboard-cards" role="list">
        <div className="dashboard-card" role="listitem">
          <span className="dashboard-card-label">Lignes</span>
          <span className="dashboard-card-value">{report.lines.length}</span>
        </div>
        <div className="dashboard-card" role="listitem">
          <span className="dashboard-card-label">Masse totale</span>
          <span className="dashboard-card-value">
            {report.totalMassKg === undefined
              ? '—'
              : Math.round(report.totalMassKg).toLocaleString('fr-FR')}
            <small> kg</small>
          </span>
          {report.missingDensities.length > 0 && (
            <span className="hint">
              {report.missingDensities.length} matériau(x) sans masse volumique
            </span>
          )}
        </div>
        <div className="dashboard-card" role="listitem">
          <span className="dashboard-card-label">Coût matériaux</span>
          <span className="dashboard-card-value">
            {report.totalCost === undefined
              ? '—'
              : Math.round(report.totalCost).toLocaleString('fr-FR')}
            <small> {report.currency}</small>
          </span>
          {report.missingPrices.length > 0 && (
            <span className="hint">
              {report.missingPrices.length} matériau(x) sans prix
            </span>
          )}
        </div>
        <div className="dashboard-card" role="listitem">
          <span className="dashboard-card-label">Carbone</span>
          <span className="dashboard-card-value">
            {report.totalCarbonKgCo2e === undefined
              ? '—'
              : Math.round(report.totalCarbonKgCo2e).toLocaleString('fr-FR')}
            <small> kgCO2e</small>
          </span>
          {report.missingImpacts.length > 0 && (
            <span className="hint">
              {report.missingImpacts.length} matériau(x) sans facteur
            </span>
          )}
        </div>
      </div>

      <div className="table-scroll">
        <table className="library-table">
          <caption className="visually-hidden">
            Nomenclature des matériaux, par lot puis par matériau
          </caption>
          <thead>
            <tr>
              <th scope="col">Matériau</th>
              <th scope="col">Lot</th>
              <th scope="col">Niveau</th>
              <th scope="col">Net (m³)</th>
              <th scope="col">Déchets</th>
              <th scope="col">Achat (m³)</th>
              <th scope="col">Masse (kg)</th>
              <th scope="col">Coût</th>
              <th scope="col">Carbone</th>
              <th scope="col">Objets</th>
            </tr>
          </thead>
          <tbody>
            {report.lines.map((line) => (
              <tr key={`${line.materialId}:${line.levelName}`}>
                <th scope="row">
                  {line.materialName}
                  <span className="hint">{line.source}</span>
                </th>
                <td>{LOT_LABELS[line.lot] ?? line.lot}</td>
                <td>{line.levelName}</td>
                <td>{line.netVolumeM3.toFixed(3)}</td>
                <td>{(line.wasteFactor * 100).toFixed(0)} %</td>
                <td>{line.purchaseVolumeM3.toFixed(3)}</td>
                <td>
                  {line.massKg === undefined ? (
                    <span className="badge missing">inconnue</span>
                  ) : (
                    Math.round(line.massKg)
                  )}
                </td>
                <td>
                  {line.cost === undefined ? (
                    <span className="badge missing">sans prix</span>
                  ) : (
                    `${line.cost.toFixed(0)} ${line.currency}`
                  )}
                </td>
                <td>
                  {line.carbonKgCo2e === undefined ? (
                    <span className="badge missing">sans facteur</span>
                  ) : (
                    Math.round(line.carbonKgCo2e)
                  )}
                </td>
                <td>
                  <button
                    type="button"
                    className="link"
                    onClick={() => onSelectObjects(line.sourceEntityIds)}
                  >
                    {line.sourceEntityIds.length} objet(s)
                  </button>
                </td>
              </tr>
            ))}
            {report.lines.length === 0 && (
              <tr>
                <td colSpan={10}>
                  Aucun métré : ce projet ne contient pas encore de mur dont
                  l’assemblage et la hauteur soient résolus.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {report.warnings.length > 0 && (
        <section>
          <h3>Avertissements du métré</h3>
          <ul className="alert-list">
            {report.warnings.map((warning, index) => (
              <li key={`${warning.code}:${index}`}>
                <span className="badge missing">{warning.code}</span>
                <span>{warning.message}</span>
                <button
                  type="button"
                  className="link"
                  onClick={() => onSelectObjects([warning.sourceEntityId])}
                >
                  Localiser
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="notice">
        Les quantités sont dérivées de la géométrie et des assemblages. Les prix
        et les facteurs d’impact viennent des réglages de calcul du projet : un
        matériau qu’ils ne couvrent pas garde sa quantité et reste explicitement
        non valorisé.
      </p>
    </section>
  );
}
