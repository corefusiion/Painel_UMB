import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { materialsData } from "@/data/mockData";

export function MaterialsChart() {
  return (
    <Card className="bg-card border border-border/50 shadow-none">
      <CardHeader className="pb-2 px-6 pt-6">
        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-widest">
          Evolução de Materiais
        </CardTitle>
      </CardHeader>
      <CardContent className="px-6 pb-6">
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={materialsData.evolucaoMensal}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
              <XAxis 
                dataKey="mes" 
                tick={{ fill: '#9ca3af', fontSize: 11, fontWeight: 400 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis 
                tick={{ fill: '#9ca3af', fontSize: 11, fontWeight: 400 }}
                axisLine={false}
                tickLine={false}
                width={40}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'white', 
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  fontSize: '12px'
                }}
              />
              <Legend 
                wrapperStyle={{ fontSize: '12px', paddingTop: '16px' }}
                iconType="line"
              />
              <Line
                type="monotone"
                dataKey="enviado"
                name="Enviado"
                stroke="#4169a8"
                strokeWidth={2}
                dot={{ fill: '#4169a8', r: 3, strokeWidth: 0 }}
                activeDot={{ r: 5, strokeWidth: 0 }}
              />
              <Line
                type="monotone"
                dataKey="utilizado"
                name="Utilizado"
                stroke="#1a237e"
                strokeWidth={2}
                dot={{ fill: '#1a237e', r: 3, strokeWidth: 0 }}
                activeDot={{ r: 5, strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
