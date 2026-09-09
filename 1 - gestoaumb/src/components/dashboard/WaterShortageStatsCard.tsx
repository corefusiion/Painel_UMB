import { Badge } from "@/components/ui/badge";
import { useFaltaDagua } from "@/hooks/useFaltaDagua";
import { useCarroPipa } from "@/hooks/useCarroPipa";
import { useDeltaYesterday } from "@/hooks/useDeltaYesterday";
import { MetricCard } from "./MetricCard";

interface WaterShortageStatsCardProps {
  onClick?: () => void;
  onCarroPipaClick?: () => void;
}

export function WaterShortageStatsCard({ onClick, onCarroPipaClick }: WaterShortageStatsCardProps) {
  const { totalOcorrencias, totalEmbasa, cnbSSA, cnbLF, isLoading } = useFaltaDagua();
  const { totalOcorrencias: totalCarroPipa, isLoading: isLoadingCarroPipa } = useCarroPipa();
  const { delta } = useDeltaYesterday("faltadagua", totalOcorrencias);

  const footer = (
    <div className="flex items-center gap-1.5 pt-0.5">
      <div className={`h-2 w-2 rounded-full ${totalOcorrencias > 0 ? 'bg-warning animate-pulse' : 'bg-success'}`} />
      <span className="text-[11px] text-muted-foreground font-medium">
        {totalOcorrencias} Demandas Pendentes
      </span>
    </div>
  );

  return (
    <MetricCard
      title="Falta D'Água"
      isLoading={isLoading || isLoadingCarroPipa}
      delta={delta}
      footer={footer}
    >
      {/* Layout espaçado com textos em linha unica (whitespace-nowrap) */}
      <div className="grid grid-cols-4 gap-1.5 py-1 items-center">
        {/* CNB SSA */}
        <div
          className={`text-center p-1.5 rounded-lg bg-muted/20 border border-border/20 ${onClick ? 'cursor-pointer transition-all hover:bg-muted/40' : ''}`}
          onClick={onClick}
        >
          <div className="flex items-center justify-center gap-0.5 mb-1">
            <Badge variant="default" className="text-[8px] px-1 py-0 font-bold whitespace-nowrap">CNB</Badge>
            <span className="text-[9px] font-semibold text-muted-foreground whitespace-nowrap">SSA</span>
          </div>
          <p className="text-xl font-bold text-foreground tracking-tight tabular-nums">
            {cnbSSA}
          </p>
          <p className="text-[9px] text-muted-foreground whitespace-nowrap mt-0.5">
            Pendentes
          </p>
        </div>

        {/* CNB LF */}
        <div
          className={`text-center p-1.5 rounded-lg bg-muted/20 border border-border/20 ${onClick ? 'cursor-pointer transition-all hover:bg-muted/40' : ''}`}
          onClick={onClick}
        >
          <div className="flex items-center justify-center gap-0.5 mb-1">
            <Badge variant="default" className="text-[8px] px-1 py-0 font-bold whitespace-nowrap">CNB</Badge>
            <span className="text-[9px] font-semibold text-muted-foreground whitespace-nowrap">LF</span>
          </div>
          <p className="text-xl font-bold text-foreground tracking-tight tabular-nums">
            {cnbLF}
          </p>
          <p className="text-[9px] text-muted-foreground whitespace-nowrap mt-0.5">
            Pendentes
          </p>
        </div>

        {/* Embasa */}
        <div
          className={`text-center p-1.5 rounded-lg bg-muted/20 border border-border/20 ${onClick ? 'cursor-pointer transition-all hover:bg-muted/40' : ''}`}
          onClick={onClick}
        >
          <div className="flex items-center justify-center mb-1">
            <Badge className="text-[8px] px-1 py-0 bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-100 hover:text-gray-600 shadow-none cursor-default font-bold whitespace-nowrap">
              EMBASA
            </Badge>
          </div>
          <p className="text-xl font-bold text-foreground tracking-tight tabular-nums">
            {totalEmbasa}
          </p>
          <p className="text-[9px] text-muted-foreground whitespace-nowrap mt-0.5">
            Em Análise
          </p>
        </div>

        {/* Carro Pipa */}
        <div
          className={`text-center p-1.5 rounded-lg bg-muted/20 border border-border/20 ${onCarroPipaClick ? 'cursor-pointer transition-all hover:bg-muted/40' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            onCarroPipaClick?.();
          }}
        >
          <div className="flex items-center justify-center mb-1">
            <Badge className="text-[8px] px-1 py-0 bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-100 hover:text-gray-600 shadow-none cursor-default font-bold whitespace-nowrap">
              CARRO PIPA
            </Badge>
          </div>
          <p className="text-xl font-bold text-foreground tracking-tight tabular-nums">
            {totalCarroPipa}
          </p>
          <p className="text-[9px] text-muted-foreground whitespace-nowrap mt-0.5">
            Pendentes
          </p>
        </div>
      </div>
    </MetricCard>
  );
}
