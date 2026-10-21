import '@fontsource-variable/manrope';
import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { consultas } from './api';
import { App } from './App';
import './estilos.css';
import { Avisos } from './pecas';

createRoot(document.getElementById('raiz')!).render(
  <StrictMode>
    <QueryClientProvider client={consultas}>
      <Avisos>
        <App />
      </Avisos>
    </QueryClientProvider>
  </StrictMode>,
);
