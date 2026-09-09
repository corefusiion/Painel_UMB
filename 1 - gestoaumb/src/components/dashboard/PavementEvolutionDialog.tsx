import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis } from "recharts";
import { pavementEvolutionData } from "@/data/mockData";

interface PavementEvolutionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const chartConfig = {
  "Z. Leste": { label: "Z. Leste", color: "hsl(var(--destructive))" },
  "Z. Norte": { label: "Z. Norte", color: "hsl(var(--warning))" },
  "Z. Sul": { label: "Z. Sul", color: "hsl(var(--primary))" },
  "Z. Oeste": { label: "Z. Oeste", color: "hsl(var(--muted-foreground))" },
  "Centro": { label: "Centro", color: "hsl(var(--success))" },
};

export function PavementEvolutionDialog({ open, onOpenChange }: PavementEvolutionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            Top 5 Bairros - Evolução Pavimento
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Notas de pavimento pendentes por região nos últimos 6 meses
          </p>
        </DialogHeader>
        
        <div className="mt-4">
          <ChartContainer config={chartConfig} className="h-64 w-full">
            <LineChart data={pavementEvolutionData} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
              <XAxis 
                dataKey="mes" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                width={40}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line 
                type="monotone" 
                dataKey="Z. Leste" 
                stroke="hsl(var(--destructive))" 
                strokeWidth={2} 
                dot={{ r: 3 }}
              />
              <Line 
                type="monotone" 
                dataKey="Z. Norte" 
                stroke="hsl(var(--warning))" 
                strokeWidth={2} 
                dot={{ r: 3 }}
              />
              <Line 
                type="monotone" 
                dataKey="Z. Sul" 
                stroke="hsl(var(--primary))" 
                strokeWidth={2} 
                dot={{ r: 3 }}
              />
              <Line 
                type="monotone" 
                dataKey="Z. Oeste" 
                stroke="hsl(var(--muted-foreground))" 
                strokeWidth={2} 
                dot={{ r: 3 }}
              />
              <Line 
                type="monotone" 
                dataKey="Centro" 
                stroke="hsl(var(--success))" 
                strokeWidth={2} 
                dot={{ r: 3 }}
              />
            </LineChart>
          </ChartContainer>

          {/* Legenda */}
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-4 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-4 rounded-full bg-destructive" />
              <span className="text-muted-foreground">Z. Leste</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-4 rounded-full bg-warning" />
              <span className="text-muted-foreground">Z. Norte</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-4 rounded-full bg-primary" />
              <span className="text-muted-foreground">Z. Sul</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-4 rounded-full bg-muted-foreground" />
              <span className="text-muted-foreground">Z. Oeste</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-4 rounded-full bg-success" />
              <span className="text-muted-foreground">Centro</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}