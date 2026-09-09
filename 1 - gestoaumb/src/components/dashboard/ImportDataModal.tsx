import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, FileSpreadsheet, Loader2, File, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { API_URL } from "@/lib/api";
import { parseWaterShortageCsv, parsePavimentoCsv, parseVazamentoCsv, parseCarroPipaCsv } from "@/utils/csvParser";
import { useFaltaDagua } from "@/hooks/useFaltaDagua";
import { usePavimentos } from "@/hooks/usePavimentos";
import { useVazamentos } from "@/hooks/useVazamentos";
import { useCarroPipa } from "@/hooks/useCarroPipa";

interface ImportDataModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const dataSections = [
  { value: "materials", label: "Gestão de Materiais (SGM)" },
  { value: "demands", label: "Gestão de Demandas (SGD)" },
  { value: "pavement", label: "Notas de Pavimento" },
  { value: "leaks", label: "Vazamentos" },
  { value: "waterShortage", label: "Falta D'água Pendentes" },
  { value: "waterShortageEx", label: "Falta D'água Executadas | Dia Anterior" },
  { value: "waterTruck", label: "Notas de Carro Pipa" },
];

export function ImportDataModal({ open, onOpenChange }: ImportDataModalProps) {
  const [selectedSection, setSelectedSection] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const { toast } = useToast();
  const { invalidateCache: invalidateFaltaDagua } = useFaltaDagua();
  const { invalidateCache: invalidatePavimentos } = usePavimentos();
  const { invalidateCache: invalidateVazamentos } = useVazamentos();
  const { invalidateCache: invalidateCarroPipa } = useCarroPipa();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const validTypes = [
        "text/csv",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel",
      ];
      if (validTypes.includes(selectedFile.type) || selectedFile.name.endsWith('.csv') || selectedFile.name.endsWith('.xlsx')) {
        setFile(selectedFile);
      } else {
        toast({
          title: "Formato inválido",
          description: "Por favor, selecione um arquivo CSV ou Excel (.xlsx)",
          variant: "destructive",
        });
      }
    }
  };

  const handleImport = async () => {
    if (!selectedSection || !file) {
      toast({
        title: "Campos obrigatórios",
        description: "Selecione a seção e o arquivo para importar.",
        variant: "destructive",
      });
      return;
    }

    setIsImporting(true);

    try {
      const formData = new FormData();
      formData.append("type", selectedSection);
      formData.append("file", file);

      const response = await fetch(`${API_URL}/import-csv`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || `Erro HTTP ${response.status}`);
      }

      const result = await response.json();

      // Invalidar cache para atualizar o dashboard
      if (selectedSection === "waterShortage" || selectedSection === "waterShortageEx") {
        invalidateFaltaDagua();
      } else if (selectedSection === "pavement") {
        invalidatePavimentos();
      } else if (selectedSection === "leaks") {
        invalidateVazamentos();
      } else if (selectedSection === "waterTruck") {
        invalidateCarroPipa();
      }

      toast({
        title: "Importação concluída",
        description: `${result.count || 0} registros importados com sucesso.`,
      });

      // Reset form
      setSelectedSection("");
      setFile(null);
      onOpenChange(false);

    } catch (error: any) {
      console.error("Erro na importação:", error);
      toast({
        title: "Erro na importação",
        description: error.message || "Ocorreu um erro ao processar o arquivo.",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleRemoveFile = () => {
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    };

    return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-w-[calc(100vw-2rem)] overflow-hidden">
        <DialogHeader className="space-y-1">
          <DialogTitle className="flex items-center gap-2 text-sm">
            <FileSpreadsheet className="h-4 w-4 text-secondary shrink-0" />
            Importar Dados (SQLite Local)
          </DialogTitle>
          <DialogDescription className="text-[11px]">
            Upload de CSV ou Excel processado via API Express local.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          {/* Seção de Destino */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Seção de Destino
            </label>
            <Select value={selectedSection} onValueChange={setSelectedSection}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Selecione a seção..." />
              </SelectTrigger>
              <SelectContent>
                {dataSections.map((section) => (
                  <SelectItem key={section.value} value={section.value}>
                    {section.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Upload de Arquivo */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Arquivo (CSV ou Excel)
            </label>
            {file ? (
              <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-2.5 py-1.5">
                <File className="h-3.5 w-3.5 text-secondary shrink-0" />
                <span className="text-xs text-foreground flex-1">
                  Arquivo carregado com sucesso
                </span>
                <button
                  type="button"
                  onClick={handleRemoveFile}
                  disabled={isImporting}
                  className="shrink-0 rounded-sm p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-50"
                  title="Remover arquivo"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isImporting}
                onClick={() => fileInputRef.current?.click()}
                className="w-full justify-start text-xs text-muted-foreground font-normal h-8"
              >
                <Upload className="h-3.5 w-3.5 mr-1.5 shrink-0" />
                Selecionar arquivo...
              </Button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileChange}
              className="hidden"
              disabled={isImporting}
            />
          </div>

          {/* Aviso para Falta D'Água */}
          {selectedSection === "waterShortage" && (
            <div className="text-[11px] text-muted-foreground bg-muted/20 p-2 rounded-md border border-border/30">
              <p className="font-medium mb-0.5">Formato esperado (CSV com separador ;):</p>
              <p className="break-words leading-relaxed">SS, Especificação, Serviço, Localidade, Bairro, Logradouro, Data/Hora Última Tramitação da OS</p>
              <p className="mt-1.5 text-warning">⚠️ Dados anteriores do dia serão substituídos.</p>
            </div>
          )}

          {/* Aviso para Notas de Pavimento */}
          {selectedSection === "pavement" && (
            <div className="text-[11px] text-muted-foreground bg-muted/20 p-2 rounded-md border border-border/30">
              <p className="font-medium mb-0.5">Formato esperado (CSV com separador ;):</p>
              <p className="leading-relaxed">SS, Especificação, Serviço, Localidade, Bairro, Logradouro, Data/Hora Última Tramitação</p>
              <p className="mt-0.5 text-muted-foreground/70">Tipo de pavimento detectado automaticamente pelo campo Serviço.</p>
              <p className="mt-1.5 text-warning">⚠️ Dados anteriores do dia serão substituídos.</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={isImporting}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleImport} disabled={!selectedSection || !file || isImporting}>
            {isImporting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                Importando...
              </>
            ) : (
              <>
                <Upload className="h-3.5 w-3.5 mr-1.5" />
                Importar
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
