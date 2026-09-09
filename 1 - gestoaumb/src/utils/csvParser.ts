/**
 * Utilitário para parse de CSV de Falta D'Água, Pavimentos e Vazamentos
 */

export interface FaltaDaguaRecord {
  numero_os: string;
  especificacao: string;
  servico: string;
  localidade: string;
  bairro_codigo: string;
  bairro_nome: string;
  logradouro: string;
  cep: string;
  data_tramitacao: string | null;
  unidade_atual: string;
  responsavel: 'embasa' | 'cnb' | null;
  observacao: string;
}

/**
 * Resume texto longo para exibição na tabela
 * Corta no último espaço antes do limite para não quebrar palavras
 */
export function resumirObservacao(obs: string, maxLength: number = 100): string {
  if (!obs || obs.length <= maxLength) return obs || "";
  
  const truncated = obs.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");
  
  if (lastSpace > maxLength * 0.7) {
    return truncated.substring(0, lastSpace).trim() + "...";
  }
  
  return truncated.trim() + "...";
}

/**
 * Determina o responsável baseado no código da unidade atual
 * 50281894 = Embasa (DIV REG DE SERVICOS OPER)
 * 88880343 = CNB (empreiteira/execução)
 */
export function determinarResponsavel(unidadeAtual: string): 'embasa' | 'cnb' | null {
  if (!unidadeAtual) return null;
  if (unidadeAtual.includes('50281894')) return 'embasa'; // Embasa - DIV REG DE SERVICOS OPER
  if (unidadeAtual.includes('88880343')) return 'cnb';
  if (unidadeAtual.includes('50005502')) return 'cnb'; // ESCR.LAURO DE FREITAS
  return null;
}

/**
 * Formata nome do bairro removendo código e convertendo para Title Case
 * "16 - BOCA DO RIO" -> "Boca do Rio"
 */
export function formatBairroName(bairroRaw: string): string {
  if (!bairroRaw) return "";
  
  const parts = bairroRaw.split(" - ");
  if (parts.length >= 2) {
    const name = parts.slice(1).join(" - ");
    return name
      .toLowerCase()
      .split(" ")
      .map(word => {
        // Palavras que não devem ser capitalizadas (exceto início)
        const lowercaseWords = ["de", "da", "do", "das", "dos", "e"];
        if (lowercaseWords.includes(word)) {
          return word;
        }
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(" ");
  }
  return bairroRaw;
}

/**
 * Formata logradouro removendo código
 * "68450 - RU DA TRANQUILIDADE" -> "Ru Da Tranquilidade"
 */
export function formatLogradouro(logradouroRaw: string): string {
  if (!logradouroRaw) return "";
  
  const parts = logradouroRaw.split(" - ");
  if (parts.length >= 2) {
    const name = parts.slice(1).join(" - ");
    return name
      .toLowerCase()
      .split(" ")
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }
  return logradouroRaw;
}

/**
 * Converte data brasileira para ISO
 * "27/01/2026 14:01:05" -> "2026-01-27T14:01:05"
 */
export function parseBrazilianDate(dateStr: string): string | null {
  if (!dateStr) return null;
  
  // Formato: DD/MM/YYYY HH:mm:ss
  const match = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/);
  if (match) {
    const [, day, month, year, hour, minute, second] = match;
    return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
  }
  
  // Formato: DD/MM/YYYY
  const dateOnlyMatch = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (dateOnlyMatch) {
    const [, day, month, year] = dateOnlyMatch;
    return `${year}-${month}-${day}T00:00:00`;
  }
  
  return null;
}

/**
 * Faz parse do CSV de Falta D'Água
 * Suporta separador ponto-e-vírgula (;) e encoding Latin-1
 */
export async function parseWaterShortageCsv(file: File): Promise<FaltaDaguaRecord[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split("\n").filter(line => line.trim());
        
        if (lines.length < 2) {
          reject(new Error("Arquivo CSV vazio ou sem dados"));
          return;
        }
        
        // Primeira linha é o header
        const headerLine = lines[0];
        const separator = headerLine.includes(";") ? ";" : ",";
        const headers = headerLine.split(separator).map(h => h.trim().replace(/"/g, ""));
        
        // Mapear índices das colunas
        const columnMap: Record<string, number> = {};
        headers.forEach((header, index) => {
          const normalizedHeader = header.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          
          // PRIMEIRO: Verificar "Obs da SS" (antes de "SS" para evitar conflito)
          if (normalizedHeader.includes("obs") && normalizedHeader.includes("ss")) {
            columnMap.observacao = index;
          // DEPOIS: Verificar "SS" - header deve ser exatamente "ss" ou começar com "ss" sem conter "obs"
          } else if (normalizedHeader === "ss" || (normalizedHeader.startsWith("ss") && !normalizedHeader.includes("obs"))) {
            columnMap.ss = index;
          } else if (normalizedHeader.includes("especificacao")) {
            columnMap.especificacao = index;
          } else if (normalizedHeader.includes("servico")) {
            columnMap.servico = index;
          } else if (normalizedHeader.includes("localidade")) {
            columnMap.localidade = index;
          } else if (normalizedHeader.includes("bairro")) {
            columnMap.bairro = index;
          } else if (normalizedHeader.includes("logradouro")) {
            columnMap.logradouro = index;
          } else if (normalizedHeader === "cep") {
            columnMap.cep = index;
          } else if (
            (normalizedHeader.includes("data") && normalizedHeader.includes("tramita")) ||
            normalizedHeader.includes("ultima tramitacao")
          ) {
            columnMap.data_tramitacao = index;
          } else if (normalizedHeader.includes("unid") && normalizedHeader.includes("atual")) {
            columnMap.unidade_atual = index;
          }
        });
        
        // Verificar colunas obrigatórias
        if (columnMap.ss === undefined || columnMap.bairro === undefined) {
          reject(new Error("Colunas obrigatórias não encontradas (SS, Bairro)"));
          return;
        }
        
        const records: FaltaDaguaRecord[] = [];
        
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          
          // Parse da linha considerando aspas
          const values = parseCsvLine(line, separator);
          
          const bairroCodigo = values[columnMap.bairro] || "";
          const bairroNome = formatBairroName(bairroCodigo);
          const logradouroRaw = values[columnMap.logradouro] || "";
          const logradouro = formatLogradouro(logradouroRaw);
          
          const unidadeAtual = values[columnMap.unidade_atual] || "";
          
          const observacaoRaw = values[columnMap.observacao] || "";
          
          const cepRaw = values[columnMap.cep] || "";
          // Formatar CEP: remover não-dígitos
          const cep = cepRaw.replace(/\D/g, "");
          
          const record: FaltaDaguaRecord = {
            numero_os: values[columnMap.ss] || "",
            especificacao: values[columnMap.especificacao] || "",
            servico: values[columnMap.servico] || "",
            localidade: values[columnMap.localidade] || "",
            bairro_codigo: bairroCodigo,
            bairro_nome: bairroNome,
            logradouro: logradouro,
            cep: cep,
            data_tramitacao: parseBrazilianDate(values[columnMap.data_tramitacao] || ""),
            unidade_atual: unidadeAtual,
            responsavel: determinarResponsavel(unidadeAtual),
            observacao: resumirObservacao(observacaoRaw),
          };
          
          // Só adicionar se tiver número da OS
          if (record.numero_os) {
            records.push(record);
          }
        }
        
        resolve(records);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error("Erro ao ler arquivo"));
    
    // Tentar ler como UTF-8 primeiro, depois Latin-1
    reader.readAsText(file, "UTF-8");
  });
}

/**
 * Parse de linha CSV considerando aspas
 */
function parseCsvLine(line: string, separator: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === separator && !inQuotes) {
      values.push(current.trim().replace(/^"|"$/g, ""));
      current = "";
    } else {
      current += char;
    }
  }
  
  values.push(current.trim().replace(/^"|"$/g, ""));
  
  return values;
}

/**
 * Mapeamento de bairros para regiões
 */
export const BAIRRO_REGIAO_MAP: Record<string, string> = {
  // Zona Leste
  "Itapua": "Zona Leste",
  "Itapuã": "Zona Leste",
  "Pituacu": "Zona Leste",
  "Pituaçu": "Zona Leste",
  "Patamares": "Zona Leste",
  "Boca Do Rio": "Zona Leste",
  "Boca do Rio": "Zona Leste",
  "Imbuí": "Zona Leste",
  "Imbui": "Zona Leste",
  "Stiep": "Zona Leste",
  "Costa Azul": "Zona Leste",
  "Armacao": "Zona Leste",
  "Armação": "Zona Leste",
  "Piatã": "Zona Leste",
  "Piata": "Zona Leste",
  "Stella Maris": "Zona Leste",
  "Praia Do Flamengo": "Zona Leste",
  "Praia do Flamengo": "Zona Leste",
  "Mussurunga": "Zona Leste",
  "São Cristóvão": "Zona Leste",
  "Sao Cristovao": "Zona Leste",
  
  // Zona Norte
  "Cajazeiras": "Zona Norte",
  "Pau Da Lima": "Zona Norte",
  "Pau da Lima": "Zona Norte",
  "Cabula": "Zona Norte",
  "Cabula Vi": "Zona Norte",
  "Cabula 6": "Zona Norte",
  "Pernambués": "Zona Norte",
  "Pernambues": "Zona Norte",
  "Tancredo Neves": "Zona Norte",
  "Sussuarana": "Zona Norte",
  "Novo Horizonte": "Zona Norte",
  "Narandiba": "Zona Norte",
  "Doron": "Zona Norte",
  "Saboeiro": "Zona Norte",
  "Engomadeira": "Zona Norte",
  "Mata Escura": "Zona Norte",
  "São Gonçalo Do Retiro": "Zona Norte",
  "Sao Goncalo Do Retiro": "Zona Norte",
  "Canabrava": "Zona Norte",
  "Castelo Branco": "Zona Norte",
  "Resgate": "Zona Norte",
  "Beiru": "Zona Norte",
  "Alt Coqueirinho": "Zona Leste",
  "Alto do Coqueirinho": "Zona Leste",
  
  // Zona Sul
  "Barra": "Zona Sul",
  "Rio Vermelho": "Zona Sul",
  "Ondina": "Zona Sul",
  "Federação": "Zona Sul",
  "Federacao": "Zona Sul",
  "Garcia": "Zona Sul",
  "Canela": "Zona Sul",
  "Graça": "Zona Sul",
  "Graca": "Zona Sul",
  "Vitória": "Zona Sul",
  "Vitoria": "Zona Sul",
  "Amaralina": "Zona Sul",
  "Pituba": "Zona Sul",
  "Horto Florestal": "Zona Sul",
  "Brotas": "Zona Sul",
  "Engenho Velho Da Federação": "Zona Sul",
  "Engenho Velho De Brotas": "Zona Sul",
  "Nordeste De Amaralina": "Zona Sul",
  "Nordeste de Amaralina": "Zona Sul",
  "Vale Das Pedrinhas": "Zona Sul",
  "Chapada Do Rio Vermelho": "Zona Sul",
  
  // Zona Oeste (Subúrbio)
  "Periperi": "Zona Oeste",
  "Plataforma": "Zona Oeste",
  "Paripe": "Zona Oeste",
  "São Tomé De Paripe": "Zona Oeste",
  "Sao Tome De Paripe": "Zona Oeste",
  "Coutos": "Zona Oeste",
  "Fazenda Coutos": "Zona Oeste",
  "Itacaranha": "Zona Oeste",
  "Praia Grande": "Zona Oeste",
  "Lobato": "Zona Oeste",
  "Alto Do Cabrito": "Zona Oeste",
  "Boa Vista De São Caetano": "Zona Oeste",
  "São Caetano": "Zona Oeste",
  "Sao Caetano": "Zona Oeste",
  "Liberdade": "Zona Oeste",
  "Caixa Dágua": "Zona Oeste",   // Salvador (com acento)
  "Caixa Dagua": "Lauro de Freitas", // Lauro de Freitas (sem acento, como vem do banco)
  "Pero Vaz": "Zona Oeste",
  "Curuzu": "Zona Oeste",
  "Cidade Nova": "Zona Oeste",
  "Fazenda Grande Do Retiro": "Zona Oeste",
  "Fazenda Grande do Retiro": "Zona Oeste",
  "Campinas De Pirajá": "Zona Oeste",
  "Campinas de Pirajá": "Zona Oeste",
  "Pirajá": "Zona Oeste",
  "Piraja": "Zona Oeste",
  "Valéria": "Zona Oeste",
  "Valeria": "Zona Oeste",
  "Águas Claras": "Zona Oeste",
  "Aguas Claras": "Zona Oeste",
  "Cajazeira": "Zona Oeste",
  "Bom Juá": "Zona Oeste",
  "Bom Jua": "Zona Oeste",
  "Marechal Rondon": "Zona Oeste",
  "Nova Brasília": "Zona Oeste",
  "Nova Brasilia": "Zona Oeste",
  "São Marcos": "Zona Oeste",
  "Sao Marcos": "Zona Oeste",
  
  // Centro
  "Centro": "Centro",
  "Comércio": "Centro",
  "Comercio": "Centro",
  "Pelourinho": "Centro",
  "Centro Histórico": "Centro",
  "Centro Historico": "Centro",
  "Barris": "Centro",
  "Tororó": "Centro",
  "Tororo": "Centro",
  "Nazaré": "Centro",
  "Nazare": "Centro",
  "Saúde": "Centro",
  "Saude": "Centro",
  "Barbalho": "Centro",
  "Lapinha": "Centro",
  "Macaúbas": "Centro",
  "Macaubas": "Centro",
  "Dois De Julho": "Centro",
  "Dois de Julho": "Centro",
  "Campo Grande": "Centro",
  "Mouraria": "Centro",
  "Santo Antônio Além Do Carmo": "Centro",
  "Santo Antonio Alem Do Carmo": "Centro",
  
  // Lauro de Freitas
  "Caji": "Lauro de Freitas",
  "Itinga": "Lauro de Freitas",
  "Portão": "Lauro de Freitas",
  "Portao": "Lauro de Freitas",
  "Vila Praiana": "Lauro de Freitas",
  "Vilas Atlantico": "Lauro de Freitas",
  "Vilas Atlântico": "Lauro de Freitas",
};

/**
 * Detecta a cidade baseado no CEP
 * Salvador: CEPs começando com 40xxx a 42xxx (exceto 4270x)
 * Lauro de Freitas: CEPs começando com 42700 a 42709
 */
export function detectCidadeByCep(cep: string): 'Salvador' | 'Lauro de Freitas' | null {
  if (!cep) return null;
  const cleaned = cep.replace(/\D/g, '');
  
  // Lauro de Freitas: 42700-000 a 42709-999
  if (cleaned.startsWith('4270')) {
    return 'Lauro de Freitas';
  }
  
  // Salvador: 40000-000 a 42699-999
  if (cleaned.startsWith('40') || cleaned.startsWith('41') || 
      cleaned.startsWith('42')) {
    return 'Salvador';
  }
  
  return null;
}

/**
 * Determina a região de um bairro
 */
export function getBairroRegiao(bairroNome: string): string {
  if (!bairroNome) return "Outras";
  
  // Tentar match exato
  if (BAIRRO_REGIAO_MAP[bairroNome]) {
    return BAIRRO_REGIAO_MAP[bairroNome];
  }
  
  // Tentar match parcial
  const normalizedBairro = bairroNome.toLowerCase();
  for (const [bairro, regiao] of Object.entries(BAIRRO_REGIAO_MAP)) {
    if (normalizedBairro.includes(bairro.toLowerCase()) || 
        bairro.toLowerCase().includes(normalizedBairro)) {
      return regiao;
    }
  }
  
  return "Outras";
}

/**
 * Interface para registro de Pavimento
 */
export interface PavimentoRecord {
  numero_os: string;
  especificacao: string;
  servico: string;
  tipo_pavimento: 'asfalto' | 'concreto';
  localidade: string;
  bairro_codigo: string;
  bairro_nome: string;
  logradouro: string;
  data_tramitacao: string | null;
}

/**
 * Detecta o tipo de pavimento baseado no campo Serviço
 * Se o código do serviço começar com "160" -> 'asfalto', demais -> 'concreto'
 */
export function detectarTipoPavimento(servico: string): 'asfalto' | 'concreto' {
  if (!servico) return 'concreto';
  // Verificar se o código do serviço começa com "160"
  const servicoTrimmed = servico.trim();
  if (servicoTrimmed.startsWith('160')) {
    return 'asfalto';
  }
  return 'concreto';
}

/**
 * Faz parse do CSV de Pavimentos
 * Mesma estrutura do CSV de Falta D'Água, com campo tipo_pavimento adicional
 */
export async function parsePavimentoCsv(file: File): Promise<PavimentoRecord[]> {
  const buffer = await file.arrayBuffer();
  const encodings: Array<"utf-8" | "windows-1252" | "iso-8859-1"> = [
    "utf-8",
    "windows-1252",
    "iso-8859-1",
  ];

  const parseText = (text: string): PavimentoRecord[] => {
    const lines = text.split(/\r?\n/).filter((line) => line.trim());

    if (lines.length < 2) {
      throw new Error("Arquivo CSV vazio ou sem dados");
    }

    // Primeira linha é o header
    const headerLine = lines[0];
    const separator = headerLine.includes(";")
      ? ";"
      : headerLine.includes(",")
        ? ","
        : headerLine.includes("\t")
          ? "\t"
          : ";";

    const headers = headerLine
      .split(separator)
      .map((h) => h.trim().replace(/"/g, "").replace(/^\uFEFF/, ""));

    // Mapear índices das colunas
    const columnMap: Record<string, number> = {};
    headers.forEach((header, index) => {
      const normalizedHeader = header
        .toLowerCase()
        .replace(/^\uFEFF/, "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, "");

      if (normalizedHeader === "ss" || normalizedHeader.includes("ss")) {
        columnMap.ss = index;
      } else if (normalizedHeader.includes("especificacao")) {
        columnMap.especificacao = index;
      } else if (normalizedHeader === "servico" || normalizedHeader.includes("servico")) {
        columnMap.servico = index;
      } else if (normalizedHeader.includes("localidade")) {
        columnMap.localidade = index;
      } else if (normalizedHeader.includes("bairro")) {
        columnMap.bairro = index;
      } else if (normalizedHeader.includes("logradouro")) {
        columnMap.logradouro = index;
      } else if (normalizedHeader.includes("data") && normalizedHeader.includes("tramitacao")) {
        columnMap.data_tramitacao = index;
      }
    });

    // Verificar colunas obrigatórias
    if (columnMap.ss === undefined || columnMap.bairro === undefined) {
      throw new Error("Colunas obrigatórias não encontradas (SS, Bairro)");
    }
    if (columnMap.servico === undefined) {
      throw new Error(
        'Coluna "Serviço" não encontrada. Exporte o arquivo como CSV (ponto-e-vírgula) e tente novamente.'
      );
    }

    const safeGet = (values: string[], idx: number | undefined) =>
      idx === undefined ? "" : values[idx] ?? "";

    const records: PavimentoRecord[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Parse da linha considerando aspas
      const values = parseCsvLine(line, separator);

      const bairroCodigo = safeGet(values, columnMap.bairro);
      const bairroNome = formatBairroName(bairroCodigo);
      const logradouroRaw = safeGet(values, columnMap.logradouro);
      const logradouro = formatLogradouro(logradouroRaw);
      const servico = safeGet(values, columnMap.servico);

      const record: PavimentoRecord = {
        numero_os: safeGet(values, columnMap.ss),
        especificacao: safeGet(values, columnMap.especificacao),
        servico,
        tipo_pavimento: detectarTipoPavimento(servico),
        localidade: safeGet(values, columnMap.localidade),
        bairro_codigo: bairroCodigo,
        bairro_nome: bairroNome,
        logradouro,
        data_tramitacao: parseBrazilianDate(safeGet(values, columnMap.data_tramitacao)),
      };

      // Só adicionar se tiver número da OS
      if (record.numero_os) {
        records.push(record);
      }
    }

    return records;
  };

  let lastError: unknown = null;
  for (const encoding of encodings) {
    try {
      const text = new TextDecoder(encoding).decode(buffer);
      return parseText(text);
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Não foi possível ler o arquivo CSV.");
}

/**
 * Interface para registro de Vazamento
 */
export interface VazamentoRecord {
  numero_os: string;
  especificacao: string;
  tipo_vazamento: 'rede' | 'ramal' | 'hd';
  servico: string;
  localidade: string;
  bairro_codigo: string;
  bairro_nome: string;
  logradouro: string;
  data_tramitacao: string | null;
}

/**
 * Detecta o tipo de vazamento baseado no campo Especificação
 * "1 - VAZAMENTO NA REDE" -> 'rede'
 * "2 - VAZAMENTO NO RAMAL" -> 'ramal'
 * "3 - VAZAMENTO NO HD" -> 'hd'
 */
export function detectarTipoVazamento(especificacao: string): 'rede' | 'ramal' | 'hd' {
  if (!especificacao) return 'rede';
  const especTrimmed = especificacao.trim();
  if (especTrimmed.startsWith('1')) {
    return 'rede';
  } else if (especTrimmed.startsWith('2')) {
    return 'ramal';
  } else if (especTrimmed.startsWith('3')) {
    return 'hd';
  }
  return 'rede';
}

/**
 * Faz parse do CSV de Vazamentos
 * Estrutura similar ao CSV de Falta D'Água, com campo tipo_vazamento adicional
 */
export async function parseVazamentoCsv(file: File): Promise<VazamentoRecord[]> {
  const buffer = await file.arrayBuffer();
  const encodings: Array<"utf-8" | "windows-1252" | "iso-8859-1"> = [
    "utf-8",
    "windows-1252",
    "iso-8859-1",
  ];

  const parseText = (text: string): VazamentoRecord[] => {
    const lines = text.split(/\r?\n/).filter((line) => line.trim());

    if (lines.length < 2) {
      throw new Error("Arquivo CSV vazio ou sem dados");
    }

    // Primeira linha é o header
    const headerLine = lines[0];
    const separator = headerLine.includes(";")
      ? ";"
      : headerLine.includes(",")
        ? ","
        : headerLine.includes("\t")
          ? "\t"
          : ";";

    const headers = headerLine
      .split(separator)
      .map((h) => h.trim().replace(/"/g, "").replace(/^\uFEFF/, ""));

    // Mapear índices das colunas
    const columnMap: Record<string, number> = {};
    headers.forEach((header, index) => {
      const normalizedHeader = header
        .toLowerCase()
        .replace(/^\uFEFF/, "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, "");

      if (normalizedHeader === "ss" || normalizedHeader.includes("ss")) {
        columnMap.ss = index;
      } else if (normalizedHeader.includes("especificacao")) {
        columnMap.especificacao = index;
      } else if (normalizedHeader === "servico" || normalizedHeader.includes("servico")) {
        columnMap.servico = index;
      } else if (normalizedHeader.includes("localidade")) {
        columnMap.localidade = index;
      } else if (normalizedHeader.includes("bairro")) {
        columnMap.bairro = index;
      } else if (normalizedHeader.includes("logradouro")) {
        columnMap.logradouro = index;
      } else if (normalizedHeader.includes("data") && normalizedHeader.includes("tramitacao")) {
        columnMap.data_tramitacao = index;
      }
    });

    // Verificar colunas obrigatórias
    if (columnMap.ss === undefined || columnMap.bairro === undefined) {
      throw new Error("Colunas obrigatórias não encontradas (SS, Bairro)");
    }
    if (columnMap.especificacao === undefined) {
      throw new Error(
        'Coluna "Especificação" não encontrada. Exporte o arquivo como CSV (ponto-e-vírgula) e tente novamente.'
      );
    }

    const safeGet = (values: string[], idx: number | undefined) =>
      idx === undefined ? "" : values[idx] ?? "";

    const records: VazamentoRecord[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Parse da linha considerando aspas
      const values = parseCsvLine(line, separator);

      const bairroCodigo = safeGet(values, columnMap.bairro);
      const bairroNome = formatBairroName(bairroCodigo);
      const logradouroRaw = safeGet(values, columnMap.logradouro);
      const logradouro = formatLogradouro(logradouroRaw);
      const especificacao = safeGet(values, columnMap.especificacao);

      const record: VazamentoRecord = {
        numero_os: safeGet(values, columnMap.ss),
        especificacao,
        tipo_vazamento: detectarTipoVazamento(especificacao),
        servico: safeGet(values, columnMap.servico),
        localidade: safeGet(values, columnMap.localidade),
        bairro_codigo: bairroCodigo,
        bairro_nome: bairroNome,
        logradouro,
        data_tramitacao: parseBrazilianDate(safeGet(values, columnMap.data_tramitacao)),
      };

      // Só adicionar se tiver número da OS
      if (record.numero_os) {
        records.push(record);
      }
    }

    return records;
  };

  let lastError: unknown = null;
  for (const encoding of encodings) {
    try {
      const text = new TextDecoder(encoding).decode(buffer);
      return parseText(text);
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Não foi possível ler o arquivo CSV.");
}

/**
 * Interface para registro de Carro Pipa
 */
export interface CarroPipaRecord {
  numero_os: string;
  especificacao: string;
  servico: string;
  localidade: string;
  bairro_codigo: string;
  bairro_nome: string;
  logradouro: string;
  cep: string;
  data_tramitacao: string | null;
  unidade_atual: string;
  responsavel: 'embasa' | 'cnb' | null;
  observacao: string;
}

/**
 * Faz parse do CSV de Carro Pipa
 * Mesma estrutura do CSV de Falta D'Água
 */
export async function parseCarroPipaCsv(file: File): Promise<CarroPipaRecord[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split("\n").filter(line => line.trim());
        
        if (lines.length < 2) {
          reject(new Error("Arquivo CSV vazio ou sem dados"));
          return;
        }
        
        const headerLine = lines[0];
        const separator = headerLine.includes(";") ? ";" : ",";
        const headers = headerLine.split(separator).map(h => h.trim().replace(/"/g, ""));
        
        const columnMap: Record<string, number> = {};
        headers.forEach((header, index) => {
          const normalizedHeader = header.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          
          if (normalizedHeader.includes("obs") && normalizedHeader.includes("ss")) {
            columnMap.observacao = index;
          } else if (normalizedHeader === "ss" || (normalizedHeader.startsWith("ss") && !normalizedHeader.includes("obs"))) {
            columnMap.ss = index;
          } else if (normalizedHeader.includes("especificacao")) {
            columnMap.especificacao = index;
          } else if (normalizedHeader.includes("servico")) {
            columnMap.servico = index;
          } else if (normalizedHeader.includes("localidade")) {
            columnMap.localidade = index;
          } else if (normalizedHeader.includes("bairro")) {
            columnMap.bairro = index;
          } else if (normalizedHeader.includes("logradouro")) {
            columnMap.logradouro = index;
          } else if (normalizedHeader === "cep") {
            columnMap.cep = index;
          } else if (
            (normalizedHeader.includes("data") && normalizedHeader.includes("tramita")) ||
            normalizedHeader.includes("ultima tramitacao")
          ) {
            columnMap.data_tramitacao = index;
          } else if (normalizedHeader.includes("unid") && normalizedHeader.includes("atual")) {
            columnMap.unidade_atual = index;
          }
        });
        
        if (columnMap.ss === undefined || columnMap.bairro === undefined) {
          reject(new Error("Colunas obrigatórias não encontradas (SS, Bairro)"));
          return;
        }
        
        const records: CarroPipaRecord[] = [];
        
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          
          const values = parseCsvLine(line, separator);
          
          const bairroCodigo = values[columnMap.bairro] || "";
          const bairroNome = formatBairroName(bairroCodigo);
          const logradouroRaw = values[columnMap.logradouro] || "";
          const logradouro = formatLogradouro(logradouroRaw);
          const unidadeAtual = values[columnMap.unidade_atual] || "";
          const observacaoRaw = values[columnMap.observacao] || "";
          const cepRaw = values[columnMap.cep] || "";
          const cep = cepRaw.replace(/\D/g, "");
          
          const record: CarroPipaRecord = {
            numero_os: values[columnMap.ss] || "",
            especificacao: values[columnMap.especificacao] || "",
            servico: values[columnMap.servico] || "",
            localidade: values[columnMap.localidade] || "",
            bairro_codigo: bairroCodigo,
            bairro_nome: bairroNome,
            logradouro: logradouro,
            cep: cep,
            data_tramitacao: parseBrazilianDate(values[columnMap.data_tramitacao] || ""),
            unidade_atual: unidadeAtual,
            responsavel: determinarResponsavel(unidadeAtual),
            observacao: resumirObservacao(observacaoRaw),
          };
          
          if (record.numero_os) {
            records.push(record);
          }
        }
        
        resolve(records);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error("Erro ao ler arquivo"));
    reader.readAsText(file, "UTF-8");
  });
}
