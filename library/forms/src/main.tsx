import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import './index.css';
import App from './App';
import uiSpec from './sample-notebook.json';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {EncodedUISpecification} from '@faims3/data-model/build/src/types';

const queryClient = new QueryClient({});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App uiSpec={uiSpec['ui-specification'] as EncodedUISpecification} />
    </QueryClientProvider>
  </StrictMode>
);
