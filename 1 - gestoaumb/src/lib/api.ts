// Detecta dinamicamente o IP da máquina hospedeira
const hostname = window.location.hostname;
export const API_URL = `http://${hostname}:3001/api`;
