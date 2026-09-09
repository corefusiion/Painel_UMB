import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface DialogDemand {
  id: string;
  tipo: string;
  bairro: string;
  descricao?: string;
  descricaoCompleta: string;
  status: "em_analise" | "pendente";
  dataAbertura: string;
  responsavel: string;
  prioridade: "alta" | "media" | "baixa";
  observacao?: string | null;
}

interface DemandDetailDialogProps {
  demand: DialogDemand | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusConfig = {
  em_analise: { 
    label: "Em Análise", 
    className: "bg-amber-50 text-amber-600 border-amber-200" 
  },
  pendente: { 
    label: "Pendente", 
    className: "bg-gray-50 text-gray-500 border-gray-200" 
  },
};

const priorityConfig = {
  alta: { label: "Alta", className: "text-destructive" },
  media: { label: "Média", className: "text-warning" },
  baixa: { label: "Baixa", className: "text-muted-foreground" },
};

export const DemandDetailDialog = ({ demand, open, onOpenChange }: DemandDetailDialogProps) => {
  if (!demand) return null;

  const status = statusConfig[demand.status];
  const priority = priorityConfig[demand.prioridade];

  const formattedDate = format(parseISO(demand.dataAbertura), "dd/MM/yyyy", { locale: ptBR });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Detalhes da Demanda
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-3 pt-2">
          {/* Status */}
          <div className="flex items-center justify-end">
            <Badge variant="outline" className={`${status.className}`}>
              {status.label}
            </Badge>
          </div>

          {/* Tipo e Bairro */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[11px] text-muted-foreground mb-0.5 uppercase tracking-wider">Tipo</p>
              <p className="text-sm text-foreground">{demand.tipo}</p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground mb-0.5 uppercase tracking-wider">Bairro</p>
              <p className="text-sm text-foreground">{demand.bairro}</p>
            </div>
          </div>

          {/* Descrição Completa */}
          <div>
            <p className="text-[11px] text-muted-foreground mb-0.5 uppercase tracking-wider">Descrição</p>
            <p className="text-sm text-foreground leading-relaxed">
              {demand.descricaoCompleta}
            </p>
          </div>

          {/* Informações Adicionais */}
          <div className="pt-2 border-t border-border/30 space-y-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[11px] text-muted-foreground mb-0.5 uppercase tracking-wider">Data Abertura</p>
                <p className="text-sm text-foreground">{formattedDate}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground mb-0.5 uppercase tracking-wider">Prioridade</p>
                <p className={`text-sm ${priority.className}`}>
                  {priority.label}
                </p>
              </div>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground mb-0.5 uppercase tracking-wider">Responsável</p>
              <p className="text-sm text-foreground">{demand.responsavel}</p>
            </div>
            {demand.observacao && demand.observacao !== "Demanda criada" && (
              <div>
                <p className="text-[11px] text-muted-foreground mb-0.5 uppercase tracking-wider">Atualização da Demanda</p>
                <p className="text-sm text-amber-600">
                  {demand.observacao}
                </p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
