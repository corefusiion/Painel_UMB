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
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Droplets } from "lucide-react";
import { FaltaDaguaRecord } from "@/hooks/useFaltaDagua";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface WaterShortageTableDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  records: FaltaDaguaRecord[];
}

const ITEMS_PER_PAGE = 10;

type FilterType = 'todas' | 'cnb-ssa' | 'cnb-lf' | 'embasa';

// Funções de filtro por localidade
const isLauroFreitas = (r: FaltaDaguaRecord) => r.localidade?.includes("700");
const isSalvador = (r: FaltaDaguaRecord) => r.localidade?.includes("900");

export function WaterShortageTableDialog({
  open,
  onOpenChange,
  records,
}: WaterShortageTableDialogProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [filter, setFilter] = useState<FilterType>('todas');

  // Filtrar registros
  const filteredRecords = records.filter(record => {
    if (filter === 'todas') return true;
    if (filter === 'cnb-ssa') return record.responsavel === 'cnb' && isSalvador(record);
    if (filter === 'cnb-lf') return record.responsavel === 'cnb' && isLauroFreitas(record);
    if (filter === 'embasa') return record.responsavel === 'embasa';
    return true;
  });

  const totalPages = Math.ceil(filteredRecords.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const displayedRecords = filteredRecords.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  // Contagens para os filtros
  const countCNB_SSA = records.filter(r => r.responsavel === 'cnb' && isSalvador(r)).length;
  const countCNB_LF = records.filter(r => r.responsavel === 'cnb' && isLauroFreitas(r)).length;
  const countEmbasa = records.filter(r => r.responsavel === 'embasa').length;

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
    setCurrentPage(1); // Reset para primeira página ao mudar filtro
  };

  const getResponsavelBadge = (responsavel: 'embasa' | 'cnb' | null) => {
    if (responsavel === 'cnb') {
      return <Badge variant="default" className="text-[9px] px-1.5">CNB</Badge>;
    }
    if (responsavel === 'embasa') {
      return <Badge className="text-[9px] px-1.5 bg-warning/20 text-warning border-warning/30">EMBASA</Badge>;
    }
    return <span className="text-muted-foreground text-xs">-</span>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Droplets className="h-5 w-5 text-primary" />
            Ocorrências de Falta D'Água
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {filteredRecords.length} ocorrências {filter !== 'todas' ? `(${filter.toUpperCase()})` : ''} em {today}
          </p>
        </DialogHeader>

        {/* Filtros */}
        <div className="flex gap-2 pb-2 flex-wrap">
          <Button
            variant={filter === 'todas' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleFilterChange('todas')}
            className="text-xs"
          >
            Todas ({records.length})
          </Button>
          <Button
            variant={filter === 'cnb-ssa' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleFilterChange('cnb-ssa')}
            className="text-xs"
          >
            CNB-SSA ({countCNB_SSA})
          </Button>
          <Button
            variant={filter === 'cnb-lf' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleFilterChange('cnb-lf')}
            className="text-xs"
          >
            CNB-LF ({countCNB_LF})
          </Button>
          <Button
            variant={filter === 'embasa' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleFilterChange('embasa')}
            className="text-xs"
          >
            Embasa ({countEmbasa})
          </Button>
        </div>

        <div className="flex-1 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">OS</TableHead>
                <TableHead>Bairro</TableHead>
                <TableHead className="w-[90px]">Responsável</TableHead>
                <TableHead className="hidden md:table-cell">Logradouro</TableHead>
                <TableHead className="w-[100px]">Data/Hora</TableHead>
                <TableHead className="hidden lg:table-cell max-w-[180px]">Obs</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayedRecords.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Nenhuma ocorrência encontrada
                  </TableCell>
                </TableRow>
              ) : (
                displayedRecords.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-mono text-xs">
                      {record.numero_os}
                    </TableCell>
                    <TableCell className="font-medium">
                      {record.bairro_nome}
                    </TableCell>
                    <TableCell>
                      {getResponsavelBadge(record.responsavel)}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground truncate max-w-[200px]">
                      {record.logradouro || "-"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDateTime(record.data_tramitacao)}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-xs text-muted-foreground truncate max-w-[180px]" title={record.observacao || ""}>
                      {record.observacao || "-"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-4 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
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
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
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
