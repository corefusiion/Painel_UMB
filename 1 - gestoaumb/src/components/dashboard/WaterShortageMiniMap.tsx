import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useFaltaDagua } from "@/hooks/useFaltaDagua";
import { MapPin } from "lucide-react";

// Função para abreviar nomes longos de bairros
function abreviarBairro(nome: string): string {
  const abreviacoes: Record<string, string> = {
    "Boca do Rio": "B. do Rio",
    "São Cristóvão": "S. Cristóvão",
    "Nordeste de Amaralina": "N. Amaralina",
    "Pernambués": "Pernambués",
    "Pau da Lima": "P. da Lima",
  };
  return abreviacoes[nome] || nome;
}

interface WaterShortageMiniMapProps {
  onClick?: () => void;
}

export function WaterShortageMiniMap({ onClick }: WaterShortageMiniMapProps) {
  const { top5Bairros, isLoading } = useFaltaDagua();

  const getIntensityColor = (ocorrencias: number) => {
    if (ocorrencias >= 10) return "bg-destructive";
    if (ocorrencias >= 5) return "bg-warning";
    return "bg-success";
  };

  const getIntensitySize = (ocorrencias: number) => {
    if (ocorrencias >= 10) return "h-8 w-8";
    if (ocorrencias >= 5) return "h-7 w-7";
    return "h-6 w-6";
  };

  if (isLoading) {
    return (
      <Card className="bg-card border border-border/50 shadow-none h-full flex flex-col">
        <CardHeader className="pb-1 px-4 sm:px-5 pt-2 sm:pt-3 shrink-0">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-widest">
            Mapa por Bairro
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 sm:px-5 pb-2 sm:pb-3 flex-1 flex flex-col min-h-0">
          <Skeleton className="flex-1 min-h-[60px] sm:min-h-[80px] lg:min-h-[90px] rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card 
      className="bg-card border border-border/50 shadow-none h-full flex flex-col cursor-pointer transition-all hover:scale-[1.02] hover:shadow-md"
      onClick={onClick}
    >
      <CardHeader className="pb-1 px-4 sm:px-5 pt-2 sm:pt-3 shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-widest">
            Mapa por Bairro
          </CardTitle>
          <MapPin className="h-3 w-3 text-muted-foreground/50" />
        </div>
      </CardHeader>
      <CardContent className="px-4 sm:px-5 pb-2 sm:pb-3 flex-1 flex flex-col min-h-0">
        {/* Mapa Visual com Bairros Individuais */}
        <div className="relative flex-1 min-h-[60px] sm:min-h-[80px] lg:min-h-[90px] bg-muted/20 rounded-lg border border-border/30">
          {top5Bairros.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-xs">
              Sem dados por bairro
            </div>
          ) : (
            top5Bairros.map((bairro) => (
              <div
                key={bairro.bairro}
                className="absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center group"
                style={{
                  left: `${bairro.coordenadas.x}%`,
                  top: `${bairro.coordenadas.y}%`,
                }}
              >
                <div
                  className={`${getIntensityColor(bairro.count)} ${getIntensitySize(bairro.count)} rounded-full flex items-center justify-center text-white font-medium text-[8px] shadow-sm transition-transform duration-200 group-hover:scale-110`}
                >
                  {bairro.count}
                </div>
                <span className="text-[7px] sm:text-[8px] font-medium text-muted-foreground/70 mt-0.5 whitespace-nowrap max-w-[50px] truncate text-center">
                  {abreviarBairro(bairro.bairro)}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Legenda Discreta */}
        <div className="flex justify-center gap-3 sm:gap-4 mt-2 sm:mt-3 text-[9px] sm:text-[10px] shrink-0">
          <div className="flex items-center gap-1">
            <div className="h-1.5 w-1.5 rounded-full bg-success" />
            <span className="text-muted-foreground">&lt;5</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-1.5 w-1.5 rounded-full bg-warning" />
            <span className="text-muted-foreground">5-9</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-1.5 w-1.5 rounded-full bg-destructive" />
            <span className="text-muted-foreground">≥10</span>
          </div>
        </div>

        {/* Indicador de clique */}
        <p className="text-[9px] text-center text-muted-foreground/50 mt-1 sm:mt-2">
          Clique para ver mapa interativo
        </p>
      </CardContent>
    </Card>
  );
}
