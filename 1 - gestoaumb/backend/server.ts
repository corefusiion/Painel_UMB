import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import multer from 'multer';

const app = express();
app.use(cors());
app.use(express.json());

const distPath = path.resolve(__dirname, '../dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
}

// Resolve db path: always prefer the root-level database.sqlite
// process.cwd() when running via `npm run server` from project root = "1 - gestoaumb/"
const dbPathRoot = path.resolve(process.cwd(), 'database.sqlite');
const dbPathBackend = path.resolve(__dirname, '..', 'database.sqlite');
const dbPathFallback = path.resolve(__dirname, 'database.sqlite');

let dbPath: string;
if (fs.existsSync(dbPathRoot)) {
  dbPath = dbPathRoot;
} else if (fs.existsSync(dbPathBackend)) {
  dbPath = dbPathBackend;
} else {
  dbPath = dbPathFallback;
}
console.log(`[DB] Usando banco: ${dbPath}`);

const db = new Database(dbPath);

// Ensure tables exist
db.exec(`
  CREATE TABLE IF NOT EXISTS carropipa (
    id TEXT PRIMARY KEY,
    numero_os TEXT,
    especificacao TEXT,
    servico TEXT,
    localidade TEXT,
    bairro_codigo TEXT,
    bairro_nome TEXT,
    logradouro TEXT,
    cep TEXT,
    data_tramitacao TEXT,
    data_importacao TEXT,
    criado_em TEXT,
    unidade_atual TEXT,
    responsavel TEXT,
    observacao TEXT
  );

  CREATE TABLE IF NOT EXISTS pavimentos (
    id TEXT PRIMARY KEY,
    numero_os TEXT,
    especificacao TEXT,
    servico TEXT,
    tipo_pavimento TEXT,
    localidade TEXT,
    bairro_codigo TEXT,
    bairro_nome TEXT,
    logradouro TEXT,
    data_tramitacao TEXT,
    data_importacao TEXT,
    criado_em TEXT
  );

  CREATE TABLE IF NOT EXISTS faltadagua (
    id TEXT PRIMARY KEY,
    numero_os TEXT,
    especificacao TEXT,
    servico TEXT,
    localidade TEXT,
    bairro_codigo TEXT,
    bairro_nome TEXT,
    logradouro TEXT,
    cep TEXT,
    data_tramitacao TEXT,
    data_importacao TEXT,
    criado_em TEXT,
    unidade_atual TEXT,
    responsavel TEXT,
    observacao TEXT,
    matricula TEXT
  );

  CREATE TABLE IF NOT EXISTS faltadagua_ex (
    id TEXT PRIMARY KEY,
    numero_os TEXT,
    especificacao TEXT,
    servico TEXT,
    localidade TEXT,
    bairro_codigo TEXT,
    bairro_nome TEXT,
    logradouro TEXT,
    cep TEXT,
    num_imovel TEXT,
    data_abertura TEXT,
    data_conclusao TEXT,
    data_tramitacao TEXT,
    data_importacao TEXT,
    criado_em TEXT,
    unidade_atual TEXT,
    responsavel TEXT,
    observacao TEXT,
    matricula TEXT
  );

  CREATE TABLE IF NOT EXISTS vazamentos (
    id TEXT PRIMARY KEY,
    numero_os TEXT,
    especificacao TEXT,
    servico TEXT,
    localidade TEXT,
    bairro_codigo TEXT,
    bairro_nome TEXT,
    logradouro TEXT,
    data_tramitacao TEXT,
    data_importacao TEXT,
    criado_em TEXT,
    unidade_atual TEXT,
    responsavel TEXT,
    tipo_vazamento TEXT
  );

  CREATE TABLE IF NOT EXISTS demandas (
    id TEXT PRIMARY KEY,
    numero_os TEXT,
    especificacao TEXT,
    servico TEXT,
    localidade TEXT,
    bairro_codigo TEXT,
    bairro_nome TEXT,
    logradouro TEXT,
    cep TEXT,
    data_tramitacao TEXT,
    data_importacao TEXT,
    criado_em TEXT,
    unidade_atual TEXT,
    responsavel TEXT,
    observacao TEXT,
    status TEXT DEFAULT 'pendente',
    titulo TEXT,
    local TEXT,
    atualizado_em TEXT
  );

  CREATE TABLE IF NOT EXISTS oge_processos (
    id TEXT PRIMARY KEY,
    tipo TEXT,
    titulo TEXT,
    local TEXT,
    status TEXT DEFAULT 'pendente',
    ultima_observacao TEXT,
    criado_em TEXT,
    atualizado_em TEXT
  );

  CREATE TABLE IF NOT EXISTS ai_insights_faltadagua (
    numero_os TEXT PRIMARY KEY,
    id TEXT,
    faltadagua_id TEXT,
    logradouro TEXT,
    bairro_nome TEXT,
    chance_reincidencia REAL,
    total_chamados_trecho INTEGER,
    reincidencias_90dias INTEGER,
    ai_recomendacao TEXT,
    causa_sistemica TEXT,
    score_satisfacao REAL,
    processado_em TEXT,
    dados_brutos TEXT,
    criado_em TEXT,
    atualizado_em TEXT
  );

  CREATE TABLE IF NOT EXISTS detalhes_os (
    numero_os TEXT PRIMARY KEY,
    equipe_executora TEXT,
    horas_execucao TEXT,
    horas_atendimento TEXT,
    hd_leitura TEXT,
    hd_numero TEXT,
    hd_pressao TEXT,
    imovel_pavimentos TEXT,
    imovel_situacao TEXT,
    imovel_res_inf TEXT,
    imovel_res_sup TEXT,
    ligacao_lacre_cor TEXT,
    ligacao_situacao TEXT,
    hd_lado_direito TEXT,
    hd_lado_direito_leitura TEXT,
    hd_lado_direito_pressao TEXT,
    hd_lado_esquerdo TEXT,
    hd_lado_esquerdo_leitura TEXT,
    hd_lado_esquerdo_pressao TEXT,
    sit_abast_apos_exec TEXT,
    necessidade_desob_ramal TEXT,
    deseja_gerar_desobstrucao TEXT,
    motivo_falta_dagua TEXT,
    ponto_referencia TEXT,
    usuario_presente TEXT,
    material_utilizado TEXT,
    obs_encerramento TEXT,
    qtd_documentos INTEGER,
    status_documentos TEXT,
    criado_em TEXT
  );
`);

// Try adding missing columns to tables if created previously without them
try { db.exec(`ALTER TABLE vazamentos ADD COLUMN tipo_vazamento TEXT`); } catch (e) {}
try { db.exec(`ALTER TABLE faltadagua_ex ADD COLUMN num_imovel TEXT`); } catch (e) {}
try { db.exec(`ALTER TABLE faltadagua_ex ADD COLUMN data_abertura TEXT`); } catch (e) {}
try { db.exec(`ALTER TABLE faltadagua_ex ADD COLUMN data_conclusao TEXT`); } catch (e) {}

// Dummy auth login
app.post('/api/auth/login', (req, res) => {
  res.json({ token: 'mock-jwt-token', user: { id: 1, role: 'admin' } });
});

// Save AI Insight
app.post('/api/ai_insights_faltadagua', (req, res) => {
  try {
    const { numero_os, ai_recomendacao, chance_reincidencia, logradouro, id, total_chamados_trecho, reincidencias_90dias, dados_brutos } = req.body;
    const dadosBrutosJson = typeof dados_brutos === 'object' ? JSON.stringify(dados_brutos) : (dados_brutos || '{}');
    
    const stmt = db.prepare(`
      INSERT INTO ai_insights_faltadagua (numero_os, id, logradouro, ai_recomendacao, chance_reincidencia, total_chamados_trecho, reincidencias_90dias, dados_brutos, criado_em)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(numero_os) DO UPDATE SET
        ai_recomendacao = excluded.ai_recomendacao,
        chance_reincidencia = excluded.chance_reincidencia,
        total_chamados_trecho = excluded.total_chamados_trecho,
        reincidencias_90dias = excluded.reincidencias_90dias,
        dados_brutos = excluded.dados_brutos,
        atualizado_em = excluded.criado_em
    `);
    stmt.run(
      numero_os,
      id || `insight-${Date.now()}`,
      logradouro,
      ai_recomendacao,
      chance_reincidencia || 0,
      total_chamados_trecho || 0,
      reincidencias_90dias || 0,
      dadosBrutosJson,
      new Date().toISOString()
    );
    res.json({ success: true });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Reset AI Insights Table
app.delete('/api/ai_insights_faltadagua', (req, res) => {
  try {
    db.prepare('DELETE FROM ai_insights_faltadagua').run();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Generic GET for any table
app.get('/api/:table', (req, res) => {
  const table = req.params.table;
  try {
    if (table === 'faltadagua_ex') {
        const stmt = db.prepare(`
            SELECT f.*, d.equipe_executora, d.horas_execucao, d.horas_atendimento,
                   d.hd_leitura, d.hd_numero, d.hd_pressao, d.imovel_pavimentos,
                   d.imovel_situacao, d.imovel_res_inf, d.imovel_res_sup,
                   d.ligacao_lacre_cor, d.ligacao_situacao, d.hd_lado_direito,
                   d.hd_lado_direito_leitura, d.hd_lado_direito_pressao,
                   d.hd_lado_esquerdo, d.hd_lado_esquerdo_leitura, d.hd_lado_esquerdo_pressao,
                   d.sit_abast_apos_exec, d.necessidade_desob_ramal, d.deseja_gerar_desobstrucao,
                   d.motivo_falta_dagua, d.ponto_referencia, d.usuario_presente,
                   d.material_utilizado, d.obs_encerramento, d.qtd_documentos, d.status_documentos,
                   d.atende_pop, d.pop_motivo,
                   CASE WHEN d.numero_os IS NOT NULL THEN 1 ELSE 0 END AS possui_detalhes
            FROM faltadagua_ex f
            LEFT JOIN detalhes_os d ON f.numero_os = d.numero_os
            WHERE f.servico LIKE '%FALTA%'
        `);
        const rows = stmt.all();
        res.json({ data: rows });
    } else {
        const stmt = db.prepare(`SELECT * FROM ${table}`);
        const rows = stmt.all();
        res.json({ data: rows });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Save OS Details
app.post('/api/detalhes_os/bulk', (req, res) => {
    try {
        const detalhes = req.body; // Expecting an array
        const stmt = db.prepare(`
            INSERT INTO detalhes_os (
                numero_os, equipe_executora, horas_execucao, horas_atendimento,
                hd_leitura, hd_numero, hd_pressao, imovel_pavimentos,
                imovel_situacao, imovel_res_inf, imovel_res_sup,
                ligacao_lacre_cor, ligacao_situacao, hd_lado_direito,
                hd_lado_direito_leitura, hd_lado_direito_pressao, hd_lado_esquerdo,
                hd_lado_esquerdo_leitura, hd_lado_esquerdo_pressao, sit_abast_apos_exec,
                necessidade_desob_ramal, deseja_gerar_desobstrucao, motivo_falta_dagua,
                ponto_referencia, usuario_presente, material_utilizado, obs_encerramento,
                qtd_documentos, status_documentos, criado_em, atende_pop, pop_motivo,
                sec_ss, sec_tipo
            ) VALUES (
                @numero_os, @equipe_executora, @horas_execucao, @horas_atendimento,
                @hd_leitura, @hd_numero, @hd_pressao, @imovel_pavimentos,
                @imovel_situacao, @imovel_res_inf, @imovel_res_sup,
                @ligacao_lacre_cor, @ligacao_situacao, @hd_lado_direito,
                @hd_lado_direito_leitura, @hd_lado_direito_pressao, @hd_lado_esquerdo,
                @hd_lado_esquerdo_leitura, @hd_lado_esquerdo_pressao, @sit_abast_apos_exec,
                @necessidade_desob_ramal, @deseja_gerar_desobstrucao, @motivo_falta_dagua,
                @ponto_referencia, @usuario_presente, @material_utilizado, @obs_encerramento,
                @qtd_documentos, @status_documentos, @criado_em, @atende_pop, @pop_motivo,
                @sec_ss, @sec_tipo
            )
            ON CONFLICT(numero_os) DO UPDATE SET
                equipe_executora=excluded.equipe_executora, horas_execucao=excluded.horas_execucao,
                horas_atendimento=excluded.horas_atendimento, hd_leitura=excluded.hd_leitura,
                hd_numero=excluded.hd_numero, hd_pressao=excluded.hd_pressao, imovel_pavimentos=excluded.imovel_pavimentos,
                imovel_situacao=excluded.imovel_situacao, imovel_res_inf=excluded.imovel_res_inf, imovel_res_sup=excluded.imovel_res_sup,
                ligacao_lacre_cor=excluded.ligacao_lacre_cor, ligacao_situacao=excluded.ligacao_situacao,
                hd_lado_direito=excluded.hd_lado_direito, hd_lado_direito_leitura=excluded.hd_lado_direito_leitura,
                hd_lado_direito_pressao=excluded.hd_lado_direito_pressao, hd_lado_esquerdo=excluded.hd_lado_esquerdo,
                hd_lado_esquerdo_leitura=excluded.hd_lado_esquerdo_leitura, hd_lado_esquerdo_pressao=excluded.hd_lado_esquerdo_pressao,
                sit_abast_apos_exec=excluded.sit_abast_apos_exec, necessidade_desob_ramal=excluded.necessidade_desob_ramal,
                deseja_gerar_desobstrucao=excluded.deseja_gerar_desobstrucao, motivo_falta_dagua=excluded.motivo_falta_dagua,
                ponto_referencia=excluded.ponto_referencia, usuario_presente=excluded.usuario_presente,
                material_utilizado=excluded.material_utilizado, obs_encerramento=excluded.obs_encerramento,
                qtd_documentos=excluded.qtd_documentos, status_documentos=excluded.status_documentos,
                atende_pop=excluded.atende_pop, pop_motivo=excluded.pop_motivo,
                sec_ss=excluded.sec_ss, sec_tipo=excluded.sec_tipo
        `);
        
        const insertMany = db.transaction((items) => {
            for (const item of items) {
                if (!item.criado_em) item.criado_em = new Date().toISOString();
                
                // Exceção: Roubo/Furto de Hidrômetro isenta de POP
                const motivoFalta = (item.motivo_falta_dagua || "").toUpperCase();
                if (motivoFalta.includes('ROUBO') || motivoFalta.includes('FURTO')) {
                    item.atende_pop = 'Sim';
                    item.pop_motivo = 'Isento de validação: Roubo/furto de hidrômetro reportado pela equipe em campo.';
                    stmt.run(item);
                    return;
                }
                
                // Analise Inteligente de Conformidade (POP 01)
                const motivos = [];
                const obs = (item.obs_encerramento || "").toUpperCase();
                const docs = item.qtd_documentos || 0;
                
                // ── Detecção de Contexto Operacional por Observação ──────────────────────
                // Vizinho/morador recusou acesso ou estava ausente → isenção justificada
                const vizinhoRecusou = obs.includes('NAO PERMITIU') || obs.includes('NÃO PERMITIU') ||
                    obs.includes('RECUSOU') || obs.includes('NAO AUTORIZOU') || obs.includes('NÃO AUTORIZOU') ||
                    obs.includes('IMPEDIU') || obs.includes('NAO DEIXOU') || obs.includes('PROIBIU');
                const moradorAusente = obs.includes('AUSENTE') || obs.includes('NINGUE') || obs.includes('NINGUEM') ||
                    obs.includes('SEM MORADOR') || obs.includes('IMOVEL FECHADO') || obs.includes('IMÓVEL FECHADO') ||
                    obs.includes('PORTA FECHADA') || obs.includes('NAO ENCONTRADO') || obs.includes('SEM ACESSO');
                const isentarVizinho = vizinhoRecusou || moradorAusente;

                // Validação Inteligente da Observação (Mais flexível e com estado Parcial)
                const obsLen = obs.length;
                let pontos = 0;
                let maxPontos = 4;
                
                // ── Regra 1: Documentos ───────────────────────────────────────────────────
                if (docs >= 3) pontos++; else motivos.push(`Documentos insuficientes (${docs}/3).`);
                
                // ── Regra 2: Pressão do Imóvel ────────────────────────────────────────────
                // Isenção: se vizinho/morador recusou acesso, leitura de pressão é impossível
                const pressaoOk = item.hd_pressao && item.hd_pressao.trim() !== '';
                if (pressaoOk) {
                    pontos++;
                } else if (isentarVizinho) {
                    // Isenção contextual: recusa/ausência impede medição — não penaliza
                    pontos++;
                    maxPontos = 4; // mantém maxPontos, mas concede o ponto por isenção
                } else {
                    motivos.push('Pressão (mca) do imóvel não preenchida.');
                }
                
                // ── Regra 3: Leitura de HD de Vizinhos ───────────────────────────────────
                let vizinhosOk = false;
                if ((item.hd_lado_direito_leitura && item.hd_lado_direito_leitura.trim() !== '' && item.hd_lado_direito_leitura.trim() !== '-') || 
                    (item.hd_lado_esquerdo_leitura && item.hd_lado_esquerdo_leitura.trim() !== '' && item.hd_lado_esquerdo_leitura.trim() !== '-')) {
                    vizinhosOk = true;
                }
                
                if (vizinhosOk) {
                    pontos++;
                } else if (isentarVizinho) {
                    // Isenção contextual: vizinho/morador recusou acesso documentado na obs
                    pontos++;
                } else {
                    motivos.push('Falta leitura do HD de vizinhos (direito/esquerdo).');
                }
                
                // ── Regra 4: Qualidade da Observação ─────────────────────────────────────
                let obsOk = false;
                if (obsLen >= 20 && (
                    obs.includes('PRESS') || obs.includes('MCA') || obs.includes('VAZAM') ||
                    obs.includes('NORMAL') || obs.includes('HABITADO') || obs.includes('ABASTECIMENTO') ||
                    obs.includes('NORMALIZADO') || obs.includes('REESTABELECIDO') || obs.includes('RESTABELECIDO') ||
                    obs.includes('EXECUTADO') || obs.includes('VERIFICADO') || obs.includes('CONSTATADO') ||
                    obs.includes('CONSERTADO') || obs.includes('REPARADO') || obs.includes('SUBSTITUIDO') ||
                    obs.includes('SUBSTITUÍDO') || obs.includes('DESOBSTRUIDO') || obs.includes('DESOBSTRUÍDO') ||
                    obs.includes('FECHADO') || obs.includes('ABERTO') || obs.includes('LIGACAO') || obs.includes('LIGAÇÃO')
                )) {
                    obsOk = true;
                }
                if (obsOk) pontos++; else motivos.push('Observação do encerramento muito genérica ou incompleta.');

                // ── Verificação Grave: Constatou Necessidade de Desob, mas não gerou ─────
                const necDesob = (item.necessidade_desob_ramal || "").trim().toLowerCase();
                const gerarDesob = (item.deseja_gerar_desobstrucao || "").trim().toLowerCase();
                let graveFault = false;
                
                if (necDesob.includes('sim') && (gerarDesob.includes('não') || gerarDesob.includes('nao'))) {
                    motivos.push('FALHA GRAVE: Equipe relatou necessidade de desobstrução, mas respondeu NÃO para gerar o serviço secundário.');
                    graveFault = true;
                }

                // ── Classificação Final ───────────────────────────────────────────────────
                if (graveFault) {
                    item.atende_pop = 'Não';
                    item.pop_motivo = motivos.join(' | ');
                } else if (pontos === maxPontos) {
                    // Se houve isenções (vizinho/morador), registrar transparência
                    const isentadoMsg = isentarVizinho
                        ? ' Isenção aplicada: vizinho/morador recusou ou estava ausente (registrado na observação).'
                        : '';
                    item.atende_pop = 'Sim';
                    item.pop_motivo = `Em total conformidade com o POP 01.${isentadoMsg}`;
                } else if (pontos >= 2) {
                    item.atende_pop = 'Parcial';
                    item.pop_motivo = motivos.join(' | ');
                } else {
                    item.atende_pop = 'Não';
                    item.pop_motivo = motivos.join(' | ');
                }

                stmt.run(item);
            }
        });
        insertMany(detalhes);
        res.json({ success: true, inserted: detalhes.length });
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

const upload = multer({ dest: 'uploads/' });

// CSV Helper functions
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

function formatBairroName(bairroRaw: string): string {
  if (!bairroRaw) return "";
  const parts = bairroRaw.split(" - ");
  const name = parts.length >= 2 ? parts.slice(1).join(" - ") : bairroRaw;
  const lowercaseWords = ["de", "da", "do", "das", "dos", "e"];
  return name
    .toLowerCase()
    .split(" ")
    .map((word, idx) => {
      if (idx > 0 && lowercaseWords.includes(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

function formatLogradouro(logradouroRaw: string): string {
  if (!logradouroRaw) return "";
  const parts = logradouroRaw.split(" - ");
  const name = parts.length >= 2 ? parts.slice(1).join(" - ") : logradouroRaw;
  return name
    .toLowerCase()
    .split(" ")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function determinarResponsavel(unidadeAtual: string): string | null {
  if (!unidadeAtual) return null;
  if (unidadeAtual.includes('50281894')) return 'embasa';
  if (unidadeAtual.includes('88880343') || unidadeAtual.includes('50005502')) return 'cnb';
  return null;
}

function detectarTipoVazamento(especificacao: string): 'rede' | 'ramal' | 'hd' {
  if (!especificacao) return 'rede';
  const especTrimmed = especificacao.trim();
  if (especTrimmed.startsWith('1')) return 'rede';
  if (especTrimmed.startsWith('2')) return 'ramal';
  if (especTrimmed.startsWith('3')) return 'hd';
  return 'rede';
}

function detectarTipoPavimento(servico: string): 'asfalto' | 'concreto' {
  if (!servico) return 'concreto';
  return servico.trim().startsWith('160') ? 'asfalto' : 'concreto';
}

function parseBrazilianDate(dateStr: string): string | null {
  if (!dateStr) return null;
  // Suporta tanto DD/MM/YYYY HH:MM:SS quanto DD/MM/YYYY HH:MM
  const match = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (match) {
    const [, day, month, year, hour, minute, second] = match;
    const sec = second || "00";
    return `${year}-${month}-${day}T${hour}:${minute}:${sec}`;
  }
  const dateOnlyMatch = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (dateOnlyMatch) {
    const [, day, month, year] = dateOnlyMatch;
    return `${year}-${month}-${day}T00:00:00`;
  }
  return null;
}

// CSV import endpoint
app.post('/api/import-csv', upload.single('file'), (req, res) => {
  const type = req.body.type;
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    let content = fs.readFileSync(file.path, 'utf8');
    if (content.includes('\ufffd')) {
      content = fs.readFileSync(file.path, 'latin1');
    }

    const lines = content.split(/\r?\n/).filter(l => l.trim() !== '');

    let table = '';
    if (type === 'leaks') table = 'vazamentos';
    else if (type === 'pavement') table = 'pavimentos';
    else if (type === 'waterShortage') table = 'faltadagua';
    else if (type === 'waterShortageEx') table = 'faltadagua_ex';
    else if (type === 'waterTruck') table = 'carropipa';

    if (!table) {
      fs.unlinkSync(file.path);
      return res.status(400).json({ error: `Tipo desconhecido: ${type}` });
    }

    if (lines.length < 2) {
      fs.unlinkSync(file.path);
      return res.json({ count: 0, message: 'Arquivo CSV sem dados' });
    }

    const headerLine = lines[0];
    const separator = headerLine.includes(";") ? ";" : (headerLine.includes(",") ? "," : "\t");
    const headers = parseCsvLine(headerLine, separator);

    const colMap: Record<string, number> = {};
    // Determina se o CSV possui a coluna de observação de encerramento
    const hasObsEnc = headers.some(h => {
      const raw = h.toLowerCase().replace(/^\uFEFF/, "");
      const norm = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
      return norm.includes("obseencdaos") || norm.includes("obsdeenc") || norm.includes("obsblueprint") || norm.includes("obsenc") || (norm.includes("obs") && !norm.includes("ss")) || norm === "enc" || norm.startsWith("encerr");
    });

    headers.forEach((header, index) => {
      const raw = header.toLowerCase().replace(/^\uFEFF/, "");
      const norm = raw
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, "");

      if (norm.includes("dthr") || norm.includes("hrabertura") || (norm.includes("abertura") && (norm.includes("hr") || norm.includes("hora")))) {
        colMap.data_abertura = index;
      } else if (norm.includes("abertura") && colMap.data_abertura === undefined) {
        colMap.data_abertura = index;
      } else if (norm.includes("conclus")) {
        colMap.data_conclusao = index;
      } else if (norm.includes("tramit")) {
        colMap.data_tramitacao = index;
      } else if (norm.includes("obseencdaos") || norm.includes("obsdeenc") || norm.includes("obsblueprint") || norm.includes("obsenc") || (norm.includes("obs") && !norm.includes("ss")) || norm === "enc" || norm.startsWith("encerr")) {
        colMap.observacao = index;
      } else if (norm.includes("sit")) {
        colMap.situacao = index;
      } else if (norm.includes("unid")) {
        colMap.unidade_atual = index;
      } else if (norm.includes("imovel") || norm.includes("num") || norm === "cep") {
        colMap.num_imovel = index;
      } else if (norm === "ss" || norm === "os" || norm.startsWith("ss") || norm.includes("numeroos")) {
        colMap.ss = index;
      } else if (norm.includes("servi")) { // "servi" casa com "servico" e "servio"
        colMap.servico = index;
      } else if (norm.includes("localidade")) {
        colMap.localidade = index;
      } else if (norm.includes("bairro")) {
        colMap.bairro = index;
      } else if (norm.includes("logradouro")) {
        colMap.logradouro = index;
      } else if (norm.includes("matricula") || norm.includes("matri") || norm.includes("matrcul") || norm.startsWith("matr")) { // Segura contra colisões de última tramitação
        colMap.matricula = index;
      } else if (norm.includes("obsdass")) {
        if (hasObsEnc) {
          colMap.especificacao = index; // Em executadas, "Obs da SS" vai para especificacao
        } else {
          colMap.observacao = index; // Em pendentes, "Obs da SS" vai para observacao (para nao colidir com logradouro)
        }
      } else if (norm.includes("especifica")) {
        if (!hasObsEnc) {
          colMap.especificacao = index; // Em pendentes, "Especificao" vai para especificacao (separada de Obs da SS)
        }
      }
    });



    console.log(`[DEBUG] Headers identificados:`, headers);
    console.log(`[DEBUG] Mapeamento de colunas (colMap):`, colMap);

    const safeGet = (values: string[], idx: number | undefined) => (idx === undefined ? "" : values[idx] ?? "");

    let insertedCount = 0;
    const now = new Date().toISOString();
    const today = now.split('T')[0];

    const saneaiaPath = path.resolve(__dirname, '../../3 - Saneaia/database/saneaia.db');
    let saneaiaDb: InstanceType<typeof Database> | null = null;
    if (fs.existsSync(saneaiaPath)) {
      try { saneaiaDb = new Database(saneaiaPath); } catch (e) {}
    }

    db.transaction(() => {
      // 🚀 Se a tabela for de pendências, precisamos limpá-la para refletir a nova "fotografia" do momento
      if (table !== 'faltadagua_ex') {
        db.prepare(`DELETE FROM ${table}`).run();
        // Também limpamos os insights pendentes de falta d'agua (serão reprocessados na Fase 3)
        if (table === 'faltadagua') {
            db.prepare(`DELETE FROM ai_insights_faltadagua`).run();
        }
      }

      // 🚀 UPSERT inteligente por linha para evitar qualquer duplicidade e manter status fiel à extração
      const checkExistsLocal = db.prepare(`SELECT id FROM ${table} WHERE numero_os = ?`);
      const checkExistsSaneaia = saneaiaDb ? saneaiaDb.prepare(`SELECT id FROM solicitacoes WHERE ss = ? OR os_numero = ?`) : null;

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const cols = parseCsvLine(line, separator);

        const numero_os = safeGet(cols, colMap.ss);
        if (!numero_os) continue;

        const especificacao = safeGet(cols, colMap.especificacao);
        const servico = safeGet(cols, colMap.servico);
        const localidade = safeGet(cols, colMap.localidade);
        const bairro_codigo = safeGet(cols, colMap.bairro);
        const bairro_nome = formatBairroName(bairro_codigo);
        const logradouro = formatLogradouro(safeGet(cols, colMap.logradouro));
        const cep = safeGet(cols, colMap.cep).trim();
        const num_imovel = safeGet(cols, colMap.num_imovel).trim() || cep;
        const data_abertura = parseBrazilianDate(safeGet(cols, colMap.data_abertura));
        const data_conclusao = parseBrazilianDate(safeGet(cols, colMap.data_conclusao));
        const data_tramitacao = parseBrazilianDate(safeGet(cols, colMap.data_tramitacao));
        const unidade_atual = safeGet(cols, colMap.unidade_atual) || safeGet(cols, colMap.situacao);
        const responsavel = determinarResponsavel(unidade_atual);
        const observacao = safeGet(cols, colMap.observacao);
        let rawSituacao = safeGet(cols, colMap.situacao) || safeGet(cols, colMap.unidade_atual) || "";
        
        if (!rawSituacao || rawSituacao === "-" || rawSituacao.toLowerCase() === "nan") {
          rawSituacao = table === 'faltadagua_ex' ? 'Concluída Executada' : 'Aberta';
        }

        if (table === 'faltadagua_ex') {
          const sitLower = rawSituacao.toLowerCase();
          if (sitLower.includes('abert') || sitLower.includes('program')) {
            continue;
          }
        }

        let rawMat = safeGet(cols, colMap.matricula).trim();
        let matricula = "";
        if (rawMat && rawMat !== '-' && rawMat !== '—') {
          const parts = rawMat.split(/\s+/);
          matricula = /^\d+$/.test(parts[0]) ? parts[0] : rawMat;
        }
        if (!matricula || matricula === '-' || matricula === '—') {
          const matMatch = (observacao + " " + especificacao).match(/MATRICULA:\s*(\d+)/i);
          if (matMatch) {
            matricula = matMatch[1];
          }
        }
        if (!matricula) {
          matricula = num_imovel ? `MAT-${num_imovel}` : `MAT-${numero_os.slice(-6)}`;
        }

        // 1. Tratamento para tabela de Executadas (faltadagua_ex): remover das Pendentes se for executada
        if (table === 'faltadagua_ex') {
          db.prepare(`DELETE FROM faltadagua WHERE numero_os = ?`).run(numero_os);
          db.prepare(`DELETE FROM ai_insights_faltadagua WHERE numero_os = ?`).run(numero_os);
        }

        // 2. UPSERT em database.sqlite
        const existingLocal = checkExistsLocal.get(numero_os);
        const id = existingLocal ? (existingLocal as any).id : `${table}-${Date.now()}-${i}`;

        if (table === 'vazamentos') {
          const tipo_vazamento = detectarTipoVazamento(especificacao);
          if (existingLocal) {
            db.prepare(`UPDATE vazamentos SET especificacao=?, servico=?, localidade=?, bairro_codigo=?, bairro_nome=?, logradouro=?, data_tramitacao=?, data_importacao=?, unidade_atual=?, responsavel=?, tipo_vazamento=? WHERE numero_os=?`).run(especificacao, servico, localidade, bairro_codigo, bairro_nome, logradouro, data_tramitacao, today, unidade_atual, responsavel, tipo_vazamento, numero_os);
          } else {
            db.prepare(`INSERT INTO vazamentos (id, numero_os, especificacao, servico, localidade, bairro_codigo, bairro_nome, logradouro, data_tramitacao, data_importacao, criado_em, unidade_atual, responsavel, tipo_vazamento) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, numero_os, especificacao, servico, localidade, bairro_codigo, bairro_nome, logradouro, data_tramitacao, today, now, unidade_atual, responsavel, tipo_vazamento);
          }
        } else if (table === 'pavimentos') {
          const tipo_pavimento = detectarTipoPavimento(servico);
          if (existingLocal) {
            db.prepare(`UPDATE pavimentos SET especificacao=?, servico=?, tipo_pavimento=?, localidade=?, bairro_codigo=?, bairro_nome=?, logradouro=?, data_tramitacao=?, data_importacao=? WHERE numero_os=?`).run(especificacao, servico, tipo_pavimento, localidade, bairro_codigo, bairro_nome, logradouro, data_tramitacao, today, numero_os);
          } else {
            db.prepare(`INSERT INTO pavimentos (id, numero_os, especificacao, servico, tipo_pavimento, localidade, bairro_codigo, bairro_nome, logradouro, data_tramitacao, data_importacao, criado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, numero_os, especificacao, servico, tipo_pavimento, localidade, bairro_codigo, bairro_nome, logradouro, data_tramitacao, today, now);
          }
        } else if (table === 'faltadagua') {
          if (existingLocal) {
            db.prepare(`UPDATE faltadagua SET especificacao=?, servico=?, localidade=?, bairro_codigo=?, bairro_nome=?, logradouro=?, cep=?, data_tramitacao=?, data_importacao=?, unidade_atual=?, responsavel=?, observacao=?, matricula=? WHERE numero_os=?`).run(especificacao, servico, localidade, bairro_codigo, bairro_nome, logradouro, cep, data_tramitacao, today, unidade_atual, responsavel, observacao, matricula, numero_os);
          } else {
            db.prepare(`INSERT INTO faltadagua (id, numero_os, especificacao, servico, localidade, bairro_codigo, bairro_nome, logradouro, cep, data_tramitacao, data_importacao, criado_em, unidade_atual, responsavel, observacao, matricula) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, numero_os, especificacao, servico, localidade, bairro_codigo, bairro_nome, logradouro, cep, data_tramitacao, today, now, unidade_atual, responsavel, observacao, matricula);
          }
        } else if (table === 'faltadagua_ex') {
          if (existingLocal) {
            db.prepare(`UPDATE faltadagua_ex SET especificacao=?, servico=?, localidade=?, bairro_codigo=?, bairro_nome=?, logradouro=?, cep=?, num_imovel=?, data_abertura=?, data_conclusao=?, data_tramitacao=?, data_importacao=?, unidade_atual=?, responsavel=?, observacao=?, matricula=? WHERE numero_os=?`).run(especificacao, servico, localidade, bairro_codigo, bairro_nome, logradouro, cep, num_imovel, data_abertura, data_conclusao, data_tramitacao, today, unidade_atual, responsavel, observacao, matricula, numero_os);
          } else {
            db.prepare(`INSERT INTO faltadagua_ex (id, numero_os, especificacao, servico, localidade, bairro_codigo, bairro_nome, logradouro, cep, num_imovel, data_abertura, data_conclusao, data_tramitacao, data_importacao, criado_em, unidade_atual, responsavel, observacao, matricula) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, numero_os, especificacao, servico, localidade, bairro_codigo, bairro_nome, logradouro, cep, num_imovel, data_abertura, data_conclusao, data_tramitacao, today, now, unidade_atual, responsavel, observacao, matricula);
          }
        } else if (table === 'carropipa') {
          if (existingLocal) {
            db.prepare(`UPDATE carropipa SET especificacao=?, servico=?, localidade=?, bairro_codigo=?, bairro_nome=?, logradouro=?, cep=?, data_tramitacao=?, data_importacao=?, unidade_atual=?, responsavel=?, observacao=? WHERE numero_os=?`).run(especificacao, servico, localidade, bairro_codigo, bairro_nome, logradouro, cep, data_tramitacao, today, unidade_atual, responsavel, observacao, numero_os);
          } else {
            db.prepare(`INSERT INTO carropipa (id, numero_os, especificacao, servico, localidade, bairro_codigo, bairro_nome, logradouro, cep, data_tramitacao, data_importacao, criado_em, unidade_atual, responsavel, observacao) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, numero_os, especificacao, servico, localidade, bairro_codigo, bairro_nome, logradouro, cep, data_tramitacao, today, now, unidade_atual, responsavel, observacao);
          }
        }

        // 3. (REMOVIDO) Não inserir/atualizar na saneaia.db a partir do Projeto 1. 
        // O Projeto 3 recebe sua própria extração de forma independente.
        // if (saneaiaDb && checkExistsSaneaia) { ... }

        insertedCount++;
      }
    })();

    if (saneaiaDb) {
      try { saneaiaDb.close(); } catch (e) {}
    }

    fs.unlinkSync(file.path);
    console.log(`[IMPORT] Tabela '${table}': ${insertedCount} registros processados via UPSERT.`);

    // O corte de datas hardcoded foi removido pois a tabela já sofre TRUNCATE no inicio.

    res.json({ count: insertedCount, message: 'Importado e atualizado via UPSERT sem duplicidades!' });
  } catch (err: any) {
    if (file && fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
    console.error('[IMPORT ERROR]', err);
    res.status(500).json({ error: err.message });
  }
});

// Endpoint explícito para forçar a sincronização de status a qualquer momento
app.post('/api/sync-status', (req, res) => {
  try {
    const cleanPendentes = db.prepare(`
      DELETE FROM faltadagua 
      WHERE numero_os IN (SELECT numero_os FROM faltadagua_ex WHERE numero_os IS NOT NULL AND numero_os != '')
    `).run();

    db.prepare(`
      DELETE FROM ai_insights_faltadagua 
      WHERE numero_os IN (SELECT numero_os FROM faltadagua_ex WHERE numero_os IS NOT NULL AND numero_os != '')
    `).run();

    // O filtro de datas antigas foi removido
    const changes = cleanPendentes.changes;
    const saneaiaPath = path.resolve(__dirname, '../../3 - Saneaia/database/saneaia.db');
    if (fs.existsSync(saneaiaPath)) {
      const saneaiaDb = new Database(saneaiaPath);
      saneaiaDb.prepare(`
        UPDATE solicitacoes 
        SET situacao = 'Concluída Executada'
        WHERE (os_numero IN (SELECT numero_os FROM faltadagua_ex WHERE numero_os IS NOT NULL AND numero_os != '')
           OR ss IN (SELECT numero_os FROM faltadagua_ex WHERE numero_os IS NOT NULL AND numero_os != ''))
      `).run();
      saneaiaDb.prepare(`
        UPDATE solicitacoes 
        SET situacao = 'Concluída Executada'
        WHERE (situacao NOT LIKE '%Conclu%' AND situacao NOT LIKE '%Cancel%')
          AND (
            data_ultima_tramitacao NOT LIKE '%09/08%' 
            AND data_ultima_tramitacao NOT LIKE '%10/08%'
            AND data_ultima_tramitacao NOT LIKE '%2026-08-09%'
            AND data_ultima_tramitacao NOT LIKE '%2026-08-10%'
          )
      `).run();
      saneaiaDb.close();
    }

    res.json({
      success: true,
      executadasRemovidasDasPendentes: cleanPendentes.changes,
      antigasConcluidas: cleanOld.changes,
      message: "Status e desduplicação sincronizados com sucesso."
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

if (fs.existsSync(distPath)) {
  app.get('/{*path}', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Start server
app.listen(3001, '0.0.0.0', () => {
  console.log('Backend rodando em http://0.0.0.0:3001');
});
