import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePavimentos } from "@/hooks/usePavimentos";
import { useDeltaYesterday } from "@/hooks/useDeltaYesterday";
import { DeltaIndicator } from "./DeltaIndicator";

interface PavimentosStatsCardProps {
  onClick?: () => void;
}

export function PavimentosStatsCard({ onClick }: PavimentosStatsCardProps) {
  const { totalSSA, totalLF, total, isLoading } = usePavimentos();
  const { delta } = useDeltaYesterday("pavimentos", total);

  return (
    <Card 
      className={`bg-card border border-border/50 shadow-none shrink-0 ${onClick ? 'cursor-pointer transition-all hover:scale-[1.02] hover:shadow-md' : ''}`}
      onClick={onClick}
    >
      <CardContent className="p-3 sm:p-4">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-3 w-32" />
            <div className="flex items-center gap-4">
              <Skeleton className="h-10 w-16 flex-1" />
              <Skeleton className="h-10 w-16 flex-1" />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Título */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground uppercase tracking-widest">
                Pavimentos Pendentes
              </p>
              {!isLoading && <DeltaIndicator delta={delta} />}
            </div>
            
            {/* Layout split: SSA | LF */}
            <div className="flex items-center">
              {/* SSA - Salvador */}
              <div className="flex-1 text-center">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1">
                  SSA
                </p>
                <p className="text-3xl sm:text-4xl lg:text-5xl font-light text-foreground tracking-tight">
                  {totalSSA}
                </p>
              </div>
              
              {/* Separador vertical */}
              <div className="h-12 w-px bg-border/50 mx-4" />
              
              {/* LF - Lauro de Freitas */}
              <div className="flex-1 text-center">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1">
                  LF
                </p>
                <p className="text-3xl sm:text-4xl lg:text-5xl font-light text-foreground tracking-tight">
                  {totalLF}
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
