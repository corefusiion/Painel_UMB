// Detecta dinamicamente se está em ambiente de desenvolvimento local (Vite: 8080)
// ou produção corporativa (OpenShift / Docker / portas padrão)
const isLocalDev = typeof window !== 'undefined' && window.location.port === '8080';
const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';

export const API_URL = isLocalDev 
  ? `http://${hostname}:3001/api` 
  : `/api`;

export const SANEAIA_API_URL = isLocalDev 
  ? `http://${hostname}:8000/api` 
  : `/api/saneaia`;

