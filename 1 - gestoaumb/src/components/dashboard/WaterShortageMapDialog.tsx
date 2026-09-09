import { useState, useEffect, useRef, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { InteractiveMap, MapMarker } from "@/components/ui/interactive-map";
import { useFaltaDagua, BairroCount } from "@/hooks/useFaltaDagua";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { MapPin, Loader2 } from "lucide-react";
import { geocodeByCep, formatCep, geocodeByBairro } from "@/utils/geocoding";

interface WaterShortageMapDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Coordenadas geográficas reais dos bairros de Salvador e Lauro de Freitas (cache estático)
const BAIRRO_COORDENADAS_GEO: Record<string, [number, number]> = {
  "Boca do Rio": [-12.9700, -38.4150],
  "Pernambués": [-12.9490, -38.4610],
  "São Cristóvão": [-12.9067, -38.3378],
  "Nordeste de Amaralina": [-12.9961, -38.4722],
  "Pau da Lima": [-12.9231, -38.4144],
  "Pituba": [-12.9897, -38.4567],
  "Rio Vermelho": [-12.9864, -38.4936],
  "Brotas": [-12.9856, -38.4936],
  "Liberdade": [-12.9447, -38.4978],
  "Cajazeiras": [-12.8978, -38.4144],
  "Cabula": [-12.9567, -38.4567],
  "Itapuã": [-12.9450, -38.3650],
  "Itapua": [-12.9450, -38.3650],
  "Periperi": [-12.9156, -38.5267],
  "Valéria": [-12.8933, -38.4378],
  "Paripe": [-12.8789, -38.5233],
  "Mussurunga": [-12.9289, -38.3844],
  "Sussuarana": [-12.9178, -38.4367],
  "Narandiba": [-12.9511, -38.4689],
  "Castelo Branco": [-12.9344, -38.4511],
  "São Marcos": [-12.9456, -38.4278],
  "Tancredo Neves": [-12.9611, -38.4367],
  "Imbuí": [-12.9856, -38.4456],
  "Barra": [-13.0056, -38.5267],
  "Ondina": [-13.0011, -38.5089],
  "Campo Grande": [-12.9944, -38.5144],
  "Nazaré": [-12.9833, -38.5100],
  "Barris": [-12.9889, -38.5089],
  "Centro": [-12.9711, -38.5014],
  "Piatã": [-12.9400, -38.3700],
  "Piata": [-12.9400, -38.3700],
  "Stella Maris": [-12.9178, -38.3367],
  "Aeroporto": [-12.9150, -38.3350],
  "Patamares": [-12.9511, -38.3689],
  "Stiep": [-12.9789, -38.4489],
  // Bairros de Lauro de Freitas
  "Caji": [-12.8650, -38.3250],
  "Itinga": [-12.8850, -38.3180],
  "Portão": [-12.8780, -38.3100],
  "Portao": [-12.8780, -38.3100],
  "Vila Praiana": [-12.9000, -38.3080],
  "Alt Coqueirinho": [-12.9414, -38.3714],
  "Alto do Coqueirinho": [-12.9414, -38.3714],
  "Vilas Atlantico": [-12.9050, -38.3150],
  "Vilas Atlântico": [-12.9050, -38.3150],
  "Caixa Dagua": [-12.8920, -38.3200], // Lauro de Freitas (sem acento, como vem do banco)
};

function getMarkerStyle(count: number): { color: 'green' | 'gold' | 'red'; size: 'small' | 'medium' | 'large' } {
  if (count >= 10) return { color: 'red', size: 'large' };
  if (count >= 5) return { color: 'gold', size: 'medium' };
  return { color: 'green', size: 'small' };
}

function getFallbackPosition(bairro: string): [number, number] {
  return BAIRRO_COORDENADAS_GEO[bairro] || [-12.9711, -38.5014];
}

/**
 * Busca posição para um bairro:
 * 1. Primeiro verifica dicionário estático (instantâneo)
 * 2. Se não encontrar, usa geocodificação dinâmica via Nominatim
 */
async function getPositionForBairro(
  bairro: string, 
  regiao: string
): Promise<[number, number]> {
  // 1. Tentar dicionário estático (instantâneo)
  if (BAIRRO_COORDENADAS_GEO[bairro]) {
    return BAIRRO_COORDENADAS_GEO[bairro];
  }
  
  // 2. Geocodificar dinamicamente
  const cidade = regiao === "Lauro de Freitas" 
    ? "Lauro de Freitas" 
    : "Salvador";
    
  const result = await geocodeByBairro(bairro, cidade);
  
  if (result.found) {
    // Armazenar no dicionário para uso futuro (em memória)
    BAIRRO_COORDENADAS_GEO[bairro] = [result.lat, result.lng];
    return [result.lat, result.lng];
  }
  
  // 3. Fallback para centro de Salvador
  return [-12.9711, -38.5014];
}

// Fallback component when map fails to load
function MapFallback() {
  return (
    <div className="flex flex-col items-center justify-center h-[400px] bg-muted/30 rounded-lg border border-border/30">
      <MapPin className="h-12 w-12 text-muted-foreground mb-3" />
      <p className="text-sm font-medium text-foreground mb-1">
        Não foi possível carregar o mapa
      </p>
      <p className="text-xs text-muted-foreground">
        Ocorreu um erro ao inicializar o componente.
      </p>
    </div>
  );
}

export function WaterShortageMapDialog({ open, onOpenChange }: WaterShortageMapDialogProps) {
  const { top5Bairros, isLoading: isDataLoading } = useFaltaDagua();
  const [markers, setMarkers] = useState<MapMarker[]>([]);
  const [geocodingStatus, setGeocodingStatus] = useState<string>("");
  const cancelledRef = useRef(false);

  // Criar marcadores iniciais com posições fallback (imediato)
  const initialMarkers = useMemo((): MapMarker[] => {
    return top5Bairros.map((bairroData) => {
      const style = getMarkerStyle(bairroData.count);
      const position = getFallbackPosition(bairroData.bairro);
      
      return {
        id: bairroData.bairro,
        position,
        color: style.color,
        size: style.size,
        count: bairroData.count,
        popup: {
          title: bairroData.bairro,
          content: `${bairroData.count} ocorrência${bairroData.count > 1 ? 's' : ''} - ${bairroData.regiao}`,
        },
      };
    });
  }, [top5Bairros]);

  // Atualizar marcadores quando top5Bairros mudar (render imediato) + geocodificação dinâmica
  useEffect(() => {
    if (!open) return;
    
    // Mostrar marcadores imediatamente com fallback
    setMarkers(initialMarkers);
    setGeocodingStatus("");
  }, [open, initialMarkers]);

  // Geocodificação dinâmica para bairros desconhecidos
  useEffect(() => {
    if (!open || top5Bairros.length === 0) return;

    cancelledRef.current = false;
    
    const geocodeUnknownBairros = async () => {
      // Identificar bairros que não estão no dicionário
      const unknownBairros = top5Bairros.filter(
        b => !BAIRRO_COORDENADAS_GEO[b.bairro]
      );
      
      if (unknownBairros.length === 0) {
        // Apenas atualiza popup com CEP para os conhecidos
        await updateCepInfo();
        return;
      }

      // Geocodificar bairros desconhecidos
      for (const bairroData of unknownBairros) {
        if (cancelledRef.current) return;
        
        setGeocodingStatus(`Localizando ${bairroData.bairro}...`);
        
        const position = await getPositionForBairro(
          bairroData.bairro, 
          bairroData.regiao
        );

        if (cancelledRef.current) return;

        // Atualizar marcador com posição geocodificada
        setMarkers(prev => {
          const updated = [...prev];
          const idx = updated.findIndex(m => m.id === bairroData.bairro);
          
          if (idx !== -1) {
            updated[idx] = {
              ...updated[idx],
              position,
            };
          }
          
          return updated;
        });
      }

      setGeocodingStatus("");
      
      // Depois atualiza popup com CEP
      await updateCepInfo();
    };

    const updateCepInfo = async () => {
      const bairrosWithCep = top5Bairros.filter(b => b.ceps.length > 0);
      
      if (bairrosWithCep.length === 0) return;

      // Geocodificar CEPs em paralelo para atualizar popups
      const results = await Promise.allSettled(
        bairrosWithCep.map(async (bairroData) => {
          const result = await geocodeByCep(bairroData.ceps[0]);
          return { bairro: bairroData.bairro, result, cep: bairroData.ceps[0] };
        })
      );

      if (cancelledRef.current) return;

      setMarkers(prev => {
        const updated = [...prev];

        results.forEach((settled) => {
          if (settled.status === 'fulfilled') {
            const { bairro, result, cep } = settled.value;
            const idx = updated.findIndex(m => m.id === bairro);
            
            if (idx !== -1 && result.found) {
              const currentContent = updated[idx].popup?.content || '';
              // Só adiciona CEP se ainda não tiver
              if (!currentContent.includes('CEP:')) {
                updated[idx] = {
                  ...updated[idx],
                  popup: {
                    ...updated[idx].popup!,
                    content: `${currentContent} | CEP: ${formatCep(cep)}`,
                  },
                };
              }
            }
          }
        });

        return updated;
      });
    };

    geocodeUnknownBairros();

    return () => {
      cancelledRef.current = true;
    };
  }, [open, top5Bairros]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden">
        <DialogHeader className="pb-3">
          <DialogTitle className="text-base font-medium">
            Mapa de Ocorrências - Falta D'Água
          </DialogTitle>
          <DialogDescription className="text-xs">
            Bairros afetados em Salvador e Lauro de Freitas, BA
            {geocodingStatus && (
              <span className="ml-2 text-primary">
                <Loader2 className="inline h-3 w-3 animate-spin mr-1" />
                {geocodingStatus}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Mapa Interativo com Error Boundary - sempre renderiza */}
        <div className="flex-1 min-h-[400px] rounded-lg overflow-hidden border border-border/30">
          {isDataLoading ? (
            <div className="flex flex-col items-center justify-center h-[400px] bg-muted/30">
              <Loader2 className="h-10 w-10 text-primary animate-spin mb-3" />
              <p className="text-sm text-muted-foreground">Carregando dados...</p>
            </div>
          ) : (
            <ErrorBoundary fallback={<MapFallback />}>
              <InteractiveMap
                center={[-12.9711, -38.5014]}
                zoom={11}
                markers={markers}
                style={{ height: '400px', width: '100%' }}
              />
            </ErrorBoundary>
          )}
        </div>

        {/* Legenda */}
        <div className="flex justify-center gap-6 pt-3 text-xs border-t border-border/30 mt-3">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-success" />
            <span className="text-muted-foreground">&lt;5 ocorrências</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-warning" />
            <span className="text-muted-foreground">5-9 ocorrências</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-destructive" />
            <span className="text-muted-foreground">≥10 ocorrências</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
