import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { RefreshCw, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DashboardHeaderProps {
  onImportClick?: () => void;
  onToggleSidebar?: () => void;
  isSidebarCollapsed?: boolean;
}

export function DashboardHeader({ onImportClick, onToggleSidebar, isSidebarCollapsed }: DashboardHeaderProps) {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <header className="h-14 shrink-0 px-4 sm:px-6 flex items-center shadow-xs" style={{ backgroundColor: '#0284c5' }}>
      <div className="max-w-[1920px] mx-auto w-full flex items-center justify-between">
        <div className="flex items-center gap-3">


          <h1 className="text-lg sm:text-xl lg:text-2xl font-light text-primary-foreground tracking-wide">
            Painel Gerencial UMB
          </h1>
          <span className="hidden md:inline-flex items-center text-[11px] text-white/80 bg-white/10 px-2.5 py-0.5 rounded-full border border-white/20 font-light">
            Desenvolvido por Gleisson Santos · Embasa UMB
          </span>
        </div>

        <div className="text-right flex items-center gap-3 sm:gap-4">
          {onImportClick && (
            <Button
              variant="outline"
              size="icon"
              onClick={onImportClick}
              className="h-8 w-8 bg-white/10 hover:bg-white/20 text-white border-white/20 transition-all rounded-lg shrink-0"
              title="Importar CSV (Demandas / Pavimento / Vazamentos / Executadas)"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          )}

          <p className="hidden sm:block text-primary-foreground/70 text-xs font-light tracking-wide">
            {format(currentTime, "EEEE, dd 'de' MMMM", { locale: ptBR })}
          </p>
          <div className="hidden sm:block h-4 w-px bg-primary-foreground/30" />
          <p className="text-xl sm:text-2xl lg:text-3xl font-light text-primary-foreground tracking-tight tabular-nums">
            {format(currentTime, "HH:mm")}
          </p>
        </div>
      </div>
    </header>
  );
}
