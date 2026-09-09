import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { useOgeProcessosConcluidos } from "@/hooks/useOgeProcessosConcluidos";
import { Skeleton } from "@/components/ui/skeleton";

const ITEMS_PER_PAGE = 5;

interface CompletedOgeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const formatDateShort = (dateString: string): string => {
  const date = new Date(dateString);
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  return `${day}/${month}`;
};

export const CompletedOgeDialog = ({
  open,
  onOpenChange,
}: CompletedOgeDialogProps) => {
  const { data: processos = [], isLoading } = useOgeProcessosConcluidos();
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(processos.length / ITEMS_PER_PAGE));
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const displayedProcessos = processos.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  useEffect(() => {
    if (!open) {
      setCurrentPage(1);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">Processos Atendidos</DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[400px] pr-2">
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-2 py-3 border-b border-border/30">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ))}
            </div>
          ) : processos.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">
              Nenhum processo concluído
            </div>
          ) : (
          <div className="space-y-1">
              {displayedProcessos.map((processo, index) => (
                <div
                  key={processo.id}
                  className={`py-3 ${
                    index !== displayedProcessos.length - 1
                      ? "border-b border-border/30"
                      : ""
                  }`}
                >
                  {/* Header: Data + Local + Badge */}
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="text-xs text-muted-foreground shrink-0">
                        {formatDateShort(processo.atualizado_em)}
                      </span>
                      <span className="text-muted-foreground/40 shrink-0">•</span>
                      <span className="text-xs text-muted-foreground truncate">
                        {processo.local}
                      </span>
                    </div>
                    <Badge
                      variant="outline"
                      className="text-[10px] font-normal bg-success/10 text-success border-success/20 shrink-0"
                    >
                      Concluído
                    </Badge>
                  </div>

                  {/* Título */}
                  <p className="text-sm text-foreground font-light mb-1">
                    {processo.titulo}
                  </p>

                  {/* Última observação */}
                  {processo.ultima_observacao && (
                    <div className="flex items-center gap-1.5 text-success">
                      <Check className="h-3 w-3 shrink-0" />
                      <span className="text-xs">
                        {processo.ultima_observacao}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Paginação sutil */}
        {!isLoading && processos.length > ITEMS_PER_PAGE && (
          <div className="flex items-center justify-center gap-1 pt-3 border-t border-border/30 mt-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            
            <div className="flex items-center gap-0.5">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <Button
                  key={page}
                  variant={currentPage === page ? "secondary" : "ghost"}
                  size="icon"
                  className="h-6 w-6 text-[10px]"
                  onClick={() => setCurrentPage(page)}
                >
                  {page}
                </Button>
              ))}
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
