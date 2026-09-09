import { useMemo } from "react";
import { BarChart3 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, Cell } from "recharts";
import type { FaltaDaguaRecord } from "@/hooks/useFaltaDagua";

interface WaterShortageBairrosDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  records: FaltaDaguaRecord[];
}

const ssaColors = [
  "hsl(var(--destructive))",
  "hsl(var(--warning))",
  "hsl(var(--primary))",
  "hsl(var(--muted-foreground))",
  "hsl(var(--success))",
];

const lfColors = [
  "hsl(var(--primary))",
  "hsl(var(--warning))",
  "hsl(var(--destructive))",
  "hsl(var(--success))",
  "hsl(var(--muted-foreground))",
];

function getTop5Bairros(records: FaltaDaguaRecord[]) {
  const filtered = records.filter(r => !r.servico?.includes("37"));
  const map: Record<string, number> = {};
  filtered.forEach(r => {
    const bairro = r.bairro_nome || "Desconhecido";
    map[bairro] = (map[bairro] || 0) + 1;
  });
  return Object.entries(map)
    .map(([bairro, count]) => ({ bairro, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

function BairroChart({ data, colors, title, total }: { data: { bairro: string; count: number }[]; colors: string[]; title: string; total: number }) {
  const chartData = data.map((item, i) => ({
    name: item.bairro.length > 15 ? item.bairro.substring(0, 13) + "..." : item.bairro,
    fullName: item.bairro,
    value: item.count,
    fill: colors[i % colors.length],
  }));

  const chartConfig = data.reduce((acc, item, i) => {
    acc[item.bairro] = { label: item.bairro, color: colors[i % colors.length] };
    return acc;
  }, {} as Record<string, { label: string; color: string }>);

  if (chartData.length === 0) {
    return (
      <div className="flex-1">
        <h3 className="text-sm font-medium text-foreground mb-1">{title} <span className="text-muted-foreground font-normal">({total})</span></h3>
        <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">Nenhum dado</div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-w-0">
      <h3 className="text-sm font-medium text-foreground mb-2">{title} <span className="text-muted-foreground font-normal">({total} ocorrências)</span></h3>
      <ChartContainer config={chartConfig} className="h-44 w-full">
        <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 5, bottom: 5 }}>
          <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
          <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} width={90} />
          <ChartTooltip content={<ChartTooltipContent />} formatter={(value, _name, props) => [`${value} ocorrências`, props.payload.fullName]} />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={14}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>
    </div>
  );
}

export function WaterShortageBairrosDialog({ open, onOpenChange, records }: WaterShortageBairrosDialogProps) {
  const { ssaRecords, lfRecords, ssaTop5, lfTop5, ssaTotal, lfTotal } = useMemo(() => {
    const filtered = records.filter(r => !r.servico?.includes("37"));
    const ssa = filtered.filter(r => r.localidade?.includes("900"));
    const lf = filtered.filter(r => r.localidade?.includes("700"));
    return {
      ssaRecords: ssa,
      lfRecords: lf,
      ssaTop5: getTop5Bairros(ssa),
      lfTop5: getTop5Bairros(lf),
      ssaTotal: ssa.length,
      lfTotal: lf.length,
    };
  }, [records]);

  const today = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Top Bairros por Ocorrências
          </DialogTitle>
          <DialogDescription>
            {today} — {records.filter(r => !r.servico?.includes("37")).length} ocorrências totais
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-2">
          <BairroChart data={ssaTop5} colors={ssaColors} title="Salvador" total={ssaTotal} />
          <BairroChart data={lfTop5} colors={lfColors} title="Lauro de Freitas" total={lfTotal} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
