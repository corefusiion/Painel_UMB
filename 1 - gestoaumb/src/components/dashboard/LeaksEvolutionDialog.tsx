import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Droplets } from "lucide-react";
import { VazamentoRecord } from "@/hooks/useVazamentos";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface LeaksEvolutionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  records: VazamentoRecord[];
}

const ITEMS_PER_PAGE = 10;

type FilterType = "todas" | "ssa" | "lf";

const isLauroFreitas = (r: VazamentoRecord) => r.localidade?.includes("700");
const isSalvador = (r: VazamentoRecord) => r.localidade?.includes("900");

const getTipoBadge = (tipo: string | null) => {
  const t = tipo?.toLowerCase() || "";
  if (t === "rede")
    return { label: "Rede", className: "bg-destructive/20 text-destructive border-destructive/30" };
  if (t === "ramal")
    return { label: "Ramal", className: "bg-warning/20 text-warning border-warning/30" };
  if (t === "hd")
    return { label: "HD", className: "bg-primary/20 text-primary border-primary/30" };
  return { label: tipo || "-", className: "bg-muted/20 text-muted-foreground border-muted-foreground/30" };
};

export function LeaksEvolutionDialog({
  open,
  onOpenChange,
  records,
}: LeaksEvolutionDialogProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [filter, setFilter] = useState<FilterType>("todas");

  const filteredRecords = records.filter((record) => {
    if (filter === "todas") return true;
    if (filter === "ssa") return isSalvador(record);
    if (filter === "lf") return isLauroFreitas(record);
    return true;
  });

  const totalPages = Math.ceil(filteredRecords.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const displayedRecords = filteredRecords.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const countSSA = records.filter((r) => isSalvador(r)).length;
  const countLF = records.filter((r) => isLauroFreitas(r)).length;

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return "-";
    try {
      return format(new Date(dateStr), "dd/MM HH:mm", { locale: ptBR });
    } catch {
      return "-";
    }
  };

  const today = format(new Date(), "dd/MM/yyyy", { locale: ptBR });

  const handleFilterChange = (newFilter: FilterType) => {
    setFilter(newFilter);
    setCurrentPage(1);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Droplets className="h-5 w-5 text-destructive" />
            Vazamentos Abertos
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {filteredRecords.length} ocorrências{" "}
            {filter !== "todas" ? `(${filter.toUpperCase()})` : ""} em {today}
          </p>
        </DialogHeader>

        <div className="flex gap-2 pb-2 flex-wrap">
          <Button
            variant={filter === "todas" ? "default" : "outline"}
            size="sm"
            onClick={() => handleFilterChange("todas")}
            className="text-xs"
          >
            Todas ({records.length})
          </Button>
          <Button
            variant={filter === "ssa" ? "default" : "outline"}
            size="sm"
            onClick={() => handleFilterChange("ssa")}
            className="text-xs"
          >
            SSA ({countSSA})
          </Button>
          <Button
            variant={filter === "lf" ? "default" : "outline"}
            size="sm"
            onClick={() => handleFilterChange("lf")}
            className="text-xs"
          >
            LF ({countLF})
          </Button>
        </div>

        <div className="flex-1 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">OS</TableHead>
                <TableHead>Bairro</TableHead>
                <TableHead className="w-[80px]">Tipo</TableHead>
                <TableHead className="hidden md:table-cell">Logradouro</TableHead>
                <TableHead className="w-[100px]">Data/Hora</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayedRecords.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Nenhuma ocorrência encontrada
                  </TableCell>
                </TableRow>
              ) : (
                displayedRecords.map((record) => {
                  const badge = getTipoBadge(record.tipo_vazamento);
                  return (
                    <TableRow key={record.id}>
                      <TableCell className="font-mono text-xs">
                        {record.numero_os}
                      </TableCell>
                      <TableCell className="font-medium">
                        {record.bairro_nome}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground truncate max-w-[200px]">
                        {record.logradouro || "-"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDateTime(record.data_tramitacao)}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-4 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                return (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? "default" : "outline"}
                    size="sm"
                    className="w-8 h-8"
                    onClick={() => setCurrentPage(pageNum)}
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
