import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { waterShortageData } from "@/data/mockData";

export function WaterShortageMap() {
  const getIntensityColor = (ocorrencias: number) => {
    if (ocorrencias >= 10) return "bg-destructive";
    if (ocorrencias >= 5) return "bg-warning";
    return "bg-success";
  };

  const getIntensitySize = (ocorrencias: number) => {
    if (ocorrencias >= 10) return "h-10 w-10";
    if (ocorrencias >= 5) return "h-8 w-8";
    return "h-6 w-6";
  };

  return (
    <Card className="bg-card border border-border/50 shadow-none">
      <CardHeader className="pb-2 px-6 pt-6">
        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-widest">
          Falta D'água por Região
        </CardTitle>
      </CardHeader>
      <CardContent className="px-6 pb-6">
        {/* Mapa Visual Simplificado */}
        <div className="relative h-44 bg-muted/20 rounded-lg border border-border/30">
          {waterShortageData.regioes.map((regiao) => (
            <div
              key={regiao.id}
              className="absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center group"
              style={{
                left: `${regiao.coordenadas.x}%`,
                top: `${regiao.coordenadas.y}%`,
              }}
            >
              <div
                className={`${getIntensityColor(regiao.ocorrencias)} ${getIntensitySize(regiao.ocorrencias)} rounded-full flex items-center justify-center text-white font-medium text-xs shadow-sm transition-transform group-hover:scale-110`}
              >
                {regiao.ocorrencias}
              </div>
              <span className="text-[10px] font-medium text-muted-foreground mt-1 opacity-70">
                {regiao.nome}
              </span>
            </div>
          ))}
        </div>

        {/* Legenda Discreta */}
        <div className="flex justify-center gap-6 mt-4 text-[10px]">
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-success" />
            <span className="text-muted-foreground">&lt;5</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-warning" />
            <span className="text-muted-foreground">5-9</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-destructive" />
            <span className="text-muted-foreground">≥10</span>
          </div>
        </div>

        {/* Total */}
        <div className="text-center mt-4 pt-4 border-t border-border/30">
          <p className="text-4xl font-light text-foreground tracking-tight">
            {waterShortageData.totalOcorrencias}
          </p>
          <p className="text-xs text-muted-foreground uppercase tracking-widest mt-1">Total de Ocorrências</p>
        </div>
      </CardContent>
    </Card>
  );
}
