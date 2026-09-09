/**
 * Utilitário de geocodificação por CEP usando APIs brasileiras rápidas
 * Prioridade: BrasilAPI > AwesomeAPI > Fallback
 */

export interface GeocodingResult {
  lat: number;
  lng: number;
  found: boolean;
}

// Cache em memória para evitar requisições repetidas
const geocodeCache: Map<string, GeocodingResult> = new Map();

// Cache para bairros geocodificados
const bairroCache: Map<string, GeocodingResult> = new Map();

// Coordenadas do centro de Salvador como fallback
const SALVADOR_CENTER: GeocodingResult = { lat: -12.9711, lng: -38.5014, found: false };

/**
 * Formata CEP para busca (41705670 -> 41705-670)
 */
export function formatCep(cep: string): string {
  const cleaned = cep.replace(/\D/g, '');
  if (cleaned.length === 8) {
    return `${cleaned.slice(0, 5)}-${cleaned.slice(5)}`;
  }
  return cleaned;
}

/**
 * Limpa CEP para uso em APIs (remove hífen e espaços)
 */
function cleanCep(cep: string): string {
  return cep.replace(/\D/g, '');
}

/**
 * Tenta geocodificar via BrasilAPI (mais rápida e confiável)
 */
async function tryBrasilAPI(cep: string, signal: AbortSignal): Promise<GeocodingResult | null> {
  try {
    const response = await fetch(
      `https://brasilapi.com.br/api/cep/v2/${cep}`,
      { signal, headers: { 'Accept': 'application/json' } }
    );
    
    if (!response.ok) return null;
    
    const data = await response.json();
    
    if (data.location?.coordinates?.latitude && data.location?.coordinates?.longitude) {
      return {
        lat: parseFloat(data.location.coordinates.latitude),
        lng: parseFloat(data.location.coordinates.longitude),
        found: true,
      };
    }
  } catch {
    // Silently fail, try next API
  }
  return null;
}

/**
 * Tenta geocodificar via AwesomeAPI (fallback rápido)
 */
async function tryAwesomeAPI(cep: string, signal: AbortSignal): Promise<GeocodingResult | null> {
  try {
    const response = await fetch(
      `https://cep.awesomeapi.com.br/json/${cep}`,
      { signal, headers: { 'Accept': 'application/json' } }
    );
    
    if (!response.ok) return null;
    
    const data = await response.json();
    
    if (data.lat && data.lng) {
      return {
        lat: parseFloat(data.lat),
        lng: parseFloat(data.lng),
        found: true,
      };
    }
  } catch {
    // Silently fail
  }
  return null;
}

/**
 * Geocodifica um CEP usando APIs brasileiras rápidas
 * Retorna coordenadas precisas ou fallback para centro de Salvador
 */
export async function geocodeByCep(cep: string): Promise<GeocodingResult> {
  if (!cep || cep.length < 8) {
    return SALVADOR_CENTER;
  }
  
  const cleanedCep = cleanCep(cep);
  const formattedCep = formatCep(cep);
  
  // Verificar cache primeiro
  if (geocodeCache.has(formattedCep)) {
    return geocodeCache.get(formattedCep)!;
  }
  
  // Timeout de 3 segundos
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000);
  
  try {
    // Tentar BrasilAPI primeiro (mais rápida)
    let result = await tryBrasilAPI(cleanedCep, controller.signal);
    
    // Se falhou, tentar AwesomeAPI
    if (!result) {
      result = await tryAwesomeAPI(cleanedCep, controller.signal);
    }
    
    clearTimeout(timeoutId);
    
    if (result) {
      geocodeCache.set(formattedCep, result);
      return result;
    }
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn('Geocodificação timeout para CEP:', formattedCep);
    }
  }
  
  // Cache o fallback para evitar requisições repetidas falhas
  geocodeCache.set(formattedCep, SALVADOR_CENTER);
  return SALVADOR_CENTER;
}

/**
 * Geocodifica múltiplos CEPs em paralelo (rápido)
 */
export async function geocodeMultipleCeps(
  ceps: string[]
): Promise<Map<string, GeocodingResult>> {
  const results = new Map<string, GeocodingResult>();
  const uniqueCeps = [...new Set(ceps.filter(cep => cep && cep.length >= 8))];
  
  // Processar todos em paralelo (APIs brasileiras são rápidas)
  const batchResults = await Promise.allSettled(
    uniqueCeps.map(cep => geocodeByCep(cep).then(result => ({ cep, result })))
  );
  
  batchResults.forEach((settled) => {
    if (settled.status === 'fulfilled') {
      const { cep, result } = settled.value;
      results.set(formatCep(cep), result);
    }
  });
  
  return results;
}

/**
 * Limpa o cache de geocodificação
 */
export function clearGeocodeCache(): void {
  geocodeCache.clear();
  bairroCache.clear();
}

/**
 * Retorna estatísticas do cache
 */
export function getGeocacheStats(): { size: number; hitRate: string } {
  return {
    size: geocodeCache.size + bairroCache.size,
    hitRate: `${geocodeCache.size} CEPs + ${bairroCache.size} bairros em cache`,
  };
}

/**
 * Geocodifica um bairro usando Nominatim (OpenStreetMap)
 * Tenta primeiro a cidade fornecida, depois alternativa
 */
export async function geocodeByBairro(
  bairro: string, 
  cidade?: string
): Promise<GeocodingResult> {
  if (!bairro) return SALVADOR_CENTER;
  
  const cacheKey = `${bairro.toLowerCase()}-${cidade || 'auto'}`;
  if (bairroCache.has(cacheKey)) {
    return bairroCache.get(cacheKey)!;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  // Lista de cidades para tentar (prioriza cidade fornecida)
  const cidades = cidade 
    ? [cidade] 
    : ['Salvador', 'Lauro de Freitas'];

  for (const cidadeAtual of cidades) {
    try {
      const query = encodeURIComponent(
        `${bairro}, ${cidadeAtual}, Bahia, Brasil`
      );
      
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?` +
        `format=json&q=${query}&limit=1&addressdetails=1`,
        { 
          signal: controller.signal,
          headers: { 
            'Accept': 'application/json',
            'User-Agent': 'DashboardApp/1.0'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.length > 0 && data[0].lat && data[0].lon) {
          const result: GeocodingResult = {
            lat: parseFloat(data[0].lat),
            lng: parseFloat(data[0].lon),
            found: true,
          };
          clearTimeout(timeoutId);
          bairroCache.set(cacheKey, result);
          console.log(`Geocodificado: ${bairro} (${cidadeAtual}) ->`, result.lat, result.lng);
          return result;
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.warn('Geocodificação timeout para bairro:', bairro);
        break;
      }
      // Tentar próxima cidade
    }
  }

  clearTimeout(timeoutId);
  bairroCache.set(cacheKey, SALVADOR_CENTER);
  return SALVADOR_CENTER;
}
