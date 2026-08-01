import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { patchFetchForClientFallback } from './lib/clientApi.ts';

// Patch fetch to handle static hosting (e.g. Netlify) with direct client & Firebase support
patchFetchForClientFallback();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

