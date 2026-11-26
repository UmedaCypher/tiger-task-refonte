import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/bricolage-grotesque/opsz.css';
import '../styles.css';
import './admin.css';
import { Admin } from './Admin';

document.documentElement.dataset.theme = 'day';
document.documentElement.dataset.excel = 'off';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Admin />
  </StrictMode>,
);
