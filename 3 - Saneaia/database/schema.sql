-- =============================================
-- Schema Atualizado: Plataforma de Inteligencia Operacional
-- v2.0 - Com Logradouro, OS e Servico
-- =============================================

-- =============================================
-- MIGRACAO: Adicionar novas colunas (executar se tabela ja existe)
-- =============================================
ALTER TABLE public.solicitacoes ADD COLUMN IF NOT EXISTS os_numero TEXT;
ALTER TABLE public.solicitacoes ADD COLUMN IF NOT EXISTS logradouro TEXT;
ALTER TABLE public.solicitacoes ADD COLUMN IF NOT EXISTS servico TEXT;

CREATE INDEX IF NOT EXISTS idx_solicitacoes_logradouro ON public.solicitacoes (logradouro);
CREATE INDEX IF NOT EXISTS idx_solicitacoes_servico ON public.solicitacoes (servico);
CREATE INDEX IF NOT EXISTS idx_solicitacoes_os ON public.solicitacoes (os_numero);

-- =============================================
-- Views Atualizadas
-- =============================================

-- View de analise de solicitacoes (campos calculados)
CREATE OR REPLACE VIEW public.solicitacoes_analise AS
SELECT
    id,
    ss,
    os_numero,
    tipo,
    especificacao,
    servico,
    unidade_os,
    matricula,
    setor,
    bairro,
    logradouro,
    cep,
    data_encerramento,
    observacao,
    situacao,
    data_ultima_tramitacao,
    mes,
    localidade,
    created_at,
    EXTRACT(EPOCH FROM (data_encerramento - data_ultima_tramitacao)) / 3600 AS tempo_resolucao_horas,
    CASE
        WHEN situacao ILIKE '%conclu%' THEN 'Resolvido'
        WHEN situacao = 'Aberta' OR situacao IS NULL THEN 'Em Aberto'
        ELSE 'Em Andamento'
    END AS status_operacional,
    EXTRACT(DOW FROM data_encerramento) AS dia_da_semana,
    EXTRACT(MONTH FROM data_encerramento) AS mes_numero,
    EXTRACT(YEAR FROM data_encerramento) AS ano
FROM
    public.solicitacoes;

-- View de KPIs gerais (atualizada com logradouro)
CREATE OR REPLACE VIEW public.kpis_gerais AS
SELECT
    COUNT(*) AS total_solicitacoes,
    COUNT(CASE WHEN situacao ILIKE '%conclu%' THEN 1 END) AS total_resolvidas,
    COUNT(CASE WHEN situacao = 'Aberta' OR situacao IS NULL THEN 1 END) AS total_abertas,
    ROUND(AVG(EXTRACT(EPOCH FROM (data_encerramento - data_ultima_tramitacao)) / 3600)::numeric, 2) AS tempo_medio_resolucao_horas,
    COUNT(DISTINCT bairro) AS total_bairros,
    COUNT(DISTINCT logradouro) AS total_logradouros,
    COUNT(DISTINCT matricula) AS total_clientes,
    COUNT(DISTINCT tipo) AS total_tipos_problema,
    COUNT(DISTINCT servico) AS total_servicos
FROM
    public.solicitacoes;

-- View de analise por bairro (atualizada)
CREATE OR REPLACE VIEW public.analise_por_bairro AS
SELECT
    bairro,
    COUNT(*) AS total_solicitacoes,
    COUNT(DISTINCT matricula) AS clientes_afetados,
    COUNT(DISTINCT logradouro) AS logradouros_afetados,
    COUNT(DISTINCT tipo) AS tipos_problema,
    COUNT(DISTINCT servico) AS servicos_distintos,
    ROUND(AVG(EXTRACT(EPOCH FROM (data_encerramento - data_ultima_tramitacao)) / 3600)::numeric, 2) AS tempo_medio_horas,
    MIN(data_encerramento) AS primeira_solicitacao,
    MAX(data_encerramento) AS ultima_solicitacao
FROM
    public.solicitacoes
WHERE bairro IS NOT NULL
GROUP BY bairro
ORDER BY total_solicitacoes DESC;

-- =============================================
-- NOVAS VIEWS: Analise por Logradouro
-- =============================================

-- View: Analise por logradouro (visao principal)
CREATE OR REPLACE VIEW public.analise_por_logradouro AS
SELECT
    logradouro,
    bairro,
    setor,
    localidade,
    COUNT(*) AS total_solicitacoes,
    COUNT(DISTINCT matricula) AS clientes_afetados,
    COUNT(DISTINCT tipo) AS tipos_problema,
    COUNT(DISTINCT servico) AS servicos_distintos,
    ROUND(AVG(EXTRACT(EPOCH FROM (data_encerramento - data_ultima_tramitacao)) / 3600)::numeric, 2) AS tempo_medio_horas,
    MIN(data_encerramento) AS primeira_solicitacao,
    MAX(data_encerramento) AS ultima_solicitacao
FROM
    public.solicitacoes
WHERE logradouro IS NOT NULL AND logradouro != ''
GROUP BY logradouro, bairro, setor, localidade
ORDER BY total_solicitacoes DESC;

-- View: Pontos criticos (logradouros com 3+ chamados)
CREATE OR REPLACE VIEW public.pontos_criticos_logradouro AS
SELECT
    logradouro,
    bairro,
    setor,
    localidade,
    COUNT(*) AS total_chamados,
    COUNT(DISTINCT matricula) AS matriculas_afetadas,
    COUNT(DISTINCT servico) AS servicos_distintos,
    ROUND(AVG(EXTRACT(EPOCH FROM (data_encerramento - data_ultima_tramitacao)) / 3600)::numeric, 2) AS tempo_medio_horas,
    MIN(data_encerramento) AS primeiro_chamado,
    MAX(data_encerramento) AS ultimo_chamado,
    EXTRACT(DAY FROM (MAX(data_encerramento) - MIN(data_encerramento))) AS dias_entre_primeiro_ultimo
FROM
    public.solicitacoes
WHERE logradouro IS NOT NULL AND logradouro != ''
GROUP BY logradouro, bairro, setor, localidade
HAVING COUNT(*) >= 3
ORDER BY total_chamados DESC;

-- View: Analise por servico
CREATE OR REPLACE VIEW public.analise_por_servico AS
SELECT
    servico,
    COUNT(*) AS total_solicitacoes,
    COUNT(DISTINCT bairro) AS bairros_afetados,
    COUNT(DISTINCT logradouro) AS logradouros_afetados,
    COUNT(DISTINCT matricula) AS clientes_afetados,
    ROUND(AVG(EXTRACT(EPOCH FROM (data_encerramento - data_ultima_tramitacao)) / 3600)::numeric, 2) AS tempo_medio_horas
FROM
    public.solicitacoes
WHERE servico IS NOT NULL
GROUP BY servico
ORDER BY total_solicitacoes DESC;

-- View: Reincidencia por matricula (clientes com 3+ chamados)
CREATE OR REPLACE VIEW public.reincidencia_matricula AS
SELECT
    matricula,
    bairro,
    logradouro,
    setor,
    COUNT(*) AS total_chamados,
    COUNT(DISTINCT tipo) AS tipos_distintos,
    COUNT(DISTINCT servico) AS servicos_distintos,
    MIN(data_encerramento) AS primeiro_chamado,
    MAX(data_encerramento) AS ultimo_chamado,
    EXTRACT(DAY FROM (MAX(data_encerramento) - MIN(data_encerramento))) AS dias_entre_chamados,
    ROUND(AVG(EXTRACT(EPOCH FROM (data_encerramento - data_ultima_tramitacao)) / 3600)::numeric, 2) AS tempo_medio_horas
FROM
    public.solicitacoes
WHERE matricula IS NOT NULL
GROUP BY matricula, bairro, logradouro, setor
HAVING COUNT(*) >= 3
ORDER BY total_chamados DESC;

-- View de analise temporal (atualizada)
CREATE OR REPLACE VIEW public.analise_temporal AS
SELECT
    mes,
    EXTRACT(MONTH FROM data_encerramento) AS mes_numero,
    EXTRACT(YEAR FROM data_encerramento) AS ano,
    COUNT(*) AS total_solicitacoes,
    COUNT(DISTINCT bairro) AS bairros_afetados,
    COUNT(DISTINCT logradouro) AS logradouros_afetados,
    ROUND(AVG(EXTRACT(EPOCH FROM (data_encerramento - data_ultima_tramitacao)) / 3600)::numeric, 2) AS tempo_medio_horas
FROM
    public.solicitacoes
WHERE data_encerramento IS NOT NULL
GROUP BY mes, EXTRACT(MONTH FROM data_encerramento), EXTRACT(YEAR FROM data_encerramento)
ORDER BY ano, mes_numero;
