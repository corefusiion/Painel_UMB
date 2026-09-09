import { useDnaHidraulico } from "@/hooks/useDnaHidraulico";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

export function DnaHidraulicoIndicator() {
  const { count, masterEvents, diagnosticEvents, isLoading } = useDnaHidraulico();

  const isActive = count > 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="relative flex items-center justify-center h-4 w-4 cursor-pointer focus:outline-none"
          aria-label="DNA Hidráulico - Status"
        >
          {/* Ping ring */}
          <span
            className={`absolute inset-0 rounded-full ${
              isActive
                ? "bg-primary/40 animate-ping"
                : "bg-primary/15 animate-pulse"
            }`}
            style={{
              animationDuration: isActive ? "1.2s" : "3s",
            }}
          />
          {/* Dot */}
          <span
            className={`relative block h-2 w-2 rounded-full ${
              isActive ? "bg-primary" : "bg-primary/30"
            }`}
          />
        </button>
      </PopoverTrigger>

      <PopoverContent
        side="bottom"
        align="start"
        className="w-[420px] max-w-[90vw] p-0"
      >
        <div className="px-3 py-2 border-b border-border/30">
          <h4 className="text-xs font-semibold text-foreground">
            🧬 DNA Hidráulico — Eventos Detectados
          </h4>
          <p className="text-[10px] text-muted-foreground">
            {isLoading
              ? "Carregando..."
              : count === 0
                ? "Nenhum evento detectado no momento."
                : `${count} evento(s) ativo(s)`}
          </p>
        </div>

        {count > 0 && (
          <ScrollArea className="max-h-[320px]">
            {/* MASTER_EVENT */}
            {masterEvents.length > 0 && (
              <div className="p-2">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-destructive/40 text-destructive">
                    🔴 Alertas de Causa Raiz
                  </Badge>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="h-7 text-[10px]">Causa Provável</TableHead>
                      <TableHead className="h-7 text-[10px]">Localização</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {masterEvents.map((evt, i) => (
                      <TableRow key={`master-${i}`}>
                        <TableCell className="py-1.5 text-[11px]">{evt.probable_cause || evt.description}</TableCell>
                        <TableCell className="py-1.5 text-[11px] text-muted-foreground">{evt.location || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* ISOLATED_DIAGNOSTIC */}
            {diagnosticEvents.length > 0 && (
              <div className="p-2 pt-0">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/40 text-primary">
                    🔵 Análise do Especialista
                  </Badge>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="h-7 text-[10px]">Diagnóstico</TableHead>
                      <TableHead className="h-7 text-[10px]">Localização</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {diagnosticEvents.map((evt, i) => (
                      <TableRow key={`diag-${i}`}>
                        <TableCell className="py-1.5 text-[11px]">{evt.description}</TableCell>
                        <TableCell className="py-1.5 text-[11px] text-muted-foreground">{evt.location || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  );
}
