import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import './index.css';
import App from './App';
import sampleNotebook from './sample-notebook.json';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import type {NotebookDefinition} from '@faims3/data-model';
import {initialiseMaps} from '../lib/components/maps';

const queryClient = new QueryClient({});

initialiseMaps();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App notebookDefinition={sampleNotebook as NotebookDefinition} />
    </QueryClientProvider>
  </StrictMode>
);
