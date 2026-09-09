import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { useFaltaDagua } from "@/hooks/useFaltaDagua";

const chartColors = [
  "hsl(var(--destructive))",
  "hsl(var(--warning))",
  "hsl(var(--primary))",
  "hsl(var(--muted-foreground))",
  "hsl(var(--success))",
];

interface WaterShortageLineChartProps {
  onClick?: () => void;
}

export function WaterShortageLineChart({ onClick }: WaterShortageLineChartProps) {
  const { top5Bairros, isLoading } = useFaltaDagua();

  // Preparar dados para o gráfico de barras
  const chartData = top5Bairros.map((item, index) => ({
    name: item.bairro.length > 12 ? item.bairro.substring(0, 10) + "..." : item.bairro,
    fullName: item.bairro,
    value: item.count,
    fill: chartColors[index % chartColors.length],
  }));

  const chartConfig = top5Bairros.reduce((acc, item, index) => {
    acc[item.bairro] = {
      label: item.bairro,
      color: chartColors[index % chartColors.length],
    };
    return acc;
  }, {} as Record<string, { label: string; color: string }>);

  if (isLoading) {
    return (
      <Card className="bg-card border border-border/50 shadow-none shrink-0">
        <CardHeader className="pb-1 px-4 sm:px-5 pt-3 sm:pt-4">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-widest">
            Top 5 Bairros - Ocorrências
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 sm:px-5 pb-2 sm:pb-3">
          <Skeleton className="h-20 sm:h-24 lg:h-28 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (chartData.length === 0) {
    return (
      <Card className="bg-card border border-border/50 shadow-none shrink-0">
        <CardHeader className="pb-1 px-4 sm:px-5 pt-3 sm:pt-4">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-widest">
            Top 5 Bairros - Ocorrências
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 sm:px-5 pb-2 sm:pb-3">
          <div className="h-20 sm:h-24 lg:h-28 flex items-center justify-center text-muted-foreground text-sm">
            Nenhum dado disponível
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border border-border/50 shadow-none shrink-0 cursor-pointer hover:border-border transition-colors" onClick={onClick}>
        <CardHeader className="pb-1 px-4 sm:px-5 pt-3 sm:pt-4">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-widest">
          Top 5 Bairros - Ocorrências
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 sm:px-5 pb-2 sm:pb-3">
        <ChartContainer config={chartConfig} className="h-20 sm:h-24 lg:h-28 w-full">
          <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
            <XAxis 
              type="number" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            />
            <YAxis 
              type="category"
              dataKey="name"
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
              width={60}
            />
            <ChartTooltip 
              content={<ChartTooltipContent />}
              formatter={(value, name, props) => [`${value} ocorrências`, props.payload.fullName]}
            />
            <Bar 
              dataKey="value" 
              radius={[0, 4, 4, 0]}
              barSize={12}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>

        {/* Legenda compacta */}
        <div className="flex flex-wrap justify-center gap-x-2 gap-y-0.5 mt-1.5 text-[9px]">
          {chartData.map((item, index) => (
            <div key={index} className="flex items-center gap-0.5">
              <div 
                className="h-1.5 w-2 sm:w-3 rounded-full" 
                style={{ backgroundColor: item.fill }}
              />
              <span className="text-muted-foreground">{item.name}</span>
              <span className="font-medium text-foreground">({item.value})</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
