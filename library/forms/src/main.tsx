import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import './index.css';
import App from './App';
import project from './sample-notebook.json';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App project={project} />
  </StrictMode>
);
