import { useVazamentos } from "@/hooks/useVazamentos";
import { useDeltaYesterday } from "@/hooks/useDeltaYesterday";
import { MetricCard } from "./MetricCard";

interface LeaksStatsCardProps {
  onClick?: () => void;
}

export function LeaksStatsCard({ onClick }: LeaksStatsCardProps) {
  const { stats, isLoading } = useVazamentos();
  const { total, redeSSA, redeLF, ramalSSA, ramalLF, hdSSA, hdLF } = stats;
  const { delta } = useDeltaYesterday("vazamentos", total);

  const footer = (
    <div className="flex justify-between items-center w-full">
      <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Total</span>
      <div className="flex items-center gap-2">
        <span className="text-xl font-bold text-foreground tabular-nums">
          {total.toLocaleString('pt-BR')}
        </span>
      </div>
    </div>
  );

  return (
    <MetricCard
      title="Vazamentos"
      dotColor="bg-destructive"
      isLoading={isLoading}
      footer={footer}
      onClick={onClick}
    >
      <div className="flex flex-col space-y-2">
        {/* Subtítulo + Cabeçalho da tabela */}
        <div className="flex justify-between items-center -mt-1">
          <p className="text-[10px] text-muted-foreground font-medium">Total abertos</p>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-muted-foreground font-bold w-8 text-center">SSA</span>
            <div className="h-3 w-px bg-border/40" />
            <span className="text-[10px] text-muted-foreground font-bold w-8 text-center">LF</span>
          </div>
        </div>

        <div className="space-y-1 flex-1">
          {/* Linha Na Rede */}
          <div className="flex justify-between items-center text-xs">
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-destructive/80" />
              <span className="text-muted-foreground font-medium">Na Rede</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="font-bold text-foreground tabular-nums w-8 text-center">
                {redeSSA}
              </span>
              <div className="h-3 w-px bg-border/40" />
              <span className="font-bold text-foreground tabular-nums w-8 text-center">
                {redeLF}
              </span>
            </div>
          </div>
          
          {/* Linha No Ramal */}
          <div className="flex justify-between items-center text-xs">
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-destructive/60" />
              <span className="text-muted-foreground font-medium">No Ramal</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="font-bold text-foreground tabular-nums w-8 text-center">
                {ramalSSA}
              </span>
              <div className="h-3 w-px bg-border/40" />
              <span className="font-bold text-foreground tabular-nums w-8 text-center">
                {ramalLF}
              </span>
            </div>
          </div>
          
          {/* Linha No HD */}
          <div className="flex justify-between items-center text-xs">
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-destructive/40" />
              <span className="text-muted-foreground font-medium">No HD</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="font-bold text-foreground tabular-nums w-8 text-center">
                {hdSSA}
              </span>
              <div className="h-3 w-px bg-border/40" />
              <span className="font-bold text-foreground tabular-nums w-8 text-center">
                {hdLF}
              </span>
            </div>
          </div>
        </div>
      </div>
    </MetricCard>
  );
}
