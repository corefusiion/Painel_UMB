import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePavimentos } from "@/hooks/usePavimentos";

interface PavementDonutChartProps {
  onClick?: () => void;
}

export function PavementDonutChart({ onClick }: PavementDonutChartProps) {
  const { total, concretoSSA, concretoLF, asfaltoSSA, asfaltoLF, isLoading } = usePavimentos();

  return (
    <Card 
      className={`bg-card border border-border/50 shadow-none ${onClick ? 'cursor-pointer transition-all hover:scale-[1.02] hover:shadow-md' : ''}`}
      onClick={onClick}
    >
      <CardHeader className="pb-1 px-4 sm:px-5 pt-2 sm:pt-3">
        <div className="flex items-center gap-1.5">
          <div className="h-1.5 w-1.5 rounded-full bg-warning" />
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-widest">
            Notas de Pavimento
          </CardTitle>
        </div>
        {/* Subtítulo + Cabeçalho da tabela */}
        <div className="flex justify-between items-center mt-1">
          <p className="text-[11px] text-muted-foreground/70">Demandas pendentes</p>
          <div className="flex items-center gap-0">
            <span className="text-[11px] text-muted-foreground w-10 text-right">SSA</span>
            <div className="h-3 w-px bg-border/50 mx-2" />
            <span className="text-[11px] text-muted-foreground w-10 text-left">LF</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 sm:px-5 pb-2 sm:pb-3">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-6 w-1/2 mt-3" />
          </div>
        ) : (
          <>
            <div className="space-y-1">
              {/* Linha Concreto */}
              <div className="flex justify-between items-center text-sm">
                <div className="flex items-center gap-1.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60" />
                  <span className="text-muted-foreground font-light">Concreto</span>
                </div>
                <div className="flex items-center gap-0">
                  <span className="font-medium text-foreground tabular-nums w-10 text-right">
                    {concretoSSA}
                  </span>
                  <div className="h-3 w-px bg-border/50 mx-2" />
                  <span className="font-medium text-foreground tabular-nums w-10 text-left">
                    {concretoLF}
                  </span>
                </div>
              </div>
              
              {/* Linha Asfalto */}
              <div className="flex justify-between items-center text-sm">
                <div className="flex items-center gap-1.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-foreground/80" />
                  <span className="text-muted-foreground font-light">Asfalto</span>
                </div>
                <div className="flex items-center gap-0">
                  <span className="font-medium text-foreground tabular-nums w-10 text-right">
                    {asfaltoSSA}
                  </span>
                  <div className="h-3 w-px bg-border/50 mx-2" />
                  <span className="font-medium text-foreground tabular-nums w-10 text-left">
                    {asfaltoLF}
                  </span>
                </div>
              </div>
            </div>
            
            {/* Total */}
            <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-border/30 flex justify-between items-center">
              <span className="text-sm text-muted-foreground uppercase tracking-widest">Total</span>
              <span className="text-xl sm:text-2xl font-light text-foreground tabular-nums">
                {total.toLocaleString('pt-BR')}
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
