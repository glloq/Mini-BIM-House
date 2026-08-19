import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './styles.css';
import {
  buildRuleReport,
  type RulePack,
  type RuleResult,
} from '@house-technical-designer/rule-engine';
import { RuleReportPanel } from './RuleReportPanel.js';

const demoPack: RulePack = {
  id: 'demo-envelope',
  version: '2026.1',
  jurisdiction: { country: 'FR', domain: 'THERMAL' },
  validity: { from: '2026-01-01' },
  references: [
    { id: 'method', type: 'GUIDELINE', title: 'Méthode thermique du projet' },
  ],
  rules: [
    {
      id: 'ENVELOPE_DATA',
      severity: 'WARNING',
      appliesTo: 'Wall',
      referenceIds: ['method'],
      evaluator: {
        type: 'DECLARATIVE',
        expression: { op: 'exists', path: 'lambdaWmK' },
      },
    },
    {
      id: 'OPENINGS_REVIEW',
      severity: 'INFO',
      appliesTo: 'Opening',
      referenceIds: ['method'],
      evaluator: {
        type: 'DECLARATIVE',
        expression: { op: 'exists', path: 'uwWm2K' },
      },
    },
  ],
};
const demoResults: readonly RuleResult[] = [
  {
    ruleId: 'ENVELOPE_DATA',
    status: 'UNKNOWN',
    severity: 'WARNING',
    objectIds: ['wall-north'],
    message: 'La conductivité d’une couche du mur nord est inconnue.',
    referenceIds: ['method'],
    evidence: { path: 'assembly.layers[2].material.lambdaWmK', value: null },
    suggestion: {
      type: 'TEXT',
      description: 'Renseigner une valeur sourcée dans le catalogue matériaux.',
    },
  },
];

function App() {
  return (
    <main className="workspace">
      <header className="app-header">
        <div>
          <p className="eyebrow">Mini BIM local-first</p>
          <h1>House Technical Designer</h1>
        </div>
        <span className="project-chip">Maison exemple</span>
      </header>
      <RuleReportPanel report={buildRuleReport(demoPack, demoResults)} />
    </main>
  );
}

const root = document.querySelector<HTMLElement>('#root');

if (root === null) {
  throw new Error('Unable to find the application root');
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
