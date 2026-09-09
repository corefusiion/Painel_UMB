import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), 'saneaia.db')

def setup_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Create solicitacoes table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS solicitacoes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ss TEXT,
        os_numero TEXT,
        tipo TEXT,
        especificacao TEXT,
        servico TEXT,
        unidade_os TEXT,
        matricula TEXT,
        setor TEXT,
        bairro TEXT,
        logradouro TEXT,
        cep TEXT,
        data_encerramento TEXT,
        observacao TEXT,
        situacao TEXT,
        data_ultima_tramitacao TEXT,
        mes TEXT,
        localidade TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # Create predicoes_ml table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS predicoes_ml (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bairro TEXT,
        logradouro TEXT,
        probabilidade_reincidencia REAL,
        fator_risco TEXT,
        data_predicao TEXT DEFAULT CURRENT_TIMESTAMP,
        servico TEXT
    )
    """)

    # Views
    cursor.execute("DROP VIEW IF EXISTS solicitacoes_analise")
    cursor.execute("""
    CREATE VIEW solicitacoes_analise AS
    SELECT
        id, ss, os_numero, tipo, especificacao, servico, unidade_os, matricula, setor, bairro, logradouro, cep, data_encerramento, observacao, situacao, data_ultima_tramitacao, mes, localidade, created_at,
        (julianday(data_encerramento) - julianday(data_ultima_tramitacao)) * 24.0 AS tempo_resolucao_horas,
        CASE
            WHEN situacao LIKE '%conclu%' THEN 'Resolvido'
            WHEN situacao = 'Aberta' OR situacao IS NULL THEN 'Em Aberto'
            ELSE 'Em Andamento'
        END AS status_operacional,
        0 AS dia_da_semana,
        CASE
            WHEN data_ultima_tramitacao LIKE '__/__/____%' THEN CAST(substr(data_ultima_tramitacao, 4, 2) AS INTEGER)
            WHEN data_ultima_tramitacao LIKE '____-%' THEN CAST(substr(data_ultima_tramitacao, 6, 2) AS INTEGER)
            WHEN data_encerramento LIKE '__/__/____%' THEN CAST(substr(data_encerramento, 4, 2) AS INTEGER)
            WHEN data_encerramento LIKE '____-%' THEN CAST(substr(data_encerramento, 6, 2) AS INTEGER)
            ELSE NULL
        END AS mes_numero,
        CASE
            WHEN data_ultima_tramitacao LIKE '__/__/____%' THEN CAST(substr(data_ultima_tramitacao, 7, 4) AS INTEGER)
            WHEN data_ultima_tramitacao LIKE '____-%' THEN CAST(substr(data_ultima_tramitacao, 1, 4) AS INTEGER)
            WHEN data_encerramento LIKE '__/__/____%' THEN CAST(substr(data_encerramento, 7, 4) AS INTEGER)
            WHEN data_encerramento LIKE '____-%' THEN CAST(substr(data_encerramento, 1, 4) AS INTEGER)
            WHEN created_at LIKE '__/__/____%' THEN CAST(substr(created_at, 7, 4) AS INTEGER)
            WHEN created_at LIKE '____-%' THEN CAST(substr(created_at, 1, 4) AS INTEGER)
            ELSE NULL
        END AS ano
    FROM solicitacoes;
    """)

    cursor.execute("DROP VIEW IF EXISTS kpis_gerais")
    cursor.execute("""
    CREATE VIEW kpis_gerais AS
    SELECT
        COUNT(*) AS total_solicitacoes,
        SUM(CASE WHEN situacao LIKE '%Executada' AND situacao NOT LIKE '%N%o Executada' THEN 1 ELSE 0 END) AS total_resolvidas,
        SUM(CASE WHEN situacao IN ('Aberta', 'Programada') THEN 1 ELSE 0 END) AS total_abertas,
        COUNT(DISTINCT bairro) AS total_bairros,
        COUNT(DISTINCT logradouro) AS total_logradouros,
        COUNT(DISTINCT CASE WHEN matricula IS NOT NULL AND matricula != '' THEN matricula END) AS total_clientes,
        COUNT(DISTINCT tipo) AS total_tipos_problema,
        COUNT(DISTINCT servico) AS total_servicos
    FROM solicitacoes;
    """)

    cursor.execute("DROP VIEW IF EXISTS analise_por_bairro")
    cursor.execute("""
    CREATE VIEW analise_por_bairro AS
    SELECT
        bairro,
        COUNT(*) AS total_solicitacoes,
        COUNT(DISTINCT matricula) AS clientes_afetados,
        COUNT(DISTINCT logradouro) AS logradouros_afetados,
        COUNT(DISTINCT tipo) AS tipos_problema,
        COUNT(DISTINCT servico) AS servicos_distintos,
        ROUND(AVG((julianday(data_encerramento) - julianday(data_ultima_tramitacao)) * 24.0), 2) AS tempo_medio_horas,
        MIN(data_encerramento) AS primeira_solicitacao,
        MAX(data_encerramento) AS ultima_solicitacao
    FROM solicitacoes
    WHERE bairro IS NOT NULL
    GROUP BY bairro
    ORDER BY total_solicitacoes DESC;
    """)

    cursor.execute("DROP VIEW IF EXISTS analise_temporal")
    cursor.execute("""
    CREATE VIEW analise_temporal AS
    SELECT
        mes,
        CASE
            WHEN data_ultima_tramitacao LIKE '__/__/____%' THEN CAST(substr(data_ultima_tramitacao, 4, 2) AS INTEGER)
            WHEN data_ultima_tramitacao LIKE '____-%' THEN CAST(substr(data_ultima_tramitacao, 6, 2) AS INTEGER)
            ELSE NULL
        END AS mes_numero,
        CASE
            WHEN data_ultima_tramitacao LIKE '__/__/____%' THEN CAST(substr(data_ultima_tramitacao, 7, 4) AS INTEGER)
            WHEN data_ultima_tramitacao LIKE '____-%' THEN CAST(substr(data_ultima_tramitacao, 1, 4) AS INTEGER)
            ELSE NULL
        END AS ano,
        COUNT(*) AS total_solicitacoes,
        COUNT(DISTINCT bairro) AS bairros_afetados,
        COUNT(DISTINCT logradouro) AS logradouros_afetados,
        ROUND(AVG((julianday(data_encerramento) - julianday(data_ultima_tramitacao)) * 24.0), 2) AS tempo_medio_horas
    FROM solicitacoes
    GROUP BY mes_numero, ano
    HAVING ano IS NOT NULL AND ano >= 2000
    ORDER BY ano, mes_numero;
    """)

    cursor.execute("DROP VIEW IF EXISTS analise_por_logradouro")
    cursor.execute("""
    CREATE VIEW analise_por_logradouro AS
    SELECT logradouro, bairro, COUNT(*) as total_solicitacoes
    FROM solicitacoes
    WHERE logradouro IS NOT NULL
    GROUP BY logradouro, bairro;
    """)

    cursor.execute("DROP VIEW IF EXISTS pontos_criticos_logradouro")
    cursor.execute("""
    CREATE VIEW pontos_criticos_logradouro AS
    SELECT logradouro, bairro, COUNT(*) as total_chamados
    FROM solicitacoes
    WHERE logradouro IS NOT NULL
    GROUP BY logradouro, bairro
    HAVING COUNT(*) >= 3;
    """)

    cursor.execute("DROP VIEW IF EXISTS analise_por_servico")
    cursor.execute("""
    CREATE VIEW analise_por_servico AS
    SELECT servico, COUNT(*) as total_solicitacoes
    FROM solicitacoes
    WHERE servico IS NOT NULL
    GROUP BY servico;
    """)

    cursor.execute("DROP VIEW IF EXISTS reincidencia_matricula")
    cursor.execute("""
    CREATE VIEW reincidencia_matricula AS
    SELECT matricula, COUNT(*) as total_chamados, MAX(bairro) as bairro, MAX(logradouro) as logradouro
    FROM solicitacoes
    WHERE matricula IS NOT NULL AND matricula != ''
    GROUP BY matricula
    HAVING COUNT(*) >= 2;
    """)

    conn.commit()
    conn.close()
    print("Database SQLite configurado com sucesso em:", DB_PATH)

if __name__ == '__main__':
    setup_db()
