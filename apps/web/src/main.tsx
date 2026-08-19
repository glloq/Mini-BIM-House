import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './styles.css';

function App() {
  return (
    <main>
      <p className="eyebrow">Mini BIM local-first</p>
      <h1>House Technical Designer</h1>
      <p>Le socle de conception technique de votre habitation est prêt.</p>
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
