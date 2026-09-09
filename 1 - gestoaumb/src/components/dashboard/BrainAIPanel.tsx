import { useState, useCallback, useEffect } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Brain, Sparkles, Activity, ChevronLeft, ChevronRight, MessageSquare, Cpu } from "lucide-react";
import { useAiInsights } from "@/hooks/useAiInsights";
import { AiInsightCard } from "./AiInsightCard";
import { DnaHidraulicoIndicator } from "./DnaHidraulicoIndicator";
import { toast } from "sonner";

export function BrainAIPanel() {
  const { emAnaliseRecords, totalEmAnalise, isProcessing, isProcessingAuto, processarLote } = useAiInsights();

  const handleProcessBatch = async () => {
    try {
      await processarLote(emAnaliseRecords);
      toast.success(`${emAnaliseRecords.length} demandas processadas pela IA com sucesso!`);
    } catch (err: any) {
      console.error("Erro ao processar lote IA:", err);
      toast.error(`Erro ao processar: ${err.message || "Falha na comunicação com SanealA"}`);
    }
  };

  return (
    <Card className="border border-border/30 bg-card h-full flex flex-col min-w-0">
      {/* Compact action bar — with Mode Selector */}
      <div className="px-3 py-1 border-b border-border/20 bg-muted/30 shrink-0">
        <div className="flex items-center gap-1.5 flex-wrap justify-between">
          {/* Menu Selector Removido */}

          <div className="flex items-center gap-2">
            <DnaHidraulicoIndicator />
            {isProcessingAuto && (
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground/70 animate-pulse">
                <Activity className="h-2.5 w-2.5" />
                IA...
              </span>
            )}
            {totalEmAnalise > 0 && (
              <Badge variant="outline" className="text-[9px] px-1 py-0 font-normal border-border/40 text-muted-foreground">
                {totalEmAnalise} pendentes
              </Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleProcessBatch}
              disabled={isProcessing || isProcessingAuto || totalEmAnalise === 0}
              className="text-[10px] h-5 gap-1 px-1.5 border-border/40 text-muted-foreground hover:text-foreground bg-card"
            >
              {isProcessing ? "..." : "Processar IA"}
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <CardContent className="p-2 pt-2 flex-1 min-h-0 min-w-0 overflow-hidden">
        {totalEmAnalise === 0 ? (
          <EmptyState />
        ) : isProcessing ? (
          <ProcessingState count={totalEmAnalise} />
        ) : (
          <InsightsCarousel records={emAnaliseRecords} />
        )}
      </CardContent>
    </Card>
  );
}

function InsightsCarousel({ records }: { records: any[] }) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "start",
    slidesToScroll: 1,
    containScroll: "trimSnaps",
    watchDrag: false,
  });

  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  const [current, setCurrent] = useState(0);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setCanScrollPrev(emblaApi.canScrollPrev());
    setCanScrollNext(emblaApi.canScrollNext());
    setCurrent(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
    return () => { emblaApi.off("select", onSelect); };
  }, [emblaApi, onSelect]);

  const totalSnaps = emblaApi?.scrollSnapList().length ?? records.length;

  return (
    <div className="flex flex-col h-full gap-2 min-w-0">
      <div ref={emblaRef} className="overflow-hidden flex-1 min-h-0 min-w-0">
        <div className="flex h-full -ml-3">
          {records.map((record) => (
            <div key={record.id} className="min-w-0 shrink-0 grow-0 basis-full pl-3 h-full">
              <AiInsightCard record={record} />
            </div>
          ))}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between shrink-0">
        <span className="text-[10px] text-muted-foreground/60 tabular-nums">
          {current + 1}/{totalSnaps}
        </span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground/60 hover:text-foreground" disabled={!canScrollPrev} onClick={() => emblaApi?.scrollPrev()}>
            <ChevronLeft className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground/60 hover:text-foreground" disabled={!canScrollNext} onClick={() => emblaApi?.scrollNext()}>
            <ChevronRight className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center py-8">
      <div className="h-12 w-12 rounded-full bg-muted/30 flex items-center justify-center mb-3">
        <Brain className="h-6 w-6 text-muted-foreground/20" />
      </div>
      <p className="text-xs text-muted-foreground/60">Nenhuma anomalia pendente</p>
      <div className="flex items-center gap-1 mt-2">
        <Activity className="h-2.5 w-2.5 text-muted-foreground/40" />
        <span className="text-[10px] text-muted-foreground/40">Monitorando</span>
      </div>
    </div>
  );
}

function ProcessingState({ count }: { count: number }) {
  return (
    <div className="flex h-full gap-3">
      {Array.from({ length: Math.min(count, 2) }).map((_, i) => (
        <Card key={i} className="flex-1 border border-border/20">
          <div className="p-3 space-y-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-full" />
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
