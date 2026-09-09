import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), 'saneaia.db')

conn = sqlite3.connect(DB_PATH)
c = conn.cursor()

c.execute("DROP VIEW IF EXISTS analise_temporal")
c.execute("""
CREATE VIEW analise_temporal AS
SELECT
    mes,
    CAST(substr(data_encerramento, 6, 2) AS INTEGER) AS mes_numero,
    CAST(substr(data_encerramento, 1, 4) AS INTEGER) AS ano,
    COUNT(*) AS total_solicitacoes,
    COUNT(DISTINCT bairro) AS bairros_afetados,
    COUNT(DISTINCT logradouro) AS logradouros_afetados,
    ROUND(AVG((julianday(data_encerramento) - julianday(data_ultima_tramitacao)) * 24.0), 2) AS tempo_medio_horas
FROM solicitacoes
WHERE data_encerramento IS NOT NULL
  AND length(data_encerramento) >= 10
GROUP BY mes, mes_numero, ano
ORDER BY ano, mes_numero
""")

c.execute("DROP VIEW IF EXISTS reincidencia_matricula")
c.execute("""
CREATE VIEW reincidencia_matricula AS
SELECT matricula, COUNT(*) as total_chamados, MAX(bairro) as bairro, MAX(logradouro) as logradouro
FROM solicitacoes
WHERE matricula IS NOT NULL AND matricula != ''
GROUP BY matricula
HAVING COUNT(*) >= 2
""")

conn.commit()

print("=== analise_temporal (amostra) ===")
for r in c.execute("SELECT * FROM analise_temporal ORDER BY ano, mes_numero LIMIT 8"):
    print("  ", r)
n = c.execute("SELECT COUNT(*) FROM analise_temporal").fetchone()[0]
print("total linhas:", n)

print("\n=== reincidencia_matricula (amostra) ===")
for r in c.execute("SELECT * FROM reincidencia_matricula ORDER BY total_chamados DESC LIMIT 5"):
    print("  ", r)
n2 = c.execute("SELECT COUNT(*) FROM reincidencia_matricula").fetchone()[0]
print("total linhas:", n2)

conn.close()
