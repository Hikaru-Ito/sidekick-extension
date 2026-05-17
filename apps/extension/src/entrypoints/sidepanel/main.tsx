import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@sidekick/ui-kit/styles.css';
import './sidepanel.css';
import { SidePanelShell } from './Shell';

const container = document.getElementById('root');
if (!container) throw new Error('Root element not found');
createRoot(container).render(
  <StrictMode>
    <SidePanelShell />
  </StrictMode>,
);
