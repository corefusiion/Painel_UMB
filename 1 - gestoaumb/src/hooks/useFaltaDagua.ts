import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { API_URL } from "@/lib/api";
import { getBairroRegiao } from "@/utils/csvParser";

export interface FaltaDaguaRecord {
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
  responsavel: 'embasa' | 'cnb' | null;
  observacao: string | null;
  matricula: string | null;
}

export interface BairroCount {
  bairro: string;
  count: number;
  regiao: string;
  ceps: string[];
  coordenadas: { x: number; y: number };
}

// Coordenadas base para cada região no mapa
const REGIAO_COORDENADAS: Record<string, { x: number; y: number }> = {
  "Zona Leste": { x: 80, y: 70 },
  "Zona Norte": { x: 60, y: 25 },
  "Zona Sul": { x: 45, y: 80 },
  "Zona Oeste": { x: 20, y: 40 },
  "Centro": { x: 50, y: 55 },
  "Lauro de Freitas": { x: 85, y: 20 },
  "Outras": { x: 50, y: 90 },
};

// Offsets para distribuir múltiplos bairros na mesma região
const OFFSET_PATTERNS = [
  { x: 0, y: 0 },
  { x: -12, y: -18 },
  { x: 12, y: 18 },
  { x: -15, y: 12 },
  { x: 15, y: -12 },
];

export function useFaltaDagua() {
  const queryClient = useQueryClient();
  
  const { data: records = [], isLoading, error, refetch } = useQuery({
    queryKey: ["faltadagua"],
    queryFn: async () => {
      const { data, error } = await fetch(`${API_URL}/faltadagua`).then(res => res.json());
      
      if (error) throw error;
      return (data || []) as FaltaDaguaRecord[];
    },
    refetchInterval: 30000,
  });

  // Memoizar todos os cálculos derivados para evitar loops
  const { totalOcorrencias, totalCNB, totalEmbasa, cnbSSA, cnbLF, top5Bairros, filteredRecords } = useMemo(() => {
    // Filtrar registros excluindo visitas (serviço 37 ou contendo a palavra visita)
    const filteredRecords = records.filter(r => {
      const servico = r.servico?.toUpperCase() || "";
      return !servico.includes("37") && !servico.includes("VISITA");
    });
    
    // Funções de filtro por localidade
    const isLauroFreitas = (r: FaltaDaguaRecord) => r.localidade?.includes("700");
    const isSalvador = (r: FaltaDaguaRecord) => r.localidade?.includes("900");

    const total = filteredRecords.length;
    const cnb = filteredRecords.filter(r => r.responsavel === 'cnb').length;
    const embasa = filteredRecords.filter(r => r.responsavel === 'embasa').length;

    // CNB por localidade
    const cnbSSA = filteredRecords.filter(r => r.responsavel === 'cnb' && isSalvador(r)).length;
    const cnbLF = filteredRecords.filter(r => r.responsavel === 'cnb' && isLauroFreitas(r)).length;

    // Agrupar por bairro com CEPs
    const bairrosMap: Record<string, { count: number; ceps: string[] }> = {};
    
    filteredRecords.forEach(record => {
      const bairro = record.bairro_nome || "Desconhecido";
      if (!bairrosMap[bairro]) {
        bairrosMap[bairro] = { count: 0, ceps: [] };
      }
      bairrosMap[bairro].count++;
      if (record.cep && record.cep.length >= 8) {
        bairrosMap[bairro].ceps.push(record.cep);
      }
    });

    // Top 5 com CEPs únicos e coordenadas para mini-mapa
    const top5Base = Object.entries(bairrosMap)
      .map(([bairro, data]) => ({
        bairro,
        count: data.count,
        regiao: getBairroRegiao(bairro),
        ceps: [...new Set(data.ceps)],
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Agrupar por região e aplicar offsets
    const bairrosPorRegiao: Record<string, typeof top5Base> = {};
    top5Base.forEach(b => {
      if (!bairrosPorRegiao[b.regiao]) {
        bairrosPorRegiao[b.regiao] = [];
      }
      bairrosPorRegiao[b.regiao].push(b);
    });

    const top5: BairroCount[] = [];
    Object.entries(bairrosPorRegiao).forEach(([regiao, bairrosNaRegiao]) => {
      const baseCoord = REGIAO_COORDENADAS[regiao] || REGIAO_COORDENADAS["Outras"];
      bairrosNaRegiao.forEach((b, index) => {
        const offset = OFFSET_PATTERNS[index] || OFFSET_PATTERNS[0];
        top5.push({
          ...b,
          coordenadas: {
            x: baseCoord.x + offset.x,
            y: baseCoord.y + offset.y,
          },
        });
      });
    });

    return {
      totalOcorrencias: total,
      totalCNB: cnb,
      totalEmbasa: total - cnb, // Qualquer coisa que não seja CNB cai para Embasa
      cnbSSA,
      cnbLF,
      top5Bairros: top5,
      filteredRecords
    };
  }, [records]);

  const invalidateCache = () => {
    queryClient.invalidateQueries({ queryKey: ["faltadagua"] });
  };

  return {
    records: filteredRecords,
    totalOcorrencias,
    totalCNB,
    totalEmbasa,
    cnbSSA,
    cnbLF,
    top5Bairros,
    isLoading,
    error,
    refetch,
    invalidateCache,
  };
}
