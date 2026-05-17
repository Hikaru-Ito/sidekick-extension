import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@sidekick/ui-kit/styles.css';
import { OptionsApp } from './App';

const container = document.getElementById('root');
if (!container) throw new Error('Root element not found');
createRoot(container).render(
  <StrictMode>
    <OptionsApp />
  </StrictMode>,
);
