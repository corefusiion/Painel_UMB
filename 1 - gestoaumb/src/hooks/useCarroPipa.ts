import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { API_URL } from "@/lib/api";

export interface CarroPipaRecord {
  id: string;
  numero_os: string;
  especificacao: string | null;
  servico: string | null;
  localidade: string | null;
  bairro_codigo: string;
  bairro_nome: string;
  logradouro: string | null;
  cep: string | null;
  data_tramitacao: string | null;
  data_importacao: string;
  criado_em: string;
  unidade_atual: string | null;
  responsavel: string | null;
  observacao: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// BAIRROS OCULTOS — CARRO PIPA
// Para reexibir um bairro no futuro, basta remover o nome desta lista.
// Comparação case-insensitive (maiúsculas/minúsculas são ignoradas).
// ─────────────────────────────────────────────────────────────────────────────
const BAIRROS_OCULTOS_CARRO_PIPA = [
  "CASSANGE",
];

export function useCarroPipa() {
  const queryClient = useQueryClient();

  const { data: records = [], isLoading, error, refetch } = useQuery({
    queryKey: ["carropipa"],
    queryFn: async () => {
      const { data, error } = await fetch(`${API_URL}/carropipa`).then(res => res.json());

      if (error) throw error;
      
      const today = new Date().toISOString().split("T")[0];
      const filtered = (data || [])
        .filter((r: any) => r.data_importacao === today)
        // Ocultar bairros configurados em BAIRROS_OCULTOS_CARRO_PIPA
        .filter((r: any) => {
          const bairroNome = (r.bairro_nome || "").toUpperCase().trim();
          return !BAIRROS_OCULTOS_CARRO_PIPA.includes(bairroNome);
        });
      return filtered as CarroPipaRecord[];
    },
    refetchInterval: 30000,
  });

  const { totalOcorrencias, totalSSA, totalLF } = useMemo(() => {
    const isLauroFreitas = (r: CarroPipaRecord) => r.localidade?.includes("700");
    const isSalvador = (r: CarroPipaRecord) => r.localidade?.includes("900");

    return {
      totalOcorrencias: records.length,
      totalSSA: records.filter(r => isSalvador(r)).length,
      totalLF: records.filter(r => isLauroFreitas(r)).length,
    };
  }, [records]);

  const invalidateCache = () => {
    queryClient.invalidateQueries({ queryKey: ["carropipa"] });
  };

  return {
    records,
    totalOcorrencias,
    totalSSA,
    totalLF,
    isLoading,
    error,
    refetch,
    invalidateCache,
  };
}
