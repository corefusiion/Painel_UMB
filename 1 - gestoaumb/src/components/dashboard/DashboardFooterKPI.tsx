import { useDemandas } from "@/hooks/useDemandas";
import { useOgeProcessos } from "@/hooks/useOgeProcessos";
import { useFaltaDagua } from "@/hooks/useFaltaDagua";
import { usePavimentos } from "@/hooks/usePavimentos";
import { useVazamentos } from "@/hooks/useVazamentos";

export function DashboardFooterKPI() {
  const { data: demandas = [] } = useDemandas();
  const { data: processos = [] } = useOgeProcessos();
  const { totalOcorrencias } = useFaltaDagua();
  const { total: totalPavimentos } = usePavimentos();
  const { stats } = useVazamentos();

  const items = [
    { label: "Demandas", value: demandas.length },
    { label: "Processos", value: processos.length },
    { label: "Falta D'Água", value: totalOcorrencias },
    { label: "Pavimentos", value: totalPavimentos },
    { label: "Vazamentos", value: stats.total },
  ];

  return (
    <footer className="h-8 shrink-0 border-t border-border/30 bg-card/50 px-6 flex items-center justify-center">
      <div className="flex items-center gap-4 sm:gap-6">
        {items.map((item, i) => (
          <div key={item.label} className="flex items-center gap-1.5">
            {i > 0 && <div className="h-3 w-px bg-border/40 -ml-2 sm:-ml-3 mr-1.5 sm:mr-3" />}
            <span className="text-sm font-medium text-foreground tabular-nums">{item.value}</span>
            <span className="text-[11px] text-muted-foreground hidden sm:inline">{item.label}</span>
          </div>
        ))}
      </div>
    </footer>
  );
}
