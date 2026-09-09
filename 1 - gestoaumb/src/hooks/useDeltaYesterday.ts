import { useQuery } from "@tanstack/react-query";
import { API_URL } from "@/lib/api";

function getYesterdayDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
}

async function countByDate(table: string, date: string): Promise<number> {
  try {
    const { data, error } = await fetch(`${API_URL}/${table}`).then(res => res.json());
    
    if (error) {
      console.error(`Erro ao contar ${table} para ${date}:`, error);
      return 0;
    }
    const filtered = (data || []).filter((r: any) => r.data_importacao === date);
    return filtered.length;
  } catch (err) {
    console.error(`Erro ao contar ${table} para ${date}:`, err);
    return 0;
  }
}

export function useDeltaYesterday(table: string, todayCount: number) {
  const yesterday = getYesterdayDate();

  const { data: yesterdayCount = 0 } = useQuery({
    queryKey: [`${table}-yesterday`, yesterday],
    queryFn: () => countByDate(table, yesterday),
    staleTime: 5 * 60 * 1000, // 5 min cache
    refetchInterval: 60000,
  });

  const delta = todayCount - yesterdayCount;
  return { delta, yesterdayCount };
}
