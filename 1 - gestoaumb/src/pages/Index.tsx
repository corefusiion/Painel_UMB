import { useState } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { PavementDonutChart } from "@/components/dashboard/PavementDonutChart";
import { PavimentosStatsCard } from "@/components/dashboard/PavimentosStatsCard";
import { PavimentosBairrosDialog } from "@/components/dashboard/PavimentosBairrosDialog";
import { WaterShortageStatsCard } from "@/components/dashboard/WaterShortageStatsCard";
import { WaterShortageBairrosDialog } from "@/components/dashboard/WaterShortageBairrosDialog";
import { WaterShortageTableDialog } from "@/components/dashboard/WaterShortageTableDialog";
import { CarroPipaTableDialog } from "@/components/dashboard/CarroPipaTableDialog";
import { WaterShortageMapDialog } from "@/components/dashboard/WaterShortageMapDialog";
import { ImportDataModal } from "@/components/dashboard/ImportDataModal";
import { LeaksEvolutionDialog } from "@/components/dashboard/LeaksEvolutionDialog";
import { LeaksStatsCard } from "@/components/dashboard/LeaksStatsCard";
import { BrainAIPanel } from "@/components/dashboard/BrainAIPanel";
import { ServiceOrdersTableCard } from "@/components/dashboard/ServiceOrdersTableCard";
import { Button } from "@/components/ui/button";

import { useFaltaDagua } from "@/hooks/useFaltaDagua";
import { useCarroPipa } from "@/hooks/useCarroPipa";
import { usePavimentos } from "@/hooks/usePavimentos";
import { useVazamentos } from "@/hooks/useVazamentos";

const Index = () => {
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isPavimentosBairrosDialogOpen, setIsPavimentosBairrosDialogOpen] = useState(false);
  const [isLeaksDialogOpen, setIsLeaksDialogOpen] = useState(false);
  const [isWaterShortageDialogOpen, setIsWaterShortageDialogOpen] = useState(false);
  const [isWaterShortageMapDialogOpen, setIsWaterShortageMapDialogOpen] = useState(false);
  const [isCarroPipaDialogOpen, setIsCarroPipaDialogOpen] = useState(false);
  const [isWaterShortageBairrosDialogOpen, setIsWaterShortageBairrosDialogOpen] = useState(false);
  const [isLeftColumnCollapsed, setIsLeftColumnCollapsed] = useState(false);
  const [isPredictiveCollapsed, setIsPredictiveCollapsed] = useState(false);

  const { records: waterShortageRecords } = useFaltaDagua();
  const { records: carroPipaRecords } = useCarroPipa();
  const { records: pavimentoRecords } = usePavimentos();
  const { records: vazamentoRecords } = useVazamentos();

  /* ── Shared section header ── */
  const SectionHeader = ({ children }: { children: React.ReactNode }) => (
    <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest pb-1 border-b border-border/30 shrink-0">
      {children}
    </h2>
  );

  const isMaintenanceMode = import.meta.env.VITE_MAINTENANCE_MODE === 'true';

  if (isMaintenanceMode) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-muted/30">
        <h1 className="text-2xl font-bold mb-4">Sistema em Manutenção</h1>
        <p className="text-muted-foreground">Estamos realizando melhorias no sistema. Voltaremos em breve.</p>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] flex flex-col bg-muted/30 overflow-hidden">
      <DashboardHeader
        onImportClick={() => setIsImportModalOpen(true)}
        onToggleSidebar={() => setIsLeftColumnCollapsed(!isLeftColumnCollapsed)}
        isSidebarCollapsed={isLeftColumnCollapsed}
      />

      <main className="flex-1 min-h-0 w-full max-w-[1920px] mx-auto p-2.5 sm:p-3 xl:p-3.5 flex flex-col overflow-y-auto xl:overflow-hidden">

        {/* ═══════════════════════════════════════════════
            MOBILE / TABLET (<1200px) — Scroll Vertical
            ═══════════════════════════════════════════════ */}
        <div className="flex flex-col gap-4 xl:hidden">
          {/* Grid de Indicadores para Tablets e Notebooks Pequenos */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <section className="flex flex-col gap-2">
              <SectionHeader>Falta D'Água</SectionHeader>
              <WaterShortageStatsCard
                onClick={() => setIsWaterShortageDialogOpen(true)}
                onCarroPipaClick={() => setIsCarroPipaDialogOpen(true)}
              />
            </section>

            <section className="flex flex-col gap-2">
              <SectionHeader>Pavimento</SectionHeader>
              <PavimentosStatsCard onClick={() => setIsPavimentosBairrosDialogOpen(true)} />
              <PavementDonutChart onClick={() => setIsPavimentosBairrosDialogOpen(true)} />
            </section>

            <section className="flex flex-col gap-2">
              <SectionHeader>Vazamentos</SectionHeader>
              <LeaksStatsCard onClick={() => setIsLeaksDialogOpen(true)} />
            </section>
          </div>

          {/* Grid de Painéis para Tablets e Notebooks Pequenos */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <section className="flex flex-col gap-2 lg:col-span-2">
              <SectionHeader>Análise Preditiva</SectionHeader>
              <div className="min-h-[450px] h-full flex flex-col">
                <BrainAIPanel />
              </div>
            </section>

            <section className="flex flex-col gap-2 lg:col-span-3">
              <SectionHeader>Ordens de Serviço</SectionHeader>
              <div className="min-h-[650px] flex-1 flex flex-col">
                <ServiceOrdersTableCard />
              </div>
            </section>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════
            DESKTOP (≥1200px) — Layout 3 Colunas Dinâmico
            ═══════════════════════════════════════════════ */}
        <div className="hidden xl:flex gap-3 flex-1 min-h-0 items-stretch">

          {/* Coluna 1 (Esquerda) — Retrátil com ícone minimalista */}
          <div
            className={`transition-all duration-300 ease-in-out h-full flex flex-col shrink-0 ${
              isLeftColumnCollapsed ? "w-10" : "w-[300px] 2xl:w-[330px]"
            }`}
          >
            {/* Header com botão de recolher minimalista */}
            <div className="flex items-center justify-between pb-1 border-b border-border/30 mb-2 shrink-0">
              {!isLeftColumnCollapsed && <SectionHeader>Indicadores</SectionHeader>}
              <button
                onClick={() => setIsLeftColumnCollapsed(!isLeftColumnCollapsed)}
                className="p-1 text-muted-foreground/70 hover:text-foreground hover:bg-muted/40 rounded-md transition-colors shrink-0 ml-auto flex items-center justify-center cursor-pointer"
                title={isLeftColumnCollapsed ? "Expandir Indicadores" : "Recolher Indicadores"}
              >
                {isLeftColumnCollapsed ? (
                  <PanelLeftOpen className="h-4 w-4" />
                ) : (
                  <PanelLeftClose className="h-4 w-4" />
                )}
              </button>
            </div>

            {/* Conteúdo da Coluna 1 */}
            {isLeftColumnCollapsed ? (
              <div className="flex-1 flex items-center justify-center border-r border-border/20 pb-12">
                <span className="text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-[0.2em]" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                  Indicadores
                </span>
              </div>
            ) : (
              <div className="flex-1 flex flex-col gap-2 min-h-0 overflow-y-auto pr-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                <section className="flex flex-col gap-1 shrink-0">
                  <WaterShortageStatsCard
                    onClick={() => setIsWaterShortageDialogOpen(true)}
                    onCarroPipaClick={() => setIsCarroPipaDialogOpen(true)}
                  />
                </section>

                <section className="flex flex-col gap-1 shrink-0">
                  <PavimentosStatsCard onClick={() => setIsPavimentosBairrosDialogOpen(true)} />
                  <PavementDonutChart onClick={() => setIsPavimentosBairrosDialogOpen(true)} />
                </section>

                <section className="flex flex-col gap-1 shrink-0">
                  <LeaksStatsCard onClick={() => setIsLeaksDialogOpen(true)} />
                </section>
              </div>
            )}
          </div>

          {/* Coluna 2 (Centro) — Análise Preditiva */}
          <div
            className={`transition-all duration-300 ease-in-out h-full flex flex-col shrink-0 ${
              isPredictiveCollapsed ? "w-10" : "w-[380px] 2xl:w-[420px]"
            }`}
          >
            <div className="flex items-center justify-between pb-1 border-b border-border/30 mb-2 shrink-0">
              {!isPredictiveCollapsed && <SectionHeader>Análise Preditiva</SectionHeader>}
              <button
                onClick={() => setIsPredictiveCollapsed(!isPredictiveCollapsed)}
                className="p-1 text-muted-foreground/70 hover:text-foreground hover:bg-muted/40 rounded-md transition-colors shrink-0 ml-auto flex items-center justify-center cursor-pointer"
                title={isPredictiveCollapsed ? "Expandir Análise Preditiva" : "Recolher Análise Preditiva"}
              >
                {isPredictiveCollapsed ? (
                  <PanelLeftOpen className="h-4 w-4" />
                ) : (
                  <PanelLeftClose className="h-4 w-4" />
                )}
              </button>
            </div>

            {isPredictiveCollapsed ? (
              <div className="flex-1 flex items-center justify-center border-r border-border/20 pb-12">
                <span className="text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-[0.2em]" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                  Análise Preditiva
                </span>
              </div>
            ) : (
              <div className="flex-1 min-h-0 flex flex-col">
                <BrainAIPanel />
              </div>
            )}
          </div>

          {/* Coluna 3 (Direita) — Tabela de Ordens de Serviço (Expande no espaço livre) */}
          <section className="flex-1 min-w-0 flex flex-col gap-1 min-h-0 h-full overflow-hidden">
            <SectionHeader>Ordens de Serviço</SectionHeader>
            <div className="flex-1 min-h-0 flex flex-col">
              <ServiceOrdersTableCard />
            </div>
          </section>

        </div>
      </main>

      {/* Modais e Diálogos */}
      <ImportDataModal open={isImportModalOpen} onOpenChange={setIsImportModalOpen} />
      <PavimentosBairrosDialog open={isPavimentosBairrosDialogOpen} onOpenChange={setIsPavimentosBairrosDialogOpen} records={pavimentoRecords} />
      <LeaksEvolutionDialog open={isLeaksDialogOpen} onOpenChange={setIsLeaksDialogOpen} records={vazamentoRecords} />
      <WaterShortageTableDialog open={isWaterShortageDialogOpen} onOpenChange={setIsWaterShortageDialogOpen} records={waterShortageRecords} />
      <WaterShortageMapDialog open={isWaterShortageMapDialogOpen} onOpenChange={setIsWaterShortageMapDialogOpen} />
      <CarroPipaTableDialog open={isCarroPipaDialogOpen} onOpenChange={setIsCarroPipaDialogOpen} records={carroPipaRecords} />
      <WaterShortageBairrosDialog open={isWaterShortageBairrosDialogOpen} onOpenChange={setIsWaterShortageBairrosDialogOpen} records={waterShortageRecords} />
    </div>
  );
};

export default Index;
