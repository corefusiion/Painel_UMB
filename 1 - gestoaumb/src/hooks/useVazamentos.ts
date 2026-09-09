import { useQuery, useQueryClient } from "@tanstack/react-query";
import { API_URL } from "@/lib/api";
import { formatBairroName, getBairroRegiao } from "@/utils/csvParser";

export interface VazamentoRecord {
  id: string;
  numero_os: string;
  especificacao: string | null;
  tipo_vazamento: string | null;
  servico: string | null;
  localidade: string | null;
  bairro_codigo: string;
  bairro_nome: string;
  logradouro: string | null;
  data_tramitacao: string | null;
  data_importacao: string;
}

export interface BairroCount {
  bairro: string;
  count: number;
  regiao: string;
}

export interface VazamentoStats {
  total: number;
  rede: number;
  ramal: number;
  hd: number;
  // Por localidade
  redeSSA: number;
  redeLF: number;
  ramalSSA: number;
  ramalLF: number;
  hdSSA: number;
  hdLF: number;
  top5Bairros: BairroCount[];
}

const POLLING_INTERVAL = 30000; // 30 segundos

async function fetchVazamentos(): Promise<VazamentoRecord[]> {
  const today = new Date().toISOString().split("T")[0];

  const { data, error } = await fetch(`${API_URL}/vazamentos`).then(res => res.json());

  if (error) {
    console.error("Erro ao buscar vazamentos:", error);
    throw error;
  }

  const filtered = (data || []).filter((r: any) => r.data_importacao === today);
  return filtered as VazamentoRecord[];
}

function calculateStats(records: VazamentoRecord[]): VazamentoStats {
  // Funções de filtro por localidade
  const isLauroFreitas = (r: VazamentoRecord) => r.localidade?.includes("700");
  const isSalvador = (r: VazamentoRecord) => r.localidade?.includes("900");

  // Contar por tipo de vazamento
  let rede = 0;
  let ramal = 0;
  let hd = 0;

  records.forEach((record) => {
    const tipo = record.tipo_vazamento?.toLowerCase() || "";
    if (tipo === "rede") {
      rede++;
    } else if (tipo === "ramal") {
      ramal++;
    } else if (tipo === "hd") {
      hd++;
    }
  });

  // Por tipo e localidade
  const redeSSA = records.filter(r => r.tipo_vazamento?.toLowerCase() === 'rede' && isSalvador(r)).length;
  const redeLF = records.filter(r => r.tipo_vazamento?.toLowerCase() === 'rede' && isLauroFreitas(r)).length;
  const ramalSSA = records.filter(r => r.tipo_vazamento?.toLowerCase() === 'ramal' && isSalvador(r)).length;
  const ramalLF = records.filter(r => r.tipo_vazamento?.toLowerCase() === 'ramal' && isLauroFreitas(r)).length;
  const hdSSA = records.filter(r => r.tipo_vazamento?.toLowerCase() === 'hd' && isSalvador(r)).length;
  const hdLF = records.filter(r => r.tipo_vazamento?.toLowerCase() === 'hd' && isLauroFreitas(r)).length;

  // Calcular Top 5 bairros
  const bairroCountMap: Record<string, number> = {};

  records.forEach((record) => {
    const bairro = record.bairro_nome || "Desconhecido";
    bairroCountMap[bairro] = (bairroCountMap[bairro] || 0) + 1;
  });

  const top5Bairros: BairroCount[] = Object.entries(bairroCountMap)
    .map(([bairro, count]) => ({
      bairro,
      count,
      regiao: getBairroRegiao(bairro),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    total: records.length,
    rede,
    ramal,
    hd,
    redeSSA,
    redeLF,
    ramalSSA,
    ramalLF,
    hdSSA,
    hdLF,
    top5Bairros,
  };
}

export function useVazamentos() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["vazamentos-today"],
    queryFn: fetchVazamentos,
    refetchInterval: POLLING_INTERVAL,
    staleTime: POLLING_INTERVAL / 2,
  });

  // Filtrar registros excluindo visitas (serviço 37)
  const filteredRecords = (query.data || []).filter(r => !r.servico?.includes("37"));

  const stats = calculateStats(filteredRecords);

  const invalidateCache = () => {
    queryClient.invalidateQueries({ queryKey: ["vazamentos-today"] });
  };

  return {
    records: filteredRecords,
    stats,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    invalidateCache,
  };
}
