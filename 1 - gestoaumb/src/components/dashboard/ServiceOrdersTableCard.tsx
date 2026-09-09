import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Activity,
  Calendar,
  EyeOff,
  FileText,
} from "lucide-react";
import { useFaltaDagua } from "@/hooks/useFaltaDagua";
import { useFaltaDaguaEx } from "@/hooks/useFaltaDaguaEx";
import { useAiInsights } from "@/hooks/useAiInsights";
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";

const MySwal = withReactContent(Swal);

const ITEMS_PER_PAGE = 40;

export function ServiceOrdersTableCard() {
  const { records: faltaDagua, isLoading: isLoadingPendentes } = useFaltaDagua();
  const { records: faltaDaguaEx, isLoading: isLoadingExecutadas } = useFaltaDaguaEx();
  const { insights } = useAiInsights();

  const [activeTab, setActiveTab] = useState<'pendentes' | 'executadas'>('pendentes');
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [collapseDates, setCollapseDates] = useState(false);
  const [filterSitOS, setFilterSitOS] = useState("Todos");
  const [filterPOP, setFilterPOP] = useState("Todos");


  const showDetalhesModal = (order: any) => {
    const d = order.detalhes;
    if (!d) return;

    MySwal.fire({
      showCloseButton: true,
      showConfirmButton: false,
      width: 720,
      customClass: {
        popup: 'rounded-xl shadow-2xl border border-border/50 bg-card p-0 overflow-hidden',
        closeButton: 'text-muted-foreground hover:text-foreground mt-2 mr-2',
        htmlContainer: 'm-0 p-0 text-left'
      },
      html: (
        <div className="w-full text-foreground bg-card text-left">
          <div className="bg-muted/50 border-b border-border/40 p-4 pr-12 flex justify-between items-center text-left">
            <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" /> 
              Detalhes da Execução 
              <span className="text-muted-foreground font-normal ml-1">SS {order.ss}</span>
            </h4>
            <Badge variant={((d.qtd_documentos ?? 0) < 3) ? "destructive" : "secondary"} className="text-xs uppercase font-bold px-2 py-0.5">
              {((d.qtd_documentos ?? 0) < 3) ? '🔴 ' : '📄 '} 
              Documentos: {d.qtd_documentos || 0}
            </Badge>
          </div>

          <div className="p-6 grid grid-cols-2 gap-8 text-[13px] bg-background border-b border-border/20 text-left">
            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase mb-1.5 border-b border-border/30 pb-1">Dados da Execução</p>
                <div className="space-y-1 mt-1.5">
                  <p className="font-semibold flex justify-between gap-3 items-center whitespace-nowrap overflow-hidden">Equipe: <span className="font-normal text-muted-foreground truncate text-right">{d.equipe_executora || "-"}</span></p>
                  <p className="font-semibold flex justify-between gap-3 items-center whitespace-nowrap overflow-hidden">Horas em Exec.: <span className="font-normal text-muted-foreground truncate">{d.horas_execucao || "-"}</span></p>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase mb-1.5 border-b border-border/30 pb-1">Dados do Imóvel</p>
                <div className="space-y-1 mt-1.5">
                  <p className="font-semibold flex justify-between gap-3 items-center whitespace-nowrap overflow-hidden">Pavimentos: <span className="font-normal text-muted-foreground truncate">{d.imovel_pavimentos || "-"}</span></p>
                  <p className="font-semibold flex justify-between gap-3 items-center whitespace-nowrap overflow-hidden">Situação: <span className="font-normal text-muted-foreground truncate">{d.imovel_situacao || "-"}</span></p>
                  <p className="font-semibold flex justify-between gap-3 items-center whitespace-nowrap overflow-hidden">Res. Inferior: <span className="font-normal text-muted-foreground truncate">{d.imovel_res_inf || "-"}</span></p>
                  <p className="font-semibold flex justify-between gap-3 items-center whitespace-nowrap overflow-hidden">Res. Superior: <span className="font-normal text-muted-foreground truncate">{d.imovel_res_sup || "-"}</span></p>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase mb-1.5 border-b border-border/30 pb-1">Dados do HD</p>
                <div className="space-y-1 mt-1.5">
                  <p className="font-semibold flex justify-between gap-3 items-center whitespace-nowrap overflow-hidden">Número do HD: <span className="font-normal text-muted-foreground truncate">{d.hd_numero || "-"}</span></p>
                  <p className="font-semibold flex justify-between gap-3 items-center whitespace-nowrap overflow-hidden">Leitura: <span className="font-normal text-muted-foreground truncate">{d.hd_leitura || "-"}</span></p>
                  <p className="font-semibold flex justify-between gap-3 items-center whitespace-nowrap overflow-hidden">Pressão (mca): <span className="font-normal text-muted-foreground truncate">{d.hd_pressao || "-"}</span></p>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase mb-1.5 border-b border-border/30 pb-1">Dados da Ligação</p>
                <div className="space-y-1 mt-1.5">
                  <p className="font-semibold flex justify-between gap-3 items-center whitespace-nowrap overflow-hidden">Cor do lacre: <span className="font-normal text-muted-foreground truncate">{d.ligacao_lacre_cor || "-"}</span></p>
                  <p className="font-semibold flex justify-between gap-3 items-center whitespace-nowrap overflow-hidden">Situação lig.: <span className="font-normal text-muted-foreground truncate">{d.ligacao_situacao || "-"}</span></p>
                </div>
                {d.motivo_falta_dagua?.includes("Roubo") && (
                  <div className="mt-2 text-[11px] font-bold text-destructive flex items-center gap-1.5 bg-destructive/5 px-2 py-1 rounded border border-destructive/20">
                    <AlertTriangle className="h-3 w-3" />
                    Alerta: Roubo/furto de hidrômetro
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase mb-1.5 border-b border-border/30 pb-1">Análise: Lado Direito</p>
                <div className="space-y-1 mt-1.5">
                  <p className="font-semibold flex justify-between gap-3 items-center whitespace-nowrap overflow-hidden">Nº HD: <span className="font-normal text-muted-foreground truncate">{d.hd_lado_direito || "-"}</span></p>
                  <p className="font-semibold flex justify-between gap-3 items-center whitespace-nowrap overflow-hidden">Leitura: <span className="font-normal text-muted-foreground truncate">{d.hd_lado_direito_leitura || "-"}</span></p>
                  <p className="font-semibold flex justify-between gap-3 items-center whitespace-nowrap overflow-hidden">Pressão: <span className="font-normal text-muted-foreground truncate">{d.hd_lado_direito_pressao || "-"}</span></p>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase mb-1.5 border-b border-border/30 pb-1">Análise: Lado Esquerdo</p>
                <div className="space-y-1 mt-1.5">
                  <p className="font-semibold flex justify-between gap-3 items-center whitespace-nowrap overflow-hidden">Nº HD: <span className="font-normal text-muted-foreground truncate">{d.hd_lado_esquerdo || "-"}</span></p>
                  <p className="font-semibold flex justify-between gap-3 items-center whitespace-nowrap overflow-hidden">Leitura: <span className="font-normal text-muted-foreground truncate">{d.hd_lado_esquerdo_leitura || "-"}</span></p>
                  <p className="font-semibold flex justify-between gap-3 items-center whitespace-nowrap overflow-hidden">Pressão: <span className="font-normal text-muted-foreground truncate">{d.hd_lado_esquerdo_pressao || "-"}</span></p>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase mb-1.5 border-b border-border/30 pb-1">Dados Complementares</p>
                <div className="space-y-1 mt-1.5">
                  <p className="font-semibold flex justify-between gap-3 items-center whitespace-nowrap overflow-hidden">Abast. após exec: <span className="font-normal text-muted-foreground truncate">{d.sit_abast_apos_exec || "-"}</span></p>
                  <p className="font-semibold flex justify-between gap-3 items-center whitespace-nowrap overflow-hidden">Necessidade Desob: <span className="font-normal text-muted-foreground truncate">{d.necessidade_desob_ramal || "-"}</span></p>
                  <p className="font-semibold flex justify-between gap-3 items-center whitespace-nowrap overflow-hidden">Gerar desobstrução?: <span className="font-normal text-muted-foreground truncate">{d.deseja_gerar_desobstrucao || "-"}</span></p>
                  <p className="font-semibold flex justify-between gap-3 items-center whitespace-nowrap overflow-hidden">Motivo da falta: <span className="font-normal text-muted-foreground truncate">{d.motivo_falta_dagua || "-"}</span></p>
                  <p className="font-semibold flex justify-between gap-3 items-center whitespace-nowrap overflow-hidden">Usuário presente?: <span className="font-normal text-muted-foreground truncate">{d.usuario_presente || "-"}</span></p>
                </div>
              </div>

              {d.sec_ss && d.sec_tipo && (
                <div className="col-span-2 mt-2 bg-blue-50/50 p-3 border border-blue-200 rounded text-left">
                  <p className="text-xs font-bold text-blue-800 tracking-wider uppercase mb-1">Serviço Secundário Gerado</p>
                  <div className="space-y-1 mt-1.5">
                    <p className="font-semibold text-blue-900 flex justify-between">SS: <span className="font-normal text-blue-700">{d.sec_ss}</span></p>
                    <p className="font-semibold text-blue-900 flex justify-between">Tipo: <span className="font-normal text-blue-700">{d.sec_tipo}</span></p>
                  </div>
                </div>
              )}
              
              <div className="pt-2 text-left">
                <p className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase mb-1.5">Material Utilizado</p>
                <p className="font-normal text-muted-foreground line-clamp-2 text-xs bg-muted/30 p-2 rounded">{d.material_utilizado || "Nenhum material informado."}</p>
              </div>
            </div>
          </div>
          
          <div className="p-4 bg-muted/20 text-left">
            <p className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase mb-1.5">Observação do Encerramento</p>
            <p className="font-normal text-foreground text-xs bg-background border border-border/40 p-3 rounded max-h-[100px] overflow-y-auto whitespace-pre-wrap">
              {d.obs_encerramento || "Nenhuma observação informada."}
            </p>
          </div>
        </div>
      )
    });
  };

  // Memoizar o mapa de insights por SS para busca ultra-rápida (O(1))
  const insightsMap = useMemo(() => {
    const map = new Map<string, typeof insights[0]>();
    (insights || []).forEach((item) => {
      if (item?.numero_os) {
        map.set(item.numero_os, item);
      }
    });
    return map;
  }, [insights]);

  // Função auxiliar para exibir a matrícula real ou extraída
  const getMatriculaDisplay = (r: any, insight?: any) => {
    if (r.matricula && r.matricula !== '-' && r.matricula !== '—' && r.matricula !== 'null' && String(r.matricula).trim() !== '') {
      return String(r.matricula);
    }
    if (insight?.matricula && insight.matricula !== '-' && insight.matricula !== '—' && String(insight.matricula).trim() !== '') {
      return String(insight.matricula);
    }
    const text = (r.observacao || "") + " " + (r.especificacao || "");
    const match = text.match(/MATRICULA:\s*(\d+)/i);
    if (match) {
      return match[1];
    }
    return r.cep ? `MAT-${r.cep}` : `MAT-${String(r.numero_os || "000000").slice(-6)}`;
  };

  // Dataset para Tab 1: Falta d'Água Pendentes
  const pendingOrders = useMemo(() => {
    return faltaDagua.map((r) => {
      const insight = insightsMap.get(r.numero_os);
      const chanceReincidencia = insight?.chance_reincidencia ?? 0;
      const isReincidenteOuLote = chanceReincidencia >= 50;

      return {
        id: r.id,
        ss: r.numero_os,
        matricula: getMatriculaDisplay(r, insight),
        servico: r.servico || "Falta d'Água",
        bairro: r.bairro_nome || "-",
        logradouro: r.logradouro || "-",
        obsSS: r.observacao || r.especificacao || "-",
        dtTramitacao: r.data_tramitacao,
        isReincidenteOuLote,
        chanceReincidencia,
      };
    });
  }, [faltaDagua, insightsMap]);

  // Dataset para Tab 2: Falta d'Água Executadas | Dia Anterior
  const executedOrders = useMemo(() => {
    return faltaDaguaEx
      .filter((r: any) => {
        const sit = (r.unidade_atual || "Concluída Executada").toLowerCase();
        const isConcluida = sit.includes("concluída") || sit.includes("concluida");
        if (!isConcluida) return false;
        
        // Filtro de Situação
        if (filterSitOS === "Executada" && sit.includes("não executada")) return false;
        if (filterSitOS === "Não Executada" && !sit.includes("não executada")) return false;
        
        // Filtro de POP
        if (filterPOP !== "Todos") {
          const atende = r.atende_pop || "-";
          if (filterPOP === "Sim" && atende !== "Sim") return false;
          if (filterPOP === "Parcial" && atende !== "Parcial") return false;
          if (filterPOP === "Não" && (atende !== "Não" && !String(atende).startsWith("N"))) return false;
        }

        // Filtro estrito: Apenas "Ontem" e "Hoje" (Calendário) conforme solicitado
        const targetDate = r.data_conclusao || r.data_importacao || r.criado_em;
        if (!targetDate) return true;
        
        const d = new Date(targetDate);
        const today = new Date();
        const startOfYesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
        
        return d >= startOfYesterday;
      })
      .map((r: any) => ({
      id: r.id,
      ss: r.numero_os,
      matricula: getMatriculaDisplay(r),
      servico: r.servico || "Falta d'Água Executada",
      bairro: r.bairro_nome || "-",
      logradouro: r.logradouro || "-",
      numImovel: (r.num_imovel && r.num_imovel !== '-' && r.num_imovel !== 'null') ? r.num_imovel : ((r.cep && r.cep !== '-' && r.cep !== 'null') ? r.cep : "-"),
      dtAbertura: r.data_abertura || r.criado_em || r.data_importacao,
      dtTramitacao: r.data_tramitacao,
      dtConclusao: r.data_conclusao || r.data_tramitacao || r.data_importacao,
      obsEnc: r.observacao || r.especificacao || "-",
      situacaoOS: r.unidade_atual || "Concluída Executada",
      atendeuPOP: r.atende_pop || "-",
      popMotivo: r.pop_motivo || "",
      detalhes: r.equipe_executora ? {
        equipe_executora: r.equipe_executora,
        horas_execucao: r.horas_execucao,
        horas_atendimento: r.horas_atendimento,
        hd_leitura: r.hd_leitura,
        hd_numero: r.hd_numero,
        hd_pressao: r.hd_pressao,
        imovel_pavimentos: r.imovel_pavimentos,
        imovel_situacao: r.imovel_situacao,
        imovel_res_inf: r.imovel_res_inf,
        imovel_res_sup: r.imovel_res_sup,
        ligacao_lacre_cor: r.ligacao_lacre_cor,
        ligacao_situacao: r.ligacao_situacao,
        hd_lado_direito: r.hd_lado_direito,
        hd_lado_direito_leitura: r.hd_lado_direito_leitura,
        hd_lado_direito_pressao: r.hd_lado_direito_pressao,
        hd_lado_esquerdo: r.hd_lado_esquerdo,
        hd_lado_esquerdo_leitura: r.hd_lado_esquerdo_leitura,
        hd_lado_esquerdo_pressao: r.hd_lado_esquerdo_pressao,
        sit_abast_apos_exec: r.sit_abast_apos_exec,
        necessidade_desob_ramal: r.necessidade_desob_ramal,
        deseja_gerar_desobstrucao: r.deseja_gerar_desobstrucao,
        motivo_falta_dagua: r.motivo_falta_dagua,
        ponto_referencia: r.ponto_referencia,
        usuario_presente: r.usuario_presente,
        material_utilizado: r.material_utilizado,
        obs_encerramento: r.obs_encerramento,
        qtd_documentos: r.qtd_documentos,
        status_documentos: r.status_documentos,
        sec_ss: r.sec_ss,
        sec_tipo: r.sec_tipo,
      } : null
    }));
  }, [faltaDaguaEx, filterSitOS, filterPOP]);

  // Filtragem por busca em cada dataset
  const filteredPending = useMemo(() => {
    if (!searchTerm) return pendingOrders;
    const term = searchTerm.toLowerCase();
    return pendingOrders.filter(
      (o) =>
        o.ss.toLowerCase().includes(term) ||
        o.matricula.toLowerCase().includes(term) ||
        o.bairro.toLowerCase().includes(term) ||
        o.logradouro.toLowerCase().includes(term) ||
        o.obsSS.toLowerCase().includes(term)
    );
  }, [pendingOrders, searchTerm]);

  const filteredExecuted = useMemo(() => {
    if (!searchTerm) return executedOrders;
    const term = searchTerm.toLowerCase();
    return executedOrders.filter(
      (o) =>
        o.ss.toLowerCase().includes(term) ||
        o.matricula.toLowerCase().includes(term) ||
        o.bairro.toLowerCase().includes(term) ||
        o.logradouro.toLowerCase().includes(term) ||
        o.obsEnc.toLowerCase().includes(term)
    );
  }, [executedOrders, searchTerm]);

  const currentDataset = activeTab === 'pendentes' ? filteredPending : filteredExecuted;
  const totalPages = Math.ceil(currentDataset.length / ITEMS_PER_PAGE) || 1;

  const displayedDataset = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return currentDataset.slice(start, start + ITEMS_PER_PAGE);
  }, [currentDataset, currentPage]);

  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return "-";
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      const hasTime = date.getHours() !== 0 || date.getMinutes() !== 0 || date.getSeconds() !== 0;
      return date.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        ...(hasTime ? { hour: '2-digit', minute: '2-digit' } : {}),
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="bg-card border border-border/40 rounded-xl flex flex-col h-full overflow-hidden shadow-xs">
      {/* Cabeçalho com Abas Customizadas */}
      <div className="p-2 px-3 border-b border-border/30 flex items-center justify-between gap-2 flex-wrap bg-muted/20 shrink-0">
        <div className="flex items-center gap-1.5">
          {/* Aba 1: Listagem Falta d'Água Pendentes */}
          <button
            onClick={() => {
              setActiveTab('pendentes');
              setCurrentPage(1);
            }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'pendentes'
                ? "bg-muted/60 text-foreground border border-border/40 shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40 border border-transparent"
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            Falta d'água pendente
            <Badge variant="secondary" className="text-[10px] font-mono px-1.5 py-0 ml-0.5">
              {pendingOrders.length}
            </Badge>
          </button>

          {/* Aba 2: Falta d'Água Executadas | Ontem e Hoje */}
          <button
            onClick={() => {
              setActiveTab('executadas');
              setCurrentPage(1);
            }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'executadas'
                ? "bg-muted/60 text-foreground border border-border/40 shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40 border border-transparent"
            }`}
          >
            <CheckCircle2 className={`h-3.5 w-3.5 ${activeTab === 'executadas' ? 'text-emerald-500' : ''}`} />
            Falta d'água executada 48hrs
            <Badge variant="secondary" className="text-[10px] font-mono px-1.5 py-0 ml-0.5">
              {executedOrders.length}
            </Badge>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'executadas' && (
            <>
              <select
                value={filterSitOS}
                onChange={(e) => setFilterSitOS(e.target.value)}
                className="h-7 px-2 text-[11px] rounded-md border border-border/40 bg-background text-foreground shrink-0 focus:outline-none"
              >
                <option value="Todos">Situação: Todas</option>
                <option value="Executada">Concluída Executada</option>
                <option value="Não Executada">Concluída Não Executada</option>
              </select>

              <select
                value={filterPOP}
                onChange={(e) => setFilterPOP(e.target.value)}
                className="h-7 px-2 text-[11px] rounded-md border border-border/40 bg-background text-foreground shrink-0 focus:outline-none"
              >
                <option value="Todos">POP: Todos</option>
                <option value="Sim">POP Atendido</option>
                <option value="Parcial">POP Parcial</option>
                <option value="Não">POP Não Atendido</option>
              </select>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setCollapseDates(!collapseDates)}
                className="h-7 px-2 text-[11px] font-semibold transition-all cursor-pointer bg-muted/30 text-muted-foreground hover:text-foreground border-border/40 shrink-0"
                title={collapseDates ? "Clique para expandir as 3 colunas de datas" : "Clique para recolher as datas e expandir a Observação de Encerramento"}
              >
                {collapseDates ? (
                  <>
                    <Calendar className="h-3.5 w-3.5 mr-1 inline" />
                    <span>Exibir Datas</span>
                  </>
                ) : (
                  <>
                    <EyeOff className="h-3.5 w-3.5 mr-1 inline" />
                    <span>Recolher Datas</span>
                  </>
                )}
              </Button>
            </>
          )}

          {/* Busca rápida */}
          <div className="relative w-40 sm:w-56 shrink-0">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar SS, Matrícula, Bairro..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="h-7 text-[11px] pl-8 pr-2 bg-background border-border/40"
            />
          </div>
        </div>
      </div>

      {/* Infográfico APENAS para a Aba Pendentes */}
      {activeTab === 'pendentes' && (
        <div className="px-3 py-1.5 bg-muted/10 border-b border-border/20 flex items-center justify-between text-[11px] shrink-0 gap-2 flex-wrap">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Activity className="h-3.5 w-3.5 text-primary shrink-0 animate-pulse" />
            <span className="font-medium">
              Monitoramento de Reincidências:
            </span>
            <span className="text-foreground font-semibold">
              {pendingOrders.length} solicitações sob varredura preditiva da IA
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground/80 font-mono">
              Visão: Aberta e Programada (Pendentes)
            </span>
          </div>
        </div>
      )}

      {/* Corpo da Tabela com Rolagem Vertical e Preenchimento Completo */}
      <div className="flex-1 overflow-y-auto min-h-0 relative">
        {activeTab === 'pendentes' ? (
          /* TABELA 1: Falta d'Água Pendentes (7 Colunas com MATRÍCULA) */
          <Table>
            <TableHeader className="bg-muted/50 sticky top-0 z-10 backdrop-blur-md">
              <TableRow className="border-border/30 hover:bg-transparent">
                <TableHead className="w-[95px] text-[11px] font-bold text-foreground shrink-0">SS</TableHead>
                <TableHead className="w-[110px] text-[11px] font-bold text-foreground shrink-0">MATRÍCULA</TableHead>
                <TableHead className="w-[125px] text-[11px] font-bold text-foreground shrink-0">SERVIÇO</TableHead>
                <TableHead className="w-[125px] text-[11px] font-bold text-foreground shrink-0">BAIRRO</TableHead>
                <TableHead className="w-[180px] text-[11px] font-bold text-foreground shrink-0">LOGRADOURO</TableHead>
                <TableHead className="min-w-[250px] text-[11px] font-bold text-foreground">Obs da SS</TableHead>
                <TableHead className="w-[135px] text-[11px] font-bold text-foreground whitespace-nowrap shrink-0">Data/Hora Tramitação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayedDataset.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-12 text-xs font-medium">
                    Nenhuma solicitação de falta d'água pendente encontrada.
                  </TableCell>
                </TableRow>
              ) : (
                (displayedDataset as typeof pendingOrders).map((order) => (
                  <TableRow key={order.id} className="border-border/20 hover:bg-muted/30 transition-colors">
                    <TableCell className="font-mono text-xs font-bold text-primary py-2 shrink-0">
                      {order.ss}
                    </TableCell>
                    <TableCell className="font-mono text-xs font-semibold text-foreground py-2 shrink-0">
                      {order.matricula}
                    </TableCell>
                    <TableCell className="text-[11px] font-semibold text-foreground py-2 shrink-0 truncate max-w-[125px]" title={order.servico}>
                        {order.isReincidenteOuLote && <AlertTriangle className="h-2.5 w-2.5 mr-1 text-amber-500 inline" title={`Atenção: Risco/Reincidência Identificada (${Math.round(order.chanceReincidencia)}%)`} />}
                        {order.servico}
                    </TableCell>
                    <TableCell className="text-xs py-2 font-medium text-foreground truncate max-w-[125px] shrink-0" title={order.bairro}>
                      {order.bairro}
                    </TableCell>
                    <TableCell className="text-xs text-foreground py-2 truncate max-w-[180px] shrink-0" title={order.logradouro}>
                      {order.logradouro}
                    </TableCell>
                    <TableCell className="text-xs text-foreground py-2 leading-tight" title={order.obsSS}>
                      <span className="line-clamp-2">{order.obsSS}</span>
                    </TableCell>
                    <TableCell className="text-xs font-mono font-medium text-foreground py-2 whitespace-nowrap shrink-0">
                      {formatDateTime(order.dtTramitacao)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        ) : (
          /* TABELA 2: Falta d'Água Executadas | Ontem e Hoje */
          <Table>
            <TableHeader className="bg-muted/50 sticky top-0 z-10 backdrop-blur-md">
              <TableRow className="border-border/30 hover:bg-transparent">
                <TableHead className="w-[90px] text-[11px] font-bold text-foreground shrink-0 text-left">SS</TableHead>
                <TableHead className="w-[100px] text-[11px] font-bold text-foreground shrink-0 text-left">Matrícula</TableHead>
                <TableHead className="w-[120px] text-[11px] font-bold text-foreground shrink-0 text-left">Serviço</TableHead>
                <TableHead className="w-[120px] text-[11px] font-bold text-foreground shrink-0 text-left">Bairro</TableHead>
                <TableHead className="w-[150px] text-[11px] font-bold text-foreground shrink-0 text-left">Logradouro</TableHead>
                <TableHead className="w-[85px] text-[11px] font-bold text-foreground shrink-0 text-center">Nº</TableHead>
                {!collapseDates ? (
                  <>
                    <TableHead className="w-[115px] text-[11px] font-bold text-foreground whitespace-nowrap shrink-0 text-center">Abertura</TableHead>
                    <TableHead className="w-[115px] text-[11px] font-bold text-foreground whitespace-nowrap shrink-0 text-center">Tramitação</TableHead>
                    <TableHead className="w-[115px] text-[11px] font-bold text-foreground whitespace-nowrap shrink-0 text-center">Conclusão</TableHead>
                  </>
                ) : (
                  <TableHead className="w-[65px] text-[11px] font-bold text-foreground whitespace-nowrap shrink-0 text-center" title="Clique no botão acima para expandir as datas">Datas</TableHead>
                )}
                <TableHead className={`${collapseDates ? "min-w-[450px]" : "min-w-[220px]"} text-[11px] font-bold text-foreground text-left transition-all`}>Obs de Enc</TableHead>
                <TableHead className="w-[130px] text-[11px] font-bold text-foreground shrink-0 text-center">Sit. da OS</TableHead>
                <TableHead className="w-[105px] text-[11px] font-bold text-foreground shrink-0 text-center">POP Atendido</TableHead>
                <TableHead className="w-[80px] text-[11px] font-bold text-foreground shrink-0 text-center">Detalhes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayedDataset.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={collapseDates ? 11 : 13} className="text-center text-muted-foreground py-12 text-xs font-medium">
                    Nenhuma ordem de serviço executada no dia anterior.
                  </TableCell>
                </TableRow>
              ) : (
                (displayedDataset as typeof executedOrders).map((order) => (
                  <TableRow key={order.id} className="border-border/20 hover:bg-muted/30 transition-colors cursor-default">
                        <TableCell className="font-mono text-xs font-bold text-primary py-2 shrink-0 text-left">
                          {order.ss}
                        </TableCell>
                        <TableCell className="font-mono text-xs font-semibold text-foreground py-2 shrink-0 text-left">
                          {order.matricula}
                        </TableCell>
                        <TableCell className="text-xs py-2 font-medium text-foreground truncate max-w-[120px] shrink-0 text-left" title={order.servico}>
                          {order.servico}
                        </TableCell>
                        <TableCell className="text-xs py-2 font-medium text-foreground truncate max-w-[120px] shrink-0 text-left" title={order.bairro}>
                          {order.bairro}
                        </TableCell>
                        <TableCell className="text-xs text-foreground py-2 truncate max-w-[150px] shrink-0 text-left" title={order.logradouro}>
                          {order.logradouro}
                        </TableCell>
                        <TableCell className="text-xs font-mono text-foreground py-2 shrink-0 text-center">
                          {order.numImovel}
                        </TableCell>
                        {!collapseDates ? (
                          <>
                            <TableCell className="text-xs font-mono text-foreground py-2 whitespace-nowrap shrink-0 text-center">
                              {formatDateTime(order.dtAbertura)}
                            </TableCell>
                            <TableCell className="text-xs font-mono text-foreground py-2 whitespace-nowrap shrink-0 text-center">
                              {formatDateTime(order.dtTramitacao)}
                            </TableCell>
                            <TableCell className="text-xs font-mono text-foreground py-2 whitespace-nowrap shrink-0 text-center">
                              {formatDateTime(order.dtConclusao)}
                            </TableCell>
                          </>
                        ) : (
                          <TableCell
                            className="text-[11px] font-mono text-muted-foreground py-2 shrink-0 text-center cursor-help"
                            title={`• Abertura: ${formatDateTime(order.dtAbertura)}\n• Tramitação: ${formatDateTime(order.dtTramitacao)}\n• Conclusão: ${formatDateTime(order.dtConclusao)}`}
                          >
                            ⏱️
                          </TableCell>
                        )}
                        <TableCell className="text-xs text-foreground py-2 leading-snug text-left" title={order.obsEnc}>
                          <span className={collapseDates ? "line-clamp-4" : "line-clamp-2"}>{order.obsEnc}</span>
                        </TableCell>
                        <TableCell className="text-xs text-foreground py-2 shrink-0 text-center font-medium">
                          {order.situacaoOS}
                        </TableCell>
                        <TableCell className="text-xs py-2 shrink-0 text-center">
                          {order.situacaoOS.includes('Não Executada') ? (
                             <span className="text-muted-foreground/60 font-mono text-[10px]">N/A</span>
                          ) : (order as any).atendeuPOP === "Sim" ? (
                            <button 
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                Swal.fire({
                                  title: 'POP Atendido',
                                  text: (order as any).popMotivo,
                                  icon: 'success',
                                  confirmButtonColor: '#3B82F6'
                                });
                              }}
                              className="bg-blue-500/15 text-blue-500 border border-blue-500/30 px-2 py-1 rounded cursor-pointer font-bold w-full"
                            >
                              Sim
                            </button>
                          ) : (order as any).atendeuPOP === "Parcial" ? (
                            <button 
                              onClick={(e) => { 
                                e.stopPropagation();
                                const motivos = ((order as any).popMotivo || "").split("|").map((m: string) => m.trim()).filter((m: string) => m.length > 0);
                                const htmlList = `<div style="text-align: left;"><ul style="list-style-type: disc; padding-left: 20px;">${motivos.map((m: string) => `<li style="margin-bottom: 8px; font-size: 0.9rem;">${m}</li>`).join('')}</ul></div>`;
                                Swal.fire({
                                  title: 'POP Parcialmente Atendido',
                                  html: htmlList,
                                  icon: 'info',
                                  confirmButtonColor: '#EAB308'
                                });
                              }}
                              className="bg-yellow-500/15 text-yellow-500 border border-yellow-500/30 px-2 py-1 rounded cursor-pointer font-bold w-full"
                            >
                              Parcial
                            </button>
                          ) : (String((order as any).atendeuPOP).startsWith("N")) ? (
                            <button 
                              onClick={(e) => { 
                                e.stopPropagation();
                                const motivos = ((order as any).popMotivo || "").split("|").map((m: string) => m.trim()).filter((m: string) => m.length > 0);
                                const htmlList = `<div style="text-align: left;"><ul style="list-style-type: disc; padding-left: 20px;">${motivos.map((m: string) => `<li style="margin-bottom: 8px; font-size: 0.9rem;">${m}</li>`).join('')}</ul></div>`;
                                Swal.fire({
                                  title: 'Falhas no POP',
                                  html: htmlList,
                                  icon: 'warning',
                                  confirmButtonColor: '#EF4444'
                                });
                              }}
                              className="bg-red-500/15 text-red-500 border border-red-500/30 px-2 py-1 rounded cursor-pointer font-bold w-full"
                            >
                              Não
                            </button>
                          ) : (
                            <span className="text-muted-foreground/60 font-mono">—</span>
                          )}
                        </TableCell>
                      
                        <TableCell className="text-xs py-2 shrink-0 text-center">
                          {order.detalhes ? (
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-muted-foreground hover:bg-muted hover:text-foreground flex justify-center items-center mx-auto transition-colors" onClick={() => showDetalhesModal(order)} title="Ver Detalhes"><FileText className="h-3.5 w-3.5" /></Button>
                          ) : (
                            <span className="text-muted-foreground/50">—</span>
                          )}
                        </TableCell>

                      </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Rodapé com Paginação */}
      <div className="p-2 px-3 border-t border-border/30 flex items-center justify-between gap-2 flex-wrap bg-muted/20 shrink-0">
        <span className="text-[11px] text-muted-foreground font-medium">
          Exibindo <strong className="text-foreground">{displayedDataset.length}</strong> de{" "}
          <strong className="text-foreground">{currentDataset.length}</strong> solicitações
        </span>

        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
            disabled={currentPage === 1}
            className="h-7 w-7 p-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <span className="text-xs font-semibold px-2 text-foreground font-mono">
            {currentPage} / {totalPages}
          </span>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="h-7 w-7 p-0"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      
    </div>
  );
}
