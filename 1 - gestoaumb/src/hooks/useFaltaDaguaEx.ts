import { useQuery, useQueryClient } from "@tanstack/react-query";
import { API_URL } from "@/lib/api";
import { FaltaDaguaRecord } from "./useFaltaDagua";

export function useFaltaDaguaEx() {
  const queryClient = useQueryClient();

  const { data: records = [], isLoading, error } = useQuery({
    queryKey: ["faltadagua_ex"],
    queryFn: async () => {
      const response = await fetch(`${API_URL}/faltadagua_ex`);
      if (!response.ok) throw new Error("Falha ao buscar faltadagua_ex");
      const json = await response.json();
      return (json.data || []) as FaltaDaguaRecord[];
    },
    refetchInterval: 30000,
  });

  const invalidateCache = () => {
    queryClient.invalidateQueries({ queryKey: ["faltadagua_ex"] });
  };

  const filteredRecords = records.filter(r => {
    const servico = r.servico?.toUpperCase() || "";
    return !servico.includes("37") && !servico.includes("VISITA");
  });

  return {
    records: filteredRecords,
    isLoading,
    error,
    invalidateCache,
  };
}
